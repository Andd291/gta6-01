// Solmar City — the simulation. A deterministic city (roads, blocks, buildings, a park, a
// plaza and a beach), traffic that follows the streets, pedestrians who walk the sidewalks
// and flee from trouble, a wanted system with pursuing police, four story missions, and
// on-foot / in-car combat. Everything advances in fixed 1/60 s steps.

import {
  BEACH_Y, CAR_TYPES, MISSIONS, PED, PLAYER, POLICE_CAR_HITS, POLICE_RAM_COOLDOWN,
  POLICE_RAM_DAMAGE, ROADS_X, ROADS_Y, ROAD_HALF, STEP, WANTED_CALM_SECONDS,
  WANTED_DECAY_SECONDS, WANTED_MAX, WATER_Y, WORLD,
} from './config.js';
import { createRandom } from './random.js';

export const EVENT_NONE = 0;
export const EVENT_WASTED = 1;
export const EVENT_MISSION = 2;
export const EVENT_STORY = 4;

const TAU = Math.PI * 2;

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
function pick(rand, arr) { return arr[Math.floor(rand() * arr.length)]; }

function circleHitsRect(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

/** Push a circle out of every building it overlaps; returns true if it hit anything. */
function resolveBuildings(x, y, r, buildings) {
  let hit = false;
  for (let i = 0; i < buildings.length; i += 1) {
    const b = buildings[i];
    if (!circleHitsRect(x, y, r, b)) continue;
    hit = true;
    const nx = clamp(x, b.x, b.x + b.w);
    const ny = clamp(y, b.y, b.y + b.h);
    let dx = x - nx;
    let dy = y - ny;
    if (dx === 0 && dy === 0) {
      // Centre inside the rect: push out along the smallest penetration.
      const left = x - b.x;
      const right = b.x + b.w - x;
      const top = y - b.y;
      const bottom = b.y + b.h - y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) dx = -1;
      else if (m === right) dx = 1;
      else if (m === top) dy = -1;
      else dy = 1;
    }
    const len = Math.hypot(dx, dy) || 1;
    const push = r - Math.min(r, Math.hypot(x - nx, y - ny)) + 0.5;
    x += (dx / len) * push;
    y += (dy / len) * push;
  }
  return { x, y, hit };
}

function nearestRoadPoint(x, y, rand) {
  // A random point on a random road, at least `minDist` from (x, y) when possible.
  for (let tries = 0; tries < 12; tries += 1) {
    let px;
    let py;
    if (rand() < 0.5) {
      px = pick(rand, ROADS_X);
      py = rand() * WORLD.height;
    } else {
      px = rand() * WORLD.width;
      py = pick(rand, ROADS_Y);
    }
    if (dist(px, py, x, y) > 420) return { x: px, y: py };
  }
  return { x: pick(rand, ROADS_X), y: pick(rand, ROADS_Y) };
}

export function createWorld(rand) {
  const state = {
    time: 0,
    buildings: [],
    trees: [],
    cars: [],
    peds: [],
    bullets: [],
    player: null,
    missionIndex: 0,
    missionStage: 0,
    missionTimer: 0,
    collected: [false, false, false],
    storyDone: false,
    banner: null,
    bannerUntil: 0,
    camera: { x: 1200, y: 1100 },
    wantedCalm: 0,
    wantedDecay: 0,
    lastCrimeAt: -100,
    stats: { carsStolen: 0, missionsDone: 0, cashEarned: 0 },
    saveDirty: false,
    muzzle: 0,
  };

  function buildCity() {
    const roofs = ['#b5654d', '#c98a4b', '#7d8aa5', '#a5a06b', '#9668a0', '#5d8a7a', '#b5b0a4'];
    const xs = [0, ...ROADS_X, WORLD.width];
    const ys = [0, ...ROADS_Y, WORLD.height];
    for (let bi = 0; bi < xs.length - 1; bi += 1) {
      for (let bj = 0; bj < ys.length - 1; bj += 1) {
        const x0 = xs[bi] + ROAD_HALF + 16;
        const x1 = xs[bi + 1] - ROAD_HALF - 16;
        const y0 = ys[bj] + ROAD_HALF + 16;
        const y1 = Math.min(ys[bj + 1] - ROAD_HALF - 16, BEACH_Y - 20);
        if (x1 - x0 < 90 || y1 - y0 < 90) continue;
        // The park block and the plaza stay open.
        if (xs[bi] === 1200 && ys[bj] === 800) continue;
        if (xs[bi] === 2000 && ys[bj] === 400) continue;
        const cols = x1 - x0 > 300 ? 2 : 1;
        const rows = y1 - y0 > 300 ? 2 : 1;
        const cw = (x1 - x0) / cols;
        const ch = (y1 - y0) / rows;
        for (let ci = 0; ci < cols; ci += 1) {
          for (let cj = 0; cj < rows; cj += 1) {
            if (rand() < 0.18) continue;
            const inset = 14 + rand() * 16;
            const bw = cw - inset * 2;
            const bh = ch - inset * 2;
            state.buildings.push({
              x: x0 + ci * cw + inset,
              y: y0 + cj * ch + inset,
              w: bw,
              h: bh,
              color: pick(rand, roofs),
              detail: rand(),
            });
          }
        }
      }
    }
    // Park trees and a few plaza palms.
    for (let i = 0; i < 16; i += 1) {
      state.trees.push({ x: 1254 + rand() * 292, y: 854 + rand() * 292, r: 16 + rand() * 10 });
    }
    for (let i = 0; i < 6; i += 1) {
      state.trees.push({ x: 2054 + rand() * 292, y: 454 + rand() * 292, r: 14 + rand() * 8 });
    }
  }

  function spawnCar(type, x, y, angle, parked, driver) {
    const def = CAR_TYPES[type];
    const car = {
      type, x, y, angle, speed: 0, parked: !!parked, driver: driver || null,
      targetSpeed: 0, axis: Math.abs(Math.sin(angle)) > Math.abs(Math.cos(angle)) ? 'v' : 'h',
      dir: 1, hits: 0, disabled: false, disableTimer: 0, ramCd: 0, smoke: 0,
      color: def.color, length: def.length, width: def.width,
    };
    if (!parked) {
      car.targetSpeed = 120 + rand() * 70;
      car.dir = rand() < 0.5 ? 1 : -1;
    }
    state.cars.push(car);
    return car;
  }

  function spawnTraffic() {
    const types = ['sedan', 'taxi', 'pickup', 'sport'];
    for (let i = 0; i < 14; i += 1) {
      const onVertical = rand() < 0.5;
      let x;
      let y;
      let angle;
      if (onVertical) {
        x = pick(rand, ROADS_X) + (rand() < 0.5 ? -19 : 19);
        y = 100 + rand() * (WORLD.height - 300);
        angle = rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        x = 100 + rand() * (WORLD.width - 200);
        y = pick(rand, ROADS_Y) + (rand() < 0.5 ? -19 : 19);
        angle = rand() < 0.5 ? 0 : Math.PI;
      }
      spawnCar(pick(rand, types), x, y, angle, false, 'ped');
    }
    // Parked cars along the streets.
    for (let i = 0; i < 10; i += 1) {
      const onVertical = rand() < 0.5;
      let x;
      let y;
      let angle;
      if (onVertical) {
        x = pick(rand, ROADS_X) + (rand() < 0.5 ? -1 : 1) * (ROAD_HALF + 14);
        y = 150 + rand() * (WORLD.height - 400);
        angle = rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        x = 150 + rand() * (WORLD.width - 300);
        y = pick(rand, ROADS_Y) + (rand() < 0.5 ? -1 : 1) * (ROAD_HALF + 14);
        angle = rand() < 0.5 ? 0 : Math.PI;
      }
      const p = resolveBuildings(x, y, 24, state.buildings);
      spawnCar(pick(rand, types), p.x, p.y, angle, true, null);
    }
  }

  function sidewalkPoint() {
    const onVertical = rand() < 0.5;
    if (onVertical) {
      const rx = pick(rand, ROADS_X);
      return { x: rx + (rand() < 0.5 ? -1 : 1) * (ROAD_HALF + 12), y: 80 + rand() * (BEACH_Y - 160) };
    }
    const ry = pick(rand, ROADS_Y);
    return { x: 80 + rand() * (WORLD.width - 160), y: ry + (rand() < 0.5 ? -1 : 1) * (ROAD_HALF + 12) };
  }

  function spawnPed(x, y) {
    const spot = x === undefined ? sidewalkPoint() : { x, y };
    const target = sidewalkPoint();
    const shirts = ['#e5534b', '#4fc3f7', '#f2c94c', '#7dd069', '#e8e4da', '#c98a4b', '#9668a0'];
    state.peds.push({
      x: spot.x, y: spot.y, angle: rand() * TAU, speed: 0,
      tx: target.x, ty: target.y, state: 'walk', timer: 0,
      shirt: pick(rand, shirts), downTimer: 0,
    });
  }

  function spawnPolice() {
    const spot = nearestRoadPoint(state.player.x, state.player.y, rand);
    const car = spawnCar('police', spot.x, spot.y, angleTo(spot.x, spot.y, state.player.x, state.player.y), false, 'police');
    car.targetSpeed = CAR_TYPES.police.maxSpeed;
    return car;
  }

  function setBanner(text, sub, seconds) {
    state.banner = { text, sub: sub || '' };
    state.bannerUntil = state.time + (seconds || 3);
  }

  function addWanted(n) {
    const p = state.player;
    if (p.wanted < WANTED_MAX) p.wanted = Math.min(WANTED_MAX, p.wanted + n);
    state.lastCrimeAt = state.time;
    state.wantedCalm = 0;
    state.wantedDecay = 0;
  }

  function completeMission() {
    const mission = MISSIONS[state.missionIndex];
    state.player.cash += mission.reward;
    state.stats.cashEarned += mission.reward;
    state.stats.missionsDone += 1;
    state.missionIndex += 1;
    state.missionStage = 0;
    state.missionTimer = 0;
    state.collected = [false, false, false];
    state.saveDirty = true;
    if (state.missionIndex >= MISSIONS.length) {
      state.storyDone = true;
      setBanner('STORY COMPLETE', 'Solmar City is yours now, Danny. Free roam.', 5);
      return EVENT_MISSION | EVENT_STORY;
    }
    const next = MISSIONS[state.missionIndex];
    setBanner('MISSION COMPLETE', `${mission.title} — $${mission.reward}. Next: ${next.title}`, 4);
    if (state.missionIndex === 3) {
      state.player.wanted = 3;
      state.lastCrimeAt = state.time;
      setBanner('MISSION 4 — THE GETAWAY', 'Three stars on you. Reach the safehouse alive.', 4);
    }
    return EVENT_MISSION;
  }

  function missionTarget() {
    if (state.missionIndex >= MISSIONS.length) return null;
    const m = MISSIONS[state.missionIndex];
    if (m.id === 'package') return state.missionStage === 0 ? m.pickup : m.target;
    if (m.id === 'collections') {
      for (let i = 0; i < m.targets.length; i += 1) {
        if (!state.collected[i]) return m.targets[i];
      }
      return null;
    }
    return m.target;
  }

  function updateMissions(dt, ctrl) {
    if (state.missionIndex >= MISSIONS.length) return EVENT_NONE;
    const m = MISSIONS[state.missionIndex];
    const p = state.player;
    const d = (t) => dist(p.x, p.y, t.x, t.y);
    if (m.id === 'wheels') {
      if (p.car && d(m.target) < 80) return completeMission();
    } else if (m.id === 'package') {
      if (state.missionStage === 0) {
        if (d(m.pickup) < 60) {
          state.missionStage = 1;
          state.missionTimer = m.timeLimit;
          setBanner('PACKAGE PICKED UP', `Deliver to the north plaza — ${m.timeLimit}s on the clock.`, 3);
        }
      } else {
        state.missionTimer -= dt;
        if (state.missionTimer <= 0) {
          state.missionStage = 0;
          setBanner('TOO SLOW', 'The buyer walked. Pick the package up again.', 3);
        } else if (d(m.target) < 70) {
          return completeMission();
        }
      }
    } else if (m.id === 'collections') {
      for (let i = 0; i < m.targets.length; i += 1) {
        if (!state.collected[i] && d(m.targets[i]) < 55 && ctrl.interact) {
          state.collected[i] = true;
          p.cash += 200;
          state.stats.cashEarned += 200;
          state.saveDirty = true;
          if (state.collected.every(Boolean)) return completeMission();
          setBanner('COLLECTED', `${state.collected.filter(Boolean).length} of 3 debtors paid up.`, 2.5);
        }
      }
    } else if (m.id === 'getaway') {
      if (d(m.target) < 70 && p.wanted >= 1) return completeMission();
      if (p.wanted <= 0) {
        p.wanted = 3;
        state.lastCrimeAt = state.time;
        setBanner('THEY LOST YOU', 'Heat is back on. Reach the safehouse while wanted.', 3);
      }
    }
    return EVENT_NONE;
  }

  function updatePlayer(dt, ctrl) {
    const p = state.player;
    p.punchCd = Math.max(0, p.punchCd - dt);
    p.fireCd = Math.max(0, p.fireCd - dt);
    state.muzzle = Math.max(0, state.muzzle - dt);

    if (p.car) {
      const car = p.car;
      const def = CAR_TYPES[car.type];
      // Throttle: up = accelerate, down = brake / reverse.
      if (ctrl.throttle < 0) car.speed += def.accel * dt;
      else if (ctrl.throttle > 0) car.speed -= def.accel * 1.4 * dt;
      else car.speed -= car.speed * 0.9 * dt;
      car.speed = clamp(car.speed, -150, def.maxSpeed);
      const steerAuthority = clamp(Math.abs(car.speed) / 160, 0, 1) * (car.speed >= 0 ? 1 : -1);
      car.angle += ctrl.steer * 2.5 * dt * steerAuthority;
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const res = resolveBuildings(nx, ny, 20, state.buildings);
      if (res.hit && Math.abs(car.speed) > 240) {
        car.speed *= 0.35;
        state.crashFlash = state.time;
      }
      car.x = clamp(res.x, 30, WORLD.width - 30);
      car.y = clamp(res.y, 30, Math.min(WORLD.height - 30, WATER_Y - 24));
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      if (ctrl.enter) {
        // Step out beside the car.
        const side = car.angle + Math.PI / 2;
        const px = car.x + Math.cos(side) * 34;
        const py = car.y + Math.sin(side) * 34;
        const settled = resolveBuildings(px, py, PLAYER.radius, state.buildings);
        p.x = clamp(settled.x, 20, WORLD.width - 20);
        p.y = clamp(settled.y, 20, WATER_Y - PLAYER.radius - 2);
        p.angle = car.angle;
        car.parked = true;
        car.speed = 0;
        car.targetSpeed = 0;
        p.car = null;
      }
      return;
    }

    // On foot.
    let mx = ctrl.moveX;
    let my = ctrl.moveY;
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len;
      my /= len;
      p.x += mx * PLAYER.walkSpeed * dt;
      p.y += my * PLAYER.walkSpeed * dt;
      p.moving = true;
      p.angle = Math.atan2(my, mx);
    } else {
      p.moving = false;
    }
    const res = resolveBuildings(p.x, p.y, PLAYER.radius, state.buildings);
    p.x = clamp(res.x, 20, WORLD.width - 20);
    p.y = clamp(res.y, 20, WATER_Y - PLAYER.radius - 2);
    // Aim follows the mouse when the player is on foot.
    if (ctrl.aimSeen) p.aimAngle = Math.atan2(ctrl.aimY - p.y, ctrl.aimX - p.x);
    else if (p.moving) p.aimAngle = p.angle;

    if (ctrl.punch && p.punchCd <= 0) {
      p.punchCd = PLAYER.punchCooldown;
      let hitAny = false;
      for (const ped of state.peds) {
        if (ped.state === 'down') continue;
        if (dist(p.x, p.y, ped.x, ped.y) > PLAYER.punchRange) continue;
        if (Math.abs(angleDiff(p.aimAngle, angleTo(p.x, p.y, ped.x, ped.y))) > PLAYER.punchArc) continue;
        ped.state = 'down';
        ped.downTimer = 6;
        hitAny = true;
      }
      if (hitAny) addWanted(1);
    }

    if (ctrl.fire && p.fireCd <= 0) {
      p.fireCd = PLAYER.fireCooldown;
      state.muzzle = 0.06;
      state.bullets.push({
        x: p.x + Math.cos(p.aimAngle) * 20,
        y: p.y + Math.sin(p.aimAngle) * 20,
        vx: Math.cos(p.aimAngle) * PLAYER.bulletSpeed,
        vy: Math.sin(p.aimAngle) * PLAYER.bulletSpeed,
        life: PLAYER.bulletRange / PLAYER.bulletSpeed,
      });
    }

    if (ctrl.enter) {
      let best = null;
      let bestD = 78;
      for (const car of state.cars) {
        if (car.disabled) continue;
        const dd = dist(p.x, p.y, car.x, car.y);
        if (dd < bestD) {
          bestD = dd;
          best = car;
        }
      }
      if (best) {
        if (best.driver) {
          // Yank the driver out: they flee, and stealing the car is a crime.
          spawnPed(best.x + 30, best.y + 30);
          const fled = state.peds[state.peds.length - 1];
          fled.state = 'flee';
          fled.timer = 3;
          fled.tx = fled.x + 400;
          fled.ty = fled.y;
          best.driver = null;
          addWanted(1);
          state.stats.carsStolen += 1;
        }
        best.parked = false;
        best.speed = 0;
        best.targetSpeed = 0;
        p.car = best;
      }
    }
  }

  function updateBullets(dt) {
    const p = state.player;
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.x < 0 || b.x > WORLD.width || b.y < 0 || b.y > WORLD.height;
      if (!dead) {
        for (const building of state.buildings) {
          if (b.x > building.x && b.x < building.x + building.w && b.y > building.y && b.y < building.y + building.h) {
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const ped of state.peds) {
          if (ped.state === 'down') continue;
          if (dist(b.x, b.y, ped.x, ped.y) < PED.radius + 4) {
            ped.state = 'down';
            ped.downTimer = 9;
            addWanted(2);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const car of state.cars) {
          if (car.type !== 'police' || car.disabled) continue;
          if (dist(b.x, b.y, car.x, car.y) < 26) {
            car.hits += 1;
            if (car.hits >= POLICE_CAR_HITS) {
              car.disabled = true;
              car.disableTimer = 12;
              car.speed = 0;
              addWanted(1);
            }
            dead = true;
            break;
          }
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }
  }

  function updateTraffic(dt) {
    const p = state.player;
    for (const car of state.cars) {
      if (car.type === 'police' || car.parked || car.disabled) continue;
      if (car === p.car) continue;
      // Slow for the player or a car ahead on the same lane.
      let target = car.targetSpeed;
      const aheadX = car.x + Math.cos(car.angle) * 70;
      const aheadY = car.y + Math.sin(car.angle) * 70;
      if (dist(aheadX, aheadY, p.x, p.y) < 46 && !p.car) target = 0;
      for (const other of state.cars) {
        if (other === car || other.parked) continue;
        if (Math.abs(angleDiff(car.angle, angleTo(car.x, car.y, other.x, other.y))) < 0.5
          && dist(car.x, car.y, other.x, other.y) < 80) {
          target = Math.min(target, other.speed);
        }
      }
      car.speed += clamp(target - car.speed, -260 * dt, 200 * dt);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const res = resolveBuildings(nx, ny, 20, state.buildings);
      car.x = clamp(res.x, 30, WORLD.width - 30);
      car.y = clamp(res.y, 30, WATER_Y - 24);
      // At an intersection, sometimes turn onto the crossing street.
      const onXRoad = ROADS_X.some((rx) => Math.abs(car.x - rx) < 8);
      const onYRoad = ROADS_Y.some((ry) => Math.abs(car.y - ry) < 8);
      if (onXRoad && onYRoad && rand() < 0.012) {
        if (car.axis === 'h') {
          car.axis = 'v';
          car.angle = rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
          car.x = ROADS_X.reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a));
        } else {
          car.axis = 'h';
          car.angle = rand() < 0.5 ? 0 : Math.PI;
          car.y = ROADS_Y.reduce((a, b) => (Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a));
        }
      }
      // Turn around at the edge of the city.
      if ((car.axis === 'h' && (car.x < 60 || car.x > WORLD.width - 60))
        || (car.axis === 'v' && (car.y < 60 || car.y > WATER_Y - 80))) {
        car.angle += Math.PI;
        car.dir *= -1;
      }
    }
    // Soft car-car separation.
    for (let i = 0; i < state.cars.length; i += 1) {
      for (let j = i + 1; j < state.cars.length; j += 1) {
        const a = state.cars[i];
        const b = state.cars[j];
        const d = dist(a.x, a.y, b.x, b.y);
        if (d > 0.01 && d < 44) {
          const push = (44 - d) / 2;
          const ux = (b.x - a.x) / d;
          const uy = (b.y - a.y) / d;
          const aMoves = !a.parked && a !== p.car;
          const bMoves = !b.parked && b !== p.car;
          if (aMoves) { a.x -= ux * push; a.y -= uy * push; }
          if (bMoves) { b.x += ux * push; b.y += uy * push; }
          if (!aMoves && !bMoves) { /* both parked: leave them */ }
        }
      }
    }
  }

  function updatePolice(dt) {
    const p = state.player;
    const active = state.cars.filter((c) => c.type === 'police');
    if (p.wanted > 0) {
      const want = Math.min(p.wanted, 3);
      const live = active.filter((c) => !c.disabled).length;
      if (live < want && rand() < 0.02) spawnPolice();
    }
    for (const car of active) {
      car.ramCd = Math.max(0, car.ramCd - dt);
      if (car.disabled) {
        car.disableTimer -= dt;
        car.smoke = Math.max(car.smoke, 0.4);
        if (car.disableTimer <= 0) {
          const idx = state.cars.indexOf(car);
          if (idx >= 0) state.cars.splice(idx, 1);
        }
        continue;
      }
      if (p.wanted <= 0) {
        // Heat's off: drive to the nearest edge of the city and leave.
        const edgeX = car.x < WORLD.width / 2 ? 40 : WORLD.width - 40;
        const edgeY = car.y < 1200 ? 40 : WATER_Y - 60;
        const away = Math.abs(edgeX - car.x) > Math.abs(edgeY - car.y)
          ? angleTo(car.x, car.y, edgeX, car.y)
          : angleTo(car.x, car.y, car.x, edgeY);
        car.angle += clamp(angleDiff(car.angle, away), -2.6 * dt, 2.6 * dt);
        car.speed += clamp(CAR_TYPES.police.maxSpeed - car.speed, -300 * dt, 300 * dt);
        const nx = car.x + Math.cos(car.angle) * car.speed * dt;
        const ny = car.y + Math.sin(car.angle) * car.speed * dt;
        const res = resolveBuildings(nx, ny, 20, state.buildings);
        car.x = clamp(res.x, 30, WORLD.width - 30);
        car.y = clamp(res.y, 30, WATER_Y - 24);
        if (dist(car.x, car.y, p.x, p.y) > 900) {
          const idx = state.cars.indexOf(car);
          if (idx >= 0) state.cars.splice(idx, 1);
        }
        continue;
      }
      // Chase the player.
      const want = angleTo(car.x, car.y, p.x, p.y);
      car.angle += clamp(angleDiff(car.angle, want), -2.6 * dt, 2.6 * dt);
      car.speed += clamp(CAR_TYPES.police.maxSpeed - car.speed, -420 * dt, 420 * dt);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const res = resolveBuildings(nx, ny, 20, state.buildings);
      if (res.hit) car.speed *= 0.5;
      car.x = clamp(res.x, 30, WORLD.width - 30);
      car.y = clamp(res.y, 30, WATER_Y - 24);
      if (dist(car.x, car.y, p.x, p.y) < 44 && car.ramCd <= 0) {
        car.ramCd = POLICE_RAM_COOLDOWN;
        p.health -= POLICE_RAM_DAMAGE;
        state.crashFlash = state.time;
        if (p.car) p.car.speed *= 0.55;
      }
    }
  }

  function updatePeds(dt) {
    const p = state.player;
    for (const ped of state.peds) {
      if (ped.state === 'down') {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          ped.state = 'flee';
          ped.timer = 2.5;
          ped.tx = ped.x + (ped.x < WORLD.width / 2 ? 500 : -500);
          ped.ty = ped.y;
        }
        continue;
      }
      // Threats: gunfire, a speeding car, or a punch nearby.
      let threat = null;
      if (state.muzzle > 0) threat = { x: p.x, y: p.y, range: 380 };
      if (!threat) {
        for (const car of state.cars) {
          if (car.parked || Math.abs(car.speed) < 180) continue;
          if (dist(car.x, car.y, ped.x, ped.y) < 110) {
            threat = { x: car.x, y: car.y, range: 110 };
            break;
          }
        }
      }
      if (threat && ped.state !== 'flee') {
        ped.state = 'flee';
        ped.timer = 2.5;
        const away = angleTo(threat.x, threat.y, ped.x, ped.y);
        ped.tx = ped.x + Math.cos(away) * 420;
        ped.ty = ped.y + Math.sin(away) * 420;
      }
      if (ped.state === 'flee') {
        ped.timer -= dt;
        if (ped.timer <= 0) {
          ped.state = 'walk';
          const spot = sidewalkPoint();
          ped.tx = spot.x;
          ped.ty = spot.y;
        }
      }
      const speed = ped.state === 'flee' ? PED.fleeSpeed : PED.walkSpeed;
      const d = dist(ped.x, ped.y, ped.tx, ped.ty);
      if (d < 12) {
        if (ped.state === 'walk') {
          const spot = sidewalkPoint();
          ped.tx = spot.x;
          ped.ty = spot.y;
        } else {
          ped.state = 'walk';
        }
        continue;
      }
      const a = angleTo(ped.x, ped.y, ped.tx, ped.ty);
      ped.angle = a;
      ped.x += Math.cos(a) * speed * dt;
      ped.y += Math.sin(a) * speed * dt;
      const res = resolveBuildings(ped.x, ped.y, PED.radius, state.buildings);
      ped.x = clamp(res.x, 16, WORLD.width - 16);
      ped.y = clamp(res.y, 16, WATER_Y - PED.radius - 2);
    }
    // Keep the streets populated.
    if (state.peds.length < PED.count && rand() < 0.01) spawnPed();
  }

  function updateWanted(dt) {
    const p = state.player;
    if (p.wanted <= 0) return;
    const nearestPolice = state.cars.reduce((best, car) => {
      if (car.type !== 'police' || car.disabled) return best;
      return Math.min(best, dist(car.x, car.y, p.x, p.y));
    }, Infinity);
    if (nearestPolice > 600 && state.time - state.lastCrimeAt > WANTED_CALM_SECONDS) {
      state.wantedDecay += dt;
      if (state.wantedDecay >= WANTED_DECAY_SECONDS) {
        p.wanted -= 1;
        state.wantedDecay = 0;
        state.saveDirty = true;
      }
    } else {
      state.wantedDecay = 0;
    }
  }

  function reset() {
    state.time = 0;
    state.buildings = [];
    state.trees = [];
    state.cars = [];
    state.peds = [];
    state.bullets = [];
    state.missionIndex = 0;
    state.missionStage = 0;
    state.missionTimer = 0;
    state.collected = [false, false, false];
    state.storyDone = false;
    state.banner = null;
    state.bannerUntil = 0;
    state.wantedCalm = 0;
    state.wantedDecay = 0;
    state.lastCrimeAt = -100;
    state.stats = { carsStolen: 0, missionsDone: 0, cashEarned: 0 };
    state.saveDirty = false;
    state.muzzle = 0;
    state.crashFlash = -10;
    buildCity();
    state.player = {
      x: 1200, y: 1100, angle: -Math.PI / 2, aimAngle: -Math.PI / 2,
      health: PLAYER.health, cash: 0, wanted: 0, car: null,
      punchCd: 0, fireCd: 0, moving: false,
    };
    state.camera = { x: 1200, y: 1100 };
    spawnTraffic();
    for (let i = 0; i < PED.count; i += 1) spawnPed();
  }

  reset();

  return {
    state,
    reset,
    missionTarget,
    addWanted,
    setBanner,
    /** Advance one fixed step. `ctrl` is the frame's control object (see main.js). */
    step(dt, ctrl) {
      state.time += dt;
      let events = EVENT_NONE;
      updatePlayer(dt, ctrl);
      updateBullets(dt);
      updateTraffic(dt);
      updatePolice(dt);
      updatePeds(dt);
      updateWanted(dt);
      events |= updateMissions(dt, ctrl);
      if (state.player.health <= 0) events |= EVENT_WASTED;
      // Camera follows the player, clamped inside the city.
      state.camera.x = clamp(state.player.x, 640, WORLD.width - 640);
      state.camera.y = clamp(state.player.y, 360, Math.min(WORLD.height - 360, WATER_Y - 200));
      if (state.banner && state.time > state.bannerUntil) state.banner = null;
      return events;
    },
  };
}
