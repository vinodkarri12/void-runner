import * as THREE from 'three';

export class World {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050914);
    this.scene.fog = new THREE.Fog(0x081020, 85, 520);
    this.obstacles = [];
    this.addLighting();
    this.addMoon();
    this.addStarfield();
    this.addMountainHorizon();
    this.addJapaneseCastleBackdrop();
    this.addGrandToriiGate();
  }

  setCampaignMood(level) {
    // 3 Distinct Ninja Environments:
    // Levels 1-5: Moonlit Japanese Temple Sanctuary (Rich Indigo & Sapphire Night)
    // Levels 6-10: Shadow Pagoda & Castle Courtyards (Deep Charcoal Mist & Slate)
    // Levels 11-15: Crimson Demon Fortress (Blood Moon & Ashen Fog)
    const mood = level >= 11
      ? { background: 0x14070c, fog: 0x1d0a12, far: 440, moonColor: 0xff3b52, lightColor: 0xdb8290 }
      : level >= 6
        ? { background: 0x070b14, fog: 0x0c121e, far: 500, moonColor: 0xd6e4f0, lightColor: 0x9fb5cc }
        : { background: 0x050914, fog: 0x081020, far: 520, moonColor: 0xeaf2ff, lightColor: 0xa4c7ee };

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
    // Deep atmospheric indigo ambient light matching moonlit Japanese night
    this.ambientLight = new THREE.HemisphereLight(0x6a8fb8, 0x0e131c, 1.35);
    this.scene.add(this.ambientLight);

    // Dramatic rich blue moonlight casting crisp shadow silhouettes
    this.moonLight = new THREE.DirectionalLight(0xa4c7ee, 2.4);
    this.moonLight.position.set(-58, 105, -68);
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.set(1024, 1024);
    this.moonLight.shadow.camera.left = -105;
    this.moonLight.shadow.camera.right = 105;
    this.moonLight.shadow.camera.top = 105;
    this.moonLight.shadow.camera.bottom = -105;
    this.moonLight.shadow.bias = -0.0005;
    this.scene.add(this.moonLight);

    // Warm orange lantern fill light (simulating Japanese lanterns along the path)
    const lanternFill = new THREE.DirectionalLight(0xff9438, 0.65);
    lanternFill.position.set(45, 28, 45);
    this.scene.add(lanternFill);

    // Cool cyan-blue rim light for high-contrast ninja silhouette separation
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
    rimLight.position.set(20, 22, 130);
    this.scene.add(rimLight);
  }

  addMoon() {
    // Large luminous Japanese full moon in the night sky matching reference image
    const moonGroup = new THREE.Group();
    moonGroup.position.set(-180, 240, -420);

    const moonGeo = new THREE.CircleGeometry(46, 48);
    const moonMat = new THREE.MeshBasicMaterial({
      color: 0xf0f6ff,
      transparent: true,
      opacity: 0.98,
      depthWrite: false
    });
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonGroup.add(this.moonMesh);

    // Inner bright cyan-white lunar corona
    const innerCoronaGeo = new THREE.RingGeometry(44, 68, 48);
    const innerCoronaMat = new THREE.MeshBasicMaterial({
      color: 0x8ec5fc,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const innerCorona = new THREE.Mesh(innerCoronaGeo, innerCoronaMat);
    moonGroup.add(innerCorona);

    // Outer soft luminous lunar atmospheric halo
    const coronaGeo = new THREE.RingGeometry(64, 110, 48);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0x4a88c7,
      transparent: true,
      opacity: 0.26,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.moonCorona = new THREE.Mesh(coronaGeo, coronaMat);
    moonGroup.add(this.moonCorona);

    this.scene.add(moonGroup);
  }

  addStarfield() {
    const starCount = 380;
    const starGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const random = this.random(91823);

    for (let i = 0; i < starCount; i++) {
      const u = random();
      const v = random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 520 + random() * 200;
      const sinPhi = Math.sin(phi);

      const y = Math.abs(Math.cos(phi) * r) + 40;
      const x = sinPhi * Math.cos(theta) * r;
      const z = sinPhi * Math.sin(theta) * r;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const hue = random();
      if (hue < 0.6) {
        colors[i * 3] = 0.88; colors[i * 3 + 1] = 0.94; colors[i * 3 + 2] = 1.0;
      } else if (hue < 0.85) {
        colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.88; colors[i * 3 + 2] = 0.65;
      } else {
        colors[i * 3] = 0.72; colors[i * 3 + 1] = 0.82; colors[i * 3 + 2] = 1.0;
      }
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 2.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.starfield = new THREE.Points(starGeo, starMat);
    this.scene.add(this.starfield);
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

  addJapaneseCastleBackdrop() {
    // Grand Japanese Castle (Tenshukaku) and Pagoda complex visible against the moonlit horizon
    const castleGroup = new THREE.Group();
    castleGroup.position.set(70, 0, -210);

    const stoneBaseMat = new THREE.MeshStandardMaterial({
      color: 0x222730,
      roughness: 0.88,
      metalness: 0.18
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x141820,
      roughness: 0.72,
      metalness: 0.28
    });
    const timberMat = new THREE.MeshStandardMaterial({
      color: 0x181310,
      roughness: 0.85,
      metalness: 0.12
    });
    const plasterMat = new THREE.MeshStandardMaterial({
      color: 0xcfd6df,
      roughness: 0.8,
      metalness: 0.08
    });
    const shojiGlowMat = new THREE.MeshStandardMaterial({
      color: 0xffb84d,
      emissive: 0xff8818,
      emissiveIntensity: 1.6,
      roughness: 0.4,
      metalness: 0.05
    });
    const goldFinialMat = new THREE.MeshStandardMaterial({
      color: 0xd4a742,
      emissive: 0x5a3f0e,
      emissiveIntensity: 0.45,
      metalness: 0.85,
      roughness: 0.25
    });

    // Main Castle Stone Foundation (Ishigaki)
    const baseGeo = new THREE.CylinderGeometry(34, 46, 26, 4);
    const castleBase = new THREE.Mesh(baseGeo, stoneBaseMat);
    castleBase.position.y = 13;
    castleBase.rotation.y = Math.PI / 4;
    castleBase.castShadow = true;
    castleBase.receiveShadow = true;
    castleGroup.add(castleBase);

    // 5-Tier Japanese Castle Keep
    let currentY = 26;
    const tierWidths = [38, 32, 26, 20, 14];
    const tierHeights = [9.5, 8.5, 7.8, 6.8, 5.8];

    for (let t = 0; t < 5; t++) {
      const w = tierWidths[t];
      const h = tierHeights[t];

      // Timber and plaster floor body
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), plasterMat);
      body.position.y = currentY + h / 2;
      body.castShadow = true;
      castleGroup.add(body);

      // Dark timber corner columns
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const col = new THREE.Mesh(new THREE.BoxGeometry(1.2, h, 1.2), timberMat);
          col.position.set(sx * (w / 2 - 0.4), currentY + h / 2, sz * (w / 2 - 0.4));
          castleGroup.add(col);
        }
      }

      // Glowing Shoji Windows on 4 sides
      for (const rot of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.55, h * 0.48), shojiGlowMat);
        win.position.set(0, currentY + h * 0.52, w / 2 + 0.12);
        win.rotation.y = rot;
        castleGroup.add(win);
      }

      // Traditional curved eave roof extending outward
      const roofOverhang = w + 8.5;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(roofOverhang * 0.72, 3.6, 4), roofMat);
      roof.position.y = currentY + h + 1.6;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      castleGroup.add(roof);

      // Wooden balcony railing for middle and top tiers
      if (t === 1 || t === 3) {
        const balustrade = new THREE.Mesh(new THREE.BoxGeometry(w + 2.5, 1.2, w + 2.5), timberMat);
        balustrade.position.y = currentY + 0.6;
        castleGroup.add(balustrade);
      }

      currentY += h + 2.4;
    }

    // Shachihoko roof ridge finial
    const roofFinial = new THREE.Mesh(new THREE.ConeGeometry(2.4, 5.2, 4), goldFinialMat);
    roofFinial.position.y = currentY + 2.4;
    roofFinial.rotation.y = Math.PI / 4;
    castleGroup.add(roofFinial);

    // Warm castle lantern light
    const castleLight = new THREE.PointLight(0xffa033, 12, 110, 1.8);
    castleLight.position.set(0, 48, 18);
    castleGroup.add(castleLight);

    // Flanking Temple Pagoda on Left Ridge
    const pagodaLeft = new THREE.Group();
    pagodaLeft.position.set(-82, 0, -170);

    const pagBase = new THREE.Mesh(new THREE.CylinderGeometry(16, 21, 14, 4), stoneBaseMat);
    pagBase.position.y = 7;
    pagBase.rotation.y = Math.PI / 4;
    pagodaLeft.add(pagBase);

    let pagY = 14;
    for (let p = 0; p < 4; p++) {
      const pw = 18 - p * 3.4;
      const ph = 6.2;
      const pBody = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pw), plasterMat);
      pBody.position.y = pagY + ph / 2;
      pagodaLeft.add(pBody);

      // Glowing window
      const pWin = new THREE.Mesh(new THREE.PlaneGeometry(pw * 0.6, ph * 0.5), shojiGlowMat);
      pWin.position.set(0, pagY + ph / 2, pw / 2 + 0.08);
      pagodaLeft.add(pWin);

      const pRoof = new THREE.Mesh(new THREE.ConeGeometry((pw + 5.5) * 0.72, 2.6, 4), roofMat);
      pRoof.position.y = pagY + ph + 1.2;
      pRoof.rotation.y = Math.PI / 4;
      pagodaLeft.add(pRoof);

      pagY += ph + 1.8;
    }
    const pagFinial = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.6, 6, 8), goldFinialMat);
    pagFinial.position.y = pagY + 3;
    pagodaLeft.add(pagFinial);

    this.scene.add(castleGroup);
    this.scene.add(pagodaLeft);
    this.castleGroup = castleGroup;
  }

  random(seed) {
    let value = seed >>> 0;
    return () => {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }
}
