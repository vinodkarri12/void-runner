import fs from 'node:fs';
import vm from 'node:vm';

console.log('--- TESTING ENEMY TYPES & DISPOSE ---');

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
  document: {
    createElement: () => ({
      width: 512,
      height: 112,
      getContext: () => ({
        canvas: { width: 512, height: 112 },
        clearRect() {},
        fillRect() {},
        strokeRect() {},
        fillText() {},
        createLinearGradient: () => ({ addColorStop() {} })
      })
    })
  },
  window: { innerWidth: 1920, innerHeight: 1080, matchMedia: () => ({ matches: false }) }
});

let enemyCode = fs.readFileSync('src/Enemy.js', 'utf8')
  .replace(/import\s+[^;]+;/g, '')
  .replace(/export\s+const\s+/g, 'const ')
  .replace(/export\s+class\s+/g, 'class ')
  .replace(/export\s+default\s+/g, '');
enemyCode += '\nglobalThis.Enemy = Enemy;\nglobalThis.enemyAttackCoordinator = enemyAttackCoordinator;';
vm.runInContext(enemyCode, context);

const { Enemy } = context;

const types = ['scout', 'guardian', 'ranged', 'elite', 'colossus'];
for (const type of types) {
  try {
    const e = new Enemy(new Vector3(0, 0, 0), type);
    console.log(`[PASS] Enemy creation: ${type}`);
    if (typeof e.dispose === 'function') {
      e.dispose();
      console.log(`[PASS] Enemy dispose: ${type}`);
    } else {
      console.error(`[FAIL] Enemy ${type} has NO dispose() method!`);
    }
  } catch (err) {
    console.error(`[FAIL] Enemy creation ${type}:`, err.message);
  }
}
