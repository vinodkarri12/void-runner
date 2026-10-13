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
    this.root = new THREE.Group();
    this.root.position.copy(position);
    this.root.scale.setScalar(this.spec.scale);
    this.baseScale = this.spec.scale;
    this.root.userData.enemy = this;

    this.armorMaterial = new THREE.MeshStandardMaterial({
      color: this.spec.armor,
      emissive: 0x350712,
      emissiveIntensity: 0.75,
      metalness: 0.86,
      roughness: 0.28
    });
    this.trimMaterial = new THREE.MeshStandardMaterial({
      color: 0x11151c,
      emissive: 0x1f0810,
      emissiveIntensity: 0.5,
      metalness: 0.78,
      roughness: 0.34
    });
    this.redMaterial = new THREE.MeshStandardMaterial({
      color: 0xff6572,
      emissive: 0xff1237,
      emissiveIntensity: this.type === 'colossus' ? 4 : 3,
      metalness: 0.28,
      roughness: 0.22
    });
    this.eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff182d });

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
    const red = this.redMaterial;
    const wide = this.type === 'colossus' ? 1.45 : this.type === 'guardian' || this.type === 'elite' ? 1.1 : 0.84;

    this.torso = mesh(new THREE.BoxGeometry(wide, 1.28, 0.62), armor, new THREE.Vector3(0, 1.68, 0));
    mesh(new THREE.BoxGeometry(wide * 0.76, 0.45, 0.18), trim, new THREE.Vector3(0, 2.08, 0.36));
    mesh(new THREE.BoxGeometry(wide * 0.62, 0.085, 0.035), red, new THREE.Vector3(0, 1.84, 0.47));
    mesh(new THREE.BoxGeometry(0.09, 0.58, 0.035), red, new THREE.Vector3(0, 1.98, 0.49));
    mesh(new THREE.BoxGeometry(wide * 0.92, 0.18, 0.72), trim, new THREE.Vector3(0, 1.02, 0));
    mesh(new THREE.BoxGeometry(wide * 0.78, 0.075, 0.77), red, new THREE.Vector3(0, 1.06, 0.02));

    this.head = new THREE.Group();
    this.head.position.set(0, 2.62, 0);
    this.root.add(this.head);
    const headSize = this.type === 'colossus' ? 0.48 : this.type === 'guardian' ? 0.36 : 0.31;
    mesh(new THREE.BoxGeometry(headSize * 1.55, headSize * 1.35, headSize * 1.25), trim, new THREE.Vector3(0, 0, 0), this.head);
    mesh(new THREE.BoxGeometry(headSize * 1.32, 0.12, 0.075), red, new THREE.Vector3(0, 0.035, headSize * 0.65), this.head);
    for (const side of [-1, 1]) {
      mesh(new THREE.SphereGeometry(0.075, 8, 6), this.eyeMaterial,
        new THREE.Vector3(side * headSize * 0.31, 0.04, headSize * 0.7), this.head);
      const horn = mesh(new THREE.ConeGeometry(0.13, this.type === 'colossus' ? 0.85 : 0.43, 6), armor,
        new THREE.Vector3(side * headSize * 0.65, 0.28, 0), this.head);
      horn.rotation.z = -side * 0.65;
    }

    this.arms = [];
    this.legs = [];
    for (const side of [-1, 1]) {
      const shoulder = mesh(new THREE.BoxGeometry(0.48 * wide, 0.48, 0.52), armor,
        new THREE.Vector3(side * (wide * 0.59), 2.05, 0));
      shoulder.rotation.z = side * -0.08;
      mesh(new THREE.BoxGeometry(0.4 * wide, 0.075, 0.57), red,
        new THREE.Vector3(side * (wide * 0.59), 2.09, 0.05));

      const arm = new THREE.Group();
      arm.position.set(side * (wide * 0.66), 1.95, 0);
      this.root.add(arm);
      mesh(new THREE.CapsuleGeometry(0.17 * wide, 0.43 * wide, 4, 8), armor, new THREE.Vector3(0, -0.36 * wide, 0), arm);
      mesh(new THREE.BoxGeometry(0.12, 0.5 * wide, 0.06), red, new THREE.Vector3(0, -0.36 * wide, 0.18));
      mesh(new THREE.BoxGeometry(0.24 * wide, 0.3 * wide, 0.31 * wide), trim, new THREE.Vector3(0, -0.8 * wide, 0.02), arm);
      this.arms.push(arm);

      const leg = new THREE.Group();
      leg.position.set(side * wide * 0.29, 1.03, 0);
      this.root.add(leg);
      mesh(new THREE.CapsuleGeometry(0.2 * wide, 0.48 * wide, 4, 8), armor, new THREE.Vector3(0, -0.32 * wide, 0), leg);
      mesh(new THREE.BoxGeometry(0.1, 0.5 * wide, 0.07), red, new THREE.Vector3(0, -0.33 * wide, 0.2));
      mesh(new THREE.BoxGeometry(0.32 * wide, 0.23 * wide, 0.55 * wide), trim, new THREE.Vector3(0, -0.72 * wide, 0.09), leg);
      this.legs.push(leg);
    }

    this.weapon = new THREE.Group();
    this.weapon.position.set(-wide * 0.78, 1.43, 0.18);
    this.root.add(this.weapon);
    mesh(new THREE.BoxGeometry(0.12, 0.72, 0.12), trim, new THREE.Vector3(0, 0, 0), this.weapon);
    const bladeLength = this.type === 'colossus' ? 2.3 : 1.25;
    const blade = mesh(new THREE.BoxGeometry(0.09, bladeLength, 0.2), red,
      new THREE.Vector3(0, bladeLength * 0.66, 0), this.weapon);
    blade.rotation.z = -0.05;
    mesh(new THREE.BoxGeometry(0.23, 0.1, 0.28), red, new THREE.Vector3(0, 0.31, 0), this.weapon);

    this.health = this.spec.health;
    this.maxHealth = this.health;
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
    this.name = options.name || this.spec.name;
    this.arrivalTimer = Math.max(0, options.arrivalDelay ?? 1.35);
    this.arrivalDuration = Math.max(0.7, options.arrivalDuration ?? 1.35);
    this.root.visible = this.arrivalTimer <= 0;
    this.masterLevel = options.masterLevel ?? 0;
    this.isFinalBoss = options.isFinalBoss === true;
    this.billboardRotation = new THREE.Quaternion();
    this.healthSprite = this.createHealthSprite();
    this.healthSprite.position.set(0, 3.55, 0);
    this.healthSprite.scale.set(2.5, 0.62, 1);
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
    const moveX = directionX * this.spec.speed * dt;
    const moveZ = directionZ * this.spec.speed * dt;
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
          this.attackCooldown = 1.55;
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
        this.attackPhase = this.isFinalBoss ? 1.28 : this.masterLevel >= 200 ? 1.15 : 1.05;
        this.attackHitDone = false;
        this.attackCooldown = Math.max(1.65, 2.6 - Math.min(0.7, this.masterLevel * 0.0007));
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
          this.attackCooldown = 1.9;
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
      this.attackCooldown = this.type === 'scout' ? 0.9 : 1.45;
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
    this.armorMaterial.color.setHex(flashing ? 0xffffff : vulnerable ? 0x9365bb : this.spec.armor);
    this.armorMaterial.emissiveIntensity = flashing ? 2.4 : vulnerable ? 1.85 : 0.75;
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
