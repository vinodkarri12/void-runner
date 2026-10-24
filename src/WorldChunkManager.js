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
  const hills = smoothNoise(x, z, 75) * 4.5 + smoothNoise(x, z, 28) * 1.6;
  const roadBlend = THREE.MathUtils.smoothstep(Math.abs(x), 8.8, 16.5);
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

    // Japanese Shinobi World Materials
    this.terrainMaterial = new THREE.MeshStandardMaterial({
      color: 0x141c19, // Dark mossy forest earth / fallen pine needles
      roughness: 0.94,
      metalness: 0.08,
      vertexColors: true
    });
    this.roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x1b2330, // Wet moonlit Japanese stone flagstones with specular reflections
      roughness: 0.28,
      metalness: 0.42,
      emissive: 0x060e18,
      emissiveIntensity: 0.35
    });
    this.edgeMaterial = new THREE.MeshStandardMaterial({
      color: 0x9e1c24, // Lacquered vermilion / dark crimson wood railing
      emissive: 0x2b060a,
      emissiveIntensity: 0.38,
      roughness: 0.58,
      metalness: 0.32
    });
    this.toriiMaterial = new THREE.MeshStandardMaterial({
      color: 0xb32020, // Sacred Torii red lacquer
      emissive: 0x3d0808,
      emissiveIntensity: 0.36,
      roughness: 0.54,
      metalness: 0.26
    });
    this.charcoalWoodMaterial = new THREE.MeshStandardMaterial({
      color: 0x131518, // Dark burnt cedar (Yakisugi)
      roughness: 0.88,
      metalness: 0.18
    });
    this.sakuraWoodMaterial = new THREE.MeshStandardMaterial({
      color: 0x1c1719, // Gnarly ancient cherry blossom trunk wood
      roughness: 0.9,
      metalness: 0.12
    });
    this.sakuraBlossomMaterial = new THREE.MeshStandardMaterial({
      color: 0xff9ec0, // Lush blooming pink sakura cherry blossoms
      emissive: 0x481122,
      emissiveIntensity: 0.45,
      roughness: 0.65,
      metalness: 0.06
    });
    this.sakuraBlossomLightMaterial = new THREE.MeshStandardMaterial({
      color: 0xffc4d8, // Radiant pastel cherry blossom canopy accents
      emissive: 0x5a182a,
      emissiveIntensity: 0.4,
      roughness: 0.6,
      metalness: 0.05
    });
    this.stoneBalustradeMaterial = new THREE.MeshStandardMaterial({
      color: 0x303640, // Carved Japanese shrine stone balustrades
      roughness: 0.78,
      metalness: 0.22
    });
    this.bannerSilkMaterial = new THREE.MeshStandardMaterial({
      color: 0xb51c24, // Sacred crimson "忍" clan silk banner
      emissive: 0x3e080f,
      emissiveIntensity: 0.5,
      roughness: 0.62,
      metalness: 0.15,
      side: THREE.DoubleSide
    });
    this.lanternStoneMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a4047, // Carved Japanese stone lantern (Tōrō)
      roughness: 0.82,
      metalness: 0.15
    });
    this.lanternLightMaterial = new THREE.MeshStandardMaterial({
      color: 0xffa43b, // Warm flickering firelight / candle flame
      emissive: 0xff8820,
      emissiveIntensity: 2.1,
      roughness: 0.35,
      metalness: 0.1
    });
    this.bambooMaterial = new THREE.MeshStandardMaterial({
      color: 0x344b32, // Bamboo green & stalk wood
      roughness: 0.65,
      metalness: 0.14
    });
    this.wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x272c33, // Interlocking Japanese castle stone (Ishigaki)
      roughness: 0.85,
      metalness: 0.24,
      side: THREE.DoubleSide
    });
    this.shojiPaperMaterial = new THREE.MeshStandardMaterial({
      color: 0xdde2dc,
      emissive: 0x2a2820,
      emissiveIntensity: 0.25,
      roughness: 0.72,
      metalness: 0.05
    });

    this.featureMaterials = [
      new THREE.MeshStandardMaterial({ color: 0x25201c, roughness: 0.88, metalness: 0.14 }), // Cedar crate
      new THREE.MeshStandardMaterial({ color: 0x353a40, roughness: 0.82, metalness: 0.22 }), // Temple stone
      new THREE.MeshStandardMaterial({ color: 0x851c22, roughness: 0.68, metalness: 0.3 })   // Lacquered shrine accent
    ];

    // Shared geometries
    this.utilityBlockGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.pillarGeometry = new THREE.BoxGeometry(2.4, 4.8, 2.4);
    this.hazardStripeGeometry = new THREE.BoxGeometry(1.8, 0.16, 0.14);
    this.braceGeometry = new THREE.BoxGeometry(1, 0.22, 0.28);
    this.roadMarkGeometry = new THREE.BoxGeometry(0.18, 0.025, 4.2);
    this.wallMarkerGeometry = new THREE.BoxGeometry(0.18, 0.85, 0.18);
    this.padArrowGeometry = new THREE.BoxGeometry(0.14, 0.035, 1.1);
    this.runeGeometry = new THREE.BoxGeometry(0.12, 1.9, 0.1);
    this.deckJointGeometry = new THREE.BoxGeometry(16.7, 0.06, 0.18);
    this.gantryGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.pipeGeometry = new THREE.CylinderGeometry(0.24, 0.24, 1, 8); // Used for bamboo stalks
    this.pipeSupportGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.roadHatchGeometry = new THREE.BoxGeometry(0.3, 0.055, 1.45);
    this.wallRailGeometry = new THREE.BoxGeometry(0.32, 0.3, CHUNK_SIZE);

    // Shadow Dash / Velocity Pad
    this.velocityPadGeometry = new THREE.BoxGeometry(4.2, 0.08, 3.2);
    this.velocityPadMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e1520,
      emissive: 0x7a2245,
      emissiveIntensity: 0.85,
      metalness: 0.6,
      roughness: 0.4
    });
  }

  setCampaignPhase(level) {
    const palette = level >= 11
      ? { terrain: 0x180f12, road: 0x1a1215, wall: 0x221318, light: 0xff3b52 }
      : level >= 6
        ? { terrain: 0x161c1b, road: 0x202428, wall: 0x282e34, light: 0xffa43b }
        : { terrain: 0x142119, road: 0x22282e, wall: 0x2d343c, light: 0xffaa44 };

    this.terrainMaterial.color.setHex(palette.terrain);
    this.roadMaterial.color.setHex(palette.road);
    this.wallMaterial.color.setHex(palette.wall);
    this.lanternLightMaterial.color.setHex(palette.light);
    this.lanternLightMaterial.emissive.setHex(palette.light);
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
    if (impactSpeed < 10) return null;
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
    group.name = `shinobi-chunk-${cx}-${cz}`;
    group.userData.solidFeatures = [];
    const worldOriginX = cx * CHUNK_SIZE;
    const worldOriginZ = cz * CHUNK_SIZE;
    const originX = worldOriginX - this.worldOffset.x;
    const originZ = worldOriginZ - this.worldOffset.y;
    group.position.set(originX, 0, originZ);

    // Terrain mesh
    const positions = [];
    const colors = [];
    const indices = [];
    const color = new THREE.Color();

    for (let iz = 0; iz <= GRID_SEGMENTS; iz++) {
      for (let ix = 0; ix <= GRID_SEGMENTS; ix++) {
        const x = worldOriginX + (ix / GRID_SEGMENTS) * CHUNK_SIZE;
        const z = worldOriginZ + (iz / GRID_SEGMENTS) * CHUNK_SIZE;
        const y = terrainHeight(x, z) - 0.3;
        positions.push((ix / GRID_SEGMENTS) * CHUNK_SIZE, y, (iz / GRID_SEGMENTS) * CHUNK_SIZE);
        const variation = smoothNoise(x, z, 14) * 0.05;
        // Deep mossy dark earth tones
        color.setRGB(0.12 + variation, 0.16 + variation, 0.14 + variation);
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
      // Ancient stone pathway surface
      const roadGeometry = this.createRouteSurface(worldOriginZ, roadCenterX, 17);
      const road = new THREE.Mesh(roadGeometry, this.roadMaterial);
      road.receiveShadow = true;
      group.add(road);

      // Vermilion wooden border curbs
      for (const xOffset of [-8.15, 8.15]) {
        const edge = new THREE.Mesh(
          this.createRouteSurface(worldOriginZ, roadCenterX + xOffset, 0.15, 0.04),
          this.edgeMaterial
        );
        group.add(edge);
      }

      // Traditional Japanese Castle Walls (Ishigaki) & Wooden Boundary Railings
      for (const side of [-1, 1]) {
        const wallWorldX = side * 10.4;
        const wallX = wallWorldX - worldOriginX;
        group.userData.solidFeatures.push({
          type: 'wall',
          x: wallWorldX,
          z: worldOriginZ + CHUNK_SIZE / 2,
          halfLength: CHUNK_SIZE / 2,
          halfThickness: 0.25
        });

        // Castle stone wall
        const wall = new THREE.Mesh(this.createRouteWall(worldOriginZ, wallX, 4.4, wallWorldX), this.wallMaterial);
        wall.receiveShadow = true;
        wall.castShadow = true;
        group.add(wall);

        // Dark timber coping rail on top
        const rail = new THREE.Mesh(this.wallRailGeometry, this.charcoalWoodMaterial);
        rail.position.set(wallX - side * 0.32, 4.15, CHUNK_SIZE / 2);
        group.add(rail);
      }

      // === JAPANESE TORII GATES ACROSS PATH ===
      // Place beautiful red Torii gates at regular intervals in each chunk
      const toriiPositions = [28, 76];
      for (const tZ of toriiPositions) {
        this.addToriiGate(group, roadCenterX, tZ, worldOriginZ);
      }

      // === JAPANESE STONE LANTERNS (TŌRŌ) LINING THE PATH ===
      const lanternPositions = [12, 38, 62, 88];
      for (const lZ of lanternPositions) {
        for (const side of [-1, 1]) {
          const lX = roadCenterX + side * 8.6;
          this.addStoneLantern(group, lX, lZ, worldOriginZ);
        }
      }

      // === BLOOMING SAKURA (CHERRY BLOSSOM) TREES FLANKING THE COURTYARD ===
      // Lush blooming pink cherry blossom trees hanging gracefully over the stone path
      const sakuraPositions = [16, 42, 66, 90];
      for (let i = 0; i < sakuraPositions.length; i++) {
        const sZ = sakuraPositions[i];
        const side = i % 2 === 0 ? -1 : 1;
        this.addSakuraTree(group, roadCenterX + side * 10.8, sZ, worldOriginZ, side);
      }

      // === CRIMSON "忍" CLAN SILK BANNERS FLANKING PATH ===
      const bannerPositions = [24, 72];
      for (const bZ of bannerPositions) {
        this.addClanBanners(group, roadCenterX, bZ, worldOriginZ);
      }

      // === BAMBOO FORESTS FLANKING THE PATHWAY ===
      this.addBambooGrove(group, worldOriginX, worldOriginZ);

      // Shadow Dash Vector Pads (Ninja Momentum Seals)
      const padArrows = new THREE.InstancedMesh(this.padArrowGeometry, this.lanternLightMaterial, 12);
      const markTransform = new THREE.Object3D();
      let arrowIndex = 0;
      for (let padIndex = 0; padIndex < 4; padIndex++) {
        const padZ = worldOriginZ + 30 + padIndex * 24;
        const directionX = padIndex % 2 === 0 ? 0 : 0.26;
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
            routeHeight(padZ) + 0.18,
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

  addToriiGate(group, centerX, localZ, worldOriginZ) {
    const torii = new THREE.Group();
    const groundY = routeHeight(worldOriginZ + localZ);
    torii.position.set(centerX, groundY, localZ);

    const red = this.toriiMaterial;
    const dark = this.charcoalWoodMaterial;

    // Two main pillars spanning the corridor
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 11.5, 12), red);
      pillar.position.set(side * 8.6, 5.75, 0);
      pillar.castShadow = true;
      torii.add(pillar);

      // Stone base (Daiishi)
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 1.4, 10), this.lanternStoneMaterial);
      base.position.set(side * 8.6, 0.7, 0);
      torii.add(base);
    }

    // Top curved Kasagi beam
    const kasagi = new THREE.Mesh(new THREE.BoxGeometry(20.4, 0.72, 0.95), dark);
    kasagi.position.set(0, 11.5, 0);
    kasagi.castShadow = true;
    torii.add(kasagi);

    // Shimaki beam below
    const shimaki = new THREE.Mesh(new THREE.BoxGeometry(19.2, 0.65, 0.8), red);
    shimaki.position.set(0, 10.75, 0);
    torii.add(shimaki);

    // Nuki cross-beam
    const nuki = new THREE.Mesh(new THREE.BoxGeometry(17.8, 0.55, 0.6), red);
    nuki.position.set(0, 9.1, 0);
    torii.add(nuki);

    // Center tablet with clan emblem
    const tablet = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 0.2), dark);
    tablet.position.set(0, 9.9, 0.15);
    torii.add(tablet);

    group.add(torii);
  }

  addStoneLantern(group, localX, localZ, worldOriginZ) {
    const lantern = new THREE.Group();
    const groundY = routeHeight(worldOriginZ + localZ);
    lantern.position.set(localX, groundY, localZ);

    const stone = this.lanternStoneMaterial;
    const light = this.lanternLightMaterial;

    // Base pediment
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.9), stone);
    base.position.y = 0.18;
    lantern.add(base);

    // Pole / pillar
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 1.4, 8), stone);
    post.position.y = 1.05;
    lantern.add(post);

    // Firebox platform (Chūdai)
    const platform = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.22, 0.85), stone);
    platform.position.y = 1.86;
    lantern.add(platform);

    // Hibukuro (Hollow light chamber with glowing fire)
    const firebox = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.55, 0.48), light);
    firebox.position.y = 2.24;
    lantern.add(firebox);

    // Stone umbrella roof (Kasa) with curved corners
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.88, 0.48, 4), stone);
    roof.position.y = 2.75;
    roof.rotation.y = Math.PI / 4;
    lantern.add(roof);

    // Jewel finial (Hōju)
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), stone);
    finial.position.y = 3.1;
    lantern.add(finial);

    lantern.castShadow = true;
    group.add(lantern);
  }

  addBambooGrove(group, worldOriginX, worldOriginZ) {
    const bambooCount = 32;
    const bambooStalks = new THREE.InstancedMesh(this.pipeGeometry, this.bambooMaterial, bambooCount);
    const transform = new THREE.Object3D();
    const random = seededRandom(hash2(worldOriginX, worldOriginZ) * 0x61a8c2);

    let stalkIdx = 0;
    for (const side of [-1, 1]) {
      for (let i = 0; i < bambooCount / 2; i++) {
        const xOffset = side * (12.5 + random() * 8.5);
        const zOffset = random() * CHUNK_SIZE;
        const worldX = worldOriginX + xOffset;
        const worldZ = worldOriginZ + zOffset;
        const baseY = terrainHeight(worldX, worldZ);
        const height = 9 + random() * 7;
        const lean = (random() - 0.5) * 0.12;

        transform.position.set(xOffset, baseY + height / 2, zOffset);
        transform.scale.set(1, height, 1);
        transform.rotation.set(lean, random() * Math.PI, (random() - 0.5) * 0.08);
        transform.updateMatrix();
        bambooStalks.setMatrixAt(stalkIdx++, transform.matrix);
      }
    }

    bambooStalks.instanceMatrix.needsUpdate = true;
    bambooStalks.castShadow = true;
    group.add(bambooStalks);
  }

  addSakuraTree(group, localX, localZ, worldOriginZ, side = 1) {
    const tree = new THREE.Group();
    const groundY = routeHeight(worldOriginZ + localZ);
    tree.position.set(localX, groundY, localZ);

    const trunkMat = this.sakuraWoodMaterial;
    const blossomMat = this.sakuraBlossomMaterial;
    const lightBlossomMat = this.sakuraBlossomLightMaterial;

    // Gnarled, twisting ancient trunk leaning slightly over the courtyard
    const lean = side * -0.18;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.95, 7.5, 8), trunkMat);
    trunk.position.set(0, 3.6, 0);
    trunk.rotation.z = lean;
    trunk.castShadow = true;
    tree.add(trunk);

    // Thick primary branches reaching inward toward the path
    const branch1 = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, 5.2, 7), trunkMat);
    branch1.position.set(side * -1.2, 6.2, 0.6);
    branch1.rotation.set(0.2, 0.4, side * -0.65);
    branch1.castShadow = true;
    tree.add(branch1);

    const branch2 = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 4.4, 7), trunkMat);
    branch2.position.set(side * 0.8, 6.6, -0.8);
    branch2.rotation.set(-0.3, -0.5, side * 0.55);
    branch2.castShadow = true;
    tree.add(branch2);

    // Voluminous, puffy clouds of pink cherry blossoms (Sakura canopies)
    const canopyData = [
      { x: side * -2.4, y: 7.8, z: 0.8, r: 3.4, mat: blossomMat },
      { x: side * -1.0, y: 8.8, z: -0.4, r: 3.8, mat: lightBlossomMat },
      { x: side * 1.6, y: 8.2, z: -1.2, r: 3.2, mat: blossomMat },
      { x: 0, y: 9.6, z: 0, r: 4.2, mat: lightBlossomMat },
      { x: side * -1.8, y: 6.8, z: -1.4, r: 2.8, mat: blossomMat },
      { x: side * 1.2, y: 7.2, z: 1.2, r: 2.6, mat: blossomMat }
    ];

    for (const c of canopyData) {
      const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(c.r, 1), c.mat);
      puff.position.set(c.x, c.y, c.z);
      puff.scale.set(1.15, 0.82, 1.1);
      puff.castShadow = true;
      puff.receiveShadow = true;
      tree.add(puff);
    }

    group.add(tree);
  }

  addClanBanners(group, centerX, localZ, worldOriginZ) {
    const bannerGroup = new THREE.Group();
    const groundY = routeHeight(worldOriginZ + localZ);
    bannerGroup.position.set(centerX, groundY, localZ);

    for (const side of [-1, 1]) {
      const poleX = side * 8.8;
      // Tall dark timber banner pole
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 9.5, 8), this.charcoalWoodMaterial);
      pole.position.set(poleX, 4.75, 0);
      pole.castShadow = true;
      bannerGroup.add(pole);

      // Horizontal crossbar
      const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6), this.charcoalWoodMaterial);
      crossbar.position.set(poleX - side * 0.6, 9.1, 0);
      crossbar.rotation.z = Math.PI / 2;
      bannerGroup.add(crossbar);

      // Crimson silk banner hanging vertically
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 5.8), this.bannerSilkMaterial);
      banner.position.set(poleX - side * 0.6, 5.9, 0);
      banner.castShadow = true;
      bannerGroup.add(banner);

      // Gold/black "忍" emblem badge on the banner
      const emblem = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.06), this.featureMaterials[1]);
      emblem.position.set(poleX - side * 0.6, 6.6, 0.04);
      bannerGroup.add(emblem);
    }

    group.add(bannerGroup);
  }

  createRouteSurface(worldStartZ, centerX, width, thickness = 0.04) {
    const across = 4;
    const vertices = [];
    const indices = [];
    const halfWidth = width / 2;
    for (let iz = 0; iz <= GRID_SEGMENTS; iz++) {
      const localZ = (iz / GRID_SEGMENTS) * CHUNK_SIZE;
      const worldZ = worldStartZ + localZ;
      const y = routeHeight(worldZ) + thickness;
      for (let ix = 0; ix <= across; ix++) {
        const x = centerX - halfWidth + (ix / across) * width;
        vertices.push(x, y, localZ);
      }
    }
    for (let iz = 0; iz < GRID_SEGMENTS; iz++) {
      for (let ix = 0; ix < across; ix++) {
        const a = iz * (across + 1) + ix;
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
      const localZ = (iz / GRID_SEGMENTS) * CHUNK_SIZE;
      const baseY = terrainHeight(worldX, worldStartZ + localZ);
      vertices.push(centerX - 0.25, baseY, localZ);
      vertices.push(centerX + 0.25, baseY, localZ);
      vertices.push(centerX - 0.25, baseY + height, localZ);
      vertices.push(centerX + 0.25, baseY + height, localZ);
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
    const crateMatrices = [];
    const pagodaMatrices = [];
    const transform = new THREE.Object3D();

    for (let i = 0; i < 9; i++) {
      const worldX = cx * CHUNK_SIZE + random() * CHUNK_SIZE;
      const worldZ = cz * CHUNK_SIZE + random() * CHUNK_SIZE;
      if (Math.abs(worldX) < 14 || random() < 0.25) continue;
      const groundY = terrainHeight(worldX, worldZ);

      if (i % 3 === 0) {
        // Breakable Japanese Cedar Weapon Crate / Supply Chest
        const crate = new THREE.Mesh(this.utilityBlockGeometry, this.featureMaterials[0]);
        crate.scale.set(2.2, 2.2, 2.2);
        crate.position.set(worldX - cx * CHUNK_SIZE, groundY + 1.1, worldZ - cz * CHUNK_SIZE);
        crate.rotation.y = random() * Math.PI;
        crate.castShadow = true;
        group.add(crate);

        // Gold clan seal
        const seal = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), this.featureMaterials[2]);
        seal.position.set(crate.position.x, groundY + 1.1, crate.position.z + 1.12);
        group.add(seal);

        solidFeatures.push({
          type: 'breakable',
          x: worldX,
          z: worldZ,
          radius: 1.8,
          object: crate,
          accent: seal
        });
      } else if (i % 3 === 1) {
        // Temple Pagoda Shrine alongside the ridge
        const scale = 2.4 + random() * 2.8;
        solidFeatures.push({ x: worldX, z: worldZ, radius: scale * 0.95 });
        const localX = worldX - cx * CHUNK_SIZE;
        const localZ = worldZ - cz * CHUNK_SIZE;

        transform.position.set(localX, groundY + scale * 0.8, localZ);
        transform.scale.set(scale * 1.3, scale * 1.6, scale * 1.3);
        transform.rotation.set(0, Math.round(random() * 3) * (Math.PI / 2), 0);
        transform.updateMatrix();
        pagodaMatrices.push(transform.matrix.clone());
      } else {
        // Stone lanterns / garden boulders
        const scale = 1.6 + random() * 2.5;
        solidFeatures.push({ x: worldX, z: worldZ, radius: scale * 0.85 });
        transform.position.set(worldX - cx * CHUNK_SIZE, groundY + scale * 0.45, worldZ - cz * CHUNK_SIZE);
        transform.scale.set(scale, scale * 0.9, scale);
        transform.rotation.set(0, random() * Math.PI, 0);
        transform.updateMatrix();
        crateMatrices.push(transform.matrix.clone());
      }
    }

    if (pagodaMatrices.length) {
      const pagodas = new THREE.InstancedMesh(this.utilityBlockGeometry, this.featureMaterials[1], pagodaMatrices.length);
      pagodaMatrices.forEach((mat, idx) => pagodas.setMatrixAt(idx, mat));
      pagodas.instanceMatrix.needsUpdate = true;
      pagodas.castShadow = true;
      pagodas.receiveShadow = true;
      group.add(pagodas);
    }
    if (crateMatrices.length) {
      const stones = new THREE.InstancedMesh(this.utilityBlockGeometry, this.featureMaterials[0], crateMatrices.length);
      crateMatrices.forEach((mat, idx) => stones.setMatrixAt(idx, mat));
      stones.instanceMatrix.needsUpdate = true;
      stones.castShadow = true;
      stones.receiveShadow = true;
      group.add(stones);
    }
  }
}
