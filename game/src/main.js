// Solmar City — boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the renderer paints
// what is there. The game moves between four screens: title, play, paused and game over.
//
// ?seed=N fixes the city. ?shot=cover|drive|mission|wanted (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { MISSIONS, SAVE_KEY, STEP, VIEW } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_MISSION, EVENT_STORY, EVENT_WASTED } from './world.js';
import { createAudio } from './audio.js';
import {
  ACTION_CONFIRM, ACTION_ENTER_CAR, ACTION_INTERACT, ACTION_PAUSE, ACTION_PUNCH,
  createInput,
} from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (typeof save.cash !== 'number' || typeof save.missionIndex !== 'number') return null;
    return save;
  } catch {
    return null;
  }
}

function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

let save = readSave();
let best = 0;
try {
  best = Number.parseInt(window.localStorage.getItem(SAVE_KEY + '.best') ?? '0', 10) || 0;
} catch {
  best = 0;
}

function applySave() {
  if (!save) return;
  const p = world.state.player;
  p.cash = save.cash;
  world.state.missionIndex = Math.min(save.missionIndex, MISSIONS.length - 1);
  world.state.missionStage = 0;
  world.state.collected = [false, false, false];
  if (world.state.missionIndex === 3) {
    p.wanted = 3;
    world.state.lastCrimeAt = world.state.time;
  }
}

function persist() {
  const p = world.state.player;
  save = { cash: p.cash, missionIndex: world.state.missionIndex };
  writeSave(save);
  if (p.cash > best) {
    best = p.cash;
    try {
      window.localStorage.setItem(SAVE_KEY + '.best', String(best));
    } catch {
      // Best score is nice to have, not essential.
    }
  }
  world.state.saveDirty = false;
}

function viewFor(screen) {
  const mission = world.state.missionIndex < MISSIONS.length
    ? MISSIONS[world.state.missionIndex]
    : null;
  return {
    screen,
    mission,
    missionTarget: world.missionTarget(),
    missionTimer: world.state.missionTimer,
    save,
    best,
  };
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, viewFor(scene.screen));
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let prevMuzzle = 0;
  let prevPunchCd = 0;
  let prevCrash = -10;
  let prevBanner = null;
  let prevCash = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    applySave();
    prevCash = world.state.player.cash;
    prevBanner = null;
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Mara Quinn has work for you — check the objective, bottom left.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    persist();
    audio.wasted();
    announce(`Wasted. Cash kept $${world.state.player.cash}. Press R to run it back.`);
  }

  function soundWatch() {
    const state = world.state;
    const p = state.player;
    if (prevMuzzle <= 0 && state.muzzle > 0) audio.shoot();
    if (prevPunchCd <= 0 && p.punchCd > 0.2) audio.punch();
    if (prevCrash !== state.crashFlash) audio.crash();
    if (state.banner !== prevBanner && state.banner) {
      if (state.banner.text.includes('COMPLETE')) audio.mission();
      else if (state.banner.text === 'TOO SLOW' || state.banner.text === 'THEY LOST YOU') audio.fail();
      else audio.pickup();
    }
    if (p.cash > prevCash) audio.cash();
    audio.siren(p.wanted);
    audio.engine(p.car ? Math.abs(p.car.speed) / 570 : 0);
    prevMuzzle = state.muzzle;
    prevPunchCd = p.punchCd;
    prevCrash = state.crashFlash;
    prevBanner = state.banner;
    prevCash = p.cash;
  }

  /** Mouse position in world coordinates (through the letterboxed logical view). */
  function mouseWorld() {
    const rect = canvas.getBoundingClientRect();
    const mouse = input.mouse();
    const scale = Math.min(rect.width / VIEW.width, rect.height / VIEW.height);
    const ox = (rect.width - VIEW.width * scale) / 2;
    const oy = (rect.height - VIEW.height * scale) / 2;
    const lx = (mouse.x - ox) / scale;
    const ly = (mouse.y - oy) / scale;
    const cam = world.state.camera;
    return { x: lx + cam.x - VIEW.width / 2, y: ly + cam.y - VIEW.height / 2, seen: mouse.seen };
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    const mouse = input.mouse();

    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame();
    } else if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) startGame();
    } else if (actions & ACTION_PAUSE) {
      screen = screen === SCREEN_PLAY ? SCREEN_PAUSED : SCREEN_PLAY;
      announce(screen === SCREEN_PAUSED ? 'Paused.' : 'Playing.');
    }

    if (screen === SCREEN_PLAY) {
      const mv = input.move();
      const aim = mouseWorld();
      const ctrl = {
        moveX: mv.x,
        moveY: mv.y,
        throttle: input.throttle(),
        steer: input.steer(),
        aimX: aim.x,
        aimY: aim.y,
        aimSeen: aim.seen,
        fire: mouse.down || !!(actions & ACTION_CONFIRM),
        punch: !!(actions & ACTION_PUNCH),
        enter: !!(actions & ACTION_ENTER_CAR),
        interact: !!(actions & ACTION_INTERACT),
        confirm: !!(actions & ACTION_CONFIRM),
        pause: false,
      };
      while (accumulator >= STEP) {
        const events = world.step(STEP, ctrl);
        // One-shot presses count once per frame, not once per fixed step.
        ctrl.fire = false;
        ctrl.punch = false;
        ctrl.enter = false;
        ctrl.interact = false;
        ctrl.confirm = false;
        accumulator -= STEP;
        if (events & EVENT_WASTED) {
          endGame();
          break;
        }
        if (events & EVENT_MISSION) {
          persist();
          if (events & EVENT_STORY) announce('Story complete. Solmar City is yours — free roam.');
        }
      }
      if (world.state.saveDirty) persist();
      soundWatch();
    } else {
      accumulator = 0;
      if (screen === SCREEN_TITLE) {
        // The city idles behind the title.
        while (accumulator >= STEP) {
          world.step(STEP, {
            moveX: 0, moveY: 0, throttle: 0, steer: 0, aimX: 0, aimY: 0, aimSeen: false,
            fire: false, punch: false, enter: false, interact: false, confirm: false, pause: false,
          });
          accumulator -= STEP;
        }
      }
    }
    renderer.draw(world.state, viewFor(screen));
  }

  // R restarts after being wasted, or wipes the save on the title screen.
  window.addEventListener('keydown', (event) => {
    if (event.code !== 'KeyR' || event.repeat) return;
    audio.unlock();
    if (screen === SCREEN_OVER) {
      startGame();
    } else if (screen === SCREEN_TITLE) {
      save = null;
      try {
        window.localStorage.removeItem(SAVE_KEY);
      } catch {
        // Nothing to wipe.
      }
      startGame();
    }
  });

  // Leaving the tab pauses a running game rather than letting the heat close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solmar City. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
