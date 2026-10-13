import * as THREE from 'three';

const ARCHETYPES = {
  scout: { name: 'RED SCOUT', scale: 0.92, health: 72, speed: 4.2, range: 2.2, armor: 0x303743, mass: 1 },
  guardian: { name: 'IRON GUARDIAN', scale: 1.3, health: 145, speed: 2.35, range: 2.8, armor: 0x45404a, mass: 1.35 },
  ranged: { name: 'RIFT ARTILLERIST', scale: 1.05, health: 112, speed: 2.8, range: 11, armor: 0x394052, mass: 1.1 },
  elite: { name: 'ELITE REAVER', scale: 1.42, health: 230, speed: 3.1, range: 3.1, armor: 0x4c3859, mass: 1.5 },
  colossus: { name: 'VOID COLOSSUS', scale: 2.25, health: 780, speed: 1.45, range: 4.2, armor: 0x34323d, mass: 2.5 }
};

export class Enemy {
  constructor(position, type = 'scout', options = {}) {
    this.type = ARCHETYPES[type] ? type : 'scout';
    this.spec = { ...ARCHETYPES[this.type], ...(options.spec || {}) };
    this.isFinalBoss = options.isFinalBoss === true;
    this.name = options.name || this.spec.name;
    this.root = new THREE.Group();
    this.root.position.copy(position);
    this.root.scale.setScalar(this.spec.scale);
    this.baseScale = this.spec.scale;
    this.root.userData.enemy = this;

    this.armorMaterial = new THREE.MeshStandardMaterial({
      color: this.isFinalBoss ? 0x594766 : this.spec.armor,
      emissive: 0x100609,
      emissiveIntensity: 0.32,
      metalness: 0.58,
      roughness: 0.44
    });
    this.armorBaseColor = new THREE.Color(this.isFinalBoss ? 0x594766 : this.spec.armor)
      .lerp(new THREE.Color(0x101820), 0.3);
    this.armorMaterial.color.copy(this.armorBaseColor);
    this.trimMaterial = new THREE.MeshStandardMaterial({
      color: 0x20272d,
      emissive: 0x19040a,
      emissiveIntensity: 0.38,
      metalness: 0.56,
      roughness: 0.46
    });
    this.edgeMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a5862,
      metalness: 0.72,
      roughness: 0.38
    });
    this.jointMaterial = new THREE.MeshStandardMaterial({
      color: 0x252a30,
      metalness: 0.46,
      roughness: 0.56
    });
    this.visorMaterial = new THREE.MeshStandardMaterial({
      color: 0x080d12,
      metalness: 0.72,
      roughness: 0.2
    });
    this.redMaterial = new THREE.MeshStandardMaterial({
      color: this.isFinalBoss ? 0x9b4db5 : 0x76232b,
      emissive: this.isFinalBoss ? 0x6f2094 : 0x500810,
      emissiveIntensity: this.isFinalBoss ? 1.5 : this.type === 'colossus' ? 1.2 : 0.85,
      metalness: 0.46,
      roughness: 0.32
    });
    this.eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xb01b2a });

    const mesh = (geometry, material, position, parent = this.root) => {
      const object = new THREE.Mesh(geometry, material);
      object.position.copy(position);
      object.castShadow = true;
      object.receiveShadow = true;
      parent.add(object);
      return object;
    };
    const armor = this.armorMaterial;
    const trim = this.trimMaterial;
    const edge = this.edgeMaterial;
    const joint = this.jointMaterial;
    const red = this.redMaterial;
    const wide = this.type === 'colossus' ? 1.9 : this.type === 'guardian' || this.type === 'elite' ? 1.52 : 1.12;

    this.torso = mesh(new THREE.BoxGeometry(wide, 1.28, 0.62), joint, new THREE.Vector3(0, 1.68, 0));
    mesh(new THREE.BoxGeometry(wide * 0.94, 0.8, 0.18), armor, new THREE.Vector3(0, 1.78, 0.31));
    const chestShape = new THREE.Shape();
    chestShape.moveTo(-wide * 0.39, 0.28);
    chestShape.lineTo(-wide * 0.46, 0.02);
    chestShape.lineTo(-wide * 0.32, -0.31);
    chestShape.lineTo(0, -0.42);
    chestShape.lineTo(wide * 0.32, -0.31);
    chestShape.lineTo(wide * 0.46, 0.02);
    chestShape.lineTo(wide * 0.39, 0.28);
    chestShape.lineTo(0, 0.4);
    chestShape.closePath();
    mesh(new THREE.ExtrudeGeometry(chestShape, {
      depth: 0.12, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: 0.045, bevelThickness: 0.025
    }), armor, new THREE.Vector3(0, 1.77, 0.405));
    mesh(new THREE.BoxGeometry(wide * 0.74, 0.085, 0.045), edge, new THREE.Vector3(0, 1.89, 0.55));
    mesh(new THREE.BoxGeometry(wide * 0.55, 0.11, 0.05), red, new THREE.Vector3(0, 1.63, 0.55));
    mesh(new THREE.BoxGeometry(0.075, 0.3, 0.045), trim, new THREE.Vector3(0, 1.61, 0.57));
    mesh(new THREE.BoxGeometry(wide * 0.94, 0.2, 0.72), trim, new THREE.Vector3(0, 1.02, 0));
    mesh(new THREE.BoxGeometry(wide * 0.82, 0.08, 0.77), armor, new THREE.Vector3(0, 1.09, 0.02));
    mesh(new THREE.BoxGeometry(wide * 0.57, 0.055, 0.06), red, new THREE.Vector3(0, 1.06, 0.42));
    for (const side of [-1, 1]) {
      mesh(new THREE.BoxGeometry(0.11, 0.22, 0.16), edge,
        new THREE.Vector3(side * wide * 0.27, 1.04, 0.31));
    }

    this.head = new THREE.Group();
    this.head.position.set(0, 2.62, 0);
    this.root.add(this.head);
    const headSize = this.type === 'colossus' ? 0.48 : this.type === 'guardian' ? 0.36 : 0.31;
    mesh(new THREE.BoxGeometry(headSize * 1.75, headSize * 1.28, headSize * 1.3), joint,
      new THREE.Vector3(0, -0.025, 0), this.head);
    mesh(new THREE.BoxGeometry(headSize * 1.58, headSize * 0.82, headSize * 1.1), armor,
      new THREE.Vector3(0, 0.045, 0.045), this.head);
    mesh(new THREE.BoxGeometry(headSize * 1.55, 0.23, 0.09), this.visorMaterial,
      new THREE.Vector3(0, 0.015, headSize * 0.69), this.head);
    mesh(new THREE.BoxGeometry(headSize * 1.4, 0.075, 0.045), red,
      new THREE.Vector3(0, 0.022, headSize * 0.79), this.head);
    mesh(new THREE.BoxGeometry(headSize * 1.66, 0.065, 0.09), edge,
      new THREE.Vector3(0, 0.16, headSize * 0.67), this.head);
    mesh(new THREE.BoxGeometry(headSize * 0.46, headSize * 0.42, 0.12), armor,
      new THREE.Vector3(0, -headSize * 0.39, headSize * 0.4), this.head);
    for (const side of [-1, 1]) {
      const optic = mesh(new THREE.SphereGeometry(this.type === 'colossus' ? 0.055 : 0.04, 8, 6), this.eyeMaterial,
        new THREE.Vector3(side * headSize * 0.5, 0.015, headSize * 0.8), this.head);
      optic.scale.set(1.4, 0.7, 0.45);
      const horn = mesh(new THREE.ConeGeometry(this.type === 'colossus' ? 0.17 : 0.12,
        this.type === 'colossus' ? 0.9 : 0.52, 5), armor,
        new THREE.Vector3(side * headSize * 0.7, 0.2, -0.015), this.head);
      horn.rotation.z = -side * 0.65;
    }

    this.arms = [];
    this.legs = [];
    for (const side of [-1, 1]) {
      const shoulder = mesh(new THREE.SphereGeometry(0.31 * wide, 9, 7), armor,
        new THREE.Vector3(side * (wide * 0.59), 2.05, 0));
      shoulder.scale.set(1.28, 0.84, 1.3);
      shoulder.rotation.z = side * -0.08;
      const shoulderPlate = mesh(new THREE.BoxGeometry(0.62 * wide, 0.42, 0.18), armor,
        new THREE.Vector3(side * (wide * 0.62), 2.13, 0.22));
      shoulderPlate.rotation.z = side * -0.12;
      mesh(new THREE.BoxGeometry(0.48 * wide, 0.1, 0.1), trim,
        new THREE.Vector3(side * (wide * 0.62), 1.91, 0.26));
      mesh(new THREE.BoxGeometry(0.48 * wide, 0.075, 0.045), edge,
        new THREE.Vector3(side * (wide * 0.62), 1.94, 0.32));
      mesh(new THREE.BoxGeometry(0.2 * wide, 0.045, 0.035), red,
        new THREE.Vector3(side * (wide * 0.62), 2.19, 0.32));
      const shoulderSpike = mesh(new THREE.ConeGeometry(0.1 * wide, 0.34 * wide, 5), armor,
        new THREE.Vector3(side * (wide * 0.73), 2.2, 0.01));
      shoulderSpike.rotation.z = -side * 0.42;

      const arm = new THREE.Group();
      arm.position.set(side * (wide * 0.66), 1.95, 0);
      this.root.add(arm);
      mesh(new THREE.CapsuleGeometry(0.17 * wide, 0.43 * wide, 4, 8), joint, new THREE.Vector3(0, -0.36 * wide, 0), arm);
      mesh(new THREE.BoxGeometry(0.29 * wide, 0.44 * wide, 0.31 * wide), armor,
        new THREE.Vector3(0, -0.37 * wide, 0.025), arm);
      mesh(new THREE.BoxGeometry(0.07, 0.38 * wide, 0.045), red,
        new THREE.Vector3(0, -0.37 * wide, 0.19), arm);
      mesh(new THREE.BoxGeometry(0.32 * wide, 0.09, 0.3 * wide), edge,
        new THREE.Vector3(0, -0.61 * wide, 0.06), arm);
      mesh(new THREE.BoxGeometry(0.24 * wide, 0.3 * wide, 0.31 * wide), trim,
        new THREE.Vector3(0, -0.8 * wide, 0.02), arm);
      for (const clawSide of [-1, 1]) {
        mesh(new THREE.ConeGeometry(0.045 * wide, 0.19 * wide, 4), edge,
          new THREE.Vector3(clawSide * 0.1 * wide, -0.96 * wide, 0.13), arm);
      }
      this.arms.push(arm);

      const leg = new THREE.Group();
      leg.position.set(side * wide * 0.29, 1.03, 0);
      this.root.add(leg);
      mesh(new THREE.CapsuleGeometry(0.2 * wide, 0.48 * wide, 4, 8), joint,
        new THREE.Vector3(0, -0.32 * wide, 0), leg);
      mesh(new THREE.BoxGeometry(0.31 * wide, 0.45 * wide, 0.31 * wide), armor,
        new THREE.Vector3(0, -0.31 * wide, 0.015), leg);
      mesh(new THREE.BoxGeometry(0.1, 0.38 * wide, 0.055), red,
        new THREE.Vector3(0, -0.33 * wide, 0.19), leg);
      mesh(new THREE.BoxGeometry(0.34 * wide, 0.18 * wide, 0.16), edge,
        new THREE.Vector3(0, -0.54 * wide, 0.14), leg);
      mesh(new THREE.CylinderGeometry(0.13 * wide, 0.13 * wide, 0.12, 8), joint,
        new THREE.Vector3(0, -0.55 * wide, 0.2), leg);
      mesh(new THREE.BoxGeometry(0.32 * wide, 0.23 * wide, 0.55 * wide), trim,
        new THREE.Vector3(0, -0.72 * wide, 0.09), leg);
      this.legs.push(leg);
    }

    this.weapon = new THREE.Group();
    this.weapon.position.set(-wide * 0.78, 1.43, 0.18);
    this.root.add(this.weapon);
    mesh(new THREE.BoxGeometry(0.12, 0.72, 0.12), trim, new THREE.Vector3(0, 0, 0), this.weapon);
    const bladeLength = this.type === 'colossus' ? 2.3 : 1.25;
    mesh(new THREE.BoxGeometry(0.2, 0.14, 0.24), edge, new THREE.Vector3(0, 0.34, 0), this.weapon);
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(-0.09, 0.31);
    bladeShape.lineTo(-0.075, bladeLength * 0.75);
    bladeShape.lineTo(0.025, bladeLength);
    bladeShape.lineTo(0.17, bladeLength * 0.78);
    bladeShape.lineTo(0.1, 0.34);
    bladeShape.closePath();
    const blade = mesh(new THREE.ExtrudeGeometry(bladeShape, {
      depth: 0.14, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: 0.025, bevelThickness: 0.02
    }), red, new THREE.Vector3(0, 0, -0.07), this.weapon);
    blade.rotation.z = -0.05;
    mesh(new THREE.BoxGeometry(0.045, bladeLength * 0.56, 0.035), edge,
      new THREE.Vector3(0.025, bladeLength * 0.64, 0.09), this.weapon);
    mesh(new THREE.BoxGeometry(0.27, 0.11, 0.3), red, new THREE.Vector3(0, 0.31, 0), this.weapon);

    this.health = this.spec.health;
    this.maxHealth = this.health;
    this.attackDamage = this.spec.attackDamage ?? (this.type === 'colossus' ? 11 : 6);
    this.attackCooldownScale = this.spec.attackCooldownScale ?? 1;
    this.alive = true;
    this.defeated = false;
    this.rewarded = false;
    this.defeatTimer = 0;
    this.defeatDuration = 0.42;
    this.hitFlash = 0;
    this.hitStun = 0;
    this.hitCooldown = 0;
    this.knockbackVelocity = new THREE.Vector3();
    this.attackCooldown = 0.6 + Math.random() * 0.7;
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
    this.billboardRotation = new THREE.Quaternion();
    this.healthSprite = this.createHealthSprite();
    this.healthSprite.position.set(0, 3.55, 0);
    this.healthSprite.scale.set(this.isFinalBoss ? 3.3 : 2.5, this.isFinalBoss ? 0.78 : 0.62, 1);
    this.root.add(this.healthSprite);
    if (this.type === 'colossus') {
      this.telegraphRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.5, 0.055, 8, 44),
        new THREE.MeshBasicMaterial({
          color: 0xff4b69,
          transparent: true,
          opacity: 0.75,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      this.telegraphRing.rotation.x = Math.PI / 2;
      this.telegraphRing.position.y = 0.08;
      this.telegraphRing.visible = false;
      this.root.add(this.telegraphRing);
      this.telegraphBeam = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.08, 7.5),
        new THREE.MeshBasicMaterial({
          color: 0xb35cff,
          transparent: true,
          opacity: 0.78,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      this.telegraphBeam.position.set(0, 0.14, 3.75);
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
    context.fillStyle = 'rgba(4, 7, 12, 0.88)';
    context.fillRect(10, 8, 492, 96);
    context.strokeStyle = 'rgba(255, 98, 116, 0.95)';
    context.lineWidth = 4;
    context.strokeRect(10, 8, 492, 96);
    context.font = 'bold 36px Segoe UI, sans-serif';
    context.textAlign = 'center';
    context.fillStyle = '#fff2f2';
    context.shadowColor = '#ff243e';
    context.shadowBlur = 12;
    context.fillText(this.name, 256, 48);
    context.shadowBlur = 0;
    context.fillStyle = '#32151b';
    context.fillRect(28, 65, 456, 22);
    const gradient = context.createLinearGradient(28, 0, 484, 0);
    gradient.addColorStop(0, '#ff202f');
    gradient.addColorStop(1, '#ff7765');
    context.fillStyle = gradient;
    context.fillRect(28, 65, 456 * ratio, 22);
    this.healthTexture.needsUpdate = true;
  }

  moveOnGround(directionX, directionZ, dt, world, getHeight) {
    const aggression = this.isFinalBoss ? 1 + (1 - this.health / this.maxHealth) * 0.55 : 1;
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

  update(dt, player, camera, getHeight, world = null) {
    if (!this.alive) {
      if (this.defeated && this.defeatTimer > 0) {
        this.defeatTimer = Math.max(0, this.defeatTimer - dt);
        const progress = this.defeatTimer / this.defeatDuration;
        this.root.scale.setScalar(this.baseScale * Math.max(0.04, progress));
        this.root.rotation.z = (1 - progress) * 0.5;
        this.root.rotation.y += dt * (this.type === 'colossus' ? 2.4 : 1.2);
        this.root.position.y += dt * 1.6;
      }
      return;
    }
    if (this.arrivalTimer > 0) {
      this.arrivalTimer = Math.max(0, this.arrivalTimer - dt);
      const progress = 1 - this.arrivalTimer / this.arrivalDuration;
      this.root.visible = progress > 0.12;
      this.root.scale.setScalar(this.baseScale * Math.max(0.08, Math.min(1, progress)));
      this.root.position.y = getHeight(this.root.position.x, this.root.position.z) + (1 - progress) * 1.1;
      if (this.arrivalTimer > 0) return;
      this.root.visible = true;
      this.root.scale.setScalar(this.baseScale);
      this.root.position.y = getHeight(this.root.position.x, this.root.position.z);
      this.attackCooldown = Math.max(this.attackCooldown, 0.65);
    }
    this.phase += dt;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.hitStun = Math.max(0, this.hitStun - dt);
    this.vulnerableTimer = Math.max(0, this.vulnerableTimer - dt);
    const dx = player.root.position.x - this.root.position.x;
    const dz = player.root.position.z - this.root.position.z;
    const distance = Math.hypot(dx, dz) || 1;
    const targetYaw = Math.atan2(dx, dz);
    const yawDelta = Math.atan2(
      Math.sin(targetYaw - this.root.rotation.y),
      Math.cos(targetYaw - this.root.rotation.y)
    );
    this.root.rotation.y += THREE.MathUtils.clamp(yawDelta, -dt * 2.6, dt * 2.6);

    if (this.type === 'colossus') {
      if (this.attackActiveTimer > 0) {
        this.attackActiveTimer = Math.max(0, this.attackActiveTimer - dt);
        this.attackPhase = this.attackActiveTimer;
        if (this.attackActiveTimer === 0) {
          this.attackActive = false;
          this.attackPhase = 0;
          this.vulnerableTimer = 1.45;
          this.attackCooldown = this.isFinalBoss ? 1.25 : 1.55;
        }
      } else if (this.attackPhase > 0) {
        this.attackPhase = Math.max(0, this.attackPhase - dt);
        if (this.attackPhase === 0) {
          this.attackActive = true;
          this.attackActiveTimer = 0.24;
          this.attackPhase = this.attackActiveTimer;
          this.attackHitDone = false;
          this.telegraphRing.visible = false;
        }
      } else if (this.hitStun <= 0 && distance < 19 && this.attackCooldown <= 0) {
        this.attackPattern = this.attackPatternCount++ % 3;
        const aggression = this.isFinalBoss ? 1 - this.health / this.maxHealth : 0;
        this.attackPhase = this.isFinalBoss
          ? Math.max(0.82, 1.3 - aggression * 0.42)
          : this.masterLevel >= 200 ? 1.15 : 1.05;
        this.attackHitDone = false;
        this.attackCooldown = this.isFinalBoss
          ? Math.max(0.95, 2.35 - aggression * 1.05)
          : Math.max(1.65, 2.6 - Math.min(0.7, this.masterLevel * 0.0007));
        this.telegraphRing.visible = this.attackPattern !== 2;
        this.telegraphBeam.visible = this.attackPattern === 2;
        const ringScale = [1.85, 3.55, 5][this.attackPattern];
        this.telegraphRing.scale.setScalar(ringScale);
        this.telegraphRing.material.color.setHex(this.attackPattern === 1 ? 0xb35cff : 0xff4b69);
        this.telegraphBeam.material.color.setHex(0xb35cff);
      }

      if (this.hitStun > 0) {
        this.root.rotation.z = Math.sin(this.phase * 28) * 0.09;
      } else if (this.type === 'ranged' && distance < 7.5) {
        this.root.rotation.z = 0;
        this.moveOnGround(-dx / distance, -dz / distance, dt, world, getHeight);
        if (this.attackCooldown <= 0 && this.attackPhase <= 0) {
          this.attackPhase = 0.62;
          this.attackCooldown = 1.9 * this.attackCooldownScale;
          this.attackHitDone = false;
        }
      } else if (distance > this.attackRange) {
        this.root.rotation.z = 0;
        this.moveOnGround(dx / distance, dz / distance, dt, world, getHeight);
      } else {
        this.root.rotation.z = this.attackActive ? 0.08 : 0;
      }
      this.telegraphRing.visible = this.attackPhase > 0 && !this.attackActive && this.attackPattern !== 2;
      this.telegraphBeam.visible = this.attackPhase > 0 && !this.attackActive && this.attackPattern === 2;
      this.telegraphRing.rotation.z += dt * 0.8;
    } else if (this.hitStun > 0) {
      this.root.rotation.z = Math.sin(this.phase * 28) * 0.09;
      this.attackPhase = Math.max(0, this.attackPhase - dt * 1.8);
    } else if (distance > this.attackRange) {
      this.root.rotation.z = 0;
      this.moveOnGround(dx / distance, dz / distance, dt, world, getHeight);
    } else if (this.attackCooldown <= 0) {
      this.root.rotation.z = 0;
      this.attackPhase = 0.45;
      this.attackCooldown = (this.type === 'scout' ? 0.9 : 1.45) * this.attackCooldownScale;
      this.attackHitDone = false;
    }

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
    if (knockback.y <= 0 && this.root.position.y <= getHeight(this.root.position.x, this.root.position.z)) {
      this.root.position.y = getHeight(this.root.position.x, this.root.position.z);
      knockback.y = 0;
    }
    knockback.x *= Math.exp(-4.2 * dt);
    knockback.z *= Math.exp(-4.2 * dt);
    if (this.type !== 'colossus') this.attackPhase = Math.max(0, this.attackPhase - dt);
    const stride = Math.abs(distance - this.attackRange) > 0.5 ? Math.sin(this.phase * 8) : 0;
    this.legs[0].rotation.x = stride * 0.55;
    this.legs[1].rotation.x = -stride * 0.55;
    this.arms[0].rotation.x = -stride * 0.35 - this.attackPhase * 1.4;
    this.arms[1].rotation.x = stride * 0.35 + this.attackPhase * 1.4;
    this.weapon.rotation.z = -this.attackPhase * 0.8;
    if (knockback.y === 0) {
      this.root.position.y = getHeight(this.root.position.x, this.root.position.z) + Math.sin(this.phase * 2.3) * 0.025;
    }
    this.healthSprite.visible = distance < 260;
    if (camera) {
      this.root.getWorldQuaternion(this.billboardRotation).invert();
      this.healthSprite.quaternion.copy(this.billboardRotation).multiply(camera.quaternion);
    }
    const flashing = this.hitFlash > 0;
    const vulnerable = this.type === 'colossus' && this.vulnerableTimer > 0;
    this.armorMaterial.color.setHex(flashing ? 0xffffff : vulnerable ? 0x65405f : this.armorBaseColor.getHex());
    this.armorMaterial.emissiveIntensity = flashing ? 1.5 : vulnerable ? 1.2 : 0.32;
    this.trimMaterial.color.setHex(flashing ? 0xffffff : 0x11151c);
  }

  dispose() {
    const geometries = new Set();
    const materials = new Set();
    this.root.traverse((object) => {
      if (!object.isMesh && !object.isSprite) return;
      if (object.geometry) geometries.add(object.geometry);
      if (Array.isArray(object.material)) object.material.forEach((material) => materials.add(material));
      else if (object.material) materials.add(object.material);
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => {
      if (material.map) material.map.dispose();
      material.dispose();
    });
  }
}
