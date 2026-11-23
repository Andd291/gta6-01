// Keyboard and pointer input. Held keys give movement and steering; one-shot presses
// (confirm, pause, enter/exit car, punch) are queued as bit flags and taken once by the
// loop, so a press between two frames is never lost and never counted twice. The mouse
// aims on foot and fires the pistol.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_PUNCH = 8;
export const ACTION_INTERACT = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseSeen = false;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      keys.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyE') {
      if (!event.repeat) actions |= ACTION_ENTER_CAR | ACTION_INTERACT;
    } else if (event.code === 'KeyF') {
      if (!event.repeat) actions |= ACTION_PUNCH;
    } else {
      return;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    keys.clear();
    mouseDown = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseSeen = true;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseSeen = true;
    mouseDown = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });

  const has = (set) => {
    for (const code of set) if (keys.has(code)) return true;
    return false;
  };

  return {
    /** -1..1 for up/down and left/right from WASD/arrows. */
    move() {
      return {
        x: (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0),
        y: (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0),
      };
    },
    /** -1 for up (accelerate), 1 for down (brake/reverse) while driving. */
    throttle() {
      return (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0);
    },
    /** -1 for left, 1 for right steering. */
    steer() {
      return (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
    },
    mouse() {
      return { x: mouseX, y: mouseY, down: mouseDown, seen: mouseSeen };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
