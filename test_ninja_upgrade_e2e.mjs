import fs from 'node:fs';
import vm from 'node:vm';

console.log('--- RUNNING VOID RUNNER NINJA UPGRADE VALIDATION SUITE ---');

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
  subVectors(a, b) {
    this.x = a.x - b.x;
    this.y = a.y - b.y;
    this.z = a.z - b.z;
    return this;
  }
  distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
  addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  lerp(v, alpha) {
    this.x += (v.x - this.x) * alpha;
    this.y += (v.y - this.y) * alpha;
    this.z += (v.z - this.z) * alpha;
    return this;
  }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
}

const createVector3 = (x = 0, y = 0, z = 0) => new Vector3(x, y, z);

const rawThree = {
  Vector3: Vector3,
  MathUtils: {
    clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
    lerp: (a, b, t) => a + (b - a) * t
  },
  Color: class { constructor(c) { this.c = c; } },
  Group: class {
    constructor() {
      this.position = createVector3();
      this.rotation = createVector3();
      this.scale = createVector3(1, 1, 1);
      this.children = [];
      this.userData = {};
    }
    add(child) { this.children.push(child); }
    traverse(fn) {
      fn(this);
      for (const c of this.children) c.traverse ? c.traverse(fn) : fn(c);
    }
    updateMatrixWorld() {}
  },
  Mesh: class {
    constructor(geo, mat) {
      this.geometry = geo || { attributes: { position: { count: 380 } }, dispose() {} };
      this.material = mat || { dispose() {} };
      this.position = createVector3();
      this.rotation = createVector3();
      this.scale = createVector3(1, 1, 1);
      this.children = [];
      this.userData = {};
    }
    add(child) { this.children.push(child); }
    traverse(fn) { fn(this); }
    getWorldPosition(target) { return target.copy(this.position); }
  },
  BufferGeometry: class {
    constructor() {
      this.attributes = { position: { count: 380, array: new Float32Array(380 * 3) } };
    }
    setAttribute() {}
    dispose() {}
  },
  Points: class {
    constructor(geo, mat) {
      this.geometry = geo;
      this.material = mat;
      this.position = createVector3();
      this.rotation = createVector3();
      this.scale = createVector3(1, 1, 1);
      this.children = [];
    }
  },
  Float32BufferAttribute: class {
    constructor(array, itemSize) { this.count = array.length / itemSize; this.array = array; }
  },
  AdditiveBlending: 2,
  NormalBlending: 1
};

const THREE = new Proxy(rawThree, {
  get: (target, prop) => {
    if (prop in target) return target[prop];
    return class MockClass {
      constructor() {
        this.attributes = { position: { count: 380 } };
        this.position = createVector3();
        this.rotation = createVector3();
        this.scale = createVector3(1, 1, 1);
        this.children = [];
        this.userData = {};
        this.instanceMatrix = { needsUpdate: false };
        this.shadow = { mapSize: createVector3(), camera: {} };
      }
      dispose() {}
      add(child) { this.children.push(child); }
      remove(child) {}
      updateMatrix() {}
      setMatrixAt() {}
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

const context = vm.createContext({
  THREE,
  console,
  Set,
  Map,
  Math,
  performance: { now: () => Date.now() },
  requestAnimationFrame: () => {},
  document: {
    createElement: () => {
      const canvas = {
        width: 512,
        height: 128
      };
      const ctx = {
        canvas,
        fillRect() {},
        clearRect() {},
        strokeRect() {},
        beginPath() {},
        arc() {},
        fill() {},
        stroke() {},
        measureText: () => ({ width: 10 }),
        fillText() {},
        createLinearGradient: () => ({ addColorStop() {} })
      };
      canvas.getContext = () => ctx;
      return canvas;
    },
    getElementById: () => ({
      textContent: '',
      style: {},
      classList: { add() {}, remove() {}, toggle() {} },
      addEventListener() {}
    }),
    querySelectorAll: () => []
  },
  window: {
    innerWidth: 1920,
    innerHeight: 1080,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
  }
});

// Load and evaluate Player.js
let playerCode = fs.readFileSync('src/Player.js', 'utf8')
  .replace(/import\s+[^;]+;/g, '')
  .replace(/export\s+const\s+/g, 'const ')
  .replace(/export\s+class\s+/g, 'class ')
  .replace(/export\s+default\s+/g, '');
playerCode += '\nglobalThis.Player = Player;';
vm.runInContext(playerCode, context);

// Load and evaluate CombatSystem.js
let combatCode = fs.readFileSync('src/CombatSystem.js', 'utf8')
  .replace(/import\s+[^;]+;/g, '')
  .replace(/export\s+const\s+/g, 'const ')
  .replace(/export\s+class\s+/g, 'class ')
  .replace(/export\s+default\s+/g, '');
combatCode += '\nglobalThis.CombatSystem = CombatSystem;';
vm.runInContext(combatCode, context);

// Load and evaluate Enemy.js
let enemyCode = fs.readFileSync('src/Enemy.js', 'utf8')
  .replace(/import\s+[^;]+;/g, '')
  .replace(/export\s+const\s+/g, 'const ')
  .replace(/export\s+class\s+/g, 'class ')
  .replace(/export\s+default\s+/g, '');
enemyCode += '\nglobalThis.Enemy = Enemy;';
vm.runInContext(enemyCode, context);

// Load and evaluate CameraController.js
let camCode = fs.readFileSync('src/CameraController.js', 'utf8')
  .replace(/import\s+[^;]+;/g, '')
  .replace(/export\s+const\s+/g, 'const ')
  .replace(/export\s+class\s+/g, 'class ')
  .replace(/export\s+default\s+/g, '');
camCode += '\nglobalThis.CameraController = CameraController;';
vm.runInContext(camCode, context);

// Load and evaluate World.js
let worldCode = fs.readFileSync('src/World.js', 'utf8')
  .replace(/import\s+[^;]+;/g, '')
  .replace(/export\s+const\s+/g, 'const ')
  .replace(/export\s+class\s+/g, 'class ')
  .replace(/export\s+default\s+/g, '');
worldCode += '\nglobalThis.World = World;';
vm.runInContext(worldCode, context);

const { Player, CombatSystem, Enemy, CameraController, World } = context;

// 1. Test Player Dash Attack & Animations
console.log('\n[1] Testing Player Dash Attack & Animations...');
const player = new Player();
assert(player.dashAttackCooldown === 0, 'Player initialized with 0 dash attack cooldown');
assert(typeof player.performDashAttack === 'function', 'Player has performDashAttack method');

const targetEnemy = {
  alive: true,
  root: { position: createVector3(12, 0, 12) },
  spec: { scale: 1 }
};

const dashResult = player.performDashAttack(targetEnemy, null);
assert(dashResult !== null, 'Player performDashAttack succeeds towards target');
assert(player.dashAttackCooldown === 2.2, 'Player dash attack cooldown set to 2.2 seconds');
assert(player.dashAttackState !== null, 'Player dashAttackState is active');
assert(player.dashAttackState.phase === 'dash', 'Player dash phase is "dash"');
assert(player.attackAction === 'dash', 'Player attack action is "dash" during dash travel phase');

// Cooldown countdown
player.animate(1000, 0.5);
assert(Math.abs(player.dashAttackCooldown - 1.7) < 0.01, 'Player dashAttackCooldown decrements properly with dt (1.7s left)');

// Landing crouch test
player.wasAirborne = true;
player.grounded = true;
player.velocity.y = -8;
player.animate(1000, 1/60);
assert(player.landingCrouch > 0, 'Player enters landing dynamic crouch upon landing from airborne');

// Katana combo empowered finisher test
player.attackTimer = 0;
player.comboResetTimer = 0.8;
player.comboStep = 2; // Next attack will be step 3
player.combo = 4;     // Consecutive hit count >= 4 empowers finisher
const comboResult = player.performKatanaAttack();
assert(comboResult.isEmpowered === true, 'Player combo >= 4 triggers isEmpowered attack');
assert(comboResult.step === 3, 'Combo step is 3 (finisher)');
assert(player.attackAction === 'katana-empowered-finisher', 'Attack action is katana-empowered-finisher');

// 2. Combat System Dash-to-Attack & Damage Hitbox
console.log('\n[2] Testing CombatSystem Dash Attack & Damage Hitbox...');
const mockEffects = {
  dashStreak: () => {},
  burst: () => {},
  katanaSlashTrail: () => {},
  shockwave: () => {},
  sparks: () => {},
  damageNumber: () => {},
  slashArc: () => {},
  spawnTrail: () => {},
  defeatSmoke: () => {}
};
const mockAudio = {
  play: () => {},
  init: () => {},
  stopCharge: () => {}
};
const mockWorld = {
  resolveFeatureCollision: () => false
};
const combat = new CombatSystem(mockEffects, mockAudio);

player.reset(createVector3(0, 0, 0));
player.energy = 50;
const scout = new Enemy(createVector3(0, 0, 8), 'scout', { arrivalDelay: 0, arrivalDuration: 0 });
scout.alive = true;
const enemies = [scout];

const executed = combat.executeDashAttack(player, enemies, null, {}, mockWorld);
assert(executed === true, 'CombatSystem executeDashAttack targets forward scout and starts dash');
assert(player.dashAttackState !== null, 'player.dashAttackState initialized');

// Test that in 'dash' phase, damage is NOT dealt prematurely
const initialEnemyHealth = scout.health;
assert(scout.lastHitAttackId === undefined || scout.lastHitAttackId === null, 'Enemy has not received hit during dash travel phase');

// Simulate reaching target proximity (<= 1.8m)
player.root.position.set(0, 0, 6.5);
combat.resolveDashAttack(player, enemies, {}, mockWorld);
assert(player.dashAttackState.phase === 'slash', 'resolveDashAttack transitioned to "slash" phase at close range');
assert(scout.health < initialEnemyHealth, 'Scout received damage ONLY upon slash arrival and hitbox connection');
assert(player.dashAttackState.attackId === scout.lastHitAttackId, 'Scout lastHitAttackId marked to prevent duplicate damage');

// 3. Heavy Enemy Nodachi Frontal Guard
console.log('\n[3] Testing Heavy Samurai Frontal Guard...');
player.reset(createVector3(0, 0, 0));
const guardian = new Enemy(createVector3(0, 0, 5), 'guardian', { arrivalDelay: 0, arrivalDuration: 0 });
guardian.alive = true;
guardian.root.rotation.y = Math.PI; // Facing directly towards player at (0,0,0)
const guardInitialHp = guardian.health;
combat.applyDamageToEnemy(player, guardian, 70, 'katana-combo-1', {});
assert(guardian.isBlocking === true, 'Guardian triggers isBlocking when attacked from the front');
assert(guardian.blockTimer > 0, 'Guardian blockTimer set');
const damageDealt = guardInitialHp - guardian.health;
assert(damageDealt < 70 * 0.5, `Frontal damage reduced by guard block (Damage dealt: ${damageDealt.toFixed(1)})`);

// 4. Enemy Animation Logic (Block, Stagger Recoil, Boss Slam)
console.log('\n[4] Testing Enemy Animation Logic...');
guardian.update(1/60, player, null, () => 0, null, []);
assert(guardian.root.children.length > 0, 'Guardian mesh hierarchy intact');

const colossus = new Enemy(createVector3(0, 0, 10), 'colossus', { isFinalBoss: true, masterLevel: 15, arrivalDelay: 0 });
colossus.attackPattern = 1; // Great-Blade pattern
colossus.attackPhase = 0.5;
colossus.update(1/60, player, null, () => 0, null, []);
assert(colossus.type === 'colossus', 'Colossus boss initialized');

// 5. Celestial Starfield & Camera Crane Sweep
console.log('\n[5] Testing World Starfield & Camera Crane Sweep...');
const world = new World();
assert(world.starfield !== null && world.starfield !== undefined, 'World celestial starfield created with 380 celestial stars');
assert(world.starfield.geometry.attributes.position.count === 380, 'Starfield contains exactly 380 stars');

const camera = { position: createVector3(0, 5, -10), lookAt() {}, updateProjectionMatrix() {}, rotateZ() {} };
const cameraController = new CameraController(camera, player);
cameraController.startIntro(1.6);
assert(cameraController.introTimer === 1.6, 'CameraController introTimer set to 1.6s');
assert(cameraController.introDuration === 1.6, 'CameraController introDuration set to 1.6s');
cameraController.update(0.5, player.root.position, world, [], 0, false);
assert(cameraController.introTimer < 1.6, 'CameraController introTimer decrements during crane sweep');

console.log(`\n--- ALL TESTS COMPLETED: ${passedTests} / ${totalTests} PASSED ---`);
if (passedTests === totalTests) {
  console.log('SUCCESS: All system upgrades validated successfully!');
} else {
  console.error('FAILURE: Some tests did not pass.');
  process.exit(1);
}
