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
import { Enemy, enemyAttackCoordinator } from './Enemy.js?campaign15a';
import { Effects } from './Effects.js';
import { AudioManager } from './AudioManager.js';
import { CameraController } from './CameraController.js?campaign15a';
import { HUD } from './HUD.js?campaign15a';
import { ProgressionManager, createLevelDefinition, CAMPAIGN_LEVELS } from './ProgressionManager.js?campaign15a';
import { WeaponManager, WEAPONS } from './WeaponManager.js?campaign15a';
import { SettingsManager } from './SettingsManager.js';
import { ControlsCustomizer } from './ControlsCustomizer.js';

const viewport = document.getElementById('viewport');
const isMobileViewport = () => (typeof window !== 'undefined') &&
  (window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 768 || ('ontouchstart' in window));
const getPixelRatioCap = (quality) => {
  const isMobile = isMobileViewport();
  if (isMobile) {
    // Sharp HD on high-res mobile displays while preventing overheating:
    // Low: 1.0 (smooth performance on low-end)
    // Medium: 1.35 (balanced performance and clarity)
    // High: Math.min(window.devicePixelRatio || 1, 2.0) (Crisp HD Retina)
    if (quality === 'low') return 1.0;
    if (quality === 'medium') return 1.35;
    return Math.min(window.devicePixelRatio || 1, 2.0);
  }
  const qualityCap = quality === 'low' ? 1.0 : quality === 'medium' ? 1.5 : 2.0;
  return Math.min(qualityCap, window.devicePixelRatio || 1);
};
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, getPixelRatioCap('high')));
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
const controlsCustomizer = new ControlsCustomizer(settingsManager);
const enemies = [];
const energyOrbs = [];
const getGroundHeight = worldChunks.getHeight.bind(worldChunks);
const keys = new Set();
const touch = {
  run: false,
  boost: false,
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
let lastFootstepSoundTime = 0;
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
  if (screenState !== 'gameplay' || !player.isAlive || player.health <= 0) return 0;
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
  if (screenState !== 'gameplay' || player.health > 0) return false;
  player.isAlive = false;
  player.velocity.set(0, 0, 0);
  player.speed = 0;
  player.horizontalSpeed = 0;
  player.movementState = 'STOPPED';
  player.attackAction = '';
  player.attackTimer = 0;
  player.defeatPose = true;
  isPaused = true;
  screenState = 'game-over';
  enemyAttackCoordinator.reset();
  document.body.classList.add('game-over-screen', 'screen-modal-active');
  document.getElementById('frontEnd').hidden = true;
  document.body.classList.remove('frontend-open');
  audio.play('game-over');
  hud.showGameOver(wave, levelDefinition);
  progression.save();
  return true;
}

function restartCurrentLevel() {
  document.body.classList.remove('game-over-screen', 'victory-screen', 'screen-modal-active');
  hud.hideModal();
  enemyAttackCoordinator.reset();
  resetGame(false);
  updateHealthHUD();
  updateMobileWeaponButton();
  resumeGame();
}

function updateMobileWeaponButton() {
  const current = weaponManager.getEquippedWeapon();
  hud.updateAttackButton(current, player);
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

const STAGE_KANJI = [
  '風林火山', // Stage 1: Wind, Forest, Fire, Mountain
  '影刃一閃', // Stage 2: Shadow Blade Flash
  '幽玄深林', // Stage 3: Deep Mystic Forest
  '鬼神降臨', // Stage 4: Demon God Descent
  '月華残影', // Stage 5: Moonlit Afterimage
  '疾風迅雷', // Stage 6: Swift Wind & Thunder
  '断金斬鉄', // Stage 7: Iron-Cutting Blade
  '冥界修羅', // Stage 8: Underworld Asura
  '紫電一閃', // Stage 9: Purple Lightning
  '万象破砕', // Stage 10: Shattering All Things
  '天翔龍閃', // Stage 11: Soaring Dragon Flash
  '夜桜落涙', // Stage 12: Night Sakura Tears
  '金剛不壊', // Stage 13: Indestructible Adamant
  '神速連斬', // Stage 14: Godspeed Flurry
  '天下無双'  // Stage 15: Peerless Under Heaven
];

let introTimerId = null;
let finalCompletionTimer = null;

function startLevelIntroSequence(definition) {
  if (introTimerId) {
    clearTimeout(introTimerId);
    introTimerId = null;
  }

  waveState = 'intro';

  // Ensure victory banner is hidden
  const victoryBanner = document.getElementById('cinematicVictoryBanner');
  if (victoryBanner) {
    victoryBanner.classList.remove('active');
    victoryBanner.classList.add('hidden');
  }

  const overlay = document.getElementById('levelStartOverlay');
  const eyebrow = document.getElementById('introEyebrow');
  const title = document.getElementById('introTitle');
  const kanji = document.getElementById('introKanji');
  const readyWord = document.getElementById('readyWord');
  const fightWord = document.getElementById('fightWord');

  if (overlay && eyebrow && title && kanji && readyWord && fightWord) {
    eyebrow.textContent = definition.finalBoss
      ? `MASTER LEVEL // CHAPTER ${String(wave).padStart(2, '0')} OF ${CAMPAIGN_LEVELS}`
      : `STAGE ${String(wave).padStart(2, '0')} // SANCTUARY TRIAL`;
    title.textContent = definition.finalBoss ? `MASTER // ${definition.title}` : (definition.title || `STAGE ${wave}`);
    kanji.textContent = definition.finalBoss ? '極意覇者' : STAGE_KANJI[(wave - 1) % STAGE_KANJI.length];

    readyWord.classList.remove('hidden');
    fightWord.classList.add('hidden');
    overlay.classList.remove('hidden');
    overlay.classList.add('active');
  }

  // Camera reveal: crane sweep down from above
  cameraController.startIntro(1.6);

  // Atmospheric Sakura petals & energy particles around player
  effects.burst(player.root.position.clone().add(new THREE.Vector3(0, 1.8, 0)), definition.finalBoss ? 0xff476d : 0xffa4be, 24, 4.2);
  effects.burst(player.root.position.clone().add(new THREE.Vector3(0, 0.4, 0)), definition.finalBoss ? 0xffd166 : 0x48ffb8, 16, 2.5);
  audio.play(definition.finalBoss ? 'master-intro' : 'charge');

  // Step 1: After 0.85s, switch from READY to FIGHT!
  introTimerId = setTimeout(() => {
    if (readyWord && fightWord) {
      readyWord.classList.add('hidden');
      fightWord.classList.remove('hidden');
    }
    audio.play('sword-finisher');
    effects.shockwave(player.root.position, 0x00f2fe, 1.4);
    effects.burst(player.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 0x00f2fe, 20, 3.8);

    // Step 2: After another 0.6s (total ~1.45s), dismiss overlay and activate combat!
    introTimerId = setTimeout(() => {
      if (overlay) {
        overlay.classList.remove('active');
        overlay.classList.add('hidden');
      }
      waveState = 'spawning';
      introTimerId = null;
    }, 600);
  }, 850);
}

function triggerFinalKillCinematic(finalEnemy = null) {
  if (waveState === 'completing' || waveState === 'complete') return;
  waveState = 'completing';

  // 1. Slow time dramatically
  slowMotion = 1.35;
  shake = 0.55;

  // 2. Dramatic weapon impact & particles
  const impactPos = finalEnemy
    ? finalEnemy.root.position.clone().add(new THREE.Vector3(0, 1.5 * (finalEnemy.spec?.scale || 1), 0))
    : player.root.position.clone().add(new THREE.Vector3(0, 1.5, 0));

  effects.burst(impactPos, 0xffd166, 36, 7.5);
  effects.burst(impactPos, 0xff3b5c, 28, 5.0);
  effects.shockwave(impactPos, 0xffd166, 3.2);
  effects.floatingText(impactPos.clone().add(new THREE.Vector3(0, 1.2, 0)), 'FINAL HIT // 一撃必殺', '#ffd166');

  // 3. Audio impact
  audio.play('sword-finisher');
  audio.play('hit-heavy');

  // 4. Freeze remaining enemy spawns and actions
  spawnQueue.length = 0;

  // 5. Trigger Cinematic Victory Banner
  const banner = document.getElementById('cinematicVictoryBanner');
  if (banner) {
    const kanjiEl = banner.querySelector('.cinematic-victory-kanji');
    const titleEl = banner.querySelector('.cinematic-victory-title');
    const subEl = document.getElementById('victorySubtitle');
    if (kanjiEl) kanjiEl.textContent = levelDefinition.finalBoss ? '覇者撃破' : '完全勝利';
    if (titleEl) titleEl.textContent = levelDefinition.finalBoss ? 'MASTER DEFEATED' : 'STAGE CLEARED';
    if (subEl) subEl.textContent = levelDefinition.finalBoss
      ? 'THE SHADOW SHOGUN HAS FALLEN // CAMPAIGN VICTORY'
      : `ALL ${levelDefinition.requiredKills} HOSTILES ELIMINATED // SHINOBI TRIUMPH`;
    banner.classList.remove('hidden');
    banner.classList.add('active');
  }
  if (levelDefinition.finalBoss) {
    audio.play('master-defeat');
  }

  // 6. After the slow-motion cinematic plays (1.4s), transition to the results card!
  if (finalCompletionTimer) clearTimeout(finalCompletionTimer);
  finalCompletionTimer = setTimeout(() => {
    finalCompletionTimer = null;
    if (banner) {
      banner.classList.remove('active');
      banner.classList.add('hidden');
    }
    completeLevel();
  }, 1400);
}

function handleEnemyKill(enemy) {
  if (enemy.killRewardHandled) return 0;
  enemy.killRewardHandled = true;
  defeatedEnemies++;
  levelKills++;
  progression.recordKill(enemy.scoreReward || 0);

  // Restore exactly 30 HP on every enemy death (respects player.maxHealth = 200)
  const healed = healPlayer(30);
  const healPosition = player.root.position.clone().add(new THREE.Vector3(0, 1.4, 0));

  // Small +30 HP notification and healing effect near the player
  effects.burst(healPosition, 0x48ffb8, 18, 3.8);
  effects.shockwave(player.root.position, 0x3dffaa, 1.0);
  effects.floatingText(healPosition, '+30 HP', '#48ffb8');
  audio.play('heal');

  // Immediately refresh health bar and text on HUD
  updateHealthHUD();

  if (enemy.type === 'colossus') {
    player.score += 1200;
    player.energy = Math.min(100, player.energy + 38);
    spawnEnergyOrb(enemy.root.position, true);
    combatFeedback.slowMotion(0.42);
    combatFeedback.message(`+30 HP // ${enemy.isFinalBoss ? 'SHADOW SHOGUN' : 'SHINOBI WARLORD'} DEFEATED`, 1600);
  } else {
    spawnEnergyOrb(enemy.root.position);
    combatFeedback.message(healed > 0 ? '+30 HP // HOSTILE DEFEATED' : '+30 HP // MAX HP REACHED', 900);
  }

  // Check if this was the final required enemy!
  const allOtherEnemiesDead = enemies.every((e) => !e.alive || e === enemy || e.killRewardHandled);
  const isFinalEnemy = (levelKills >= levelDefinition.requiredKills) &&
    (spawnQueue.length === 0 && encounterWaveIndex >= encounterQueues.length - 1) &&
    allOtherEnemiesDead;

  if (isFinalEnemy && (waveState === 'active' || waveState === 'spawning')) {
    triggerFinalKillCinematic(enemy);
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
    const healthScale = 0.85 + (wave - 1) * 0.055;
    const speedScale = 0.95 + (wave - 1) * 0.035;
    // Scaled shinobi attack damage across level groups:
    // Scaled shinobi attack damage: normal enemies deal exactly 30 HP, boss deals 42 HP
    const scaledAttackDamage = (type === 'colossus' || masterBoss) ? 42 : 30;
    const baseHealth = { scout: 76, guardian: 155, ranged: 115, elite: 240, colossus: 850 }[type] || 76;
    const baseSpeed = { scout: 4.4, guardian: 2.45, ranged: 2.95, elite: 3.3, colossus: 1.6 }[type] || 4.4;
    const options = {
      arrivalDelay: levelDefinition.finalBoss ? 1.8 : 1.05,
      arrivalDuration: levelDefinition.finalBoss ? 1.5 : 1.05,
      masterLevel: masterBoss ? wave : 0,
      isFinalBoss: levelDefinition.finalBoss && masterBoss,
      name: levelDefinition.finalBoss && masterBoss ? 'SHADOW SHOGUN' : undefined,
      spec: {
        ...(levelDefinition.finalBoss && masterBoss
          ? { scale: 2.8, health: 350, speed: 2.1, attackDamage: 42, armor: 0x221326 }
          : { health: Math.round(baseHealth * healthScale), speed: baseSpeed * speedScale,
            attackDamage: scaledAttackDamage,
            attackCooldownScale: Math.max(0.45, 1 - (wave - 1) * 0.038) })
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
  if (levelDefinition.master) audio.play('charge');
  hud.showLevel(wave, levelDefinition, progression);
  hud.centerMessage.textContent = levelDefinition.master
    ? `FINAL BATTLE // LEVEL 15 // ${levelDefinition.title}`
    : `LEVEL ${String(wave).padStart(2, '0')} // ${levelDefinition.title}`;
  hud.centerMessage.style.opacity = '1';
  window.clearTimeout(waveMessageTimeout);
  waveMessageTimeout = window.setTimeout(() => { hud.centerMessage.style.opacity = '0'; }, 2200);
  startLevelIntroSequence(levelDefinition);
  return true;
}

const removeEnemy = (enemy) => {
  if (!enemy || enemy.cleaned) return;
  enemy.cleaned = true;
  if (enemy.root) scene.remove(enemy.root);
  if (typeof enemy.dispose === 'function') {
    try { enemy.dispose(); } catch (_) {}
  }
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
  combatFeedback.message(
    levelDefinition.master && encounterWaveIndex === encounterQueues.length - 1
      ? 'SHADOW SHOGUN // BREACH DETECTED'
      : `WAVE ${encounterWaveIndex + 1} / ${encounterQueues.length} // HOSTILES INBOUND`,
    1300
  );
  return true;
}

function completeLevel() {
  if ((waveState !== 'active' && waveState !== 'completing') || levelKills < levelDefinition.requiredKills) return false;
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
      levelDefinition.finalBoss ? 'SHADOW SHOGUN // DEFEATED' : 'SHINOBI TRIAL // CLEARED',
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

  // Level Milestone Weapon Unlock (e.g. Level 10 Gun, Level 20 Rifle, Level 30 Cannon)
  if (result.unlockedWeaponMilestone) {
    const milestoneWeapon = WEAPONS.find((w) => w.unlockLevel === result.unlockedWeaponMilestone);
    if (milestoneWeapon) {
      audio.play('weapon-unlocked');
      hud.showWeaponUnlocked(milestoneWeapon, (w) => {
        weaponManager.equip(w.id, player, progression);
        updateMobileWeaponButton();
        combatFeedback.message(`${w.name} EQUIPPED`, 1000);
      }, () => {
        updateMobileWeaponButton();
      });
    }
  }

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
    ? 'CAMPAIGN COMPLETE // SHADOW SHOGUN DEFEATED'
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
    const isCompleted = progression.completedLevels.has(level);
    const isLocked = level > progression.unlockedLevel;
    const isCurrent = level === selectedLevel;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'level-tile';
    button.title = `${definition.title} — ${definition.master ? 'MASTER LEVEL' : `DIFFICULTY ${definition.difficulty.toFixed(1)}`}`;
    button.classList.toggle('master', definition.master);
    button.classList.toggle('complete', isCompleted);
    button.classList.toggle('current', isCurrent);
    button.classList.toggle('locked', isLocked);
    button.disabled = isLocked;

    const statusBadge = isLocked
      ? '<span class="tile-status status-locked">🔒 LOCKED</span>'
      : isCompleted
        ? '<span class="tile-status status-complete">✓ CLEARED</span>'
        : definition.master
          ? '<span class="tile-status status-master">⚔ MASTER</span>'
          : '<span class="tile-status status-ready">▶ READY</span>';

    button.innerHTML = `
      <div class="tile-header">
        <strong class="tile-num">LVL ${String(level).padStart(2, '0')}</strong>
        ${statusBadge}
      </div>
      <div class="tile-title">${definition.master ? '★ ' : ''}${definition.title}</div>
      <div class="tile-footer">
        <span>Diff ${definition.difficulty.toFixed(1)}</span>
        <span>${definition.requiredKills} Foes</span>
      </div>
    `;

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
  const isCompleted = progression.completedLevels.has(selectedLevel);
  const isLocked = selectedLevel > progression.unlockedLevel;
  const statusLabel = isLocked
    ? 'LOCKED // COMPLETE PREVIOUS LEVEL'
    : isCompleted
      ? 'CLEARED // REPLAY AVAILABLE'
      : 'UNLOCKED // IN PROGRESS';

  document.getElementById('selectedLevelNumber').textContent = String(selectedLevel).padStart(2, '0');
  document.getElementById('selectedLevelName').textContent = `${detail.master ? 'MASTER LEVEL // ' : ''}${detail.title}`;
  document.getElementById('selectedLevelInfo').textContent =
    `DIFFICULTY ${detail.difficulty.toFixed(1)} // ${detail.requiredKills} HOSTILES // STATUS: ${statusLabel}`;
  const playButton = document.getElementById('playSelectedLevel');
  playButton.textContent = isCompleted ? 'REPLAY LEVEL' : 'START LEVEL';
  playButton.disabled = isLocked;
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
  cameraController.sensitivity = settings.cameraSensitivity || settings.sensitivity || 1.0;
  cameraController.sensitivityX = settings.cameraSensitivityX || 1.0;
  cameraController.sensitivityY = settings.cameraSensitivityY || 1.0;
  cameraController.followStrength = settings.cameraFollow || 1.0;
  reduceFlash = settings.reducedEffects;
  document.body.classList.toggle('reduced-flash', reduceFlash);
  document.body.classList.toggle('reduced-effects', reduceFlash);
  document.body.style.setProperty('--motion-intensity', String(settings.motionBlur));
  document.documentElement.style.setProperty('--mobile-control-scale', String(settings.controlScale || 1));
  if (settings.hudScale) {
    document.documentElement.style.setProperty('--hud-scale', String(settings.hudScale));
  }
  hud.applyHUDVisibility(settings);
  if (settings.controlOpacity) {
    controlsCustomizer.setGlobalOpacity(settings.controlOpacity);
  }
  controlsCustomizer.applyToDOM();
  document.getElementById('reduceFlashButton').textContent = `REDUCE FLASH / SHAKE: ${reduceFlash ? 'ON' : 'OFF'}`;
  document.getElementById('reduceFlashButton').setAttribute('aria-pressed', String(reduceFlash));
  const quality = settings.graphics;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, getPixelRatioCap(quality)));
  renderer.shadowMap.enabled = quality !== 'low';
  renderer.shadowMap.type = quality === 'high' ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
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

  const errorEl = document.getElementById('loadingError');
  if (errorEl) {
    errorEl.hidden = true;
    errorEl.textContent = 'Level preparation failed. Try again.';
  }
  const retryBtn = document.getElementById('loadingRetry');
  if (retryBtn) retryBtn.hidden = true;
  const menuBtn = document.getElementById('loadingMenu');
  if (menuBtn) menuBtn.hidden = true;

  const eyebrowEl = document.getElementById('loadingEyebrow');
  if (eyebrowEl) {
    eyebrowEl.textContent = definition.finalBoss
      ? 'FINAL BOSS // LEVEL 15 // DIFFICULTY 5.5 // 15 HOSTILES'
      : `LEVEL ${String(level).padStart(2, '0')} / 15 // DIFFICULTY ${definition.difficulty.toFixed(1)} // ${definition.requiredKills} HOSTILES`;
  }
  const titleEl = document.getElementById('loadingTitle');
  if (titleEl) {
    titleEl.textContent = `PREPARING LEVEL ${String(level).padStart(2, '0')} // ${definition.title}`;
  }
  const tipIndex = level % loadingTips.length;
  const tipEl = document.getElementById('loadingTip');
  if (tipEl) tipEl.textContent = loadingTips[tipIndex];
  loadingTipTimer = 4;

  showLoadingProgress(0, 'VERIFYING CAMPAIGN ACCESS', true);
  const track = document.querySelector('.loading-track');
  if (track) track.classList.add('indeterminate');

  // Multi-phase asynchronous initialization
  requestAnimationFrame(() => {
    if (token !== loadingToken) return;
    try {
      showLoadingProgress(30, 'PREPARING SHINOBI ARSENAL // 1 OF 3');
      if (track) track.classList.remove('indeterminate');

      const equippedWeapon = WEAPONS.find((weapon) => weapon.id === weaponManager.equippedId) || WEAPONS[0];
      try {
        player.equipWeapon(equippedWeapon);
      } catch (wErr) {
        console.warn('Equipping selected weapon failed, using default katana fallback:', wErr);
        player.equipWeapon(WEAPONS[0]);
      }

      showLoadingProgress(65, 'CONSTRUCTING ARENA & HOSTILES // 2 OF 3');
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

      // Final phase: reach 100% cleanly
      showLoadingProgress(100, 'LEVEL PREPARED // ENTERING BATTLE');

      window.setTimeout(() => {
        if (token !== loadingToken) return;
        const frontEnd = document.getElementById('frontEnd');
        if (frontEnd) frontEnd.classList.add('leaving');
        window.setTimeout(() => {
          if (token !== loadingToken) return;
          if (frontEnd) frontEnd.classList.remove('leaving');
          completeFrontendLaunch();
        }, 220);
      }, 160);
    } catch (error) {
      console.error(`VOID RUNNER Level ${level} preparation failed:`, error?.message, error?.stack || error);
      loadingInProgress = false;
      loadingFailed = true;
      if (track) track.classList.remove('indeterminate');
      const statusEl = document.getElementById('loadingStatus');
      if (statusEl) statusEl.textContent = 'INITIALIZATION FAILED';
      if (errorEl) {
        errorEl.textContent = `Level preparation failed: ${error?.message || 'Initialization error'}. Try again.`;
        errorEl.hidden = false;
      }
      if (retryBtn) retryBtn.hidden = false;
      if (menuBtn) menuBtn.hidden = false;
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
    updateMobileWeaponButton();
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

  const fullscreenButtons = document.querySelectorAll('#fullscreenButton, #hudFullscreenButton');
  fullscreenButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await toggleFullscreen();
      } catch (error) {
        console.warn('VOID RUNNER fullscreen mode is unavailable.', error);
        combatFeedback.message('FULLSCREEN UNAVAILABLE', 900);
      }
    });
  });

  const lockLandscapeBtn = document.getElementById('lockLandscapeButton');
  if (lockLandscapeBtn) {
    lockLandscapeBtn.addEventListener('click', async () => {
      await lockLandscapeOrientation();
      document.body.classList.add('portrait-dismissed');
      resize();
    });
  }

  const dismissPortraitBtn = document.getElementById('dismissPortraitPrompt');
  if (dismissPortraitBtn) {
    dismissPortraitBtn.addEventListener('click', () => {
      document.body.classList.add('portrait-dismissed');
      resize();
    });
  }

  const settingsCamReset = document.getElementById('settingsResetCameraBtn');
  if (settingsCamReset) {
    settingsCamReset.addEventListener('click', (e) => {
      e.preventDefault();
      cameraController.reset();
      combatFeedback.message('CAMERA RECENTERED', 750);
    });
  }

  const settingsResetDefaults = document.getElementById('settingsResetDefaultsBtn');
  if (settingsResetDefaults) {
    settingsResetDefaults.addEventListener('click', (e) => {
      e.preventDefault();
      settingsManager.resetToDefaults();
      syncSettingsControls();
      applySettings();
      controlsCustomizer.resetToDefault();
      resize();
      combatFeedback.message('SETTINGS RESET TO DEFAULTS', 900);
    });
  }

  const retryBtn = document.getElementById('loadingRetry');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      loadingInProgress = false;
      loadingFailed = false;
      startLevelWithLoading(loadingLevel, null, true);
    });
  }
  const menuBtn = document.getElementById('loadingMenu');
  if (menuBtn) {
    menuBtn.addEventListener('click', showMainMenu);
  }
  hud.hideModal();
  refreshHomeMenu();
  applySettings();
  weaponManager.load(player, progression);
  setFrontView('home');
}

const bindInput = () => {
  const heldControlReleases = new Set();
  const bindHoldControl = (button, onPress, onRelease) => {
    const activePointers = new Set();
    const handleDown = (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      activePointers.add(event.pointerId);
      if (button.setPointerCapture) {
        try { button.setPointerCapture(event.pointerId); } catch (_) {}
      }
      button.classList.add('pressed');
      button.setAttribute('aria-pressed', 'true');
      onPress();
    };
    const handleUp = (event) => {
      if (!activePointers.has(event.pointerId)) return;
      event.preventDefault();
      event.stopPropagation();
      activePointers.delete(event.pointerId);
      if (button.releasePointerCapture) {
        try { button.releasePointerCapture(event.pointerId); } catch (_) {}
      }
      if (activePointers.size === 0) {
        button.classList.remove('pressed');
        button.setAttribute('aria-pressed', 'false');
        onRelease();
      }
    };
    button.addEventListener('pointerdown', handleDown);
    button.addEventListener('pointerup', handleUp);
    button.addEventListener('pointercancel', handleUp);
    button.addEventListener('lostpointercapture', handleUp);
    const clear = () => {
      activePointers.clear();
      button.classList.remove('pressed');
      button.setAttribute('aria-pressed', 'false');
      onRelease();
    };
    heldControlReleases.add(clear);
    return clear;
  };

  const attackBtn = document.getElementById('attackButton');
  const attackStatusBadge = document.getElementById('attackStatusBadge');
  const attackComboLabel = document.getElementById('attackComboLabel');

  const triggerEquippedAttack = () => {
    audio.init();
    if (controlsCustomizer.isEditing || isPaused || !player.isAlive || waveState === 'intro') return;
    if (player.weaponConfig?.category === 'ranged') {
      combat.performGunShot(player, enemies, combatFeedback);
      updateMobileWeaponButton();
    } else {
      const executed = combat.performKatanaCombo(player, enemies, combatFeedback);
      if (executed) {
        const step = player.comboStep;
        if (attackStatusBadge) {
          attackStatusBadge.textContent = step === 3 ? 'FINISHER!' : `COMBO ${step}`;
          attackStatusBadge.className = 'attack-status-badge ' + (step === 3 ? 'status-finisher' : 'status-combo');
        }
        if (attackComboLabel) {
          attackComboLabel.textContent = step === 3 ? 'LEAP CLEAVE' : step === 2 ? 'CROSS SLASH' : 'KATANA SLASH';
        }
      }
    }
  };
  const triggerKatanaAttack = triggerEquippedAttack;

  const triggerDashAttack = () => {
    audio.init();
    if (controlsCustomizer.isEditing || isPaused || !player.isAlive || waveState === 'intro') return;

    let moveDir = null;
    if (movementSystem.input.moveX !== 0 || movementSystem.input.moveY !== 0) {
      moveDir = new THREE.Vector3(movementSystem.input.moveX, 0, movementSystem.input.moveY).normalize();
    } else if (player.facing) {
      moveDir = player.facing.clone().setY(0).normalize();
    }

    const executed = combat.executeDashAttack(player, enemies, moveDir, combatFeedback, worldChunks);
    if (executed) {
      const dashStatusBadge = document.getElementById('dashStatusBadge');
      if (dashStatusBadge) {
        dashStatusBadge.textContent = 'DASHING';
        dashStatusBadge.className = 'dash-status-badge status-cooling';
      }
    }
  };

  // ONE Primary Dynamic Attack Button (Right side)
  if (attackBtn) {
    attackBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (controlsCustomizer.isEditing) return;
      attackBtn.classList.add('pressed');
      triggerEquippedAttack();
    });
    const endAttack = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      attackBtn.classList.remove('pressed');
    };
    attackBtn.addEventListener('pointerup', endAttack);
    attackBtn.addEventListener('pointercancel', endAttack);
    attackBtn.addEventListener('lostpointercapture', endAttack);
  }

  // Dedicated BOOST / DASH Button
  const dashAttackBtn = document.getElementById('dashAttackButton');
  if (dashAttackBtn) {
    dashAttackBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (controlsCustomizer.isEditing) return;
      dashAttackBtn.classList.add('pressed');
      triggerDashAttack();
    });
    const endDash = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      dashAttackBtn.classList.remove('pressed');
    };
    dashAttackBtn.addEventListener('pointerup', endDash);
    dashAttackBtn.addEventListener('pointercancel', endDash);
    dashAttackBtn.addEventListener('lostpointercapture', endDash);
  }

  // Dedicated JUMP Button
  const jumpBtn = document.getElementById('jumpButton');
  if (jumpBtn) {
    bindHoldControl(jumpBtn, () => {
      if (controlsCustomizer.isEditing) return;
      audio.init();
      touch.jump = true;
    }, () => {
      touch.jump = false;
    });
  }

  // Dedicated SIT / CROUCH Button
  const crouchBtn = document.getElementById('crouchButton');
  if (crouchBtn) {
    bindHoldControl(crouchBtn, () => {
      if (controlsCustomizer.isEditing) return;
      audio.init();
      touch.slide = true;
    }, () => {
      touch.slide = false;
    });
  }

  // Right-Side Camera Touch Drag Zone (Separated from buttons, prevents accidental attacks)
  const cameraTouchZone = document.getElementById('cameraTouchZone');
  let activeCameraTouchPointer = null;
  let lastCamTouchX = 0;
  let lastCamTouchY = 0;

  if (cameraTouchZone) {
    cameraTouchZone.addEventListener('pointerdown', (e) => {
      if (controlsCustomizer.isEditing || isPaused || screenState !== 'gameplay') return;
      if (activeCameraTouchPointer !== null) return;
      if (e.target.closest('button, .action-round-btn, .mobile-ability-btn, .joystick-zone, .hud-header, .left-panel, .speed-panel, .ability-panel, .campaign-panel, #overlay, #frontEnd, #controlsEditorOverlay')) {
        return;
      }
      activeCameraTouchPointer = e.pointerId;
      lastCamTouchX = e.clientX;
      lastCamTouchY = e.clientY;
      try { cameraTouchZone.setPointerCapture(e.pointerId); } catch (_) {}
    }, { passive: false });

    cameraTouchZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== activeCameraTouchPointer) return;
      const dx = e.clientX - lastCamTouchX;
      const dy = e.clientY - lastCamTouchY;
      lastCamTouchX = e.clientX;
      lastCamTouchY = e.clientY;
      cameraController.addTouchLook(dx, dy, settingsManager.values.cameraSensitivity || 1);
    }, { passive: false });

    const endCamTouch = (e) => {
      if (e && e.pointerId !== undefined && e.pointerId !== activeCameraTouchPointer) return;
      if (activeCameraTouchPointer !== null && cameraTouchZone.releasePointerCapture) {
        try { cameraTouchZone.releasePointerCapture(activeCameraTouchPointer); } catch (_) {}
      }
      activeCameraTouchPointer = null;
    };
    cameraTouchZone.addEventListener('pointerup', endCamTouch, { passive: false });
    cameraTouchZone.addEventListener('pointercancel', endCamTouch, { passive: false });
    cameraTouchZone.addEventListener('lostpointercapture', endCamTouch, { passive: false });
    heldControlReleases.add(endCamTouch);
  }

  // CONTROLS & HUD CUSTOMIZATION Overlay and Modal Triggers
  const openCustomBtn = document.getElementById('openCustomizeControlsBtn');
  if (openCustomBtn) {
    openCustomBtn.addEventListener('click', (e) => {
      e.preventDefault();
      controlsCustomizer.startCustomization();
    });
  }
  const openCustomBarBtn = document.getElementById('openCustomizeControlsBarBtn');
  if (openCustomBarBtn) {
    openCustomBarBtn.addEventListener('click', (e) => {
      e.preventDefault();
      controlsCustomizer.startCustomization();
    });
  }
  const pauseCustomBtn = document.getElementById('pauseCustomizeControlsBtn');
  if (pauseCustomBtn) {
    pauseCustomBtn.addEventListener('click', (e) => {
      e.preventDefault();
      hud.hideModal();
      controlsCustomizer.startCustomization();
    });
  }

  const editorSaveBtn = document.getElementById('editorSaveBtn');
  if (editorSaveBtn) {
    editorSaveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      controlsCustomizer.stopCustomization(true);
      if (isPaused && !inMainMenu) {
        hud.showModal('PAUSED', 'SYSTEM PAUSED', 'The world will wait. Catch your breath.');
      }
    });
  }
  const editorResetBtn = document.getElementById('editorResetBtn');
  if (editorResetBtn) {
    editorResetBtn.addEventListener('click', (e) => {
      e.preventDefault();
      controlsCustomizer.resetToDefault();
    });
  }
  const editorCancelBtn = document.getElementById('editorCancelBtn');
  if (editorCancelBtn) {
    editorCancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      controlsCustomizer.stopCustomization(false);
      if (isPaused && !inMainMenu) {
        hud.showModal('PAUSED', 'SYSTEM PAUSED', 'The world will wait. Catch your breath.');
      }
    });
  }
  const editorPresetSelect = document.getElementById('editorPresetSelect');
  if (editorPresetSelect) {
    editorPresetSelect.addEventListener('change', (e) => {
      controlsCustomizer.applyPreset(e.target.value);
    });
  }
  const editorScaleSlider = document.getElementById('editorScaleSlider');
  if (editorScaleSlider) {
    editorScaleSlider.addEventListener('input', (e) => {
      controlsCustomizer.setGlobalScale(parseFloat(e.target.value));
    });
  }
  const editorOpacitySlider = document.getElementById('editorOpacitySlider');
  if (editorOpacitySlider) {
    editorOpacitySlider.addEventListener('input', (e) => {
      controlsCustomizer.setGlobalOpacity(parseFloat(e.target.value));
    });
  }
  const editorJoySensSlider = document.getElementById('editorJoystickSensSlider');
  if (editorJoySensSlider) {
    editorJoySensSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      settingsManager.set('joystickSensitivity', val);
      const valLabel = document.getElementById('editorJoystickSensValue');
      if (valLabel) valLabel.textContent = `${val.toFixed(1)}x`;
    });
  }
  const editorElemSizeSlider = document.getElementById('editorElemSizeSlider');
  if (editorElemSizeSlider) {
    editorElemSizeSlider.addEventListener('input', (e) => {
      controlsCustomizer.setSelectedElementSize(parseFloat(e.target.value));
    });
  }

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
    if (event.code === 'Tab') {
      event.preventDefault();
      if (isPaused) return;
      const switched = weaponManager.toggleNextWeapon(player, progression);
      if (switched) {
        selectedWeapon = switched;
        audio.play('slash');
        combatFeedback.message(`${switched.name} // EQUIPPED`, 850);
        updateMobileWeaponButton();
      }
      return;
    }
    if (/^Digit[1-6]$/.test(event.code)) {
      event.preventDefault();
      if (isPaused) return;
      const weapon = WEAPONS[Number(event.code.slice(-1)) - 1];
      if (weaponManager.equip(weapon.id, player, progression)) {
        selectedWeapon = weapon;
        audio.play('slash');
        combatFeedback.message(`${weapon.name} // EQUIPPED`, 850);
        updateMobileWeaponButton();
      } else {
        combatFeedback.message(`${weapon.name} // UNLOCK AT LEVEL ${weapon.unlockLevel}`, 850);
      }
      return;
    }
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyB', 'KeyJ', 'KeyK', 'KeyE'].includes(event.code)) {
      event.preventDefault();
    }
    if (keys.has(event.code)) return;
    keys.add(event.code);
    audio.init();
    if (isPaused) return;
    if (event.code === 'KeyJ') {
      triggerEquippedAttack();
      return;
    }
    if (event.code === 'KeyE') {
      triggerDashAttack();
      return;
    }
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
    touch.run = false;
    touch.boost = false;
    touch.moveX = 0;
    touch.moveY = 0;
    touch.left = false;
    touch.right = false;
    touch.sprint = false;
    touch.jump = false;
    touch.slide = false;
    touch.dash = false;
    touch.charge = false;
    const knob = document.getElementById('moveKnob');
    if (knob) knob.style.transform = 'translate3d(0, 0, 0)';
    const stick = document.getElementById('moveStick');
    if (stick) stick.classList.remove('active');
    combat.cancelVoidCharge(player);
    if (!isPaused) pauseGame();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      keys.clear();
      for (const release of heldControlReleases) release();
      touch.run = false;
      touch.boost = false;
      touch.moveX = 0;
      touch.moveY = 0;
      touch.left = false;
      touch.right = false;
      const knob = document.getElementById('moveKnob');
      if (knob) knob.style.transform = 'translate3d(0, 0, 0)';
      const stick = document.getElementById('moveStick');
      if (stick) stick.classList.remove('active');
      if (!isPaused) pauseGame();
    }
  });
  window.addEventListener('mousemove', (event) => {
    if (event.movementX || event.movementY) cameraController.addMouseLook(event.movementX || 0, event.movementY || 0);
  });

  hud.resumeButton.addEventListener('click', resumeGame);
  hud.restartButton.addEventListener('click', () => {
    if (screenState === 'game-over') {
      restartCurrentLevel();
    } else if (waveState === 'complete') {
      replayLevel();
    } else {
      restartCurrentLevel();
    }
  });
  if (hud.levelSelectModalButton) {
    hud.levelSelectModalButton.addEventListener('click', () => {
      document.body.classList.remove('game-over-screen', 'victory-screen', 'screen-modal-active');
      hud.hideModal();
      isPaused = true;
      inMainMenu = true;
      setFrontView('levels');
    });
  }
  hud.mainMenuButton.addEventListener('click', showMainMenu);
  hud.continueButton.addEventListener('click', continueCampaign);
  hud.changeWeaponButton.addEventListener('click', () => openFrontFromPause('armory'));
  hud.settingsMenuButton.addEventListener('click', () => openFrontFromPause('settings'));
  const hudSettingsBtn = document.getElementById('hudSettingsButton');
  if (hudSettingsBtn) {
    hudSettingsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openFrontFromPause('settings');
    });
  }
  hud.cameraResetButton.addEventListener('click', () => {
    cameraController.reset();
    combatFeedback.message('CAMERA RECENTERED', 700);
  });
  const mobileCamBtn = document.getElementById('mobileCameraResetBtn');
  if (mobileCamBtn) {
    mobileCamBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      cameraController.reset();
      combatFeedback.message('CAMERA RESET', 700);
    });
  }
  hud.pauseButton.addEventListener('click', () => isPaused ? resumeGame() : pauseGame());
  hud.reduceFlashButton.addEventListener('click', () => {
    settingsManager.set('reducedEffects', !settingsManager.values.reducedEffects);
    applySettings();
  });

  const switchBtn = document.getElementById('weaponSwitchButton');
  if (switchBtn) {
    switchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (isPaused) return;
      const switched = weaponManager.toggleNextWeapon(player, progression);
      if (switched) {
        selectedWeapon = switched;
        audio.play('slash');
        combatFeedback.message(`${switched.name} // EQUIPPED`, 850);
        updateMobileWeaponButton();
      }
    });
  }

  // 1. Professional Virtual Joystick on Mobile
  const zone = document.getElementById('joystickZone');
  const stick = document.getElementById('moveStick');
  const knob = document.getElementById('moveKnob');
  let stickPointer = null;

  const processJoystick = (clientX, clientY) => {
    if (!stick || !knob) return;
    const rect = stick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const maxRadius = (rect.width / 2) * 0.75;
    const distance = Math.hypot(dx, dy);

    // Visual knob translation (strictly clamped inside circular base)
    const clampedDist = Math.min(distance, maxRadius);
    if (distance > 0.001) {
      const visualRatio = clampedDist / distance;
      knob.style.transform = `translate3d(${dx * visualRatio}px, ${dy * visualRatio}px, 0)`;
    } else {
      knob.style.transform = 'translate3d(0, 0, 0)';
    }

    // Configurable Deadzone and Sensitivity
    const normalizedDist = Math.min(1, distance / maxRadius);
    const deadzone = settingsManager.values.joystickDeadzone ?? 0.12;
    const sensitivity = settingsManager.values.joystickSensitivity ?? 1.0;

    if (normalizedDist < deadzone) {
      touch.moveX = 0;
      touch.moveY = 0;
    } else {
      const remappedStrength = (normalizedDist - deadzone) / (1 - deadzone);
      const angle = Math.atan2(dy, dx);
      // Horizontal steering (-1 left, +1 right)
      touch.moveX = THREE.MathUtils.clamp(Math.cos(angle) * remappedStrength * sensitivity, -1, 1);
      // Vertical throttle / lean (+1 forward/UP, -1 backward/DOWN)
      touch.moveY = THREE.MathUtils.clamp(-Math.sin(angle) * remappedStrength * sensitivity, -1, 1);
    }
  };

  const handleStickDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    stickPointer = event.pointerId;
    if (stick && stick.setPointerCapture) {
      try { stick.setPointerCapture(event.pointerId); } catch (_) {}
    }
    stick?.classList.add('active');
    processJoystick(event.clientX, event.clientY);
  };

  const handleStickMove = (event) => {
    if (event.pointerId !== stickPointer) return;
    event.preventDefault();
    event.stopPropagation();
    processJoystick(event.clientX, event.clientY);
  };

  const handleStickEnd = (event) => {
    if (event && event.pointerId !== undefined && stickPointer !== null && event.pointerId !== stickPointer) return;
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    stickPointer = null;
    touch.moveX = 0;
    touch.moveY = 0;
    if (knob) knob.style.transform = 'translate3d(0, 0, 0)';
    stick?.classList.remove('active');
    if (stick && event && event.pointerId !== undefined && stick.releasePointerCapture) {
      try { stick.releasePointerCapture(event.pointerId); } catch (_) {}
    }
    if (player && player.velocity && player.grounded && !touch.run) {
      player.velocity.x = 0;
      player.velocity.z = 0;
    }
  };

  if (stick) {
    stick.addEventListener('pointerdown', handleStickDown, { passive: false });
    stick.addEventListener('pointermove', handleStickMove, { passive: false });
    stick.addEventListener('pointerup', handleStickEnd, { passive: false });
    stick.addEventListener('pointercancel', handleStickEnd, { passive: false });
    stick.addEventListener('lostpointercapture', handleStickEnd, { passive: false });
  }
  if (zone) {
    zone.addEventListener('pointerdown', handleStickDown, { passive: false });
  }
  window.addEventListener('pointermove', handleStickMove, { passive: false });
  window.addEventListener('pointerup', handleStickEnd, { passive: false });
  window.addEventListener('pointercancel', handleStickEnd, { passive: false });

  heldControlReleases.add(() => {
    handleStickEnd(null);
  });

  // Optional button steering fallback if buttons exist
  const leftSteerBtn = document.getElementById('steeringLeft') || document.querySelector('[data-steer="left"]');
  const rightSteerBtn = document.getElementById('steeringRight') || document.querySelector('[data-steer="right"]');
  const activeSteerPointers = new Map();

  const syncSteerState = () => {
    let hasLeft = false;
    let hasRight = false;
    for (const dir of activeSteerPointers.values()) {
      if (dir === 'left') hasLeft = true;
      if (dir === 'right') hasRight = true;
    }
    touch.left = hasLeft;
    touch.right = hasRight;
    if (leftSteerBtn) {
      leftSteerBtn.classList.toggle('pressed', hasLeft);
      leftSteerBtn.setAttribute('aria-pressed', String(hasLeft));
    }
    if (rightSteerBtn) {
      rightSteerBtn.classList.toggle('pressed', hasRight);
      rightSteerBtn.setAttribute('aria-pressed', String(hasRight));
    }
  };

  if (leftSteerBtn) {
    leftSteerBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      activeSteerPointers.set(e.pointerId, 'left');
      syncSteerState();
    });
    const endLeft = (e) => {
      activeSteerPointers.delete(e.pointerId);
      syncSteerState();
    };
    leftSteerBtn.addEventListener('pointerup', endLeft);
    leftSteerBtn.addEventListener('pointercancel', endLeft);
  }
  if (rightSteerBtn) {
    rightSteerBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      activeSteerPointers.set(e.pointerId, 'right');
      syncSteerState();
    });
    const endRight = (e) => {
      activeSteerPointers.delete(e.pointerId);
      syncSteerState();
    };
    rightSteerBtn.addEventListener('pointerup', endRight);
    rightSteerBtn.addEventListener('pointercancel', endRight);
  }

  heldControlReleases.add(() => {
    activeSteerPointers.clear();
    syncSteerState();
  });

  // 2. Dedicated RUN Button (Hold-to-run control)
  const runBtn = document.getElementById('runButton');
  const runStatusBadge = document.getElementById('runStatusBadge');
  const runSubLabel = document.getElementById('runSubLabel');
  const activeRunPointers = new Set();

  const syncRunState = (active) => {
    touch.run = Boolean(active);
    if (runBtn) {
      runBtn.classList.toggle('pressed', active);
      runBtn.classList.toggle('is-running', active);
      runBtn.setAttribute('aria-pressed', String(active));
    }
    if (runStatusBadge) {
      runStatusBadge.textContent = active ? 'RUNNING' : 'STOPPED';
      runStatusBadge.className = 'run-status-badge ' + (active ? 'status-running' : 'status-stopped');
    }
    if (runSubLabel) {
      runSubLabel.textContent = active ? 'RELEASE TO STOP' : 'HOLD TO RUN';
    }
    const hudState = document.getElementById('hudMovementState');
    if (hudState) {
      const stateLabel = active ? (player.isBoosting ? 'BOOST' : player.isSprinting ? 'SPRINT' : 'RUNNING') : 'STOPPED';
      hudState.textContent = stateLabel;
      hudState.className = 'movement-state-badge ' + (active ? 'state-running' : 'state-stopped');
    }
    if (!active && player && player.velocity && player.grounded) {
      player.velocity.x *= 0.12;
      player.velocity.z *= 0.12;
    }
  };

  const handleRunDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    activeRunPointers.add(event.pointerId);
    if (runBtn && runBtn.setPointerCapture) {
      try { runBtn.setPointerCapture(event.pointerId); } catch (_) {}
    }
    syncRunState(true);
    audio.init();
    audio.play('run-start');
  };

  const handleRunEnd = (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      activeRunPointers.delete(event.pointerId);
      if (runBtn && runBtn.releasePointerCapture) {
        try { runBtn.releasePointerCapture(event.pointerId); } catch (_) {}
      }
    }
    if (activeRunPointers.size === 0) {
      syncRunState(false);
      audio.play('run-stop');
    }
  };

  if (runBtn) {
    runBtn.addEventListener('pointerdown', handleRunDown);
    runBtn.addEventListener('pointerup', handleRunEnd);
    runBtn.addEventListener('pointercancel', handleRunEnd);
    runBtn.addEventListener('lostpointercapture', handleRunEnd);
    runBtn.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); activeRunPointers.clear(); syncRunState(false); }, { passive: false });
    runBtn.addEventListener('touchcancel', (e) => { e.preventDefault(); e.stopPropagation(); activeRunPointers.clear(); syncRunState(false); }, { passive: false });
  }

  heldControlReleases.add(() => {
    activeRunPointers.clear();
    syncRunState(false);
  });

  // 3. Dedicated RUN BOOST Button
  const boostBtn = document.getElementById('boostButton');
  const activeBoostPointers = new Set();

  const syncBoostState = (active) => {
    touch.boost = Boolean(active);
    if (boostBtn) {
      boostBtn.classList.toggle('pressed', active);
      boostBtn.setAttribute('aria-pressed', String(active));
    }
    if (active) {
      audio.init();
      if (touch.run && player.boostEnergy > 0 && player.boostCooldownTimer <= 0) {
        audio.play('boost-start');
        combatFeedback.message('RUN BOOST ACTIVE', 450);
      }
    }
  };

  const handleBoostDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    activeBoostPointers.add(event.pointerId);
    if (boostBtn && boostBtn.setPointerCapture) {
      try { boostBtn.setPointerCapture(event.pointerId); } catch (_) {}
    }
    syncBoostState(true);
  };

  const handleBoostEnd = (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      activeBoostPointers.delete(event.pointerId);
      if (boostBtn && boostBtn.releasePointerCapture) {
        try { boostBtn.releasePointerCapture(event.pointerId); } catch (_) {}
      }
    }
    if (activeBoostPointers.size === 0) {
      syncBoostState(false);
    }
  };

  if (boostBtn) {
    boostBtn.addEventListener('pointerdown', handleBoostDown);
    boostBtn.addEventListener('pointerup', handleBoostEnd);
    boostBtn.addEventListener('pointercancel', handleBoostEnd);
    boostBtn.addEventListener('lostpointercapture', handleBoostEnd);
    boostBtn.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); activeBoostPointers.clear(); syncBoostState(false); }, { passive: false });
    boostBtn.addEventListener('touchcancel', (e) => { e.preventDefault(); e.stopPropagation(); activeBoostPointers.clear(); syncBoostState(false); }, { passive: false });
  }

  heldControlReleases.add(() => {
    activeBoostPointers.clear();
    syncBoostState(false);
  });

  document.querySelectorAll('[data-action]').forEach((button) => {
    const action = button.dataset.action;
    if (action === 'dash') {
      button.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        triggerDashAttack();
      });
    } else {
      bindHoldControl(button, () => { touch[action] = true; }, () => { touch[action] = false; });
    }
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
  bindFrontend();
};

function pauseGame() {
  isPaused = true;
  screenState = 'pause';
  inMainMenu = false;
  touch.run = false;
  touch.boost = false;
  touch.moveX = 0;
  touch.moveY = 0;
  const knob = document.getElementById('moveKnob');
  if (knob) knob.style.transform = 'translate3d(0, 0, 0)';
  const stick = document.getElementById('moveStick');
  if (stick) stick.classList.remove('active');
  const runBtn = document.getElementById('runButton');
  if (runBtn) {
    runBtn.classList.remove('pressed', 'is-running');
    runBtn.setAttribute('aria-pressed', 'false');
  }
  const boostBtn = document.getElementById('boostButton');
  if (boostBtn) {
    boostBtn.classList.remove('pressed');
    boostBtn.setAttribute('aria-pressed', 'false');
  }
  const runStatusBadge = document.getElementById('runStatusBadge');
  if (runStatusBadge) {
    runStatusBadge.textContent = 'STOPPED';
    runStatusBadge.className = 'run-status-badge status-stopped';
  }
  const runSubLabel = document.getElementById('runSubLabel');
  if (runSubLabel) runSubLabel.textContent = 'HOLD TO RUN';
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
  loadingInProgress = false;
  loadingFailed = false;
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
  resize();
}

function resetGame(keepPaused = false, checkpoint = null) {
  enemyAttackCoordinator.reset();
  for (const enemy of enemies) {
    try { removeEnemy(enemy); } catch (_) {}
  }
  enemies.length = 0;
  try { removeMasterArena(); } catch (_) {}
  for (const entry of spawnQueue) {
    try {
      if (typeof entry?.enemy?.dispose === 'function') entry.enemy.dispose();
      else if (entry?.enemy?.root) scene.remove(entry.enemy.root);
    } catch (_) {}
  }
  for (const group of encounterQueues.slice(encounterWaveIndex + 1)) {
    for (const entry of group) {
      try {
        if (typeof entry?.enemy?.dispose === 'function') entry.enemy.dispose();
        else if (entry?.enemy?.root) scene.remove(entry.enemy.root);
      } catch (_) {}
    }
  }
  spawnQueue = [];
  encounterQueues = [];
  encounterWaveIndex = 0;
  for (const portal of arrivalPortals) {
    try {
      scene.remove(portal.root);
      for (const child of portal.root.children) child.material?.dispose?.();
    } catch (_) {}
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
  const runBtn = document.getElementById('runButton');
  if (runBtn) {
    runBtn.classList.remove('pressed', 'is-running');
    runBtn.setAttribute('aria-pressed', 'false');
  }
  const runStatusBadge = document.getElementById('runStatusBadge');
  if (runStatusBadge) {
    runStatusBadge.textContent = 'STOPPED';
    runStatusBadge.className = 'run-status-badge status-stopped';
  }
  const runSubLabel = document.getElementById('runSubLabel');
  if (runSubLabel) runSubLabel.textContent = 'HOLD TO RUN';
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
  if (introTimerId) {
    clearTimeout(introTimerId);
    introTimerId = null;
  }
  if (finalCompletionTimer) {
    clearTimeout(finalCompletionTimer);
    finalCompletionTimer = null;
  }
  const levelStartOverlay = document.getElementById('levelStartOverlay');
  if (levelStartOverlay) {
    levelStartOverlay.classList.remove('active');
    levelStartOverlay.classList.add('hidden');
  }
  const victoryBanner = document.getElementById('cinematicVictoryBanner');
  if (victoryBanner) {
    victoryBanner.classList.remove('active');
    victoryBanner.classList.add('hidden');
  }
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

function readInput(dt = 1 / 60) {
  if (controlsCustomizer.isEditing || waveState === 'intro' || !player.isAlive || isPaused || screenState !== 'gameplay') {
    player.isRunning = false;
    player.isBoosting = false;
    movementSystem.input.moveX = 0;
    movementSystem.input.moveY = 0;
    movementSystem.input.sprint = false;
    movementSystem.input.jump = false;
    movementSystem.input.slide = false;
    movementSystem.input.dash = false;
    return;
  }

  // Mobile Joystick input: touch.moveX (-1 left to +1 right) and touch.moveY (-1 down/backward to +1 up/forward)
  const joyDist = Math.hypot(touch.moveX, touch.moveY);
  const joystickActive = joyDist > 0.04;

  // Keyboard input (Desktop)
  const forwardKey = Number(keys.has('KeyW') || keys.has('ArrowUp'));
  const backwardKey = Number(keys.has('KeyS') || keys.has('ArrowDown'));
  const rightKey = Number(keys.has('KeyD') || keys.has('ArrowRight'));
  const leftKey = Number(keys.has('KeyA') || keys.has('ArrowLeft'));
  const keyboardActive = Boolean(forwardKey || backwardKey || rightKey || leftKey);

  // Dedicated touch RUN button
  const runButtonPressed = Boolean(touch.run);

  let inputX = 0;
  let inputY = 0;

  if (joystickActive) {
    // Joystick: UP = forward (+Y), DOWN = backward (-Y), LEFT = left (-X), RIGHT = right (+X)
    inputX = touch.moveX;
    inputY = touch.moveY;
  } else if (keyboardActive) {
    // Desktop keyboard WASD / Arrow keys
    inputX = rightKey - leftKey;
    inputY = forwardKey - backwardKey;
    const mag = Math.hypot(inputX, inputY);
    if (mag > 0.001) {
      inputX /= mag;
      inputY /= mag;
    }
  } else if (runButtonPressed) {
    // RUN button held alone without joystick -> run forward
    inputX = 0;
    inputY = 1;
  }

  const isMoving = Math.hypot(inputX, inputY) > 0.04 && player.isAlive && !isPaused && screenState === 'gameplay';
  player.isRunning = isMoving;

  // Boost: Shift key (or B) on PC, or dedicated Boost button on mobile
  const boostRequested = Boolean(
    touch.boost ||
    keys.has('ShiftLeft') || keys.has('ShiftRight') ||
    keys.has('KeyB')
  );

  const canBoost = isMoving && boostRequested && player.boostEnergy > 0 && player.boostCooldownTimer <= 0;

  if (canBoost) {
    if (!player.isBoosting) {
      audio.init();
      audio.play('boost-start');
    }
    player.isBoosting = true;
    player.boostRecoveryDelay = 0.5;
    player.boostEnergy = Math.max(0, player.boostEnergy - dt * 25);
    if (player.boostEnergy <= 0) {
      player.boostEnergy = 0;
      player.isBoosting = false;
      player.boostCooldownTimer = 1.25;
      audio.play('boost-exhaust');
      combatFeedback.message('BOOST EXHAUSTED // COOLING', 700);
    }
  } else {
    player.isBoosting = false;
    if (player.boostCooldownTimer > 0) {
      player.boostCooldownTimer = Math.max(0, player.boostCooldownTimer - dt);
    } else if (!boostRequested || !isMoving) {
      if (player.boostRecoveryDelay > 0) {
        player.boostRecoveryDelay = Math.max(0, player.boostRecoveryDelay - dt);
      } else if (player.boostEnergy < player.boostMax) {
        player.boostEnergy = Math.min(player.boostMax, player.boostEnergy + dt * 28);
      }
    }
  }

  // Camera-relative direction calculation
  // Direction must match the game camera and character orientation!
  if (isMoving) {
    const yaw = cameraController.lookYaw;
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    const rightX = -Math.cos(yaw);
    const rightZ = Math.sin(yaw);

    movementSystem.input.moveX = rightX * inputX + forwardX * inputY;
    movementSystem.input.moveY = rightZ * inputX + forwardZ * inputY;
  } else {
    movementSystem.input.moveX = 0;
    movementSystem.input.moveY = 0;
  }

  // Sprinting: when boosting OR when holding run while moving with joystick
  movementSystem.input.sprint = player.isBoosting || (runButtonPressed && joystickActive);
  movementSystem.input.jump = keys.has('Space') || keys.has('KeyK') || touch.jump;
  movementSystem.input.slide = keys.has('ControlLeft') || keys.has('ControlRight') || touch.slide;
  movementSystem.input.dash = false;
}

function updateEnemies(dt) {
  for (const enemy of enemies) {
    enemy.update(dt, player, camera, getGroundHeight, worldChunks, enemies);
    if (enemy.arrivalTimer > 0) continue;
    if (enemy.breakImpact) {
      effects.burst(new THREE.Vector3(
        enemy.breakImpact.x - worldChunks.worldOffset.x,
        getGroundHeight(enemy.breakImpact.x - worldChunks.worldOffset.x, enemy.breakImpact.z - worldChunks.worldOffset.y) + 1.4,
        enemy.breakImpact.z - worldChunks.worldOffset.y
      ), 0xffad63, 16, 5);
      enemy.breakImpact = null;
    }

    // Solid character collision detection:
    // Characters cannot walk through each other incorrectly.
    // Touching an enemy does NOT trigger an attack or deal damage.
    if (enemy.alive) {
      const dx = player.root.position.x - enemy.root.position.x;
      const dz = player.root.position.z - enemy.root.position.z;
      const horizontalDist = Math.hypot(dx, dz);
      const verticalDist = Math.abs(player.root.position.y - enemy.root.position.y);
      const enemyScale = enemy.spec?.scale || 1;
      const combinedRadius = 0.95 + 0.85 * enemyScale;

      if (horizontalDist < combinedRadius && verticalDist < 3.2 * enemyScale) {
        const overlap = combinedRadius - horizontalDist;
        const nx = horizontalDist > 0.001 ? dx / horizontalDist : Math.sin(player.root.rotation.y + Math.PI);
        const nz = horizontalDist > 0.001 ? dz / horizontalDist : Math.cos(player.root.rotation.y + Math.PI);

        if (enemy.type === 'colossus') {
          player.root.position.x += nx * overlap;
          player.root.position.z += nz * overlap;
        } else {
          player.root.position.x += nx * overlap * 0.65;
          player.root.position.z += nz * overlap * 0.65;
          enemy.root.position.x -= nx * overlap * 0.35;
          enemy.root.position.z -= nz * overlap * 0.35;
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

const cameraFocusScratch = new THREE.Vector3();
const targetWorldPosScratch = new THREE.Vector3();
const targetProjectedScratch = new THREE.Vector3();
const vScratchBehind = new THREE.Vector3();
const vScratchSpark = new THREE.Vector3();
const vScratchFoot = new THREE.Vector3();
const vScratchBoot = new THREE.Vector3();
const vScratchPad = new THREE.Vector3();
let lastOverdriveState = false;
let lastSprintState = false;
let lastBoostState = false;
let cachedDashFillEl = null;
let cachedDashBtnEl = null;
let cachedDashBadgeEl = null;
let lastDashReportedCd = -1;

function updateTarget() {
  camera.updateMatrixWorld();
  let best = null;
  let bestScore = Infinity;
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    targetWorldPosScratch.copy(enemy.root.position);
    targetWorldPosScratch.y += 3.1 * enemy.spec.scale;
    if (targetWorldPosScratch.distanceTo(camera.position) > 145) continue;
    targetProjectedScratch.copy(targetWorldPosScratch).project(camera);
    if (targetProjectedScratch.z < -1 || targetProjectedScratch.z > 1 || Math.abs(targetProjectedScratch.x) > 1 || Math.abs(targetProjectedScratch.y) > 1) continue;
    const centerScore = Math.hypot(targetProjectedScratch.x, targetProjectedScratch.y);
    if (centerScore < 0.34 && centerScore < bestScore) {
      best = { enemy, x: (targetProjectedScratch.x * 0.5 + 0.5) * window.innerWidth, y: (-targetProjectedScratch.y * 0.5 + 0.5) * window.innerHeight };
      bestScore = centerScore;
    }
  }
  targetEnemy = best?.enemy ?? null;
  hud.setTarget(targetEnemy, best?.x ?? 0, best?.y ?? 0);
}

const focus = cameraFocusScratch;
function updateCamera(dt) {
  focus.copy(player.root.position);
  focus.y += 1.3;
  cameraController.update(dt, focus, worldChunks, enemies, shake * settingsManager.values.cameraShake, reduceFlash);
  if (shake > 0) {
    shake = Math.max(0, shake - dt * 2.5);
  }
}

function updateGame(dt, time) {
  levelElapsed += dt;
  readInput(dt);
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

  // Cached DOM class toggling (avoids expensive full-DOM layout dirtying every tick)
  const odActive = player.overdriveTimer > 0;
  if (lastOverdriveState !== odActive) {
    lastOverdriveState = odActive;
    document.body.classList.toggle('overdrive-active', odActive);
  }
  movementSystem.update(player, dt, worldChunks);
  const spActive = player.isSprinting || player.isBoosting;
  if (lastSprintState !== spActive) {
    lastSprintState = spActive;
    document.body.classList.toggle('sprint-active', spActive);
  }
  const boActive = Boolean(player.isBoosting);
  if (lastBoostState !== boActive) {
    lastBoostState = boActive;
    document.body.classList.toggle('boost-active', boActive);
  }

  if (player.padBoostPending) {
    player.padBoostPending = false;
    vScratchPad.copy(player.root.position);
    vScratchPad.y += 0.08;
    effects.burst(vScratchPad, 0x4adfff, 12, 4.5);
    combatFeedback.message('VECTOR PAD // MOMENTUM BOOST', 850);
  }
  if (player.dashSequence !== handledDashSequence) {
    handledDashSequence = player.dashSequence;
    combat.startDashAttack(player);
  }
  combat.resolveDashAttack(player, enemies, combatFeedback, worldChunks);

  // Update Dash Attack cooldown HUD ring with cached DOM references
  if (!cachedDashFillEl) {
    cachedDashFillEl = document.getElementById('dashCooldownFill');
    cachedDashBtnEl = document.getElementById('dashAttackButton');
    cachedDashBadgeEl = document.getElementById('dashStatusBadge');
  }
  const cd = player.dashAttackCooldown || 0;
  if (Math.abs(cd - lastDashReportedCd) > 0.04 || (cd === 0 && lastDashReportedCd > 0)) {
    lastDashReportedCd = cd;
    if (cachedDashFillEl) {
      const ratio = THREE.MathUtils.clamp(cd / 2.2, 0, 1);
      cachedDashFillEl.style.strokeDashoffset = `${201 * ratio}px`;
    }
    if (cachedDashBtnEl) cachedDashBtnEl.classList.toggle('cooling', cd > 0);
    if (cachedDashBadgeEl) {
      cachedDashBadgeEl.textContent = cd > 0 ? `${cd.toFixed(1)}s` : 'READY';
      cachedDashBadgeEl.className = `dash-status-badge ${cd > 0 ? 'status-cooling' : 'status-ready'}`;
    }
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

  if (player.isAlive && waveState === 'active' && levelKills >= levelDefinition.requiredKills) {
    const allEnemiesCleared = enemies.every((e) => !e.alive) && spawnQueue.length === 0 && encounterWaveIndex >= encounterQueues.length - 1;
    if (allEnemiesCleared) {
      triggerFinalKillCinematic(null);
    }
  }
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
  const sprinting = player.isSprinting || player.isBoosting || player.overdriveTimer > 0;
  const trailInterval = highSpeed ? 48 : sprinting ? 68 : 115;
  if (player.horizontalSpeed > 3.2 && time - lastTrailTime > trailInterval) {
    lastTrailTime = time;
    const trailColor = player.isBoosting ? 0xffb338 : (highSpeed ? (time % 160 < 80 ? 0xd7b3ff : 0x7af4ff) : (sprinting ? 0xb86dff : 0x64dfff));
    vScratchBehind.copy(player.root.position);
    vScratchBehind.y += 0.88;
    effects.speedStreak(vScratchBehind, player.facing, trailColor, runRatio);
    if ((highSpeed || player.isBoosting) && time - lastAfterimageTime > 95) {
      lastAfterimageTime = time;
      effects.afterimage(player.root, trailColor);
    }
    if (player.isBoosting && Math.random() < 0.45) {
      vScratchSpark.set(
        player.root.position.x + (Math.random() - 0.5) * 0.6,
        player.root.position.y + 0.4 + Math.random() * 0.8,
        player.root.position.z + (Math.random() - 0.5) * 0.4
      );
      effects.burst(vScratchSpark, 0xffc44d, 3, 2.2);
    }
    if (player.grounded && sprinting && time - lastFootprintTime > 145) {
      lastFootprintTime = time;
      vScratchFoot.set(
        player.root.position.x + (Math.random() - 0.5) * 0.26,
        player.root.position.y + 0.035,
        player.root.position.z - player.facing.z * 0.18
      );
      effects.footprint(vScratchFoot, trailColor, 0.72 + runRatio * 0.55);
    }
  }
  if (player.grounded && player.horizontalSpeed > 4 && time - lastFootstepSoundTime > (sprinting ? 220 : 320)) {
    lastFootstepSoundTime = time;
    audio.play('step');
  }
  if (player.horizontalSpeed > 2.2 && time - lastBootParticleTime > (sprinting ? 72 : 150)) {
    lastBootParticleTime = time;
    const bootColor = highSpeed ? 0xc579ff : sprinting ? 0x7b9dff : 0x65e7ff;
    const strideSide = (Math.floor(time / 95) % 2 ? 1 : -1) * 0.18;
    vScratchBoot.set(
      player.root.position.x + strideSide,
      player.root.position.y + 0.12,
      player.root.position.z
    );
    effects.bootParticles(
      vScratchBoot,
      bootColor,
      sprinting ? 3 : 1,
      1.5 + runRatio * 1.7
    );
  }
  if (player.landingEffectPending) {
    const strength = THREE.MathUtils.clamp(player.landingImpact / 12, 0.55, 1.8);
    effects.shockwave(player.root.position, 0x83eaff, strength);
    vScratchBehind.copy(player.root.position);
    vScratchBehind.y += 0.15;
    effects.burst(vScratchBehind, 0x8edfff, 8 + Math.round(strength * 6), 2 + strength * 2);
    player.landingEffectPending = false;
  }
  effects.update(dt, player.root.position);
  player.energy = Math.min(100, player.energy + dt * (player.horizontalSpeed < 1 ? 12 : 4));
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  damageFlashTimer = Math.max(0, damageFlashTimer - dt);
  if (damageFlashTimer === 0) hud.healthBar.classList.remove('damaged');
  if (player.comboResetTimer <= 0) {
    const attackBadge = document.getElementById('attackStatusBadge');
    if (attackBadge && attackBadge.textContent !== 'READY') {
      attackBadge.textContent = 'READY';
      attackBadge.className = 'attack-status-badge status-ready';
      const comboLabel = document.getElementById('attackComboLabel');
      if (comboLabel) comboLabel.textContent = 'KATANA';
    }
  }
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

async function toggleFullscreen(forceState = null) {
  try {
    const isFs = Boolean(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
    const shouldEnter = forceState !== null ? forceState : !isFs;

    if (shouldEnter) {
      const root = document.getElementById('game-root') || document.documentElement;
      if (root.requestFullscreen) {
        await root.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
      } else if (root.webkitRequestFullscreen) {
        await root.webkitRequestFullscreen();
      } else if (root.msRequestFullscreen) {
        await root.msRequestFullscreen();
      }
      if (screen.orientation && typeof screen.orientation.lock === 'function') {
        await screen.orientation.lock('landscape').catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        await document.msExitFullscreen();
      }
    }
  } catch (err) {
    console.info('Fullscreen operation status:', err);
  }
  setTimeout(resize, 80);
}

async function lockLandscapeOrientation() {
  try {
    if (typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.lock === 'function') {
      await screen.orientation.lock('landscape').catch(() => {});
    }
  } catch (_) {}
  await toggleFullscreen(true);
}

// Automatically request landscape orientation on mobile devices immediately and on first user gesture
if (typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.lock === 'function') {
  try {
    screen.orientation.lock('landscape').catch(() => {});
  } catch (_) {}
}
const handleFirstMobileLandscapeTrigger = () => {
  if (isMobileViewport()) {
    lockLandscapeOrientation().catch(() => {});
  }
};
window.addEventListener('pointerdown', handleFirstMobileLandscapeTrigger, { once: true, passive: true });
window.addEventListener('touchstart', handleFirstMobileLandscapeTrigger, { once: true, passive: true });

let lastRenderWidth = 0;
let lastRenderHeight = 0;
let lastRenderDpr = 0;

function resize() {
  const width = window.innerWidth || document.documentElement.clientWidth;
  const height = window.innerHeight || document.documentElement.clientHeight;
  const isLandscape = width >= height;

  const isCoarse = window.matchMedia('(pointer: coarse)').matches;
  const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const isMobile = isCoarse || hasTouch || (width <= 820 && height <= 500) || (width <= 500);

  document.body.classList.toggle('is-landscape', isLandscape);
  document.body.classList.toggle('is-portrait', !isLandscape);
  document.body.classList.toggle('is-mobile-device', isMobile);
  document.body.classList.toggle('is-desktop-device', !isMobile);

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  const quality = settingsManager.values.graphics;
  const dpr = Math.min(window.devicePixelRatio || 1, getPixelRatioCap(quality));

  if (width !== lastRenderWidth || height !== lastRenderHeight || dpr !== lastRenderDpr) {
    lastRenderWidth = width;
    lastRenderHeight = height;
    lastRenderDpr = dpr;
    renderer.setPixelRatio(dpr);
    renderer.shadowMap.enabled = settingsManager.values.graphics !== 'low';
    renderer.shadowMap.type = settingsManager.values.graphics === 'high' ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
    renderer.toneMappingExposure = settingsManager.values.graphics === 'low' ? 1.04 : 1.12;
    renderer.setSize(width, height, true);
  }
  controlsCustomizer.applyToDOM();
}

scene.add(player.root);
player.reset(new THREE.Vector3(0, worldChunks.getHeight(0, 14), 14));
worldChunks.update(player.root.position);
cameraController.lookYaw = Math.PI;
bindInput();
weaponManager.load(player, progression);
updateMobileWeaponButton();
controlsCustomizer.applyToDOM();

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') progression.save();
});
window.addEventListener('pagehide', () => progression.save());
window.addEventListener('resize', () => {
  requestAnimationFrame(resize);
});
window.addEventListener('orientationchange', () => {
  setTimeout(resize, 60);
  setTimeout(resize, 250);
});
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    requestAnimationFrame(resize);
  });
}
if (screen.orientation) {
  screen.orientation.addEventListener('change', () => {
    setTimeout(resize, 60);
    setTimeout(resize, 250);
  });
}
document.addEventListener('fullscreenchange', () => {
  setTimeout(resize, 60);
  setTimeout(resize, 200);
});
document.addEventListener('webkitfullscreenchange', () => {
  setTimeout(resize, 60);
  setTimeout(resize, 200);
});

// Prevent unwanted browser scrolling, pull-to-refresh, or gesture navigation during gameplay
const gameRoot = document.getElementById('game-root');
if (gameRoot) {
  gameRoot.addEventListener('touchmove', (event) => {
    if (event.target.closest('.settings-scroll-box, .level-grid, .how-panels-grid, .modal-box, .weapon-grid')) {
      return;
    }
    if (event.cancelable) event.preventDefault();
  }, { passive: false });
}

// Initial sync of orientation classes and viewport
resize();
requestAnimationFrame(animate);

