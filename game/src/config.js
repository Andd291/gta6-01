// Solmar City — every tuning number and colour in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends on
// the screen size. The world itself is much bigger than one screen: a 3200x2400 coastal city
// the camera scrolls over.

export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const WORLD = { width: 3200, height: 2400 };

/** Roads run on a grid; each entry is the centre line of a street. */
export const ROADS_X = [400, 800, 1200, 1600, 2000, 2400, 2800];
export const ROADS_Y = [400, 800, 1200, 1600, 2000];
export const ROAD_HALF = 38;
export const LANE = 19;

export const BEACH_Y = 2200; // sand starts here
export const WATER_Y = 2300; // water starts here (impassable)

export const PLAYER = {
  radius: 14,
  walkSpeed: 210,
  punchRange: 46,
  punchArc: 1.1,
  punchCooldown: 0.35,
  punchDamage: 34,
  fireCooldown: 0.24,
  bulletSpeed: 920,
  bulletRange: 560,
  health: 100,
};

export const CAR_TYPES = {
  sedan: { length: 64, width: 32, maxSpeed: 430, accel: 320, color: '#c94f43', name: 'Sedan' },
  taxi: { length: 64, width: 32, maxSpeed: 410, accel: 330, color: '#e8b73a', name: 'Taxi' },
  pickup: { length: 70, width: 34, maxSpeed: 390, accel: 300, color: '#4a7fb5', name: 'Pickup' },
  sport: { length: 62, width: 30, maxSpeed: 570, accel: 460, color: '#8e44ad', name: 'Sport' },
  police: { length: 66, width: 32, maxSpeed: 530, accel: 420, color: '#20242c', name: 'Police' },
};

export const PED = { radius: 11, walkSpeed: 70, fleeSpeed: 265, count: 26 };

export const WANTED_MAX = 5;
export const POLICE_RAM_DAMAGE = 12;
export const POLICE_RAM_COOLDOWN = 0.6;
export const POLICE_CAR_HITS = 3;
/** Seconds with no police near and no fresh crime before the heat starts to fall. */
export const WANTED_CALM_SECONDS = 8;
export const WANTED_DECAY_SECONDS = 5;

export const MISSIONS = [
  {
    id: 'wheels',
    title: '1 — Wheels',
    brief: 'Mara needs wheels. Steal any car and bring it to her garage.',
    target: { x: 1200, y: 1600 },
    reward: 250,
  },
  {
    id: 'package',
    title: '2 — The Package',
    brief: 'Pick up the package at the docks, then deliver it to the north plaza. 90 seconds.',
    pickup: { x: 2800, y: 2000 },
    target: { x: 2200, y: 600 },
    timeLimit: 90,
    reward: 400,
  },
  {
    id: 'collections',
    title: '3 — Collections',
    brief: 'Three debtors owe Mara. Walk up to each and press E to collect.',
    targets: [
      { x: 400, y: 600 },
      { x: 1600, y: 1200 },
      { x: 2400, y: 800 },
    ],
    reward: 600,
  },
  {
    id: 'getaway',
    title: '4 — The Getaway',
    brief: 'Three stars on you. Lose the heat and reach the safehouse alive.',
    target: { x: 400, y: 400 },
    reward: 1000,
  },
];

export const SAVE_KEY = 'solmar-city.save.v1';

export const PALETTE = {
  ground: '#8f8a7a',
  road: '#3d4149',
  roadEdge: '#2c2f36',
  sidewalk: '#a49e8d',
  laneDash: '#d8d2c0',
  grass: '#69a862',
  parkPath: '#c9b98a',
  sand: '#e2cd96',
  water: '#3f8fbf',
  waterDeep: '#2f6f9e',
  buildingRoof: ['#b5654d', '#c98a4b', '#7d8aa5', '#a5a06b', '#9668a0', '#5d8a7a', '#b5b0a4'],
  buildingEdge: '#00000033',
  panel: '#171a20ee',
  panelEdge: '#ffffff22',
  text: '#f4f1e8',
  muted: '#b9b4a4',
  gold: '#f2c94c',
  red: '#e5534b',
  blue: '#4fc3f7',
  green: '#7dd069',
  player: '#f2f0e6',
  playerShirt: '#e5534b',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
