import * as THREE from 'three';

export class CameraController {
  constructor(camera, player) {
    this.camera = camera;
    this.player = player;
    this.lookYaw = Math.PI;
    this.lookPitch = 0.24;
    this.targetPitch = 0.24;
    this.currentFov = camera.fov;
    this.currentBank = 0;
    this.currentDistance = null;
    this.currentHeight = null;
    this.previousVelocity = new THREE.Vector3();
    this.lastHeading = new THREE.Vector3(0, 0, 1);
    this.desired = new THREE.Vector3();
    this.focus = new THREE.Vector3();
    this.smoothedFocus = new THREE.Vector3();
    this.positionScratch = new THREE.Vector3();
    this.cameraPath = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.offset = new THREE.Vector3();
    this.heading = new THREE.Vector3();
    this.aim = new THREE.Vector3();
    this.shakeOffset = new THREE.Vector3();
    this.collisionFraction = 1.0;
    this.sensitivity = 1;
    this.sensitivityX = 1;
    this.sensitivityY = 1;
    this.followStrength = 1;
    this.introTimer = 0;
    this.introDuration = 1.6;
    this.lastTouchLookTime = 0;
    this.lastUserLookTime = 0;
  }

  startIntro(duration = 1.6) {
    this.introTimer = duration;
    this.introDuration = duration;
  }

  addMouseLook(deltaX, deltaY = 0) {
    const isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 768 || ('ontouchstart' in window);
    if (isMobile) return;
    const sensX = (this.sensitivity || 1) * (this.sensitivityX || 1);
    const sensY = (this.sensitivity || 1) * (this.sensitivityY || 1);
    this.lookYaw -= deltaX * 0.0028 * sensX;
    this.targetPitch = THREE.MathUtils.clamp(this.targetPitch - deltaY * 0.0018 * sensY, -0.22, 0.65);
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    this.lastUserLookTime = now;
  }

  addTouchLook(deltaX, deltaY = 0, customSensitivity = 1) {
    const sensX = (this.sensitivity || 1) * (this.sensitivityX || 1) * customSensitivity;
    const sensY = (this.sensitivity || 1) * (this.sensitivityY || 1) * customSensitivity;
    this.lookYaw -= deltaX * 0.0042 * sensX;
    this.targetPitch = THREE.MathUtils.clamp(this.targetPitch - deltaY * 0.0028 * sensY, -0.22, 0.65);
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    this.lastTouchLookTime = now;
    this.lastUserLookTime = now;
  }

  reset() {
    this.lookYaw = Math.PI;
    const isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 768 || ('ontouchstart' in window);
    this.targetPitch = isMobile && this.camera.aspect < 1.0 ? 0.28 : 0.22;
    this.lookPitch = this.targetPitch;
    this.currentDistance = null;
    this.currentHeight = null;
    this.currentBank = 0;
    this.collisionFraction = 1.0;
    if (this.player && this.player.root) {
      this.smoothedFocus.copy(this.player.root.position).add(new THREE.Vector3(0, 1.25, 0));
    }
    this.lastHeading.set(0, 0, 1);
  }

  update(dt, targetPosition, world = null, enemies = [], shake = 0, reducedShake = false) {
    const velocity = this.player.velocity;
    const speed = this.player.horizontalSpeed;
    const speedRatio = THREE.MathUtils.clamp(speed / 38, 0, 1);
    const mobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 768 || ('ontouchstart' in window);
    const isPortrait = this.camera.aspect < 1.0;

    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const timeSinceUserLook = now - (this.lastUserLookTime || 0);

    // Smooth focus tracking centered on ninja's chest/torso
    // targetPosition passed in is player.root.position with chest offset
    const desiredFocus = this.focus.copy(targetPosition);
    if (this.smoothedFocus.lengthSq() < 0.1) {
      this.smoothedFocus.copy(desiredFocus);
    } else {
      // Smooth tracking: responsive horizontal following with fluid vertical dampening for jumps
      const followX = 1 - Math.exp(-dt * 13);
      const followY = 1 - Math.exp(-dt * 8);
      this.smoothedFocus.x += (desiredFocus.x - this.smoothedFocus.x) * followX;
      this.smoothedFocus.y += (desiredFocus.y - this.smoothedFocus.y) * followY;
      this.smoothedFocus.z += (desiredFocus.z - this.smoothedFocus.z) * followX;
    }

    // Keep ninja and nearby enemies in view during combat
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

    // Gentle combat framing: subtly blend towards combat engagement area without losing ninja center
    if (target && nearest < 14) {
      const combatWeight = (1 - nearest / 14) * 0.14;
      const combatTargetX = (target.root.position.x + this.player.root.position.x) * 0.5;
      const combatTargetZ = (target.root.position.z + this.player.root.position.z) * 0.5;
      this.smoothedFocus.x = THREE.MathUtils.lerp(this.smoothedFocus.x, combatTargetX, combatWeight);
      this.smoothedFocus.z = THREE.MathUtils.lerp(this.smoothedFocus.z, combatTargetZ, combatWeight);
    }

    // Camera Auto-Alignment (PREVENT UNWANTED SPINNING):
    // Only ease behind player on mobile when running forward without manual camera drag for > 3.0s.
    // On PC, mouse has full authority. Never spin when moving backwards, strafing, or dodging!
    if (mobile && timeSinceUserLook > 3000 && speed > 9) {
      const camFwdX = -Math.sin(this.lookYaw);
      const camFwdZ = -Math.cos(this.lookYaw);
      const velMag = Math.hypot(velocity.x, velocity.z);
      if (velMag > 0.1) {
        const velDotFwd = (camFwdX * velocity.x + camFwdZ * velocity.z) / velMag;
        // Only if running forward relative to camera view
        if (velDotFwd > 0.65) {
          const desiredYaw = Math.atan2(-velocity.x, -velocity.z);
          const yawDelta = Math.atan2(Math.sin(desiredYaw - this.lookYaw), Math.cos(desiredYaw - this.lookYaw));
          this.lookYaw += yawDelta * (1 - Math.exp(-dt * 1.5));
        }
      }
    }

    this.lookPitch += (this.targetPitch - this.lookPitch) * (1 - Math.exp(-dt * 9));

    // Dynamic camera framing distance and elevation
    const chargePullback = this.player.chargeLevel * (mobile ? 1.0 : 1.6);
    const overdrivePullback = this.player.overdriveTimer > 0 ? (mobile ? 0.7 : 1.1) : 0;
    const dashPullback = this.player.dashDuration > 0 ? 0.35 : 0;
    const boostPullback = this.player.isBoosting ? (mobile ? 0.5 : 0.8) : 0;
    const bossPullback = target?.type === 'colossus'
      ? (mobile ? 3.4 : 4.6) + Math.max(0, target.spec.scale - 2.25) * 1.2
      : 0;
    const closeCombatPullback = target && nearest < 12 ? (mobile ? 0.6 : 1.0) : 0;

    let introLift = 0;
    if (this.introTimer > 0) {
      this.introTimer = Math.max(0, this.introTimer - dt);
      introLift = (this.introTimer / this.introDuration) * 3.2;
    }

    const baseDist = mobile ? (isPortrait ? 8.6 : 7.2) : (6.9 + speedRatio * 2.2);
    const targetDistance = baseDist + chargePullback + overdrivePullback +
      dashPullback + boostPullback + bossPullback + closeCombatPullback + introLift * 0.7;

    const baseHeight = mobile ? (isPortrait ? 3.7 : 2.9) : (2.65 + speedRatio * 0.45);
    const targetHeight = baseHeight + (target?.type === 'colossus' ? 0.8 : 0) + introLift;

    if (this.currentDistance === null) this.currentDistance = targetDistance;
    if (this.currentHeight === null) this.currentHeight = targetHeight;
    const framingResponse = 1 - Math.exp(-dt * (mobile ? 4.0 : 3.2));
    this.currentDistance += (targetDistance - this.currentDistance) * framingResponse;
    this.currentHeight += (targetHeight - this.currentHeight) * framingResponse;

    this.offset.set(
      Math.sin(this.lookYaw) * this.currentDistance,
      this.currentHeight + this.lookPitch * 1.6,
      Math.cos(this.lookYaw) * this.currentDistance
    );

    this.desired.copy(this.smoothedFocus).add(this.offset);

    // Collision detection with world walls, terrain, and environment objects
    const path = this.cameraPath.subVectors(this.desired, this.smoothedFocus);
    const totalDist = path.length();
    const minSafeDist = 2.4; // Keep minimum distance so camera never clips into ninja model

    let hitFraction = 1.0;
    if (totalDist > minSafeDist) {
      const steps = 14;
      for (let i = 2; i <= steps; i++) {
        const frac = i / steps;
        this.positionScratch.copy(this.smoothedFocus).addScaledVector(path, frac);

        // Ground / terrain clearance test
        if (world && typeof world.getHeight === 'function') {
          const terrainY = world.getHeight(this.positionScratch.x, this.positionScratch.z);
          if (this.positionScratch.y < terrainY + 0.6) {
            hitFraction = Math.min(hitFraction, Math.max(minSafeDist / totalDist, (i - 1) / steps));
            break;
          }
        }

        // Wall & solid obstacle clearance test
        if (world && typeof world.isLocationClear === 'function' && !world.isLocationClear(this.positionScratch.x, this.positionScratch.z, 0.48)) {
          hitFraction = Math.min(hitFraction, Math.max(minSafeDist / totalDist, (i - 1) / steps));
          break;
        }
      }
    }

    // Smooth collision response: rapidly pull in to avoid clipping, smoothly ease out when clear
    if (hitFraction < this.collisionFraction) {
      this.collisionFraction += (hitFraction - this.collisionFraction) * (1 - Math.exp(-dt * 18));
    } else {
      this.collisionFraction += (hitFraction - this.collisionFraction) * (1 - Math.exp(-dt * 5.0));
    }
    this.collisionFraction = THREE.MathUtils.clamp(this.collisionFraction, minSafeDist / Math.max(0.1, totalDist), 1.0);

    if (this.collisionFraction < 0.999) {
      this.desired.copy(this.smoothedFocus).addScaledVector(path, this.collisionFraction);
    }

    const followRate = (mobile ? 8.4 : (6.6 + speedRatio * 2.2)) * (this.followStrength || 1.0);
    this.camera.position.lerp(this.desired, 1 - Math.exp(-dt * followRate));

    // Ensure camera stays above terrain floor and feature collision is resolved
    if (world) {
      const floor = (typeof world.getHeight === 'function' ? world.getHeight(this.camera.position.x, this.camera.position.z) : 0) + 1.35;
      this.camera.position.y = Math.max(this.camera.position.y, floor);
      if (typeof world.resolveFeatureCollision === 'function') {
        world.resolveFeatureCollision(this.camera.position, 0.45);
      }
    }

    this.camera.lookAt(this.smoothedFocus);

    // Camera shake (only during combat impacts, never during normal running)
    if (shake > 0.02) {
      const shakeScale = reducedShake ? 0.08 : (mobile ? 0.14 : 0.22);
      const shakeAmount = Math.min(mobile ? 0.1 : 0.16, shake * shakeScale);
      if (shakeAmount > 0) {
        this.shakeOffset.set(
          (Math.random() - 0.5) * shakeAmount,
          (Math.random() - 0.5) * shakeAmount,
          (Math.random() - 0.5) * shakeAmount
        );
        this.camera.position.add(this.shakeOffset);
      }
    }

    const baseFov = mobile ? (isPortrait ? 66 : 58) : 58;
    const targetFov = baseFov + speedRatio * (mobile ? 5 : 14) +
      (this.player.isBoosting ? (mobile ? 3.5 : 6.0) : 0) +
      (this.player.overdriveTimer > 0 ? (mobile ? 2 : 3.5) : 0) +
      (this.player.dashDuration > 0 ? 1.5 : 0);
    this.currentFov += (targetFov - this.currentFov) * (1 - Math.exp(-dt * 3.0));
    this.camera.fov = this.currentFov;
    this.camera.updateProjectionMatrix();
  }
}
