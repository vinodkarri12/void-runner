import * as THREE from 'three';

export class Player {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'SHADOW_NINJA';

    // Cinematic realistic shinobi material palette
    this.materials = {
      shinobiFabric: new THREE.MeshStandardMaterial({
        color: 0x111317,
        roughness: 0.86,
        metalness: 0.08
      }),
      shinobiUnder: new THREE.MeshStandardMaterial({
        color: 0x090a0d,
        roughness: 0.92,
        metalness: 0.04
      }),
      ninjaArmor: new THREE.MeshStandardMaterial({
        color: 0x181a20,
        metalness: 0.58,
        roughness: 0.32
      }),
      ninjaGold: new THREE.MeshStandardMaterial({
        color: 0xa88746,
        emissive: 0x3d2b0e,
        emissiveIntensity: 0.35,
        metalness: 0.82,
        roughness: 0.26
      }),
      ninjaScarf: new THREE.MeshStandardMaterial({
        color: 0xd61c2e,
        emissive: 0x48080f,
        emissiveIntensity: 0.65,
        metalness: 0.12,
        roughness: 0.62,
        side: THREE.DoubleSide
      }),
      ninjaSkin: new THREE.MeshStandardMaterial({
        color: 0xc8987b,
        roughness: 0.72,
        metalness: 0.05
      }),
      ninjaEye: new THREE.MeshBasicMaterial({
        color: 0xffb83b
      }),
      katanaSteel: new THREE.MeshStandardMaterial({
        color: 0xdbe3ea,
        metalness: 0.96,
        roughness: 0.14
      }),
      katanaHamon: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x9dc6e8,
        emissiveIntensity: 0.45,
        metalness: 0.92,
        roughness: 0.12
      }),
      katanaSaya: new THREE.MeshStandardMaterial({
        color: 0x0c0e12,
        metalness: 0.65,
        roughness: 0.24
      }),
      katanaWrap: new THREE.MeshStandardMaterial({
        color: 0x1a1518,
        roughness: 0.88,
        metalness: 0.12
      }),
      weaponMetal: new THREE.MeshStandardMaterial({
        color: 0x23262b,
        metalness: 0.78,
        roughness: 0.28
      }),
      weaponGlow: new THREE.MeshStandardMaterial({
        color: 0xc7384a,
        emissive: 0x9c1a29,
        emissiveIntensity: 2.2,
        metalness: 0.2,
        roughness: 0.2
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

    const fabric = this.materials.shinobiFabric;
    const under = this.materials.shinobiUnder;
    const armor = this.materials.ninjaArmor;
    const gold = this.materials.ninjaGold;
    const scarf = this.materials.ninjaScarf;

    // === TORSO & SHINOBI ROBES ===
    this.torso = new THREE.Group();
    this.torso.position.set(0, 1.32, 0);
    this.root.add(this.torso);

    // Inner tunic / gi
    const gi = part(new THREE.CapsuleGeometry(0.38, 0.64, 4, 10), fabric, new THREE.Vector3(0, 0.05, 0), this.torso);
    gi.scale.set(1, 1, 0.74);

    // Crossed chest fold (kimono / shinobi fold)
    const chestFoldL = part(new THREE.BoxGeometry(0.36, 0.52, 0.08), fabric, new THREE.Vector3(-0.06, 0.12, 0.24), this.torso);
    chestFoldL.rotation.z = -0.32;
    const chestFoldR = part(new THREE.BoxGeometry(0.36, 0.52, 0.08), fabric, new THREE.Vector3(0.06, 0.08, 0.23), this.torso);
    chestFoldR.rotation.z = 0.32;

    // Lacquered chest armor plate (Do-maru)
    const doPlate = part(new THREE.BoxGeometry(0.56, 0.42, 0.16), armor, new THREE.Vector3(0, 0.12, 0.22), this.torso);
    part(new THREE.BoxGeometry(0.58, 0.05, 0.17), gold, new THREE.Vector3(0, 0.31, 0.22), this.torso);
    part(new THREE.BoxGeometry(0.58, 0.05, 0.17), gold, new THREE.Vector3(0, -0.07, 0.22), this.torso);

    // Black & Crimson Obi Sash around waist
    const obi = part(new THREE.CylinderGeometry(0.39, 0.41, 0.28, 12), under, new THREE.Vector3(0, -0.22, 0), this.torso);
    obi.scale.set(1, 1, 0.78);
    const obiRed = part(new THREE.CylinderGeometry(0.405, 0.425, 0.12, 12), scarf, new THREE.Vector3(0, -0.22, 0), this.torso);
    obiRed.scale.set(1, 1, 0.79);

    // Obi Knot and hanging sash ribbons at hip
    const obiKnot = part(new THREE.BoxGeometry(0.14, 0.14, 0.1), scarf, new THREE.Vector3(0.18, -0.22, 0.32), this.torso);
    obiKnot.rotation.z = 0.35;
    const sashHanging1 = part(new THREE.BoxGeometry(0.08, 0.45, 0.02), scarf, new THREE.Vector3(0.17, -0.44, 0.33), this.torso);
    sashHanging1.rotation.z = 0.12;
    const sashHanging2 = part(new THREE.BoxGeometry(0.07, 0.38, 0.02), scarf, new THREE.Vector3(0.23, -0.4, 0.32), this.torso);
    sashHanging2.rotation.z = -0.15;

    // Hip Katana Saya (Scabbard) resting at left hip
    this.hipSaya = new THREE.Group();
    this.hipSaya.position.set(-0.35, -0.16, 0.05);
    this.hipSaya.rotation.set(-0.45, 0.15, -0.35);
    this.torso.add(this.hipSaya);
    part(new THREE.BoxGeometry(0.08, 0.98, 0.045), this.materials.katanaSaya, new THREE.Vector3(0, -0.28, 0), this.hipSaya);
    part(new THREE.BoxGeometry(0.09, 0.08, 0.055), gold, new THREE.Vector3(0, 0.18, 0), this.hipSaya);
    part(new THREE.BoxGeometry(0.085, 0.06, 0.05), gold, new THREE.Vector3(0, -0.74, 0), this.hipSaya);
    // Cord wrap (Sageo)
    part(new THREE.BoxGeometry(0.095, 0.16, 0.06), scarf, new THREE.Vector3(0, 0.05, 0), this.hipSaya);

    // === SHINOBI HEAD & MASK ===
    this.head = new THREE.Group();
    this.head.position.set(0, 0.62, 0);
    this.torso.add(this.head);

    // Shinobi Cowl / Hood (Zukin)
    const cowl = part(new THREE.SphereGeometry(0.28, 12, 10), fabric, new THREE.Vector3(0, 0.04, -0.02), this.head);
    cowl.scale.set(0.92, 1.12, 1.05);

    // Face Mask (Menpo) covering mouth and lower cheeks
    const mask = part(new THREE.BoxGeometry(0.38, 0.22, 0.24), under, new THREE.Vector3(0, -0.05, 0.16), this.head);
    mask.scale.set(0.95, 1, 0.85);

    // Skin visible around eye slit
    part(new THREE.BoxGeometry(0.34, 0.1, 0.06), this.materials.ninjaSkin, new THREE.Vector3(0, 0.09, 0.24), this.head);

    // Forehead Protector Plate (Hitai-ate)
    const foreheadBand = part(new THREE.BoxGeometry(0.42, 0.12, 0.06), fabric, new THREE.Vector3(0, 0.19, 0.24), this.head);
    foreheadBand.scale.set(1.02, 1, 0.9);
    part(new THREE.BoxGeometry(0.26, 0.09, 0.03), armor, new THREE.Vector3(0, 0.19, 0.285), this.head);
    // Clan crest emblem
    part(new THREE.OctahedronGeometry(0.035), gold, new THREE.Vector3(0, 0.19, 0.305), this.head);

    // Focused Piercing Amber Eyes
    for (const side of [-1, 1]) {
      const eye = part(new THREE.BoxGeometry(0.07, 0.025, 0.02), this.materials.ninjaEye,
        new THREE.Vector3(side * 0.095, 0.095, 0.275), this.head);
      eye.rotation.z = side * -0.12;
    }

    // === FLOWING CRIMSON RED SCARF (TENUGUI) ===
    // Multi-segment articulated ribbon connected to back of neck
    this.scarfRoot = new THREE.Group();
    this.scarfRoot.position.set(0, 0.52, -0.22);
    this.torso.add(this.scarfRoot);

    // Scarf knot around collar
    part(new THREE.TorusGeometry(0.18, 0.045, 6, 12), scarf, new THREE.Vector3(0, 0, 0.04), this.scarfRoot);

    this.scarfSegments = [];
    let prevParent = this.scarfRoot;
    const segmentCount = 6;
    for (let i = 0; i < segmentCount; i++) {
      const segGroup = new THREE.Group();
      segGroup.position.set(0, -0.06, -0.14);
      prevParent.add(segGroup);

      const segWidth = 0.24 * (1 - i * 0.08);
      const segLength = 0.28;
      const segMesh = new THREE.Mesh(
        new THREE.BoxGeometry(segWidth, 0.025, segLength),
        scarf
      );
      segMesh.position.set(0, 0, -segLength / 2);
      segMesh.castShadow = true;
      segGroup.add(segMesh);

      // Gold fringe on the final tail segment
      if (i === segmentCount - 1) {
        const fringe = new THREE.Mesh(new THREE.BoxGeometry(segWidth * 0.9, 0.03, 0.05), gold);
        fringe.position.set(0, 0, -segLength);
        segGroup.add(fringe);
      }

      this.scarfSegments.push(segGroup);
      prevParent = segGroup;
    }

    // === ARMS & SHINOBI WEAPONRY ===
    this.arms = [];
    this.legs = [];
    let rightArm;

    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.44, 0.38, 0);
      this.torso.add(arm);

      // Sode shoulder pauldron with gold trim
      const shoulderArmor = part(new THREE.BoxGeometry(0.24, 0.28, 0.26), armor, new THREE.Vector3(side * 0.04, -0.04, 0), arm);
      shoulderArmor.rotation.z = side * -0.14;
      part(new THREE.BoxGeometry(0.25, 0.05, 0.27), gold, new THREE.Vector3(side * 0.04, 0.09, 0), arm);

      // Upper arm in shinobi sleeve
      part(new THREE.CapsuleGeometry(0.12, 0.34, 4, 8), fabric, new THREE.Vector3(0, -0.24, 0), arm);

      // Forearm with Armored Tekko Gauntlet
      const forearm = part(new THREE.CapsuleGeometry(0.11, 0.32, 4, 8), under, new THREE.Vector3(0, -0.5, 0.02), arm);
      const tekkoPlate = part(new THREE.BoxGeometry(0.18, 0.26, 0.14), armor, new THREE.Vector3(0, -0.52, 0.09), arm);
      part(new THREE.BoxGeometry(0.19, 0.04, 0.15), gold, new THREE.Vector3(0, -0.42, 0.09), arm);

      // Ninja glove & hand
      part(new THREE.BoxGeometry(0.12, 0.14, 0.15), under, new THREE.Vector3(0, -0.71, 0.02), arm);

      this.arms.push(arm);
      if (side === 1) rightArm = arm;

      // === LEGS & HAKAMA ===
      const leg = new THREE.Group();
      leg.position.set(side * 0.18, 0.62, 0);
      this.root.add(leg);

      // Upper thigh in baggy hakama
      part(new THREE.CapsuleGeometry(0.15, 0.36, 4, 8), fabric, new THREE.Vector3(0, -0.18, 0), leg);

      // Knee guard
      part(new THREE.BoxGeometry(0.19, 0.14, 0.12), armor, new THREE.Vector3(0, -0.36, 0.11), leg);

      // Armored Kyahan Shin Guards
      part(new THREE.CapsuleGeometry(0.125, 0.34, 4, 8), under, new THREE.Vector3(0, -0.54, 0.02), leg);
      part(new THREE.BoxGeometry(0.18, 0.3, 0.12), armor, new THREE.Vector3(0, -0.54, 0.08), leg);
      part(new THREE.BoxGeometry(0.19, 0.035, 0.13), gold, new THREE.Vector3(0, -0.42, 0.08), leg);

      // Traditional Split-Toe Tabi Ninja Boots
      const tabiFoot = part(new THREE.BoxGeometry(0.17, 0.12, 0.34), under, new THREE.Vector3(0, -0.74, 0.08), leg);
      // Split toe notch
      part(new THREE.BoxGeometry(0.03, 0.06, 0.12), this.materials.shinobiFabric, new THREE.Vector3(0, -0.74, 0.23), leg);
      // Padded sole
      part(new THREE.BoxGeometry(0.175, 0.035, 0.35), fabric, new THREE.Vector3(0, -0.8, 0.08), leg);

      this.legs.push(leg);
    }

    // === FORGED SHADOW KATANA (MAIN WEAPON) ===
    this.weapon = new THREE.Group();
    this.weapon.name = 'SHADOW KATANA';
    this.weapon.position.set(0.03, -0.74, 0.1);
    this.weapon.rotation.set(0.15, 0.05, -0.32);
    rightArm.add(this.weapon);

    this.createKatanaMesh(this.weapon);

    this.rightHandMount = rightArm;
    this.leftHandMount = this.arms[0];
    this.baseWeapon = this.weapon;
    this.weaponModels = new Map([['void-reaver', this.baseWeapon]]);
    this.weaponConfig = { id: 'void-reaver', damage: 1, range: 1, cooldown: 1 };
    this.leftWeapon = null;

    // Phantom kunai drone rig
    this.droneRig = new THREE.Group();
    this.droneRig.visible = false;
    for (let index = 0; index < 3; index++) {
      const drone = new THREE.Group();
      const kunaiBlade = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.38, 4), this.materials.katanaSteel);
      kunaiBlade.rotation.x = Math.PI;
      const kunaiRing = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 4, 8), this.materials.ninjaGold);
      kunaiRing.position.y = 0.24;
      drone.add(kunaiBlade, kunaiRing);
      drone.userData.orbit = (index / 3) * Math.PI * 2;
      this.droneRig.add(drone);
    }
    this.root.add(this.droneRig);

    // Speed aura / trails
    this.speedRibbon = new THREE.Group();
    this.speedRibbon.position.y = 1.1;
    this.speedRibbon.visible = false;
    this.root.add(this.speedRibbon);
    this.ribbonMaterials = [
      new THREE.MeshBasicMaterial({
        color: 0xff4d5a, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false
      }),
      new THREE.MeshBasicMaterial({
        color: 0xffaa33, transparent: true, opacity: 0.42,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    ];
    for (let index = 0; index < 2; index++) {
      const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.018, 5, 40), this.ribbonMaterials[index]);
      ribbon.rotation.set(index ? 0.8 : 0.25, 0, index ? 0.6 : -0.5);
      this.speedRibbon.add(ribbon);
    }

    // Weapon particle motes
    this.weaponParticles = [];
    for (let i = 0; i < 4; i++) {
      const mote = new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 5), this.materials.weaponGlow);
      mote.userData.phase = (i / 4) * Math.PI * 2;
      this.weapon.add(mote);
      this.weaponParticles.push(mote);
    }

    // State properties
    this.velocity = new THREE.Vector3();
    this.previousPosition = new THREE.Vector3();
    this.facing = new THREE.Vector3(0, 0, 1);
    this.turnInput = 0;
    this.turnLean = 0;
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
    this.damageInvulnerabilityWindow = 0.28;
    this.isAlive = true;
    this.dashTimer = 0;
    this.dashDuration = 0;
    this.slideTimer = 0;
    this.wallRun = false;
    this.wallRunSide = 0;
    this.speed = 0;
    this.horizontalSpeed = 0;
    this.grounded = true;
    this.isRunning = false;
    this.movementState = 'STOPPED';
    this.isSprinting = false;
    this.isMaxSpeed = false;
    this.boostEnergy = 100;
    this.boostMax = 100;
    this.boostCooldownTimer = 0;
    this.boostRecoveryDelay = 0;
    this.boostMultiplier = 1.48;
    this.isBoosting = false;
    this.landingCrouch = 0;
    this.landingImpact = 0;
    this.landingEffectPending = false;
    this.attackAction = '';
    this.attackTimer = 0;
    this.attackDuration = 0;
    this.comboStep = 0;
    this.comboResetTimer = 0;
    this.currentAttackId = 0;
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
    this.dashAttackCooldown = 0;
    this.dashAttackState = null;
    this.wasAirborne = false;
  }

  createKatanaMesh(parentGroup, scale = 1.0) {
    const steel = this.materials.katanaSteel;
    const hamon = this.materials.katanaHamon;
    const gold = this.materials.ninjaGold;
    const wrap = this.materials.katanaWrap;

    // Tsuka (Hilt with diamond wrap)
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.045 * scale, 0.05 * scale, 0.46 * scale, 8), wrap);
    hilt.position.set(0, -0.16 * scale, 0);
    hilt.castShadow = true;
    parentGroup.add(hilt);

    // Kashira (Pommel cap)
    const pommel = new THREE.Mesh(new THREE.CylinderGeometry(0.054 * scale, 0.052 * scale, 0.05 * scale, 8), gold);
    pommel.position.set(0, -0.38 * scale, 0);
    parentGroup.add(pommel);

    // Tsuba (Circular Gold-Trimmed Sword Guard)
    const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * scale, 0.16 * scale, 0.024 * scale, 16), gold);
    tsuba.position.set(0, 0.08 * scale, 0);
    parentGroup.add(tsuba);

    // Habaki (Blade Collar)
    const habaki = new THREE.Mesh(new THREE.BoxGeometry(0.07 * scale, 0.08 * scale, 0.045 * scale), gold);
    habaki.position.set(0, 0.13 * scale, 0);
    parentGroup.add(habaki);

    // Curved Katana Blade
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(-0.038 * scale, 0.16 * scale);
    bladeShape.lineTo(-0.048 * scale, 0.95 * scale);
    bladeShape.lineTo(-0.032 * scale, 1.48 * scale);
    bladeShape.lineTo(0.005 * scale, 1.72 * scale); // Kissaki tip
    bladeShape.lineTo(0.026 * scale, 1.54 * scale);
    bladeShape.lineTo(0.035 * scale, 0.95 * scale);
    bladeShape.lineTo(0.032 * scale, 0.16 * scale);
    bladeShape.closePath();

    const blade = new THREE.Mesh(
      new THREE.ExtrudeGeometry(bladeShape, {
        depth: 0.028 * scale,
        bevelEnabled: true,
        bevelSegments: 1,
        steps: 1,
        bevelSize: 0.012 * scale,
        bevelThickness: 0.01 * scale
      }),
      steel
    );
    blade.position.set(0, 0, -0.014 * scale);
    blade.castShadow = true;
    parentGroup.add(blade);

    // Hamon Temper Line Highlight along cutting edge
    const hamonLine = new THREE.Mesh(
      new THREE.BoxGeometry(0.012 * scale, 1.46 * scale, 0.034 * scale),
      hamon
    );
    hamonLine.position.set(-0.036 * scale, 0.92 * scale, 0);
    parentGroup.add(hamonLine);
  }

  takeDamage(amount) {
    if (!this.isAlive || this.invulnerable > 0) return 0;
    const actual = Math.min(this.health, Math.max(1, amount));
    this.health = Math.max(0, this.health - actual);
    this.invulnerable = this.damageInvulnerabilityWindow;
    this.hitReactionTimer = 0.38;
    if (this.health <= 0) {
      this.isAlive = false;
      this.defeatPose = true;
    }
    return actual;
  }

  animate(time, dt = 1 / 60) {
    const speedFactor = THREE.MathUtils.clamp(this.horizontalSpeed / 24, 0, 1.4);
    const sprintLean = this.isBoosting ? 1.35 : this.isSprinting ? 1.1 : this.isRunning ? 0.75 : 0;
    const blend = THREE.MathUtils.clamp(dt * 12, 0, 1);

    if (this.invulnerable > 0) {
      this.invulnerable = Math.max(0, this.invulnerable - dt);
    }
    if (this.hitReactionTimer > 0) {
      this.hitReactionTimer = Math.max(0, this.hitReactionTimer - dt);
    }
    if (this.comboResetTimer > 0) {
      this.comboResetTimer = Math.max(0, this.comboResetTimer - dt);
      if (this.comboResetTimer === 0) {
        this.comboStep = 0;
      }
    }

    // === RUN & IDLE LIMB KINEMATICS ===
    const runCycle = this.isRunning && this.horizontalSpeed > 1.2
      ? time * (7 + this.horizontalSpeed * 0.42)
      : 0;

    const rightArm = this.arms[1];
    const leftArm = this.arms[0];
    const rightLeg = this.legs[1];
    const leftLeg = this.legs[0];

    if (this.isRunning && this.horizontalSpeed > 1.2) {
      // Classic Shinobi forward sprint: arms trail back aerodynamically, legs stride swiftly
      const stride = Math.sin(runCycle);
      rightLeg.rotation.x = stride * 0.82;
      leftLeg.rotation.x = -stride * 0.82;

      // Shinobi arm posture (aerodynamic trail with weapon forward ready)
      leftArm.rotation.x = -0.45 - sprintLean * 0.42 + Math.cos(runCycle) * 0.25;
      leftArm.rotation.z = -0.22;
      rightArm.rotation.x = -0.35 - sprintLean * 0.38 - Math.cos(runCycle) * 0.25;
      rightArm.rotation.z = 0.22;
    } else {
      // Idle / Breathing ready stance
      const breath = Math.sin(time * 2.2);
      this.torso.position.y = 1.32 + breath * 0.018;
      rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, 0.06, blend);
      leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, -0.06, blend);
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, 0.08 + breath * 0.03, blend);
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, -0.15, blend);
      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, -0.12, blend);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, 0.16, blend);
    }

    // Jump / Airborne pose & Landing Dynamic Crouch
    if (!this.grounded) {
      this.wasAirborne = true;
      const airLift = THREE.MathUtils.clamp(this.velocity.y / 15, -0.8, 0.8);
      rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, 0.55 - airLift * 0.3, blend);
      leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, -0.45 - airLift * 0.3, blend);
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, -0.65, blend);
      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, -0.55, blend);
    } else if (this.wasAirborne) {
      this.wasAirborne = false;
      this.landingImpact = THREE.MathUtils.clamp(Math.abs(this.velocity.y) / 14, 0.25, 1.0);
      this.landingCrouch = 0.24 * this.landingImpact;
      this.landingEffectPending = true;
    }

    if (this.landingCrouch > 0) {
      this.landingCrouch = Math.max(0, this.landingCrouch - dt * 2.5);
      this.torso.position.y = 1.32 - this.landingCrouch * 0.35;
      rightLeg.rotation.x += this.landingCrouch * 0.65;
      leftLeg.rotation.x += this.landingCrouch * 0.65;
    }

    this.dashAttackCooldown = Math.max(0, this.dashAttackCooldown - dt);

    // === ATTACK ANIMATIONS (KATANA SLASHES, DASH ATTACKS, & FINISHERS) ===
    if (this.attackTimer > 0 && this.attackDuration > 0) {
      const progress = 1 - this.attackTimer / this.attackDuration;
      const swing = Math.sin(Math.min(1, progress * 1.35) * Math.PI);
      if (this.attackAction === 'katana-combo-1') {
        // Fast horizontal Katana slash: arm cuts right-to-left with torso twist
        rightArm.rotation.x = -0.35 + swing * 0.45;
        rightArm.rotation.y = 0.5 - swing * 2.3;
        rightArm.rotation.z = 0.2 - swing * 0.85;
        this.weapon.rotation.z = -0.3 - swing * 1.5;
        this.weapon.rotation.y = swing * 0.95;
        this.weapon.rotation.x = 0.15 + swing * 0.4;
        this.torso.rotation.y = -swing * 0.32;
      } else if (this.attackAction === 'katana-combo-2') {
        // Rising diagonal cross-slash: blade sweeps up from low-left to high-right
        rightArm.rotation.x = -1.35 + swing * 1.7;
        rightArm.rotation.y = -0.65 + swing * 1.9;
        rightArm.rotation.z = -0.35 + swing * 1.1;
        this.weapon.rotation.z = 0.7 - swing * 1.9;
        this.weapon.rotation.x = -0.5 + swing * 0.9;
        this.torso.rotation.y = swing * 0.36;
      } else if (this.attackAction === 'katana-finisher') {
        // Devastating overhead leaping finisher: both arms raise blade high overhead and cleave down
        const cleaveProgress = Math.min(1, progress * 1.45);
        const cleaveSwing = Math.sin(cleaveProgress * Math.PI);
        rightArm.rotation.x = -2.25 + cleaveSwing * 2.85;
        rightArm.rotation.y = -0.1 + cleaveSwing * 0.35;
        rightArm.rotation.z = 0.3 - cleaveSwing * 0.6;
        leftArm.rotation.x = -1.95 + cleaveSwing * 2.5;
        leftArm.rotation.z = -0.3 + cleaveSwing * 0.5;
        this.weapon.rotation.z = 1.35 - cleaveSwing * 2.5;
        this.weapon.rotation.x = -cleaveSwing * 0.8;
        this.torso.rotation.x = targetLean + cleaveSwing * 0.42;
      } else if (this.attackAction === 'katana-empowered-finisher') {
        // Omnislash empowered finisher: aerial spin into crater cleave
        const cleaveProgress = Math.min(1, progress * 1.4);
        const cleaveSwing = Math.sin(cleaveProgress * Math.PI);
        rightArm.rotation.x = -2.6 + cleaveSwing * 3.4;
        rightArm.rotation.y = -0.15 + cleaveSwing * 0.4;
        rightArm.rotation.z = 0.35 - cleaveSwing * 0.7;
        leftArm.rotation.x = -2.3 + cleaveSwing * 3.0;
        leftArm.rotation.z = -0.35 + cleaveSwing * 0.6;
        this.weapon.rotation.z = 1.6 - cleaveSwing * 3.2;
        this.weapon.rotation.x = -cleaveSwing * 1.1;
        this.torso.rotation.x = targetLean + cleaveSwing * 0.65;
        this.torso.rotation.y = Math.sin(progress * Math.PI * 2) * 0.45;
      } else if (this.attackAction === 'katana-dash-slash') {
        // Lightning Iaijutsu cross-draw dash attack
        rightArm.rotation.x = -1.65 + swing * 2.3;
        rightArm.rotation.y = -1.15 + swing * 2.5;
        rightArm.rotation.z = -0.45 + swing * 1.4;
        leftArm.rotation.x = -0.7 - swing * 0.5;
        this.weapon.rotation.z = 0.9 - swing * 2.5;
        this.weapon.rotation.x = -0.65 + swing * 1.3;
        this.torso.rotation.y = 0.5 - swing * 1.0;
        this.torso.rotation.x = targetLean + swing * 0.3;
      } else if (this.attackAction === 'slash') {
        // Wide horizontal Katana sweep
        rightArm.rotation.x = -0.4 + swing * 0.5;
        rightArm.rotation.y = -swing * 1.6;
        rightArm.rotation.z = 0.3 - swing * 0.8;
        this.weapon.rotation.z = -0.32 - swing * 1.1;
      } else if (this.attackAction === 'strike') {
        // High downward diagonal execution strike
        rightArm.rotation.x = -swing * 1.8;
        rightArm.rotation.y = swing * 0.35;
        this.weapon.rotation.z = swing * 0.65;
      } else if (this.attackAction === 'charge') {
        // Ready stance / Iaijutsu focus
        rightArm.rotation.x = -0.65;
        leftArm.rotation.x = -0.4;
        this.weapon.rotation.z = -0.2 - this.chargeLevel * 0.35;
      } else if (this.attackAction === 'execute') {
        // Deadly spinning execution strike
        rightArm.rotation.x = -swing * 2.1;
        rightArm.rotation.y = -swing * 0.8;
        this.weapon.rotation.z = -swing * 1.2;
      } else if (this.attackAction === 'dash') {
        // Low piercing dash thrust
        rightArm.rotation.x = -1.2;
        rightArm.rotation.y = 0.3;
        this.weapon.rotation.z = 0.25;
      }
    }

    // Hit Reaction / Defeat / Victory
    if (this.defeatPose) {
      this.torso.rotation.x = THREE.MathUtils.lerp(this.torso.rotation.x, 0.72, blend);
      this.head.rotation.x = THREE.MathUtils.lerp(this.head.rotation.x, 0.45, blend);
      this.root.rotation.z = THREE.MathUtils.lerp(this.root.rotation.z, 0.38, blend);
    } else if (this.victoryPose) {
      this.arms[0].rotation.z = THREE.MathUtils.lerp(this.arms[0].rotation.z, 0.65, blend);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, -0.65, blend);
      this.torso.rotation.z = THREE.MathUtils.lerp(this.torso.rotation.z, Math.sin(time * 1.5) * 0.03, blend);
    } else if (this.hitReactionTimer > 0) {
      const flinch = this.hitReactionTimer / 0.38;
      this.torso.rotation.z = THREE.MathUtils.lerp(this.torso.rotation.z, -0.22 * flinch, blend);
      this.head.rotation.x = THREE.MathUtils.lerp(this.head.rotation.x, 0.2 * flinch, blend);
    } else {
      this.torso.rotation.z = THREE.MathUtils.lerp(this.torso.rotation.z, 0, blend);
      this.head.rotation.x = THREE.MathUtils.lerp(this.head.rotation.x, 0, blend);
    }

    // Forward aerodynamic lean
    const targetLean = this.dashDuration > 0 ? -0.45 : -0.06 - sprintLean * 0.42;
    this.torso.rotation.x = THREE.MathUtils.lerp(this.torso.rotation.x, targetLean, blend);

    // === REALISTIC FLOWING RED SCARF PHYSICS ===
    // Wave rippling combined with momentum and speed stretch
    for (let i = 0; i < this.scarfSegments.length; i++) {
      const seg = this.scarfSegments[i];
      const wavePhase = time * (5 + speedFactor * 4) + i * 0.68;
      const waveAmplitude = 0.08 + speedFactor * 0.16;

      // Vertical lift & flutter
      const targetRotX = Math.sin(wavePhase) * waveAmplitude + (speedFactor * 0.25);
      // Lateral wind drift & turn swing
      const targetRotY = Math.cos(wavePhase * 0.8) * (waveAmplitude * 0.65) - (this.turnLean * 0.35);
      const targetRotZ = Math.sin(wavePhase * 1.2) * (waveAmplitude * 0.4);

      seg.rotation.x = THREE.MathUtils.lerp(seg.rotation.x, targetRotX, blend * 1.4);
      seg.rotation.y = THREE.MathUtils.lerp(seg.rotation.y, targetRotY, blend * 1.4);
      seg.rotation.z = THREE.MathUtils.lerp(seg.rotation.z, targetRotZ, blend * 1.4);
    }

    // Facing & roll lean
    this.root.rotation.y = Math.atan2(this.facing.x, this.facing.z);
    const turnLean = THREE.MathUtils.clamp(this.turnLean * 0.25, -0.28, 0.28);
    const targetRoll = this.wallRun ? -this.wallRunSide * 0.24 : turnLean * speedFactor;
    this.root.rotation.z = THREE.MathUtils.lerp(this.root.rotation.z, targetRoll, blend);

    // Speed Ribbon & Particles
    const ribbonActive = this.horizontalSpeed >= 26 || this.overdriveTimer > 0 || this.isBoosting;
    this.speedRibbon.visible = ribbonActive;
    if (ribbonActive) {
      this.speedRibbon.scale.setScalar(0.92 + Math.min(1, speedFactor) * 0.26);
      this.speedRibbon.rotation.y = time * (2.4 + speedFactor * 2.2);
    }

    // Drone rig orbit
    this.droneRig.children.forEach((drone) => {
      const orbit = time * 1.8 + drone.userData.orbit;
      drone.position.set(Math.cos(orbit) * 0.85, 1.4 + Math.sin(time * 2.4 + orbit) * 0.14, Math.sin(orbit) * 0.7);
      drone.rotation.y = -orbit + Math.PI / 2;
    });

    if (this.leftWeapon) {
      this.leftWeapon.rotation.z = -this.weapon.rotation.z;
      this.leftWeapon.rotation.x = this.weapon.rotation.x;
    }
  }

  startAttack(action, duration) {
    this.attackAction = action;
    this.attackDuration = duration;
    this.attackTimer = duration;
  }

  performKatanaAttack() {
    if (!this.isAlive) return null;
    // Allow rapid combo chaining once past 45% of current swing
    if (this.attackTimer > 0.04) {
      if (this.attackTimer > this.attackDuration * 0.48) {
        return null;
      }
    }

    if (this.comboResetTimer > 0) {
      this.comboStep = (this.comboStep % 3) + 1;
    } else {
      this.comboStep = 1;
    }

    this.currentAttackId++;
    let duration = 0.28;
    let action = 'katana-combo-1';

    if (this.comboStep === 1) {
      action = 'katana-combo-1';
      duration = 0.28;
      this.comboResetTimer = 0.95;
    } else if (this.comboStep === 2) {
      action = 'katana-combo-2';
      duration = 0.30;
      this.comboResetTimer = 0.95;
    } else {
      const isEmpowered = this.combo >= 4;
      action = isEmpowered ? 'katana-empowered-finisher' : 'katana-finisher';
      duration = isEmpowered ? 0.52 : 0.44;
      this.comboResetTimer = 0; // Finisher completes the 3-hit chain
    }

    this.startAttack(action, duration);
    return {
      step: this.comboStep,
      action,
      duration,
      attackId: this.currentAttackId,
      isEmpowered: action === 'katana-empowered-finisher'
    };
  }

  performDashAttack(target = null, direction = null) {
    if (!this.isAlive || this.dashAttackCooldown > 0 || this.energy < 16) return null;
    this.energy = Math.max(0, this.energy - 16);
    this.dashAttackCooldown = 2.2;
    this.dashTimer = 2.2;
    this.dashSequence++;

    let dashDir = new THREE.Vector3();
    let targetDist = 0;
    if (target && target.alive) {
      dashDir.subVectors(target.root.position, this.root.position).setY(0);
      targetDist = dashDir.length();
      if (targetDist > 0.001) dashDir.normalize();
      else dashDir.copy(this.facing);
    } else if (direction && direction.lengthSq() > 0.01) {
      dashDir.copy(direction).setY(0).normalize();
    } else {
      dashDir.copy(this.facing).setY(0).normalize();
    }

    if (dashDir.lengthSq() < 0.001) dashDir.set(0, 0, 1);
    this.facing.copy(dashDir);

    const DASH_SPEED = 42;
    this.velocity.x = dashDir.x * DASH_SPEED;
    this.velocity.z = dashDir.z * DASH_SPEED;
    this.dashDuration = 0.32;

    this.currentAttackId++;
    this.dashAttackState = {
      phase: 'dash',
      target: target && target.alive ? target : null,
      targetDist,
      dashDir: dashDir.clone(),
      timer: 0.16,
      attackId: this.currentAttackId,
      slashTriggered: false
    };

    this.startAttack('dash', 0.32);
    return {
      attackId: this.currentAttackId,
      target: this.dashAttackState.target,
      dashDir
    };
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
    group.position.set(0.03, -0.74, 0.1);
    group.rotation.set(0.15, 0.05, -0.32);

    const dark = this.materials.weaponMetal;
    const gold = this.materials.ninjaGold;
    const steel = this.materials.katanaSteel;

    if (config.id === 'kinetic-gauntlets') {
      // Tekko-Kagi Iron Ninja Claws
      const gauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.36, 0.28), dark);
      gauntlet.position.set(0, 0.05, 0.06);
      group.add(gauntlet);
      for (const offset of [-0.09, 0, 0.09]) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.42, 4), steel);
        claw.position.set(offset, 0.32, 0.12);
        claw.rotation.x = -0.22;
        group.add(claw);
      }
    } else if (config.id === 'arc-spear') {
      // Shinobi Naginata Polearm
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.042, 2.2, 8), dark);
      shaft.position.set(0, 0.4, 0);
      group.add(shaft);
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.72, 6), steel);
      blade.position.set(0, 1.76, 0);
      blade.scale.set(0.35, 1, 1);
      group.add(blade);
      const guard = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.028, 6, 12), gold);
      guard.position.set(0, 1.42, 0);
      guard.rotation.x = Math.PI / 2;
      group.add(guard);
    } else if (config.id === 'twin-shadow-blades') {
      // Twin Kodachi
      this.createKatanaMesh(group, 0.78);
    } else {
      // Shadow Katana / Muramasa
      this.createKatanaMesh(group, 1.0);
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
    this.speed = 0;
    this.horizontalSpeed = 0;
    this.isRunning = false;
    this.movementState = 'STOPPED';
    this.isSprinting = false;
    this.isMaxSpeed = false;
    this.boostEnergy = 100;
    this.boostMax = 100;
    this.boostCooldownTimer = 0;
    this.boostRecoveryDelay = 0;
    this.boostMultiplier = 1.48;
    this.isBoosting = false;
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
    this.dashAttackCooldown = 0;
    this.dashAttackState = null;
    this.wasAirborne = false;

    for (const seg of this.scarfSegments) {
      seg.rotation.set(0, 0, 0);
    }
  }
}
