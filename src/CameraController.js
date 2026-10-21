import * as THREE from 'three';

export class CameraController {
  constructor(camera, player) {
    this.camera = camera;
    this.player = player;
    this.lookYaw = Math.PI;
    this.lookPitch = 0.26;
    this.targetPitch = 0.26;
    this.currentFov = camera.fov;
    this.currentBank = 0;
    this.currentDistance = null;
    this.currentHeight = null;
    this.previousVelocity = new THREE.Vector3();
    this.lastHeading = new THREE.Vector3(0, 0, 1);
    this.desired = new THREE.Vector3();
    this.focus = new THREE.Vector3();
    this.positionScratch = new THREE.Vector3();
    this.cameraPath = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.offset = new THREE.Vector3();
    this.heading = new THREE.Vector3();
    this.aim = new THREE.Vector3();
    this.shakeOffset = new THREE.Vector3();
    this.sensitivity = 1;
    this.followStrength = 1;
  }

  addMouseLook(deltaX, deltaY = 0) {
    const isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 768 || ('ontouchstart' in window);
    if (isMobile) return;
    this.lookYaw -= deltaX * 0.0028 * this.sensitivity;
    this.targetPitch = THREE.MathUtils.clamp(this.targetPitch - deltaY * 0.0018 * this.sensitivity, -0.12, 0.62);
  }

  reset() {
    this.lookYaw = Math.PI;
    const isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 768 || ('ontouchstart' in window);
    this.targetPitch = isMobile && this.camera.aspect < 1.0 ? 0.32 : 0.26;
    this.lookPitch = this.targetPitch;
  }

  update(dt, targetPosition, world = null, enemies = [], shake = 0, reducedShake = false) {
    const velocity = this.player.velocity;
    const speed = this.player.horizontalSpeed;
    const speedRatio = THREE.MathUtils.clamp(speed / 38, 0, 1);
    const mobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 768 || ('ontouchstart' in window);
    const isPortrait = this.camera.aspect < 1.0;

    if (mobile) {
      // Stable third-person follow camera on mobile:
      // Keep aligned behind player facing down the track (yaw = Math.PI)
      const targetYaw = Math.PI;
      const yawDelta = Math.atan2(Math.sin(targetYaw - this.lookYaw), Math.cos(targetYaw - this.lookYaw));
      this.lookYaw += yawDelta * (1 - Math.exp(-dt * 8));
      this.targetPitch = isPortrait ? 0.32 : 0.26;
    } else {
      const desiredHeading = this.heading.set(velocity.x, 0, velocity.z);
      if (desiredHeading.lengthSq() > 4) {
        desiredHeading.normalize();
        const steering = THREE.MathUtils.clamp(speedRatio * 0.58 + (this.player.dashDuration > 0 ? 0.38 : 0), 0, 0.88);
        this.lastHeading.lerp(desiredHeading, 1 - Math.exp(-dt * (2.2 + speedRatio * 3.2) * steering));
      } else if (this.lastHeading.lengthSq() < 0.5) {
        this.lastHeading.set(this.player.facing.x, 0, this.player.facing.z).normalize();
      } else {
        const facingHeading = this.heading.set(this.player.facing.x, 0, this.player.facing.z);
        if (facingHeading.lengthSq() > 0.01) {
          facingHeading.normalize();
          this.lastHeading.lerp(facingHeading, 1 - Math.exp(-dt * 0.24));
        }
      }
      this.lastHeading.y = 0;
      if (this.lastHeading.lengthSq() > 0.01) this.lastHeading.normalize();

      const inputYaw = Math.atan2(-this.lastHeading.x, -this.lastHeading.z);
      const yawDelta = Math.atan2(Math.sin(inputYaw - this.lookYaw), Math.cos(inputYaw - this.lookYaw));
      const movementYawWeight = speed > 13 ? THREE.MathUtils.clamp((speed - 13) / 18, 0, 0.42) : 0;
      this.lookYaw += yawDelta * (1 - Math.exp(-dt * 1.25 * movementYawWeight));
    }

    this.lookPitch += (this.targetPitch - this.lookPitch) * (1 - Math.exp(-dt * 7));

    const turnCross = this.previousVelocity.x * velocity.z - this.previousVelocity.z * velocity.x;
    const bankTarget = mobile
      ? THREE.MathUtils.clamp(-turnCross * 0.001, -0.04, 0.04)
      : THREE.MathUtils.clamp(-turnCross * 0.0019, -0.08, 0.08);
    this.currentBank += (bankTarget - this.currentBank) * (1 - Math.exp(-dt * 5));
    this.previousVelocity.copy(velocity);

    const chargePullback = this.player.chargeLevel * (mobile ? 1.4 : 2.4);
    const overdrivePullback = this.player.overdriveTimer > 0 ? (mobile ? 0.9 : 1.35) : 0;
    const dashPullback = this.player.dashDuration > 0 ? (mobile ? 0.4 : 0.55) : 0;
    const boostPullback = this.player.isBoosting ? (mobile ? 0.6 : 0.95) : 0;

    let target = null;
    let nearest = 42;
    for (const enemy of enemies) {
      if (!enemy.alive || enemy.arrivalTimer > 0) continue;
      const range = enemy.root.position.distanceToSquared(this.player.root.position);
      if (range < nearest * nearest) {
        nearest = Math.sqrt(range);
        target = enemy;
      }
    }
    const bossPullback = target?.type === 'colossus'
      ? (mobile ? 3.8 : 5.4) + Math.max(0, target.spec.scale - 2.25) * 1.5
      : 0;
    const closeCombatPullback = target && nearest < 12 ? (mobile ? 0.7 : 1.2) : 0;

    const baseDist = mobile ? (isPortrait ? 9.4 : 8.5) : (7.7 + speedRatio * 2.9);
    const targetDistance = baseDist + chargePullback + overdrivePullback +
      dashPullback + boostPullback + bossPullback + closeCombatPullback;

    const baseHeight = mobile ? (isPortrait ? 4.1 : 3.45) : (3.25 + speedRatio * 0.65);
    const targetHeight = baseHeight + Math.max(0, velocity.y) * (mobile ? 0.015 : 0.035) +
      (target?.type === 'colossus' ? 1.0 : 0);

    if (this.currentDistance === null) this.currentDistance = targetDistance;
    if (this.currentHeight === null) this.currentHeight = targetHeight;
    const framingResponse = 1 - Math.exp(-dt * (mobile ? 3.5 : 2.4));
    this.currentDistance += (targetDistance - this.currentDistance) * framingResponse;
    this.currentHeight += (targetHeight - this.currentHeight) * framingResponse;

    this.offset.set(
      Math.sin(this.lookYaw) * this.currentDistance,
      this.currentHeight + this.lookPitch * 1.8,
      Math.cos(this.lookYaw) * this.currentDistance
    );

    const anticipation = THREE.MathUtils.clamp(speed * (mobile ? 0.03 : 0.085), 0, mobile ? 1.0 : 3.4);
    this.focus.copy(targetPosition).add(new THREE.Vector3(0, mobile ? 1.25 : 1.1, 0));
    if (!mobile) this.focus.addScaledVector(this.lastHeading, anticipation);

    if (!mobile && target && (speed > 12 || nearest < 15)) {
      const aimX = (target.root.position.x + this.player.root.position.x) * 0.5;
      const aimY = (target.root.position.y + this.player.root.position.y) * 0.5 + (target.type === 'colossus' ? 2.2 : 1.1);
      const aimZ = (target.root.position.z + this.player.root.position.z) * 0.5;
      this.focus.lerp(this.aim.set(aimX, aimY, aimZ), target.type === 'colossus' ? 0.28 : 0.12);
    }

    this.desired.copy(this.focus).add(this.offset);

    // Collision detection with world features
    const path = this.cameraPath.subVectors(this.desired, this.focus);
    const steps = Math.max(2, Math.ceil(path.length() / 1.4));
    for (let index = 1; index <= steps; index++) {
      this.positionScratch.copy(this.focus).addScaledVector(path, index / steps);
      if (world && !world.isLocationClear(this.positionScratch.x, this.positionScratch.z, 0.48)) {
        this.desired.copy(this.focus).addScaledVector(path, Math.max(0.12, (index - 1) / steps));
        break;
      }
    }

    const response = (mobile ? 5.8 : (4.8 + speedRatio * 2.6)) * this.followStrength;
    this.camera.position.lerp(this.desired, 1 - Math.exp(-dt * response));

    if (world) {
      const floor = world.getHeight(this.camera.position.x, this.camera.position.z) + 1.45;
      this.camera.position.y = Math.max(this.camera.position.y, floor);
      world.resolveFeatureCollision(this.camera.position, 0.45);
    }

    this.camera.lookAt(this.focus);
    if (this.currentBank !== 0) this.camera.rotateZ(this.currentBank);

    const shakeScale = reducedShake ? 0.12 : (mobile ? 0.18 : 0.3);
    const shakeAmount = Math.min(mobile ? 0.1 : 0.18, shake * shakeScale);
    if (shakeAmount > 0) {
      this.shakeOffset.set(
        (Math.random() - 0.5) * shakeAmount,
        (Math.random() - 0.5) * shakeAmount,
        (Math.random() - 0.5) * shakeAmount
      );
      this.camera.position.add(this.shakeOffset);
    }

    const baseFov = mobile ? (isPortrait ? 68 : 60) : 59;
    const targetFov = baseFov + speedRatio * (mobile ? 6 : 18) +
      (this.player.isBoosting ? (mobile ? 4.5 : 7.5) : 0) +
      (this.player.overdriveTimer > 0 ? (mobile ? 2 : 4) : 0) +
      (this.player.dashDuration > 0 ? (mobile ? 2 : 3) : 0);
    this.currentFov += (targetFov - this.currentFov) * (1 - Math.exp(-dt * (mobile ? 2.5 : 2.8)));
    this.camera.fov = this.currentFov;
    this.camera.updateProjectionMatrix();
  }
}
