import * as THREE from 'three';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.trails = [];
    this.particles = [];
    this.particlePool = [];
    this.maxParticles = 240;
    this.afterimages = [];
    this.afterimageCursor = 0;
    this.speedStreaks = [];
    this.footprints = [];
    this.speedEffectCursor = 0;
    this.trailGeometry = new THREE.CylinderGeometry(0.1, 0.22, 1.5, 8, 1, true);
    this.particleGeometry = new THREE.SphereGeometry(0.09, 6, 6);
    this.shockwaveGeometry = new THREE.TorusGeometry(0.5, 0.05, 8, 28);
    this.speedStreakGeometry = new THREE.CylinderGeometry(0.035, 0.12, 1.8, 5, 1, true);
    this.footprintGeometry = new THREE.TorusGeometry(0.18, 0.018, 4, 12);
    for (let index = 0; index < 20; index++) {
      const streak = new THREE.Mesh(this.speedStreakGeometry, this.createEffectMaterial(0x7bdbff, 0.58));
      streak.visible = false;
      streak.userData.life = 0;
      streak.userData.maxLife = 0.22;
      this.scene.add(streak);
      this.speedStreaks.push(streak);
    }
    for (let index = 0; index < 12; index++) {
      const footprint = new THREE.Mesh(this.footprintGeometry, this.createEffectMaterial(0x6ddfff, 0.56));
      footprint.rotation.x = Math.PI / 2;
      footprint.visible = false;
      footprint.userData.life = 0;
      footprint.userData.maxLife = 0.34;
      this.scene.add(footprint);
      this.footprints.push(footprint);
    }
  }

  createEffectMaterial(color, opacity = 0.9) {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
  }

  getPooledParticle(color = 0x74d5ff) {
    const particle = this.particlePool.pop();
    if (particle) {
      if (particle.userData.particleColor !== color) {
        particle.material.dispose();
        particle.material = this.createEffectMaterial(color);
        particle.userData.particleColor = color;
      }
      particle.visible = true;
      return particle;
    }
    if (this.particles.length + this.particlePool.length >= this.maxParticles) return null;
    const created = new THREE.Mesh(this.particleGeometry, this.createEffectMaterial(color));
    created.userData.particleColor = color;
    created.visible = true;
    this.scene.add(created);
    return created;
  }

  spawnTrail(position, color = 0x79deff, scale = 1) {
    const mesh = new THREE.Mesh(
      this.trailGeometry,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    mesh.position.copy(position);
    mesh.rotation.x = Math.PI / 2;
    mesh.scale.setScalar(scale);
    this.scene.add(mesh);
    this.trails.push({ mesh, life: 0.42, maxLife: 0.42 });
  }

  burst(position, color = 0x74d5ff, count = 20, power = 5) {
    for (let i = 0; i < count; i++) {
      const particle = this.getPooledParticle(color);
      if (!particle) return;
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize();
      particle.position.copy(position);
      particle.userData.velocity = dir.multiplyScalar(power * (0.7 + Math.random()));
      particle.userData.life = 0.4 + Math.random() * 0.7;
      particle.userData.maxLife = particle.userData.life;
      this.particles.push(particle);
    }
  }

  bootParticles(position, color = 0x67e4ff, count = 2, power = 1.4) {
    for (let index = 0; index < count; index++) {
      const particle = this.getPooledParticle(color);
      if (!particle) return;
      particle.position.copy(position);
      particle.userData.velocity = new THREE.Vector3(
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
    streak.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), facing.clone().normalize());
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
    const ring = new THREE.Mesh(
      this.shockwaveGeometry,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(position);
    ring.position.y += 0.22;
    ring.scale.setScalar(scale * 0.2);
    this.scene.add(ring);
    this.trails.push({ mesh: ring, life: 0.62, maxLife: 0.62, ring: true });
  }

  slashArc(position, facing, color = 0xb76dff, scale = 1) {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const arc = new THREE.Mesh(new THREE.TorusGeometry(1.05 * scale, 0.075 * scale, 8, 32, Math.PI * 1.18), material);
    arc.position.copy(position);
    arc.position.addScaledVector(facing, 0.85);
    arc.rotation.y = Math.atan2(facing.x, facing.z) - Math.PI * 0.59;
    arc.rotation.x = 0.12;
    this.scene.add(arc);
    this.trails.push({ mesh: arc, life: 0.3, maxLife: 0.3, slash: true });
  }

  dashStreak(position, facing, color = 0xbf67ff) {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const streak = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.24, 3.4, 8, 1, true), material);
    streak.position.copy(position).addScaledVector(facing, 1.25);
    streak.position.y += 1.1;
    streak.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), facing.clone().normalize());
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

  update(dt) {
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
        this.scene.remove(item.mesh);
        if (item.texture) item.texture.dispose();
        if ((item.slash || item.streak || item.tether) && item.mesh.geometry) item.mesh.geometry.dispose();
        if (item.mesh.material) item.mesh.material.dispose();
        this.trails.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.userData.life -= dt;
      p.position.addScaledVector(p.userData.velocity, dt);
      p.userData.velocity.y -= 6 * dt;
      p.material.opacity = Math.max(0, p.userData.life / p.userData.maxLife);
      if (p.userData.life <= 0) {
        p.visible = false;
        p.scale.setScalar(1);
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
