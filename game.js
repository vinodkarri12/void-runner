import * as THREE from 'three';

const viewport = document.querySelector('#viewport');
const $ = (selector) => document.querySelector(selector);
const ui = {
  health: $('#healthFill'), healthText: $('#healthText'), score: $('#scoreValue'), combo: $('#comboValue'),
  enemies: $('#enemyValue'), wave: $('#waveLabel'), speed: $('#speedValue'), multiplier: $('#multiplierValue'),
  momentum: $('#momentumFill'), momentumLabel: $('#momentumLabel'), speedLines: $('#speedLines'),
  wall: $('#wallIndicator'), comboNotice: $('#comboNotice'), overlay: $('#screenOverlay'),
  modalEyebrow: $('#modalEyebrow'), modalTitle: $('#modalTitle'), modalMessage: $('#modalMessage'),
  pauseButton: $('#pauseButton'), resumeButton: $('#resumeButton'), restartButton: $('#restartButton')
};
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080b18);
scene.fog = new THREE.FogExp2(0x080b18, 0.009);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 260);
const renderer = new THREE.WebGLRenderer({ antialias: innerWidth > 700, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
viewport.appendChild(renderer.domElement);

const clock = new THREE.Clock();
const keys = new Set();
const obstacles = [];
const enemies = [];
const particles = [];
const effects = [];
const arena = 52;
const clamp = THREE.MathUtils.clamp;
const vec = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const material = (color, emissive = 0x000000, intensity = 0, roughness = 0.55, metalness = 0.25) =>
  new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: intensity, roughness, metalness });
const mats = {
  floor: material(0x141a29, 0x061126, 0.25, 0.76), line: material(0x0c4b71, 0x087bb4, 1.7),
  cyan: material(0x38cfff, 0x11b8ff, 2.2), purple: material(0xa044ff, 0x761bff, 2.1),
  red: material(0xff325c, 0xb3093c, 2), dark: material(0x17243a, 0x08101d, 0.3, 0.38, 0.72),
  player: material(0xd9f9ff, 0x087eaa, 1.1, 0.28, 0.48), enemy: material(0x31344f, 0x630d36, 0.7, 0.33, 0.56),
  white: material(0xffffff, 0xffffff, 3), glass: new THREE.MeshStandardMaterial({ color: 0x0c1730, emissive: 0x09254b, emissiveIntensity: 0.65, metalness: 0.5, roughness: 0.25 })
};
scene.add(new THREE.HemisphereLight(0x9bbaff, 0x10121e, 1.55));
const moon = new THREE.DirectionalLight(0x9bcaff, 2.2);
moon.position.set(-18, 32, 8); moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024); scene.add(moon);
const pinkLight = new THREE.PointLight(0xc323ff, 105, 60); pinkLight.position.set(16, 9, -16); scene.add(pinkLight);
const blueLight = new THREE.PointLight(0x168aff, 115, 70); blueLight.position.set(-18, 8, 18); scene.add(blueLight);

const box = (w, h, d, mat, x, y, z, parent = scene) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
};
const floor = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), mats.floor);
floor.rotation.x = -Math.PI / 2; floor.position.y = -0.12; floor.receiveShadow = true; scene.add(floor);
const grid = new THREE.GridHelper(240, 100, 0x13658a, 0x17304b);
grid.position.y = -0.1; grid.material.transparent = true; grid.material.opacity = 0.32; scene.add(grid);

function addObstacle(x, z, w, d, h, kind = 'wall') {
  const object = new THREE.Group(); object.position.set(x, 0, z); scene.add(object);
  const body = box(w, h, d, kind === 'wall' ? mats.dark : material(0x27213a, 0x230f45, 0.5), 0, h / 2, 0, object);
  const strip = box(kind === 'wall' ? 0.08 : w * 0.8, 0.055, kind === 'wall' ? d + 0.04 : 0.08, kind === 'wall' ? mats.cyan : mats.purple, 0, h - 0.18, 0, object);
  obstacles.push({ x, z, w, d, h, kind, body });
  return { object, strip };
}
// Raised perimeter walls are valid wall-run surfaces; ramps and low blocks are traversable.
addObstacle(0, -arena, arena * 2, 1, 5, 'wall'); addObstacle(0, arena, arena * 2, 1, 5, 'wall');
addObstacle(-arena, 0, 1, arena * 2, 5, 'wall'); addObstacle(arena, 0, 1, arena * 2, 5, 'wall');
addObstacle(-13, -7, 7, 1, 3.2, 'wall'); addObstacle(13, 8, 8, 1, 3.6, 'wall');
addObstacle(1, -15, 1, 8, 3, 'wall'); addObstacle(-2, 13, 1, 8, 3, 'wall');
addObstacle(-6, 4, 4, 3, 1.2, 'low'); addObstacle(8, -3, 4, 4, 1.35, 'low');
addObstacle(19, 18, 4, 4, 1.5, 'low'); addObstacle(-20, -16, 5, 3, 1.25, 'low');
const ramp = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 5), mats.dark);
ramp.position.set(17, 0.75, -17); ramp.rotation.z = -0.18; ramp.castShadow = true; ramp.receiveShadow = true; scene.add(ramp);
const rampGlow = box(6.5, 0.07, 0.09, mats.purple, 17, 1.1, -17); rampGlow.rotation.z = -0.18;

// Distant city blocks frame the arena and provide a readable cyberpunk skyline.
for (let i = 0; i < 38; i++) {
  const angle = i / 38 * Math.PI * 2, radius = 58 + Math.random() * 16;
  const width = 4 + Math.random() * 7, depth = 4 + Math.random() * 7, height = 9 + Math.random() * 30;
  const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
  box(width, height, depth, i % 3 ? mats.dark : mats.glass, x, height / 2 - 0.2, z);
  for (let row = 1; row < Math.min(7, Math.floor(height / 3)); row++) {
    const window = box(width * 0.58, 0.07, 0.06, i % 2 ? mats.cyan : mats.purple, x, row * 2.5, z + depth / 2 + 0.04);
    window.material = window.material.clone(); window.material.transparent = true;
  }
}
for (let i = 0; i < 16; i++) {
  const a = i / 16 * Math.PI * 2, x = Math.cos(a) * 36, z = Math.sin(a) * 36;
  const sign = box(2.3, 1.5, 0.12, i % 2 ? mats.cyan : mats.purple, x, 5 + Math.random() * 4, z);
  sign.lookAt(0, sign.position.y, 0);
}
// Road edge markers.
for (let i = -24; i <= 24; i += 4) {
  box(0.13, 0.04, 0.65, mats.cyan, i, 0.01, -arena + 2);
  box(0.13, 0.04, 0.65, mats.red, i, 0.01, arena - 2);
  box(0.65, 0.04, 0.13, mats.purple, -arena + 2, 0.01, i);
  box(0.65, 0.04, 0.13, mats.cyan, arena - 2, 0.01, i);
}

const player = new THREE.Group(); scene.add(player);
const body = box(0.72, 1.12, 0.48, mats.player, 0, 0.93, 0, player);
body.geometry.translate(0, 0, 0);
const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 12, 10), mats.dark);
head.position.set(0, 1.68, 0.02); head.castShadow = true; player.add(head);
const visor = box(0.38, 0.09, 0.06, mats.cyan, 0, 1.71, 0.26, player);
const limbMat = material(0x263851, 0x061d30, 0.7, 0.3, 0.5);
const arms = [-1, 1].map(side => box(0.22, 0.78, 0.27, limbMat, side * 0.51, 0.95, 0, player));
const legs = [-1, 1].map(side => box(0.27, 0.68, 0.31, limbMat, side * 0.2, 0.38, 0, player));
const playerRing = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.035, 6, 28), mats.cyan);
playerRing.rotation.x = Math.PI / 2; playerRing.position.y = 0.05; player.add(playerRing);
player.position.set(0, 0, 0);

const state = {
  velocity: vec(), facing: vec(0, 0, -1), grounded: true, wallRunning: false, wallSide: 0,
  sliding: 0, dashing: 0, invulnerable: 0, health: 100, score: 0, combo: 0, comboTimer: 0,
  wave: 1, playing: true, time: 0, shake: 0, slowmo: 0, messageTimer: 0, attackTimer: 0
};
const cameraTarget = vec();
let lastImpactTime = 0;

function makeEnemy(x, z) {
  const root = new THREE.Group(); scene.add(root); root.position.set(x, 0, z);
  const core = box(0.82, 1.15, 0.62, mats.enemy, 0, 0.9, 0, root);
  const enemyHead = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), mats.dark);
  enemyHead.position.y = 1.7; enemyHead.castShadow = true; root.add(enemyHead);
  box(0.52, 0.11, 0.07, mats.red, 0, 1.72, 0.31, root);
  const armL = box(0.22, 0.72, 0.26, mats.dark, -0.53, 0.95, 0, root);
  const armR = box(0.22, 0.72, 0.26, mats.dark, 0.53, 0.95, 0, root);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.57, 0.028, 5, 20), mats.red);
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.04; root.add(ring);
  const barGroup = new THREE.Group(); barGroup.position.set(0, 2.35, 0); root.add(barGroup);
  const bg = box(1.05, 0.1, 0.08, material(0x180d20), 0, 0, 0, barGroup);
  const fill = box(0.95, 0.055, 0.09, mats.red, 0, 0.01, 0.05, barGroup); fill.position.x = -0.025;
  const hp = new THREE.Group(); hp.add(fill); barGroup.add(hp);
  enemies.push({ root, core, enemyHead, arms: [armL, armR], ring, barGroup, hp, health: 100, maxHealth: 100, hitCooldown: 0, attackCooldown: 0.6 + Math.random(), alive: true, phase: Math.random() * 6 });
}
function spawnWave() {
  const count = Math.min(3 + state.wave, 8);
  for (let i = 0; i < count; i++) {
    let x, z, tries = 0;
    do {
      const angle = Math.random() * Math.PI * 2, r = 20 + Math.random() * 17;
      x = Math.cos(angle) * r; z = Math.sin(angle) * r; tries++;
    } while (Math.hypot(x - player.position.x, z - player.position.z) < 13 && tries < 20);
    makeEnemy(x, z);
  }
  updateHud();
  notice(`WAVE ${String(state.wave).padStart(2, '0')} // ENGAGE`, 2.2);
}
function notice(text, duration = 1.3) { ui.comboNotice.textContent = text; state.messageTimer = duration; }

const trailMaterial = new THREE.MeshBasicMaterial({ color: 0x34bfff, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
const purpleTrailMaterial = new THREE.MeshBasicMaterial({ color: 0xb84cff, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending, depthWrite: false });
const whiteTrailMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
function makeTrail() {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.18, 1.25, 7, 1, true), trailMaterial.clone());
  mesh.rotation.x = Math.PI / 2; mesh.position.copy(player.position).add(vec(0, 1, 0)); scene.add(mesh);
  mesh.userData.life = 0.34; mesh.userData.maxLife = 0.34; mesh.userData.kind = 'trail'; effects.push(mesh);
}
function burst(position, color = 0x66dbff, count = 24, power = 8) {
  const geometry = new THREE.SphereGeometry(0.055, 5, 4);
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending });
    const particle = new THREE.Mesh(geometry, mat); particle.position.copy(position);
    const direction = vec(Math.random() * 2 - 1, Math.random() * 1.6 - 0.3, Math.random() * 2 - 1).normalize();
    particle.userData.velocity = direction.multiplyScalar(power * (0.3 + Math.random() * 0.9));
    particle.userData.life = 0.3 + Math.random() * 0.55; particle.userData.maxLife = particle.userData.life;
    scene.add(particle); particles.push(particle);
  }
}
function shockwave(position, color = 0x58eaff, scale = 1) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.045, 6, 36), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }));
  ring.rotation.x = Math.PI / 2; ring.position.copy(position).setY(0.08); ring.scale.setScalar(0.15 * scale);
  scene.add(ring); ring.userData.life = 0.68; ring.userData.maxLife = 0.68; ring.userData.kind = 'shockwave'; effects.push(ring);
}
function updateEffects(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.userData.life -= dt; p.position.addScaledVector(p.userData.velocity, dt);
    p.userData.velocity.y -= 9 * dt; p.material.opacity = Math.max(0, p.userData.life / p.userData.maxLife);
    if (p.userData.life <= 0) { scene.remove(p); p.material.dispose(); particles.splice(i, 1); }
  }
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i]; e.userData.life -= dt; const ratio = Math.max(0, e.userData.life / e.userData.maxLife);
    if (e.userData.kind === 'shockwave') { e.scale.setScalar((1 - ratio) * 4 + 0.15); e.material.opacity = ratio; }
    else { e.scale.y = 0.45 + ratio * 0.8; e.material.opacity = ratio * 0.8; }
    if (e.userData.life <= 0) { scene.remove(e); e.material.dispose(); effects.splice(i, 1); }
  }
  if (Math.hypot(state.velocity.x, state.velocity.z) > 10 && Math.random() < dt * 23) makeTrail();
}

function collideObstacle(nextX, nextZ) {
  let x = nextX, z = nextZ;
  for (const o of obstacles) {
    if (Math.abs(x - o.x) < o.w / 2 + 0.46 && Math.abs(z - o.z) < o.d / 2 + 0.42) {
      if (o.kind === 'low' && state.sliding > 0) continue;
      if (o.kind === 'low' && state.grounded && player.position.y < o.h + 0.2 && state.velocity.length() > 8) {
        state.velocity.multiplyScalar(-0.22); burst(vec(x, 0.5, z), 0x7ceaff, 7, 3); continue;
      }
      const overlapX = o.w / 2 + 0.46 - Math.abs(x - o.x), overlapZ = o.d / 2 + 0.42 - Math.abs(z - o.z);
      if (overlapX < overlapZ) { x += (x < o.x ? -1 : 1) * overlapX; state.velocity.x *= -0.15; }
      else { z += (z < o.z ? -1 : 1) * overlapZ; state.velocity.z *= -0.15; }
    }
  }
  return { x: clamp(x, -arena + 1, arena - 1), z: clamp(z, -arena + 1, arena - 1) };
}
function checkWallRun() {
  const nearX = Math.abs(player.position.x) > arena - 2.4;
  const nearZ = Math.abs(player.position.z) > arena - 2.4;
  const moving = Math.hypot(state.velocity.x, state.velocity.z) > 7;
  state.wallRunning = !state.grounded && moving && (nearX || nearZ) && state.wallRunCooldown <= 0;
  state.wallSide = nearX ? Math.sign(player.position.x) : Math.sign(player.position.z);
  ui.wall.classList.toggle('active', state.wallRunning);
  if (state.wallRunning) { state.velocity.y = Math.max(state.velocity.y, 1.8); state.velocity.multiplyScalar(1.001); }
}
function damageEnemy(enemy, damage, speed) {
  enemy.health = Math.max(0, enemy.health - damage); enemy.hitCooldown = 0.72;
  enemy.root.position.addScaledVector(state.facing, 0.25 + speed * 0.018);
  enemy.root.rotation.z = (Math.random() - 0.5) * 0.25;
  enemy.core.material = mats.white;
  setTimeout(() => { if (enemy.alive) enemy.core.material = mats.enemy; }, 85);
  enemy.hp.scale.x = Math.max(0.001, enemy.health / enemy.maxHealth);
  burst(enemy.root.position.clone().add(vec(0, 1, 0)), speed > 25 ? 0xffffff : 0x6aeaff, speed > 25 ? 34 : 15, speed > 25 ? 13 : 6);
  const maxHit = speed >= 27;
  if (maxHit) {
    shockwave(enemy.root.position, 0xffffff, 1.45); state.shake = 0.8; state.slowmo = 0.48;
    notice('MAX VELOCITY // IMPACT', 1.3);
  } else if (damage >= 28) {
    shockwave(enemy.root.position, 0xa94cff, 1); state.shake = 0.38; notice('KINETIC IMPACT', 0.8);
  }
  state.combo = state.comboTimer > 0 ? state.combo + 1 : 1; state.comboTimer = 3.2;
  state.score += Math.round(damage * (1 + (state.combo - 1) * 0.2));
  if (enemy.health <= 0) {
    enemy.alive = false; state.score += 100; burst(enemy.root.position.clone().add(vec(0, 1, 0)), 0xff3970, 30, 9);
    shockwave(enemy.root.position, 0xff3970, 1.1);
    const index = enemies.indexOf(enemy); if (index !== -1) enemies.splice(index, 1);
    scene.remove(enemy.root);
  }
  lastImpactTime = state.time;
}
function kineticCombat(dt, speed) {
  for (const enemy of [...enemies]) {
    enemy.hitCooldown = Math.max(0, enemy.hitCooldown - dt);
    if (enemy.hitCooldown > 0) continue;
    const distance = Math.hypot(enemy.root.position.x - player.position.x, enemy.root.position.z - player.position.z);
    if (distance < 1.42 && speed > 0.8) {
      const alignment = state.facing.dot(vec(enemy.root.position.x - player.position.x, 0, enemy.root.position.z - player.position.z).normalize());
      if (alignment < -0.15 && speed < 9) continue;
      if (speed < 1.7) { enemy.hitCooldown = 0.34; continue; }
      const damage = Math.round(100 * Math.pow(clamp(speed / 27, 0, 1), 1.65));
      if (damage > 0) damageEnemy(enemy, damage, speed);
    } else if (distance < 1.7 && speed < 1.7 && enemy.attackCooldown <= 0 && state.invulnerable <= 0) {
      state.health = Math.max(0, state.health - 9); state.invulnerable = 0.8; enemy.attackCooldown = 1.15;
      state.shake = 0.18; burst(player.position.clone().add(vec(0, 1, 0)), 0xff416c, 8, 4);
    }
  }
}
function updateEnemies(dt) {
  for (const e of enemies) {
    e.phase += dt; e.attackCooldown -= dt;
    e.root.position.y = Math.sin(e.phase * 3) * 0.055;
    const dx = player.position.x - e.root.position.x, dz = player.position.z - e.root.position.z;
    const distance = Math.hypot(dx, dz) || 1;
    e.root.rotation.y = Math.atan2(dx, dz);
    const speed = distance > 2.1 ? 2.1 + Math.min(state.wave * 0.08, 0.7) : 0;
    e.root.position.x += dx / distance * speed * dt; e.root.position.z += dz / distance * speed * dt;
    e.arms[0].rotation.z = Math.sin(e.phase * 4) * 0.15; e.arms[1].rotation.z = -Math.sin(e.phase * 4) * 0.15;
  }
}

function updatePlayer(dt) {
  state.time += dt; state.invulnerable = Math.max(0, state.invulnerable - dt);
  state.comboTimer = Math.max(0, state.comboTimer - dt);
  state.dashing = Math.max(0, state.dashing - dt); state.sliding = Math.max(0, state.sliding - dt);
  state.wallRunCooldown = Math.max(0, (state.wallRunCooldown || 0) - dt);
  if (state.messageTimer > 0) { state.messageTimer -= dt; if (state.messageTimer <= 0) ui.comboNotice.textContent = ''; }
  const fwd = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
  const side = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
  const inputX = touchMove.x || side, inputZ = touchMove.y || fwd;
  const forward = vec(Math.sin(camera.rotation.y), 0, Math.cos(camera.rotation.y)).multiplyScalar(-1);
  const right = vec(forward.z, 0, -forward.x);
  const move = right.multiplyScalar(inputX).addScaledVector(forward, inputZ);
  if (move.lengthSq() > 1) move.normalize();
  const sprinting = keys.has('ShiftLeft') || keys.has('ShiftRight') || touchActions.sprint;
  const maxSpeed = sprinting ? 27 : 17;
  if (move.lengthSq() > 0.001) {
    const accel = state.grounded ? (sprinting ? 22 : 15) : 8;
    state.velocity.x += move.x * accel * dt; state.velocity.z += move.z * accel * dt;
    state.facing.lerp(move, 1 - Math.exp(-dt * 9)).normalize();
  }
  const drag = state.grounded ? (move.lengthSq() > 0 ? 0.985 : 0.94) : 0.995;
  state.velocity.x *= Math.pow(drag, dt * 60); state.velocity.z *= Math.pow(drag, dt * 60);
  const horizontalSpeed = Math.hypot(state.velocity.x, state.velocity.z);
  if (horizontalSpeed > maxSpeed) { state.velocity.x *= maxSpeed / horizontalSpeed; state.velocity.z *= maxSpeed / horizontalSpeed; }
  if (state.dashing > 0) {
    state.velocity.x = state.facing.x * 34; state.velocity.z = state.facing.z * 34;
  }
  const jumpPressed = keys.has('Space') || touchActions.jump;
  if (jumpPressed && state.grounded) { state.velocity.y = 10.5; state.grounded = false; }
  if (keys.has('ControlLeft') || keys.has('ControlRight') || touchActions.slide) {
    if (state.grounded && state.sliding <= 0) { state.sliding = 0.72; state.velocity.x *= 1.2; state.velocity.z *= 1.2; }
  }
  const now = performance.now();
  if ((keys.has('KeyE') || touchActions.dash) && now - lastDash > 760) {
    lastDash = now; state.dashing = 0.17; state.invulnerable = Math.max(state.invulnerable, 0.22);
    state.velocity.x = state.facing.x * 34; state.velocity.z = state.facing.z * 34;
    burst(player.position.clone().add(vec(0, 0.7, 0)), 0x61e9ff, 10, 5);
  }
  const pos = collideObstacle(player.position.x + state.velocity.x * dt, player.position.z + state.velocity.z * dt);
  player.position.x = pos.x; player.position.z = pos.z;
  checkWallRun();
  state.velocity.y -= (state.wallRunning ? 5.5 : 25) * dt;
  player.position.y += state.velocity.y * dt;
  if (player.position.y <= 0) { player.position.y = 0; state.velocity.y = 0; state.grounded = true; }
  else state.grounded = false;
  player.rotation.y = Math.atan2(state.facing.x, state.facing.z);
  body.scale.y = state.sliding > 0 ? 0.52 : 1; body.position.y = state.sliding > 0 ? 0.58 : 0.93;
  head.visible = state.sliding <= 0;
  legs.forEach((leg, i) => { leg.rotation.x = Math.sin(state.time * (horizontalSpeed * 0.8) + i * Math.PI) * Math.min(horizontalSpeed / 12, 0.65); });
  arms.forEach((arm, i) => { arm.rotation.x = -Math.sin(state.time * (horizontalSpeed * 0.8) + i * Math.PI) * Math.min(horizontalSpeed / 12, 0.5); });
  const speed = Math.hypot(state.velocity.x, state.velocity.z);
  kineticCombat(dt, speed); updateEnemies(dt);
  if (enemies.length === 0 && state.health > 0) {
    state.wave++;
    if (state.wave > 5) { state.playing = false; showModal('SIMULATION CLEARED', 'All five waves neutralized. The city remembers your speed.', 'VICTORY // TOP RUNNER'); }
    else spawnWave();
  }
  if (state.health <= 0 && state.playing) { state.playing = false; showModal('RUN TERMINATED', 'Your signal went dark. Build speed, keep moving, and try again.', 'OPERATOR DOWN'); }
  updateHud(speed);
}
let lastDash = 0;
const touchMove = { x: 0, y: 0 };
const touchActions = { jump: false, dash: false, slide: false, sprint: false };
function updateHud(speed = Math.hypot(state.velocity.x, state.velocity.z)) {
  const pct = speed / 27;
  ui.health.style.width = `${state.health}%`; ui.healthText.textContent = `${Math.ceil(state.health)} / 100`;
  ui.score.textContent = String(state.score).padStart(6, '0'); ui.combo.textContent = `×${state.combo}`;
  ui.enemies.textContent = String(enemies.length).padStart(2, '0'); ui.wave.textContent = `WAVE ${String(Math.min(state.wave, 5)).padStart(2, '0')} / 05`;
  ui.speed.textContent = String(Math.round(speed * 3.6)).padStart(3, '0');
  ui.multiplier.textContent = `×${(pct * 3).toFixed(1)}`; ui.momentum.style.width = `${Math.min(100, pct * 100)}%`;
  ui.momentumLabel.textContent = pct >= 0.97 ? 'OVERDRIVE' : pct > 0.66 ? 'CRITICAL' : pct > 0.32 ? 'CHARGING' : speed > 0.7 ? 'BUILDING' : 'IDLE';
  ui.momentum.style.background = pct >= 0.97 ? 'linear-gradient(90deg,#a94bff,#fff)' : pct > 0.66 ? 'linear-gradient(90deg,#159eff,#b647ff)' : 'linear-gradient(90deg,#168dff,#56edff)';
  ui.speedLines.style.opacity = String(clamp((speed - 10) / 24, 0, 0.5));
  ui.wall.classList.toggle('active', state.wallRunning);
}
function showModal(title, message, eyebrow) {
  ui.modalTitle.textContent = title; ui.modalMessage.textContent = message;
  ui.modalEyebrow.textContent = eyebrow; ui.resumeButton.style.display = state.health > 0 ? '' : 'none';
  ui.overlay.classList.remove('hidden');
}
function pauseGame() {
  if (!state.playing) return;
  state.playing = false; showModal('PAUSED', 'Catch your breath. The city is still waiting.', 'SYSTEM PAUSED');
}
function resumeGame() { ui.overlay.classList.add('hidden'); state.playing = true; clock.getDelta(); }
function resetGame() {
  for (const e of enemies) scene.remove(e.root); enemies.length = 0;
  for (const p of particles) { scene.remove(p); p.material.dispose(); } particles.length = 0;
  for (const e of effects) { scene.remove(e); e.material.dispose(); } effects.length = 0;
  player.position.set(0, 0, 0); state.velocity.set(0, 0, 0); state.facing.set(0, 0, -1);
  state.health = 100; state.score = 0; state.combo = 0; state.comboTimer = 0; state.wave = 1;
  state.grounded = true; state.wallRunning = false; state.sliding = 0; state.dashing = 0; state.invulnerable = 0; state.shake = 0; state.slowmo = 0; state.playing = true;
  ui.overlay.classList.add('hidden'); spawnWave(); clock.getDelta();
}
ui.pauseButton.addEventListener('click', () => state.playing ? pauseGame() : resumeGame());
ui.resumeButton.addEventListener('click', resumeGame);
ui.restartButton.addEventListener('click', resetGame);
addEventListener('keydown', (event) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  if (event.code === 'Escape') { state.playing ? pauseGame() : resumeGame(); return; }
  if (event.code === 'KeyR' && !state.playing) resetGame();
  keys.add(event.code);
});
addEventListener('keyup', (event) => keys.delete(event.code));
addEventListener('blur', () => { keys.clear(); if (state.playing) pauseGame(); });

const stickEl = $('#stick'), joystick = $('#joystick');
let joystickPointer = null;
joystick.addEventListener('pointerdown', event => { joystickPointer = event.pointerId; joystick.setPointerCapture(event.pointerId); moveStick(event); });
joystick.addEventListener('pointermove', event => { if (joystickPointer === event.pointerId) moveStick(event); });
function moveStick(event) {
  const rect = joystick.getBoundingClientRect(), dx = event.clientX - (rect.left + rect.width / 2), dy = event.clientY - (rect.top + rect.height / 2);
  const max = rect.width * 0.34, len = Math.hypot(dx, dy), scale = len > max ? max / len : 1;
  stickEl.style.transform = `translate(${dx * scale}px,${dy * scale}px)`;
  touchMove.x = dx * scale / max; touchMove.y = -dy * scale / max;
}
function releaseStick(event) {
  if (joystickPointer === event.pointerId) { joystickPointer = null; touchMove.x = 0; touchMove.y = 0; stickEl.style.transform = ''; }
}
joystick.addEventListener('pointerup', releaseStick); joystick.addEventListener('pointercancel', releaseStick);
document.querySelectorAll('[data-action]').forEach(button => {
  const action = button.dataset.action;
  const down = event => { event.preventDefault(); touchActions[action] = true; };
  const up = () => { touchActions[action] = false; };
  button.addEventListener('pointerdown', down); button.addEventListener('pointerup', up);
  button.addEventListener('pointercancel', up); button.addEventListener('pointerleave', up);
});

function updateCamera(dt) {
  const horizontalVelocity = vec(state.velocity.x, 0, state.velocity.z);
  const desired = player.position.clone().addScaledVector(state.facing, -8.2).add(vec(0, 4.1, 0));
  desired.addScaledVector(horizontalVelocity, -0.1);
  camera.position.lerp(desired, 1 - Math.exp(-dt * 4.4));
  cameraTarget.copy(player.position).add(vec(0, 1.3, 0)).addScaledVector(horizontalVelocity, 0.08);
  if (state.shake > 0) {
    const strength = state.shake * 0.24; camera.position.add(vec((Math.random() - 0.5) * strength, (Math.random() - 0.5) * strength, (Math.random() - 0.5) * strength));
    state.shake = Math.max(0, state.shake - dt * 2.1);
  }
  camera.lookAt(cameraTarget);
}
function animate() {
  requestAnimationFrame(animate);
  const rawDt = Math.min(clock.getDelta(), 0.04);
  const dt = rawDt * (state.slowmo > 0 ? 0.32 : 1);
  state.slowmo = Math.max(0, state.slowmo - rawDt);
  if (state.playing) updatePlayer(dt);
  else state.time += rawDt;
  updateEffects(rawDt);
  playerRing.rotation.z += rawDt * 1.4;
  updateCamera(rawDt);
  renderer.render(scene, camera);
}
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7)); renderer.setSize(innerWidth, innerHeight);
});
spawnWave(); updateCamera(1); animate();
