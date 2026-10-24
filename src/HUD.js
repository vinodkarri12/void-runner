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
    this.levelSelectModalButton = document.getElementById('levelSelectModalButton');
    this.weaponUnlockOverlay = document.getElementById('weaponUnlockOverlay');
    this.weaponUnlockIcon = document.getElementById('weaponUnlockIcon');
    this.unlockedWeaponName = document.getElementById('unlockedWeaponName');
    this.unlockedWeaponDesc = document.getElementById('unlockedWeaponDesc');
    this.equipUnlockedWeaponBtn = document.getElementById('equipUnlockedWeaponBtn');
    this.closeUnlockOverlayBtn = document.getElementById('closeUnlockOverlayBtn');
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

    // Reference & HD Performance HUD Elements
    this.hudEnergyText = document.getElementById('hudEnergyText');
    this.hudEnergyBar = document.getElementById('hudEnergyBar');
    this.hudMissionName = document.getElementById('hudMissionName');
    this.hudScoreText = document.getElementById('hudScoreText');
    this.hudDefeatedKills = document.getElementById('hudDefeatedKills');
    this.hudTopSpeed = document.getElementById('hudTopSpeed');
    this.hudTopBoost = document.getElementById('hudTopBoost');
    this.hudTopBoostLabel = document.getElementById('hudTopBoostLabel');

    // Cached ability status nodes to avoid repeated per-frame document.getElementById lookups
    this.statusNodes = {
      qStatus: document.getElementById('qStatus'),
      fStatus: document.getElementById('fStatus'),
      eStatus: document.getElementById('eStatus'),
      rStatus: document.getElementById('rStatus'),
      tStatus: document.getElementById('tStatus'),
      gStatus: document.getElementById('gStatus'),
      vStatus: document.getElementById('vStatus'),
      xStatus: document.getElementById('xStatus'),
      zStatus: document.getElementById('zStatus'),
      equippedHudWeapon: document.getElementById('equippedHudWeapon'),
      hudComboBadge: document.getElementById('hudComboBadge'),
      bossName: document.getElementById('bossName')
    };

    // Performance dirty-checking caches
    this._cache = {
      score: -1,
      combo: -1,
      defeated: -1,
      enemiesRemaining: -1,
      wave: -1,
      hp: -1,
      maxHp: -1,
      energy: -1,
      weaponText: '',
      topSpeed: '',
      boostState: '',
      missionText: '',
      levelProgressRatio: -1,
      levelStatusText: ''
    };

    this.messageTimer = 0;
    this.flashIntensity = 0;
    this.flashDuration = 0;
    this.mapRefresh = 0;
  }

  update(player, enemies, wave, worldOffset = { x: 0, y: 0 }, getHeight = () => 0, combat = null, target = null, defeated = 0, abilities = {}) {
    this.updateAttackButton(player.weaponConfig, player);

    // Equipped weapon display with caching
    const equippedNode = this.statusNodes.equippedHudWeapon;
    if (equippedNode) {
      let weaponText = '';
      if (player.weaponConfig?.category === 'ranged') {
        const ammoText = player.gunReloadTimer > 0
          ? `RELOADING ${(player.gunReloadDuration - player.gunReloadTimer).toFixed(1)}s`
          : `AMMO ${player.gunAmmo} / ${player.gunMaxAmmo}`;
        weaponText = `${player.weaponConfig?.name || 'VOID FIREARM'} [${ammoText}]`;
      } else {
        weaponText = player.weaponConfig?.name || 'SHADOW KATANA';
      }
      if (this._cache.weaponText !== weaponText) {
        this._cache.weaponText = weaponText;
        equippedNode.textContent = weaponText;
      }
    }

    // Score & Multiplier with caching
    const curScore = Math.floor(player.score);
    if (this._cache.score !== curScore) {
      this._cache.score = curScore;
      const scoreStr = String(curScore).padStart(6, '0');
      this.scoreValue.textContent = scoreStr;
      if (this.hudScoreText) this.hudScoreText.textContent = `SCORE ${scoreStr}`;
    }

    // Combo counter with caching
    if (this._cache.combo !== player.combo) {
      this._cache.combo = player.combo;
      this.comboValue.textContent = player.combo > 1 ? `COMBO: ${player.combo}x` : `COMBO: 1x`;
      const comboBadge = this.statusNodes.hudComboBadge;
      if (comboBadge) comboBadge.classList.toggle('active', player.combo > 1);
    }
    this.scoreMultiplier.textContent = `SCORE x${player.scoreMultiplier ?? 1}`;

    // Defeated enemies counter with caching
    if (this._cache.defeated !== defeated) {
      this._cache.defeated = defeated;
      this.defeatedValue.textContent = String(defeated);
      if (this.hudDefeatedKills) this.hudDefeatedKills.textContent = String(defeated);
    }

    // Enemies remaining counter with caching
    const remaining = abilities.enemiesRemaining ?? enemies.filter((e) => e.alive).length;
    if (this._cache.enemiesRemaining !== remaining) {
      this._cache.enemiesRemaining = remaining;
      this.enemyValue.textContent = `Enemies: ${remaining}`;
    }

    // Level number
    if (this.levelValue && wave && this._cache.wave !== wave) {
      this._cache.wave = wave;
      this.levelValue.textContent = `LEVEL ${String(wave).padStart(2, '0')} / 15`;
    }

    // Player Health
    this.updateHealthHUD(player);

    // Player Energy / Stamina with caching
    const engVal = Math.ceil(player.energy);
    if (this._cache.energy !== engVal) {
      this._cache.energy = engVal;
      const engPct = Math.max(0, player.energy);
      if (this.hudEnergyText) this.hudEnergyText.textContent = `${engVal} / 100`;
      if (this.hudEnergyBar) this.hudEnergyBar.style.width = `${engPct}%`;
      this.energyText.textContent = `${engVal}/100`;
      this.energyBar.style.width = `${engPct}%`;
      this.weaponEnergyText.textContent = `${engVal}%`;
      this.weaponEnergyBar.style.width = `${engPct}%`;
    }

    // Impact discharge & overdrive
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

    // Ability cooldowns using cached DOM references
    const setCachedStatus = (node, remaining) => {
      if (!node) return;
      const text = remaining > 0 ? `${remaining.toFixed(1)}s` : 'READY';
      if (node.textContent !== text) node.textContent = text;
      node.classList.toggle('cooling', remaining > 0);
    };
    setCachedStatus(this.statusNodes.qStatus, combat?.cooldowns.strike ?? 0);
    setCachedStatus(this.statusNodes.fStatus, combat?.cooldowns.slash ?? 0);
    setCachedStatus(this.statusNodes.eStatus, player.dashTimer);
    setCachedStatus(this.statusNodes.rStatus, combat?.cooldowns.charge ?? 0);
    setCachedStatus(this.statusNodes.tStatus, player.overdriveTimer > 0 ? player.overdriveTimer : player.overdriveCooldown);
    setCachedStatus(this.statusNodes.gStatus, abilities.cloneCooldown ?? 0);
    setCachedStatus(this.statusNodes.vStatus, abilities.chainCooldown ?? 0);

    const anchorNode = this.statusNodes.xStatus;
    if (anchorNode) {
      const aText = abilities.anchorCooldown > 0
        ? `${abilities.anchorCooldown.toFixed(1)}s`
        : abilities.anchored ? 'LOCKED' : 'READY';
      if (anchorNode.textContent !== aText) anchorNode.textContent = aText;
      anchorNode.classList.toggle('cooling', abilities.anchorCooldown > 0);
    }

    const execNode = this.statusNodes.zStatus;
    if (execNode) {
      const zText = abilities.executionCooldown > 0
        ? `${abilities.executionCooldown.toFixed(1)}s`
        : abilities.executionAvailable ? 'READY' : 'NO TARGET';
      if (execNode.textContent !== zText) execNode.textContent = zText;
      execNode.classList.toggle('cooling', abilities.executionCooldown > 0 || !abilities.executionAvailable);
    }

    // Boss health panel
    const boss = enemies.find((enemy) => enemy.alive && enemy.type === 'colossus');
    this.bossHealthPanel.classList.toggle('hidden', !boss);
    if (boss) {
      if (this.statusNodes.bossName) this.statusNodes.bossName.textContent = boss.name;
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

    // Speed display
    const speedStr = player.horizontalSpeed.toFixed(1).padStart(4, '0');
    this.speedValue.textContent = speedStr;
    if (this.hudTopSpeed && this._cache.topSpeed !== speedStr) {
      this._cache.topSpeed = speedStr;
      this.hudTopSpeed.textContent = speedStr;
    }

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

    // Top-Right Telemetry Boost Indicator
    if (this.hudTopBoost && this.hudTopBoostLabel) {
      const boostKey = `${isBoosting}_${inCooldown}_${boostPct}`;
      if (this._cache.boostState !== boostKey) {
        this._cache.boostState = boostKey;
        this.hudTopBoost.className = 'hud-telemetry-boost' + (isBoosting ? ' is-active' : inCooldown ? ' is-cooling' : '');
        this.hudTopBoostLabel.textContent = isBoosting
          ? 'BOOST SURGE'
          : inCooldown
            ? `COOLING ${(player.boostCooldownTimer || 0).toFixed(1)}s`
            : boostPct < 100
              ? `BOOST ${boostPct}%`
              : 'BOOST READY';
      }
    }

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
    if (this.levelValue) this.levelValue.textContent = `LEVEL ${String(level).padStart(2, '0')} / 15`;

    const missionText = definition.master ? `MASTER // ${definition.title}` : definition.title;
    if (this.hudMissionName && this._cache.missionText !== missionText) {
      this._cache.missionText = missionText;
      this.hudMissionName.textContent = missionText;
    }
    if (this.levelTitle) this.levelTitle.textContent = missionText;
    if (this.levelObjective) this.levelObjective.textContent = definition.objective;
    if (this.unlockedLevel) this.unlockedLevel.textContent = `UNLOCKED: ${String(progression.unlockedLevel).padStart(2, '0')}  //  CLEARED: ${progression.completedCount}`;

    const completed = progression.completedLevels.has(level) && state.status === undefined;
    const ratio = state.status === 'complete' || completed
      ? 1
      : state.status === 'active'
        ? Math.min(1, (definition.requiredKills - (state.enemiesRemaining ?? definition.requiredKills)) / definition.requiredKills)
        : 0;
    if (this.levelProgress && this._cache.levelProgressRatio !== ratio) {
      this._cache.levelProgressRatio = ratio;
      this.levelProgress.style.width = `${ratio * 100}%`;
    }

    const defeated = definition.requiredKills - (state.enemiesRemaining ?? definition.requiredKills);
    const waveLabel = state.waveCount > 1 ? `WAVE ${state.waveIndex || 1}/${state.waveCount} // ` : '';
    const statusText = state.status === 'complete' || completed
      ? 'LEVEL CLEARED'
      : state.status === 'spawning'
        ? `${waveLabel}PORTAL ARRIVALS // ${defeated} / ${definition.requiredKills}`
        : `${waveLabel}HOSTILES ${defeated} / ${definition.requiredKills}`;
    if (this.levelProgressText && this._cache.levelStatusText !== statusText) {
      this._cache.levelStatusText = statusText;
      this.levelProgressText.textContent = statusText;
    }

    this.levelTitle.classList.toggle('master-level-title', definition.master);
    this.campaignPanel.classList.toggle('master-arena', definition.master);
  }

  updateHealthHUD(player) {
    const curHp = Math.ceil(player.health);
    if (this._cache.hp !== curHp || this._cache.maxHp !== player.maxHealth) {
      this._cache.hp = curHp;
      this._cache.maxHp = player.maxHealth;
      this.healthText.textContent = `HP: ${curHp} / ${player.maxHealth}`;
      this.healthBar.style.width = `${Math.max(0, player.health / player.maxHealth * 100)}%`;
      this.healthBar.classList.toggle('critical', player.health <= player.maxHealth * 0.3);
    }
  }

  drawMinimap(player, enemies, worldOffset, getHeight) {
    // Performance optimization: skip 144 terrain noise calculations when minimap is hidden
    if (!this.minimap || this.minimap.offsetParent === null) return;

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
    const isPaused = title === 'PAUSED';
    const isGameOver = title === 'GAME OVER' || title === 'RUN TERMINATED';
    const isVictory = title === 'LEVEL COMPLETE' || title === 'VOID OVERLORD DEFEATED';

    this.resumeButton.style.display = isPaused ? '' : 'none';
    this.changeWeaponButton.style.display = isPaused ? '' : 'none';
    this.settingsMenuButton.style.display = isPaused ? '' : 'none';
    this.mainMenuButton.style.display = isGameOver || isPaused || isVictory ? '' : 'none';
    this.continueButton.style.display = 'none';
    if (this.levelSelectModalButton) {
      this.levelSelectModalButton.textContent = isGameOver ? 'RETURN TO LEVEL SELECTION' : 'LEVEL SELECTION';
      this.levelSelectModalButton.style.display = isGameOver || isPaused || isVictory ? '' : 'none';
    }
    this.restartButton.textContent = isGameOver ? 'RESTART LEVEL' : isVictory ? 'REPLAY LEVEL' : title === 'MAIN MENU' ? 'START RUN' : 'RESTART';
    this.restartButton.style.display = '';

    this.overlay.classList.remove('modal-paused', 'modal-game-over', 'modal-victory');
    if (isPaused) {
      this.overlay.classList.add('modal-paused');
    } else if (isGameOver) {
      this.overlay.classList.add('modal-game-over');
    } else if (isVictory) {
      this.overlay.classList.add('modal-victory');
    }
    this.overlay.classList.remove('hidden');
  }

  showGameOver(level, definition = {}) {
    const lvlNum = String(level).padStart(2, '0');
    const title = definition.title || 'SANCTUARY TRIAL';
    this.modalTitle.textContent = 'GAME OVER';
    this.modalEyebrow.textContent = `LEVEL ${lvlNum} // SHINOBI DEFEATED`;
    this.modalMessage.textContent = `Your shadow has fallen in "${title}". The path of the ninja demands resilience. Rise and restart the level.`;
    this.resultsPanel.classList.add('hidden');
    this.resumeButton.style.display = 'none';
    this.continueButton.style.display = 'none';
    this.changeWeaponButton.style.display = 'none';
    this.settingsMenuButton.style.display = 'none';
    this.restartButton.textContent = 'RESTART LEVEL';
    this.restartButton.style.display = '';
    if (this.levelSelectModalButton) {
      this.levelSelectModalButton.textContent = 'RETURN TO LEVEL SELECTION';
      this.levelSelectModalButton.style.display = '';
    }
    this.mainMenuButton.style.display = '';
    this.overlay.classList.remove('modal-paused', 'modal-victory');
    this.overlay.classList.add('modal-game-over');
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
    if (this.levelSelectModalButton) this.levelSelectModalButton.style.display = '';
    this.continueButton.style.display = result.final ? 'none' : '';
    this.mainMenuButton.style.display = '';
  }

  showWeaponUnlocked(weapon, onEquip, onContinue) {
    if (!this.weaponUnlockOverlay) return;
    if (this.unlockedWeaponName) this.unlockedWeaponName.textContent = weapon.name;
    if (this.unlockedWeaponDesc) this.unlockedWeaponDesc.textContent = weapon.description;
    if (this.weaponUnlockIcon) this.weaponUnlockIcon.textContent = weapon.icon || '⌖';
    this.weaponUnlockOverlay.classList.remove('hidden');
    this.weaponUnlockOverlay.classList.add('active');

    const cleanup = () => {
      this.weaponUnlockOverlay.classList.remove('active');
      this.weaponUnlockOverlay.classList.add('hidden');
      if (this.equipUnlockedWeaponBtn) this.equipUnlockedWeaponBtn.onclick = null;
      if (this.closeUnlockOverlayBtn) this.closeUnlockOverlayBtn.onclick = null;
    };

    if (this.equipUnlockedWeaponBtn) {
      this.equipUnlockedWeaponBtn.onclick = (e) => {
        e?.preventDefault();
        cleanup();
        onEquip?.(weapon);
      };
    }
    if (this.closeUnlockOverlayBtn) {
      this.closeUnlockOverlayBtn.onclick = (e) => {
        e?.preventDefault();
        cleanup();
        onContinue?.();
      };
    }
  }

  showCombatMessage(message, duration = 900) {
    this.combatMessage.textContent = message;
    this.combatMessage.classList.add('visible');
    this.messageTimer = duration / 1000;
  }

  updateAttackButton(weaponConfig, player) {
    const isRanged = weaponConfig?.category === 'ranged';
    const attackBtn = document.getElementById('attackButton');
    const attackIconKatana = document.getElementById('attackIconKatana');
    const attackIconGun = document.getElementById('attackIconGun');
    const attackAmmoBadge = document.getElementById('attackAmmoBadge');
    const attackBtnLabel = document.getElementById('attackButtonLabel');
    const mobileWeaponIcon = document.getElementById('mobileWeaponIcon');
    const mobileWeaponName = document.getElementById('mobileWeaponName');

    if (attackBtn) {
      attackBtn.classList.toggle('weapon-katana', !isRanged);
      attackBtn.classList.toggle('weapon-gun', isRanged);
    }
    if (attackIconKatana) attackIconKatana.classList.toggle('hidden', isRanged);
    if (attackIconGun) attackIconGun.classList.toggle('hidden', !isRanged);

    if (attackAmmoBadge) {
      if (isRanged && player) {
        attackAmmoBadge.classList.remove('hidden');
        if (player.gunReloadTimer > 0) {
          attackAmmoBadge.textContent = 'RELOAD';
          attackAmmoBadge.classList.add('status-reloading');
        } else {
          attackAmmoBadge.textContent = `${player.gunAmmo ?? 6}/${player.gunMaxAmmo ?? 6}`;
          attackAmmoBadge.classList.remove('status-reloading');
        }
      } else {
        attackAmmoBadge.classList.add('hidden');
      }
    }

    if (attackBtnLabel) {
      attackBtnLabel.textContent = isRanged ? 'FIRE' : 'ATTACK';
    }
    if (mobileWeaponIcon) {
      mobileWeaponIcon.textContent = isRanged ? '🔫' : '⚔';
    }
    if (mobileWeaponName) {
      mobileWeaponName.textContent = isRanged ? 'FIREARM' : 'KATANA';
    }
  }

  applyHUDVisibility(settings) {
    if (!settings) return;
    const minimapWrap = document.querySelector('.minimap-panel');
    if (minimapWrap) minimapWrap.style.display = settings.hudMinimap === false ? 'none' : '';
    const speedPanel = document.querySelector('.speed-panel');
    if (speedPanel) speedPanel.style.display = settings.hudStats === false ? 'none' : '';
    const campaignPanel = document.querySelector('.campaign-panel');
    if (campaignPanel) campaignPanel.style.display = settings.hudObjective === false ? 'none' : '';
  }

  hideModal() {
    this.overlay.classList.add('hidden');
    this.continueButton.style.display = 'none';
    this.resultsPanel.classList.add('hidden');
  }
}
