import fs from 'node:fs';
import vm from 'node:vm';

console.log('--- RUNNING MOBILE LANDSCAPE CONTROLS & DYNAMIC ATTACK VALIDATION ---');
let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${message}`);
  } else {
    console.error(`[FAIL] ${message}`);
    process.exitCode = 1;
  }
}

class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
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
  addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
  lerp(v, alpha) {
    this.x += (v.x - this.x) * alpha;
    this.y += (v.y - this.y) * alpha;
    this.z += (v.z - this.z) * alpha;
    return this;
  }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
}

const rawThree = {
  Vector3: Vector3,
  MathUtils: {
    clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
    lerp: (a, b, t) => a + (b - a) * t
  },
  Group: class {
    constructor() {
      this.position = new Vector3();
      this.rotation = new Vector3();
      this.scale = new Vector3(1, 1, 1);
      this.children = [];
      this.userData = {};
    }
    add(c) { this.children.push(c); }
    getWorldPosition(target) { return target.copy(this.position); }
  },
  Mesh: class {
    constructor(g, m) {
      this.position = new Vector3();
      this.rotation = new Vector3();
      this.scale = new Vector3(1, 1, 1);
      this.children = [];
      this.userData = {};
      this.geometry = g || { dispose() {} };
      this.material = m || { dispose() {} };
    }
    add(c) { this.children.push(c); }
    getWorldPosition(target) { return target.copy(this.position); }
  },
  BoxGeometry: class {},
  CylinderGeometry: class {},
  SphereGeometry: class {},
  MeshStandardMaterial: class { constructor() {} },
  MeshBasicMaterial: class { constructor() {} }
};

const THREE = new Proxy(rawThree, {
  get: (target, prop) => {
    if (prop in target) return target[prop];
    return class MockClass {
      constructor() {
        this.attributes = { position: { count: 380 } };
        this.position = new Vector3();
        this.rotation = new Vector3();
        this.scale = new Vector3(1, 1, 1);
        this.children = [];
        this.userData = {};
      }
      dispose() {}
      add(c) { this.children.push(c); }
      remove(c) {}
      updateMatrix() {}
      clone() { return new MockClass(); }
      moveTo() { return this; }
      lineTo() { return this; }
      quadraticCurveTo() { return this; }
      bezierCurveTo() { return this; }
      closePath() { return this; }
      setAttribute() { return this; }
    };
  }
});

const domMock = {
  elements: {},
  getElementById(id) {
    if (!this.elements[id]) {
      this.elements[id] = {
        id,
        style: {},
        classList: new Set(),
        children: [],
        addEventListener() {},
        removeEventListener() {},
        setAttribute() {},
        removeAttribute() {}
      };
      this.elements[id].classList.toggle = function(cls, force) {
        if (force === undefined) {
          if (this.has(cls)) this.delete(cls); else this.add(cls);
        } else if (force) {
          this.add(cls);
        } else {
          this.delete(cls);
        }
      };
      this.elements[id].classList.add = function(cls) { Set.prototype.add.call(this, cls); };
      this.elements[id].classList.remove = function(cls) { Set.prototype.delete.call(this, cls); };
      this.elements[id].classList.contains = function(cls) { return Set.prototype.has.call(this, cls); };
    }
    return this.elements[id];
  },
  querySelector(sel) { return this.getElementById(sel.replace(/^[#.]/, '')); },
  querySelectorAll() { return []; }
};

const context = {
  console,
  THREE: THREE,
  window: {
    matchMedia: () => ({ matches: false }),
    innerWidth: 844,
    innerHeight: 390
  },
  document: {
    documentElement: { style: { setProperty() {} } },
    body: { classList: domMock.getElementById('body').classList },
    getElementById: domMock.getElementById.bind(domMock),
    querySelector: domMock.querySelector.bind(domMock),
    querySelectorAll: domMock.querySelectorAll.bind(domMock)
  },
  performance: { now: () => Date.now() },
  Date
};
vm.createContext(context);

// Load ControlsCustomizer
const controlsCustomizerCode = fs.readFileSync('src/ControlsCustomizer.js', 'utf8')
  .replace(/const STORAGE_KEY/g, 'var STORAGE_KEY')
  .replace(/export const /g, 'globalThis.')
  .replace(/export class ControlsCustomizer/g, 'globalThis.ControlsCustomizer = class ControlsCustomizer');
vm.runInContext(controlsCustomizerCode, context);

// Load CameraController
const cameraControllerCode = fs.readFileSync('src/CameraController.js', 'utf8')
  .replace(/import \* as THREE from 'three';/g, 'var THREE = globalThis.THREE;')
  .replace(/export class CameraController/g, 'globalThis.CameraController = class CameraController');
vm.runInContext(cameraControllerCode, context);

// -----------------------------------------------------------------
// [TEST 1] Mobile Landscape Controls & Presets
// -----------------------------------------------------------------
console.log('\n[TEST 1] Mobile Landscape Layout & Presets...');

const mockStorage = {
  data: {},
  getItem(k) { return this.data[k] || null; },
  setItem(k, v) { this.data[k] = String(v); },
  removeItem(k) { delete this.data[k]; }
};

const mockSettings = {
  values: {
    cameraSensitivity: 1.2,
    controlOpacity: 0.85,
    hudScale: 1.0,
    layoutPreset: 'default'
  }
};

const customizer = new context.ControlsCustomizer(mockSettings, mockStorage);

assert(customizer.layout.preset === 'default', 'Customizer initializes with default layout preset');
assert(customizer.layout.elements.joystickZone.anchor === 'bottom-left', 'Joystick is anchored bottom-left');
assert(customizer.layout.elements.runButton.anchor === 'bottom-left', 'RUN button is anchored bottom-left (beside/above joystick)');
assert(customizer.layout.elements.attackButton.anchor === 'bottom-right', 'Primary Attack button is anchored bottom-right');
assert(customizer.layout.elements.jumpButton.anchor === 'bottom-right', 'Jump button is anchored bottom-right');
assert(customizer.layout.elements.crouchButton.anchor === 'bottom-right', 'Crouch button is anchored bottom-right');
assert(customizer.layout.elements.dashAttackButton.anchor === 'bottom-right', 'Dash Attack button is anchored bottom-right');
assert(customizer.layout.elements.weaponSwitchButton.anchor === 'bottom-right', 'Weapon switch button is anchored bottom-right');

// Test Presets
customizer.applyPreset('compact');
assert(customizer.layout.preset === 'compact', 'Compact preset applied');
assert(customizer.layout.elements.joystickZone.size === 120, 'Compact joystick size scaled to 120px');
assert(customizer.layout.elements.attackButton.size === 76, 'Compact attack button size scaled to 76px');

customizer.applyPreset('left-handed');
assert(customizer.layout.preset === 'left-handed', 'Left-handed preset applied');
assert(customizer.layout.elements.joystickZone.anchor === 'bottom-right', 'Left-handed mode moves joystick to bottom-right');
assert(customizer.layout.elements.runButton.anchor === 'bottom-right', 'Left-handed mode moves RUN button to bottom-right');
assert(customizer.layout.elements.attackButton.anchor === 'bottom-left', 'Left-handed mode moves Attack button to bottom-left');
assert(customizer.layout.elements.jumpButton.anchor === 'bottom-left', 'Left-handed mode moves Jump button to bottom-left');

// Persistence & Sanitization
customizer.saveLayout();
assert(mockStorage.data['void-runner-controls-custom-v2'] !== undefined, 'Layout successfully persisted to localStorage');

const customizer2 = new context.ControlsCustomizer(mockSettings, mockStorage);
assert(customizer2.layout.preset === 'left-handed', 'Custom layout restored accurately from localStorage');

// Corrupted/invalid data fallback
mockStorage.setItem('void-runner-controls-custom-v2', 'invalid-json-content{{{');
const fallbackCustomizer = new context.ControlsCustomizer(mockSettings, mockStorage);
assert(fallbackCustomizer.layout.preset === 'default', 'Corrupted layout safely falls back to default layout');

// -----------------------------------------------------------------
// [TEST 2] One Dynamic Attack Button (Katana & Gun delegation)
// -----------------------------------------------------------------
console.log('\n[TEST 2] Dynamic Attack Button Logic & Weapon Switching...');

const weaponsCode = fs.readFileSync('src/WeaponManager.js', 'utf8')
  .replace(/const STORAGE_KEY/g, 'var STORAGE_KEY')
  .replace(/export const WEAPONS/g, 'globalThis.WEAPONS')
  .replace(/export class WeaponManager/g, 'globalThis.WeaponManager = class WeaponManager');
vm.runInContext(weaponsCode, context);

const katanaWeapon = context.WEAPONS.find(w => w.category === 'melee' || !w.category) || context.WEAPONS[0];
const gunWeapon = context.WEAPONS.find(w => w.category === 'ranged');

assert(katanaWeapon !== undefined, 'Melee Katana weapon exists in armory');
assert(gunWeapon !== undefined, 'Ranged Gun weapon exists in armory');

// Load Player
const playerCode = fs.readFileSync('src/Player.js', 'utf8')
  .replace(/import \* as THREE from 'three';/g, 'var THREE = globalThis.THREE;')
  .replace(/export class Player/g, 'globalThis.Player = class Player');
vm.runInContext(playerCode, context);

// Load CombatSystem
const combatCode = fs.readFileSync('src/CombatSystem.js', 'utf8')
  .replace(/import \* as THREE from 'three';/g, 'var THREE = globalThis.THREE;')
  .replace(/import { enemyAttackCoordinator } from '\.\/Enemy\.js';/g, 'var enemyAttackCoordinator = { hasActiveAttacker: () => false };')
  .replace(/export class CombatSystem/g, 'globalThis.CombatSystem = class CombatSystem')
  .replace(/export const /g, 'globalThis.');
vm.runInContext(combatCode, context);

const player = new context.Player();
const mockEffects = {
  katanaSlashTrail() {},
  sparks() {},
  burst() {},
  shockwave() {},
  muzzleFlash() {},
  bulletTracer() {},
  damageNumber() {}
};
const mockAudio = {
  play() {},
  init() {}
};
const combat = new context.CombatSystem(mockEffects, mockAudio);

// 1. Katana attack
player.equipWeapon(katanaWeapon);
assert(player.weaponConfig.category !== 'ranged', 'Katana is melee category');

const scout = {
  alive: true,
  health: 140,
  maxHealth: 140,
  root: { position: new Vector3(0, 0, 2), rotation: new Vector3(0, 0, 0) },
  knockbackVelocity: new Vector3(),
  spec: { scale: 1 },
  drawHealth() {}
};

const katanaHit = combat.performKatanaCombo(player, [scout], {});
assert(katanaHit === true, 'Katana attack executed successfully');
assert(scout.health === 70, 'Katana deals configured 70 HP base damage (140 - 70 = 70)');

// 2. Gun attack on same primary attack method
player.equipWeapon(gunWeapon);
assert(player.weaponConfig.category === 'ranged', 'Gun is ranged category');
assert(player.gunAmmo === 6, 'Gun initialized with 6 rounds');

const rangedTarget = {
  alive: true,
  health: 100,
  maxHealth: 100,
  root: { position: new Vector3(0, 0, 6), rotation: new Vector3(0, 0, 0) },
  knockbackVelocity: new Vector3(),
  spec: { scale: 1 },
  drawHealth() {}
};

const gunHit = combat.performKatanaCombo(player, [rangedTarget], {});
assert(gunHit === true, 'Dynamic attack button fired gun when gun is equipped');
assert(player.gunAmmo === 5, 'Gun ammunition reduced to 5 rounds');
assert(rangedTarget.health < 100, `Gun bullet dealt damage to target (health is ${rangedTarget.health})`);

// -----------------------------------------------------------------
// [TEST 3] Touch Camera Controller (Orbit Yaw & Pitch)
// -----------------------------------------------------------------
console.log('\n[TEST 3] Touch Camera Rotation & Sensitivity...');

const mockCamera = {
  aspect: 16 / 9,
  fov: 60
};
const camController = new context.CameraController(mockCamera, player);

const initialYaw = camController.lookYaw;
const initialPitch = camController.targetPitch;

// Dragging right on touch zone (positive deltaX) rotates camera yaw
camController.addTouchLook(50, 20, 1.0);
assert(camController.lookYaw < initialYaw, 'Horizontal touch drag orbits camera yaw');
assert(camController.targetPitch < initialPitch, 'Vertical touch drag orbits camera pitch');
assert(camController.lastTouchLookTime > 0, 'Touch look time recorded to prevent unwanted auto-snapping');

// Pitch Clamping check
camController.addTouchLook(0, 5000, 1.0);
assert(camController.targetPitch >= -0.16, 'Target pitch clamped at lower vertical angle limit (-0.16)');

camController.addTouchLook(0, -10000, 1.0);
assert(camController.targetPitch <= 0.65, 'Target pitch clamped at upper vertical angle limit (0.65)');

// -----------------------------------------------------------------
// [TEST 4] Dedicated RUN Button Simultaneous Movement
// -----------------------------------------------------------------
console.log('\n[TEST 4] Dedicated RUN Button Layout...');

assert(context.DEFAULT_LAYOUT.elements.runButton !== undefined, 'Dedicated RUN button present in default layout');
assert(context.DEFAULT_LAYOUT.elements.joystickZone !== undefined, 'Virtual Joystick present in default layout');

// -----------------------------------------------------------------
// [TEST 5] index.html Controls Elements & Safe Areas
// -----------------------------------------------------------------
console.log('\n[TEST 5] index.html DOM Elements & Safe Areas...');

const htmlContent = fs.readFileSync('index.html', 'utf8');

assert(htmlContent.includes('id="cameraTouchZone"'), 'index.html contains #cameraTouchZone');
assert(htmlContent.includes('id="joystickZone"'), 'index.html contains #joystickZone');
assert(htmlContent.includes('id="runButton"'), 'index.html contains dedicated #runButton');
assert(htmlContent.includes('id="actionCluster"'), 'index.html contains #actionCluster');
assert(htmlContent.includes('id="jumpButton"'), 'index.html contains #jumpButton');
assert(htmlContent.includes('id="crouchButton"'), 'index.html contains #crouchButton');
assert(htmlContent.includes('id="dashAttackButton"'), 'index.html contains #dashAttackButton');
assert(htmlContent.includes('id="attackButton"'), 'index.html contains primary #attackButton');
assert(htmlContent.includes('id="attackIconKatana"'), 'index.html contains #attackIconKatana SVG');
assert(htmlContent.includes('id="attackIconGun"'), 'index.html contains #attackIconGun SVG');
assert(htmlContent.includes('id="attackAmmoBadge"'), 'index.html contains #attackAmmoBadge');
assert(htmlContent.includes('id="weaponSwitchButton"'), 'index.html contains #weaponSwitchButton');
assert(htmlContent.includes('id="controlsEditorOverlay"'), 'index.html contains #controlsEditorOverlay live customizer');

console.log(`\n--- ALL TESTS COMPLETED: ${passedTests} / ${totalTests} PASSED ---`);
if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
} else {
  console.log('SUCCESS: Mobile landscape controls system validated 100%!');
  process.exit(0);
}
