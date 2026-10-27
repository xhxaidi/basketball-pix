// Sun shower over the grass patch only: slanted streaks that each land on a grass spot and splash, plus a few
// shallow puddles on the court reflecting the sky.
import * as THREE from 'three';
import { scene } from './stage.js';
import { GW, GD, onGrass, groundH } from './world.js';

const RAIN = 180, RAIN_TOP = 7, DROP_LEN = 0.15, WIND = new THREE.Vector3(0.22, -1, 0.1).normalize(); // light drizzle
const rainPos = new Float32Array(RAIN * 6), rainSpeed = new Float32Array(RAIN);
const rain = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xbfd2e4 }));
rain.geometry.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
rain.frustumCulled = false; scene.add(rain);
const dropAt = (i, y) => {
  // pick a landing spot on the grass patch, then start the drop upwind of it so it lands there
  let x, z;
  do { x = (Math.random() - 0.5) * GW; z = (Math.random() - 0.5) * GD; } while (!onGrass(x, z));
  const k = y / -WIND.y;
  rainPos[i * 6] = x - WIND.x * k; rainPos[i * 6 + 1] = y; rainPos[i * 6 + 2] = z - WIND.z * k;
  rainSpeed[i] = 6 + Math.random() * 3;
};
for (let i = 0; i < RAIN; i++) dropAt(i, Math.random() * RAIN_TOP);

const SPLASH = 160, splashPos = new Float32Array(SPLASH * 3).fill(-99), splashLife = new Float32Array(SPLASH);
const splashes = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xe8f2ff, size: 2, sizeAttenuation: false }));
splashes.geometry.setAttribute('position', new THREE.BufferAttribute(splashPos, 3));
splashes.frustumCulled = false; scene.add(splashes);
let splashNext = 0;

// shallow puddles reflecting the sky
for (const [x, z, sx, sz] of [[-2.5, 1.8, 1.4, 0.7], [1.2, -2.6, 0.9, 0.5], [-4.2, -1.2, 0.7, 0.45], [2.6, 2.9, 1.1, 0.6]]) {
  const pd = new THREE.Mesh(new THREE.CircleGeometry(1, 14), new THREE.MeshBasicMaterial({ color: 0x9cb9d4, transparent: true, opacity: 0.22 }));
  pd.rotation.x = -Math.PI / 2; pd.scale.set(sx, sz, 1); pd.position.set(x, 0.035, z); scene.add(pd);
}

export function updateRain(dt) {
  for (let i = 0; i < RAIN; i++) {
    const k = i * 6, v = rainSpeed[i] * dt;
    rainPos[k] += WIND.x * v; rainPos[k + 1] += WIND.y * v; rainPos[k + 2] += WIND.z * v;
    const x = rainPos[k], y = rainPos[k + 1], z = rainPos[k + 2];
    if (y < groundH(x, z)) {
      splashPos.set([x, groundH(x, z) + 0.05, z], splashNext * 3); splashLife[splashNext] = 0.12; splashNext = (splashNext + 1) % SPLASH;
      dropAt(i, RAIN_TOP + Math.random() * 2);
    }
    // streak tail trails behind the head along the fall direction
    rainPos[k + 3] = rainPos[k] - WIND.x * DROP_LEN; rainPos[k + 4] = rainPos[k + 1] - WIND.y * DROP_LEN; rainPos[k + 5] = rainPos[k + 2] - WIND.z * DROP_LEN;
  }
  for (let i = 0; i < SPLASH; i++) if ((splashLife[i] -= dt) <= 0) splashPos[i * 3 + 1] = -99;
  rain.geometry.attributes.position.needsUpdate = true;
  splashes.geometry.attributes.position.needsUpdate = true;
}
