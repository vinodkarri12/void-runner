import * as THREE from 'three';

const ENEMY_COLOR = '#fff2f5';
export const COMBO_RESET_SECONDS = 4.2;
export const EXECUTION_HEALTH_RATIO = 0.28;
export const EXECUTION_RANGE = 3.8;
export const VOID_CHAIN_RANGE = 24;
const DAMAGE_CONFIG = Object.freeze({
  speedReference: 30,
  speedBase: 0.45,
  speedScale: 0.62,
  speedCap: 1.6,
  attackMultipliers: Object.freeze({
    'kinetic-collision': 0,
    'kinetic-strike': 1.05,
    'void-slash': 1.15,
    'void-charge': 1.25,
    'void-chain': 0.9,
    'ninja-execution': 1,
    'katana-combo-1': 1.0,
    'katana-combo-2': 1.35,
    'katana-finisher': 1.85,
    'katana-empowered-finisher': 2.45,
    'katana-dash-slash': 1.75,
    'void-gun-shot': 1.0
  }),
  sideMultiplier: 1.25,
  rearMultiplier: 1.5,
  aerialMultiplier: 1.3,
  combinedAngleCap: 1.95,
  heavyFrontArmor: 0.76,
  bossArmoredDamage: 0.32,
  bossVulnerableDamage: 0.58
});

export class CombatSystem {
  constructor(effects, audio) {
    this.effects = effects;
    this.audio = audio;
    this.cooldowns = { strike: 0, slash: 0, charge: 0 };
    this.charging = false;
    this.chargeValue = 0;
    this.chargePulseTimer = 0;
    this.dashSequence = -1;
    this.dashHits = new Set();
    this.onEnemyDefeated = null;
  }

  reset(player) {
    this.cancelVoidCharge(player);
    this.cooldowns.strike = 0;
    this.cooldowns.slash = 0;
    this.cooldowns.charge = 0;
    this.dashSequence = player.dashSequence;
    this.dashHits.clear();
  }

  updateAbilityCooldowns(dt, player, chargeHeld) {
    for (const ability of Object.keys(this.cooldowns)) {
      this.cooldowns[ability] = Math.max(0, this.cooldowns[ability] - dt);
    }
    player.attackTimer = Math.max(0, player.attackTimer - dt);
    if (player.attackTimer <= 0) player.attackAction = '';
    player.overdriveCooldown = Math.max(0, player.overdriveCooldown - dt);

    if (this.charging) {
      if (!chargeHeld) {
        this.releaseVoidCharge(player);
      } else {
        player.attackAction = 'charge';
        player.attackDuration = 0.2;
        player.attackTimer = 0.2;
        this.chargeValue = Math.min(1, this.chargeValue + dt / 2.1);
        player.chargeLevel = this.chargeValue;
        this.chargePulseTimer -= dt;
        this.audio?.setChargeLevel(this.chargeValue);
        if (this.chargePulseTimer <= 0) {
          this.chargePulseTimer = 0.52;
          const position = player.root.position.clone();
          this.effects.chargePulse(position, this.chargeValue);
          this.effects.burst(position.add(new THREE.Vector3(0, 1.15, 0)), 0x67cfff, 5, 1.8 + this.chargeValue * 2.5);
        }
      }
    }

    if (player.overdriveTimer > 0) {
      player.overdriveTimer = Math.max(0, player.overdriveTimer - dt);
      if (player.overdriveTimer === 0) {
        player.overdriveCooldown = 2.2;
        player.overdriveExitTimer = 0.5;
        player.overdriveExitSpeed = player.horizontalSpeed;
      }
    }
    if (!player.overdriveTimer && player.overdriveCooldown <= 0) {
      player.overdriveCharge = Math.min(100, player.overdriveCharge + dt * (player.horizontalSpeed > 12 ? 6.5 : 2.2));
    }
  }

  beginVoidCharge(player) {
    if (this.charging || this.cooldowns.charge > 0 || player.energy < 20 || !player.isAlive) return false;
    this.charging = true;
    this.chargeValue = 0;
    this.chargePulseTimer = 0;
    player.chargeLevel = 0;
    player.startAttack('charge', 3);
    this.audio?.startCharge();
    return true;
  }

  releaseVoidCharge(player, enemies = [], feedback = {}) {
    if (!this.charging) return false;
    this.charging = false;
    const charge = this.chargeValue;
    this.chargeValue = 0;
    player.chargeLevel = 0;
    this.audio?.stopCharge();
    if (charge < 0.32 || !player.isAlive) {
      player.attackAction = '';
      player.attackTimer = 0;
      return false;
    }

    const energyCost = 18 + charge * 32;
    if (player.energy < energyCost) {
      player.attackAction = '';
      player.attackTimer = 0;
      return false;
    }
    player.energy -= energyCost;
    this.cooldowns.charge = 5.8 * Math.max(0.45, player.weaponConfig?.cooldown || 1);
    player.startAttack('charge', 0.52);
    const direction = player.facing.clone().setY(0).normalize();
    const blastPoint = player.root.position.clone().addScaledVector(direction, 2.8).add(new THREE.Vector3(0, 1.1, 0));
    this.effects.slashArc(blastPoint, direction, charge >= 0.98 ? 0xe3faff : 0x65bfff, 1.4 + charge * 0.8);
    this.effects.burst(blastPoint, charge >= 0.98 ? 0xdffaff : 0x63cfff, 22 + Math.round(charge * 22), 6 + charge * 7);
    this.effects.shockwave(player.root.position.clone(), charge >= 0.98 ? 0xe4fbff : 0x75caff, 2.2 + charge * 2.1);
    this.audio?.play('charge');
    if (charge >= 0.98) feedback.flash?.(0.72, true);
    if (feedback.cameraShake) feedback.cameraShake.value = Math.max(feedback.cameraShake.value, 0.55 + charge * 0.8);

    let hits = 0;
    const damage = 38 + charge * 118 + player.horizontalSpeed * (0.9 + charge * 0.45);
    for (const enemy of enemies) {
      if (!this.isInForwardArc(player, enemy, 18 * (player.weaponConfig?.range || 1), 0.35, 4.8)) continue;
      if (this.applyDamageToEnemy(player, enemy, damage, 'void-charge', feedback)) hits++;
    }
    if (hits && player.horizontalSpeed >= 18) player.score += Math.round(player.horizontalSpeed * charge * hits * 2);
    if (hits && charge >= 0.98) {
      feedback.flash?.(1, true);
      feedback.slowMotion?.(0.26);
    }
    return true;
  }

  performKineticStrike(player, enemies, feedback = {}) {
    if (this.cooldowns.strike > 0 || !player.isAlive) return false;
    const weapon = player.weaponConfig || { id: 'void-reaver', damage: 1, range: 1, cooldown: 1 };
    const cooldownScale = Math.max(0.35, weapon.cooldown || 1);
    if (weapon.id === 'orbital-drones') {
      if (player.energy < 10) {
        feedback.message?.('DRONE ENERGY LOW', 700);
        return false;
      }
      let target = null;
      let closest = 28;
      for (const enemy of enemies) {
        const distance = Math.hypot(enemy.root.position.x - player.root.position.x, enemy.root.position.z - player.root.position.z);
        if (distance < closest && this.isInForwardArc(player, enemy, 28, 0.88, 8)) {
          target = enemy;
          closest = distance;
        }
      }
      if (!target) {
        feedback.message?.('NO DRONE SHOT // FACE A TARGET', 700);
        return false;
      }
      player.energy -= 10;
      this.cooldowns.strike = 0.78;
      player.startAttack('strike', 0.25);
      const origin = player.root.position.clone().add(new THREE.Vector3(0, 1.45, 0));
      const destination = target.root.position.clone().add(new THREE.Vector3(0, target.spec.scale, 0));
      this.effects.spawnTrail(origin, weapon.color ?? 0xff62dc, 0.9);
      this.effects.burst(destination, weapon.color ?? 0xff62dc, 18, 6);
      this.audio?.play('strike');
      this.applyDamageToEnemy(player, target, 44, 'kinetic-strike', feedback);
      return true;
    }
    this.cooldowns.strike = 0.62 * cooldownScale;
    player.startAttack('strike', 0.32);
    const hand = player.weapon.getWorldPosition(new THREE.Vector3());
    this.effects.spawnTrail(hand, 0x53dfff, 0.7);
    this.audio?.play('strike');
    let hits = 0;
    const range = (3.8 + Math.min(1.2, player.horizontalSpeed * 0.04)) * (weapon.range || 1);
    const damage = 23 + Math.min(20, player.horizontalSpeed * 0.65);
    for (const enemy of enemies) {
      if (!this.isInForwardArc(player, enemy, range, 0.66, 3.6)) continue;
      if (this.applyDamageToEnemy(player, enemy, damage, 'kinetic-strike', feedback)) hits++;
    }
    if (hits) {
      this.effects.burst(hand, 0x68e4ff, 12, 4.5);
      this.effects.shockwave(hand, 0x6ceaff, 0.8);
    }
    return true;
  }

  performEnergySlash(player, enemies, feedback = {}) {
    if (this.cooldowns.slash > 0 || !player.isAlive) return false;
    const weapon = player.weaponConfig || { damage: 1, range: 1, cooldown: 1 };
    this.cooldowns.slash = 0.92 * Math.max(0.35, weapon.cooldown || 1);
    player.startAttack('slash', 0.42);
    const origin = player.root.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    this.effects.slashArc(origin, player.facing, weapon.color ?? 0xb979ff, 1.2 * (weapon.range || 1));
    this.audio?.play('slash');
    let hits = 0;
    for (const enemy of enemies) {
      if (!this.isInForwardArc(player, enemy, 4.8 * (weapon.range || 1), -0.18, 4.2)) continue;
      if (this.applyDamageToEnemy(player, enemy, 34 + Math.min(18, player.horizontalSpeed * 0.75), 'void-slash', feedback)) hits++;
    }
    if (hits) {
      this.effects.burst(origin.clone().addScaledVector(player.facing, 1.8), 0xd1a0ff, 18, 5.5);
      this.effects.shockwave(origin, 0x9d64ff, 1.05);
    }
    return true;
  }

  performGunShot(player, enemies, feedback = {}) {
    if (!player.isAlive) return false;
    const shot = player.performGunAttack();
    if (!shot) return false;

    if (shot.status === 'reloading') {
      feedback.message?.(`RELOADING // ${shot.remainingTime.toFixed(1)}s`, 600);
      this.audio?.play('gun-reload');
      return false;
    }
    if (shot.status === 'empty') {
      feedback.message?.('MAGAZINE EMPTY // RELOADING', 800);
      this.audio?.play('gun-reload');
      return false;
    }

    if (shot.status === 'fired') {
      const weapon = player.weaponConfig || { color: 0x00f2fe };
      const color = weapon.color || 0x00f2fe;

      // Audio SFX
      this.audio?.play('gun-shot');

      // Muzzle Position in world coordinates
      const startPos = player.weapon.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.2, 0));
      const forward = player.facing.clone().setY(0).normalize();

      // Muzzle Flash Effect
      this.effects?.muzzleFlash(startPos, forward, color);

      // Raycast against enemies in line of fire (up to 35 meters)
      let hitEnemy = null;
      let closestDist = 35;
      let hitPos = null;

      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        const enemyCenter = enemy.root.position.clone().add(new THREE.Vector3(0, 1.2 * (enemy.spec?.scale || 1), 0));
        const toEnemy = enemyCenter.clone().sub(startPos);
        const dist = toEnemy.length();
        if (dist > closestDist) continue;

        // Check if enemy is in forward aim cone
        toEnemy.normalize();
        const dot = forward.dot(toEnemy);
        if (dot > 0.78) { // Forward firing arc (~40 deg)
          hitEnemy = enemy;
          closestDist = dist;
          hitPos = enemyCenter;
        }
      }

      if (hitEnemy && hitPos) {
        // Bullet tracer directly to enemy
        this.effects?.bulletTracer(startPos, hitPos, color);
        // Deal configurable balanced damage
        this.applyDamageToEnemy(player, hitEnemy, shot.damage, 'void-gun-shot', feedback);
        this.effects?.sparks(hitPos, 0xffe57f, 12, 5.0);
        this.effects?.burst(hitPos, color, 14, 4.5);
        if (feedback.cameraShake) feedback.cameraShake.value = Math.max(feedback.cameraShake.value, 0.28);
      } else {
        // Shoot forward to max range
        const maxRangePos = startPos.clone().addScaledVector(forward, 32);
        this.effects?.bulletTracer(startPos, maxRangePos, color);
        if (feedback.cameraShake) feedback.cameraShake.value = Math.max(feedback.cameraShake.value, 0.15);
      }

      feedback.message?.(`VOID ROUND FIRED // ${shot.ammoLeft}/${player.gunMaxAmmo}`, 500);
      return true;
    }
    return false;
  }

  performKatanaCombo(player, enemies, feedback = {}) {
    if (!player.isAlive) return false;
    // Ranged firearms automatically delegate to performGunShot
    if (player.weaponConfig?.category === 'ranged') {
      return this.performGunShot(player, enemies, feedback);
    }

    const combo = player.performKatanaAttack?.();
    if (!combo) return false;

    const step = combo.step;
    const attackId = combo.attackId;
    const weapon = player.weaponConfig || { damage: 1, range: 1, cooldown: 1 };
    const weaponColor = weapon.color ?? (step === 3 ? 0xff1744 : step === 2 ? 0xff7043 : 0xff3b52);

    // Audio SFX for sword swings
    if (step === 3) {
      this.audio?.play('sword-finisher');
    } else if (step === 2) {
      this.audio?.play('sword-swing-2');
    } else {
      this.audio?.play('sword-swing');
    }

    // Glowing sword slash trail effect
    this.effects?.katanaSlashTrail(player.root.position, player.facing, step, weaponColor);

    // Standard katana attack damage is exactly 60 HP per successful hit
    let baseDamage = 60;
    let range = 4.2 * (weapon.range || 1);
    let minDot = 0.22;
    let attackType = 'katana-combo-1';

    if (step === 2) {
      baseDamage = 75;
      range = 4.6 * (weapon.range || 1);
      minDot = 0.16;
      attackType = 'katana-combo-2';
    } else if (step === 3) {
      if (combo.isEmpowered) {
        baseDamage = 150;
        range = 6.4 * (weapon.range || 1);
        minDot = -0.35; // Massive 250 degree sweeping cleave
        attackType = 'katana-empowered-finisher';
      } else {
        baseDamage = 110;
        range = 5.8 * (weapon.range || 1);
        minDot = -0.15; // Devastating wide ~200 degree cleave
        attackType = 'katana-finisher';
      }
    }

    const damage = baseDamage + Math.min(22, player.horizontalSpeed * 0.75);
    let hits = 0;

    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      // Prevent one sword swing from damaging the same enemy multiple times:
      if (enemy.lastHitAttackId === attackId) continue;
      if (!this.isInForwardArc(player, enemy, range, minDot, 4.2)) continue;

      // Mark enemy as hit by this specific swing:
      enemy.lastHitAttackId = attackId;

      if (this.applyDamageToEnemy(player, enemy, damage, attackType, feedback)) {
        hits++;
        const hitPoint = enemy.root.position.clone().add(new THREE.Vector3(0, 1.15 * (enemy.spec?.scale || 1), 0));
        // Sparks and impact effects on connection
        this.effects?.sparks(hitPoint, combo.isEmpowered ? 0xff3b52 : 0xffd54f, step === 3 ? (combo.isEmpowered ? 28 : 18) : 10, step === 3 ? 7.5 : 4.8);
        this.effects?.burst(hitPoint, weaponColor, step === 3 ? (combo.isEmpowered ? 30 : 20) : 12, 5.2);
        this.audio?.play('katana-hit');

        if (step === 3) {
          if (combo.isEmpowered) {
            this.effects?.shockwave(player.root.position, 0xff1744, 2.6);
            if (feedback.cameraShake) feedback.cameraShake.value = Math.max(feedback.cameraShake.value, 0.75);
            feedback.flash?.(0.82, true);
            feedback.slowMotion?.(0.24);
          } else {
            if (feedback.cameraShake) feedback.cameraShake.value = Math.max(feedback.cameraShake.value, 0.48);
            feedback.flash?.(0.65, false);
            feedback.slowMotion?.(0.18);
          }
        } else {
          if (feedback.cameraShake) feedback.cameraShake.value = Math.max(feedback.cameraShake.value, 0.22);
          feedback.flash?.(0.28, false);
        }
      }
    }

    if (hits > 0 && step === 3) {
      feedback.message?.(combo.isEmpowered ? 'OMNISLASH // COMBO FINISHER' : 'KATANA FINISHER // CLEAVE', 950);
    }
    return true;
  }

  performVoidChain(player, enemies, feedback = {}, isClearLine = () => true) {
    if (!player.isAlive) return false;
    let target = null;
    const chainRange = VOID_CHAIN_RANGE * (player.weaponConfig?.range || 1);
    let closest = chainRange;
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const distance = Math.hypot(
        enemy.root.position.x - player.root.position.x,
        enemy.root.position.z - player.root.position.z
      );
      if (
        distance >= closest ||
        !this.isInForwardArc(player, enemy, chainRange, 0.18, 6) ||
        !isClearLine(player.root.position, enemy.root.position)
      ) continue;
      closest = distance;
      target = enemy;
    }
    if (!target) {
      feedback.message?.('NO CLEAR VOID CHAIN TARGET', 900);
      this.effects.burst(player.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 0x8c6cff, 5, 2);
      return false;
    }

    const start = player.root.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    const end = target.root.position.clone().add(new THREE.Vector3(0, target.spec.scale, 0));
    this.effects.energyTether(start, end, 0xb36cff);
    this.effects.burst(end, 0xa86cff, 10, 3.5);
    const toward = end.clone().sub(start).setY(0);
    if (toward.lengthSq() > 0.001) player.velocity.addScaledVector(toward.normalize(), 7.5);
    feedback.cameraShake && (feedback.cameraShake.value = Math.max(feedback.cameraShake.value, 0.14));
    feedback.flash?.(0.24, false);
    this.applyDamageToEnemy(player, target, 32, 'void-chain', feedback);
    return true;
  }

  performNinjaExecution(player, enemies, feedback = {}) {
    if (!player.isAlive) return false;
    const target = enemies
      .filter((enemy) => enemy.alive && enemy.type !== 'colossus' &&
        enemy.health <= enemy.maxHealth * EXECUTION_HEALTH_RATIO &&
        this.isInForwardArc(player, enemy, EXECUTION_RANGE * (player.weaponConfig?.range || 1), 0.15, 3.5))
      .sort((a, b) => a.root.position.distanceToSquared(player.root.position) -
        b.root.position.distanceToSquared(player.root.position))[0];
    if (!target) {
      feedback.message?.('NO ELIGIBLE TARGET', 900);
      return false;
    }

    player.startAttack('execute', 0.72);
    this.effects.dashStreak(player.root.position, player.facing, 0xb56cff);
    this.effects.burst(target.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 0xc78aff, 28, 7);
    this.effects.shockwave(target.root.position, 0xb56cff, 1.9);
    feedback.cameraShake && (feedback.cameraShake.value = Math.max(feedback.cameraShake.value, 0.42));
    feedback.flash?.(0.46, false);
    this.applyDamageToEnemy(player, target, target.health + 1, 'ninja-execution', feedback);
    return true;
  }

  startDashAttack(player) {
    this.dashSequence = player.dashSequence;
    this.dashHits.clear();
    player.startAttack('dash', 0.32);
    this.effects.dashStreak(player.root.position, player.facing, player.overdriveTimer > 0 ? 0xd783ff : 0x00e5ff);
    this.effects.burst(player.root.position.clone().add(new THREE.Vector3(0, 1, 0)), 0x38d6ff, 12, 4);
    this.audio?.play('dash');
  }

  executeDashAttack(player, enemies, moveDirection, feedback = {}, world = null) {
    if (!player.isAlive || player.dashAttackCooldown > 0 || player.energy < 16) return false;

    // Search for best target in forward cone (up to 24m)
    let bestTarget = null;
    let closestDist = 24 * (player.weaponConfig?.range || 1);
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const dx = enemy.root.position.x - player.root.position.x;
      const dz = enemy.root.position.z - player.root.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > closestDist) continue;
      if (!this.isInForwardArc(player, enemy, closestDist, 0.12, 5.5)) continue;
      closestDist = dist;
      bestTarget = enemy;
    }

    const res = player.performDashAttack(bestTarget, moveDirection);
    if (!res) return false;

    this.dashHits.clear();
    this.dashSequence = player.dashSequence;
    this.effects.dashStreak(player.root.position, player.facing, 0x00f2fe);
    this.effects.burst(player.root.position.clone().add(new THREE.Vector3(0, 1.1, 0)), 0x38d6ff, 16, 4.8);
    this.audio?.play('dash');
    if (feedback.cameraShake) feedback.cameraShake.value = Math.max(feedback.cameraShake.value, 0.28);
    return true;
  }

  resolveDashAttack(player, enemies, feedback = {}, world = null) {
    const state = player.dashAttackState;
    if (!state) {
      if (player.dashDuration <= 0) return;
      if (this.dashSequence !== player.dashSequence) this.startDashAttack(player);
      return;
    }

    // Prevent passing through world obstacles / bounds
    if (world) {
      world.resolveFeatureCollision?.(player.root.position, 0.75);
    }

    if (state.phase === 'dash') {
      let shouldSlash = false;
      if (state.target && state.target.alive) {
        const dx = state.target.root.position.x - player.root.position.x;
        const dz = state.target.root.position.z - player.root.position.z;
        const dist = Math.hypot(dx, dz);

        // Keep ninja from getting stuck inside enemy mesh
        const stopDist = 1.8 * (state.target.spec?.scale || 1);
        if (dist <= stopDist + 0.9) {
          shouldSlash = true;
          if (dist > 0.001) {
            player.root.position.x = state.target.root.position.x - (dx / dist) * stopDist;
            player.root.position.z = state.target.root.position.z - (dz / dist) * stopDist;
          }
        }
      }

      if (player.dashDuration <= 0.08 || shouldSlash) {
        state.phase = 'slash';
        player.velocity.x *= 0.12;
        player.velocity.z *= 0.12;
        player.startAttack('katana-dash-slash', 0.34);
        this.audio?.play('sword-finisher');
        this.effects.katanaSlashTrail(player.root.position, player.facing, 2, 0x00f2fe);
        this.effects.shockwave(player.root.position.clone(), 0x38d6ff, 1.9);

        // Weapon Hitbox connection
        let hits = 0;
        const weapon = player.weaponConfig || { damage: 1, range: 1, cooldown: 1 };
        const baseDamage = 78;
        const range = 5.2 * (weapon.range || 1);
        const damage = baseDamage + Math.min(28, player.horizontalSpeed * 0.85);

        for (const enemy of enemies) {
          if (!enemy.alive || this.dashHits.has(enemy)) continue;
          if (enemy.lastHitAttackId === state.attackId) continue;
          if (!this.isInForwardArc(player, enemy, range, -0.25, 4.5)) continue;

          enemy.lastHitAttackId = state.attackId;
          this.dashHits.add(enemy);

          if (this.applyDamageToEnemy(player, enemy, damage, 'katana-dash-slash', feedback)) {
            hits++;
            const hitPoint = enemy.root.position.clone().add(new THREE.Vector3(0, 1.15 * (enemy.spec?.scale || 1), 0));
            this.effects.sparks(hitPoint, 0xffd54f, 18, 6.5);
            this.effects.burst(hitPoint, 0x00f2fe, 24, 5.5);
            this.effects.shockwave(hitPoint, 0x38d6ff, 1.4);
            this.audio?.play('katana-hit');
            if (feedback.cameraShake) feedback.cameraShake.value = Math.max(feedback.cameraShake.value, 0.48);
            feedback.flash?.(0.62, true);
            feedback.slowMotion?.(0.15);
          }
        }

        if (hits > 0) {
          feedback.message?.('DASH ATTACK // IAIJUTSU STRIKE', 900);
        }
      }
    } else if (state.phase === 'slash') {
      if (player.attackTimer <= 0) {
        player.dashAttackState = null;
      }
    }
  }

  activateOverdrive(player, feedback = {}) {
    if (player.overdriveTimer > 0 || player.overdriveCooldown > 0 || player.overdriveCharge < 40 || !player.isAlive) return false;
    player.overdriveCharge = Math.max(0, player.overdriveCharge - 40);
    player.overdriveTimer = 6.5;
    player.overdriveExitTimer = 0;
    player.overdriveExitSpeed = 0;
    this.effects.burst(player.root.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xb766ff, 28, 6);
    this.effects.shockwave(player.root.position.clone(), 0x885bff, 1.5);
    this.audio?.play('overdrive');
    feedback.flash?.(0.36, false);
    return true;
  }

  cancelVoidCharge(player) {
    if (!this.charging) return;
    this.charging = false;
    this.chargeValue = 0;
    player.chargeLevel = 0;
    player.attackAction = '';
    player.attackTimer = 0;
    this.audio?.stopCharge();
  }

  isInForwardArc(player, enemy, range, minimumDot, verticalRange) {
    if (!enemy.alive) return false;
    const dx = enemy.root.position.x - player.root.position.x;
    const dz = enemy.root.position.z - player.root.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance > range || Math.abs(enemy.root.position.y - player.root.position.y) > verticalRange) return false;
    if (distance < 0.001) return true;
    const dot = (dx * player.facing.x + dz * player.facing.z) / distance;
    return dot >= minimumDot;
  }

  applyDamageToEnemy(player, enemy, rawDamage, attackType, feedback = {}) {
    if (!player.isAlive || player.health <= 0 || !enemy.alive || enemy.rewarded) return false;
    const speed = player.horizontalSpeed;
    const speedMultiplier = DAMAGE_CONFIG.speedBase +
      THREE.MathUtils.clamp(speed / DAMAGE_CONFIG.speedReference, 0, DAMAGE_CONFIG.speedCap) * DAMAGE_CONFIG.speedScale;
    const fromEnemyX = player.root.position.x - enemy.root.position.x;
    const fromEnemyZ = player.root.position.z - enemy.root.position.z;
    const distance = Math.hypot(fromEnemyX, fromEnemyZ) || 1;
    const enemyForwardX = Math.sin(enemy.root.rotation.y);
    const enemyForwardZ = Math.cos(enemy.root.rotation.y);
    const facingDot = (fromEnemyX * enemyForwardX + fromEnemyZ * enemyForwardZ) / distance;
    let angleMultiplier = facingDot > 0.65 ? 1 :
      facingDot < -0.65 ? DAMAGE_CONFIG.rearMultiplier : DAMAGE_CONFIG.sideMultiplier;
    let angleLabel = facingDot < -0.65 ? 'FLANK BONUS // REAR' : facingDot <= 0.65 ? 'FLANK BONUS // SIDE' : '';
    const aerialBonus = player.root.position.y > enemy.root.position.y + enemy.spec.scale * 1.1;
    if (aerialBonus) {
      angleMultiplier *= DAMAGE_CONFIG.aerialMultiplier;
      angleLabel = 'AERIAL BONUS';
    }
    angleMultiplier = Math.min(angleMultiplier, DAMAGE_CONFIG.combinedAngleCap);
    const frontalArmor = enemy.type === 'scout' || facingDot <= 0.65
      ? 1
      : 0.76;
    const bossScale = enemy.type === 'colossus'
      ? (enemy.vulnerableTimer > 0 ? DAMAGE_CONFIG.bossVulnerableDamage : DAMAGE_CONFIG.bossArmoredDamage)
      : 1;
    const overdriveScale = player.overdriveTimer > 0 ? 1.25 : 1;
    const attackScale = DAMAGE_CONFIG.attackMultipliers[attackType] ?? 1;
    const weaponScale = Number.isFinite(player.weaponConfig?.damage)
      ? Math.max(0.25, Math.min(2.5, player.weaponConfig.damage))
      : 1;
    const safeRawDamage = Number.isFinite(rawDamage) ? Math.max(0, rawDamage) : 0;
    let scaledDamage = Math.max(1, safeRawDamage) * speedMultiplier * attackScale * weaponScale *
      angleMultiplier * frontalArmor * bossScale * overdriveScale;

    // Standard katana attack deals exactly 60 HP per successful hit
    if (attackType === 'katana-combo-1') {
      scaledDamage = 60;
    }

    // Heavy Samurai / Elite frontal block mechanics
    const isHeavyEnemy = enemy.type === 'guardian' || enemy.type === 'elite';
    const isFrontAttack = facingDot > 0.45;
    const isPiercing = attackType === 'ninja-execution' || attackType === 'void-charge' ||
      attackType === 'katana-empowered-finisher' || attackType === 'katana-dash-slash';

    if (isHeavyEnemy && isFrontAttack && enemy.hitStun <= 0 && !isPiercing && enemy.attackPhase <= 0) {
      enemy.isBlocking = true;
      enemy.blockTimer = 0.38;
      scaledDamage *= 0.32;
      this.effects.sparks(enemy.root.position.clone().add(new THREE.Vector3(0, 1.2 * enemy.spec.scale, 0)), 0xffe57f, 15, 6);
      this.audio?.play('slash');
      feedback.message?.('GUARD BLOCKED // FLANK OR DASH ATTACK', 800);
      if (feedback.cameraShake) feedback.cameraShake.value = Math.max(feedback.cameraShake.value, 0.16);
    }

    const damage = Math.min(
      enemy.type === 'colossus' ? 170 : 280,
      attackType === 'ninja-execution' ? Math.max(scaledDamage, enemy.health + 1) : scaledDamage
    );
    enemy.health = Math.max(0, enemy.health - damage);
    enemy.hitFlash = 0.24;
    enemy.hitStun = Math.max(
      enemy.hitStun || 0,
      THREE.MathUtils.clamp(0.14 + speed * 0.012 + damage * 0.0018, 0.18, attackType === 'void-charge' ? 1.15 : 0.78)
    );
    enemy.hitCooldown = Math.max(enemy.hitCooldown || 0, 0.22);

    const away = enemy.root.position.clone().sub(player.root.position).setY(0);
    if (away.lengthSq() > 0.001) {
      away.normalize();
      const weaponKnockback = player.weaponConfig?.id === 'kinetic-gauntlets' ? 1.55 : 1;
      const knockback = Math.min(enemy.type === 'colossus' ? 7 : 19, (speed * 0.3 + damage * 0.045) * weaponKnockback);
      enemy.knockbackVelocity.addScaledVector(away, knockback);
      const horizontalKnockback = Math.hypot(enemy.knockbackVelocity.x, enemy.knockbackVelocity.z);
      const knockbackLimit = enemy.type === 'colossus' ? 8 : 22;
      if (horizontalKnockback > knockbackLimit) {
        const scale = knockbackLimit / horizontalKnockback;
        enemy.knockbackVelocity.x *= scale;
        enemy.knockbackVelocity.z *= scale;
      }
      if (attackType === 'void-charge' && damage >= 42) {
        enemy.knockbackVelocity.y = Math.min(12, Math.max(
          enemy.knockbackVelocity.y,
          Math.min(11, 4 + damage * 0.035)
        ));
      }
    }
    enemy.drawHealth();
    this.effects.burst(enemy.root.position.clone().add(new THREE.Vector3(0, 1.1 * enemy.spec.scale, 0)), 0x9eeeff, 12, 4.5);
    this.effects.damageNumber(enemy.root.position, damage, enemy.type === 'colossus' ? '#ffafcc' : ENEMY_COLOR);
    if (feedback.cameraShake) feedback.cameraShake.value = Math.min(1.2, feedback.cameraShake.value + 0.14 + damage / 240);
    feedback.flash?.(attackType === 'void-charge' ? 0.52 : 0.28, false);
    if (angleLabel) feedback.message?.(angleLabel, 780);
    if (speed > 18 || damage > 75) feedback.slowMotion?.(0.075 + Math.min(0.12, damage / 1600));
    this.audio?.play('hit');
    const consecutive = player.comboTimer > 0;
    player.combo = consecutive ? player.combo + 1 : 1;
    player.comboTimer = COMBO_RESET_SECONDS;
    const comboMultiplier = Math.min(8, 1 + Math.floor((player.combo - 1) / 2));
    const scoreMultiplier = comboMultiplier * (player.scoreMultiplierBonus ?? 1);
    player.score += Math.round(damage * 1.35 * scoreMultiplier);
    player.scoreMultiplier = scoreMultiplier;
    if (player.combo >= 3 && player.combo % 3 === 0) {
      this.effects.shockwave(player.root.position.clone(), 0xb26cff, 0.85 + Math.min(1.1, player.combo * 0.035));
      feedback.message?.(`COMBO x${comboMultiplier}`, 750);
    }

    if (enemy.health <= 0) {
      enemy.alive = false;
      enemy.defeated = true;
      enemy.rewarded = true;
      enemy.attackPhase = 0;
      enemy.attackHitDone = true;
      enemy.attackActive = false;
      enemy.telegraphRing && (enemy.telegraphRing.visible = false);
      enemy.telegraphBeam && (enemy.telegraphBeam.visible = false);
      enemy.defeatDuration = enemy.type === 'colossus' ? 0.72 : 0.42;
      enemy.defeatTimer = enemy.defeatDuration;
      player.score += enemy.type === 'colossus' ? 850 : 150;
      this.effects.burst(enemy.root.position.clone().add(new THREE.Vector3(0, 1.1, 0)), 0xe875ff, enemy.type === 'colossus' ? 54 : 32, enemy.type === 'colossus' ? 10 : 8);
      this.effects.burst(enemy.root.position.clone().add(new THREE.Vector3(0, 1.1, 0)), 0xff536d, 15, 5);
      this.effects.shockwave(enemy.root.position.clone(), 0xcc78ff, enemy.type === 'colossus' ? 3.4 : 1.8);
      this.effects?.defeatSmoke(enemy.root.position, enemy.spec.scale);
      this.audio?.play('defeat');
      this.audio?.play('enemy-smoke');
      this.onEnemyDefeated?.(player, enemy, feedback);
    }
    return true;
  }

  resolvePlayerEnemyHit(player, enemy, feedback = {}) {
    // Touch-to-attack completely disabled. Touching an enemy must NOT trigger an attack or deal damage.
    return false;
  }

  resolveEnemyHit(player, enemy, dt, feedback = {}) {
    if (!enemy.alive || !player.isAlive || player.health <= 0) return;
    const dist = enemy.root.position.distanceTo(player.root.position);
    let bossHit = false;
    if (enemy.type === 'colossus' && enemy.attackActive && !enemy.attackHitDone) {
      const dx = player.root.position.x - enemy.root.position.x;
      const dz = player.root.position.z - enemy.root.position.z;
      const forward = Math.atan2(dx, dz);
      const angle = Math.atan2(Math.sin(forward - enemy.root.rotation.y), Math.cos(forward - enemy.root.rotation.y));
      if (enemy.attackPattern === 0) bossHit = dist < 6.2;
      else if (enemy.attackPattern === 1) bossHit = dist < 12;
      else bossHit = dist < 17 && Math.abs(angle) < 0.23;
    }
    const normalHit = enemy.type !== 'colossus' &&
      dist < enemy.attackRange &&
      enemy.attackPhase > 0 &&
      enemy.attackPhase <= (enemy.strikeDuration || 0.24) &&
      !enemy.attackHitDone;
    if ((normalHit || bossHit) && player.invulnerable <= 0) {
      const damage = enemy.attackDamage ?? (enemy.type === 'colossus' ? 38 : 16);
      const applied = feedback.takeDamage
        ? feedback.takeDamage(damage)
        : player.takeDamage(damage);
      player.invulnerable = player.damageInvulnerabilityWindow || 0.28;
      enemy.attackHitDone = true;
      if (this.charging) this.cancelVoidCharge(player);
      this.effects.burst(player.root.position.clone().add(new THREE.Vector3(0, 1.1, 0)), 0xd61c2e, 16, 5.5);
      this.effects.damageNumber(player.root.position, Math.round(damage), '#ff3b4d');
      if (enemy.type === 'colossus') {
        const impactColor = enemy.attackPattern === 1 ? 0xb765ff : 0xff244a;
        this.effects.shockwave(player.root.position.clone(), impactColor, enemy.attackPattern === 1 ? 2.6 : 1.5);
        this.effects.burst(player.root.position.clone().add(new THREE.Vector3(0, 0.3, 0)), impactColor, 20, 7);
      }
      this.audio?.play('player-hit');
      feedback.damageFlash?.();
      feedback.flash?.(0.38, false);
      if (feedback.cameraShake) feedback.cameraShake.value = Math.min(1.4, feedback.cameraShake.value + 0.32);
    }
  }
}
