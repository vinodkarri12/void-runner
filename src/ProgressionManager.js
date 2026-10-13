export const CAMPAIGN_LEVELS = 1000;
export const MASTER_LEVEL_COUNT = Math.floor(CAMPAIGN_LEVELS / 5);

const STORAGE_KEY = 'void-runner-campaign-v1';

export function isMasterLevel(level) {
  return Number.isInteger(level) && level >= 1 && level <= CAMPAIGN_LEVELS && level % 5 === 0;
}

export function createLevelDefinition(level) {
  const safeLevel = Math.max(1, Math.min(CAMPAIGN_LEVELS, Math.floor(level)));
  const master = isMasterLevel(safeLevel);
  const finalBoss = safeLevel === CAMPAIGN_LEVELS;
  const phase = safeLevel < 6 ? 0 : safeLevel < 50 ? 1 : safeLevel < 200 ? 2 : safeLevel < 500 ? 3 : 4;
  const normalCount = Math.min(10, 2 + Math.floor(Math.sqrt(safeLevel) * 0.72) + phase);
  const types = safeLevel < 5
    ? ['scout', 'scout', 'guardian']
    : phase === 1
      ? ['scout', 'guardian', 'ranged']
      : phase === 2
        ? ['scout', 'guardian', 'ranged', 'elite']
        : phase === 3
          ? ['scout', 'guardian', 'ranged', 'elite', 'elite']
          : ['guardian', 'ranged', 'elite', 'scout', 'elite'];
  const seed = Math.imul(safeLevel, 2654435761) >>> 0;
  const enemyTypes = master
    ? ['colossus', ...Array.from({ length: Math.min(3, 1 + phase) }, (_, index) => types[(seed + index) % types.length])]
    : Array.from({ length: normalCount }, (_, index) => types[(seed + index * 7) % types.length]);
  const waves = master
    ? [enemyTypes.slice(1), [enemyTypes[0]]].filter((group) => group.length > 0)
    : (() => {
      const waveCount = safeLevel <= 4 ? 2 : phase < 3 ? 2 : 3;
      const groups = Array.from({ length: waveCount }, () => []);
      enemyTypes.forEach((type, index) => groups[Math.min(waveCount - 1, Math.floor(index * waveCount / enemyTypes.length))].push(type));
      return groups.filter((group) => group.length > 0);
    })();
  const difficulty = Math.min(2.4, 1 + Math.log2(safeLevel + 1) * 0.09 + phase * 0.08);
  const title = finalBoss
    ? 'THE FINAL VOID'
    : master
      ? `MASTER TRIAL ${String(safeLevel / 5).padStart(3, '0')}`
      : ['NEON ENTRY', 'BROKEN CAUSEWAY', 'OUTER RIFT', 'HUNTER GRID', 'VOID FRONTIER'][phase];
  return {
    level: safeLevel,
    master,
    finalBoss,
    phase,
    difficulty,
    title,
    objective: master ? 'DEFEAT THE MASTER AND ITS ESCORT' : 'DEFEAT ALL HOSTILES',
    enemyTypes,
    waves,
    requiredKills: enemyTypes.length,
    seed
  };
}

export class ProgressionManager {
  constructor(storage = null) {
    this.storage = storage;
    this.unlockedLevel = 1;
    this.completedLevels = new Set();
    this.currentLevel = 1;
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
      this.unlockedLevel = Math.max(1, Math.min(CAMPAIGN_LEVELS, data.unlockedLevel));
      this.completedLevels = new Set(data.completedLevels.filter((level) =>
        Number.isInteger(level) && level >= 1 && level <= CAMPAIGN_LEVELS
      ));
      if (data.stats && typeof data.stats === 'object') {
        this.stats.totalKills = Math.max(0, Number(data.stats.totalKills) || 0);
        this.stats.totalScore = Math.max(0, Number(data.stats.totalScore) || 0);
        this.stats.masterLevelsCleared = Math.max(0, Number(data.stats.masterLevelsCleared) || 0);
      }
      this.currentLevel = this.unlockedLevel;
    } catch (error) {
      console.warn('VOID RUNNER campaign save could not be loaded.', error);
    }
  }

  save() {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify({
        unlockedLevel: this.unlockedLevel,
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

  startNewCampaign() {
    this.unlockedLevel = 1;
    this.completedLevels.clear();
    this.currentLevel = 1;
    this.stats = { totalKills: 0, totalScore: 0, masterLevelsCleared: 0 };
    this.save();
    return true;
  }

  get hasProgress() {
    return this.unlockedLevel > 1 || this.completedLevels.size > 0;
  }

  completeCurrentLevel(scoreReward = 0) {
    const completed = this.currentLevel;
    this.completedLevels.add(completed);
    if (isMasterLevel(completed)) this.stats.masterLevelsCleared++;
    this.stats.totalScore += Math.max(0, Math.floor(scoreReward));
    const unlockedNext = Math.min(CAMPAIGN_LEVELS, completed + 1);
    this.unlockedLevel = Math.max(this.unlockedLevel, unlockedNext);
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
