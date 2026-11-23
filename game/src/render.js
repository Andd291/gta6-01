// Solmar City — the renderer. One canvas, one logical 1280x720 viewport scaled to the
// window, a camera that scrolls over the city. Flat sun-soaked vector art: warm roads,
// pastel rooftops, a park, a plaza, sand and water along the south shore.

import {
  BEACH_Y, CAR_TYPES, FONT, MISSIONS, PALETTE, PED, PLAYER, ROADS_X, ROADS_Y,
  ROAD_HALF, VIEW, WATER_Y, WORLD,
} from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
  }

  function drawGround(state, view) {
    // Base ground across the visible area.
    ctx.fillStyle = PALETTE.ground;
    ctx.fillRect(view.x, view.y, view.w, view.h);
    // Park block.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(1200 + ROAD_HALF, 800 + ROAD_HALF, 400 - ROAD_HALF * 2, 400 - ROAD_HALF * 2);
    ctx.fillStyle = PALETTE.parkPath;
    ctx.fillRect(1380, 838, 40, 324);
    ctx.fillRect(1238, 980, 324, 40);
    // Plaza block.
    ctx.fillStyle = '#b7ab90';
    ctx.fillRect(2000 + ROAD_HALF, 400 + ROAD_HALF, 400 - ROAD_HALF * 2, 400 - ROAD_HALF * 2);
    ctx.fillStyle = PALETTE.water;
    ctx.beginPath();
    ctx.arc(2200, 600, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d8cfae';
    ctx.beginPath();
    ctx.arc(2200, 600, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.water;
    ctx.beginPath();
    ctx.arc(2200, 600, 46, 0, Math.PI * 2);
    ctx.fill();
    // Beach and water along the south shore.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(view.x, BEACH_Y, view.w, WATER_Y - BEACH_Y);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(view.x, WATER_Y, view.w, WORLD.height - WATER_Y);
    ctx.fillStyle = PALETTE.waterDeep;
    for (let x = Math.floor(view.x / 90) * 90; x < view.x + view.w; x += 90) {
      ctx.fillRect(x, WATER_Y + 26 + ((x / 90) % 3) * 22, 46, 5);
    }
    // Sidewalk edging, then the roads themselves.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_HALF - 10, 0, (ROAD_HALF + 10) * 2, WATER_Y);
    for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_HALF - 10, WORLD.width, (ROAD_HALF + 10) * 2);
    ctx.fillStyle = PALETTE.road;
    for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_HALF, 0, ROAD_HALF * 2, WATER_Y);
    for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_HALF, WORLD.width, ROAD_HALF * 2);
    // Centre dashes.
    ctx.fillStyle = PALETTE.laneDash;
    for (const rx of ROADS_X) {
      if (rx < view.x - 20 || rx > view.x + view.w + 20) continue;
      for (let y = Math.floor(view.y / 64) * 64; y < view.y + view.h; y += 64) {
        ctx.fillRect(rx - 3, y, 6, 34);
      }
    }
    for (const ry of ROADS_Y) {
      if (ry < view.y - 20 || ry > view.y + view.h + 20) continue;
      for (let x = Math.floor(view.x / 64) * 64; x < view.x + view.w; x += 64) {
        ctx.fillRect(x, ry - 3, 34, 6);
      }
    }
    // Buildings (culled to the view).
    for (const b of state.buildings) {
      if (b.x > view.x + view.w || b.x + b.w < view.x || b.y > view.y + view.h || b.y + b.h < view.y) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      rr(ctx, b.x + 6, b.y + 8, b.w, b.h, 6);
      ctx.fill();
      ctx.fillStyle = b.color;
      rr(ctx, b.x, b.y, b.w, b.h, 6);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      rr(ctx, b.x + 10, b.y + 10, b.w - 20, 12, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      const seed = b.detail;
      rr(ctx, b.x + 14 + seed * (b.w - 60), b.y + b.h - 30, 26, 16, 3);
      ctx.fill();
      rr(ctx, b.x + b.w - 46, b.y + 16, 22, 22, 3);
      ctx.fill();
    }
    // Trees.
    for (const t of state.trees) {
      if (t.x < view.x - 40 || t.x > view.x + view.w + 40 || t.y < view.y - 40 || t.y > view.y + view.h + 40) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.arc(t.x + 4, t.y + 5, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4d8a4a';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#69a862';
      ctx.beginPath();
      ctx.arc(t.x - 4, t.y - 4, t.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCarShape(car, time) {
    const def = CAR_TYPES[car.type];
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    rr(ctx, -def.length / 2 + 3, -def.width / 2 + 4, def.length, def.width, 9);
    ctx.fill();
    ctx.fillStyle = car.color;
    rr(ctx, -def.length / 2, -def.width / 2, def.length, def.width, 9);
    ctx.fill();
    if (car.type === 'police') {
      ctx.fillStyle = '#e8e4da';
      rr(ctx, -6, -def.width / 2, 12, def.width, 4);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(20,24,32,0.85)';
    rr(ctx, -def.length / 2 + 12, -def.width / 2 + 5, 16, def.width - 10, 4);
    ctx.fill();
    rr(ctx, def.length / 2 - 26, -def.width / 2 + 5, 12, def.width - 10, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(def.length / 2 - 3, -def.width / 2 + 5, 3, 6);
    ctx.fillRect(def.length / 2 - 3, def.width / 2 - 11, 3, 6);
    ctx.fillStyle = '#ff5a4e';
    ctx.fillRect(-def.length / 2, -def.width / 2 + 5, 3, 6);
    ctx.fillRect(-def.length / 2, def.width / 2 - 11, 3, 6);
    if (car.type === 'taxi') {
      ctx.fillStyle = '#20242c';
      ctx.font = 'bold 9px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 3);
    }
    if (car.type === 'police') {
      const flash = Math.floor(time * 6) % 2 === 0;
      ctx.fillStyle = flash ? '#ff3b30' : '#2f7bff';
      rr(ctx, -8, -def.width / 2 - 3, 8, 6, 2);
      ctx.fill();
      ctx.fillStyle = flash ? '#2f7bff' : '#ff3b30';
      rr(ctx, 0, -def.width / 2 - 3, 8, 6, 2);
      ctx.fill();
    }
    ctx.restore();
    if (car.disabled) {
      ctx.fillStyle = 'rgba(120,120,120,0.55)';
      ctx.beginPath();
      ctx.arc(car.x - 10, car.y - 8, 12 + Math.sin(time * 5) * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(car.x + 6, car.y - 14, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPedShape(ped, time) {
    if (ped.state === 'down') {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 14, 7, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 12, 6, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8b98a';
      ctx.beginPath();
      ctx.arc(ped.x + Math.cos(ped.angle) * 13, ped.y + Math.sin(ped.angle) * 13, 5, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const bob = ped.state === 'flee' ? Math.sin(time * 16) * 2 : Math.sin(time * 6) * 1;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(ped.x + 2, ped.y + 3, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y + bob * 0.4, PED.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4 + bob * 0.4, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayerShape(state, time) {
    const p = state.player;
    if (p.car) {
      drawCarShape(p.car, time);
      // A thin gold outline marks the player's car.
      ctx.save();
      ctx.translate(p.car.x, p.car.y);
      ctx.rotate(p.car.angle);
      ctx.strokeStyle = 'rgba(242,201,76,0.9)';
      ctx.lineWidth = 2;
      rr(ctx, -p.car.length / 2 - 3, -p.car.width / 2 - 3, p.car.length + 6, p.car.width + 6, 11);
      ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(p.x + 2, p.y + 3, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.playerShirt;
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.aimAngle) * 4, p.y + Math.sin(p.aimAngle) * 4, 6, 0, Math.PI * 2);
    ctx.fill();
    // Pistol direction.
    ctx.strokeStyle = '#20242c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.aimAngle) * 10, p.y + Math.sin(p.aimAngle) * 10);
    ctx.lineTo(p.x + Math.cos(p.aimAngle) * 22, p.y + Math.sin(p.aimAngle) * 22);
    ctx.stroke();
    if (state.muzzle > 0) {
      ctx.fillStyle = '#ffe27a';
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(p.aimAngle) * 28, p.y + Math.sin(p.aimAngle) * 28, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMarker(state, view, time) {
    const target = view.missionTarget;
    if (!target) return;
    const pulse = 1 + Math.sin(time * 4) * 0.15;
    const p = state.player;
    const d = Math.hypot(target.x - p.x, target.y - p.y);
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.strokeStyle = 'rgba(242,201,76,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -90);
    ctx.lineTo(0, -30);
    ctx.stroke();
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.moveTo(0, -34 * pulse);
    ctx.lineTo(16 * pulse, -14 * pulse);
    ctx.lineTo(0, 6 * pulse);
    ctx.lineTo(-16 * pulse, -14 * pulse);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(d) + 'm', 0, 26);
    ctx.restore();
  }

  function drawMinimap(state, view) {
    const mw = 216;
    const mh = 162;
    const mx = VIEW.width - mw - 16;
    const my = 16;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    ctx.save();
    ctx.fillStyle = 'rgba(18,20,26,0.82)';
    rr(ctx, mx - 6, my - 6, mw + 12, mh + 12, 8);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1;
    rr(ctx, mx - 6, my - 6, mw + 12, mh + 12, 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(mx, my, mw, mh);
    ctx.clip();
    ctx.fillStyle = '#6f6a5c';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(mx, my + WATER_Y * sy, mw, mh - WATER_Y * sy);
    ctx.fillStyle = '#565b66';
    for (const rx of ROADS_X) ctx.fillRect(mx + rx * sx - 2, my, 4, mh);
    for (const ry of ROADS_Y) ctx.fillRect(mx, my + ry * sy, mw, 4);
    ctx.fillStyle = '#69a862';
    ctx.fillRect(mx + 1200 * sx, my + 800 * sy, 400 * sx, 400 * sy);
    for (const b of state.buildings) {
      ctx.fillStyle = 'rgba(30,32,38,0.7)';
      ctx.fillRect(mx + b.x * sx, my + b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
    }
    if (view.missionTarget) {
      const t = view.missionTarget;
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(mx + t.x * sx, my + t.y * sy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#20242c';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    for (const car of state.cars) {
      if (car.type !== 'police') continue;
      ctx.fillStyle = '#ff3b30';
      ctx.beginPath();
      ctx.arc(mx + car.x * sx, my + car.y * sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = state.player;
    ctx.save();
    ctx.translate(mx + p.x * sx, my + p.y * sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  function drawHUD(state, view) {
    const p = state.player;
    // Top-left panel: health, cash, wanted.
    ctx.fillStyle = PALETTE.panel;
    rr(ctx, 16, 16, 250, 86, 10);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    rr(ctx, 16, 16, 250, 86, 10);
    ctx.stroke();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = 'bold 11px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText('DANNY COLE', 30, 36);
    ctx.fillStyle = '#3a3f4a';
    rr(ctx, 30, 46, 150, 12, 6);
    ctx.fill();
    ctx.fillStyle = p.health > 30 ? PALETTE.green : PALETTE.red;
    rr(ctx, 30, 46, 150 * clamp(p.health / 100, 0, 1), 12, 6);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 15px ' + FONT;
    ctx.fillText('$' + p.cash.toLocaleString('en-US'), 190, 58);
    ctx.font = '20px ' + FONT;
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < p.wanted ? PALETTE.gold : 'rgba(255,255,255,0.18)';
      ctx.fillText('★', 30 + i * 24, 92);
    }
    // Objective panel, bottom-left.
    if (view.mission && !state.storyDone) {
      const lines = view.mission.brief.split('. ');
      ctx.fillStyle = PALETTE.panel;
      const w = 430;
      const h = 34 + lines.length * 18;
      rr(ctx, 16, VIEW.height - h - 16, w, h, 10);
      ctx.fill();
      ctx.strokeStyle = PALETTE.panelEdge;
      rr(ctx, 16, VIEW.height - h - 16, w, h, 10);
      ctx.stroke();
      ctx.fillStyle = PALETTE.gold;
      ctx.font = 'bold 13px ' + FONT;
      ctx.fillText(view.mission.title.toUpperCase(), 30, VIEW.height - h + 4);
      ctx.fillStyle = PALETTE.text;
      ctx.font = '13px ' + FONT;
      lines.forEach((line, i) => {
        ctx.fillText(line + (i < lines.length - 1 ? '.' : ''), 30, VIEW.height - h + 24 + i * 18);
      });
      if (view.missionTimer > 0) {
        ctx.fillStyle = view.missionTimer < 15 ? PALETTE.red : PALETTE.text;
        ctx.font = 'bold 16px ' + FONT;
        ctx.textAlign = 'right';
        ctx.fillText(Math.ceil(view.missionTimer) + 's', 16 + w - 14, VIEW.height - h + 4);
        ctx.textAlign = 'left';
      }
    } else if (state.storyDone) {
      ctx.fillStyle = PALETTE.panel;
      rr(ctx, 16, VIEW.height - 56, 330, 40, 10);
      ctx.fill();
      ctx.fillStyle = PALETTE.gold;
      ctx.font = 'bold 13px ' + FONT;
      ctx.fillText('STORY COMPLETE — FREE ROAM', 30, VIEW.height - 30);
    }
    // Speed, bottom-right, while driving.
    if (p.car) {
      const mph = Math.round(Math.abs(p.car.speed) * 0.12);
      ctx.fillStyle = PALETTE.panel;
      rr(ctx, VIEW.width - 150, VIEW.height - 66, 134, 50, 10);
      ctx.fill();
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 26px ' + FONT;
      ctx.textAlign = 'right';
      ctx.fillText(mph + '', VIEW.width - 30, VIEW.height - 30);
      ctx.font = '11px ' + FONT;
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText('MPH  •  ' + CAR_TYPES[p.car.type].name.toUpperCase(), VIEW.width - 30, VIEW.height - 52);
      ctx.textAlign = 'left';
    }
    // Controls hint, bottom-right when on foot.
    if (!p.car) {
      ctx.fillStyle = 'rgba(18,20,26,0.6)';
      ctx.font = '12px ' + FONT;
      ctx.textAlign = 'right';
      ctx.fillText('WASD move  •  E enter car  •  F punch  •  Click / Space shoot  •  P pause', VIEW.width - 16, VIEW.height - 16);
      ctx.textAlign = 'left';
    }
    // Off-screen mission arrow.
    if (view.missionTarget) {
      const t = view.missionTarget;
      const cam = state.camera;
      const sx = t.x - (cam.x - VIEW.width / 2);
      const sy = t.y - (cam.y - VIEW.height / 2);
      if (sx < 40 || sx > VIEW.width - 40 || sy < 40 || sy > VIEW.height - 40) {
        const cx = clamp(sx, 60, VIEW.width - 60);
        const cy = clamp(sy, 130, VIEW.height - 90);
        const a = Math.atan2(sy - cy, sx - cx);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(a);
        ctx.fillStyle = PALETTE.gold;
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(-10, -11);
        ctx.lineTo(-10, 11);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    // Mission banner.
    if (state.banner) {
      ctx.fillStyle = 'rgba(18,20,26,0.85)';
      const bw = 560;
      rr(ctx, (VIEW.width - bw) / 2, 108, bw, 62, 10);
      ctx.fill();
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 1.5;
      rr(ctx, (VIEW.width - bw) / 2, 108, bw, 62, 10);
      ctx.stroke();
      ctx.fillStyle = PALETTE.gold;
      ctx.font = 'bold 18px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(state.banner.text, VIEW.width / 2, 134);
      ctx.fillStyle = PALETTE.text;
      ctx.font = '13px ' + FONT;
      ctx.fillText(state.banner.sub, VIEW.width / 2, 156);
      ctx.textAlign = 'left';
    }
    drawMinimap(state, view);
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(12,14,19,0.72)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = accent || PALETTE.gold;
    ctx.font = 'bold 64px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText(title, VIEW.width / 2, 210);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '17px ' + FONT;
    lines.forEach((line, i) => {
      ctx.fillText(line, VIEW.width / 2, 258 + i * 28);
    });
    ctx.textAlign = 'left';
  }

  function drawTitle(state, view) {
    // A live city behind the title: the world keeps idling.
    drawWorld(state, view, false);
    ctx.fillStyle = 'rgba(12,14,19,0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 84px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('SOLMAR CITY', VIEW.width / 2, 190);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '20px ' + FONT;
    ctx.fillText('An open-world crime story — steal cars, dodge the heat, work for Mara Quinn.', VIEW.width / 2, 228);
    ctx.font = '15px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    const lines = [
      'WASD / arrows — walk and drive    •    E — enter / exit car    •    F — punch',
      'Mouse aim + click / Space — shoot    •    P — pause',
      'Four missions, a wanted system, police chases, and a save that remembers your cash.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, 292 + i * 26));
    if (view.save) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = 'bold 16px ' + FONT;
      ctx.fillText(`Welcome back, Danny — $${view.save.cash} in pocket, mission ${Math.min(view.save.missionIndex + 1, 4)} of 4.`, VIEW.width / 2, 400);
    }
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 22px ' + FONT;
    ctx.fillText('Press ENTER to start' + (view.save ? '  •  R for a new game' : ''), VIEW.width / 2, 448);
    if (view.best > 0) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '14px ' + FONT;
      ctx.fillText('Best haul: $' + view.best.toLocaleString('en-US'), VIEW.width / 2, 482);
    }
    ctx.textAlign = 'left';
  }

  function drawWorld(state, view, withHUD) {
    const cam = state.camera;
    const vx = cam.x - VIEW.width / 2;
    const vy = cam.y - VIEW.height / 2;
    ctx.save();
    ctx.translate(-vx, -vy);
    drawGround(state, { x: vx, y: vy, w: VIEW.width, h: VIEW.height });
    drawMarker(state, view, state.time);
    const cars = [...state.cars].sort((a, b) => a.y - b.y);
    for (const car of cars) {
      if (state.player.car === car) continue;
      drawCarShape(car, state.time);
    }
    for (const ped of state.peds) drawPedShape(ped, state.time);
    for (const b of state.bullets) {
      ctx.strokeStyle = '#ffe27a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    drawPlayerShape(state, state.time);
    ctx.restore();
    if (withHUD) drawHUD(state, view);
  }

  return {
    resize,
    draw(state, view) {
      resize();
      const scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
      const ox = (canvas.width - VIEW.width * scale) / 2;
      const oy = (canvas.height - VIEW.height * scale) / 2;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#101216';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, ox, oy);
      if (view.screen === SCREEN_TITLE) {
        drawTitle(state, view);
      } else if (view.screen === SCREEN_PLAY) {
        drawWorld(state, view, true);
      } else if (view.screen === SCREEN_PAUSED) {
        drawWorld(state, view, true);
        overlay('PAUSED', ['Press P or Enter to keep playing.'], PALETTE.text);
      } else if (view.screen === SCREEN_OVER) {
        drawWorld(state, view, true);
        overlay('WASTED', [
          `The Solmar heat got you, Danny. Cash kept: $${state.player.cash.toLocaleString('en-US')}.`,
          `Missions finished: ${state.stats.missionsDone} of ${MISSIONS.length}.`,
          'Press R to run it back.',
        ], PALETTE.red);
      }
    },
  };
}
