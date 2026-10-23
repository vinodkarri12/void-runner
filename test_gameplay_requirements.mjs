import fs from 'node:fs';
import vm from 'node:vm';

console.log('--- RUNNING VOID RUNNER SPECIFIC REQUIREMENT VALIDATION ---');

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
    remove(child) {}
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
    remove(child) {}
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

// Load modules
let playerCode = fs.readFileSync('src/Player.js', 'utf8')
  .replace(/import\s+[^;]+;/g, '')
  .replace(/export\s+const\s+/g, 'const ')
  .replace(/export\s+class\s+/g, 'class ')
  .replace(/export\s+default\s+/g, '');
playerCode += '\nglobalThis.Player = Player;';
vm.runInContext(playerCode, context);

let enemyCode = fs.readFileSync('src/Enemy.js', 'utf8')
  .replace(/import\s+[^;]+;/g, '')
  .replace(/export\s+const\s+/g, 'const ')
  .replace(/export\s+class\s+/g, 'class ')
  .replace(/export\s+default\s+/g, '');
enemyCode += '\nglobalThis.Enemy = Enemy;\nglobalThis.enemyAttackCoordinator = enemyAttackCoordinator;\nglobalThis.ARCHETYPES = ARCHETYPES;';
vm.runInContext(enemyCode, context);

let combatCode = fs.readFileSync('src/CombatSystem.js', 'utf8')
  .replace(/import\s+[^;]+;/g, '')
  .replace(/export\s+const\s+/g, 'const ')
  .replace(/export\s+class\s+/g, 'class ')
  .replace(/export\s+default\s+/g, '');
combatCode += '\nglobalThis.CombatSystem = CombatSystem;';
vm.runInContext(combatCode, context);

const { Player, Enemy, enemyAttackCoordinator, ARCHETYPES, CombatSystem } = context;

// TEST 1: Enemy disposal & safe cleanup
console.log('\n[TEST 1] Enemy Dispose & Mesh Cleanup');
const enemy1 = new Enemy(createVector3(0, 0, 10), 'scout', { arrivalDelay: 0 });
assert(typeof enemy1.dispose === 'function', 'Enemy instance has dispose() method');
let disposeDidNotThrow = false;
try {
  enemy1.dispose();
  disposeDidNotThrow = true;
} catch (e) {
  console.error(e);
}
assert(disposeDidNotThrow, 'enemy.dispose() executes without errors');

// TEST 2: All enemy archetypes create properly without errors (including ranged jingasa hat)
console.log('\n[TEST 2] Enemy Archetypes Instantiation');
for (const type of ['scout', 'ranged', 'guardian', 'elite', 'colossus']) {
  let created = false;
  try {
    const e = new Enemy(createVector3(0, 0, 5), type, { arrivalDelay: 0, isFinalBoss: type === 'colossus' });
    assert(e.type === type, `Enemy type "${type}" created successfully with correct spec`);
    e.dispose();
  } catch (err) {
    assert(false, `Enemy type "${type}" threw error during creation: ${err.message}`);
  }
}

// TEST 3: Enemy Attack Coordinator Queue & Turn-Taking
console.log('\n[TEST 3] Enemy Attack Coordinator (One-at-a-Time Attack System)');
enemyAttackCoordinator.reset();
const scoutA = new Enemy(createVector3(0, 0, 5), 'scout', { arrivalDelay: 0 });
const scoutB = new Enemy(createVector3(2, 0, 5), 'scout', { arrivalDelay: 0 });
const scoutC = new Enemy(createVector3(-2, 0, 5), 'scout', { arrivalDelay: 0 });

assert(enemyAttackCoordinator.activeAttacker === null, 'Coordinator starts with no active attacker');
assert(enemyAttackCoordinator.canAttack(scoutA) === true, 'First enemy can attack when queue empty');

// Scout A claims attack
enemyAttackCoordinator.claim(scoutA);
assert(enemyAttackCoordinator.activeAttacker === scoutA, 'Scout A successfully claimed active attacker slot');

// Scout B and C request attacks
assert(enemyAttackCoordinator.canAttack(scoutB) === false, 'Scout B cannot attack while Scout A is attacking');
assert(enemyAttackCoordinator.canAttack(scoutC) === false, 'Scout C cannot attack while Scout A is attacking');

scoutB.attackCooldown = 0;
scoutC.attackCooldown = 0;
enemyAttackCoordinator.requestAttack(scoutB);
enemyAttackCoordinator.requestAttack(scoutC);
assert(enemyAttackCoordinator.queue.length === 2, 'Queue holds waiting enemies in orderly FIFO sequence');

// Scout A finishes attack and releases
enemyAttackCoordinator.release(scoutA);
assert(enemyAttackCoordinator.activeAttacker === null, 'Active attacker cleared upon release');
enemyAttackCoordinator.update(0.35); // turn delay elapses
assert(enemyAttackCoordinator.canAttack(scoutB) === true, 'Next enemy in queue (Scout B) is granted attack clearance');
assert(enemyAttackCoordinator.canAttack(scoutC) === false, 'Scout C still waits in queue for turn');

enemyAttackCoordinator.claim(scoutB);
enemyAttackCoordinator.release(scoutB);
enemyAttackCoordinator.update(0.35); // turn delay elapses
assert(enemyAttackCoordinator.canAttack(scoutC) === true, 'Scout C granted attack clearance after Scout B releases');

// TEST 4: Exact Normal Enemy Damage = 30 HP
console.log('\n[TEST 4] Exact Normal Enemy Damage (Exactly 30 HP)');
enemyAttackCoordinator.reset();
const playerInstance = new Player();
playerInstance.reset(createVector3(0, 0, 0));
playerInstance.health = 200;
playerInstance.maxHealth = 200;

const mockCombat = new CombatSystem({
  sparks: () => {},
  damageNumber: () => {},
  burst: () => {},
  shockwave: () => {},
  slashArc: () => {},
  katanaSlashTrail: () => {},
  defeatSmoke: () => {}
}, { play: () => {} });

// Simulate active attacker Scout A dealing hit
scoutA.root.position.set(0, 0, 1.5); // within attack range (2.4)
scoutA.attackPhase = 0.15;           // active strike phase
scoutA.attackHitDone = false;
enemyAttackCoordinator.claim(scoutA);

const feedback = {
  flash: () => {},
  cameraShake: { value: 0 },
  healthBar: { update: () => {} }
};

const hitResolved = mockCombat.resolveEnemyHit(playerInstance, scoutA, 1/60, feedback);
assert(hitResolved === true, 'resolveEnemyHit succeeded for active attacker');
assert(playerInstance.health === 170, `Player health is exactly 170 after 1 normal hit (200 - 30 = ${playerInstance.health})`);

// Duplicate hit during invulnerability window should be blocked
const duplicateHit = mockCombat.resolveEnemyHit(playerInstance, scoutA, 1/60, feedback);
assert(!duplicateHit, 'Damage protection invulnerability window blocks immediate re-damage from same attack');
assert(playerInstance.health === 170, 'Player health remains 170 due to damage protection');

// Waiting enemy Scout C trying to deal damage must be BLOCKED
enemyAttackCoordinator.release(scoutA);
enemyAttackCoordinator.update(0.35);
scoutB.attackCooldown = 0;
enemyAttackCoordinator.claim(scoutB);
assert(enemyAttackCoordinator.activeAttacker === scoutB, 'Scout B is active attacker');
scoutC.root.position.set(0, 0, 1.5);
scoutC.attackPhase = 0.15;
scoutC.attackHitDone = false;
playerInstance.invulnerable = 0; // reset invulnerability to test attack coordinator gate
const waitingEnemyHit = mockCombat.resolveEnemyHit(playerInstance, scoutC, 1/60, feedback);
assert(!waitingEnemyHit, 'Waiting enemy not in active attacker slot cannot damage player');

// TEST 5: Exact Katana Damage = 70 HP
console.log('\n[TEST 5] Exact Katana Damage (Exactly 70 HP)');
const targetScout = new Enemy(createVector3(0, 0, 3), 'scout', { arrivalDelay: 0 });
targetScout.alive = true;
targetScout.health = 140;

playerInstance.reset(createVector3(0, 0, 0));
let recordedDamage = 0;
const mockFeedback = {
  damageNumber: (pos, dmg) => { recordedDamage = dmg; },
  sparks: () => {},
  flash: () => {},
  message: () => {}
};

const hitApplied = mockCombat.applyDamageToEnemy(playerInstance, targetScout, 70, 'katana-combo-1', mockFeedback);
assert(hitApplied === true, 'Katana attack applied to target enemy');
assert(targetScout.health === 70, `Target enemy health reduced by exactly 70 HP (140 - 70 = ${targetScout.health})`);

// Second hit reduces health to 0 and defeats enemy
const fatalHit = mockCombat.applyDamageToEnemy(playerInstance, targetScout, 70, 'katana-combo-2', mockFeedback);
assert(fatalHit === true, 'Second katana attack applied');
assert(targetScout.health === 0, 'Enemy health reduced to 0');
assert(targetScout.alive === false, 'Enemy is defeated and marked alive=false');

console.log(`\n--- REQUIREMENT TEST RESULTS: ${passedTests} / ${totalTests} PASSED ---`);
if (passedTests === totalTests) {
  console.log('ALL GAMEPLAY REQUIREMENTS VERIFIED SUCCESSFULLY!');
} else {
  console.error('SOME REQUIREMENT TESTS FAILED!');
  process.exit(1);
}
