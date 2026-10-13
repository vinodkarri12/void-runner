import * as THREE from 'three';

export class Player {
  constructor() {
    this.root = new THREE.Group();
    this.materials = {
      armor: new THREE.MeshStandardMaterial({ color: 0x111924, metalness: 0.82, roughness: 0.3 }),
      trim: new THREE.MeshStandardMaterial({ color: 0x364453, metalness: 0.72, roughness: 0.38 }),
      hair: new THREE.MeshStandardMaterial({ color: 0xdfefff, metalness: 0.16, roughness: 0.43 }),
      blue: new THREE.MeshStandardMaterial({ color: 0x63e9ff, emissive: 0x20bfff, emissiveIntensity: 2.2, metalness: 0.25 }),
      mask: new THREE.MeshStandardMaterial({ color: 0x090e17, metalness: 0.68, roughness: 0.3 }),
      weaponMetal: new THREE.MeshStandardMaterial({ color: 0x222631, metalness: 0.92, roughness: 0.23 }),
      weaponSilver: new THREE.MeshStandardMaterial({ color: 0xa9bfd0, metalness: 0.86, roughness: 0.2 }),
      weaponViolet: new THREE.MeshStandardMaterial({
        color: 0xe0aaff, emissive: 0x922cff, emissiveIntensity: 2.4,
        metalness: 0.24, roughness: 0.18, transparent: true, opacity: 0.92
      }),
      weaponCyan: new THREE.MeshStandardMaterial({
        color: 0x9cfaff, emissive: 0x16dfff, emissiveIntensity: 3.2,
        metalness: 0.2, roughness: 0.16
      })
    };

    const part = (geometry, material, position, parent = this.root) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(position);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const armor = this.materials.armor;
    const trim = this.materials.trim;
    const blue = this.materials.blue;

    this.torso = part(new THREE.CapsuleGeometry(0.39, 0.68, 5, 10), armor, new THREE.Vector3(0, 1.34, 0));
    this.torso.scale.set(1, 1, 0.72);
    part(new THREE.BoxGeometry(0.58, 0.38, 0.22), trim, new THREE.Vector3(0, 1.67, 0.05));
    part(new THREE.BoxGeometry(0.12, 0.55, 0.13), blue, new THREE.Vector3(0, 1.55, -0.23));
    part(new THREE.OctahedronGeometry(0.12), blue, new THREE.Vector3(0, 1.53, -0.32));

    const head = new THREE.Group();
    head.position.set(0, 2.02, 0);
    this.head = head;
    this.root.add(head);
    part(new THREE.SphereGeometry(0.255, 14, 12), this.materials.hair, new THREE.Vector3(0, 0.05, 0), head);
    part(new THREE.BoxGeometry(0.33, 0.17, 0.29), this.materials.mask, new THREE.Vector3(0, -0.035, 0.14), head);
    part(new THREE.BoxGeometry(0.3, 0.035, 0.05), blue, new THREE.Vector3(0, 0.025, 0.3), head);
    for (let i = 0; i < 7; i++) {
      const angle = i / 7 * Math.PI * 2;
      const spike = part(new THREE.ConeGeometry(0.09, 0.34 + (i % 2) * 0.12, 5), this.materials.hair,
        new THREE.Vector3(Math.cos(angle) * 0.16, 0.31, Math.sin(angle) * 0.13), head);
      spike.rotation.z = Math.cos(angle) * -0.55;
      spike.rotation.x = Math.sin(angle) * 0.55;
    }

    this.arms = [];
    this.legs = [];
    let rightArm;
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.48, 1.68, 0);
      this.root.add(arm);
      part(new THREE.SphereGeometry(0.19, 10, 8), trim, new THREE.Vector3(0, 0, 0), arm);
      part(new THREE.CapsuleGeometry(0.105, 0.48, 4, 7), armor, new THREE.Vector3(0, -0.34, 0), arm);
      part(new THREE.BoxGeometry(0.19, 0.22, 0.2), blue, new THREE.Vector3(0, -0.68, 0.025), arm);
      this.arms.push(arm);
      if (side === 1) rightArm = arm;

      const leg = new THREE.Group();
      leg.position.set(side * 0.19, 0.89, 0);
      this.root.add(leg);
      part(new THREE.CapsuleGeometry(0.14, 0.42, 4, 8), trim, new THREE.Vector3(0, -0.22, 0), leg);
      part(new THREE.BoxGeometry(0.25, 0.19, 0.4), armor, new THREE.Vector3(0, -0.58, 0.08), leg);
      part(new THREE.BoxGeometry(0.17, 0.045, 0.08), blue, new THREE.Vector3(0, -0.58, 0.27), leg);
      this.legs.push(leg);
    }

    this.weapon = new THREE.Group();
    this.weapon.name = 'VOID REAVER';
    this.weapon.position.set(0.025, -0.76, 0.13);
    this.weapon.rotation.set(0.12, 0.05, -0.34);
    rightArm.add(this.weapon);
    const weaponPart = (geometry, material, position, rotation = new THREE.Euler()) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(position);
      mesh.rotation.copy(rotation);
      mesh.castShadow = true;
      this.weapon.add(mesh);
      return mesh;
    };
    weaponPart(new THREE.CylinderGeometry(0.075, 0.09, 0.45, 8), this.materials.weaponMetal, new THREE.Vector3(0, -0.13, 0));
    weaponPart(new THREE.CylinderGeometry(0.1, 0.1, 0.11, 8), this.materials.weaponSilver, new THREE.Vector3(0, -0.1, 0));
    weaponPart(new THREE.BoxGeometry(0.48, 0.1, 0.15), this.materials.weaponMetal,
      new THREE.Vector3(0, 0.13, 0), new THREE.Euler(0, 0, -0.14));
    weaponPart(new THREE.BoxGeometry(0.13, 0.3, 0.13), this.materials.weaponSilver, new THREE.Vector3(0, 0.29, 0));
    weaponPart(new THREE.OctahedronGeometry(0.13), this.materials.weaponCyan, new THREE.Vector3(0, 0.45, 0.035));
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(-0.08, 0.28);
    bladeShape.lineTo(-0.14, 1.05);
    bladeShape.lineTo(-0.08, 1.55);
    bladeShape.lineTo(0, 1.79);
    bladeShape.lineTo(0.04, 1.51);
    bladeShape.lineTo(0.17, 1.67);
    bladeShape.lineTo(0.12, 1.2);
    bladeShape.lineTo(0.13, 0.36);
    bladeShape.closePath();
    const bladeBase = weaponPart(
      new THREE.ExtrudeGeometry(bladeShape, { depth: 0.11, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: 0.025, bevelThickness: 0.025 }),
      this.materials.weaponMetal,
      new THREE.Vector3(0, 0, -0.055)
    );
    bladeBase.geometry.computeVertexNormals();
    const edgeShape = new THREE.Shape();
    edgeShape.moveTo(-0.035, 0.4);
    edgeShape.lineTo(-0.085, 1.08);
    edgeShape.lineTo(0, 1.58);
    edgeShape.lineTo(0.07, 1.22);
    edgeShape.lineTo(0.075, 0.43);
    edgeShape.closePath();
    weaponPart(new THREE.ShapeGeometry(edgeShape), this.materials.weaponViolet, new THREE.Vector3(0, 0, 0.095));
    weaponPart(new THREE.BoxGeometry(0.035, 0.9, 0.035), this.materials.weaponCyan,
      new THREE.Vector3(-0.105, 0.89, 0.1), new THREE.Euler(0, 0, 0.04));
    this.weaponCore = this.weapon.children.find((child) => child.geometry.type === 'OctahedronGeometry');
    this.weaponParticles = [];
    for (let index = 0; index < 4; index++) {
      const mote = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 5), this.materials.weaponCyan);
      mote.userData.phase = index / 4 * Math.PI * 2;
      this.weapon.add(mote);
      this.weaponParticles.push(mote);
    }
    this.rightHandMount = rightArm;
    this.leftHandMount = this.arms[0];
    this.baseWeapon = this.weapon;
    this.weaponModels = new Map([['void-reaver', this.baseWeapon]]);
    this.weaponConfig = { id: 'void-reaver', damage: 1, range: 1, cooldown: 1 };
    this.leftWeapon = null;
    this.droneRig = new THREE.Group();
    this.droneRig.visible = false;
    for (let index = 0; index < 2; index++) {
      const drone = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), this.materials.weaponMetal);
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.11), index ? this.materials.weaponViolet : this.materials.weaponCyan);
      core.position.y = 0.02;
      drone.add(shell, core);
      drone.userData.orbit = index * Math.PI;
      this.droneRig.add(drone);
    }
    this.root.add(this.droneRig);
    this.attackAction = '';
    this.attackTimer = 0;
    this.attackDuration = 0;
    this.hitReactionTimer = 0;
    this.weaponSwitchTimer = 0;
    this.defeatPose = false;
    this.victoryPose = false;
    this.chargeLevel = 0;
    this.overdriveTimer = 0;
    this.overdriveCharge = 60;
    this.overdriveCooldown = 0;
    this.overdriveExitTimer = 0;
    this.overdriveExitSpeed = 0;
    this.dashSequence = 0;

    this.cloak = new THREE.Group();
    this.cloak.position.set(0, 1.57, -0.2);
    this.root.add(this.cloak);
    for (const side of [-1, 1]) {
      const panel = part(new THREE.BoxGeometry(0.3, 1.05, 0.07), this.materials.mask,
        new THREE.Vector3(side * 0.18, -0.57, -0.02), this.cloak);
      panel.rotation.z = side * -0.08;
      const seam = part(new THREE.BoxGeometry(0.035, 0.82, 0.025), blue,
        new THREE.Vector3(side * 0.18, -0.57, -0.07), this.cloak);
      seam.rotation.z = side * -0.08;
    }
    this.backGlow = part(new THREE.TorusGeometry(0.2, 0.035, 6, 16), blue, new THREE.Vector3(0, 1.58, -0.39));
    this.backGlow.rotation.y = Math.PI / 2;

    this.speedRibbon = new THREE.Group();
    this.speedRibbon.position.y = 1.05;
    this.speedRibbon.visible = false;
    this.root.add(this.speedRibbon);
    this.ribbonMaterials = [
      new THREE.MeshBasicMaterial({
        color: 0x61eaff, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false
      }),
      new THREE.MeshBasicMaterial({
        color: 0xb56bff, transparent: true, opacity: 0.36,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    ];
    for (let index = 0; index < 2; index++) {
      const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.016, 5, 44), this.ribbonMaterials[index]);
      ribbon.rotation.set(index ? 0.85 : 0.2, 0, index ? 0.65 : -0.55);
      this.speedRibbon.add(ribbon);
    }

    this.velocity = new THREE.Vector3();
    this.previousPosition = new THREE.Vector3();
    this.facing = new THREE.Vector3(0, 0, 1);
    this.turnInput = 0;
    this.turnLean = 0;
    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.energy = 100;
    this.grounded = true;
    this.slideTimer = 0;
    this.dashTimer = 0;
    this.dashDuration = 0;
    this.wallRun = false;
    this.wallRunSide = 0;
    this.speed = 0;
    this.isSprinting = false;
    this.isMaxSpeed = false;
    this.landingCrouch = 0;
    this.landingImpact = 0;
    this.landingEffectPending = false;
    this.combo = 0;
    this.score = 0;
    this.wave = 1;
    this.invulnerable = 0;
    this.velocityPadCooldown = 0;
    this.padBoostPending = false;
    this.isAlive = true;
  }

  get horizontalSpeed() {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  takeDamage(amount) {
    const damage = Number.isFinite(amount) ? Math.max(0, amount) : 0;
    const previous = this.health;
    this.health = THREE.MathUtils.clamp(this.health - damage, 0, this.maxHealth);
    if (previous > this.health) this.hitReactionTimer = 0.34;
    return previous - this.health;
  }

  healPlayer(amount) {
    const healing = Number.isFinite(amount) ? Math.max(0, amount) : 0;
    const previous = this.health;
    this.health = THREE.MathUtils.clamp(this.health + healing, 0, this.maxHealth);
    return this.health - previous;
  }

  animate(time, dt = 1 / 60) {
    const speedFactor = Math.min(1, this.horizontalSpeed / 30);
    const sliding = this.slideTimer > 0;
    const sprintLean = this.isSprinting ? Math.min(1, this.horizontalSpeed / 30) : 0;
    const crouch = Math.max(sliding ? 1 : 0, this.landingCrouch / 0.55);
    const runCycle = time * (5 + speedFactor * 13);
    const blend = 1 - Math.exp(-dt * 12);
    this.hitReactionTimer = Math.max(0, this.hitReactionTimer - dt);
    this.weaponSwitchTimer = Math.max(0, this.weaponSwitchTimer - dt);
    const hitPose = this.hitReactionTimer > 0 ? Math.sin(this.hitReactionTimer / 0.34 * Math.PI) : 0;
    const airPose = !this.grounded && !this.wallRun ? 1 : 0;
    this.torso.scale.y = THREE.MathUtils.lerp(this.torso.scale.y, 1 - crouch * 0.28, blend);
    this.head.position.y = THREE.MathUtils.lerp(this.head.position.y, 2.02 - crouch * 0.48, blend);
    this.legs.forEach((leg, index) => {
      const target = sliding
        ? 0.62
        : Math.sin(runCycle + index * Math.PI) * speedFactor * (0.72 + sprintLean * 0.3) +
          crouch * 0.25 + airPose * 0.42 + (this.defeatPose ? 0.85 : 0);
      leg.rotation.x = THREE.MathUtils.lerp(leg.rotation.x, target, blend);
    });
    this.arms.forEach((arm, index) => {
      const target = sliding
        ? -0.75
        : -Math.sin(runCycle + index * Math.PI) * speedFactor * (0.5 + sprintLean * 0.22) -
          sprintLean * 0.34 - hitPose * 0.85 + airPose * (index ? -0.38 : 0.25);
      arm.rotation.x = THREE.MathUtils.lerp(arm.rotation.x, target, blend);
    });
    const rightArm = this.arms[1];
    const idleSway = Math.sin(time * 1.7) * 0.045;
    rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, 0, blend);
    const drawPose = this.weaponSwitchTimer > 0 ? Math.sin(this.weaponSwitchTimer / 0.5 * Math.PI) : 0;
    rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, -0.12 + idleSway - drawPose * 0.48, blend);
    this.weapon.rotation.x = THREE.MathUtils.lerp(this.weapon.rotation.x, 0.12 + sprintLean * 0.16, blend);
    this.weapon.rotation.y = THREE.MathUtils.lerp(this.weapon.rotation.y, 0.05, blend);
    this.weapon.rotation.z = THREE.MathUtils.lerp(this.weapon.rotation.z, -0.34 + sprintLean * 0.16, blend);
    if (this.attackTimer > 0 && this.attackDuration > 0) {
      const progress = 1 - this.attackTimer / this.attackDuration;
      const swing = Math.sin(Math.min(1, progress * 1.35) * Math.PI);
      if (this.attackAction === 'slash') {
        rightArm.rotation.y = -swing * 1.35;
        this.weapon.rotation.z -= swing * 0.72;
      } else if (this.attackAction === 'strike') {
        rightArm.rotation.x -= swing * 1.55;
        this.weapon.rotation.z += swing * 0.36;
      } else if (this.attackAction === 'charge') {
        rightArm.rotation.x -= 0.5;
        this.arms[0].rotation.x -= 0.35;
        this.weapon.rotation.z -= 0.12 + this.chargeLevel * 0.18;
      } else if (this.attackAction === 'execute') {
        rightArm.rotation.x -= swing * 1.75;
        rightArm.rotation.y -= swing * 0.48;
        this.weapon.rotation.z -= swing * 0.95;
      } else if (this.attackAction === 'dash') {
        rightArm.rotation.x += 0.24;
      }
    }
    if (this.victoryPose) {
      this.arms[0].rotation.z = THREE.MathUtils.lerp(this.arms[0].rotation.z, 0.72, blend);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, -0.72, blend);
      this.torso.rotation.z = THREE.MathUtils.lerp(this.torso.rotation.z, Math.sin(time * 1.3) * 0.035, blend);
    } else if (this.defeatPose) {
      this.torso.rotation.x = THREE.MathUtils.lerp(this.torso.rotation.x, 0.68, blend);
      this.head.rotation.x = THREE.MathUtils.lerp(this.head.rotation.x, 0.48, blend);
      this.root.rotation.z = THREE.MathUtils.lerp(this.root.rotation.z, 0.34, blend);
    } else if (hitPose > 0) {
      this.torso.rotation.z = THREE.MathUtils.lerp(this.torso.rotation.z, -0.16 * hitPose, blend);
      this.head.rotation.x = THREE.MathUtils.lerp(this.head.rotation.x, 0.16 * hitPose, blend);
    } else {
      this.head.rotation.x = THREE.MathUtils.lerp(this.head.rotation.x, 0, blend);
      this.torso.rotation.z = THREE.MathUtils.lerp(this.torso.rotation.z, 0, blend);
    }
    this.weaponVioletGlow(this.chargeLevel, this.overdriveTimer > 0, speedFactor);
    for (const mote of this.weaponParticles) {
      const orbit = time * 2.8 + mote.userData.phase;
      mote.position.set(Math.cos(orbit) * 0.12, 0.68 + Math.sin(orbit * 0.7) * 0.42, Math.sin(orbit) * 0.09);
      mote.visible = this.chargeLevel > 0.02 || this.overdriveTimer > 0;
    }
    this.droneRig.children.forEach((drone) => {
      const orbit = time * 1.65 + drone.userData.orbit;
      drone.position.set(Math.cos(orbit) * 0.78, 1.42 + Math.sin(time * 2 + orbit) * 0.12, Math.sin(orbit) * 0.65);
      drone.rotation.y = -orbit;
    });
    if (this.leftWeapon) {
      this.leftWeapon.rotation.z = -this.weapon.rotation.z;
      this.leftWeapon.rotation.x = this.weapon.rotation.x;
    }
    const targetLean = this.dashDuration > 0 ? -0.42 : -0.06 - sprintLean * 0.38;
    this.torso.rotation.x = THREE.MathUtils.lerp(this.torso.rotation.x, targetLean, blend);
    this.cloak.rotation.x = Math.sin(time * 3) * 0.08 - speedFactor * 0.48;
    this.cloak.rotation.z = Math.sin(time * 2.3) * 0.06;
    const ribbonActive = this.horizontalSpeed >= 27 || this.overdriveTimer > 0;
    this.speedRibbon.visible = ribbonActive;
    this.speedRibbon.scale.setScalar(0.9 + Math.min(1, speedFactor) * 0.24);
    this.speedRibbon.rotation.y = time * (2.2 + speedFactor * 2);
    this.ribbonMaterials[0].opacity = 0.36 + speedFactor * 0.26 + (this.overdriveTimer > 0 ? 0.2 : 0);
    this.ribbonMaterials[1].opacity = 0.25 + speedFactor * 0.2 + (this.overdriveTimer > 0 ? 0.18 : 0);
    this.root.rotation.y = Math.atan2(this.facing.x, this.facing.z);
    const turnLean = THREE.MathUtils.clamp(this.turnLean * 0.24, -0.24, 0.24);
    const targetRoll = this.wallRun ? -this.wallRunSide * 0.22 : turnLean * speedFactor;
    this.root.rotation.z = THREE.MathUtils.lerp(this.root.rotation.z, targetRoll, blend);
  }

  weaponVioletGlow(charge, overdrive, speedFactor = 0) {
    const intensity = 2.4 + charge * 5 + speedFactor * 1.8 + (overdrive ? 3 : 0);
    this.materials.weaponViolet.emissiveIntensity = intensity;
    this.materials.weaponCyan.emissiveIntensity = 3.2 + charge * 4 + speedFactor * 1.2 + (overdrive ? 2 : 0);
    this.materials.blue.emissiveIntensity = 2.2 + charge * 2.8 + speedFactor + (overdrive ? 1.5 : 0);
    this.materials.weaponViolet.color.setHex(overdrive ? 0xf2d7ff : 0xe0aaff);
    if (this.weaponCore) this.weaponCore.scale.setScalar(1 + charge * 0.45 + (overdrive ? 0.22 : 0));
  }

  startAttack(action, duration) {
    this.attackAction = action;
    this.attackDuration = duration;
    this.attackTimer = duration;
  }

  equipWeapon(config) {
    if (!config?.id || !Number.isFinite(config.damage) || !Number.isFinite(config.range) || !Number.isFinite(config.cooldown)) return false;
    if (this.leftWeapon) {
      this.leftHandMount.remove(this.leftWeapon);
      this.leftWeapon = null;
    }
    this.droneRig.visible = config.id === 'orbital-drones';
    for (const model of this.weaponModels.values()) model.visible = false;
    let model = this.weaponModels.get(config.id);
    if (!model) {
      model = this.createWeaponModel(config);
      this.weaponModels.set(config.id, model);
      this.rightHandMount.add(model);
    }
    model.visible = config.id !== 'orbital-drones';
    this.weapon = model;
    this.weaponConfig = { ...config };
    this.weaponSwitchTimer = 0.5;
    if (config.id === 'twin-shadow-blades' || config.id === 'kinetic-gauntlets') {
      this.leftWeapon = model.clone(true);
      if (config.id === 'twin-shadow-blades') this.leftWeapon.rotation.z *= -1;
      this.leftHandMount.add(this.leftWeapon);
    }
    return true;
  }

  createWeaponModel(config) {
    const group = new THREE.Group();
    group.position.set(0.025, -0.76, 0.13);
    group.rotation.set(0.12, 0.05, -0.34);
    const color = new THREE.Color(config.color);
    const glow = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 2.8, metalness: 0.2, roughness: 0.18
    });
    const add = (geometry, material, position, rotation = null) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      if (rotation) mesh.rotation.set(...rotation);
      mesh.castShadow = true;
      group.add(mesh);
    };
    const dark = this.materials.weaponMetal;
    if (config.id === 'kinetic-gauntlets') {
      add(new THREE.BoxGeometry(0.34, 0.42, 0.33), dark, [0, 0.05, 0.08]);
      add(new THREE.BoxGeometry(0.36, 0.12, 0.35), glow, [0, -0.08, 0.1]);
      add(new THREE.OctahedronGeometry(0.16), glow, [0, 0.22, 0.12]);
      add(new THREE.BoxGeometry(0.42, 0.08, 0.12), dark, [0, -0.17, 0.1]);
    } else if (config.id === 'arc-spear') {
      add(new THREE.CylinderGeometry(0.045, 0.055, 2.15, 8), dark, [0, 0.38, 0]);
      add(new THREE.ConeGeometry(0.16, 0.56, 6), glow, [0, 1.72, 0]);
      add(new THREE.ConeGeometry(0.12, 0.42, 6), glow, [0, 1.98, 0], [0, 0, Math.PI]);
      add(new THREE.TorusGeometry(0.12, 0.035, 6, 12), glow, [0, 1.35, 0], [Math.PI / 2, 0, 0]);
    } else if (config.id === 'orbital-drones') {
      add(new THREE.CylinderGeometry(0.08, 0.1, 0.34, 8), dark, [0, 0, 0]);
      add(new THREE.OctahedronGeometry(0.13), glow, [0, 0.2, 0]);
    } else {
      add(new THREE.CylinderGeometry(0.07, 0.09, 0.42, 8), dark, [0, -0.08, 0]);
      add(new THREE.BoxGeometry(0.34, 0.08, 0.13), dark, [0, 0.13, 0]);
      add(new THREE.BoxGeometry(0.13, 1.4, 0.075), dark, [0, 0.82, 0]);
      add(new THREE.BoxGeometry(0.065, 1.26, 0.025), glow, [0.035, 0.84, 0.052]);
      if (config.id === 'phantom-katana') add(new THREE.TorusGeometry(0.11, 0.027, 5, 12), glow, [0, 0.27, 0], [Math.PI / 2, 0, 0]);
      if (config.id === 'twin-shadow-blades') add(new THREE.OctahedronGeometry(0.12), glow, [0, 0.18, 0.02]);
    }
    return group;
  }

  reset(position = new THREE.Vector3(0, 0, 0)) {
    this.root.position.copy(position);
    this.root.rotation.set(0, 0, 0);
    this.torso.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.previousPosition.copy(position);
    this.facing.set(0, 0, 1);
    this.turnLean = 0;
    this.grounded = true;
    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.energy = 100;
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.scoreMultiplier = 1;
    this.scoreMultiplierBonus = 1;
    this.wave = 1;
    this.invulnerable = 0;
    this.isAlive = true;
    this.dashTimer = 0;
    this.dashDuration = 0;
    this.slideTimer = 0;
    this.wallRun = false;
    this.wallRunSide = 0;
    this.isSprinting = false;
    this.isMaxSpeed = false;
    this.landingCrouch = 0;
    this.landingImpact = 0;
    this.landingEffectPending = false;
    this.attackAction = '';
    this.attackTimer = 0;
    this.attackDuration = 0;
    this.hitReactionTimer = 0;
    this.weaponSwitchTimer = 0;
    this.defeatPose = false;
    this.victoryPose = false;
    this.chargeLevel = 0;
    this.overdriveTimer = 0;
    this.overdriveCharge = 60;
    this.overdriveCooldown = 0;
    this.overdriveExitTimer = 0;
    this.overdriveExitSpeed = 0;
    this.dashSequence = 0;
  }
}
