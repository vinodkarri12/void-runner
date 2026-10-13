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
    'kinetic-collision': 1,
    'kinetic-strike': 1.05,
    'void-slash': 1.15,
    'void-charge': 1.25,
    'void-chain': 0.9,
    'ninja-execution': 1,
    'phantom-dash': 1.1
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
    this.effects.dashStreak(player.root.position, player.facing, player.overdriveTimer > 0 ? 0xd783ff : 0x647aff);
    this.effects.burst(player.root.position.clone().add(new THREE.Vector3(0, 1, 0)), 0x64dfff, 10, 4);
    this.audio?.play('dash');
  }

  resolveDashAttack(player, enemies, feedback = {}) {
    if (player.dashDuration <= 0) return;
    if (this.dashSequence !== player.dashSequence) this.startDashAttack(player);
    const speed = player.horizontalSpeed;
    const start = player.previousPosition;
    const end = player.root.position;
    const segmentX = end.x - start.x;
    const segmentZ = end.z - start.z;
    const segmentLengthSq = segmentX * segmentX + segmentZ * segmentZ;
    for (const enemy of enemies) {
      if (!enemy.alive || this.dashHits.has(enemy)) continue;
      const offsetX = enemy.root.position.x - start.x;
      const offsetZ = enemy.root.position.z - start.z;
      const along = segmentLengthSq > 0
        ? THREE.MathUtils.clamp((offsetX * segmentX + offsetZ * segmentZ) / segmentLengthSq, 0, 1)
        : 0;
      const nearestX = start.x + segmentX * along;
      const nearestZ = start.z + segmentZ * along;
      const hitRadius = 1.35 + enemy.spec.scale * 0.85;
      if (
        Math.hypot(enemy.root.position.x - nearestX, enemy.root.position.z - nearestZ) > hitRadius ||
        Math.abs(enemy.root.position.y - player.root.position.y) > 4.5
      ) continue;
      this.dashHits.add(enemy);
      const damage = Math.min(250, speed * 5.5 + speed * speed * 0.15);
      if (this.applyDamageToEnemy(player, enemy, damage, 'phantom-dash', feedback)) {
        this.effects.shockwave(enemy.root.position.clone(), speed > 20 ? 0xf0fbff : 0x9d7cff, 1.7);
        if (speed > 20) feedback.flash?.(0.78, true);
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
    const scaledDamage = Math.max(1, safeRawDamage) * speedMultiplier * attackScale * weaponScale *
      angleMultiplier * frontalArmor * bossScale * overdriveScale;
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
      this.audio?.play('defeat');
      this.onEnemyDefeated?.(player, enemy, feedback);
    }
    return true;
  }

  resolvePlayerEnemyHit(player, enemy, feedback = {}) {
    if (!enemy.alive || enemy.hitCooldown > 0) return false;
    const speed = player.horizontalSpeed;
    if (speed < 2) return false;
    const damage = 5 + speed * 2.8 + speed * speed * 0.035;
    const callbacks = feedback.cameraShake ? feedback : { cameraShake: feedback };
    const hit = this.applyDamageToEnemy(player, enemy, damage, 'kinetic-collision', callbacks);
    if (hit && speed > 12) {
      this.effects.shockwave(enemy.root.position.clone(), speed > 16 ? 0xffffff : 0x98d7ff, 1.2 + speed / 18);
    }
    if (hit && speed >= 18) {
      callbacks.flash?.(0.78, true);
      callbacks.slowMotion?.(0.18);
    }
    return enemy.health <= 0;
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
      dist < enemy.attackRange && enemy.attackPhase > 0.25 && !enemy.attackHitDone;
    if ((normalHit || bossHit) && player.invulnerable <= 0) {
      const damage = enemy.attackDamage ?? (enemy.type === 'colossus' ? 11 : 6);
      const applied = feedback.takeDamage
        ? feedback.takeDamage(damage)
        : player.takeDamage(damage);
      player.invulnerable = 0.85;
      enemy.attackHitDone = true;
      if (this.charging) this.cancelVoidCharge(player);
      this.effects.burst(player.root.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xff4d6e, 12, 5);
      if (enemy.type === 'colossus') {
        const impactColor = enemy.attackPattern === 1 ? 0xb765ff : 0xff4968;
        this.effects.shockwave(player.root.position.clone(), impactColor, enemy.attackPattern === 1 ? 2.4 : 1.3);
        this.effects.burst(player.root.position.clone().add(new THREE.Vector3(0, 0.3, 0)), impactColor, 16, 6);
      }
      this.audio?.play('player-hit');
      feedback.damageFlash?.();
      feedback.flash?.(0.3, false);
      if (feedback.cameraShake) feedback.cameraShake.value = Math.min(1.2, feedback.cameraShake.value + 0.22);
    }
  }
}
