const STORAGE_KEY = 'void-runner-weapons-v2';

export const WEAPONS = [
  {
    id: 'void-reaver',
    name: 'SHADOW KATANA',
    type: 'FORGED KATANA',
    category: 'melee',
    description: 'Forged steel shinobi katana delivering razor-sharp slashes and devastating combo finishers.',
    unlockLevel: 1,
    color: 0x00f2fe,
    damage: 1.0,
    range: 1.0,
    cooldown: 1.0,
    icon: '⚔'
  },
  {
    id: 'void-hand-cannon',
    name: 'VOID HAND CANNON',
    type: 'SHADOW FIREARM',
    category: 'ranged',
    description: 'High-velocity shinobi firearm firing condensed void rounds with explosive kinetic impact.',
    unlockLevel: 10,
    color: 0x00f2fe,
    damage: 1.25,
    range: 2.8,
    cooldown: 0.75,
    ammoMax: 6,
    icon: '⌖'
  },
  {
    id: 'void-plasma-rifle',
    name: 'SHADOW PLASMA RIFLE',
    type: 'PULSE RIFLE',
    category: 'ranged',
    description: 'Rapid-firing automatic pulse firearm for long-range crowd suppression.',
    unlockLevel: 20,
    color: 0xff3b5c,
    damage: 1.45,
    range: 3.2,
    cooldown: 0.55,
    ammoMax: 12,
    icon: '⚡'
  },
  {
    id: 'void-heavy-cannon',
    name: 'VOID DISRUPTOR CANNON',
    type: 'HEAVY ARTILLERY',
    category: 'ranged',
    description: 'Devastating heavy cannon that disintegrates armor with charged void blasts.',
    unlockLevel: 30,
    color: 0xffd166,
    damage: 2.1,
    range: 3.5,
    cooldown: 1.4,
    ammoMax: 4,
    icon: '💥'
  }
];

export class WeaponManager {
  constructor(storage = null) {
    this.storage = storage;
    if (!this.storage) {
      try {
        this.storage = globalThis.localStorage;
      } catch (_) {}
    }
    this.equippedId = 'void-reaver';
  }

  isUnlocked(weapon, progression) {
    if (!weapon || !progression) return false;
    if (weapon.unlockLevel <= 1) return true;
    // Weapon unlocks only after COMPLETING the specified level milestone
    return progression.completedLevels.has(weapon.unlockLevel) || progression.unlockedLevel > weapon.unlockLevel;
  }

  getUnlockedWeapons(progression) {
    return WEAPONS.filter((w) => this.isUnlocked(w, progression));
  }

  getEquippedWeapon() {
    return WEAPONS.find((w) => w.id === this.equippedId) || WEAPONS[0];
  }

  equip(id, player, progression) {
    const weapon = WEAPONS.find((candidate) => candidate.id === id);
    if (!weapon || !this.isUnlocked(weapon, progression)) return false;
    player.equipWeapon(weapon);
    this.equippedId = weapon.id;
    try {
      this.storage?.setItem(STORAGE_KEY, this.equippedId);
    } catch (error) {
      console.warn('VOID RUNNER equipped weapon could not be saved.', error);
    }
    return true;
  }

  toggleNextWeapon(player, progression) {
    const unlocked = this.getUnlockedWeapons(progression);
    if (unlocked.length <= 1) return null;
    const currentIndex = unlocked.findIndex((w) => w.id === this.equippedId);
    const nextIndex = (currentIndex + 1) % unlocked.length;
    const nextWeapon = unlocked[nextIndex];
    if (this.equip(nextWeapon.id, player, progression)) {
      return nextWeapon;
    }
    return null;
  }

  load(player, progression) {
    try {
      const saved = this.storage?.getItem(STORAGE_KEY);
      if (saved && this.equip(saved, player, progression)) {
        return;
      }
    } catch (error) {
      console.warn('VOID RUNNER equipped weapon could not be loaded.', error);
    }
    // Default fallback to starter katana
    this.equip('void-reaver', player, progression);
  }
}

