const STORAGE_KEY = 'void-runner-weapons-v1';

export const WEAPONS = [
  {
    id: 'void-reaver', name: 'SHADOW KATANA', type: 'FORGED KATANA',
    description: 'Forged steel katana with midnight temper line and sweeping slashes.',
    unlockLevel: 1, color: 0xb66aff, damage: 1, range: 1, cooldown: 1,
    icon: '⚔'
  },
  {
    id: 'phantom-katana', name: 'MURAMASA BLADE', type: 'QUICK KATANA',
    description: 'Quick-draw cursed katana with swift forward dash-strikes.',
    unlockLevel: 4, color: 0x50eaff, damage: 0.88, range: 1.08, cooldown: 0.68,
    icon: '╱'
  },
  {
    id: 'twin-shadow-blades', name: 'TWIN KODACHI', type: 'DUAL BLADES',
    description: 'Dual short swords trading reach for furious combination cuts.',
    unlockLevel: 7, color: 0xd86cff, damage: 0.68, range: 0.86, cooldown: 0.52,
    icon: '⚔'
  },
  {
    id: 'kinetic-gauntlets', name: 'TEKKO-KAGI CLAWS', type: 'IRON CLAWS',
    description: 'Iron ninja claw gauntlets delivering bone-crushing impact.',
    unlockLevel: 10, color: 0xff637f, damage: 1.42, range: 0.84, cooldown: 1.28,
    icon: '◈'
  },
  {
    id: 'arc-spear', name: 'SHINOBI NAGINATA', type: 'POLEARM BLADE',
    description: 'Curved samurai polearm with long reach for wide perimeter sweeps.',
    unlockLevel: 12, color: 0x7df3ff, damage: 1.16, range: 1.42, cooldown: 1.12,
    icon: '↟'
  },
  {
    id: 'orbital-drones', name: 'SHADOW KUNAI FAN', type: 'PHANTOM BLADES',
    description: 'Floating enchanted kunai blades with piercing ranged strikes.',
    unlockLevel: 14, color: 0xff62dc, damage: 0.82, range: 1, cooldown: 1,
    icon: '◎'
  }
];

export class WeaponManager {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.equippedId = 'void-reaver';
  }

  isUnlocked(weapon, progression) {
    return progression.unlockedLevel >= weapon.unlockLevel;
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

  load(player, progression) {
    try {
      const saved = this.storage?.getItem(STORAGE_KEY);
      if (saved) this.equip(saved, player, progression);
    } catch (error) {
      console.warn('VOID RUNNER equipped weapon could not be loaded.', error);
    }
  }
}
