import * as THREE from 'three';

export class World {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111923);
    this.scene.fog = new THREE.Fog(0x111923, 260, 920);
    this.obstacles = [];
    this.addLighting();
    this.addHorizon();
    this.addPortal();
  }

  addLighting() {
    this.scene.add(new THREE.HemisphereLight(0xa9c6ea, 0x27202b, 2.05));

    const sun = new THREE.DirectionalLight(0xffb49d, 2.8);
    sun.position.set(-45, 95, -25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    sun.shadow.camera.left = -90;
    sun.shadow.camera.right = 90;
    sun.shadow.camera.top = 90;
    sun.shadow.camera.bottom = -90;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0x72aaff, 1.25);
    fill.position.set(70, 30, 55);
    this.scene.add(fill);
  }

  addHorizon() {
    const mountainMaterial = new THREE.MeshStandardMaterial({
      color: 0x202938,
      roughness: 1,
      flatShading: true,
      fog: true
    });
    const mountainGeometry = new THREE.ConeGeometry(1, 1, 7, 2);
    const random = this.random(73031);
    for (let i = 0; i < 44; i++) {
      const angle = i / 44 * Math.PI * 2;
      const distance = 410 + random() * 170;
      const height = 110 + random() * 230;
      const mountain = new THREE.Mesh(mountainGeometry, mountainMaterial);
      mountain.position.set(Math.cos(angle) * distance, height * 0.42, Math.sin(angle) * distance);
      mountain.scale.set(80 + random() * 110, height, 85 + random() * 100);
      mountain.rotation.y = random() * Math.PI;
      mountain.receiveShadow = true;
      this.scene.add(mountain);
    }
  }

  addPortal() {
    const portal = new THREE.Group();
    portal.position.set(0, 32, 210);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(17, 1.8, 24, 96),
      new THREE.MeshStandardMaterial({
        color: 0xff865f,
        emissive: 0xff436f,
        emissiveIntensity: 3.2,
        roughness: 0.18,
        metalness: 0.18
      })
    );
    portal.add(ring);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(12, 32, 24),
      new THREE.MeshBasicMaterial({ color: 0xbd326f, transparent: true, opacity: 0.23 })
    );
    core.scale.set(1, 1, 0.12);
    portal.add(core);

    const light = new THREE.PointLight(0xff536e, 140, 360, 2);
    light.position.set(0, 0, 0);
    portal.add(light);
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
