import * as THREE from 'three';
import { World } from './World.js?campaign15a';
import { WorldChunkManager } from './WorldChunkManager.js?campaign15a';
import { Player } from './Player.js?campaign15a';
import { MovementSystem } from './MovementSystem.js';
import {
  CombatSystem,
  EXECUTION_HEALTH_RATIO,
  EXECUTION_RANGE
} from './CombatSystem.js?campaign15a';
import { Enemy } from './Enemy.js?campaign15a';
import { Effects } from './Effects.js';
import { AudioManager } from './AudioManager.js';
import { CameraController } from './CameraController.js?campaign15a';
import { HUD } from './HUD.js?campaign15a';
import { ProgressionManager, createLevelDefinition, CAMPAIGN_LEVELS } from './ProgressionManager.js?campaign15a';
import { WeaponManager, WEAPONS } from './WeaponManager.js?campaign15a';
import { SettingsManager } from './SettingsManager.js';

const viewport = document.getElementById('viewport');
const isMobileViewport = () => window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 700;
const getPixelRatioCap = (quality) => {
  const qualityCap = quality === 'low' ? 0.8 : quality === 'medium' ? 1.15 : 1.6;
  const fullHdCap = Math.min(1920 / window.innerWidth, 1080 / window.innerHeight);
  const deviceCap = isMobileViewport() ? (quality === 'high' ? 1.25 : 1) : qualityCap;
  return Math.min(deviceCap, fullHdCap);
};
const renderer = new THREE.WebGLRenderer({
  antialias: window.innerWidth > 700 && !isMobileViewport(),
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, getPixelRatioCap('high')));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
viewport.appendChild(renderer.domElement);

const world = new World();
const scene = world.scene;
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1400);
const hud = new HUD();
const player = new Player();
const movementSystem = new MovementSystem();
const worldChunks = new WorldChunkManager(scene);
const effects = new Effects(scene);
const audio = new AudioManager();
const combat = new CombatSystem(effects, audio);
const cameraController = new CameraController(camera, player);
const progression = new ProgressionManager();
const weaponManager = new WeaponManager();
const settingsManager = new SettingsManager();
const enemies = [];
const energyOrbs = [];
const getGroundHeight = worldChunks.getHeight.bind(worldChunks);
const keys = new Set();
const touch = {
  moveX: 0,
  moveY: 0,
  left: false,
  right: false,
  sprint: false,
  jump: false,
  slide: false,
  dash: false,
  charge: false
};
let isPaused = true;
let inMainMenu = true;
let reduceFlash = settingsManager.values.reducedEffects;
let menuReturnToPause = false;
let screenState = 'main-menu';
let loadingInProgress = false;
let loadingFailed = false;
let levelPageIndex = Math.floor((progression.unlockedLevel - 1) / 15);
let selectedLevel = progression.unlockedLevel;
let selectedWeapon = WEAPONS[0];
let loadingLevel = progression.unlockedLevel;
let loadingToken = 0;
let loadingTipTimer = 0;
const loadingTips = [
  'Build speed before you strike.',
  'Flank armored enemies for bonus damage.',
  'Dash through openings and preserve momentum.',
  'Unique kills restore up to 30 HP.',
  'Use the Void Chain to close distance without crossing walls.'
];
let wave = progression.currentLevel;
let shake = 0;
let slowMotion = 0;
let lastTime = 0;
let lastTrailTime = 0;
let lastBootParticleTime = 0;
let lastFootprintTime = 0;
let lastAfterimageTime = 0;
let waveState = 'intro';
let levelDefinition = createLevelDefinition(wave);
let levelKills = 0;
let levelElapsed = 0;
let levelDamageTaken = 0;
let spawnQueue = [];
let encounterQueues = [];
let encounterWaveIndex = 0;
let spawnInterval = 0;
let arrivalPortals = [];
let levelCompleteResult = null;
let targetRefresh = 0;
let waveMessageTimeout = 0;
let lastAimX = 0;
let targetEnemy = null;
let handledDashSequence = 0;
let defeatedEnemies = 0;
let cloneCooldown = 0;
let chainCooldown = 0;
let executionCooldown = 0;
let anchorCooldown = 0;
let anchorState = null;
let damageFlashTimer = 0;
let historySampleTimer = 0;
let cloneState = null;
let scoreBonusTimer = 0;
let movementHistory = [];
const shadowCloneCooldownDuration = 10;
const voidChainCooldownDuration = 4.2;
const ninjaExecutionCooldownDuration = 7;
const kineticAnchorCooldownDuration = 5.5;
const combatFeedback = {
  cameraShake: {
    get value() { return shake; },
    set value(value) { shake = value; }
  },
  flash(intensity, perfect) {
    hud.triggerImpactFlash(intensity * settingsManager.values.screenFlash, perfect, reduceFlash);
  },
  slowMotion(duration) {
    slowMotion = Math.max(slowMotion, duration);
  },
  message(text, duration) {
    hud.showCombatMessage(text, duration);
  },
  takeDamage(amount) {
    const applied = takeDamage(amount);
    if (applied > 0) {
      levelDamageTaken += applied;
      damageFlashTimer = 0.28;
      hud.healthBar.classList.add('damaged');
    }
    return applied;
  },
  damageFlash() {
    hud.triggerImpactFlash(0.3, false, reduceFlash);
  }
};

const anchorLineGeometry = new THREE.BufferGeometry();
anchorLineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
const anchorLine = new THREE.Line(
  anchorLineGeometry,
  new THREE.LineBasicMaterial({ color: 0xb568ff, transparent: true, opacity: 0.9 })
);
anchorLine.visible = false;
scene.add(anchorLine);
const anchorMarker = new THREE.Mesh(
  new THREE.IcosahedronGeometry(0.24, 1),
  new THREE.MeshStandardMaterial({ color: 0xc17aff, emissive: 0x973dff, emissiveIntensity: 3 })
);
anchorMarker.visible = false;
scene.add(anchorMarker);

function updateHealthHUD() {
  hud.updateHealthHUD(player);
}

function takeDamage(amount) {
  const applied = player.takeDamage(amount);
  updateHealthHUD();
  checkGameOver();
  return applied;
}

function healPlayer(amount) {
  const healed = player.healPlayer(amount);
  updateHealthHUD();
  return healed;
}

function checkGameOver() {
  if (screenState !== 'gameplay' || player.health > 0 || !player.isAlive) return false;
  player.isAlive = false;
  isPaused = true;
  screenState = 'game-over';
  document.body.classList.add('game-over-screen');
  document.body.classList.add('screen-modal-active');
  player.defeatPose = true;
  document.getElementById('frontEnd').hidden = true;
  document.body.classList.remove('frontend-open');
  document.body.classList.add('screen-modal-active');
  hud.restartButton.textContent = 'RETRY';
  hud.showModal('RUN TERMINATED', 'OPERATOR DOWN', 'The void takes another runner. Restart the sequence.');
  return true;
}

function clearShadowClone() {
  if (!cloneState) return;
  scene.remove(cloneState.root);
  cloneState.material.dispose();
  cloneState = null;
}

function removeEnergyOrb(orb) {
  scene.remove(orb.root);
  orb.root.traverse((object) => {
    if (!object.isMesh) return;
    object.geometry.dispose();
    object.material.dispose();
  });
}

function spawnEnergyOrb(position, guaranteed = false) {
  if (!guaranteed && Math.random() > 0.72) return;
  const type = guaranteed ? 'energy' : ['energy', 'health', 'score'][Math.floor(Math.random() * 3)];
  const color = type === 'energy' ? 0x4adfff : type === 'health' ? 0x62ffd1 : 0xb76cff;
  const root = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 2.8,
    metalness: 0.2,
    roughness: 0.2
  });
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), material);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.48, 0.035, 6, 20),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending })
  );
  ring.rotation.x = Math.PI / 2;
  root.add(orb, ring);
  root.position.copy(position).add(new THREE.Vector3(0, 1, 0));
  root.userData.baseY = root.position.y;
  root.userData.phase = Math.random() * Math.PI * 2;
  root.userData.orbType = type;
  scene.add(root);
  energyOrbs.push({ root, type, color, life: 18 });
}

function handleEnemyKill(enemy) {
  if (enemy.killRewardHandled) return 0;
  enemy.killRewardHandled = true;
  defeatedEnemies++;
  levelKills++;
  progression.recordKill(enemy.scoreReward || 0);
  const healed = healPlayer(30);
  const healPosition = player.root.position.clone().add(new THREE.Vector3(0, 1.4, 0));
  if (healed > 0) {
    effects.burst(healPosition, 0x58ffd5, 16, 3.6);
    effects.shockwave(player.root.position, 0x62ffd1, 0.9);
    effects.floatingText(healPosition, `+${Math.round(healed)} HP`, '#7dffe0');
    audio.play('heal');
  }
  if (enemy.type === 'colossus') {
    player.score += 1200;
    player.energy = Math.min(100, player.energy + 38);
    spawnEnergyOrb(enemy.root.position, true);
    combatFeedback.slowMotion(0.42);
    combatFeedback.message(`${enemy.isFinalBoss ? 'VOID OVERLORD' : 'VOID COLOSSUS'} DEFEATED // +1200`, 1600);
  } else {
    spawnEnergyOrb(enemy.root.position);
    combatFeedback.message(healed > 0 ? `ENEMY DEFEATED // +${Math.round(healed)} HP` : 'ENEMY DEFEATED // HP FULL', 1000);
  }
  return healed;
}

function rewardEnemyDefeat(defeatedPlayer, enemy) {
  if (defeatedPlayer !== player) return;
  handleEnemyKill(enemy);
}
combat.onEnemyDefeated = rewardEnemyDefeat;

function createSpawnPortal(position, color) {
  const root = new THREE.Group();
  root.position.copy(position);
  root.position.y += 1.5;
  const ring = new THREE.Mesh(
    spawnPortalGeometry,
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
  );
  const inner = new THREE.Mesh(
    spawnPortalGeometry,
    new THREE.MeshBasicMaterial({ color: 0xff455f, transparent: true, opacity: 0.64, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
  );
  ring.scale.set(1.25, 1.75, 1);
  inner.scale.set(0.75, 1.12, 1);
  inner.rotation.z = Math.PI / 4;
  root.add(ring, inner);
  scene.add(root);
  arrivalPortals.push({ root, life: 1.55, phase: Math.random() * Math.PI * 2 });
}

const spawnPortalGeometry = new THREE.TorusGeometry(1, 0.065, 7, 32);
let masterArena = null;

function removeMasterArena() {
  if (!masterArena) return;
  scene.remove(masterArena);
  const geometries = new Set();
  const materials = new Set();
  masterArena.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (Array.isArray(object.material)) object.material.forEach((material) => materials.add(material));
    else if (object.material) materials.add(object.material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  masterArena = null;
}

function createMasterArena(definition) {
  removeMasterArena();
  if (!definition.master) return;
  const root = new THREE.Group();
  root.position.set(
    player.root.position.x,
    getGroundHeight(player.root.position.x, player.root.position.z) + 0.06,
    player.root.position.z
  );
  const color = definition.finalBoss ? 0xff476d : 0xa958ff;
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.58,
    blending: THREE.AdditiveBlending
  });
  for (const radius of [10.5, 14]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.06, 7, 80), material);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.035;
    root.add(ring);
  }
  const pylonMaterial = new THREE.MeshStandardMaterial({
    color: 0x291b43,
    emissive: color,
    emissiveIntensity: 1.7,
    metalness: 0.65,
    roughness: 0.3
  });
  for (let index = 0; index < 6; index++) {
    const angle = index / 6 * Math.PI * 2;
    const pylon = new THREE.Mesh(new THREE.OctahedronGeometry(0.72, 1), pylonMaterial);
    pylon.position.set(Math.cos(angle) * 12.3, 1.4, Math.sin(angle) * 12.3);
    pylon.scale.set(0.75, 2, 0.75);
    root.add(pylon);
  }
  scene.add(root);
  masterArena = root;
}

function spawnWave(level = wave, checkpoint = null) {
  if (waveState === 'spawning' || waveState === 'active' ||
      !Number.isInteger(level) || level < 1 || level > CAMPAIGN_LEVELS) return false;
  enemies.splice(0, enemies.length);
  wave = level;
  progression.selectLevel(wave);
  levelDefinition = createLevelDefinition(wave);
  levelElapsed = 0;
  levelDamageTaken = 0;
  createMasterArena(levelDefinition);
  levelKills = checkpoint?.level === level ? checkpoint.completedKills : 0;
  spawnQueue = [];
  spawnInterval = 0;
  waveState = 'spawning';
  levelCompleteResult = null;
  const forward = player.facing.clone().setY(0).normalize();
  const right = new THREE.Vector3(forward.z, 0, -forward.x);
  const reservedSpawns = [];
  encounterQueues = levelDefinition.waves.map(() => []);
  encounterWaveIndex = checkpoint?.level === level
    ? Math.max(0, Math.min(levelDefinition.waves.length - 1, checkpoint.waveIndex))
    : 0;
  for (let stageIndex = 0; stageIndex < levelDefinition.waves.length; stageIndex++) {
    const types = levelDefinition.waves[stageIndex];
    for (let index = 0; index < types.length; index++) {
    const baseDistance = (levelDefinition.finalBoss ? 34 : 22) + (index % 3) * 5;
    const spawnRadius = types[index] === 'colossus' ? 4.2 : types[index] === 'guardian' ? 2.8 : 2.1;
    let x = 0;
    let z = 0;
    let foundClearance = false;
    for (let attempt = 0; attempt < 48; attempt++) {
      const distance = baseDistance + Math.floor(attempt / 8) * 6;
      const lane = attempt === 0
        ? (types.length === 1 ? 0 : (index % 5 - 2) * 3.3)
        : ((index * 3 + attempt) % 5 - 2) * 3.1;
      const centerX = player.root.position.x + forward.x * distance;
      const centerZ = player.root.position.z + forward.z * distance;
      x = THREE.MathUtils.clamp(
        centerX + right.x * lane,
        -7.1 - worldChunks.worldOffset.x,
        7.1 - worldChunks.worldOffset.x
      );
      z = centerZ + right.z * lane;
      const clearOfSpawned = reservedSpawns.every((spawn) =>
        Math.hypot(x - spawn.x, z - spawn.z) > spawn.radius + spawnRadius + 2
      );
      const clearOfPlayer = Math.hypot(x - player.root.position.x, z - player.root.position.z) > 16;
      if (clearOfPlayer && clearOfSpawned && worldChunks.isLocationClear(x, z, spawnRadius)) {
        foundClearance = true;
        break;
      }
    }
    if (!foundClearance) {
      const distance = baseDistance + 48 + reservedSpawns.length * 7;
      x = THREE.MathUtils.clamp(
        player.root.position.x + forward.x * distance,
        -6.2 - worldChunks.worldOffset.x,
        6.2 - worldChunks.worldOffset.x
      );
      z = player.root.position.z + forward.z * distance;
    }
    reservedSpawns.push({ x, z, radius: spawnRadius });
    const position = new THREE.Vector3(x, getGroundHeight(x, z), z);
    const type = types[index] || 'scout';
    const masterBoss = type === 'colossus';
    const healthScale = 0.74 + (wave - 1) * 0.055;
    const speedScale = 0.9 + (wave - 1) * 0.035;
    const attackScale = 0.72 + (wave - 1) * 0.075;
    const baseHealth = { scout: 72, guardian: 145, ranged: 112, elite: 230, colossus: 780 }[type] || 72;
    const baseSpeed = { scout: 4.2, guardian: 2.35, ranged: 2.8, elite: 3.1, colossus: 1.45 }[type] || 4.2;
    const options = {
      arrivalDelay: levelDefinition.finalBoss ? 1.8 : 1.05,
      arrivalDuration: levelDefinition.finalBoss ? 1.5 : 1.05,
      masterLevel: masterBoss ? wave : 0,
      isFinalBoss: levelDefinition.finalBoss && masterBoss,
      name: levelDefinition.finalBoss && masterBoss ? 'VOID OVERLORD' : undefined,
      spec: {
        ...(levelDefinition.finalBoss && masterBoss
          ? { scale: 2.8, health: 150, speed: 2.05, attackDamage: 15, armor: 0x493b54 }
          : { health: Math.round(baseHealth * healthScale), speed: baseSpeed * speedScale,
            attackDamage: Math.round(({ scout: 6, guardian: 7, ranged: 7, elite: 9 }[type] || 6) * attackScale),
            attackCooldownScale: Math.max(0.5, 1 - (wave - 1) * 0.035) })
      }
    };
    const enemy = new Enemy(position, type, options);
    enemy.scoreReward = levelDefinition.finalBoss ? 2500 : Math.round(140 + wave * 18);
    encounterQueues[stageIndex].push({
      enemy,
      position,
      color: levelDefinition.finalBoss ? 0xd19aff : 0xff486c,
      delay: levelDefinition.finalBoss ? 0.65 : 0.42
    });
    }
  }
  for (let index = 0; index < encounterWaveIndex; index++) encounterQueues[index] = [];
  spawnQueue = encounterQueues[encounterWaveIndex] || [];
  world.setCampaignMood?.(wave);
  worldChunks.setCampaignPhase(wave);
  progression.saveCheckpoint({
    level: wave,
    waveIndex: encounterWaveIndex,
    completedKills: levelKills,
    health: player.health,
    energy: player.energy,
    score: player.score,
    defeated: defeatedEnemies
  });
  if (levelDefinition.master) audio.play('charge');
  hud.showLevel(wave, levelDefinition, progression);
  hud.centerMessage.textContent = levelDefinition.master
    ? `FINAL BATTLE // LEVEL 15 // ${levelDefinition.title}`
    : `LEVEL ${String(wave).padStart(2, '0')} // ${levelDefinition.title}`;
  hud.centerMessage.style.opacity = '1';
  window.clearTimeout(waveMessageTimeout);
  waveMessageTimeout = window.setTimeout(() => { hud.centerMessage.style.opacity = '0'; }, 2200);
  return true;
}

const removeEnemy = (enemy) => {
  if (enemy.cleaned) return;
  enemy.cleaned = true;
  scene.remove(enemy.root);
  enemy.dispose();
  enemy.alive = false;
};

function updateSpawnPortals(dt) {
  for (let index = arrivalPortals.length - 1; index >= 0; index--) {
    const portal = arrivalPortals[index];
    portal.life -= dt;
    portal.root.rotation.y += dt * 1.7;
    portal.root.rotation.z = Math.sin(portal.phase + (1.55 - portal.life) * 4) * 0.12;
    portal.root.scale.setScalar(0.72 + Math.sin((1.55 - portal.life) * 8) * 0.13);
    for (const child of portal.root.children) {
      child.material.opacity = Math.max(0, Math.min(1, portal.life / 0.4)) * 0.86;
    }
    if (portal.life <= 0) {
      scene.remove(portal.root);
      for (const child of portal.root.children) child.material.dispose();
      arrivalPortals.splice(index, 1);
    }
  }
}

function updateWaveSpawner(dt) {
  if (waveState !== 'spawning') return;
  spawnInterval -= dt;
  if (spawnQueue.length && spawnInterval <= 0) {
    const entry = spawnQueue.shift();
    scene.add(entry.enemy.root);
    enemies.push(entry.enemy);
    createSpawnPortal(entry.position, entry.color);
    entry.enemy.arrivalTimer = 1.15;
    spawnInterval = entry.delay || (levelDefinition.master ? 0.38 : 0.24);
  }
  if (spawnQueue.length === 0 && enemies.length > 0 && enemies.every((enemy) => enemy.arrivalTimer <= 0)) {
    waveState = 'active';
    combatFeedback.message(
      levelDefinition.master ? 'MASTER HOSTILES // ENGAGE' : 'HOSTILES ENTERED // ENGAGE',
      900
    );
  }
}

function beginNextEncounterWave() {
  if (waveState !== 'active' || enemies.length > 0 || levelKills >= levelDefinition.requiredKills ||
      encounterWaveIndex + 1 >= encounterQueues.length) return false;
  encounterWaveIndex++;
  spawnQueue = encounterQueues[encounterWaveIndex];
  spawnInterval = 0;
  waveState = 'spawning';
  progression.saveCheckpoint({
    level: wave,
    waveIndex: encounterWaveIndex,
    completedKills: levelKills,
    health: player.health,
    energy: player.energy,
    score: player.score,
    defeated: defeatedEnemies
  });
  combatFeedback.message(
    levelDefinition.master && encounterWaveIndex === encounterQueues.length - 1
      ? 'MASTER BOSS // BREACH DETECTED'
      : `WAVE ${encounterWaveIndex + 1} / ${encounterQueues.length} // HOSTILES INBOUND`,
    1300
  );
  return true;
}

function completeLevel() {
  if (waveState !== 'active' || levelKills < levelDefinition.requiredKills || enemies.length > 0) return false;
  waveState = 'complete';
  player.score += levelDefinition.master ? 1400 + wave * 3 : 400 + wave * 2;
  const reward = levelDefinition.finalBoss ? 5000 : levelDefinition.master ? 1400 + wave * 3 : 400 + wave * 2;
  const result = progression.completeCurrentLevel(reward, {
    health: player.health,
    energy: player.energy,
    score: player.score,
    defeated: defeatedEnemies
  });
  if (levelDefinition.master) {
    effects.shockwave(player.root.position.clone(), levelDefinition.finalBoss ? 0xffd16f : 0xb36cff, 3.2);
    effects.burst(player.root.position.clone().add(new THREE.Vector3(0, 1.4, 0)), levelDefinition.finalBoss ? 0xffd16f : 0xbf72ff, 42, 9);
    effects.floatingText(
      player.root.position.clone().add(new THREE.Vector3(0, 2.4, 0)),
      levelDefinition.finalBoss ? 'VOID OVERLORD // DEFEATED' : 'MASTER TRIAL // CLEARED',
      '#d9b6ff'
    );
    audio.play('overdrive');
  }
  levelCompleteResult = result;
  screenState = 'victory';
  document.body.classList.add('victory-screen');
  document.body.classList.add('screen-modal-active');
  document.getElementById('frontEnd').hidden = true;
  document.body.classList.remove('frontend-open');
  player.victoryPose = true;
  const rank = levelElapsed < 60 && levelDamageTaken < 20 ? 'S' :
    levelElapsed < 120 && levelDamageTaken < 50 ? 'A' :
      levelElapsed < 210 && levelDamageTaken < 100 ? 'B' : 'C';
  hud.showLevelComplete(levelDefinition, result, progression, {
    rank,
    score: player.score,
    enemies: levelKills,
    time: levelElapsed,
    damage: levelDamageTaken,
    reward
  });
  isPaused = true;
  return true;
}

function continueCampaign() {
  if (!levelCompleteResult || levelCompleteResult.final) return;
  const carriedRun = {
    health: player.health,
    energy: player.energy,
    score: player.score,
    defeated: defeatedEnemies
  };
  wave = levelCompleteResult.unlocked;
  startLevelWithLoading(wave, carriedRun);
}

function continueSavedCampaign() {
  const checkpoint = progression.checkpoint;
  if (!checkpoint && progression.completedLevels.has(CAMPAIGN_LEVELS)) return;
  if (!checkpoint) {
    startLevelWithLoading(progression.unlockedLevel);
    return;
  }
  startLevelWithLoading(checkpoint.level, {
    health: checkpoint.health,
    energy: checkpoint.energy,
    score: checkpoint.score,
    defeated: checkpoint.defeated
  }, false, checkpoint);
}

function replayLevel() {
  if (waveState !== 'complete' && player.isAlive === false) {
    startLevelWithLoading(wave);
    return;
  }
  progression.selectLevel(wave);
  startLevelWithLoading(wave);
}

function setFrontView(name) {
  const frontEnd = document.getElementById('frontEnd');
  screenState = name === 'home' ? 'main-menu' : name;
  isPaused = true;
  inMainMenu = !menuReturnToPause;
  hud.hideModal();
  frontEnd.hidden = false;
  frontEnd.classList.remove('leaving');
  document.body.classList.add('frontend-open');
  document.body.classList.remove('game-over-screen', 'victory-screen', 'screen-modal-active');
  frontEnd.querySelectorAll('[data-view-button="home"]').forEach((button) => {
    button.textContent = menuReturnToPause ? 'BACK TO PAUSE' : 'BACK TO MAIN MENU';
  });
  if (name === 'home') {
    const equipped = WEAPONS.find((weapon) => weapon.id === weaponManager.equippedId) || WEAPONS[0];
    player.equipWeapon(equipped);
  }
  frontEnd.querySelectorAll('.front-view').forEach((view) => {
    view.classList.toggle('active', view.dataset.view === name);
  });
  if (name === 'home') refreshHomeMenu();
  if (name === 'levels') renderLevelSelect();
  if (name === 'armory') renderArmory();
  if (name === 'settings') syncSettingsControls();
}

function refreshHomeMenu() {
  const hasProgress = progression.hasProgress;
  const checkpoint = progression.checkpoint;
  const campaignComplete = progression.completedLevels.has(CAMPAIGN_LEVELS) && !checkpoint;
  document.getElementById('frontSaveStatus').textContent = campaignComplete
    ? 'CAMPAIGN COMPLETE // VOID OVERLORD DEFEATED'
    : hasProgress
    ? `CHECKPOINT // LEVEL ${String(checkpoint?.level ?? progression.unlockedLevel).padStart(2, '0')} / 15 // ${progression.completedCount} CLEARED`
    : 'LEVEL 01 / 15 // NEW CAMPAIGN';
  const continueButton = document.querySelector('[data-menu-action="continue"]');
  continueButton.textContent = hasProgress && checkpoint
    ? `CONTINUE — LEVEL ${checkpoint.level}`
    : 'CONTINUE';
  continueButton.disabled = campaignComplete;
  continueButton.title = hasProgress ? 'Resume from the latest safe checkpoint' : 'No save yet; continue will offer to start Level 1';
}

function renderLevelSelect(page = null) {
  const grid = document.getElementById('levelGrid');
  const pageSize = 15;
  const searchValue = Number(document.getElementById('levelSearch').value);
  if (page === 'search') {
    page = null;
    if (Number.isInteger(searchValue) && searchValue >= 1 && searchValue <= CAMPAIGN_LEVELS) {
    selectedLevel = searchValue;
    levelPageIndex = Math.floor((searchValue - 1) / pageSize);
    }
  }
  const pageCount = Math.ceil(CAMPAIGN_LEVELS / pageSize);
  const currentPage = Math.max(0, Math.min(pageCount - 1, page ?? levelPageIndex));
  levelPageIndex = currentPage;
  const first = currentPage * pageSize + 1;
  const last = Math.min(CAMPAIGN_LEVELS, first + pageSize - 1);
  grid.replaceChildren();
  for (let level = first; level <= last; level++) {
    const definition = createLevelDefinition(level);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'level-tile';
    button.textContent = String(level).padStart(3, '0');
    button.title = `${definition.title} — ${definition.master ? 'MASTER LEVEL' : `DIFFICULTY ${definition.difficulty.toFixed(1)}`}`;
    button.classList.toggle('master', definition.master);
    button.classList.toggle('complete', progression.completedLevels.has(level));
    button.classList.toggle('current', level === selectedLevel);
    button.classList.toggle('locked', level > progression.unlockedLevel);
    button.disabled = level > progression.unlockedLevel;
    button.addEventListener('click', () => {
      selectedLevel = level;
      document.getElementById('levelSearch').value = String(level);
      renderLevelSelect(currentPage);
    });
    grid.append(button);
  }
  document.getElementById('campaignProgress').textContent =
    `${progression.completedCount} / ${CAMPAIGN_LEVELS} COMPLETE // ${String(progression.unlockedLevel).padStart(2, '0')} UNLOCKED`;
  document.getElementById('levelPageLabel').textContent =
    `${String(first).padStart(2, '0')}–${String(last).padStart(2, '0')}`;
  document.getElementById('levelPrevious').disabled = currentPage === 0;
  document.getElementById('levelNext').disabled = currentPage === pageCount - 1;
  const detail = createLevelDefinition(selectedLevel);
  document.getElementById('selectedLevelNumber').textContent = String(selectedLevel).padStart(2, '0');
  document.getElementById('selectedLevelName').textContent = `${detail.master ? 'MASTER // ' : ''}${detail.title}`;
  document.getElementById('selectedLevelInfo').textContent =
    `DIFFICULTY ${detail.difficulty.toFixed(1)} // ${detail.requiredKills} HOSTILES // REWARD ${detail.master ? '1400+' : '400+'} SCORE`;
  const playButton = document.getElementById('playSelectedLevel');
  playButton.disabled = selectedLevel > progression.unlockedLevel;
}

function renderArmory() {
  const grid = document.getElementById('weaponGrid');
  grid.replaceChildren();
  for (const weapon of WEAPONS) {
    const unlocked = weaponManager.isUnlocked(weapon, progression);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'weapon-tile';
    button.classList.toggle('locked', !unlocked);
    button.classList.toggle('selected', weapon.id === selectedWeapon.id);
    button.disabled = !unlocked;
    button.innerHTML = `<span style="color:#${weapon.color.toString(16).padStart(6, '0')}">${weapon.icon}</span><strong>${weapon.name}</strong><small>${unlocked ? weapon.type : `UNLOCK AT LEVEL ${weapon.unlockLevel}`}</small>`;
    button.addEventListener('click', () => {
      selectedWeapon = weapon;
      renderArmory();
    });
    grid.append(button);
  }
  const weapon = selectedWeapon;
  if (weaponManager.isUnlocked(weapon, progression)) player.equipWeapon(weapon);
  document.getElementById('weaponPreview').textContent = weapon.icon;
  document.getElementById('weaponPreview').style.color = `#${weapon.color.toString(16).padStart(6, '0')}`;
  document.getElementById('weaponType').textContent = weapon.type;
  document.getElementById('weaponDetailName').textContent = weapon.name;
  document.getElementById('weaponDescription').textContent = weapon.description;
  document.getElementById('weaponStats').innerHTML =
    `<span>DAMAGE ×${weapon.damage.toFixed(2)}</span><span>REACH ×${weapon.range.toFixed(2)}</span><span>ATTACK RATE ×${(1 / weapon.cooldown).toFixed(2)}</span>`;
  const isEquipped = weapon.id === weaponManager.equippedId;
  document.getElementById('equippedWeaponName').textContent = `${WEAPONS.find((entry) => entry.id === weaponManager.equippedId)?.name || 'VOID REAVER'} EQUIPPED`;
  const equipButton = document.getElementById('equipWeaponButton');
  equipButton.textContent = isEquipped ? 'EQUIPPED' : 'EQUIP WEAPON';
  equipButton.disabled = isEquipped || !weaponManager.isUnlocked(weapon, progression);
}

function syncSettingsControls() {
  document.querySelectorAll('[data-setting]').forEach((input) => {
    const key = input.dataset.setting;
    if (input.type === 'checkbox') input.checked = settingsManager.values[key];
    else input.value = settingsManager.values[key];
  });
}

function applySettings() {
  const settings = settingsManager.values;
  audio.setVolume(settings.masterVolume, settings.sfxVolume);
  cameraController.sensitivity = settings.sensitivity;
  cameraController.followStrength = settings.cameraFollow;
  reduceFlash = settings.reducedEffects;
  document.body.classList.toggle('reduced-flash', reduceFlash);
  document.body.classList.toggle('reduced-effects', reduceFlash);
  document.body.style.setProperty('--motion-intensity', String(settings.motionBlur));
  document.getElementById('reduceFlashButton').textContent = `REDUCE FLASH / SHAKE: ${reduceFlash ? 'ON' : 'OFF'}`;
  document.getElementById('reduceFlashButton').setAttribute('aria-pressed', String(reduceFlash));
  const quality = settings.graphics;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, getPixelRatioCap(quality)));
  renderer.shadowMap.enabled = quality !== 'low' && !isMobileViewport();
  renderer.toneMappingExposure = quality === 'low' ? 1.04 : 1.12;
}

function openFrontFromPause(view) {
  isPaused = true;
  menuReturnToPause = true;
  document.body.classList.remove('screen-modal-active');
  hud.hideModal();
  setFrontView(view);
}

function completeFrontendLaunch() {
  document.getElementById('frontEnd').hidden = true;
  document.body.classList.remove('frontend-open');
  document.body.classList.remove('game-over-screen', 'victory-screen');
  document.body.classList.remove('screen-modal-active');
  inMainMenu = false;
  isPaused = false;
  screenState = 'gameplay';
  menuReturnToPause = false;
  loadingInProgress = false;
  loadingFailed = false;
  lastTime = performance.now();
}

function showLoadingProgress(percent, status, indeterminate = false) {
  document.getElementById('loadingProgress').style.width = `${percent}%`;
  document.getElementById('loadingPercent').textContent = indeterminate ? '—' : `${percent}%`;
  document.getElementById('loadingStatus').textContent = status;
}

function startLevelWithLoading(level, carryState = null, retry = false, checkpoint = null) {
  if (loadingInProgress && !retry) return false;
  if (!progression.selectLevel(level)) {
    combatFeedback.message('LEVEL LOCKED // COMPLETE THE PREVIOUS LEVEL', 1100);
    return false;
  }
  loadingInProgress = true;
  loadingFailed = false;
  loadingLevel = level;
  const definition = createLevelDefinition(level);
  const token = ++loadingToken;
  setFrontView('loading');
  document.getElementById('loadingError').hidden = true;
  document.getElementById('loadingRetry').hidden = true;
  document.getElementById('loadingMenu').hidden = true;
  document.getElementById('loadingEyebrow').textContent = definition.finalBoss
    ? 'FINAL BOSS // LEVEL 15 // DIFFICULTY 5.5 // 15 HOSTILES'
    : `LEVEL ${String(level).padStart(2, '0')} / 15 // DIFFICULTY ${definition.difficulty.toFixed(1)} // ${definition.requiredKills} HOSTILES`;
  document.getElementById('loadingTitle').textContent =
    `PREPARING LEVEL ${String(level).padStart(2, '0')} // ${definition.title}`;
  const tipIndex = level % loadingTips.length;
  document.getElementById('loadingTip').textContent = loadingTips[tipIndex];
  loadingTipTimer = 4;
  showLoadingProgress(0, 'VERIFYING CAMPAIGN ACCESS', true);
  document.querySelector('.loading-track').classList.add('indeterminate');
  requestAnimationFrame(() => {
    if (token !== loadingToken) return;
    try {
      showLoadingProgress(50, 'CAMPAIGN ACCESS VERIFIED // 1 OF 2 TASKS');
      document.querySelector('.loading-track').classList.remove('indeterminate');
      player.equipWeapon(WEAPONS.find((weapon) => weapon.id === weaponManager.equippedId) || WEAPONS[0]);
      resetGame(true, checkpoint);
      if (carryState) {
        player.health = Math.min(player.maxHealth, carryState.health);
        player.energy = Math.min(100, carryState.energy);
        player.score = carryState.score;
        defeatedEnemies = carryState.defeated;
        updateHealthHUD();
        progression.saveCheckpoint({
          ...(checkpoint || progression.checkpoint),
          level,
          waveIndex: checkpoint?.waveIndex ?? 0,
          completedKills: checkpoint?.completedKills ?? 0,
          health: player.health,
          energy: player.energy,
          score: player.score,
          defeated: defeatedEnemies
        });
      }
      isPaused = true;
      inMainMenu = true;
      showLoadingProgress(100, 'PLAYER, ARENA, AND ENCOUNTER READY // 2 OF 2 TASKS');
      requestAnimationFrame(() => {
        if (token !== loadingToken) return;
        document.getElementById('frontEnd').classList.add('leaving');
        window.setTimeout(() => {
          if (token !== loadingToken) return;
          document.getElementById('frontEnd').classList.remove('leaving');
          completeFrontendLaunch();
        }, 240);
      });
    } catch (error) {
      console.error('VOID RUNNER level initialization failed.', error);
      loadingInProgress = false;
      loadingFailed = true;
      document.querySelector('.loading-track').classList.remove('indeterminate');
      document.getElementById('loadingStatus').textContent = 'INITIALIZATION FAILED';
      document.getElementById('loadingError').hidden = false;
      document.getElementById('loadingRetry').hidden = false;
      document.getElementById('loadingMenu').hidden = false;
    }
  });
  return true;
}

function bindFrontend() {
  document.querySelectorAll('[data-view-button]').forEach((button) => {
    button.addEventListener('click', () => {
      const view = button.dataset.viewButton;
      if (view === 'home' && menuReturnToPause) {
        returnToPause();
      } else setFrontView(view);
    });
  });
  document.querySelector('[data-menu-action="start"]').addEventListener('click', () => {
    if (progression.hasProgress && !window.confirm('Start a new campaign? Existing campaign progress will be reset.')) return;
    progression.startNewCampaign();
    weaponManager.equip('void-reaver', player, progression);
    selectedLevel = 1;
    startLevelWithLoading(1);
  });
  document.querySelector('[data-menu-action="continue"]').addEventListener('click', () => {
    if (!progression.hasProgress) {
      document.getElementById('frontSaveStatus').textContent = 'NO SAVE FOUND // START A NEW CAMPAIGN?';
      if (!window.confirm('No saved campaign was found. Start a new campaign at Level 1?')) return;
      progression.startNewCampaign();
      weaponManager.equip('void-reaver', player, progression);
      selectedLevel = 1;
      startLevelWithLoading(1);
      return;
    }
    continueSavedCampaign();
  });
  document.getElementById('levelPrevious').addEventListener('click', () => {
    renderLevelSelect(levelPageIndex - 1);
  });
  document.getElementById('levelNext').addEventListener('click', () => {
    renderLevelSelect(levelPageIndex + 1);
  });
  document.getElementById('levelSearchButton').addEventListener('click', () => renderLevelSelect('search'));
  document.getElementById('levelSearch').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') renderLevelSelect('search');
  });
  document.getElementById('playSelectedLevel').addEventListener('click', () => startLevelWithLoading(selectedLevel));
  document.getElementById('equipWeaponButton').addEventListener('click', () => {
    if (!weaponManager.equip(selectedWeapon.id, player, progression)) return;
    renderArmory();
    combatFeedback.message(`${selectedWeapon.name} // EQUIPPED`, 900);
  });
  document.querySelectorAll('[data-setting]').forEach((input) => {
    input.addEventListener('input', () => {
      const value = input.type === 'checkbox' ? input.checked :
        input.type === 'range' ? Number(input.value) : input.value;
      settingsManager.set(input.dataset.setting, value);
      applySettings();
    });
  });
  document.getElementById('fullscreenButton').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.getElementById('game-root').requestFullscreen();
    } catch (error) {
      console.warn('VOID RUNNER fullscreen mode is unavailable.', error);
      combatFeedback.message('FULLSCREEN UNAVAILABLE', 900);
    }
  });
  document.getElementById('loadingRetry').addEventListener('click', () => startLevelWithLoading(loadingLevel, null, true));
  document.getElementById('loadingMenu').addEventListener('click', showMainMenu);
  hud.hideModal();
  refreshHomeMenu();
  applySettings();
  weaponManager.load(player, progression);
  setFrontView('home');
}

const bindInput = () => {
  const heldControlReleases = new Set();
  const activeTouchReleases = new Map();
  const releaseTouches = (event) => {
    for (const changedTouch of event.changedTouches) {
      const release = activeTouchReleases.get(changedTouch.identifier);
      if (!release) continue;
      activeTouchReleases.delete(changedTouch.identifier);
      release();
    }
  };
  window.addEventListener('touchend', releaseTouches, { capture: true, passive: false });
  window.addEventListener('touchcancel', releaseTouches, { capture: true, passive: false });
  const bindHoldControl = (button, onPress, onRelease) => {
    const pointerIds = new Set();
    const touchIds = new Set();
    let pressed = false;
    const syncPressedState = () => {
      const nextPressed = pointerIds.size > 0 || touchIds.size > 0;
      if (pressed === nextPressed) return;
      pressed = nextPressed;
      button.classList.toggle('pressed', pressed);
      button.setAttribute('aria-pressed', String(pressed));
      if (pressed) onPress();
      else onRelease();
    };
    const endPointer = (event) => {
      if (pointerIds.delete(event.pointerId)) syncPressedState();
    };
    const startTouch = (event) => {
      event.preventDefault();
      for (const changedTouch of event.changedTouches) {
        const id = changedTouch.identifier;
        if (touchIds.has(id)) continue;
        touchIds.add(id);
        activeTouchReleases.set(id, () => {
          touchIds.delete(id);
          syncPressedState();
        });
      }
      syncPressedState();
    };
    const clear = () => {
      pointerIds.clear();
      for (const id of touchIds) activeTouchReleases.delete(id);
      touchIds.clear();
      syncPressedState();
    };
    button.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      pointerIds.add(event.pointerId);
      if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
      syncPressedState();
    });
    button.addEventListener('pointerup', endPointer);
    button.addEventListener('pointercancel', endPointer);
    button.addEventListener('lostpointercapture', endPointer);
    button.addEventListener('touchstart', startTouch, { passive: false });
    heldControlReleases.add(clear);
    return clear;
  };

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Escape') {
      if (isPaused && menuReturnToPause) {
        returnToPause();
        return;
      }
      if (isPaused && (inMainMenu || !player.isAlive)) return;
      if (isPaused) resumeGame();
      else pauseGame();
      return;
    }
    if (event.code === 'KeyC' || event.code === 'Home') {
      cameraController.reset();
      combatFeedback.message('CAMERA RECENTERED', 700);
      return;
    }
    if (/^Digit[1-6]$/.test(event.code)) {
      event.preventDefault();
      if (isPaused) return;
      const weapon = WEAPONS[Number(event.code.slice(-1)) - 1];
      if (weaponManager.equip(weapon.id, player, progression)) {
        selectedWeapon = weapon;
        combatFeedback.message(`${weapon.name} // EQUIPPED`, 850);
      } else {
        combatFeedback.message(`${weapon.name} // UNLOCK AT LEVEL ${weapon.unlockLevel}`, 850);
      }
      return;
    }
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (keys.has(event.code)) return;
    keys.add(event.code);
    audio.init();
    if (isPaused) return;
    if (event.code === 'KeyQ') combat.performKineticStrike(player, enemies, combatFeedback);
    if (event.code === 'KeyF') combat.performEnergySlash(player, enemies, combatFeedback);
    if (event.code === 'KeyR') combat.beginVoidCharge(player);
    if (event.code === 'KeyT') combat.activateOverdrive(player, combatFeedback);
    if (event.code === 'KeyG') activateShadowClone();
    if (event.code === 'KeyV' && chainCooldown <= 0) {
      if (combat.performVoidChain(player, enemies, combatFeedback, hasClearChainPath)) {
        chainCooldown = voidChainCooldownDuration * Math.max(0.5, player.weaponConfig?.cooldown || 1);
      }
    }
    if (event.code === 'KeyX') activateKineticAnchor();
    if (event.code === 'KeyZ' && executionCooldown <= 0) {
      if (combat.performNinjaExecution(player, enemies, combatFeedback)) {
        executionCooldown = ninjaExecutionCooldownDuration * Math.max(0.5, player.weaponConfig?.cooldown || 1);
      }
    }
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
    if (event.code === 'KeyR' && !isPaused) combat.releaseVoidCharge(player, enemies, combatFeedback);
  });
  window.addEventListener('blur', () => {
    keys.clear();
    for (const release of heldControlReleases) release();
    touch.moveX = 0;
    touch.moveY = 0;
    touch.left = false;
    touch.right = false;
    touch.sprint = false;
    touch.jump = false;
    touch.slide = false;
    touch.dash = false;
    touch.charge = false;
    document.getElementById('moveKnob').style.transform = '';
    combat.cancelVoidCharge(player);
    if (!isPaused) pauseGame();
  });
  window.addEventListener('mousemove', (event) => {
    if (event.movementX || event.movementY) cameraController.addMouseLook(event.movementX || 0, event.movementY || 0);
  });

  hud.resumeButton.addEventListener('click', resumeGame);
  hud.restartButton.addEventListener('click', () => {
    if (waveState === 'complete') replayLevel();
    else startLevelWithLoading(wave);
  });
  hud.mainMenuButton.addEventListener('click', showMainMenu);
  hud.continueButton.addEventListener('click', continueCampaign);
  hud.changeWeaponButton.addEventListener('click', () => openFrontFromPause('armory'));
  hud.settingsMenuButton.addEventListener('click', () => openFrontFromPause('settings'));
  hud.cameraResetButton.addEventListener('click', () => {
    cameraController.reset();
    combatFeedback.message('CAMERA RECENTERED', 700);
  });
  hud.pauseButton.addEventListener('click', () => isPaused ? resumeGame() : pauseGame());
  hud.reduceFlashButton.addEventListener('click', () => {
    settingsManager.set('reducedEffects', !settingsManager.values.reducedEffects);
    applySettings();
  });

  const stick = document.getElementById('moveStick');
  const knob = document.getElementById('moveKnob');
  let stickPointer = null;
  const moveStick = (event) => {
    const rect = stick.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const max = rect.width * 0.34;
    const length = Math.hypot(dx, dy) || 1;
    const scale = Math.min(1, max / length);
    knob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
    touch.moveX = dx * scale / max;
    touch.moveY = -dy * scale / max;
  };
  stick.addEventListener('pointerdown', (event) => {
    stickPointer = event.pointerId;
    stick.setPointerCapture(event.pointerId);
    moveStick(event);
  });
  stick.addEventListener('pointermove', (event) => {
    if (event.pointerId === stickPointer) moveStick(event);
  });
  const endStick = (event) => {
    if (event.pointerId !== stickPointer) return;
    stickPointer = null;
    touch.moveX = 0;
    touch.moveY = 0;
    knob.style.transform = '';
  };
  stick.addEventListener('pointerup', endStick);
  stick.addEventListener('pointercancel', endStick);
  stick.addEventListener('lostpointercapture', endStick);

  document.querySelectorAll('[data-action]').forEach((button) => {
    const action = button.dataset.action;
    bindHoldControl(button, () => { touch[action] = true; }, () => { touch[action] = false; });
  });

  document.querySelectorAll('[data-steer]').forEach((button) => {
    const direction = button.dataset.steer;
    bindHoldControl(button, () => { touch[direction] = true; }, () => { touch[direction] = false; });
  });

  document.querySelectorAll('[data-ability]').forEach((button) => {
    const ability = button.dataset.ability;
    bindHoldControl(button, () => {
      audio.init();
      if (isPaused) return;
      if (ability === 'charge') {
        touch.charge = true;
        combat.beginVoidCharge(player);
      } else if (!isPaused && ability === 'strike') {
        combat.performKineticStrike(player, enemies, combatFeedback);
      } else if (!isPaused && ability === 'slash') {
        combat.performEnergySlash(player, enemies, combatFeedback);
      } else if (!isPaused && ability === 'overdrive') {
        combat.activateOverdrive(player, combatFeedback);
      } else if (!isPaused && ability === 'clone') {
        activateShadowClone();
      } else if (!isPaused && ability === 'chain' && chainCooldown <= 0) {
        if (combat.performVoidChain(player, enemies, combatFeedback, hasClearChainPath)) {
          chainCooldown = voidChainCooldownDuration * Math.max(0.5, player.weaponConfig?.cooldown || 1);
        }
      } else if (!isPaused && ability === 'execute' && executionCooldown <= 0) {
        if (combat.performNinjaExecution(player, enemies, combatFeedback)) {
          executionCooldown = ninjaExecutionCooldownDuration * Math.max(0.5, player.weaponConfig?.cooldown || 1);
        }
      } else if (!isPaused && ability === 'anchor') {
        activateKineticAnchor();
      }
    }, () => {
      if (ability !== 'charge') return;
      touch.charge = false;
      if (!isPaused) combat.releaseVoidCharge(player, enemies, combatFeedback);
    });
  });

  let swipePointer = null;
  window.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch' && !event.target.closest('.mobile-controls')) {
      swipePointer = event.pointerId;
      lastAimX = event.clientX;
    }
  });
  window.addEventListener('pointermove', (event) => {
    if (event.pointerId !== swipePointer) return;
    cameraController.addMouseLook((event.clientX - lastAimX) * 2.1, 0);
    lastAimX = event.clientX;
  });
  window.addEventListener('pointerup', (event) => {
    if (event.pointerId === swipePointer) swipePointer = null;
  });
  bindFrontend();
};

function pauseGame() {
  isPaused = true;
  screenState = 'pause';
  inMainMenu = false;
  document.getElementById('frontEnd').hidden = true;
  document.body.classList.remove('frontend-open');
  document.body.classList.add('screen-modal-active');
  combat.cancelVoidCharge(player);
  menuReturnToPause = false;
  hud.continueButton.style.display = 'none';
  hud.restartButton.textContent = 'RESTART LEVEL';
  hud.showModal('PAUSED', 'SYSTEM PAUSED', 'The world will wait. Catch your breath.');
}

function returnToPause() {
  document.getElementById('frontEnd').hidden = true;
  document.body.classList.remove('frontend-open');
  document.body.classList.add('screen-modal-active');
  menuReturnToPause = false;
  screenState = 'pause';
  inMainMenu = false;
  const equipped = WEAPONS.find((weapon) => weapon.id === weaponManager.equippedId) || WEAPONS[0];
  player.equipWeapon(equipped);
  hud.showModal('PAUSED', 'SYSTEM PAUSED', 'The world will wait. Catch your breath.');
}

function showMainMenu() {
  isPaused = true;
  inMainMenu = true;
  screenState = 'main-menu';
  menuReturnToPause = false;
  combat.cancelVoidCharge(player);
  document.body.classList.remove('game-over-screen', 'victory-screen');
  document.body.classList.remove('screen-modal-active');
  hud.hideModal();
  setFrontView('home');
}

function resumeGame() {
  isPaused = false;
  inMainMenu = false;
  screenState = 'gameplay';
  document.body.classList.remove('game-over-screen', 'victory-screen', 'screen-modal-active');
  document.getElementById('frontEnd').hidden = true;
  document.body.classList.remove('frontend-open');
  hud.hideModal();
  hud.restartButton.textContent = 'RESTART';
  lastTime = performance.now();
}

function resetGame(keepPaused = false, checkpoint = null) {
  for (const enemy of enemies) removeEnemy(enemy);
  enemies.length = 0;
  removeMasterArena();
  for (const entry of spawnQueue) entry.enemy.dispose();
  for (const group of encounterQueues.slice(encounterWaveIndex + 1)) {
    for (const entry of group) entry.enemy.dispose();
  }
  spawnQueue = [];
  encounterQueues = [];
  encounterWaveIndex = 0;
  for (const portal of arrivalPortals) {
    scene.remove(portal.root);
    for (const child of portal.root.children) child.material.dispose();
  }
  arrivalPortals = [];
  for (const orb of energyOrbs) removeEnergyOrb(orb);
  energyOrbs.length = 0;
  clearShadowClone();
  movementHistory = [];
  historySampleTimer = 0;
  cloneCooldown = 0;
  chainCooldown = 0;
  executionCooldown = 0;
  anchorCooldown = 0;
  anchorState = null;
  anchorLine.visible = false;
  anchorMarker.visible = false;
  movementSystem.setAnchor(null);
  damageFlashTimer = 0;
  scoreBonusTimer = 0;
  defeatedEnemies = 0;
  worldChunks.resetOrigin(scene, camera);
  keys.clear();
  for (const action of Object.keys(touch)) touch[action] = false;
  movementSystem.dashHeld = false;
  movementSystem.jumpHeld = false;
  movementSystem.slideHeld = false;
  player.reset(new THREE.Vector3(0, worldChunks.getHeight(0, 14), 14));
  player.defeatPose = false;
  player.victoryPose = false;
  combat.reset(player);
  handledDashSequence = player.dashSequence;
  player.turnInput = 0;
  cameraController.reset();
  wave = progression.currentLevel;
  waveState = 'intro';
  shake = 0;
  slowMotion = 0;
  window.clearTimeout(waveMessageTimeout);
  targetEnemy = null;
  hud.centerMessage.style.opacity = '1';
  hud.setTarget(null);
  worldChunks.update(player.root.position);
  spawnWave(wave, checkpoint);
  if (keepPaused) {
    isPaused = true;
    inMainMenu = true;
  } else {
    resumeGame();
  }
}

function activateShadowClone() {
  if (cloneCooldown > 0 || !player.isAlive || cloneState) return false;
  const samples = movementHistory.slice(-24);
  const ghostMaterial = new THREE.MeshBasicMaterial({
    color: 0xb568ff,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const root = player.root.clone(true);
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.material = ghostMaterial;
    object.castShadow = false;
    object.receiveShadow = false;
  });
  scene.add(root);
  cloneState = {
    root,
    material: ghostMaterial,
    samples: samples.length > 1 ? samples : [{
      x: player.root.position.x + worldChunks.worldOffset.x,
      z: player.root.position.z + worldChunks.worldOffset.y,
      y: player.root.position.y,
      rotation: player.root.rotation.y
    }],
    elapsed: 0,
    pathDuration: Math.max(0.18, Math.min(1.8, (samples.length - 1) * 0.08)),
    fadeDuration: 0.62
  };
  cloneCooldown = shadowCloneCooldownDuration;
  effects.burst(player.root.position.clone().add(new THREE.Vector3(0, 1.15, 0)), 0xb568ff, 12, 3.4);
  combatFeedback.message('SHADOW CLONE DEPLOYED', 1000);
  return true;
}

function hasClearChainPath(start, end) {
  const distance = Math.hypot(end.x - start.x, end.z - start.z);
  const steps = Math.ceil(distance / 1.1);
  for (let step = 1; step < steps; step++) {
    const ratio = step / steps;
    if (!worldChunks.isLocationClear(
      THREE.MathUtils.lerp(start.x, end.x, ratio),
      THREE.MathUtils.lerp(start.z, end.z, ratio),
      0.16
    )) return false;
  }
  return true;
}

function hasClearAnchorPath(start, end) {
  const distance = Math.hypot(end.x - start.x, end.z - start.z);
  const steps = Math.ceil(Math.max(0, distance - 2.2) / 1.1);
  for (let step = 1; step <= steps; step++) {
    const ratio = Math.min(1, step * 1.1 / distance);
    if (!worldChunks.isLocationClear(
      THREE.MathUtils.lerp(start.x, end.x, ratio),
      THREE.MathUtils.lerp(start.z, end.z, ratio),
      0.16
    )) return false;
  }
  return true;
}

function detachKineticAnchor(message = true) {
  if (!anchorState) return false;
  anchorState = null;
  movementSystem.setAnchor(null);
  anchorLine.visible = false;
  anchorMarker.visible = false;
  anchorCooldown = kineticAnchorCooldownDuration;
  if (message) combatFeedback.message('KINETIC ANCHOR // DETACHED', 800);
  return true;
}

function activateKineticAnchor() {
  if (anchorState) return detachKineticAnchor();
  if (anchorCooldown > 0 || player.energy < 12 || !player.isAlive) {
    combatFeedback.message(anchorCooldown > 0 ? 'ANCHOR RECHARGING' : 'ANCHOR ENERGY LOW', 700);
    return false;
  }
  const origin = player.root.position;
  let enemyTarget = null;
  let enemyDistance = 30;
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const distance = Math.hypot(enemy.root.position.x - origin.x, enemy.root.position.z - origin.z);
    if (distance < enemyDistance &&
        combat.isInForwardArc(player, enemy, 30, 0.22, 7) &&
        hasClearChainPath(origin, enemy.root.position)) {
      enemyTarget = enemy;
      enemyDistance = distance;
    }
  }
  let point = null;
  if (enemyTarget) {
    point = enemyTarget.root.position.clone().add(new THREE.Vector3(0, 1.2, 0));
  } else {
    const direction = player.facing.clone().setY(0).normalize();
    const surface = worldChunks.findAnchorPoint(origin, direction, 28);
    if (surface && hasClearAnchorPath(origin, surface)) point = surface;
  }
  if (!point) {
    combatFeedback.message('NO VALID ANCHOR // FACE A WALL OR ENEMY', 900);
    effects.burst(origin.clone().add(new THREE.Vector3(0, 1.2, 0)), 0xb568ff, 5, 2);
    return false;
  }

  const pointWorld = point.clone();
  if (enemyTarget) anchorState = { enemy: enemyTarget, pointWorld, remaining: 2.8 };
  else anchorState = { enemy: null, pointWorld: point.clone().add(new THREE.Vector3(worldChunks.worldOffset.x, 0, worldChunks.worldOffset.y)), remaining: 2.8 };
  player.energy -= 12;
  const localPoint = enemyTarget ? point : point.clone().sub(new THREE.Vector3(worldChunks.worldOffset.x, 0, worldChunks.worldOffset.y));
  const ropeLength = Math.max(4, Math.min(28, origin.distanceTo(localPoint)));
  movementSystem.setAnchor({ point: localPoint, length: ropeLength });
  anchorLine.visible = true;
  anchorMarker.visible = true;
  anchorMarker.position.copy(localPoint);
  effects.burst(origin.clone().add(new THREE.Vector3(0, 1.2, 0)), 0xb568ff, 12, 4);
  combatFeedback.message(enemyTarget ? 'KINETIC ANCHOR // ENEMY LOCK' : 'KINETIC ANCHOR // SURFACE LOCK', 900);
  return true;
}

function updateKineticAnchor(dt) {
  anchorCooldown = Math.max(0, anchorCooldown - dt);
  if (!anchorState) return;
  anchorState.remaining -= dt;
  if (anchorState.enemy && (!anchorState.enemy.alive || anchorState.enemy.defeated)) {
    detachKineticAnchor();
    return;
  }
  let point;
  if (anchorState.enemy) {
    point = anchorState.enemy.root.position.clone().add(new THREE.Vector3(0, 1.2, 0));
  } else {
    point = anchorState.pointWorld.clone().sub(new THREE.Vector3(worldChunks.worldOffset.x, 0, worldChunks.worldOffset.y));
  }
  if (anchorState.remaining <= 0 || !hasClearAnchorPath(player.root.position, point)) {
    detachKineticAnchor();
    return;
  }
  movementSystem.setAnchor({ point, length: movementSystem.anchor.length });
  anchorMarker.position.copy(point);
  const positions = anchorLine.geometry.attributes.position;
  positions.setXYZ(0, player.root.position.x, player.root.position.y + 1.2, player.root.position.z);
  positions.setXYZ(1, point.x, point.y, point.z);
  positions.needsUpdate = true;
  anchorLine.geometry.computeBoundingSphere();
}

function updateShadowClone(dt) {
  if (!cloneState) return;
  cloneState.elapsed += dt;
  const activeDuration = cloneState.pathDuration + cloneState.fadeDuration;
  if (cloneState.elapsed >= activeDuration) {
    effects.burst(cloneState.root.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xb568ff, 10, 2.8);
    clearShadowClone();
    return;
  }
  const progress = Math.min(1, cloneState.elapsed / cloneState.pathDuration);
  const sampleIndex = Math.min(
    cloneState.samples.length - 1,
    Math.floor(progress * (cloneState.samples.length - 1))
  );
  const sample = cloneState.samples[sampleIndex];
  cloneState.root.position.set(
    sample.x - worldChunks.worldOffset.x,
    sample.y,
    sample.z - worldChunks.worldOffset.y
  );
  cloneState.root.rotation.y = sample.rotation;
  cloneState.root.visible = true;
  cloneState.material.opacity = Math.max(0, 0.42 * (1 - (cloneState.elapsed - cloneState.pathDuration) / cloneState.fadeDuration));
}

function updateMovementHistory(dt) {
  historySampleTimer -= dt;
  if (historySampleTimer > 0) return;
  historySampleTimer = 0.08;
  movementHistory.push({
    x: player.root.position.x + worldChunks.worldOffset.x,
    y: player.root.position.y,
    z: player.root.position.z + worldChunks.worldOffset.y,
    rotation: player.root.rotation.y
  });
  if (movementHistory.length > 28) movementHistory.shift();
}

function updateEnergyOrbs(dt, time) {
  for (let index = energyOrbs.length - 1; index >= 0; index--) {
    const orb = energyOrbs[index];
    orb.life -= dt;
    orb.root.position.y = orb.root.userData.baseY + Math.sin(time * 3.2 + orb.root.userData.phase) * 0.18;
    orb.root.rotation.y += dt * 1.8;
    orb.root.children[1].rotation.z += dt * 1.1;
    if (orb.root.position.distanceTo(player.root.position) < 1.8) {
      if (orb.type === 'energy') {
        const recovered = Math.min(22, 100 - player.energy);
        player.energy += recovered;
        combatFeedback.message(recovered > 0 ? `ENERGY ORB // +${recovered} ENERGY` : 'ENERGY ORB // ENERGY FULL', 950);
      } else if (orb.type === 'health') {
        const recovered = healPlayer(5);
        combatFeedback.message(recovered > 0 ? `HEALTH ORB // +${recovered} HP` : 'HEALTH ORB // HP FULL', 950);
      } else {
        player.scoreMultiplierBonus = 2;
        scoreBonusTimer = 8;
        combatFeedback.message('VOID ORB // SCORE MULTIPLIER x2', 1200);
      }
      effects.burst(orb.root.position, orb.color, 12, 3.8);
      audio.play(orb.type === 'health' ? 'heal' : 'overdrive');
      removeEnergyOrb(orb);
      energyOrbs.splice(index, 1);
      continue;
    }
    if (orb.life <= 0) {
      removeEnergyOrb(orb);
      energyOrbs.splice(index, 1);
    }
  }
}

function readInput() {
  const forwardInput = Number(keys.has('KeyW') || keys.has('ArrowUp')) -
    Number(keys.has('KeyS') || keys.has('ArrowDown'));
  const sideInput = Number(keys.has('KeyD') || keys.has('ArrowRight')) -
    Number(keys.has('KeyA') || keys.has('ArrowLeft'));
  const yaw = cameraController.lookYaw;
  const forwardX = -Math.sin(yaw);
  const forwardZ = -Math.cos(yaw);
  const rightX = -Math.cos(yaw);
  const rightZ = Math.sin(yaw);
  const moveX = sideInput + Number(touch.right) - Number(touch.left) + touch.moveX;
  const moveY = forwardInput + touch.moveY;

  movementSystem.input.moveX = rightX * moveX + forwardX * moveY;
  movementSystem.input.moveY = rightZ * moveX + forwardZ * moveY;
  movementSystem.input.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight') || touch.sprint;
  movementSystem.input.jump = keys.has('Space') || touch.jump;
  movementSystem.input.slide = keys.has('ControlLeft') || keys.has('ControlRight') || touch.slide;
  movementSystem.input.dash = keys.has('KeyE') || touch.dash;
}

function updateEnemies(dt) {
  combat.resolveDashAttack(player, enemies, combatFeedback);
  for (const enemy of enemies) {
    enemy.update(dt, player, camera, getGroundHeight, worldChunks);
    if (enemy.arrivalTimer > 0) continue;
    if (enemy.breakImpact) {
      effects.burst(new THREE.Vector3(
        enemy.breakImpact.x - worldChunks.worldOffset.x,
        getGroundHeight(enemy.breakImpact.x - worldChunks.worldOffset.x, enemy.breakImpact.z - worldChunks.worldOffset.y) + 1.4,
        enemy.breakImpact.z - worldChunks.worldOffset.y
      ), 0xffad63, 16, 5);
      enemy.breakImpact = null;
    }
    if (enemy.hitCooldown <= 0) {
      const dx = enemy.root.position.x - player.root.position.x;
      const dz = enemy.root.position.z - player.root.position.z;
      const horizontal = Math.hypot(dx, dz);
      const vertical = Math.abs(enemy.root.position.y - player.root.position.y);
      const segmentX = player.root.position.x - player.previousPosition.x;
      const segmentZ = player.root.position.z - player.previousPosition.z;
      const segmentLengthSq = segmentX * segmentX + segmentZ * segmentZ;
      const along = segmentLengthSq > 0
        ? THREE.MathUtils.clamp(((enemy.root.position.x - player.previousPosition.x) * segmentX +
          (enemy.root.position.z - player.previousPosition.z) * segmentZ) / segmentLengthSq, 0, 1)
        : 0;
      const closestX = player.previousPosition.x + segmentX * along;
      const closestZ = player.previousPosition.z + segmentZ * along;
      const sweptDistance = Math.hypot(enemy.root.position.x - closestX, enemy.root.position.z - closestZ);
      const radius = 1.25 + enemy.spec.scale * 0.75;
      if (sweptDistance < radius && vertical < 3.5 * enemy.spec.scale && player.horizontalSpeed > 1.8) {
        const defeated = combat.resolvePlayerEnemyHit(player, enemy, combatFeedback);
        enemy.hitCooldown = 0.72;
        enemy.drawHealth();
        if (defeated) {
          if (enemy.type === 'colossus') {
            slowMotion = 0.4;
          }
        }
      }
    }
    combat.resolveEnemyHit(player, enemy, dt, combatFeedback);
  }

  for (let index = enemies.length - 1; index >= 0; index--) {
    const enemy = enemies[index];
    if (!enemy.alive && (!enemy.defeated || enemy.defeatTimer <= 0)) {
      removeEnemy(enemy);
      enemies.splice(index, 1);
    }
  }
}

function updateTarget() {
  camera.updateMatrixWorld();
  let best = null;
  let bestScore = Infinity;
  const projected = new THREE.Vector3();
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const worldPos = enemy.root.position.clone().add(new THREE.Vector3(0, 3.1 * enemy.spec.scale, 0));
    if (worldPos.distanceTo(camera.position) > 145) continue;
    projected.copy(worldPos).project(camera);
    if (projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1) continue;
    const centerScore = Math.hypot(projected.x, projected.y);
    if (centerScore < 0.34 && centerScore < bestScore) {
      best = { enemy, x: (projected.x * 0.5 + 0.5) * window.innerWidth, y: (-projected.y * 0.5 + 0.5) * window.innerHeight };
      bestScore = centerScore;
    }
  }
  targetEnemy = best?.enemy ?? null;
  hud.setTarget(targetEnemy, best?.x ?? 0, best?.y ?? 0);
}

function updateCamera(dt) {
  const focus = player.root.position.clone();
  focus.y += 1.3;
  cameraController.update(dt, focus, worldChunks, enemies, shake * settingsManager.values.cameraShake, reduceFlash);
  if (shake > 0) {
    shake = Math.max(0, shake - dt * 2.5);
  }
}

function updateGame(dt, time) {
  levelElapsed += dt;
  readInput();
  updateSpawnPortals(dt);
  updateWaveSpawner(dt);
  cloneCooldown = Math.max(0, cloneCooldown - dt);
  chainCooldown = Math.max(0, chainCooldown - dt);
  executionCooldown = Math.max(0, executionCooldown - dt);
  updateKineticAnchor(dt);
  if (player.comboTimer > 0) {
    player.comboTimer = Math.max(0, player.comboTimer - dt);
    if (player.comboTimer === 0) {
      player.combo = 0;
      player.scoreMultiplier = player.scoreMultiplierBonus ?? 1;
    }
  }
  if (scoreBonusTimer > 0) {
    scoreBonusTimer = Math.max(0, scoreBonusTimer - dt);
    if (scoreBonusTimer === 0) player.scoreMultiplierBonus = 1;
  }
  combat.updateAbilityCooldowns(dt, player, keys.has('KeyR') || touch.charge);
  document.body.classList.toggle('overdrive-active', player.overdriveTimer > 0);
  movementSystem.update(player, dt, worldChunks);
  document.body.classList.toggle('sprint-active', player.isSprinting);
  if (player.padBoostPending) {
    player.padBoostPending = false;
    effects.burst(player.root.position.clone().add(new THREE.Vector3(0, 0.08, 0)), 0x4adfff, 12, 4.5);
    combatFeedback.message('VECTOR PAD // MOMENTUM BOOST', 850);
  }
  if (player.dashSequence !== handledDashSequence) {
    handledDashSequence = player.dashSequence;
    combat.startDashAttack(player);
  }
  player.velocityPadCooldown = Math.max(0, player.velocityPadCooldown - dt);
  worldChunks.rebaseIfNeeded(player, scene, camera);
  worldChunks.update(player.root.position);
  updateEnemies(dt);
  beginNextEncounterWave();
  checkGameOver();
  updateMovementHistory(dt);
  updateShadowClone(dt);
  if (player.isAlive) updateEnergyOrbs(dt, time);

  if (player.isAlive && waveState === 'active' && levelKills >= levelDefinition.requiredKills) completeLevel();
  hud.showLevel(wave, levelDefinition, progression, {
    enemiesRemaining: Math.max(0, levelDefinition.requiredKills - levelKills),
    status: waveState,
    waveIndex: encounterWaveIndex + 1,
    waveCount: encounterQueues.length
  });

  player.animate(time, dt);
  player.root.updateMatrixWorld(true);
  const runRatio = THREE.MathUtils.clamp(player.horizontalSpeed / 30, 0, 1.3);
  const highSpeed = player.horizontalSpeed >= 27;
  const sprinting = player.isSprinting || player.overdriveTimer > 0;
  const trailInterval = highSpeed ? 48 : sprinting ? 68 : 115;
  if (player.horizontalSpeed > 3.2 && time - lastTrailTime > trailInterval) {
    lastTrailTime = time;
    const trailColor = highSpeed ? time % 160 < 80 ? 0xd7b3ff : 0x7af4ff : sprinting ? 0xb86dff : 0x64dfff;
    const behind = player.root.position.clone().add(new THREE.Vector3(0, 0.88, 0));
    effects.speedStreak(behind, player.facing, trailColor, runRatio);
    if (highSpeed && time - lastAfterimageTime > 95) {
      lastAfterimageTime = time;
      effects.afterimage(player.root, trailColor);
    }
    if (player.grounded && sprinting && time - lastFootprintTime > 145) {
      lastFootprintTime = time;
      const foot = player.root.position.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.26,
        0.035,
        -player.facing.z * 0.18
      ));
      effects.footprint(foot, trailColor, 0.72 + runRatio * 0.55);
    }
  }
  if (player.horizontalSpeed > 2.2 && time - lastBootParticleTime > (sprinting ? 72 : 150)) {
    lastBootParticleTime = time;
    const bootColor = highSpeed ? 0xc579ff : sprinting ? 0x7b9dff : 0x65e7ff;
    const strideSide = (Math.floor(time / 95) % 2 ? 1 : -1) * 0.18;
    effects.bootParticles(
      player.root.position.clone().add(new THREE.Vector3(strideSide, 0.12, 0)),
      bootColor,
      sprinting ? 3 : 1,
      1.5 + runRatio * 1.7
    );
  }
  if (player.landingEffectPending) {
    const strength = THREE.MathUtils.clamp(player.landingImpact / 12, 0.55, 1.8);
    effects.shockwave(player.root.position.clone(), 0x83eaff, strength);
    effects.burst(player.root.position.clone().add(new THREE.Vector3(0, 0.15, 0)), 0x8edfff, 8 + Math.round(strength * 6), 2 + strength * 2);
    player.landingEffectPending = false;
  }
  effects.update(dt);
  player.energy = Math.min(100, player.energy + dt * (player.horizontalSpeed < 1 ? 12 : 4));
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  damageFlashTimer = Math.max(0, damageFlashTimer - dt);
  if (damageFlashTimer === 0) hud.healthBar.classList.remove('damaged');
  if (player.comboTimer <= 0) {
    player.scoreMultiplier = player.scoreMultiplierBonus ?? 1;
  } else {
    player.scoreMultiplier = Math.min(8, 1 + Math.floor((player.combo - 1) / 2)) * (player.scoreMultiplierBonus ?? 1);
  }

  updateCamera(dt);
  targetRefresh -= dt;
  if (targetRefresh <= 0) {
    targetRefresh = 0.08;
    updateTarget();
  }
  hud.update(player, enemies, wave, worldChunks.worldOffset, getGroundHeight, combat, targetEnemy, defeatedEnemies, {
    cloneCooldown,
    chainCooldown,
    anchorCooldown,
    anchored: Boolean(anchorState),
    executionCooldown,
    level: wave,
    levelDefinition,
    levelState: waveState,
    waveIndex: encounterWaveIndex + 1,
    waveCount: encounterQueues.length,
    enemiesRemaining: Math.max(0, levelDefinition.requiredKills - levelKills),
    executionAvailable: executionCooldown <= 0 && enemies.some((enemy) =>
      enemy.alive && enemy.type !== 'colossus' && enemy.health <= enemy.maxHealth * EXECUTION_HEALTH_RATIO &&
      combat.isInForwardArc(player, enemy, EXECUTION_RANGE * (player.weaponConfig?.range || 1), 0.15, 3.5)
    )
  });
}

function animate(time) {
  requestAnimationFrame(animate);
  const elapsed = lastTime ? (time - lastTime) / 1000 : 0;
  lastTime = time;
  const frameDt = Math.min(elapsed, 0.04);
  if (screenState === 'loading') {
    loadingTipTimer -= frameDt;
    if (loadingTipTimer <= 0) {
      const tip = document.getElementById('loadingTip');
      const currentTipIndex = loadingTips.indexOf(tip.textContent);
      tip.textContent = loadingTips[(currentTipIndex + 1 + loadingTips.length) % loadingTips.length];
      loadingTipTimer = 4;
    }
  }
  if (!isPaused) {
    const dt = frameDt * (slowMotion > 0 ? 0.35 : 1);
    slowMotion = Math.max(0, slowMotion - frameDt);
    updateGame(dt, time / 1000);
  } else if (inMainMenu) {
    const orbit = time * 0.00011;
    player.animate(time / 1000, frameDt);
    camera.position.set(
      player.root.position.x + Math.sin(orbit) * 7.2,
      player.root.position.y + 3.05 + Math.sin(orbit * 1.8) * 0.18,
      player.root.position.z + Math.cos(orbit) * 7.2
    );
    camera.lookAt(player.root.position.x, player.root.position.y + 1.25, player.root.position.z);
  } else if (screenState === 'victory' || screenState === 'game-over') {
    player.animate(time / 1000, frameDt);
  }
  hud.updateFlash(frameDt);
  if (world.portal) {
    world.portal.rotation.z = Math.sin(time * 0.00018) * 0.035;
    world.portal.scale.setScalar(1 + Math.sin(time * 0.001) * 0.018);
  }
  if (masterArena) masterArena.rotation.y = Math.sin(time * 0.00012) * 0.012;
  renderer.render(scene, camera);
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, getPixelRatioCap(settingsManager.values.graphics)));
  renderer.shadowMap.enabled = settingsManager.values.graphics !== 'low' && !isMobileViewport();
  renderer.toneMappingExposure = settingsManager.values.graphics === 'low' ? 1.04 : 1.12;
  renderer.setSize(window.innerWidth, window.innerHeight);
}

scene.add(player.root);
player.reset(new THREE.Vector3(0, worldChunks.getHeight(0, 14), 14));
worldChunks.update(player.root.position);
cameraController.lookYaw = Math.PI;
bindInput();
weaponManager.load(player, progression);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') progression.save();
});
window.addEventListener('pagehide', () => progression.save());
window.addEventListener('resize', resize);
requestAnimationFrame(animate);
