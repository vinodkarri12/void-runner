import * as THREE from 'three';

const CHUNK_SIZE = 96;
const CHUNK_RADIUS = 2;
const GRID_SEGMENTS = 24;

function hash2(x, z) {
  let h = Math.imul(x, 374761393) + Math.imul(z, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smoothNoise(x, z, scale) {
  const gx = x / scale;
  const gz = z / scale;
  const x0 = Math.floor(gx);
  const z0 = Math.floor(gz);
  const tx = gx - x0;
  const tz = gz - z0;
  const sx = tx * tx * (3 - 2 * tx);
  const sz = tz * tz * (3 - 2 * tz);
  const a = THREE.MathUtils.lerp(hash2(x0, z0), hash2(x0 + 1, z0), sx);
  const b = THREE.MathUtils.lerp(hash2(x0, z0 + 1), hash2(x0 + 1, z0 + 1), sx);
  return THREE.MathUtils.lerp(a, b, sz) * 2 - 1;
}

function terrainHeight(x, z) {
  const hills = smoothNoise(x, z, 80) * 4.8 + smoothNoise(x, z, 30) * 1.5;
  const roadBlend = THREE.MathUtils.smoothstep(Math.abs(x), 9, 17);
  return routeHeight(z) + hills * roadBlend;
}

function routeHeight(z) {
  return Math.sin(z / 155) * 1.1 + Math.sin(z / 47) * 0.45;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export class WorldChunkManager {
  constructor(scene) {
    this.scene = scene;
    this.chunks = new Map();
    this.worldOffset = new THREE.Vector2();
    this.terrainMaterial = new THREE.MeshStandardMaterial({
      color: 0x252d38,
      roughness: 0.92,
      metalness: 0.08,
      vertexColors: true
    });
    this.roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x172332,
      roughness: 0.76,
      metalness: 0.28,
      emissive: 0x090c12,
      emissiveIntensity: 0.35
    });
    this.edgeMaterial = new THREE.MeshStandardMaterial({
      color: 0x68dcff,
      emissive: 0x1786df,
      emissiveIntensity: 1.3,
      roughness: 0.34
    });
    this.wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x28303d,
      emissive: 0x0c1520,
      emissiveIntensity: 0.55,
      metalness: 0.62,
      roughness: 0.48,
      side: THREE.DoubleSide
    });
    this.featureMaterials = [
      new THREE.MeshStandardMaterial({ color: 0x373b45, roughness: 0.94 }),
      new THREE.MeshStandardMaterial({ color: 0x55454b, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: 0x263b39, roughness: 0.92 })
    ];
    this.rockGeometry = new THREE.DodecahedronGeometry(1, 0);
    this.pillarGeometry = new THREE.CylinderGeometry(0.65, 0.9, 5, 6, 1);
    this.velocityPadGeometry = new THREE.BoxGeometry(4.2, 0.08, 3.2);
    this.velocityPadMaterial = new THREE.MeshStandardMaterial({
      color: 0x4adfff,
      emissive: 0x168fff,
      emissiveIntensity: 1.4,
      metalness: 0.55,
      roughness: 0.3
    });
    this.trunkGeometry = new THREE.CylinderGeometry(0.16, 0.34, 4.2, 6);
    this.foliageGeometry = new THREE.IcosahedronGeometry(1, 1);
    this.foliageMaterial = new THREE.MeshStandardMaterial({
      color: 0x6d2438,
      emissive: 0x2b0716,
      emissiveIntensity: 0.65,
      roughness: 0.92
    });
  }

  getHeight(x, z) {
    const worldX = x + this.worldOffset.x;
    const worldZ = z + this.worldOffset.y;
    return Math.abs(worldX) <= 8.5 ? routeHeight(worldZ) + 0.015 : terrainHeight(worldX, worldZ);
  }

  update(position) {
    const worldX = position.x + this.worldOffset.x;
    const worldZ = position.z + this.worldOffset.y;
    const centerX = Math.floor(worldX / CHUNK_SIZE);
    const centerZ = Math.floor(worldZ / CHUNK_SIZE);
    const required = new Set();

    for (let dz = -CHUNK_RADIUS; dz <= CHUNK_RADIUS; dz++) {
      for (let dx = -CHUNK_RADIUS; dx <= CHUNK_RADIUS; dx++) {
        const cx = centerX + dx;
        const cz = centerZ + dz;
        const key = `${cx},${cz}`;
        required.add(key);
        if (!this.chunks.has(key)) this.chunks.set(key, this.createChunk(cx, cz));
      }
    }
    for (const [key, group] of this.chunks) {
      if (!required.has(key)) {
        this.scene.remove(group);
        group.traverse((object) => {
          if (
            object.isMesh &&
            object.geometry !== this.rockGeometry &&
            object.geometry !== this.pillarGeometry &&
            object.geometry !== this.velocityPadGeometry &&
            object.geometry !== this.trunkGeometry &&
            object.geometry !== this.foliageGeometry
          ) {
            object.geometry.dispose();
          }
        });
        this.chunks.delete(key);
      }
    }
  }

  rebaseIfNeeded(player, scene, camera) {
    if (Math.max(Math.abs(player.root.position.x), Math.abs(player.root.position.z)) < 1200) return;
    const shiftX = Math.trunc(player.root.position.x / CHUNK_SIZE) * CHUNK_SIZE;
    const shiftZ = Math.trunc(player.root.position.z / CHUNK_SIZE) * CHUNK_SIZE;
    if (shiftX === 0 && shiftZ === 0) return;

    this.worldOffset.x += shiftX;
    this.worldOffset.y += shiftZ;
    for (const child of scene.children) {
      if (child.isLight) continue;
      child.position.x -= shiftX;
      child.position.z -= shiftZ;
    }
    if (camera) {
      camera.position.x -= shiftX;
      camera.position.z -= shiftZ;
    }
  }

  resetOrigin(scene, camera) {
    const shiftX = this.worldOffset.x;
    const shiftZ = this.worldOffset.y;
    if (shiftX === 0 && shiftZ === 0) return;
    for (const child of scene.children) {
      if (child.isLight) continue;
      child.position.x += shiftX;
      child.position.z += shiftZ;
    }
    if (camera) {
      camera.position.x += shiftX;
      camera.position.z += shiftZ;
    }
    this.worldOffset.set(0, 0);
  }

  isLocationClear(x, z, radius = 2) {
    const worldX = x + this.worldOffset.x;
    const worldZ = z + this.worldOffset.y;
    for (const group of this.chunks.values()) {
      for (const feature of group.userData.solidFeatures) {
        if (feature.destroyed || feature.type === 'velocity-pad') continue;
        if (feature.type === 'wall') {
          if (
            Math.abs(worldZ - feature.z) <= feature.halfLength + radius &&
            Math.abs(worldX - feature.x) <= feature.halfThickness + radius
          ) return false;
          continue;
        }
        if (Math.hypot(worldX - feature.x, worldZ - feature.z) < radius + feature.radius) return false;
      }
    }
    return true;
  }

  isBesideWall(x, z, reach = 1.8) {
    const worldX = x + this.worldOffset.x;
    const worldZ = z + this.worldOffset.y;
    for (const group of this.chunks.values()) {
      for (const feature of group.userData.solidFeatures) {
        if (
          feature.type === 'wall' &&
          Math.abs(worldZ - feature.z) <= feature.halfLength &&
          Math.abs(Math.abs(worldX - feature.x) - feature.halfThickness) <= reach
        ) return true;
      }
    }
    return false;
  }

  getVelocityPad(position) {
    const worldX = position.x + this.worldOffset.x;
    const worldZ = position.z + this.worldOffset.y;
    for (const group of this.chunks.values()) {
      for (const feature of group.userData.solidFeatures) {
        if (feature.type === 'velocity-pad' &&
            Math.hypot(worldX - feature.x, worldZ - feature.z) < feature.radius) return feature;
      }
    }
    return null;
  }

  findAnchorPoint(origin, direction, range) {
    const originX = origin.x + this.worldOffset.x;
    const originZ = origin.z + this.worldOffset.y;
    let best = null;
    let bestDistance = range;
    for (const group of this.chunks.values()) {
      for (const feature of group.userData.solidFeatures) {
        if (feature.type === 'velocity-pad' || feature.destroyed) continue;
        let x = feature.x;
        let z = feature.z;
        if (feature.type === 'wall') {
          const side = Math.sign(originX - feature.x) || 1;
          x += side * (feature.halfThickness + 0.45);
          z = THREE.MathUtils.clamp(originZ, feature.z - feature.halfLength + 1, feature.z + feature.halfLength - 1);
        } else {
          const radius = feature.radius || 1;
          x -= direction.x * radius * 0.7;
          z -= direction.z * radius * 0.7;
        }
        const dx = x - originX;
        const dz = z - originZ;
        const projection = dx * direction.x + dz * direction.z;
        const lateral = Math.abs(dx * direction.z - dz * direction.x);
        if (projection < 3 || projection > bestDistance || lateral > (feature.halfThickness || feature.radius || 1) + 1.5) continue;
        bestDistance = projection;
        best = new THREE.Vector3(
          x - this.worldOffset.x,
          this.getHeight(x - this.worldOffset.x, z - this.worldOffset.y) + 1.5,
          z - this.worldOffset.y
        );
      }
    }
    return best;
  }

  damageBreakableAt(position, impactSpeed) {
    if (impactSpeed < 12) return null;
    const worldX = position.x + this.worldOffset.x;
    const worldZ = position.z + this.worldOffset.y;
    for (const group of this.chunks.values()) {
      for (const feature of group.userData.solidFeatures) {
        if (feature.type !== 'breakable' || feature.destroyed) continue;
        if (Math.hypot(worldX - feature.x, worldZ - feature.z) > feature.radius + 1.2) continue;
        feature.destroyed = true;
        if (feature.object) feature.object.visible = false;
        if (feature.accent) feature.accent.visible = false;
        return feature;
      }
    }
    return null;
  }

  resolveFeatureCollision(position, radius = 0.7) {
    const startX = position.x;
    const startZ = position.z;
    const worldX = position.x + this.worldOffset.x;
    const worldZ = position.z + this.worldOffset.y;
    const chunkX = Math.floor(worldX / CHUNK_SIZE);
    const chunkZ = Math.floor(worldZ / CHUNK_SIZE);

    for (let pass = 0; pass < 2; pass++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const group = this.chunks.get(`${chunkX + dx},${chunkZ + dz}`);
          if (!group) continue;
          for (const feature of group.userData.solidFeatures) {
            if (feature.destroyed || feature.type === 'velocity-pad') continue;
            const deltaX = position.x + this.worldOffset.x - feature.x;
            const deltaZ = position.z + this.worldOffset.y - feature.z;
            if (feature.type === 'wall') {
              if (
                Math.abs(deltaZ) <= feature.halfLength + radius &&
                Math.abs(deltaX) < feature.halfThickness + radius
              ) {
                const normalX = deltaX >= 0 ? 1 : -1;
                position.x += normalX * (feature.halfThickness + radius - Math.abs(deltaX));
              }
              continue;
            }
            const distance = Math.hypot(deltaX, deltaZ);
            const minDistance = radius + feature.radius;
            if (distance >= minDistance) continue;
            const normalX = distance > 0.001 ? deltaX / distance : 1;
            const normalZ = distance > 0.001 ? deltaZ / distance : 0;
            position.x += normalX * (minDistance - distance);
            position.z += normalZ * (minDistance - distance);
          }
        }
      }
    }
    return Math.hypot(position.x - startX, position.z - startZ) > 0.001;
  }

  createChunk(cx, cz) {
    const group = new THREE.Group();
    group.name = `terrain-chunk-${cx}-${cz}`;
    group.userData.solidFeatures = [];
    const worldOriginX = cx * CHUNK_SIZE;
    const worldOriginZ = cz * CHUNK_SIZE;
    const originX = worldOriginX - this.worldOffset.x;
    const originZ = worldOriginZ - this.worldOffset.y;
    group.position.set(originX, 0, originZ);
    const positions = [];
    const colors = [];
    const indices = [];
    const color = new THREE.Color();

    for (let iz = 0; iz <= GRID_SEGMENTS; iz++) {
      for (let ix = 0; ix <= GRID_SEGMENTS; ix++) {
        const x = worldOriginX + ix / GRID_SEGMENTS * CHUNK_SIZE;
        const z = worldOriginZ + iz / GRID_SEGMENTS * CHUNK_SIZE;
        const y = terrainHeight(x, z) - 0.3;
        positions.push(ix / GRID_SEGMENTS * CHUNK_SIZE, y, iz / GRID_SEGMENTS * CHUNK_SIZE);
        const variation = smoothNoise(x, z, 13) * 0.06;
        color.setRGB(0.3 + variation, 0.34 + variation, 0.39 + variation);
        colors.push(color.r, color.g, color.b);
        if (ix < GRID_SEGMENTS && iz < GRID_SEGMENTS) {
          const a = iz * (GRID_SEGMENTS + 1) + ix;
          const b = a + GRID_SEGMENTS + 1;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const terrain = new THREE.Mesh(geometry, this.terrainMaterial);
    terrain.receiveShadow = true;
    group.add(terrain);

    if (cx === 0) {
      const roadCenterX = -worldOriginX;
      const roadGeometry = this.createRouteSurface(worldOriginZ, roadCenterX, 17);
      const road = new THREE.Mesh(roadGeometry, this.roadMaterial);
      road.receiveShadow = true;
      group.add(road);
      for (const xOffset of [-8.15, 8.15]) {
        const edge = new THREE.Mesh(this.createRouteSurface(worldOriginZ, roadCenterX + xOffset, 0.12, 0.055), this.edgeMaterial);
        group.add(edge);
      }
      for (const side of [-1, 1]) {
        const wallWorldX = side * 10.4;
        const wallX = wallWorldX - worldOriginX;
        group.userData.solidFeatures.push({
          type: 'wall',
          x: wallWorldX,
          z: worldOriginZ + CHUNK_SIZE / 2,
          halfLength: CHUNK_SIZE / 2,
          halfThickness: 0.22
        });
        const wall = new THREE.Mesh(this.createRouteWall(worldOriginZ, wallX, 4.2, wallWorldX), this.wallMaterial);
        group.add(wall);
        for (let marker = 0; marker < 4; marker++) {
          const panel = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.7, 0.12), this.edgeMaterial);
          const panelZ = worldOriginZ + marker * 24 + 12;
          panel.position.set(wallX - side * 0.28, terrainHeight(wallWorldX, panelZ) + 2.3, marker * 24 + 12);
          group.add(panel);
        }
      }
      const roadMarkMaterial = this.featureMaterials[0];
      for (let mark = 0; mark < 8; mark++) {
        const dashZ = mark * 12 + 4;
        const dash = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 4.4), roadMarkMaterial);
        dash.position.set(roadCenterX, routeHeight(worldOriginZ + dashZ) + 0.04, dashZ);
        dash.rotation.x = -Math.atan((routeHeight(worldOriginZ + dashZ + 0.1) - routeHeight(worldOriginZ + dashZ - 0.1)) / 0.2);
        group.add(dash);
      }
      for (let padIndex = 0; padIndex < 4; padIndex++) {
        const padZ = worldOriginZ + 30 + padIndex * 24;
        const directionX = padIndex % 2 === 0 ? 0 : 0.28;
        const pad = {
          id: `${cz}:${padIndex}`,
          type: 'velocity-pad',
          x: 0,
          z: padZ,
          radius: 2.5,
          directionX,
          directionZ: Math.sqrt(1 - directionX * directionX)
        };
        group.userData.solidFeatures.push(pad);
        const padMesh = new THREE.Mesh(this.velocityPadGeometry, this.velocityPadMaterial);
        padMesh.position.set(roadCenterX, routeHeight(padZ) + 0.1, padZ - worldOriginZ);
        padMesh.rotation.y = Math.atan2(pad.directionX, pad.directionZ);
        group.add(padMesh);
        for (let stripe = -1; stripe <= 1; stripe++) {
          const arrow = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.035, 1.1), this.edgeMaterial);
          arrow.position.set(stripe * 0.72, 0.07, 0);
          padMesh.add(arrow);
        }
      }
    }

    this.addFeatures(group, cx, cz, group.userData.solidFeatures);
    this.scene.add(group);
    return group;
  }

  createRouteSurface(worldStartZ, centerX, width, offsetY = 0.02) {
    const vertices = [];
    const indices = [];
    const across = 1;
    const length = GRID_SEGMENTS;
    for (let iz = 0; iz <= length; iz++) {
      const localZ = iz / length * CHUNK_SIZE;
      const height = routeHeight(worldStartZ + localZ) + offsetY;
      for (let ix = 0; ix <= across; ix++) {
        vertices.push(centerX - width / 2 + ix * width / across, height, localZ);
      }
      if (iz < length) {
        const a = iz * (across + 1);
        const b = a + across + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  createRouteWall(worldStartZ, centerX, height, worldX) {
    const vertices = [];
    const indices = [];
    for (let iz = 0; iz <= GRID_SEGMENTS; iz++) {
      const localZ = iz / GRID_SEGMENTS * CHUNK_SIZE;
      const baseY = terrainHeight(worldX, worldStartZ + localZ);
      vertices.push(centerX - 0.22, baseY, localZ);
      vertices.push(centerX + 0.22, baseY, localZ);
      vertices.push(centerX - 0.22, baseY + height, localZ);
      vertices.push(centerX + 0.22, baseY + height, localZ);
      if (iz < GRID_SEGMENTS) {
        const a = iz * 4;
        const b = a + 4;
        indices.push(a, b, a + 2, b, b + 2, a + 2);
        indices.push(a + 1, a + 3, b + 1, b + 1, a + 3, b + 3);
        indices.push(a + 2, b + 2, a + 3, b + 2, b + 3, a + 3);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  addFeatures(group, cx, cz, solidFeatures) {
    const random = seededRandom(hash2(cx, cz) * 0xffffffff);
    for (let i = 0; i < 9; i++) {
      const worldX = cx * CHUNK_SIZE + random() * CHUNK_SIZE;
      const worldZ = cz * CHUNK_SIZE + random() * CHUNK_SIZE;
      if (Math.abs(worldX) < 14 || random() < 0.25) continue;
      const groundY = terrainHeight(worldX, worldZ);

      if (i % 4 === 0) {
        const pillar = new THREE.Mesh(this.pillarGeometry, this.featureMaterials[1]);
        pillar.position.set(worldX - cx * CHUNK_SIZE, groundY + 2.5, worldZ - cz * CHUNK_SIZE);
        pillar.rotation.z = (random() - 0.5) * 0.13;
        pillar.castShadow = true;
        group.add(pillar);
        const rune = new THREE.Mesh(
          new THREE.BoxGeometry(0.11, 2.1, 0.09),
          this.edgeMaterial
        );
        rune.position.set(pillar.position.x + 0.66, groundY + 2.6, pillar.position.z);
        group.add(rune);
        solidFeatures.push({
          type: 'breakable',
          x: worldX,
          z: worldZ,
          radius: 2.1,
          object: pillar,
          accent: rune
        });
      } else if (i % 4 === 1) {
        solidFeatures.push({ x: worldX, z: worldZ, radius: 1.15 });
        const trunk = new THREE.Mesh(this.trunkGeometry, this.featureMaterials[2]);
        trunk.position.set(worldX - cx * CHUNK_SIZE, groundY + 2.1, worldZ - cz * CHUNK_SIZE);
        trunk.castShadow = true;
        group.add(trunk);
        for (const canopy of [
          [0, 4.6, 0, 2.5],
          [-1.15, 3.7, 0.2, 1.65],
          [1.05, 3.8, -0.15, 1.8]
        ]) {
          const leaves = new THREE.Mesh(this.foliageGeometry, this.foliageMaterial);
          leaves.position.set(trunk.position.x + canopy[0], groundY + canopy[1], trunk.position.z + canopy[2]);
          leaves.scale.setScalar(canopy[3] * (0.8 + random() * 0.35));
          leaves.castShadow = true;
          group.add(leaves);
        }
      } else {
        const rock = new THREE.Mesh(this.rockGeometry, this.featureMaterials[i % this.featureMaterials.length]);
        const scale = 1.5 + random() * 4.5;
        solidFeatures.push({ x: worldX, z: worldZ, radius: scale * 0.9 });
        rock.position.set(worldX - cx * CHUNK_SIZE, groundY + scale * 0.38, worldZ - cz * CHUNK_SIZE);
        rock.scale.set(scale, scale * (0.6 + random() * 0.8), scale * (0.7 + random() * 0.6));
        rock.rotation.set(random(), random() * Math.PI, random());
        rock.castShadow = true;
        rock.receiveShadow = true;
        group.add(rock);
      }
    }

    if (hash2(cx + 331, cz - 174) > 0.94) {
      const islandX = 18 + random() * 54;
      const islandZ = random() * CHUNK_SIZE;
      const islandY = 34 + random() * 30;
      const island = new THREE.Mesh(this.rockGeometry, this.featureMaterials[1]);
      island.position.set(islandX, islandY, islandZ);
      island.scale.set(10 + random() * 8, 4 + random() * 4, 8 + random() * 7);
      island.rotation.y = random() * Math.PI;
      island.castShadow = true;
      group.add(island);

      const shrine = new THREE.Group();
      shrine.position.set(islandX, islandY + island.scale.y * 0.65, islandZ);
      group.add(shrine);
      for (let pillarIndex = 0; pillarIndex < 3; pillarIndex++) {
        const pillar = new THREE.Mesh(this.pillarGeometry, this.featureMaterials[0]);
        pillar.position.set((pillarIndex - 1) * 3.5, 2.5, random() * 2 - 1);
        pillar.scale.set(0.8, 1.25 + random() * 0.5, 0.8);
        pillar.castShadow = true;
        shrine.add(pillar);
      }
      const rune = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.5, 0.12), this.edgeMaterial);
      rune.position.set(0, 5, 0.7);
      shrine.add(rune);
    }
  }
}
