import * as THREE from 'three';

const NORMAL_SPEED = 19;
const SPRINT_SPEED = 30;
const DASH_SPEED = 42;

export class MovementSystem {
  constructor() {
    this.input = {
      moveX: 0,
      moveY: 0,
      sprint: false,
      jump: false,
      slide: false,
      dash: false,
      wallRun: false
    };
    this.dashHeld = false;
    this.jumpHeld = false;
    this.slideHeld = false;
    this.wallRunSide = 0;
    this.direction = new THREE.Vector3();
    this.displacement = new THREE.Vector3();
    this.anchor = null;
    this.anchorPoint = new THREE.Vector3();
    this.anchorRadial = new THREE.Vector3();
    this.anchorTangent = new THREE.Vector3();
    this.anchorLength = 0;
    this.activePadId = null;
  }

  setAnchor(anchor) {
    if (!anchor) {
      this.anchor = null;
      return;
    }
    this.anchor = anchor;
    this.anchorPoint.copy(anchor.point);
    this.anchorLength = anchor.length;
  }

  update(player, dt, world) {
    player.previousPosition.copy(player.root.position);
    const moveMagnitude = Math.min(1, Math.hypot(this.input.moveX, this.input.moveY));
    const moving = moveMagnitude > 0.001;
    const overdrive = player.overdriveTimer > 0;
    const sprinting = this.input.sprint && moving;
    const targetSpeed = overdrive ? sprinting ? 38 : 26 : sprinting ? SPRINT_SPEED : NORMAL_SPEED;
    const acceleration = player.grounded ? sprinting ? 52 : 38 : sprinting ? 24 : 17;
    this.direction.set(this.input.moveX, 0, this.input.moveY);

    if (moving) {
      this.direction.normalize();
      const targetX = this.direction.x * targetSpeed * moveMagnitude;
      const targetZ = this.direction.z * targetSpeed * moveMagnitude;
      const turnCross = player.facing.x * this.direction.z - player.facing.z * this.direction.x;
      player.turnLean = THREE.MathUtils.clamp(turnCross, -1, 1);
      const response = 1 - Math.exp(-acceleration * dt / Math.max(8, player.horizontalSpeed));
      player.velocity.x = THREE.MathUtils.lerp(player.velocity.x, targetX, response);
      player.velocity.z = THREE.MathUtils.lerp(player.velocity.z, targetZ, response);
      player.facing.lerp(this.direction, 1 - Math.exp(-dt * (sprinting ? 13 : 18))).normalize();
    } else if (player.grounded) {
      const deceleration = 28;
      const damping = Math.exp(-deceleration * dt);
      player.velocity.x *= damping;
      player.velocity.z *= damping;
      if (Math.hypot(player.velocity.x, player.velocity.z) < 0.12) {
        player.velocity.x = 0;
        player.velocity.z = 0;
      }
    } else {
      const damping = Math.exp(-2.2 * dt);
      player.velocity.x *= damping;
      player.velocity.z *= damping;
    }

    if (this.anchor) {
      this.anchorRadial.set(
        player.root.position.x - this.anchorPoint.x,
        0,
        player.root.position.z - this.anchorPoint.z
      );
      if (this.anchorRadial.lengthSq() > 0.001) {
        this.anchorRadial.normalize();
        this.anchorTangent.copy(this.direction)
          .addScaledVector(this.anchorRadial, -this.direction.dot(this.anchorRadial));
        if (this.anchorTangent.lengthSq() > 0.001) {
          player.velocity.addScaledVector(this.anchorTangent.normalize(), 12 * dt * moveMagnitude);
        }
      }
    }

    const maxSpeed = overdrive ? sprinting ? 38 : 26 : sprinting ? SPRINT_SPEED : NORMAL_SPEED;
    const exitProgress = Math.max(0, player.overdriveExitTimer / 0.5);
    const speedLimit = maxSpeed + Math.max(0, player.overdriveExitSpeed - maxSpeed) * exitProgress;
    const horizontalSpeed = player.horizontalSpeed;
    if (horizontalSpeed > speedLimit && player.dashDuration <= 0) {
      const scale = speedLimit / horizontalSpeed;
      player.velocity.x *= scale;
      player.velocity.z *= scale;
    }
    player.overdriveExitTimer = Math.max(0, player.overdriveExitTimer - dt);

    if (this.input.jump && !this.jumpHeld && player.grounded) {
      player.velocity.y = 10.2;
      player.grounded = false;
      player.landingCrouch = 0;
    }
    this.jumpHeld = this.input.jump;

    if (this.input.slide && !this.slideHeld && player.grounded && player.slideTimer <= 0 && moving) {
      player.slideTimer = 0.72;
      player.velocity.x *= 1.16;
      player.velocity.z *= 1.16;
    }
    this.slideHeld = this.input.slide;
    player.slideTimer = Math.max(0, player.slideTimer - dt);
    player.landingCrouch = Math.max(0, player.landingCrouch - dt);
    player.landingImpact = Math.max(0, player.landingImpact - dt * 24);

    if (this.input.dash && !this.dashHeld && player.dashTimer <= 0 && player.energy >= 15) {
      const dashDirection = moving ? this.direction.clone().normalize() : player.facing.clone().setY(0).normalize();
      if (dashDirection.lengthSq() < 0.01) dashDirection.set(0, 0, 1);
      player.facing.copy(dashDirection);
      player.velocity.x = dashDirection.x * DASH_SPEED;
      player.velocity.z = dashDirection.z * DASH_SPEED;
      player.dashDuration = 0.2;
      player.dashTimer = 0.9;
      player.energy = Math.max(0, player.energy - 15);
      player.dashSequence++;
    }
    this.dashHeld = this.input.dash;
    player.dashDuration = Math.max(0, player.dashDuration - dt);
    player.dashTimer = Math.max(0, player.dashTimer - dt);

    const wasGrounded = player.grounded;
    player.wallRun = false;
    this.wallRunSide = 0;
    const absoluteX = player.root.position.x + world.worldOffset.x;
    const alongsideRoadWall = Math.abs(absoluteX) > 8.35 && Math.abs(absoluteX) < 11.7;
    const forwardAlongWall = Math.abs(player.velocity.z) > Math.abs(player.velocity.x) * 0.7;
    if (!wasGrounded && alongsideRoadWall && forwardAlongWall && player.horizontalSpeed > 9 &&
        world.isBesideWall(player.root.position.x, player.root.position.z, 1.8)) {
      player.wallRun = true;
      this.wallRunSide = Math.sign(absoluteX) || 1;
    }

    if (!player.wallRun) player.velocity.y -= 24 * dt;
    else player.velocity.y = Math.max(player.velocity.y - 4 * dt, -1.4);

    this.displacement.set(player.velocity.x * dt, player.velocity.y * dt, player.velocity.z * dt);
    const substeps = Math.max(1, Math.ceil(this.displacement.length() / 0.55));
    const substep = this.displacement.clone().multiplyScalar(1 / substeps);
    let hitWall = false;
    let landingSpeed = 0;
    for (let step = 0; step < substeps; step++) {
      const previousX = player.root.position.x;
      const previousZ = player.root.position.z;
      player.root.position.add(substep);
      if (world.resolveFeatureCollision(player.root.position)) {
        hitWall = true;
        const normalX = player.root.position.x - previousX;
        const normalZ = player.root.position.z - previousZ;
        const normalLength = Math.hypot(normalX, normalZ) || 1;
        const nx = normalX / normalLength;
        const nz = normalZ / normalLength;
        const inwardSpeed = player.velocity.x * nx + player.velocity.z * nz;
        if (inwardSpeed < 0) {
          player.velocity.x -= nx * inwardSpeed;
          player.velocity.z -= nz * inwardSpeed;
        }
      }
      const stepFloor = world.getHeight(player.root.position.x, player.root.position.z);
      if (player.root.position.y <= stepFloor) {
        if (!player.grounded) landingSpeed = Math.max(landingSpeed, Math.abs(player.velocity.y));
        player.root.position.y = stepFloor;
        player.velocity.y = 0;
        player.grounded = true;
      } else {
        player.grounded = false;
      }
    }

    if (this.anchor) {
      this.anchorRadial.set(
        player.root.position.x - this.anchorPoint.x,
        0,
        player.root.position.z - this.anchorPoint.z
      );
      const ropeDistance = this.anchorRadial.length();
      if (ropeDistance > this.anchorLength) {
        this.anchorRadial.multiplyScalar(1 / Math.max(0.001, ropeDistance));
        player.root.position.x = this.anchorPoint.x + this.anchorRadial.x * this.anchorLength;
        player.root.position.z = this.anchorPoint.z + this.anchorRadial.z * this.anchorLength;
        world.resolveFeatureCollision(player.root.position);
        const outwardSpeed = player.velocity.x * this.anchorRadial.x + player.velocity.z * this.anchorRadial.z;
        if (outwardSpeed > 0) {
          player.velocity.x -= this.anchorRadial.x * outwardSpeed;
          player.velocity.z -= this.anchorRadial.z * outwardSpeed;
        }
      }
    }

    const landed = !wasGrounded && player.grounded;
    if (landed) {
      player.landingCrouch = THREE.MathUtils.clamp(landingSpeed * 0.045, 0.12, 0.55);
      player.landingImpact = landingSpeed;
      player.landingEffectPending = landingSpeed > 4.5;
    }
    if (hitWall) {
      player.wallRun = player.wallRun && world.isBesideWall(player.root.position.x, player.root.position.z, 1.8);
    }
    if (player.wallRun && Math.abs(player.velocity.x) > 0.5) {
      player.velocity.x = THREE.MathUtils.lerp(player.velocity.x, 0, 1 - Math.exp(-dt * 12));
    }
    player.wallRunSide = player.wallRun ? this.wallRunSide : 0;
    const pad = world.getVelocityPad?.(player.root.position);
    if (pad && player.velocityPadCooldown <= 0 && this.activePadId !== pad.id) {
      player.velocity.x = pad.directionX * Math.max(player.horizontalSpeed, 20);
      player.velocity.z = pad.directionZ * Math.max(player.horizontalSpeed, 20);
      player.velocityPadCooldown = 1.25;
      this.activePadId = pad.id;
      player.padBoostPending = true;
    } else if (!pad) {
      this.activePadId = null;
    }
    player.speed = player.horizontalSpeed;
    player.isSprinting = sprinting;
    player.isMaxSpeed = player.horizontalSpeed >= (overdrive ? 35 : SPRINT_SPEED * 0.92);
    player.isRunning = moving && player.horizontalSpeed > 0.3;
    if (overdrive) {
      player.movementState = 'OVERDRIVE';
    } else if (player.isMaxSpeed) {
      player.movementState = 'MAX VELOCITY';
    } else if (sprinting) {
      player.movementState = 'SPRINT';
    } else if (player.horizontalSpeed > 0.4) {
      player.movementState = 'RUNNING';
    } else {
      player.movementState = 'STOPPED';
    }
  }
}
