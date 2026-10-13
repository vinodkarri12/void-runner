export const CAMPAIGN_LEVELS = 15;
export const MASTER_LEVEL_COUNT = 1;

const STORAGE_KEY = 'void-runner-campaign-v1';
const SAVE_VERSION = 2;
const ENEMIES_PER_LEVEL = [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 12, 13, 14];
const LEVEL_TITLES = [
  'REFINERY APPROACH',
  'BROKEN CAUSEWAY',
  'OUTER REFINERY',
  'HUNTER GRID',
  'ASHEN TRANSIT',
  'IRON DISTRICT',
  'FORGE PERIMETER',
  'BLACKOUT ZONE',
  'RUINED EXCHANGE',
  'CINDER YARD',
  'FALLEN INDUSTRIES',
  'VOID FRONTIER',
  'OVERLORD TERRITORY',
  'THE LAST BREACH',
  'VOID OVERLORD'
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
  const phase = safeLevel <= 3 ? 0 : safeLevel <= 6 ? 1 : safeLevel <= 9 ? 2 : safeLevel <= 12 ? 3 : 4;
  const difficulty = Number((1 + (safeLevel - 1) * 0.32).toFixed(1));
  const seed = Math.imul(safeLevel, 2654435761) >>> 0;
  const typePool = safeLevel <= 3
    ? ['scout']
    : safeLevel <= 5
      ? ['scout', 'guardian']
      : safeLevel <= 7
        ? ['scout', 'guardian', 'ranged']
        : safeLevel <= 9
          ? ['scout', 'guardian', 'ranged', 'elite']
          : ['scout', 'guardian', 'ranged', 'elite', 'elite'];
  const enemyTypes = finalBoss
    ? [
      ...Array.from({ length: 14 }, (_, index) =>
        ['guardian', 'ranged', 'elite'][(index + Math.floor(seed / 997)) % 3]
      ),
      'colossus'
    ]
    : Array.from({ length: ENEMIES_PER_LEVEL[safeLevel - 1] }, (_, index) =>
      typePool[(index * 3 + Math.floor(seed / 997)) % typePool.length]
    );
  const waves = [];
  const groupSize = safeLevel <= 3 ? 3 : safeLevel <= 7 ? 4 : 5;
  for (let index = 0; index < enemyTypes.length; index += groupSize) {
    waves.push(enemyTypes.slice(index, index + groupSize));
  }
  return {
    level: safeLevel,
    master,
    finalBoss,
    phase,
    difficulty,
    title: LEVEL_TITLES[safeLevel - 1],
    objective: finalBoss ? 'DEFEAT THE VOID OVERLORD' : 'DEFEAT ALL HOSTILES',
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
