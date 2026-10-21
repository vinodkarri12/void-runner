export class HUD {
  constructor() {
    this.scoreValue = document.getElementById('scoreValue');
    this.comboValue = document.getElementById('comboValue');
    this.scoreMultiplier = document.getElementById('scoreMultiplier');
    this.defeatedValue = document.getElementById('defeatedValue');
    this.enemyValue = document.getElementById('enemyValue');
    this.levelValue = document.getElementById('levelValue');
    this.levelTitle = document.getElementById('levelTitle');
    this.levelObjective = document.getElementById('levelObjective');
    this.levelProgress = document.getElementById('levelProgress');
    this.levelProgressText = document.getElementById('levelProgressText');
    this.unlockedLevel = document.getElementById('unlockedLevel');
    this.campaignPanel = document.querySelector('.campaign-panel');
    this.healthText = document.getElementById('healthText');
    this.energyText = document.getElementById('energyText');
    this.healthBar = document.getElementById('healthBar');
    this.energyBar = document.getElementById('energyBar');
    this.speedValue = document.getElementById('speedValue');
    this.maxSpeedStatus = document.getElementById('maxSpeedStatus');
    this.momentumBar = document.getElementById('momentumBar');
    this.momentumState = document.getElementById('momentumState');
    this.hudMovementState = document.getElementById('hudMovementState');
    this.hudBoostBar = document.getElementById('hudBoostBar');
    this.hudBoostPercent = document.getElementById('hudBoostPercent');
    this.hudBoostLabel = document.getElementById('hudBoostLabel');
    this.boostButton = document.getElementById('boostButton');
    this.boostMeterFill = document.getElementById('boostMeterFill');
    this.boostStatusBadge = document.getElementById('boostStatusBadge');
    this.damageMultiplier = document.getElementById('damageMultiplier');
    this.centerMessage = document.getElementById('centerMessage');
    this.overlay = document.getElementById('overlay');
    this.modalTitle = document.getElementById('modalTitle');
    this.modalEyebrow = document.getElementById('modalEyebrow');
    this.modalMessage = document.getElementById('modalMessage');
    this.resultsPanel = document.getElementById('resultsPanel');
    this.resumeButton = document.getElementById('resumeButton');
    this.restartButton = document.getElementById('restartButton');
    this.mainMenuButton = document.getElementById('mainMenuButton');
    this.continueButton = document.getElementById('continueButton');
    this.changeWeaponButton = document.getElementById('changeWeaponButton');
    this.settingsMenuButton = document.getElementById('settingsMenuButton');
    this.cameraResetButton = document.getElementById('cameraResetButton');
    this.pauseButton = document.getElementById('pauseButton');
    this.minimap = document.getElementById('minimap');
    this.minimapContext = this.minimap.getContext('2d');
    this.targetMarker = document.getElementById('targetMarker');
    this.targetName = document.getElementById('targetName');
    this.targetHealthText = document.getElementById('targetHealthText');
    this.targetHealthBar = document.getElementById('targetHealthBar');
    this.weaponEnergyText = document.getElementById('weaponEnergyText');
    this.weaponEnergyBar = document.getElementById('weaponEnergyBar');
    this.chargePercent = document.getElementById('chargePercent');
    this.chargeBar = document.getElementById('chargeBar');
    this.chargeFull = document.getElementById('chargeFull');
    this.overdriveText = document.getElementById('overdriveText');
    this.overdriveBar = document.getElementById('overdriveBar');
    this.overdriveStatus = document.getElementById('overdriveStatus');
    this.reduceFlashButton = document.getElementById('reduceFlashButton');
    this.impactFlash = document.getElementById('impactFlash');
    this.combatMessage = document.getElementById('combatMessage');
    this.bossHealthPanel = document.getElementById('bossHealthPanel');
    this.bossHealthText = document.getElementById('bossHealthText');
    this.bossHealthBar = document.getElementById('bossHealthBar');
    this.bossPhaseText = document.getElementById('bossPhaseText');
    this.messageTimer = 0;
    this.flashIntensity = 0;
    this.flashDuration = 0;
    this.mapRefresh = 0;
  }

  update(player, enemies, wave, worldOffset = { x: 0, y: 0 }, getHeight = () => 0, combat = null, target = null, defeated = 0, abilities = {}) {
    const equippedHudWeapon = document.getElementById('equippedHudWeapon');
    if (equippedHudWeapon) equippedHudWeapon.textContent = player.weaponConfig?.name || 'VOID REAVER';
    this.scoreValue.textContent = String(Math.floor(player.score)).padStart(6, '0');
    this.comboValue.textContent = `x${player.combo}`;
    this.scoreMultiplier.textContent = `SCORE x${player.scoreMultiplier ?? 1}`;
    this.defeatedValue.textContent = String(defeated);
    const remaining = abilities.enemiesRemaining ?? enemies.filter((e) => e.alive).length;
    this.enemyValue.textContent = `${remaining} LEFT`;
    this.updateHealthHUD(player);
    this.energyText.textContent = `${Math.ceil(player.energy)}/100`;
    this.energyBar.style.width = `${Math.max(0, player.energy)}%`;
    this.weaponEnergyText.textContent = `${Math.ceil(player.energy)}%`;
    this.weaponEnergyBar.style.width = `${Math.max(0, player.energy)}%`;
    const charge = combat?.chargeValue ?? player.chargeLevel;
    this.chargePercent.textContent = `${Math.round(charge * 100)}%`;
    this.chargeBar.style.width = `${charge * 100}%`;
    this.chargeFull.classList.toggle('visible', combat?.charging === true && charge >= 0.98);
    this.overdriveText.textContent = player.overdriveTimer > 0
      ? `${player.overdriveTimer.toFixed(1)}s`
      : `${Math.round(player.overdriveCharge)}%`;
    this.overdriveBar.style.width = `${player.overdriveTimer > 0 ? player.overdriveTimer / 6.5 * 100 : player.overdriveCharge}%`;
    this.overdriveStatus.textContent = player.overdriveTimer > 0 ? 'OVERDRIVE ACTIVE' : player.overdriveCooldown > 0 ? 'OVERDRIVE COOLING' : 'OVERDRIVE READY';
    this.overdriveStatus.classList.toggle('active', player.overdriveTimer > 0);
    const setStatus = (id, remaining) => {
      const node = document.getElementById(id);
      node.textContent = remaining > 0 ? `${remaining.toFixed(1)}s` : 'READY';
      node.classList.toggle('cooling', remaining > 0);
    };
    setStatus('qStatus', combat?.cooldowns.strike ?? 0);
    setStatus('fStatus', combat?.cooldowns.slash ?? 0);
    setStatus('eStatus', player.dashTimer);
    setStatus('rStatus', combat?.cooldowns.charge ?? 0);
    setStatus('tStatus', player.overdriveTimer > 0 ? player.overdriveTimer : player.overdriveCooldown);
    setStatus('gStatus', abilities.cloneCooldown ?? 0);
    setStatus('vStatus', abilities.chainCooldown ?? 0);
    const anchorStatus = document.getElementById('xStatus');
    anchorStatus.textContent = abilities.anchorCooldown > 0
      ? `${abilities.anchorCooldown.toFixed(1)}s`
      : abilities.anchored ? 'LOCKED' : 'READY';
    anchorStatus.classList.toggle('cooling', abilities.anchorCooldown > 0);
    const executionStatus = document.getElementById('zStatus');
    executionStatus.textContent = abilities.executionCooldown > 0
      ? `${abilities.executionCooldown.toFixed(1)}s`
      : abilities.executionAvailable ? 'READY' : 'NO TARGET';
    executionStatus.classList.toggle('cooling', abilities.executionCooldown > 0 || !abilities.executionAvailable);
    const boss = enemies.find((enemy) => enemy.alive && enemy.type === 'colossus');
    this.bossHealthPanel.classList.toggle('hidden', !boss);
    if (boss) {
      document.getElementById('bossName').textContent = boss.name;
      this.bossHealthText.textContent = `${Math.ceil(boss.health)} / ${boss.maxHealth}`;
      this.bossHealthBar.style.width = `${Math.max(0, boss.health / boss.maxHealth * 100)}%`;
      this.bossHealthPanel.classList.toggle('final-boss', boss.isFinalBoss);
      const bossPatterns = ['SWEEP', 'GROUND PULSE', 'VOID LANCE'];
      this.bossPhaseText.textContent = boss.vulnerableTimer > 0
        ? 'VULNERABLE'
        : boss.attackActive
          ? `ATTACK // ${bossPatterns[boss.attackPattern]}`
          : boss.attackPhase > 0
            ? `TELEGRAPH // ${bossPatterns[boss.attackPattern]}`
            : 'ARMORED';
      this.bossHealthPanel.classList.toggle('vulnerable', boss.vulnerableTimer > 0);
    }
    if (target?.alive) {
      const healthRatio = Math.max(0, target.health / target.maxHealth);
      this.targetHealthText.textContent = `${Math.ceil(target.health)} / ${target.maxHealth}`;
      this.targetHealthBar.style.width = `${healthRatio * 100}%`;
    }
    this.speedValue.textContent = player.horizontalSpeed.toFixed(1).padStart(4, '0');
    const speedThreshold = player.overdriveTimer > 0 ? 38 : 30;
    const pct = Math.min(1, player.horizontalSpeed / speedThreshold);
    const kineticMultiplier = 0.45 + Math.min(1.6, player.horizontalSpeed / 30) * 0.62;
    this.damageMultiplier.textContent = `KINETIC DMG x${(kineticMultiplier * (player.overdriveTimer > 0 ? 1.25 : 1)).toFixed(2)}`;
    this.momentumBar.style.width = `${pct * 100}%`;
    const movementLabel = player.movementState || (player.horizontalSpeed > 0.4 ? 'RUNNING' : 'STOPPED');
    this.momentumState.textContent = movementLabel;
    if (this.hudMovementState) {
      this.hudMovementState.textContent = movementLabel;
      this.hudMovementState.className = 'movement-state-badge ' + (movementLabel === 'STOPPED' ? 'state-stopped' : 'state-running');
    }
    this.maxSpeedStatus.classList.toggle('active', player.isMaxSpeed);

    // Boost meter & status updates
    const boostEnergy = player.boostEnergy ?? 100;
    const boostPct = Math.round(boostEnergy);
    const inCooldown = (player.boostCooldownTimer || 0) > 0;
    const isBoosting = Boolean(player.isBoosting);

    if (this.hudBoostBar) {
      this.hudBoostBar.style.width = `${boostPct}%`;
      this.hudBoostBar.classList.toggle('cooling', inCooldown);
      this.hudBoostBar.classList.toggle('active', isBoosting);
    }
    if (this.hudBoostPercent) {
      this.hudBoostPercent.textContent = `${boostPct}%`;
    }
    if (this.hudBoostLabel) {
      this.hudBoostLabel.textContent = isBoosting
        ? 'BOOST SURGE'
        : inCooldown
          ? `COOLING ${(player.boostCooldownTimer || 0).toFixed(1)}s`
          : boostPct < 100
            ? 'RECHARGING'
            : 'BOOST READY';
      this.hudBoostLabel.className = isBoosting ? 'boost-active' : inCooldown ? 'boost-cooling' : '';
    }

    // Circular mobile boost button indicator
    if (this.boostMeterFill) {
      const circumference = 201.06;
      const offset = circumference * (1 - Math.max(0, Math.min(100, boostEnergy)) / 100);
      this.boostMeterFill.style.strokeDashoffset = `${offset}`;
      this.boostMeterFill.style.stroke = inCooldown ? '#ff3b3b' : isBoosting ? '#ffffff' : '#ffd060';
    }
    if (this.boostStatusBadge) {
      if (isBoosting) {
        this.boostStatusBadge.textContent = 'BOOSTING';
        this.boostStatusBadge.className = 'boost-status-badge status-boosting';
      } else if (inCooldown) {
        this.boostStatusBadge.textContent = `${(player.boostCooldownTimer || 0).toFixed(1)}s`;
        this.boostStatusBadge.className = 'boost-status-badge status-cooldown';
      } else if (boostPct < 99) {
        this.boostStatusBadge.textContent = `${boostPct}%`;
        this.boostStatusBadge.className = 'boost-status-badge status-recharge';
      } else {
        this.boostStatusBadge.textContent = 'READY';
        this.boostStatusBadge.className = 'boost-status-badge status-ready';
      }
    }
    if (this.boostButton) {
      this.boostButton.classList.toggle('cooling', inCooldown);
      this.boostButton.classList.toggle('is-boosting', isBoosting);
    }

    this.centerMessage.textContent = `LEVEL ${String(wave).padStart(2, '0')} / 15`;
    this.messageTimer = Math.max(0, this.messageTimer - 1 / 60);
    if (this.messageTimer === 0) this.combatMessage.classList.remove('visible');
    this.mapRefresh -= 1 / 60;
    if (this.mapRefresh <= 0) {
      this.mapRefresh = 0.12;
      this.drawMinimap(player, enemies, worldOffset, getHeight);
    }
  }

  showLevel(level, definition, progression, state = {}) {
    this.levelValue.textContent = `LEVEL: ${String(level).padStart(2, '0')} / 15`;
    this.levelTitle.textContent = definition.master ? `MASTER // ${definition.title}` : definition.title;
    this.levelObjective.textContent = definition.objective;
    this.unlockedLevel.textContent = `UNLOCKED: ${String(progression.unlockedLevel).padStart(2, '0')}  //  CLEARED: ${progression.completedCount}`;
    const completed = progression.completedLevels.has(level) && state.status === undefined;
    const ratio = state.status === 'complete' || completed
      ? 1
      : state.status === 'active'
        ? Math.min(1, (definition.requiredKills - (state.enemiesRemaining ?? definition.requiredKills)) / definition.requiredKills)
        : 0;
    this.levelProgress.style.width = `${ratio * 100}%`;
    const defeated = definition.requiredKills - (state.enemiesRemaining ?? definition.requiredKills);
    const waveLabel = state.waveCount > 1 ? `WAVE ${state.waveIndex || 1}/${state.waveCount} // ` : '';
    this.levelProgressText.textContent = state.status === 'complete' || completed
      ? 'LEVEL CLEARED'
      : state.status === 'spawning'
        ? `${waveLabel}PORTAL ARRIVALS // ${defeated} / ${definition.requiredKills}`
        : `${waveLabel}HOSTILES ${defeated} / ${definition.requiredKills}`;
    this.levelTitle.classList.toggle('master-level-title', definition.master);
    this.campaignPanel.classList.toggle('master-arena', definition.master);
  }

  updateHealthHUD(player) {
    this.healthText.textContent = `${Math.ceil(player.health)} / ${player.maxHealth} HP`;
    this.healthBar.style.width = `${Math.max(0, player.health / player.maxHealth * 100)}%`;
    this.healthBar.classList.toggle('critical', player.health <= player.maxHealth * 0.3);
  }

  drawMinimap(player, enemies, worldOffset, getHeight) {
    const context = this.minimapContext;
    const width = this.minimap.width;
    const height = this.minimap.height;
    const center = width / 2;
    const radius = width * 0.46;
    const range = 110;
    context.clearRect(0, 0, width, height);
    context.save();
    context.beginPath();
    context.arc(center, center, radius, 0, Math.PI * 2);
    context.clip();
    context.fillStyle = 'rgba(7, 17, 28, 0.96)';
    context.fillRect(0, 0, width, height);
    const cellSize = radius * 2 / 12;
    for (let row = 0; row < 12; row++) {
      for (let column = 0; column < 12; column++) {
        const localX = player.root.position.x + ((column + 0.5) / 12 * 2 - 1) * range;
        const localZ = player.root.position.z + (1 - (row + 0.5) / 12 * 2) * range;
        const elevation = getHeight(localX, localZ);
        context.fillStyle = elevation > 4
          ? 'rgba(141, 76, 76, 0.38)'
          : elevation > 1.5
            ? 'rgba(106, 105, 78, 0.36)'
            : elevation < -1.5
              ? 'rgba(32, 78, 112, 0.4)'
              : 'rgba(41, 78, 91, 0.25)';
        context.fillRect(center - radius + column * cellSize, center - radius + row * cellSize, cellSize + 1, cellSize + 1);
      }
    }
    context.strokeStyle = 'rgba(84, 166, 201, 0.18)';
    context.lineWidth = 1;
    for (const fraction of [0.33, 0.66, 1]) {
      context.beginPath();
      context.arc(center, center, radius * fraction, 0, Math.PI * 2);
      context.stroke();
    }
    context.strokeStyle = 'rgba(106, 231, 255, 0.48)';
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(center, 0);
    context.lineTo(center, height);
    context.stroke();
    context.setLineDash([3, 5]);
    context.strokeStyle = 'rgba(225, 235, 255, 0.22)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(center - 13, 0);
    context.lineTo(center - 13, height);
    context.moveTo(center + 13, 0);
    context.lineTo(center + 13, height);
    context.stroke();
    context.setLineDash([]);

    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const dx = enemy.root.position.x - player.root.position.x;
      const dz = enemy.root.position.z - player.root.position.z;
      const px = center + dx / range * radius;
      const py = center - dz / range * radius;
      if (Math.hypot(px - center, py - center) > radius) continue;
      context.fillStyle = enemy.type === 'colossus' ? '#ffb74f' : '#ff4059';
      context.shadowColor = context.fillStyle;
      context.shadowBlur = enemy.type === 'colossus' ? 12 : 7;
      context.beginPath();
      context.arc(px, py, enemy.type === 'colossus' ? 5 : 3.5, 0, Math.PI * 2);
      context.fill();
    }
    context.shadowBlur = 0;
    const portalDx = -worldOffset.x - player.root.position.x;
    const portalDz = 210 - worldOffset.y - player.root.position.z;
    const portalDistance = Math.hypot(portalDx, portalDz);
    const portalScale = Math.min(radius * 0.88, portalDistance / range * radius) / (portalDistance || 1);
    const portalX = center + portalDx * portalScale;
    const portalY = center - portalDz * portalScale;
    context.fillStyle = '#ff9a75';
    context.shadowColor = '#ff6a82';
    context.shadowBlur = 9;
    context.save();
    context.translate(portalX, portalY);
    context.rotate(Math.PI / 4);
    context.fillRect(-3, -3, 6, 6);
    context.restore();
    context.shadowBlur = 0;
    context.translate(center, center);
    context.rotate(Math.atan2(player.facing.x, player.facing.z));
    context.fillStyle = '#89f4ff';
    context.beginPath();
    context.moveTo(0, -9);
    context.lineTo(-5, 5);
    context.lineTo(0, 3);
    context.lineTo(5, 5);
    context.closePath();
    context.fill();
    context.restore();
  }

  setTarget(enemy, screenX, screenY) {
    if (!enemy) {
      this.targetMarker.classList.add('hidden');
      return;
    }
    this.targetName.textContent = enemy.name;
    this.targetMarker.style.left = `${screenX}px`;
    this.targetMarker.style.top = `${screenY}px`;
    this.targetMarker.classList.remove('hidden');
  }

  triggerImpactFlash(intensity = 0.4, perfect = false, reduced = false) {
    const safeIntensity = reduced ? Math.min(intensity, 0.12) : intensity;
    this.flashIntensity = Math.max(this.flashIntensity, safeIntensity);
    this.flashDuration = Math.max(this.flashDuration, perfect ? 0.22 : 0.14);
    this.impactFlash.classList.toggle('perfect', perfect && !reduced);
  }

  updateFlash(dt) {
    if (this.flashDuration > 0) {
      this.flashDuration = Math.max(0, this.flashDuration - dt);
      const fade = Math.min(1, this.flashDuration / 0.12);
      this.impactFlash.style.opacity = String(this.flashIntensity * fade);
    } else {
      this.flashIntensity = 0;
      this.impactFlash.style.opacity = '0';
      this.impactFlash.classList.remove('perfect');
    }
  }

  showModal(title, eyebrow, message) {
    this.modalTitle.textContent = title;
    this.modalEyebrow.textContent = eyebrow;
    this.modalMessage.textContent = message;
    this.resultsPanel.classList.add('hidden');
    this.resumeButton.style.display = title === 'PAUSED' ? '' : 'none';
    this.changeWeaponButton.style.display = title === 'PAUSED' ? '' : 'none';
    this.settingsMenuButton.style.display = title === 'PAUSED' ? '' : 'none';
    this.mainMenuButton.style.display = title === 'RUN TERMINATED' || title === 'PAUSED' ? '' : 'none';
    this.continueButton.style.display = 'none';
    this.restartButton.textContent = title === 'MAIN MENU' ? 'START RUN' : 'RESTART';
    this.overlay.classList.remove('modal-paused', 'modal-game-over', 'modal-victory');
    if (title === 'PAUSED') {
      this.overlay.classList.add('modal-paused');
    } else if (title === 'RUN TERMINATED') {
      this.overlay.classList.add('modal-game-over');
    } else if (title === 'LEVEL COMPLETE' || title === 'VOID OVERLORD DEFEATED') {
      this.overlay.classList.add('modal-victory');
    }
    this.overlay.classList.remove('hidden');
  }

  showLevelComplete(definition, result, progression, summary) {
    this.showLevel(definition.level, definition, progression, {
      enemiesRemaining: 0,
      status: 'complete'
    });
    const title = result.final ? 'VOID OVERLORD DEFEATED' : definition.master ? 'FINAL LEVEL CLEARED' : 'LEVEL COMPLETE';
    const message = result.final
      ? `The VOID OVERLORD has fallen. All 15 levels are complete. Final score: ${Math.floor(summary.score)}.`
      : `Level ${String(result.completed).padStart(2, '0')} cleared. Level ${String(result.unlocked).padStart(2, '0')} is now unlocked.`;
    this.showModal(result.final ? 'VOID OVERLORD DEFEATED' : 'LEVEL COMPLETE', title, message);
    this.resultsPanel.innerHTML = [
      ['RANK', summary.rank],
      ['SCORE', String(Math.floor(summary.score)).padStart(6, '0')],
      ['HOSTILES DEFEATED', String(summary.enemies)],
      ['TIME', `${Math.floor(summary.time / 60)}:${String(Math.floor(summary.time % 60)).padStart(2, '0')}`],
      ['DAMAGE TAKEN', `${Math.round(summary.damage)} HP`],
      ['REWARD', `+${Math.floor(summary.reward)} SCORE`]
    ].map(([label, value]) => `<span>${label}</span><strong>${value}</strong>`).join('');
    this.resultsPanel.classList.remove('hidden');
    this.restartButton.textContent = 'REPLAY LEVEL';
    this.changeWeaponButton.style.display = 'none';
    this.settingsMenuButton.style.display = 'none';
    this.continueButton.style.display = result.final ? 'none' : '';
    this.mainMenuButton.style.display = '';
  }

  showCombatMessage(message, duration = 900) {
    this.combatMessage.textContent = message;
    this.combatMessage.classList.add('visible');
    this.messageTimer = duration / 1000;
  }

  hideModal() {
    this.overlay.classList.add('hidden');
    this.continueButton.style.display = 'none';
    this.resultsPanel.classList.add('hidden');
  }
}
