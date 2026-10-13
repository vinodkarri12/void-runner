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
      color: 0xa0a8ae,
      roughness: 0.94,
      metalness: 0.12,
      vertexColors: true
    });
    this.roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x42484a,
      roughness: 0.82,
      metalness: 0.38,
      emissive: 0x080b0d,
      emissiveIntensity: 0.16
    });
    this.edgeMaterial = new THREE.MeshStandardMaterial({
      color: 0x576164,
      emissive: 0x111719,
      emissiveIntensity: 0.26,
      roughness: 0.58,
      metalness: 0.7
    });
    this.steelMaterial = new THREE.MeshStandardMaterial({
      color: 0x596367,
      roughness: 0.74,
      metalness: 0.48
    });
    this.roadDetailMaterial = new THREE.MeshStandardMaterial({
      color: 0x7b8281,
      emissive: 0x151a19,
      emissiveIntensity: 0.2,
      roughness: 0.62,
      metalness: 0.64
    });
    this.utilityLightMaterial = new THREE.MeshStandardMaterial({
      color: 0x8a785c,
      emissive: 0x65451f,
      emissiveIntensity: 0.62,
      roughness: 0.48,
      metalness: 0.35
    });
    this.wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x353d40,
      emissive: 0x0b0e0f,
      emissiveIntensity: 0.2,
      metalness: 0.66,
      roughness: 0.68,
      side: THREE.DoubleSide
    });
    this.featureMaterials = [
      new THREE.MeshStandardMaterial({ color: 0x3b4244, roughness: 0.84, metalness: 0.48 }),
      new THREE.MeshStandardMaterial({ color: 0x414648, roughness: 0.78, metalness: 0.62 }),
      new THREE.MeshStandardMaterial({ color: 0x242c30, roughness: 0.72, metalness: 0.7 })
    ];
    this.utilityBlockGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.pillarGeometry = new THREE.BoxGeometry(2.4, 5, 2.4);
    this.hazardStripeGeometry = new THREE.BoxGeometry(1.9, 0.16, 0.14);
    this.braceGeometry = new THREE.BoxGeometry(1, 0.22, 0.28);
    this.roadMarkGeometry = new THREE.BoxGeometry(0.16, 0.025, 4.4);
    this.wallMarkerGeometry = new THREE.BoxGeometry(0.09, 1.7, 0.12);
    this.padArrowGeometry = new THREE.BoxGeometry(0.12, 0.035, 1.1);
    this.runeGeometry = new THREE.BoxGeometry(0.11, 2.1, 0.09);
    this.roadMarkMaterial = new THREE.MeshStandardMaterial({
      color: 0x727b7e,
      roughness: 0.74,
      metalness: 0.52
    });
    this.hazardMaterial = new THREE.MeshStandardMaterial({
      color: 0xb17c4b,
      emissive: 0x482d17,
      emissiveIntensity: 0.38,
      roughness: 0.64,
      metalness: 0.48
    });
    this.deckJointGeometry = new THREE.BoxGeometry(16.7, 0.06, 0.16);
    this.gantryGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.pipeGeometry = new THREE.CylinderGeometry(0.48, 0.48, 1, 10);
    this.pipeSupportGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.roadHatchGeometry = new THREE.BoxGeometry(0.3, 0.055, 1.45);
    this.wallRailGeometry = new THREE.BoxGeometry(0.32, 0.3, CHUNK_SIZE);
    this.velocityPadGeometry = new THREE.BoxGeometry(4.2, 0.08, 3.2);
    this.velocityPadMaterial = new THREE.MeshStandardMaterial({
      color: 0x686b62,
      emissive: 0x25261c,
      emissiveIntensity: 0.32,
      metalness: 0.76,
      roughness: 0.52
    });
  }

  setCampaignPhase(level) {
    const palette = level >= 15
      ? { terrain: 0x73757d, road: 0x302b37, steel: 0x5e4e64, light: 0xb078d0 }
      : level >= 11
        ? { terrain: 0x777473, road: 0x393334, steel: 0x665354, light: 0xc27a52 }
        : level >= 6
          ? { terrain: 0x89847a, road: 0x3c3c39, steel: 0x625d52, light: 0xc3975e }
          : { terrain: 0xa0a8ae, road: 0x42484a, steel: 0x596367, light: 0x8a785c };
    this.terrainMaterial.color.setHex(palette.terrain);
    this.roadMaterial.color.setHex(palette.road);
    this.steelMaterial.color.setHex(palette.steel);
    this.utilityLightMaterial.color.setHex(palette.light);
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
            object.geometry !== this.utilityBlockGeometry &&
            object.geometry !== this.pillarGeometry &&
            object.geometry !== this.velocityPadGeometry &&
            object.geometry !== this.braceGeometry &&
            object.geometry !== this.roadMarkGeometry &&
            object.geometry !== this.wallMarkerGeometry &&
            object.geometry !== this.padArrowGeometry &&
            object.geometry !== this.runeGeometry &&
            object.geometry !== this.hazardStripeGeometry &&
            object.geometry !== this.deckJointGeometry &&
            object.geometry !== this.gantryGeometry &&
            object.geometry !== this.pipeGeometry &&
            object.geometry !== this.pipeSupportGeometry &&
            object.geometry !== this.roadHatchGeometry &&
            object.geometry !== this.wallRailGeometry
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
        color.setRGB(0.34 + variation, 0.38 + variation, 0.42 + variation);
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
        const edge = new THREE.Mesh(this.createRouteSurface(worldOriginZ, roadCenterX + xOffset, 0.12, 0.03), this.edgeMaterial);
        group.add(edge);
      }
      const wallMarkers = new THREE.InstancedMesh(this.wallMarkerGeometry, this.utilityLightMaterial, 8);
      const hazardMarkers = new THREE.InstancedMesh(this.wallMarkerGeometry, this.hazardMaterial, 4);
      const markerTransform = new THREE.Object3D();
      let markerIndex = 0;
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
        const wall = new THREE.Mesh(this.createRouteWall(worldOriginZ, wallX, 4.2, wallWorldX), this.steelMaterial);
        group.add(wall);
        for (let marker = 0; marker < 4; marker++) {
          const panelZ = worldOriginZ + marker * 24 + 12;
          markerTransform.position.set(wallX - side * 0.28, terrainHeight(wallWorldX, panelZ) + 2.3, marker * 24 + 12);
          markerTransform.scale.set(1, 1, 1);
          markerTransform.updateMatrix();
          wallMarkers.setMatrixAt(markerIndex++, markerTransform.matrix);
          if (marker % 2 === 0) {
            markerTransform.position.x = wallX - side * 0.31;
            markerTransform.position.y += 0.18;
            markerTransform.scale.set(1.15, 0.62, 1.1);
            markerTransform.updateMatrix();
            hazardMarkers.setMatrixAt((side === -1 ? 0 : 2) + marker / 2, markerTransform.matrix);
          }
        }
        const rail = new THREE.Mesh(this.wallRailGeometry, this.steelMaterial);
        rail.position.set(wallX - side * 0.35, 3.95, CHUNK_SIZE / 2);
        group.add(rail);
      }
      wallMarkers.instanceMatrix.needsUpdate = true;
      group.add(wallMarkers);
      hazardMarkers.instanceMatrix.needsUpdate = true;
      group.add(hazardMarkers);

      const gantryBeams = new THREE.InstancedMesh(this.gantryGeometry, this.steelMaterial, 3);
      const gantrySupports = new THREE.InstancedMesh(this.gantryGeometry, this.steelMaterial, 6);
      const gantryBraces = new THREE.InstancedMesh(this.gantryGeometry, this.steelMaterial, 12);
      const gantryLights = new THREE.InstancedMesh(this.gantryGeometry, this.utilityLightMaterial, 3);
      const gantryTransform = new THREE.Object3D();
      let braceIndex = 0;
      const gantryPositions = [24, 52, 80];
      for (let index = 0; index < gantryPositions.length; index++) {
        const gantryZ = gantryPositions[index];
        gantryTransform.position.set(0, 18.2, gantryZ);
        gantryTransform.scale.set(32, 1.35, 1.45);
        gantryTransform.updateMatrix();
        gantryBeams.setMatrixAt(index, gantryTransform.matrix);
        gantryTransform.position.set(0, 17.48, gantryZ);
        gantryTransform.scale.set(20, 0.14, 0.2);
        gantryTransform.updateMatrix();
        gantryLights.setMatrixAt(index, gantryTransform.matrix);
        for (const side of [-1, 1]) {
          gantryTransform.position.set(side * 12.8, 9.1, gantryZ);
          gantryTransform.scale.set(1.35, 18.2, 1.5);
          gantryTransform.updateMatrix();
          gantrySupports.setMatrixAt(index * 2 + (side === 1 ? 1 : 0), gantryTransform.matrix);
          for (const direction of [-1, 1]) {
            const startX = side * (direction < 0 ? 8.4 : 12.2);
            const endX = side * (direction < 0 ? 12.2 : 8.4);
            const startY = 5.5;
            const endY = 17.5;
            const dx = endX - startX;
            const dy = endY - startY;
            gantryTransform.position.set((startX + endX) / 2, (startY + endY) / 2, gantryZ);
            gantryTransform.scale.set(Math.hypot(dx, dy), 0.48, 0.55);
            gantryTransform.rotation.set(0, 0, Math.atan2(dy, dx));
            gantryTransform.updateMatrix();
            gantryBraces.setMatrixAt(braceIndex++, gantryTransform.matrix);
          }
        }
      }
      gantryBeams.instanceMatrix.needsUpdate = true;
      gantrySupports.instanceMatrix.needsUpdate = true;
      gantryBraces.instanceMatrix.needsUpdate = true;
      gantryLights.instanceMatrix.needsUpdate = true;
      group.add(gantryBeams, gantrySupports, gantryBraces, gantryLights);
      this.addIndustrialCorridor(group, worldOriginX, worldOriginZ);

      const roadMarks = new THREE.InstancedMesh(this.roadMarkGeometry, this.roadMarkMaterial, 8);
      const deckJoints = new THREE.InstancedMesh(this.deckJointGeometry, this.roadDetailMaterial, 16);
      const roadHatches = new THREE.InstancedMesh(this.roadHatchGeometry, this.steelMaterial, 8);
      const markTransform = new THREE.Object3D();
      for (const seamX of [-5.65, 5.65]) {
        const seam = new THREE.Mesh(
          this.createRouteSurface(worldOriginZ, roadCenterX + seamX, 0.13, 0.03),
          this.roadDetailMaterial
        );
        group.add(seam);
      }
      for (let plate = 0; plate < 16; plate++) {
        const jointZ = 2 + plate * 6;
        const slope = (routeHeight(worldOriginZ + jointZ + 0.1) - routeHeight(worldOriginZ + jointZ - 0.1)) / 0.2;
        markTransform.position.set(roadCenterX, routeHeight(worldOriginZ + jointZ) + 0.045, jointZ);
        markTransform.rotation.set(-Math.atan(slope), 0, 0);
        markTransform.scale.set(1, 1, 1);
        markTransform.updateMatrix();
        deckJoints.setMatrixAt(plate, markTransform.matrix);

        if (plate % 2 === 0) {
          for (const side of [-1, 1]) {
            markTransform.position.set(side * 7.15, routeHeight(worldOriginZ + jointZ) + 0.048, jointZ);
            markTransform.rotation.set(-Math.atan(slope), 0, 0);
            markTransform.updateMatrix();
            roadHatches.setMatrixAt(plate + (side === 1 ? 1 : 0), markTransform.matrix);
          }
        }
      }
      for (let mark = 0; mark < 8; mark++) {
        const dashZ = mark * 12 + 4;
        markTransform.position.set(roadCenterX, routeHeight(worldOriginZ + dashZ) + 0.036, dashZ);
        markTransform.rotation.set(
          -Math.atan((routeHeight(worldOriginZ + dashZ + 0.1) - routeHeight(worldOriginZ + dashZ - 0.1)) / 0.2),
          0,
          0
        );
        markTransform.updateMatrix();
        roadMarks.setMatrixAt(mark, markTransform.matrix);
        markTransform.position.set(roadCenterX, routeHeight(worldOriginZ + dashZ) + 0.09, mark * 12 + 10);
        markTransform.rotation.set(
          -Math.atan((routeHeight(worldOriginZ + mark * 12 + 10.1) - routeHeight(worldOriginZ + mark * 12 + 9.9)) / 0.2),
          0,
          0
        );
        markTransform.updateMatrix();
      }
      roadMarks.instanceMatrix.needsUpdate = true;
      deckJoints.instanceMatrix.needsUpdate = true;
      roadHatches.instanceMatrix.needsUpdate = true;
      group.add(roadMarks);
      group.add(deckJoints, roadHatches);
      const padArrows = new THREE.InstancedMesh(this.padArrowGeometry, this.edgeMaterial, 12);
      let arrowIndex = 0;
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
          const angle = padMesh.rotation.y;
          markTransform.position.set(
            roadCenterX + stripe * 0.72 * Math.cos(angle),
            routeHeight(padZ) + 0.17,
            padZ - worldOriginZ - stripe * 0.72 * Math.sin(angle)
          );
          markTransform.rotation.set(0, angle, 0);
          markTransform.updateMatrix();
          padArrows.setMatrixAt(arrowIndex++, markTransform.matrix);
        }
      }
      padArrows.instanceMatrix.needsUpdate = true;
      group.add(padArrows);
    }

    this.addFeatures(group, cx, cz, group.userData.solidFeatures);
    this.scene.add(group);
    return group;
  }

  addIndustrialCorridor(group, worldOriginX, worldOriginZ) {
    const pipeCount = 18;
    const pipes = new THREE.InstancedMesh(this.pipeGeometry, this.steelMaterial, pipeCount);
    const columns = new THREE.InstancedMesh(this.pipeSupportGeometry, this.steelMaterial, 12);
    const crossbeams = new THREE.InstancedMesh(this.pipeSupportGeometry, this.steelMaterial, 6);
    const longitudinalRails = new THREE.InstancedMesh(this.gantryGeometry, this.steelMaterial, 8);
    const transform = new THREE.Object3D();
    let pipeIndex = 0;
    let columnIndex = 0;
    let crossbeamIndex = 0;
    let railIndex = 0;

    for (const side of [-1, 1]) {
      const rackXs = [side * 13.8, side * 16.2, side * 18.6];
      for (const x of rackXs) {
        for (const level of [6.6, 8.9, 11.2]) {
          const worldX = worldOriginX + x;
          const baseY = terrainHeight(worldX, worldOriginZ + CHUNK_SIZE / 2);
          transform.position.set(x, baseY + level, CHUNK_SIZE / 2);
          transform.rotation.set(Math.PI / 2, 0, 0);
          transform.scale.set(1, CHUNK_SIZE - 3, 1);
          transform.updateMatrix();
          pipes.setMatrixAt(pipeIndex++, transform.matrix);
        }
      }

      for (const frameZ of [8, 48, 88]) {
        const worldZ = worldOriginZ + frameZ;
        const outerX = side * 19.8;
        const innerX = side * 13.0;
        for (const x of [innerX, outerX]) {
          const baseY = terrainHeight(worldOriginX + x, worldZ);
          transform.position.set(x, baseY + 5.9, frameZ);
          transform.scale.set(0.62, 11.8, 0.72);
          transform.rotation.set(0, 0, 0);
          transform.updateMatrix();
          columns.setMatrixAt(columnIndex++, transform.matrix);
        }
        const beamY = terrainHeight(worldOriginX + side * 16.4, worldZ) + 11.8;
        transform.position.set(side * 16.4, beamY, frameZ);
        transform.scale.set(7.3, 0.72, 0.78);
        transform.updateMatrix();
        crossbeams.setMatrixAt(crossbeamIndex++, transform.matrix);
      }

      for (const x of [side * 13.0, side * 19.8]) {
        for (const level of [1.4, 10.9]) {
          const baseY = terrainHeight(worldOriginX + x, worldOriginZ + CHUNK_SIZE / 2);
          transform.position.set(x, baseY + level, CHUNK_SIZE / 2);
          transform.scale.set(0.42, 0.42, CHUNK_SIZE - 3);
          transform.rotation.set(0, 0, 0);
          transform.updateMatrix();
          longitudinalRails.setMatrixAt(railIndex++, transform.matrix);
        }
      }
    }

    for (const mesh of [pipes, columns, crossbeams, longitudinalRails]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
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
    const utilityBlockMatrices = [[], [], []];
    const framePostMatrices = [];
    const braceMatrices = [];
    const transform = new THREE.Object3D();
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
        for (const stripeHeight of [-1.3, 1.3]) {
          const stripe = new THREE.Mesh(this.hazardStripeGeometry, this.hazardMaterial);
          stripe.position.set(0, stripeHeight, 1.22);
          pillar.add(stripe);
        }
        group.add(pillar);
        const rune = new THREE.Mesh(
          this.runeGeometry,
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
        const localX = worldX - cx * CHUNK_SIZE;
        const localZ = worldZ - cz * CHUNK_SIZE;
        const yaw = random() * Math.PI;
        const lean = (random() - 0.5) * 0.08;
        const braceWidth = 1.6 + random() * 0.5;
        transform.position.set(localX, groundY + 2.1, localZ);
        transform.rotation.set(0, yaw, lean);
        transform.scale.set(0.64, 4.2, 0.64);
        transform.updateMatrix();
        framePostMatrices.push(transform.matrix.clone());
        for (const height of [1.7, 3.5]) {
          transform.position.set(localX, groundY + height, localZ);
          transform.rotation.set(0, yaw, 0);
          transform.scale.set(braceWidth, 1, 1);
          transform.updateMatrix();
          braceMatrices.push(transform.matrix.clone());
        }
      } else {
        const scale = 1.5 + random() * 4.5;
        solidFeatures.push({ x: worldX, z: worldZ, radius: scale * 0.9 });
        transform.position.set(worldX - cx * CHUNK_SIZE, groundY + scale * 0.38, worldZ - cz * CHUNK_SIZE);
        transform.scale.set(scale, scale * (0.6 + random() * 0.8), scale * (0.7 + random() * 0.6));
        transform.rotation.set(0, Math.round(random() * 3) * Math.PI / 2, 0);
        transform.updateMatrix();
        utilityBlockMatrices[i % this.featureMaterials.length].push(transform.matrix.clone());
      }
    }

    if (framePostMatrices.length) {
      const framePosts = new THREE.InstancedMesh(this.utilityBlockGeometry, this.steelMaterial, framePostMatrices.length);
      framePostMatrices.forEach((matrix, index) => framePosts.setMatrixAt(index, matrix));
      framePosts.instanceMatrix.needsUpdate = true;
      framePosts.castShadow = true;
      group.add(framePosts);
      const braces = new THREE.InstancedMesh(this.braceGeometry, this.steelMaterial, braceMatrices.length);
      braceMatrices.forEach((matrix, index) => braces.setMatrixAt(index, matrix));
      braces.instanceMatrix.needsUpdate = true;
      group.add(braces);
    }
    for (let materialIndex = 0; materialIndex < utilityBlockMatrices.length; materialIndex++) {
      if (!utilityBlockMatrices[materialIndex].length) continue;
      const utilityBlocks = new THREE.InstancedMesh(
        this.utilityBlockGeometry,
        this.featureMaterials[materialIndex],
        utilityBlockMatrices[materialIndex].length
      );
      utilityBlockMatrices[materialIndex].forEach((matrix, index) => utilityBlocks.setMatrixAt(index, matrix));
      utilityBlocks.instanceMatrix.needsUpdate = true;
      utilityBlocks.castShadow = true;
      utilityBlocks.receiveShadow = true;
      group.add(utilityBlocks);
    }

  }
}
