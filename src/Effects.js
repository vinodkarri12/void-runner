import * as THREE from 'three';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.trails = [];
    this.particles = [];
    this.particlePool = [];
    this.isMobile = (typeof window !== 'undefined') &&
      (window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 700);
    this.maxParticles = this.isMobile ? 110 : 240;
    this.afterimages = [];
    this.afterimageCursor = 0;
    this.speedStreaks = [];
    this.footprints = [];
    this.shockwavePool = [];
    this.speedEffectCursor = 0;

    this.trailGeometry = new THREE.CylinderGeometry(0.1, 0.22, 1.5, 8, 1, true);
    this.particleGeometry = new THREE.SphereGeometry(0.09, 6, 6);
    this.shockwaveGeometry = new THREE.TorusGeometry(0.5, 0.05, 8, 24);
    this.speedStreakGeometry = new THREE.CylinderGeometry(0.035, 0.12, 1.8, 5, 1, true);
    this.footprintGeometry = new THREE.TorusGeometry(0.18, 0.018, 4, 12);
    this.dashGeometry = new THREE.CylinderGeometry(0.04, 0.24, 3.4, 8, 1, true);
    this.slashGeometry = new THREE.TorusGeometry(1.05, 0.075, 8, 24, Math.PI * 1.18);

    this.materialCache = new Map();
    this.scratchVector = new THREE.Vector3();
    this.scratchVector2 = new THREE.Vector3();
    this.upVector = new THREE.Vector3(0, 1, 0);

    const streakCount = this.isMobile ? 12 : 20;
    for (let index = 0; index < streakCount; index++) {
      const streak = new THREE.Mesh(this.speedStreakGeometry, this.createEffectMaterial(0x7bdbff, 0.58));
      streak.visible = false;
      streak.userData.life = 0;
      streak.userData.maxLife = 0.22;
      this.scene.add(streak);
      this.speedStreaks.push(streak);
    }
    const footprintCount = this.isMobile ? 8 : 12;
    for (let index = 0; index < footprintCount; index++) {
      const footprint = new THREE.Mesh(this.footprintGeometry, this.createEffectMaterial(0x6ddfff, 0.56));
      footprint.rotation.x = Math.PI / 2;
      footprint.visible = false;
      footprint.userData.life = 0;
      footprint.userData.maxLife = 0.34;
      this.scene.add(footprint);
      this.footprints.push(footprint);
    }

    // Drifting Autumn Leaves & Sakura Petals
    this.leafCount = this.isMobile ? 28 : 52;
    this.leaves = [];
    const leafColors = [0xd62432, 0xe67322, 0xc71f38, 0xef8947, 0xe882a7];
    const leafGeo = new THREE.PlaneGeometry(0.18, 0.24);
    for (let i = 0; i < this.leafCount; i++) {
      const col = leafColors[i % leafColors.length];
      const mat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const leaf = new THREE.Mesh(leafGeo, mat);
      leaf.position.set(
        (Math.random() - 0.5) * 40,
        2 + Math.random() * 8,
        (Math.random() - 0.5) * 50
      );
      leaf.userData = {
        phase: Math.random() * Math.PI * 2,
        fallSpeed: 0.7 + Math.random() * 0.9,
        driftSpeed: 1.1 + Math.random() * 1.4,
        rotSpeedX: (Math.random() - 0.5) * 3,
        rotSpeedY: (Math.random() - 0.5) * 2.5
      };
      this.scene.add(leaf);
      this.leaves.push(leaf);
    }
  }

  createEffectMaterial(color, opacity = 0.9, side = THREE.FrontSide) {
    const key = `${color}_${opacity}_${side}`;
    let mat = this.materialCache.get(key);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        side,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      this.materialCache.set(key, mat);
    }
    return mat;
  }

  getPooledParticle(color = 0x74d5ff) {
    const particle = this.particlePool.pop();
    if (particle) {
      if (particle.userData.particleColor !== color) {
        particle.material = this.createEffectMaterial(color, 0.95);
        particle.userData.particleColor = color;
      }
      particle.visible = true;
      return particle;
    }
    if (this.particles.length + this.particlePool.length >= this.maxParticles) return null;
    const mat = this.createEffectMaterial(color, 0.95);
    const created = new THREE.Mesh(this.particleGeometry, mat);
    created.userData.particleColor = color;
    created.visible = true;
    this.scene.add(created);
    return created;
  }

  spawnTrail(position, color = 0x79deff, scale = 1) {
    const mat = this.createEffectMaterial(color, 0.75, THREE.DoubleSide).clone();
    const mesh = new THREE.Mesh(this.trailGeometry, mat);
    mesh.position.copy(position);
    mesh.rotation.x = Math.PI / 2;
    mesh.scale.setScalar(scale);
    this.scene.add(mesh);
    this.trails.push({ mesh, life: 0.42, maxLife: 0.42 });
  }

  burst(position, color = 0x74d5ff, count = 20, power = 5) {
    const actualCount = this.isMobile ? Math.min(count, 10) : count;
    for (let i = 0; i < actualCount; i++) {
      const particle = this.getPooledParticle(color);
      if (!particle) return;
      this.scratchVector.set(
        Math.random() - 0.5,
        Math.random() * 0.8,
        Math.random() - 0.5
      ).normalize();
      particle.position.copy(position);
      particle.userData.velocity = this.scratchVector.multiplyScalar(power * (0.7 + Math.random())).clone();
      particle.userData.life = 0.35 + Math.random() * 0.55;
      particle.userData.maxLife = particle.userData.life;
      this.particles.push(particle);
    }
  }

  bootParticles(position, color = 0x67e4ff, count = 2, power = 1.4) {
    const actualCount = this.isMobile ? 1 : count;
    for (let index = 0; index < actualCount; index++) {
      const particle = this.getPooledParticle(color);
      if (!particle) return;
      particle.position.copy(position);
      if (!particle.userData.velocity) particle.userData.velocity = new THREE.Vector3();
      particle.userData.velocity.set(
        (Math.random() - 0.5) * power,
        Math.random() * power * 0.45,
        (Math.random() - 0.5) * power - 0.4
      );
      particle.userData.life = 0.18 + Math.random() * 0.16;
      particle.userData.maxLife = particle.userData.life;
      particle.scale.setScalar(0.48);
      this.particles.push(particle);
    }
  }

  speedStreak(position, facing, color = 0x8e72ff, intensity = 1) {
    const streak = this.speedStreaks[this.speedEffectCursor++ % this.speedStreaks.length];
    streak.visible = true;
    streak.position.copy(position).addScaledVector(facing, -0.55);
    this.scratchVector.copy(facing).normalize();
    streak.quaternion.setFromUnitVectors(this.upVector, this.scratchVector);
    streak.scale.setScalar(0.6 + intensity * 0.9);
    streak.material.color.setHex(color);
    streak.material.opacity = 0.62;
    streak.userData.life = 0.22;
  }

  footprint(position, color = 0x6ddfff, scale = 1) {
    const footprint = this.footprints[this.speedEffectCursor++ % this.footprints.length];
    footprint.visible = true;
    footprint.position.copy(position);
    footprint.rotation.set(Math.PI / 2, 0, Math.random() * Math.PI);
    footprint.scale.setScalar(scale);
    footprint.material.color.setHex(color);
    footprint.material.opacity = 0.56;
    footprint.userData.life = footprint.userData.maxLife;
  }

  afterimage(source, color = 0x70efff) {
    if (this.isMobile) return;
    if (!this.afterimages.length) {
      for (let index = 0; index < 4; index++) {
        const material = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.24,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          depthWrite: false
        });
        const copy = source.clone(true);
        copy.traverse((object) => {
          if (object.isMesh) {
            object.material = material;
            object.castShadow = false;
            object.receiveShadow = false;
          }
        });
        copy.visible = false;
        copy.userData.life = 0;
        copy.userData.material = material;
        this.scene.add(copy);
        this.afterimages.push(copy);
      }
    }
    const image = this.afterimages[this.afterimageCursor++ % this.afterimages.length];
    image.position.copy(source.position);
    image.rotation.copy(source.rotation);
    image.scale.copy(source.scale);
    image.userData.life = 0.19;
    image.userData.color = color;
    image.userData.material.color.setHex(color);
    image.visible = true;
    image.updateMatrixWorld(true);
  }

  shockwave(position, color = 0x80dfff, scale = 1) {
    let ring = this.shockwavePool.pop();
    if (!ring) {
      const mat = this.createEffectMaterial(color, 0.95).clone();
      ring = new THREE.Mesh(this.shockwaveGeometry, mat);
      ring.rotation.x = Math.PI / 2;
    } else {
      ring.material.color.setHex(color);
      ring.material.opacity = 0.95;
      ring.visible = true;
    }
    ring.position.copy(position);
    ring.position.y += 0.22;
    ring.scale.setScalar(scale * 0.2);
    if (!ring.parent) this.scene.add(ring);
    this.trails.push({ mesh: ring, life: 0.62, maxLife: 0.62, ring: true });
  }

  slashArc(position, facing, color = 0xb76dff, scale = 1, tiltAngle = 0.12, rotZ = 0) {
    const mat = this.createEffectMaterial(color, 0.95, THREE.DoubleSide).clone();
    const arc = new THREE.Mesh(this.slashGeometry, mat);
    arc.position.copy(position);
    arc.position.addScaledVector(facing, 0.95);
    arc.position.y += 0.15;
    arc.rotation.y = Math.atan2(facing.x, facing.z) - Math.PI * 0.59;
    arc.rotation.x = tiltAngle;
    arc.rotation.z = rotZ;
    arc.scale.setScalar(scale);
    this.scene.add(arc);
    this.trails.push({ mesh: arc, life: 0.28, maxLife: 0.28, slash: true });
  }

  katanaSlashTrail(position, facing, comboIndex = 1, color = 0xff3855, scale = 1.35) {
    const trailPos = position.clone().add(new THREE.Vector3(0, 1.15, 0));
    if (comboIndex === 1) {
      // Horizontal clean Katana sweep
      this.slashArc(trailPos, facing, color, scale * 1.25, 0.08, -0.15);
      this.burst(trailPos.clone().addScaledVector(facing, 1.2), color, this.isMobile ? 4 : 7, 3.2);
    } else if (comboIndex === 2) {
      // Rising diagonal cross-slash
      this.slashArc(trailPos, facing, 0xff7043, scale * 1.4, -0.38, 0.65);
      this.burst(trailPos.clone().addScaledVector(facing, 1.3), 0xff8a50, this.isMobile ? 5 : 9, 3.8);
    } else {
      // Powerful leaping finisher: giant crimson-gold crescent wave
      this.slashArc(trailPos, facing, 0xff1744, scale * 1.95, 0.22, 0.1);
      this.slashArc(trailPos, facing, 0xffd700, scale * 1.6, -0.15, -0.2);
      this.shockwave(position, 0xff3d00, 1.8);
      this.sparks(trailPos.clone().addScaledVector(facing, 1.5), 0xffd54f, this.isMobile ? 8 : 16, 6.2);
    }
  }

  sparks(position, color = 0xffdf6d, count = 10, power = 5.5) {
    const actualCount = this.isMobile ? Math.min(count, 6) : count;
    for (let i = 0; i < actualCount; i++) {
      const particle = this.getPooledParticle(color);
      if (!particle) return;
      this.scratchVector.set(
        (Math.random() - 0.5) * 2,
        Math.random() * 1.8 + 0.4,
        (Math.random() - 0.5) * 2
      ).normalize();
      particle.position.copy(position);
      particle.userData.velocity = this.scratchVector.multiplyScalar(power * (0.6 + Math.random() * 0.7)).clone();
      particle.userData.life = 0.2 + Math.random() * 0.22;
      particle.userData.maxLife = particle.userData.life;
      particle.userData.gravity = 11;
      particle.scale.setScalar(0.7);
      this.particles.push(particle);
    }
  }

  defeatSmoke(position, scale = 1) {
    const smokeColors = [0x15151e, 0x2d172f, 0x471d3a, 0xc42338];
    const smokeCount = this.isMobile ? 12 : 22;
    for (let i = 0; i < smokeCount; i++) {
      const col = smokeColors[i % smokeColors.length];
      const particle = this.getPooledParticle(col);
      if (!particle) return;
      particle.position.copy(position).add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.7 * scale,
        0.3 + Math.random() * 1.2 * scale,
        (Math.random() - 0.5) * 0.7 * scale
      ));
      particle.userData.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2.2,
        1.2 + Math.random() * 2.4,
        (Math.random() - 0.5) * 2.2
      );
      particle.userData.life = 0.55 + Math.random() * 0.5;
      particle.userData.maxLife = particle.userData.life;
      particle.userData.gravity = -0.5; // gentle upward smoke billow
      particle.userData.growRate = 1.4;
      particle.scale.setScalar(0.9 * scale);
      this.particles.push(particle);
    }
    this.shockwave(position, 0x3d1428, 1.2 * scale);
  }

  dashStreak(position, facing, color = 0xbf67ff) {
    const mat = this.createEffectMaterial(color, 0.8).clone();
    const streak = new THREE.Mesh(this.dashGeometry, mat);
    streak.position.copy(position).addScaledVector(facing, 1.25);
    streak.position.y += 1.1;
    this.scratchVector.copy(facing).normalize();
    streak.quaternion.setFromUnitVectors(this.upVector, this.scratchVector);
    this.scene.add(streak);
    this.trails.push({ mesh: streak, life: 0.28, maxLife: 0.28, streak: true });
  }

  damageNumber(position, amount, color = '#e7faff') {
    this.floatingText(position, `-${Math.round(amount)}`, color);
  }

  floatingText(position, text, color = '#e7faff') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const context = canvas.getContext('2d');
    context.font = 'bold 54px Segoe UI, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.shadowColor = color;
    context.shadowBlur = 16;
    context.fillStyle = color;
    context.fillText(text, 128, 48);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false
    }));
    sprite.position.copy(position).add(new THREE.Vector3(0, 2.3, 0));
    sprite.scale.set(1.5, 0.56, 1);
    sprite.renderOrder = 30;
    this.scene.add(sprite);
    this.trails.push({ mesh: sprite, life: 0.8, maxLife: 0.8, damageNumber: true, texture });
  }

  energyTether(start, end, color = 0xb36cff) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const line = new THREE.Line(geometry, material);
    this.scene.add(line);
    this.trails.push({ mesh: line, life: 0.34, maxLife: 0.34, tether: true });
  }

  chargePulse(position, charge) {
    const hue = charge >= 0.98 ? 0xdffaff : 0x78cfff;
    this.shockwave(position, hue, 1 + charge * 0.7);
    this.burst(position.clone().add(new THREE.Vector3(0, 1.1, 0)), hue, 5 + Math.round(charge * 6), 1.8 + charge * 2);
  }

  update(dt, playerPosition = null) {
    if (this.leaves && this.leaves.length) {
      const pX = playerPosition ? playerPosition.x : 0;
      const pY = playerPosition ? playerPosition.y : 0;
      const pZ = playerPosition ? playerPosition.z : 0;
      for (const leaf of this.leaves) {
        leaf.userData.phase += dt * 2.2;
        leaf.position.y -= leaf.userData.fallSpeed * dt;
        leaf.position.x += Math.sin(leaf.userData.phase) * dt * leaf.userData.driftSpeed;
        leaf.position.z += Math.cos(leaf.userData.phase * 0.7) * dt * 0.8;
        leaf.rotation.x += leaf.userData.rotSpeedX * dt;
        leaf.rotation.y += leaf.userData.rotSpeedY * dt;

        if (leaf.position.y < pY - 0.4 || leaf.position.z < pZ - 20) {
          leaf.position.set(
            pX + (Math.random() - 0.5) * 36,
            pY + 3.5 + Math.random() * 7,
            pZ + 12 + Math.random() * 45
          );
        }
      }
    }

    for (let i = this.trails.length - 1; i >= 0; i--) {
      const item = this.trails[i];
      item.life -= dt;
      const ratio = Math.max(0, item.life / item.maxLife);
      if (item.ring) {
        item.mesh.scale.setScalar(0.24 + (1 - ratio) * 8.2);
        item.mesh.material.opacity = ratio;
      } else if (item.slash) {
        item.mesh.scale.setScalar(0.82 + (1 - ratio) * 0.38);
        item.mesh.material.opacity = ratio;
      } else if (item.streak) {
        item.mesh.scale.set(0.75 + (1 - ratio) * 0.8, 0.7 + (1 - ratio) * 0.8, 0.75 + (1 - ratio) * 0.8);
        item.mesh.material.opacity = ratio * 0.8;
      } else if (item.damageNumber) {
        item.mesh.position.y += dt * 1.2;
        item.mesh.material.opacity = ratio;
      } else if (item.tether) {
        item.mesh.material.opacity = ratio;
      } else {
        item.mesh.material.opacity = ratio * 0.8;
      }
      if (item.life <= 0) {
        if (item.ring) {
          item.mesh.visible = false;
          this.shockwavePool.push(item.mesh);
        } else {
          this.scene.remove(item.mesh);
          if (item.texture) item.texture.dispose();
          if ((item.tether) && item.mesh.geometry) item.mesh.geometry.dispose();
          if (item.mesh.material && !item.slash && !item.streak) item.mesh.material.dispose();
        }
        this.trails.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.userData.life -= dt;
      const gravity = p.userData.gravity !== undefined ? p.userData.gravity : 6;
      p.userData.velocity.y -= gravity * dt;
      if (p.userData.growRate) p.scale.addScalar(p.userData.growRate * dt);
      p.material.opacity = Math.max(0, p.userData.life / p.userData.maxLife);
      if (p.userData.life <= 0) {
        p.visible = false;
        p.scale.setScalar(1);
        p.userData.growRate = 0;
        p.userData.gravity = 6;
        this.particles.splice(i, 1);
        this.particlePool.push(p);
      }
    }

    for (const effect of [...this.speedStreaks, ...this.footprints]) {
      if (!effect.visible) continue;
      effect.userData.life -= dt;
      effect.material.opacity = Math.max(0, effect.userData.life / effect.userData.maxLife) * 0.62;
      if (effect.userData.life <= 0) effect.visible = false;
    }
    for (const image of this.afterimages) {
      if (!image.visible) continue;
      image.userData.life -= dt;
      image.userData.material.opacity = Math.max(0, image.userData.life / 0.19) * 0.24;
      if (image.userData.life <= 0) image.visible = false;
    }
  }
}
