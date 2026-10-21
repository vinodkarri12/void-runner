import * as THREE from 'three';

export class World {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070b14);
    this.scene.fog = new THREE.Fog(0x0c111c, 110, 560);
    this.obstacles = [];
    this.addLighting();
    this.addMoon();
    this.addMountainHorizon();
    this.addGrandToriiGate();
  }

  setCampaignMood(level) {
    // 3 Distinct Ninja Environments:
    // Levels 1-5: Moonlit Bamboo Grove Sanctuary (Deep Indigo Night)
    // Levels 6-10: Shadow Pagoda & Castle Courtyards (Charcoal Mist & Slate)
    // Levels 11-15: Crimson Demon Fortress (Blood Moon & Ashen Fog)
    const mood = level >= 11
      ? { background: 0x14070c, fog: 0x1d0a12, far: 440, moonColor: 0xff3b52, lightColor: 0xdb8290 }
      : level >= 6
        ? { background: 0x0a0d14, fog: 0x121620, far: 500, moonColor: 0xd6e4f0, lightColor: 0x9fb5cc }
        : { background: 0x070b14, fog: 0x0c111c, far: 560, moonColor: 0xe8f0f8, lightColor: 0xa8c2dd };

    this.scene.background.setHex(mood.background);
    this.scene.fog.color.setHex(mood.fog);
    this.scene.fog.far = mood.far;

    if (this.moonMesh) {
      this.moonMesh.material.color.setHex(mood.moonColor);
    }
    if (this.moonCorona) {
      this.moonCorona.material.color.setHex(mood.moonColor);
    }
    if (this.moonLight) {
      this.moonLight.color.setHex(mood.lightColor);
    }
  }

  addLighting() {
    // Deep atmospheric ambient light
    this.ambientLight = new THREE.HemisphereLight(0x7896b0, 0x12161c, 1.25);
    this.scene.add(this.ambientLight);

    // Dramatic moonlight casting crisp shadow silhouettes
    this.moonLight = new THREE.DirectionalLight(0xa8c2dd, 2.2);
    this.moonLight.position.set(-52, 98, -62);
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.set(1024, 1024);
    this.moonLight.shadow.camera.left = -95;
    this.moonLight.shadow.camera.right = 95;
    this.moonLight.shadow.camera.top = 95;
    this.moonLight.shadow.camera.bottom = -95;
    this.moonLight.shadow.bias = -0.0005;
    this.scene.add(this.moonLight);

    // Warm lantern fill light (simulating Japanese lanterns along the path)
    const lanternFill = new THREE.DirectionalLight(0xff9438, 0.45);
    lanternFill.position.set(40, 25, 45);
    this.scene.add(lanternFill);

    // Cool rim light for ninja silhouette separation
    const rimLight = new THREE.DirectionalLight(0x4a7a9e, 0.55);
    rimLight.position.set(15, 18, 120);
    this.scene.add(rimLight);
  }

  addMoon() {
    // Large luminous Japanese moon in the night sky
    const moonGroup = new THREE.Group();
    moonGroup.position.set(-180, 240, -420);

    const moonGeo = new THREE.CircleGeometry(42, 48);
    const moonMat = new THREE.MeshBasicMaterial({
      color: 0xe8f0f8,
      transparent: true,
      opacity: 0.95,
      depthWrite: false
    });
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonGroup.add(this.moonMesh);

    // Soft luminous lunar halo / corona
    const coronaGeo = new THREE.RingGeometry(40, 72, 48);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0x9fb8d4,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.moonCorona = new THREE.Mesh(coronaGeo, coronaMat);
    moonGroup.add(this.moonCorona);

    this.scene.add(moonGroup);
  }

  addMountainHorizon() {
    // Ancient Japanese mountain ridges & traditional pagoda silhouettes
    const mountainMat = new THREE.MeshStandardMaterial({
      color: 0x111620,
      roughness: 0.95,
      metalness: 0.2,
      flatShading: true
    });
    const darkRidgeMat = new THREE.MeshStandardMaterial({
      color: 0x0a0d14,
      roughness: 0.9,
      metalness: 0.15,
      flatShading: true
    });
    const pagodaMat = new THREE.MeshStandardMaterial({
      color: 0x08090d,
      roughness: 0.85,
      metalness: 0.25
    });

    const coneGeo = new THREE.ConeGeometry(1, 1, 6);
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const mountainCount = 68;
    const pagodaCount = 24;

    const mountains = new THREE.InstancedMesh(coneGeo, mountainMat, mountainCount);
    const darkRidges = new THREE.InstancedMesh(coneGeo, darkRidgeMat, mountainCount);
    const pagodas = new THREE.InstancedMesh(boxGeo, pagodaMat, pagodaCount * 4);

    const transform = new THREE.Object3D();
    const random = this.random(84921);

    // Far mountain peaks
    for (let i = 0; i < mountainCount; i++) {
      const angle = (i / mountainCount) * Math.PI * 2 + (random() - 0.5) * 0.12;
      const distance = 240 + random() * 220;
      const height = 75 + Math.pow(random(), 1.2) * 160;
      const radius = 45 + random() * 65;

      transform.position.set(Math.cos(angle) * distance, height / 2 - 12, Math.sin(angle) * distance);
      transform.scale.set(radius, height, radius);
      transform.rotation.set(0, random() * Math.PI, 0);
      transform.updateMatrix();
      mountains.setMatrixAt(i, transform.matrix);

      // Closer darker mountain layer
      const closeDist = 180 + random() * 140;
      const closeHeight = 45 + random() * 85;
      const closeRadius = 35 + random() * 50;
      transform.position.set(Math.cos(angle + 0.05) * closeDist, closeHeight / 2 - 10, Math.sin(angle + 0.05) * closeDist);
      transform.scale.set(closeRadius, closeHeight, closeRadius);
      transform.rotation.set(0, random() * Math.PI, 0);
      transform.updateMatrix();
      darkRidges.setMatrixAt(i, transform.matrix);
    }

    // Distant Pagoda towers silhouetted against the moonlit horizon
    let pagodaIdx = 0;
    for (let i = 0; i < pagodaCount; i++) {
      const angle = (i / pagodaCount) * Math.PI * 2 + random() * 0.2;
      const dist = 210 + random() * 170;
      const baseHeight = 12 + random() * 18;
      const px = Math.cos(angle) * dist;
      const pz = Math.sin(angle) * dist;

      // 4-tiered pagoda tower
      for (let tier = 0; tier < 4; tier++) {
        const tierScale = (4 - tier) * 1.8;
        const tierY = baseHeight + tier * 5.2;

        transform.position.set(px, tierY, pz);
        transform.scale.set(tierScale * 1.4, 0.6, tierScale * 1.4);
        transform.rotation.set(0, angle, 0);
        transform.updateMatrix();
        pagodas.setMatrixAt(pagodaIdx++, transform.matrix);
      }
    }

    mountains.instanceMatrix.needsUpdate = true;
    darkRidges.instanceMatrix.needsUpdate = true;
    pagodas.instanceMatrix.needsUpdate = true;
    mountains.frustumCulled = false;
    darkRidges.frustumCulled = false;
    pagodas.frustumCulled = false;

    this.scene.add(mountains);
    this.scene.add(darkRidges);
    this.scene.add(pagodas);
  }

  addGrandToriiGate() {
    // Grand Ancient Torii Gate marking the end of the sacred shrine path
    const toriiGroup = new THREE.Group();
    toriiGroup.position.set(0, 0, 215);

    const vermilionMat = new THREE.MeshStandardMaterial({
      color: 0xb52424,
      emissive: 0x3d0808,
      emissiveIntensity: 0.35,
      metalness: 0.25,
      roughness: 0.65
    });
    const charcoalMat = new THREE.MeshStandardMaterial({
      color: 0x121418,
      metalness: 0.55,
      roughness: 0.4
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xbfa054,
      emissive: 0x423210,
      emissiveIntensity: 0.4,
      metalness: 0.85,
      roughness: 0.25
    });
    const spiritEnergyMat = new THREE.MeshBasicMaterial({
      color: 0x82b4dc,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    // Main Hashira (Pillars)
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.85, 34, 16), vermilionMat);
      pillar.position.set(side * 22, 17, 0);
      pillar.castShadow = true;
      toriiGroup.add(pillar);

      // Stone base (Daiishi)
      const base = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.7, 4, 12), charcoalMat);
      base.position.set(side * 22, 2, 0);
      toriiGroup.add(base);

      // Black lacquered nemaki sleeve
      const nemaki = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.95, 4.5, 16), charcoalMat);
      nemaki.position.set(side * 22, 6, 0);
      toriiGroup.add(nemaki);
    }

    // Top Kasagi curved lintel beam
    const kasagi = new THREE.Mesh(new THREE.BoxGeometry(58, 2.6, 3.8), charcoalMat);
    kasagi.position.set(0, 34.2, 0);
    toriiGroup.add(kasagi);

    // Shimaki beam below
    const shimaki = new THREE.Mesh(new THREE.BoxGeometry(54, 2.2, 3.2), vermilionMat);
    shimaki.position.set(0, 31.8, 0);
    toriiGroup.add(shimaki);

    // Nuki cross-beam tying pillars
    const nuki = new THREE.Mesh(new THREE.BoxGeometry(49, 1.9, 2.2), vermilionMat);
    nuki.position.set(0, 26.5, 0);
    toriiGroup.add(nuki);

    // Gakuzuka tablet at center
    const tablet = new THREE.Mesh(new THREE.BoxGeometry(3.6, 5.2, 0.6), charcoalMat);
    tablet.position.set(0, 29.2, 0.4);
    toriiGroup.add(tablet);
    const clanGold = new THREE.Mesh(new THREE.OctahedronGeometry(1.2), goldMat);
    clanGold.position.set(0, 29.2, 0.85);
    toriiGroup.add(clanGold);

    // Spirit Rift Portal inside the Torii Gate
    const portalRift = new THREE.Mesh(new THREE.PlaneGeometry(36, 28), spiritEnergyMat);
    portalRift.position.set(0, 16, 0.1);
    toriiGroup.add(portalRift);

    // Warm Hanging Lanterns
    for (const side of [-1, 1]) {
      const lantern = new THREE.Group();
      lantern.position.set(side * 14, 24.5, 0);
      const paper = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 2.4, 10), new THREE.MeshStandardMaterial({
        color: 0xcc2626,
        emissive: 0xff3b3b,
        emissiveIntensity: 0.85,
        roughness: 0.6
      }));
      lantern.add(paper);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.35, 10), charcoalMat);
      cap.position.y = 1.3;
      lantern.add(cap);
      toriiGroup.add(lantern);

      const lanternLight = new THREE.PointLight(0xff5533, 14, 38, 2);
      lanternLight.position.set(side * 14, 23.5, 1);
      toriiGroup.add(lanternLight);
    }

    this.scene.add(toriiGroup);
    this.portal = toriiGroup;
  }

  random(seed) {
    let value = seed >>> 0;
    return () => {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }
}
