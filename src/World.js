import * as THREE from 'three';

export class World {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x080e18);
    this.scene.fog = new THREE.Fog(0x111820, 150, 650);
    this.obstacles = [];
    this.addLighting();
    this.addHorizon();
    this.addPortal();
  }

  setCampaignMood(level) {
    const mood = level >= 15
      ? { background: 0x100b18, fog: 0x17101e, far: 410 }
      : level >= 11
        ? { background: 0x111018, fog: 0x21171c, far: 480 }
        : level >= 6
          ? { background: 0x10151b, fog: 0x1d2224, far: 540 }
          : { background: 0x080e18, fog: 0x111820, far: 650 };
    this.scene.background.setHex(mood.background);
    this.scene.fog.color.setHex(mood.fog);
    this.scene.fog.far = mood.far;
  }

  addLighting() {
    this.scene.add(new THREE.HemisphereLight(0x9aaab6, 0x252c30, 1.35));

    const sun = new THREE.DirectionalLight(0xd2d5d2, 2.1);
    sun.position.set(-48, 92, -58);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -90;
    sun.shadow.camera.right = 90;
    sun.shadow.camera.top = 90;
    sun.shadow.camera.bottom = -90;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0x9fb5c2, 1.05);
    fill.position.set(66, 30, 54);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xd18c59, 0.42);
    rim.position.set(20, 20, 130);
    this.scene.add(rim);
  }

  addHorizon() {
    const structureMaterial = new THREE.MeshStandardMaterial({
      color: 0x30383d,
      roughness: 0.9,
      metalness: 0.38,
      flatShading: true
    });
    const darkMaterial = new THREE.MeshStandardMaterial({
      color: 0x141a1e,
      roughness: 0.82,
      metalness: 0.42,
      flatShading: true
    });
    const beaconMaterial = new THREE.MeshStandardMaterial({
      color: 0x93a7a4,
      emissive: 0x33534e,
      emissiveIntensity: 0.52,
      roughness: 0.5,
      metalness: 0.42
    });
    const towerGeometry = new THREE.BoxGeometry(1, 1, 1);
    const stackGeometry = new THREE.CylinderGeometry(0.5, 0.68, 1, 7);
    const braceGeometry = new THREE.BoxGeometry(1, 1, 1);
    const towerCount = 104;
    const stackCount = 38;
    const braceCount = 54;
    const beaconCount = 28;
    const towers = new THREE.InstancedMesh(towerGeometry, structureMaterial, towerCount);
    const stacks = new THREE.InstancedMesh(stackGeometry, darkMaterial, stackCount);
    const braces = new THREE.InstancedMesh(braceGeometry, darkMaterial, braceCount);
    const beacons = new THREE.InstancedMesh(braceGeometry, beaconMaterial, beaconCount);
    const transform = new THREE.Object3D();
    const random = this.random(73031);

    for (let i = 0; i < towerCount; i++) {
      const angle = random() * Math.PI * 2;
      const distance = 205 + random() * 250;
      const height = 34 + Math.pow(random(), 1.35) * 158;
      const width = 10 + random() * 29;
      transform.position.set(Math.cos(angle) * distance, height / 2 - 5, Math.sin(angle) * distance);
      transform.scale.set(width, height, 10 + random() * 28);
      transform.rotation.set(0, Math.round(random() * 3) * Math.PI / 2, 0);
      transform.updateMatrix();
      towers.setMatrixAt(i, transform.matrix);
    }

    for (let i = 0; i < stackCount; i++) {
      const angle = random() * Math.PI * 2;
      const distance = 225 + random() * 215;
      const height = 36 + random() * 92;
      transform.position.set(Math.cos(angle) * distance, height / 2 - 3, Math.sin(angle) * distance);
      transform.scale.set(5 + random() * 9, height, 5 + random() * 9);
      transform.rotation.set(0, random() * Math.PI, 0);
      transform.updateMatrix();
      stacks.setMatrixAt(i, transform.matrix);
    }

    for (let i = 0; i < braceCount; i++) {
      const angle = (i / braceCount) * Math.PI * 2;
      const distance = 190 + random() * 190;
      const height = 24 + random() * 70;
      transform.position.set(Math.cos(angle) * distance, height, Math.sin(angle) * distance);
      transform.scale.set(18 + random() * 35, 1.2 + random() * 2, 1.5 + random() * 3);
      transform.rotation.set(0, -angle, (random() - 0.5) * 0.18);
      transform.updateMatrix();
      braces.setMatrixAt(i, transform.matrix);
    }

    for (let i = 0; i < beaconCount; i++) {
      const angle = (i / beaconCount) * Math.PI * 2 + 0.04;
      const distance = 220 + random() * 190;
      const height = 3 + random() * 4;
      transform.position.set(Math.cos(angle) * distance, height + 2, Math.sin(angle) * distance);
      transform.scale.set(0.7, height, 0.7);
      transform.rotation.set(0, -angle, 0);
      transform.updateMatrix();
      beacons.setMatrixAt(i, transform.matrix);
    }

    const skyline = new THREE.Group();
    for (const mesh of [towers, stacks, braces, beacons]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      skyline.add(mesh);
    }
    this.scene.add(skyline);
    this.addRefinerySilhouettes();
  }

  addRefinerySilhouettes() {
    const steel = new THREE.MeshStandardMaterial({
      color: 0x566266,
      roughness: 0.76,
      metalness: 0.5,
      flatShading: true
    });
    const darkSteel = new THREE.MeshStandardMaterial({
      color: 0x303a3e,
      roughness: 0.8,
      metalness: 0.46
    });
    const tankMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a5150,
      roughness: 0.82,
      metalness: 0.36
    });
    const workLight = new THREE.MeshStandardMaterial({
      color: 0xa28a61,
      emissive: 0x6d4a20,
      emissiveIntensity: 0.72,
      roughness: 0.42,
      metalness: 0.3
    });
    const postGeometry = new THREE.BoxGeometry(1, 1, 1);
    const pipeGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
    const tankGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
    const stackGeometry = new THREE.CylinderGeometry(0.5, 0.62, 1, 9);
    const posts = new THREE.InstancedMesh(postGeometry, steel, 32);
    const beams = new THREE.InstancedMesh(postGeometry, steel, 32);
    const pipes = new THREE.InstancedMesh(pipeGeometry, darkSteel, 48);
    const tanks = new THREE.InstancedMesh(tankGeometry, tankMaterial, 8);
    const stacks = new THREE.InstancedMesh(stackGeometry, darkSteel, 16);
    const lights = new THREE.InstancedMesh(postGeometry, workLight, 16);
    const transform = new THREE.Object3D();
    let postIndex = 0;
    let beamIndex = 0;
    let pipeIndex = 0;
    let tankIndex = 0;
    let stackIndex = 0;
    let lightIndex = 0;

    // Keep the foreground outside the playable corridor while framing both the
    // initial view toward the portal and the opposite approach.
    for (const direction of [-1, 1]) {
      for (const bay of [0, 1, 2, 3]) {
        const z = direction * (22 + bay * 31);
        for (const side of [-1, 1]) {
          const centerX = side * (21.5 + (bay % 2) * 8);
          const height = 22 + (bay % 3) * 4;
          for (const offsetX of [-8, 8]) {
            transform.position.set(centerX + offsetX, height / 2, z);
            transform.scale.set(1.1, height, 1.2);
            transform.rotation.set(0, 0, 0);
            transform.updateMatrix();
            posts.setMatrixAt(postIndex++, transform.matrix);
          }
          transform.position.set(centerX, height, z);
          transform.scale.set(17.5, 1.2, 1.3);
          transform.updateMatrix();
          beams.setMatrixAt(beamIndex++, transform.matrix);
          transform.position.set(centerX, 4.2, z);
          transform.scale.set(17.5, 0.72, 0.86);
          transform.updateMatrix();
          beams.setMatrixAt(beamIndex++, transform.matrix);

          transform.position.set(centerX, height + 0.72, z);
          transform.scale.set(0.68, 0.55, 0.68);
          transform.updateMatrix();
          lights.setMatrixAt(lightIndex++, transform.matrix);

          if (bay % 2 === 0) {
            const tankX = centerX + side * 13;
            const tankHeight = 16 + (bay % 3) * 2;
            transform.position.set(tankX, tankHeight / 2, z + direction * 8);
            transform.scale.set(13, tankHeight, 13);
            transform.updateMatrix();
            tanks.setMatrixAt(tankIndex++, transform.matrix);

            transform.position.set(tankX - side * 8, (27 + bay * 2) / 2, z + direction * 11);
            transform.scale.set(4.6, 27 + bay * 2, 4.6);
            transform.updateMatrix();
            stacks.setMatrixAt(stackIndex++, transform.matrix);
            transform.position.y = 27 + bay * 2;
            transform.scale.set(5.4, 0.9, 5.4);
            transform.updateMatrix();
            stacks.setMatrixAt(stackIndex++, transform.matrix);
          }

          for (const level of [7.8, 11.2, 14.6]) {
            transform.position.set(centerX, level, z);
            transform.rotation.set(Math.PI / 2, 0, 0);
            transform.scale.set(0.88, 17.2, 0.88);
            transform.updateMatrix();
            pipes.setMatrixAt(pipeIndex++, transform.matrix);
          }
        }
      }
    }

    for (const mesh of [posts, beams, pipes, tanks, stacks, lights]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
  }

  addPortal() {
    const portal = new THREE.Group();
    portal.position.set(0, 27, 210);

    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x30383b,
      emissive: 0x120d09,
      emissiveIntensity: 0.2,
      roughness: 0.58,
      metalness: 0.78
    });
    const hotMetal = new THREE.MeshStandardMaterial({
      color: 0x98815c,
      emissive: 0x45351c,
      emissiveIntensity: 0.42,
      roughness: 0.42,
      metalness: 0.68
    });
    const energyMaterial = new THREE.MeshBasicMaterial({
      color: 0x8ba6a8,
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(20, 2.2, 12, 72), frameMaterial);
    portal.add(outerRing);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(17, 0.72, 12, 72), hotMetal);
    portal.add(ring);
    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(14.9, 0.18, 8, 64), hotMetal);
    portal.add(innerRing);

    const core = new THREE.Mesh(new THREE.CircleGeometry(14.8, 48), energyMaterial);
    core.scale.set(1, 1, 0.12);
    portal.add(core);

    const braceGeometry = new THREE.BoxGeometry(1, 1, 1);
    const braceTransforms = new THREE.Object3D();
    const braces = new THREE.InstancedMesh(braceGeometry, frameMaterial, 8);
    for (let i = 0; i < 8; i++) {
      const angle = i / 8 * Math.PI * 2;
      braceTransforms.position.set(Math.cos(angle) * 18.1, Math.sin(angle) * 18.1, 0);
      braceTransforms.rotation.z = angle;
      braceTransforms.scale.set(3.2, 0.62, 1.25);
      braceTransforms.updateMatrix();
      braces.setMatrixAt(i, braceTransforms.matrix);
    }
    braces.instanceMatrix.needsUpdate = true;
    portal.add(braces);

    const light = new THREE.PointLight(0x8ba6a8, 28, 220, 2);
    light.position.set(0, 0, 0);
    portal.add(light);
    const warningLight = new THREE.PointLight(0xc8844c, 22, 110, 2);
    warningLight.position.set(0, 21, -5);
    portal.add(warningLight);
    this.scene.add(portal);
    this.portal = portal;
  }

  random(seed) {
    let value = seed >>> 0;
    return () => {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }
}
