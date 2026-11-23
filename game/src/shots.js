// The screenshot scenes behind ?shot=cover|drive|mission|wanted. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple scripted
// driver, so the frame is what a short game really looks like and the same seed always gives
// the same frame.

import { CAR_TYPES, STEP } from './config.js';
import { SCREEN_PLAY } from './render.js';

const SAMPLE = STEP;

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** A blank control frame; the scene fills in what it needs. */
function idleCtrl() {
  return {
    moveX: 0, moveY: 0, throttle: 0, steer: 0,
    aimX: 0, aimY: 0, aimSeen: false,
    fire: false, punch: false, enter: false, interact: false,
    confirm: false, pause: false,
  };
}

/** Steer a car toward a waypoint at full throttle. */
function driveCtrl(world, tx, ty) {
  const car = world.state.player.car;
  const ctrl = idleCtrl();
  if (!car) return ctrl;
  ctrl.throttle = -1;
  ctrl.steer = clamp(angleDiff(car.angle, Math.atan2(ty - car.y, tx - car.x)) * 2.2, -1, 1);
  return ctrl;
}

/** Walk toward a point. */
function walkCtrl(world, tx, ty) {
  const p = world.state.player;
  const ctrl = idleCtrl();
  const d = Math.hypot(tx - p.x, ty - p.y);
  if (d < 8) return ctrl;
  ctrl.moveX = (tx - p.x) / d;
  ctrl.moveY = (ty - p.y) / d;
  ctrl.aimX = tx;
  ctrl.aimY = ty;
  ctrl.aimSeen = true;
  return ctrl;
}

function putPlayerInCar(world, type, x, y, angle) {
  const state = world.state;
  const car = {
    type, x, y, angle, speed: 0, parked: false, driver: null,
    targetSpeed: 0, axis: 'v', dir: 1, hits: 0, disabled: false,
    disableTimer: 0, ramCd: 0, smoke: 0,
    color: CAR_TYPES[type].color, length: CAR_TYPES[type].length, width: CAR_TYPES[type].width,
  };
  state.cars.push(car);
  state.player.car = car;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  return car;
}

function runSteps(world, seconds, ctrlFn) {
  for (let i = 0; i < seconds / SAMPLE; i += 1) {
    world.step(SAMPLE, ctrlFn(world));
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * cover: Danny in a sports car on the main drag, traffic around, mission 1 ahead.
 * drive: flat out down the coastal road by the beach, speed on the HUD.
 * mission: on foot at the docks, package marker ahead, mission 2 briefing up.
 * wanted: three stars, two police cars closing in, the getaway under way.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  const p = state.player;
  if (name === 'drive') {
    putPlayerInCar(world, 'sport', 700, 2000, 0);
    state.missionIndex = 0;
    runSteps(world, 4.5, (w) => driveCtrl(w, 2800, 2000));
  } else if (name === 'mission') {
    state.missionIndex = 1;
    state.missionStage = 0;
    p.x = 2620;
    p.y = 2000;
    runSteps(world, 3, (w) => walkCtrl(w, 2700, 2000));
  } else if (name === 'wanted') {
    state.missionIndex = 3;
    p.wanted = 3;
    state.lastCrimeAt = state.time;
    putPlayerInCar(world, 'sedan', 1700, 1200, Math.PI);
    // Two police cars closing in from the east and the south.
    const mk = (x, y) => {
      const car = {
        type: 'police', x, y, angle: Math.atan2(p.y - y, p.x - x), speed: 300,
        parked: false, driver: 'police', targetSpeed: CAR_TYPES.police.maxSpeed,
        axis: 'h', dir: 1, hits: 0, disabled: false, disableTimer: 0, ramCd: 0, smoke: 0,
        color: CAR_TYPES.police.color, length: CAR_TYPES.police.length, width: CAR_TYPES.police.width,
      };
      state.cars.push(car);
      return car;
    };
    mk(2050, 1200);
    mk(1700, 1650);
    runSteps(world, 4, (w) => driveCtrl(w, 400, 400));
  } else {
    // cover (and any unknown name): a short burst up the main drag toward the garage —
    // the car is still moving, the marker is in frame, mission 1 is still open.
    putPlayerInCar(world, 'sport', 1200, 1950, -Math.PI / 2);
    state.missionIndex = 0;
    runSteps(world, 0.9, (w) => driveCtrl(w, 1200, 400));
  }
  return { screen: SCREEN_PLAY };
}
