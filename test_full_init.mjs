import fs from 'node:fs';
import vm from 'node:vm';

console.log('--- SIMULATING MAIN.JS STARTLEVELWITHLOADING ---');

// Mock HTML and browser globals
const elements = new Map();
function getEl(id) {
  if (!elements.has(id)) {
    elements.set(id, {
      id,
      style: {},
      classList: {
        add: () => {},
        remove: () => {},
        toggle: () => {},
        contains: () => false
      },
      setAttribute: () => {},
      removeAttribute: () => {},
      addEventListener: () => {},
      textContent: '',
      hidden: false,
      append: () => {},
      replaceChildren: () => {},
      getContext: () => ({
        canvas: { width: 512, height: 112 },
        clearRect() {}, fillRect() {}, strokeRect() {}, fillText() {},
        createLinearGradient: () => ({ addColorStop() {} }),
        save() {}, restore() {}, beginPath() {}, arc() {}, clip() {}, rotate() {}
      })
    });
  }
  return elements.get(id);
}

class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  clone() { return new Vector3(this.x, this.y, this.z); }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  setScalar(s) { this.x = s; this.y = s; this.z = s; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  setY(y) { this.y = y; return this; }
  length() { return Math.hypot(this.x, this.y, this.z); }
  lengthSq() { return this.x * this.x + this.y * this.y + this.z * this.z; }
  normalize() {
    const len = this.length();
    if (len > 0.0001) { this.x /= len; this.y /= len; this.z /= len; }
    return this;
  }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  lerp(v, alpha) {
    this.x += (v.x - this.x) * alpha;
    this.y += (v.y - this.y) * alpha;
    this.z += (v.z - this.z) * alpha;
    return this;
  }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
}

const rawThree = {
  Vector3,
  MathUtils: {
    clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
    lerp: (a, b, t) => a + (b - a) * t
  },
  Color: class { constructor(c) { this.c = c; } },
  Group: class {
    constructor() {
      this.position = new Vector3();
      this.rotation = new Vector3();
      this.scale = new Vector3(1, 1, 1);
      this.children = [];
      this.userData = {};
    }
    add(child) { this.children.push(child); }
    remove(child) {
      const idx = this.children.indexOf(child);
      if (idx !== -1) this.children.splice(idx, 1);
    }
    traverse(fn) {
      fn(this);
      for (const c of this.children) c.traverse ? c.traverse(fn) : fn(c);
    }
  },
  Mesh: class {
    constructor(geo, mat) {
      this.geometry = geo || { dispose() {} };
      this.material = mat || { dispose() {} };
      this.position = new Vector3();
      this.rotation = new Vector3();
      this.scale = new Vector3(1, 1, 1);
      this.children = [];
      this.userData = {};
    }
    add(child) { this.children.push(child); }
    remove(child) {
      const idx = this.children.indexOf(child);
      if (idx !== -1) this.children.splice(idx, 1);
    }
    traverse(fn) { fn(this); }
    getWorldPosition(target) { return target.copy(this.position); }
  },
  CanvasTexture: class { constructor() {} },
  Sprite: class {
    constructor(mat) {
      this.material = mat;
      this.position = new Vector3();
      this.scale = new Vector3(1, 1, 1);
    }
  },
  SpriteMaterial: class { constructor(opts) {} },
  AdditiveBlending: 2,
  NormalBlending: 1
};

const THREE = new Proxy(rawThree, {
  get: (target, prop) => {
    if (prop in target) return target[prop];
    return class MockClass {
      constructor() {
        this.attributes = { position: { count: 100 } };
        this.position = new Vector3();
        this.rotation = new Vector3();
        this.scale = new Vector3(1, 1, 1);
        this.children = [];
        this.userData = {};
      }
      dispose() {}
      clone() { return new MockClass(); }
      moveTo() { return this; }
      lineTo() { return this; }
      closePath() { return this; }
      setAttribute() { return this; }
    };
  }
});

const context = vm.createContext({
  THREE,
  console,
  Set,
  Map,
  Math,
  performance: { now: () => Date.now() },
  requestAnimationFrame: (cb) => setTimeout(cb, 10),
  document: {
    getElementById: (id) => getEl(id),
    querySelector: (sel) => getEl(sel),
    querySelectorAll: (sel) => [getEl(sel)],
    createElement: (tag) => getEl(tag),
    body: getEl('body')
  },
  window: {
    innerWidth: 1920,
    innerHeight: 1080,
    devicePixelRatio: 1,
    matchMedia: () => ({ matches: false }),
    setTimeout: (cb, ms) => setTimeout(cb, ms),
    clearTimeout: (id) => clearTimeout(id)
  },
  localStorage: {
    getItem: () => null,
    setItem: () => {}
  }
});

function loadModule(file, exportNames) {
  let code = fs.readFileSync(file, 'utf8')
    .replace(/import\s+[^;]+;/g, '')
    .replace(/export\s+const\s+/g, 'var ')
    .replace(/const\s+STORAGE_KEY/g, 'var STORAGE_KEY_' + Math.random().toString(36).slice(2))
    .replace(/export\s+class\s+/g, 'class ')
    .replace(/export\s+function\s+/g, 'function ')
    .replace(/export\s+default\s+/g, '');
  for (const name of exportNames) {
    code += `\nglobalThis.${name} = ${name};`;
  }
  vm.runInContext(code, context);
}

loadModule('src/ProgressionManager.js', ['ProgressionManager', 'createLevelDefinition', 'CAMPAIGN_LEVELS']);
loadModule('src/WeaponManager.js', ['WeaponManager', 'WEAPONS']);
loadModule('src/Player.js', ['Player']);
loadModule('src/Enemy.js', ['Enemy', 'enemyAttackCoordinator']);
loadModule('src/HUD.js', ['HUD']);
loadModule('src/WorldChunkManager.js', ['WorldChunkManager']);
loadModule('src/World.js', ['World']);
loadModule('src/CameraController.js', ['CameraController']);
loadModule('src/Effects.js', ['Effects']);
loadModule('src/AudioManager.js', ['AudioManager']);
loadModule('src/CombatSystem.js', ['CombatSystem']);

console.log('[PASS] All classes loaded in sandbox');

const testCode = `
const scene = new THREE.Group();
const camera = { position: new THREE.Vector3(), aspect: 16/9, updateProjectionMatrix() {} };
const progression = new ProgressionManager();
const weaponManager = new WeaponManager();
const player = new Player();
const hud = new HUD();
const worldChunks = new WorldChunkManager(scene);
const cameraController = new CameraController(camera, player);
const effects = new Effects(scene);
const audio = new AudioManager();
const combat = new CombatSystem(effects, audio);

let wave = 1;
let enemies = [];
let spawnQueue = [];
let encounterQueues = [];
let encounterWaveIndex = 0;
let arrivalPortals = [];
let energyOrbs = [];
let masterArena = null;

function removeMasterArena() {
  if (!masterArena) return;
  masterArena = null;
}

function removeEnemy(enemy) {
  if (enemy.cleaned) return;
  enemy.cleaned = true;
  if (typeof enemy.dispose === 'function') enemy.dispose();
  else console.warn("WARNING: enemy.dispose is not a function!");
}

function spawnWave(level = 1) {
  enemies = [];
  const def = createLevelDefinition(level);
  encounterQueues = def.waves.map(() => []);
  for (let s = 0; s < def.waves.length; s++) {
    for (const t of def.waves[s]) {
      const e = new Enemy(new THREE.Vector3(0, 0, 10), t);
      encounterQueues[s].push({ enemy: e });
    }
  }
  spawnQueue = encounterQueues[0] || [];
  hud.showLevel(level, def, progression);
  console.log('[PASS] spawnWave completed successfully for level ' + level);
}

function resetGame() {
  enemyAttackCoordinator.reset();
  for (const enemy of enemies) removeEnemy(enemy);
  enemies.length = 0;
  removeMasterArena();
  for (const entry of spawnQueue) {
    if (typeof entry.enemy.dispose === 'function') entry.enemy.dispose();
    else throw new Error("entry.enemy.dispose is not a function!");
  }
  spawnQueue = [];
  encounterQueues = [];
  player.reset(new THREE.Vector3(0, 0, 14));
  cameraController.reset();
  spawnWave(1);
}

// Test first reset
console.log('Testing resetGame(1)...');
spawnWave(1);
console.log('Testing subsequent resetGame(1)...');
resetGame();
console.log('[PASS] Full resetGame completed without exception!');
`;

try {
  vm.runInContext(testCode, context);
} catch (err) {
  console.error('[FAIL] Caught error in testCode:', err);
}
