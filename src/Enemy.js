import * as THREE from 'three';

const ARCHETYPES = {
  scout: { name: 'SHADOW ASSASSIN', scale: 0.95, health: 76, speed: 4.4, range: 2.4, armor: 0x121418, mass: 1 },
  guardian: { name: 'HEAVY SAMURAI', scale: 1.34, health: 155, speed: 2.45, range: 2.9, armor: 0x221a1f, mass: 1.4 },
  ranged: { name: 'SHINOBI SHURIKEN', scale: 1.05, health: 115, speed: 2.95, range: 11, armor: 0x181c20, mass: 1.1 },
  elite: { name: 'ELITE SHADOW REAPER', scale: 1.45, health: 240, speed: 3.3, range: 3.3, armor: 0x281216, mass: 1.5 },
  colossus: { name: 'SHADOW SHOGUN', scale: 2.35, health: 850, speed: 1.6, range: 4.6, armor: 0x1e1525, mass: 2.6 }
};

let enemyCounter = 0;

export class Enemy {
  constructor(position, type = 'scout', options = {}) {
    this.id = ++enemyCounter;
    this.type = ARCHETYPES[type] ? type : 'scout';
    this.spec = { ...ARCHETYPES[this.type], ...(options.spec || {}) };
    this.isFinalBoss = options.isFinalBoss === true;
    this.name = options.name || (this.isFinalBoss ? 'SHADOW SHOGUN' : this.spec.name);
    this.root = new THREE.Group();
    this.root.name = `ENEMY_${this.name}_${this.id}`;
    this.root.position.copy(position);
    this.root.scale.setScalar(this.spec.scale);
    this.baseScale = this.spec.scale;
    this.root.userData.enemy = this;
    this.flankSlot = this.id % 8;

    // Cinematic Dark Japanese Shinobi & Samurai materials
    this.armorMaterial = new THREE.MeshStandardMaterial({
      color: this.isFinalBoss ? 0x25192e : this.spec.armor,
      emissive: 0x15080c,
      emissiveIntensity: 0.35,
      metalness: 0.62,
      roughness: 0.38
    });
    this.trimMaterial = new THREE.MeshStandardMaterial({
      color: 0x181a1f,
      roughness: 0.85,
      metalness: 0.12
    });
    this.goldMaterial = new THREE.MeshStandardMaterial({
      color: 0xa68546,
      emissive: 0x3d2c10,
      emissiveIntensity: 0.3,
      metalness: 0.82,
      roughness: 0.28
    });
    this.redMaterial = new THREE.MeshStandardMaterial({
      color: this.isFinalBoss ? 0x9b2438 : 0x8a1824,
      emissive: this.isFinalBoss ? 0x6e1022 : 0x540c16,
      emissiveIntensity: this.isFinalBoss ? 1.6 : 1.1,
      metalness: 0.3,
      roughness: 0.45
    });
    this.steelMaterial = new THREE.MeshStandardMaterial({
      color: 0xd2d9e0,
      metalness: 0.94,
      roughness: 0.16
    });
    this.eyeMaterial = new THREE.MeshBasicMaterial({
      color: this.isFinalBoss ? 0xff244a : 0xff1e32
    });

    const mesh = (geometry, material, pos, parent = this.root) => {
      const object = new THREE.Mesh(geometry, material);
      object.position.copy(pos);
      object.castShadow = true;
      object.receiveShadow = true;
      parent.add(object);
      return object;
    };

    const wide = this.type === 'colossus' ? 1.95 : this.type === 'guardian' || this.type === 'elite' ? 1.55 : 1.15;
    const armor = this.armorMaterial;
    const trim = this.trimMaterial;
    const gold = this.goldMaterial;
    const red = this.redMaterial;
    const steel = this.steelMaterial;

    // === TORSO & SAMURAI DO-MARU ARMOR ===
    this.torso = mesh(new THREE.BoxGeometry(wide * 0.92, 1.25, 0.65), trim, new THREE.Vector3(0, 1.68, 0));
    // Lacquered chest plate
    mesh(new THREE.BoxGeometry(wide * 0.94, 0.78, 0.2), armor, new THREE.Vector3(0, 1.78, 0.3));
    mesh(new THREE.BoxGeometry(wide * 0.85, 0.08, 0.22), gold, new THREE.Vector3(0, 1.95, 0.3));
    mesh(new THREE.BoxGeometry(wide * 0.78, 0.08, 0.22), red, new THREE.Vector3(0, 1.62, 0.3));

    // Kusazuri waist armor tassets
    mesh(new THREE.BoxGeometry(wide * 0.96, 0.24, 0.74), trim, new THREE.Vector3(0, 1.02, 0));
    for (const side of [-1, 1]) {
      const tasset = mesh(new THREE.BoxGeometry(0.38 * wide, 0.42, 0.12), armor,
        new THREE.Vector3(side * wide * 0.32, 0.88, 0.32));
      tasset.rotation.z = side * -0.15;
    }

    // === HEAD & KABUTO / MASK ===
    this.head = new THREE.Group();
    this.head.position.set(0, 2.62, 0);
    this.root.add(this.head);

    const headSize = this.type === 'colossus' ? 0.5 : this.type === 'guardian' ? 0.38 : 0.32;
    // Head base & dark cowl
    mesh(new THREE.BoxGeometry(headSize * 1.6, headSize * 1.3, headSize * 1.3), trim, new THREE.Vector3(0, 0, 0), this.head);

    // Demon / Hannya face mask (Menpo)
    mesh(new THREE.BoxGeometry(headSize * 1.48, headSize * 0.65, headSize * 0.85), red,
      new THREE.Vector3(0, -headSize * 0.28, headSize * 0.35), this.head);

    // Horned Kabuto Helmet (for Guardian, Elite, and Boss)
    if (this.type === 'guardian' || this.type === 'elite' || this.type === 'colossus') {
      // Helmet bowl
      const bowl = mesh(new THREE.SphereGeometry(headSize * 1.05, 10, 8), armor,
        new THREE.Vector3(0, headSize * 0.32, 0), this.head);
      bowl.scale.set(1.15, 0.85, 1.2);
      // Shikoro neck guard fan
      const shikoro = mesh(new THREE.CylinderGeometry(headSize * 1.4, headSize * 1.6, headSize * 0.45, 10, 1, true, Math.PI * 0.6, Math.PI * 0.8), armor,
        new THREE.Vector3(0, -0.05, -headSize * 0.2), this.head);
      shikoro.rotation.y = Math.PI * 0.1;

      // Golden Horns (Kuwagata / Maedate crest)
      for (const side of [-1, 1]) {
        const horn = mesh(new THREE.ConeGeometry(headSize * 0.18, headSize * 1.3, 5), gold,
          new THREE.Vector3(side * headSize * 0.65, headSize * 0.85, headSize * 0.3), this.head);
        horn.rotation.z = side * -0.55;
        horn.rotation.x = -0.22;
      }
      if (this.isFinalBoss) {
        // Demonic central crest
        const dragonCrest = mesh(new THREE.OctahedronGeometry(headSize * 0.42), gold,
          new THREE.Vector3(0, headSize * 0.95, headSize * 0.4), this.head);
        dragonCrest.scale.set(0.6, 1.4, 0.6);
      }
    } else if (this.type === 'ranged') {
      // Conical Bamboo Jingasa Hat
      const jingasa = mesh(new THREE.ConeGeometry(headSize * 1.8, headSize * 0.55, 12), armor,
        new THREE.Vector3(0, headSize * 0.42, 0), this.head);
      part(new THREE.TorusGeometry(headSize * 1.7, 0.025, 4, 16), gold, new THREE.Vector3(0, headSize * 0.15, 0), this.head);
    } else {
      // Shadow Assassin cowl with hitai-ate forehead plate
      mesh(new THREE.BoxGeometry(headSize * 1.5, headSize * 0.35, headSize * 0.3), armor,
        new THREE.Vector3(0, headSize * 0.25, headSize * 0.52), this.head);
    }

    // Glowing Menacing Red Eyes
    this.eyes = [];
    for (const side of [-1, 1]) {
      const eye = mesh(new THREE.BoxGeometry(headSize * 0.28, headSize * 0.1, 0.06), this.eyeMaterial,
        new THREE.Vector3(side * headSize * 0.42, 0.02, headSize * 0.72), this.head);
      eye.rotation.z = side * -0.15;
      this.eyes.push(eye);
    }

    // === ARMS & SODE SHOULDER ARMOR ===
    this.arms = [];
    this.legs = [];
    for (const side of [-1, 1]) {
      // Large Sode shoulder shield
      const sode = mesh(new THREE.BoxGeometry(0.58 * wide, 0.52, 0.18), armor,
        new THREE.Vector3(side * (wide * 0.64), 2.15, 0));
      sode.rotation.z = side * -0.15;
      mesh(new THREE.BoxGeometry(0.6 * wide, 0.06, 0.19), gold,
        new THREE.Vector3(side * (wide * 0.64), 2.38, 0));

      const arm = new THREE.Group();
      arm.position.set(side * (wide * 0.65), 1.95, 0);
      this.root.add(arm);
      mesh(new THREE.CapsuleGeometry(0.18 * wide, 0.45 * wide, 4, 8), trim, new THREE.Vector3(0, -0.36 * wide, 0), arm);
      // Armored gauntlet
      mesh(new THREE.BoxGeometry(0.28 * wide, 0.42 * wide, 0.26 * wide), armor,
        new THREE.Vector3(0, -0.42 * wide, 0.05), arm);
      this.arms.push(arm);

      // Legs in hakama & greaves
      const leg = new THREE.Group();
      leg.position.set(side * wide * 0.28, 1.02, 0);
      this.root.add(leg);
      mesh(new THREE.CapsuleGeometry(0.2 * wide, 0.48 * wide, 4, 8), trim, new THREE.Vector3(0, -0.32 * wide, 0), leg);
      mesh(new THREE.BoxGeometry(0.32 * wide, 0.45 * wide, 0.28 * wide), armor,
        new THREE.Vector3(0, -0.42 * wide, 0.06), leg);
      // Foot / Tabi boot
      mesh(new THREE.BoxGeometry(0.3 * wide, 0.18 * wide, 0.5 * wide), trim,
        new THREE.Vector3(0, -0.72 * wide, 0.08), leg);
      this.legs.push(leg);
    }

    // === ENEMY WEAPONRY (KATANA / ODACHI / NAGINATA / KUNAI) ===
    this.weapon = new THREE.Group();
    this.weapon.position.set(-wide * 0.72, 1.45, 0.2);
    this.root.add(this.weapon);

    const bladeLen = this.type === 'colossus' ? 2.8 : this.type === 'guardian' ? 1.85 : 1.35;
    // Tsuka hilt
    mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.58, 8), trim, new THREE.Vector3(0, -0.22, 0), this.weapon);
    // Tsuba guard
    const guard = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 12), gold, new THREE.Vector3(0, 0.08, 0), this.weapon);
    guard.rotation.x = Math.PI / 2;

    // Curved steel blade
    const eBladeShape = new THREE.Shape();
    eBladeShape.moveTo(-0.06, 0.1);
    eBladeShape.lineTo(-0.07, bladeLen * 0.8);
    eBladeShape.lineTo(0.01, bladeLen);
    eBladeShape.lineTo(0.08, bladeLen * 0.85);
    eBladeShape.lineTo(0.06, 0.1);
    eBladeShape.closePath();

    const eBlade = mesh(new THREE.ExtrudeGeometry(eBladeShape, {
      depth: 0.06, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: 0.02, bevelThickness: 0.02
    }), steel, new THREE.Vector3(0, 0, -0.03), this.weapon);
    eBlade.rotation.z = -0.06;

    // Cursed red edge glow
    this.bladeGlow = mesh(new THREE.BoxGeometry(0.02, bladeLen * 0.88, 0.08), red,
      new THREE.Vector3(-0.06, bladeLen * 0.48, 0), this.weapon);

    this.health = this.spec.health;
    this.maxHealth = this.health;
    this.attackDamage = this.spec.attackDamage ?? (this.type === 'colossus' ? 28 : 14);
    this.attackCooldownScale = this.spec.attackCooldownScale ?? 1;
    this.alive = true;
    this.defeated = false;
    this.rewarded = false;
    this.defeatTimer = 0;
    this.defeatDuration = 0.45;
    this.hitFlash = 0;
    this.hitStun = 0;
    this.hitCooldown = 0;
    this.knockbackVelocity = new THREE.Vector3();
    this.attackCooldown = 0.4 + Math.random() * 0.5;
    this.attackHitDone = false;
    this.attackRange = this.spec.range;
    this.attackPhase = 0;
    this.attackPattern = 0;
    this.attackPatternCount = 0;
    this.attackActive = false;
    this.attackActiveTimer = 0;
    this.vulnerableTimer = 0;
    this.phase = Math.random() * 5;
    this.arrivalTimer = Math.max(0, options.arrivalDelay ?? 1.35);
    this.arrivalDuration = Math.max(0.7, options.arrivalDuration ?? 1.35);
    this.root.visible = this.arrivalTimer <= 0;
    this.masterLevel = options.masterLevel ?? 0;
    this.healthSprite = this.createHealthSprite();
    this.healthSprite.position.set(0, 3.65, 0);
    this.healthSprite.scale.set(this.isFinalBoss ? 3.4 : 2.6, this.isFinalBoss ? 0.8 : 0.62, 1);
    this.root.add(this.healthSprite);

    if (this.type === 'colossus') {
      this.telegraphRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.5, 0.055, 8, 44),
        new THREE.MeshBasicMaterial({
          color: 0xff244a,
          transparent: true,
          opacity: 0.8,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      this.telegraphRing.rotation.x = Math.PI / 2;
      this.telegraphRing.position.y = 0.08;
      this.telegraphRing.visible = false;
      this.root.add(this.telegraphRing);

      this.telegraphBeam = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.08, 8.5),
        new THREE.MeshBasicMaterial({
          color: 0xff244a,
          transparent: true,
          opacity: 0.82,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      this.telegraphBeam.position.set(0, 0.14, 4.25);
      this.telegraphBeam.visible = false;
      this.root.add(this.telegraphBeam);
    }
  }

  createHealthSprite() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 112;
    this.healthContext = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    this.healthTexture = texture;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      sizeAttenuation: true
    }));
    sprite.renderOrder = 20;
    this.drawHealth();
    return sprite;
  }

  drawHealth() {
    const context = this.healthContext;
    const canvas = context.canvas;
    const ratio = THREE.MathUtils.clamp(this.health / this.maxHealth, 0, 1);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'rgba(12, 14, 18, 0.92)';
    context.fillRect(10, 8, 492, 96);
    context.strokeStyle = this.isFinalBoss ? 'rgba(255, 75, 100, 0.95)' : 'rgba(180, 40, 55, 0.9)';
    context.lineWidth = 4;
    context.strokeRect(10, 8, 492, 96);
    context.font = 'bold 34px Segoe UI, sans-serif';
    context.textAlign = 'center';
    context.fillStyle = '#fff4f5';
    context.shadowColor = '#ff1e38';
    context.shadowBlur = 10;
    context.fillText(this.name, 256, 46);
    context.shadowBlur = 0;
    context.fillStyle = '#220b10';
    context.fillRect(28, 64, 456, 24);
    const gradient = context.createLinearGradient(28, 0, 484, 0);
    gradient.addColorStop(0, '#c71424');
    gradient.addColorStop(1, '#ff4758');
    context.fillStyle = gradient;
    context.fillRect(28, 64, 456 * ratio, 24);
    this.healthTexture.needsUpdate = true;
  }

  moveOnGround(directionX, directionZ, dt, world, getHeight) {
    const aggression = this.isFinalBoss ? 1 + (1 - this.health / this.maxHealth) * 0.55 : 1.1;
    const moveX = directionX * this.spec.speed * aggression * dt;
    const moveZ = directionZ * this.spec.speed * aggression * dt;
    const steps = Math.max(1, Math.ceil(Math.hypot(moveX, moveZ) / 0.5));
    for (let step = 0; step < steps; step++) {
      this.root.position.x += moveX / steps;
      this.root.position.z += moveZ / steps;
      world?.resolveFeatureCollision(this.root.position, 0.65 * this.spec.scale);
    }
    this.root.position.y = getHeight(this.root.position.x, this.root.position.z);
  }

  update(dt, player, camera, getHeight, world = null, allEnemies = []) {
    if (!this.alive) {
      if (this.defeated && this.defeatTimer > 0) {
        this.defeatTimer = Math.max(0, this.defeatTimer - dt);
        const progress = this.defeatTimer / this.defeatDuration;
        this.root.scale.setScalar(this.baseScale * Math.max(0.04, progress));
        this.root.rotation.z = (1 - progress) * 0.6;
        this.root.rotation.y += dt * 1.8;
        this.root.position.y += dt * 1.4;
      }
      return;
    }

    if (this.arrivalTimer > 0) {
      this.arrivalTimer = Math.max(0, this.arrivalTimer - dt);
      const progress = 1 - this.arrivalTimer / this.arrivalDuration;
      this.root.visible = progress > 0.1;
      this.root.scale.setScalar(this.baseScale * Math.max(0.08, Math.min(1, progress)));
      this.root.position.y = getHeight(this.root.position.x, this.root.position.z) + (1 - progress) * 1.2;
      if (this.arrivalTimer > 0) return;
      this.root.visible = true;
      this.root.scale.setScalar(this.baseScale);
      this.root.position.y = getHeight(this.root.position.x, this.root.position.z);
      this.attackCooldown = Math.max(this.attackCooldown, 0.5);
    }

    this.phase += dt;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.hitStun = Math.max(0, this.hitStun - dt);
    this.vulnerableTimer = Math.max(0, this.vulnerableTimer - dt);

    // Repulsion between enemies to prevent stacking/clipping
    if (allEnemies && allEnemies.length > 1) {
      for (const other of allEnemies) {
        if (other === this || !other.alive) continue;
        const ex = this.root.position.x - other.root.position.x;
        const ez = this.root.position.z - other.root.position.z;
        const sepDist = Math.hypot(ex, ez);
        const minDist = (this.spec.scale + other.spec.scale) * 0.85;
        if (sepDist > 0.001 && sepDist < minDist) {
          const push = (minDist - sepDist) * 1.8 * dt;
          this.root.position.x += (ex / sepDist) * push;
          this.root.position.z += (ez / sepDist) * push;
        }
      }
    }

    // Coordinated Flanking Targeting:
    // Enemies calculate flanking angles around the ninja rather than walking in a single file
    const flankAngle = (this.flankSlot / 8) * Math.PI * 2 + Math.sin(this.phase * 0.8) * 0.45;
    const surroundDist = this.attackRange * (this.type === 'ranged' ? 2.5 : 0.88);
    const targetX = player.root.position.x + Math.sin(flankAngle) * surroundDist;
    const targetZ = player.root.position.z + Math.cos(flankAngle) * surroundDist;

    const dx = targetX - this.root.position.x;
    const dz = targetZ - this.root.position.z;
    const distToTarget = Math.hypot(dx, dz) || 1;

    // Actual distance to ninja
    const ninjaDx = player.root.position.x - this.root.position.x;
    const ninjaDz = player.root.position.z - this.root.position.z;
    const ninjaDist = Math.hypot(ninjaDx, ninjaDz) || 1;

    // Face the player directly
    const targetYaw = Math.atan2(ninjaDx, ninjaDz);
    const yawDelta = Math.atan2(
      Math.sin(targetYaw - this.root.rotation.y),
      Math.cos(targetYaw - this.root.rotation.y)
    );
    this.root.rotation.y += THREE.MathUtils.clamp(yawDelta, -dt * 3.4, dt * 3.4);

    // Eye telegraph glow during attack windup
    const isWindingUp = this.attackPhase > 0 && !this.attackHitDone;
    for (const eye of this.eyes) {
      eye.scale.set(isWindingUp ? 1.6 : 1, isWindingUp ? 1.6 : 1, 1);
    }
    if (this.bladeGlow) {
      this.bladeGlow.material.emissiveIntensity = isWindingUp ? 2.8 : 1.1;
    }

    // === ATTACK LOGIC & COCHOREOGRAPHY ===
    if (this.type === 'colossus') {
      if (this.attackActiveTimer > 0) {
        this.attackActiveTimer = Math.max(0, this.attackActiveTimer - dt);
        this.attackPhase = this.attackActiveTimer;
        if (this.attackActiveTimer === 0) {
          this.attackActive = false;
          this.attackPhase = 0;
          this.vulnerableTimer = 1.2;
          this.attackCooldown = this.isFinalBoss ? 1.1 : 1.4;
        }
      } else if (this.attackPhase > 0) {
        this.attackPhase = Math.max(0, this.attackPhase - dt);
        if (this.attackPhase === 0) {
          this.attackActive = true;
          this.attackActiveTimer = 0.28;
          this.attackPhase = this.attackActiveTimer;
          this.attackHitDone = false;
          if (this.telegraphRing) this.telegraphRing.visible = false;
        }
      } else if (this.hitStun <= 0 && ninjaDist < 20 && this.attackCooldown <= 0) {
        this.attackPattern = this.attackPatternCount++ % 3;
        this.attackPhase = 0.95;
        this.attackHitDone = false;
        this.attackCooldown = 1.8;
        if (this.telegraphRing) {
          this.telegraphRing.visible = this.attackPattern !== 2;
          this.telegraphRing.scale.setScalar([2.0, 3.8, 5.2][this.attackPattern]);
        }
        if (this.telegraphBeam) {
          this.telegraphBeam.visible = this.attackPattern === 2;
        }
      }

      if (this.hitStun > 0) {
        this.root.rotation.z = Math.sin(this.phase * 28) * 0.08;
      } else if (ninjaDist > this.attackRange) {
        this.root.rotation.z = 0;
        this.moveOnGround(dx / distToTarget, dz / distToTarget, dt, world, getHeight);
      }
    } else if (this.hitStun > 0) {
      this.root.rotation.z = Math.sin(this.phase * 28) * 0.09;
      this.attackPhase = Math.max(0, this.attackPhase - dt * 1.8);
    } else if (this.type === 'ranged' && ninjaDist < 7) {
      // Shuriken master retreats to maintain ranged distance
      this.root.rotation.z = 0;
      this.moveOnGround(-ninjaDx / ninjaDist, -ninjaDz / ninjaDist, dt, world, getHeight);
      if (this.attackCooldown <= 0 && this.attackPhase <= 0) {
        this.attackPhase = 0.55;
        this.attackCooldown = 1.6 * this.attackCooldownScale;
        this.attackHitDone = false;
      }
    } else if (ninjaDist > this.attackRange) {
      // Move via coordinated flanking vector
      this.root.rotation.z = 0;
      this.moveOnGround(dx / distToTarget, dz / distToTarget, dt, world, getHeight);
    } else {
      // In combat range: coordinated simultaneous attack!
      if (this.attackCooldown <= 0 && this.attackPhase <= 0) {
        this.attackPhase = 0.42; // Fast windup telegraph
        this.attackCooldown = (this.type === 'scout' ? 0.75 : 1.15) * this.attackCooldownScale;
        this.attackHitDone = false;
      }
    }

    // Arm swing animation during attack
    if (this.attackPhase > 0) {
      const swing = Math.sin(this.phase * 18);
      this.weapon.rotation.z = -swing * 0.8;
      if (this.arms[1]) this.arms[1].rotation.x = -swing * 1.2;
    } else {
      this.weapon.rotation.z = 0;
      if (this.arms[1]) this.arms[1].rotation.x = 0;
    }

    // Knockback physics
    const knockback = this.knockbackVelocity;
    const knockbackDistance = Math.hypot(knockback.x, knockback.z) * dt;
    const steps = Math.max(1, Math.ceil(knockbackDistance / 0.45));
    for (let step = 0; step < steps; step++) {
      this.root.position.x += knockback.x * dt / steps;
      this.root.position.z += knockback.z * dt / steps;
      const brokenFeature = world?.damageBreakableAt(this.root.position, Math.hypot(knockback.x, knockback.z));
      if (brokenFeature) this.breakImpact = brokenFeature;
      else world?.resolveFeatureCollision(this.root.position, 0.65 * this.spec.scale);
    }
    this.root.position.y += knockback.y * dt;
    knockback.y -= 24 * dt;
    if (this.root.position.y <= getHeight(this.root.position.x, this.root.position.z)) {
      this.root.position.y = getHeight(this.root.position.x, this.root.position.z);
      knockback.y = 0;
    }
    knockback.x *= Math.max(0, 1 - 7.5 * dt);
    knockback.z *= Math.max(0, 1 - 7.5 * dt);
  }
}
