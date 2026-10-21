export const CAMPAIGN_LEVELS = 15;
export const MASTER_LEVEL_COUNT = 1;

const STORAGE_KEY = 'void-runner-campaign-v1';
const SAVE_VERSION = 2;
const ENEMIES_PER_LEVEL = [10, 10, 10, 10, 10, 11, 11, 11, 11, 11, 12, 12, 12, 12, 12];
const LEVEL_TITLES = [
  'BAMBOO GROVE SANCTUARY',
  'TORII MIST PATH',
  'MOONLIT COURTYARD',
  'LANTERN SHRINE',
  'WHISPERING PINES GATE',
  'SHADOWED PAGODA BRIDGE',
  'OUTER CASTLE WALLS',
  'NIGHT GAUNTLET COURTYARD',
  'TRADITIONAL ROOFTOPS',
  'IRON SHINOBI BARRACKS',
  'CRIMSON MAPLE GROVE',
  'ASURA CASTLE GROUNDS',
  'SHADOW FORTRESS BREACH',
  'HALL OF FALLEN MASTERS',
  'SHADOW SHOGUN THRONE'
];

export function isMasterLevel(level) {
  return level === CAMPAIGN_LEVELS;
}

export function createLevelDefinition(level) {
  const safeLevel = Number.isFinite(level)
    ? Math.max(1, Math.min(CAMPAIGN_LEVELS, Math.floor(level)))
    : 1;
  const finalBoss = safeLevel === CAMPAIGN_LEVELS;
  const master = finalBoss;
  const phase = safeLevel <= 5 ? 0 : safeLevel <= 10 ? 1 : 2;
  const difficulty = Number((1 + (safeLevel - 1) * 0.35).toFixed(1));
  const seed = Math.imul(safeLevel, 2654435761) >>> 0;
  
  // Shinobi archetype pools matching difficulty tiers:
  // Levels 1-5 (Hard): Shadow Assassins (scout) & Heavy Ronin (guardian)
  // Levels 6-10 (Very Hard): Assassins, Heavy Ronin, and Shuriken Shinobi (ranged)
  // Levels 11-15 (Extreme): Shuriken Shinobi, Armored Samurai, and Elite Shadow Reapers (elite)
  const typePool = safeLevel <= 2
    ? ['scout', 'scout', 'guardian']
    : safeLevel <= 5
      ? ['scout', 'guardian', 'scout']
      : safeLevel <= 7
        ? ['scout', 'guardian', 'ranged']
        : safeLevel <= 10
          ? ['scout', 'guardian', 'ranged', 'elite']
          : ['guardian', 'ranged', 'elite', 'elite'];

  const totalEnemies = safeLevel <= 5 ? 10 : safeLevel <= 10 ? 11 : 12;

  let enemyTypes;
  if (finalBoss) {
    // Exactly 12 enemies for level 15: 11 elite shinobi guards + 1 Shadow Shogun boss (colossus)
    enemyTypes = [
      ...Array.from({ length: 11 }, (_, index) =>
        ['guardian', 'ranged', 'elite'][(index + Math.floor(seed / 997)) % 3]
      ),
      'colossus'
    ];
  } else {
    enemyTypes = Array.from({ length: totalEnemies }, (_, index) =>
      typePool[(index * 3 + Math.floor(seed / 997)) % typePool.length]
    );
  }

  // Coordinated group waves
  const waves = [];
  if (totalEnemies === 10) {
    // 2 waves of 5 coordinated attackers
    waves.push(enemyTypes.slice(0, 5));
    waves.push(enemyTypes.slice(5, 10));
  } else if (totalEnemies === 11) {
    // 3 waves: 4, 4, 3
    waves.push(enemyTypes.slice(0, 4));
    waves.push(enemyTypes.slice(4, 8));
    waves.push(enemyTypes.slice(8, 11));
  } else {
    // 12 enemies: 3 waves of 4 (final boss in wave 3 with elite retinue)
    waves.push(enemyTypes.slice(0, 4));
    waves.push(enemyTypes.slice(4, 8));
    waves.push(enemyTypes.slice(8, 12));
  }

  return {
    level: safeLevel,
    master,
    finalBoss,
    phase,
    difficulty,
    title: LEVEL_TITLES[safeLevel - 1],
    objective: finalBoss ? 'DEFEAT THE SHADOW SHOGUN' : 'DEFEAT ALL HOSTILE SHINOBI',
    enemyTypes,
    waves,
    requiredKills: enemyTypes.length,
    seed
  };
}

function validNumber(value, fallback, min, max) {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function normalizeCheckpoint(value, unlockedLevel) {
  if (!value || !Number.isInteger(value.level) || value.level < 1 ||
      value.level > unlockedLevel || value.level > CAMPAIGN_LEVELS) return null;
  const definition = createLevelDefinition(value.level);
  const waveIndex = Number.isInteger(value.waveIndex)
    ? Math.max(0, Math.min(definition.waves.length - 1, value.waveIndex))
    : 0;
  const maxKills = definition.requiredKills;
  const completedKills = Number.isInteger(value.completedKills)
    ? Math.max(0, Math.min(maxKills, value.completedKills))
    : 0;
  return {
    level: value.level,
    waveIndex,
    completedKills,
    health: validNumber(value.health, 100, 1, 100),
    energy: validNumber(value.energy, 100, 0, 100),
    score: validNumber(value.score, 0, 0, Number.MAX_SAFE_INTEGER),
    defeated: validNumber(value.defeated, 0, 0, Number.MAX_SAFE_INTEGER)
  };
}

export class ProgressionManager {
  constructor(storage = null) {
    this.storage = storage;
    this.unlockedLevel = 1;
    this.completedLevels = new Set();
    this.currentLevel = 1;
    this.checkpoint = null;
    this.stats = { totalKills: 0, totalScore: 0, masterLevelsCleared: 0 };
    if (!this.storage) {
      try {
        this.storage = globalThis.localStorage;
      } catch (error) {
        console.warn('VOID RUNNER local storage is unavailable; campaign progress will be session-only.', error);
      }
    }
    this.load();
  }

  load() {
    try {
      const saved = this.storage?.getItem(STORAGE_KEY);
      if (!saved) return;
      const data = JSON.parse(saved);
      if (!data || !Number.isInteger(data.unlockedLevel) || !Array.isArray(data.completedLevels)) return;
      if (Number.isInteger(data.saveVersion) && data.saveVersion > SAVE_VERSION) {
        console.warn('VOID RUNNER save is from a newer campaign version; it was left untouched.');
        return;
      }
      const legacySave = data.saveVersion !== SAVE_VERSION;
      this.unlockedLevel = Math.max(1, Math.min(CAMPAIGN_LEVELS, data.unlockedLevel));
      this.completedLevels = new Set(data.completedLevels.filter((level) =>
        Number.isInteger(level) && level >= 1 && level <= (legacySave ? CAMPAIGN_LEVELS - 1 : CAMPAIGN_LEVELS)
      ));
      if (data.stats && typeof data.stats === 'object') {
        this.stats.totalKills = Math.max(0, Number(data.stats.totalKills) || 0);
        this.stats.totalScore = Math.max(0, Number(data.stats.totalScore) || 0);
        this.stats.masterLevelsCleared = Math.min(1, Math.max(0, Number(data.stats.masterLevelsCleared) || 0));
      }
      this.checkpoint = normalizeCheckpoint(data.checkpoint, this.unlockedLevel);
      this.currentLevel = this.checkpoint?.level ??
        (Number.isInteger(data.currentLevel)
          ? Math.max(1, Math.min(this.unlockedLevel, data.currentLevel))
          : this.unlockedLevel);
    } catch (error) {
      console.warn('VOID RUNNER campaign save could not be loaded.', error);
    }
  }

  save() {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify({
        saveVersion: SAVE_VERSION,
        unlockedLevel: this.unlockedLevel,
        currentLevel: this.currentLevel,
        checkpoint: this.checkpoint,
        completedLevels: [...this.completedLevels].sort((a, b) => a - b),
        stats: this.stats
      }));
    } catch (error) {
      console.warn('VOID RUNNER campaign progress could not be saved.', error);
    }
  }

  selectLevel(level) {
    if (!Number.isInteger(level) || level < 1 || level > this.unlockedLevel) return false;
    this.currentLevel = level;
    return true;
  }

  saveCheckpoint(checkpoint) {
    const normalized = normalizeCheckpoint(checkpoint, this.unlockedLevel);
    if (!normalized) return false;
    this.checkpoint = normalized;
    this.currentLevel = normalized.level;
    this.save();
    return true;
  }

  startNewCampaign() {
    this.unlockedLevel = 1;
    this.completedLevels.clear();
    this.currentLevel = 1;
    this.checkpoint = null;
    this.stats = { totalKills: 0, totalScore: 0, masterLevelsCleared: 0 };
    this.save();
    return true;
  }

  get hasProgress() {
    return this.unlockedLevel > 1 || this.completedLevels.size > 0 || this.checkpoint !== null;
  }

  completeCurrentLevel(scoreReward = 0, nextCheckpoint = {}) {
    const completed = this.currentLevel;
    this.completedLevels.add(completed);
    if (isMasterLevel(completed)) this.stats.masterLevelsCleared = 1;
    this.stats.totalScore += Math.max(0, Math.floor(scoreReward));
    const unlockedNext = Math.min(CAMPAIGN_LEVELS, completed + 1);
    this.unlockedLevel = Math.max(this.unlockedLevel, unlockedNext);
    this.currentLevel = completed === CAMPAIGN_LEVELS ? completed : unlockedNext;
    this.checkpoint = completed === CAMPAIGN_LEVELS
      ? null
      : normalizeCheckpoint({
        level: unlockedNext,
        waveIndex: 0,
        completedKills: 0,
        health: nextCheckpoint.health,
        energy: nextCheckpoint.energy,
        score: nextCheckpoint.score,
        defeated: nextCheckpoint.defeated
      }, this.unlockedLevel);
    this.save();
    return {
      completed,
      unlocked: this.unlockedLevel,
      final: completed === CAMPAIGN_LEVELS
    };
  }

  recordKill(score = 0) {
    this.stats.totalKills++;
    this.stats.totalScore += Math.max(0, Math.floor(score));
    this.save();
  }

  get completedCount() {
    return this.completedLevels.size;
  }
}
