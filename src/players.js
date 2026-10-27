// The three players: jointed capsule figures (hip -> knee, shoulder -> elbow), each with a movement personality,
// plus the arm gestures they blend in over their running and walking.
import * as THREE from 'three';
import { scene } from './stage.js';
import { noise, mat, box } from './util.js';
import { rim } from './world.js';

const skins = [0x6b4428, 0xc68a5e, 0x3d2616];
export const kits = [[0xe8e4dc, 0x2f6b3a], [0xf2c02c, 0x2a3d8c], [0x1a1a1e, 0xc0282a]]; // [shirt, shorts]
const cap = (r, len, m) => { const o = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, 8), m); o.castShadow = true; return o; };
// per-player movement personality
const STYLES = [
  { speed: 2.7, cadence: 1.0,  stride: 0.65, arm: 0.6,  elbow: 1.1, lean: 0.14, bounce: 0.07, sway: 0.05 }, // smooth glider
  { speed: 3.2, cadence: 1.2,  stride: 0.8,  arm: 0.9,  elbow: 1.5, lean: 0.24, bounce: 0.14, sway: 0.02 }, // bouncy, energetic
  { speed: 2.3, cadence: 0.85, stride: 0.7,  arm: 0.35, elbow: 0.5, lean: 0.05, bounce: 0.05, sway: 0.15 }, // laid-back swagger
];
export const players = kits.map(([shirt, shorts], i) => {
  const p = new THREE.Group(), skin = mat(skins[i]), cloth = mat(shorts), knees = [], elbows = [];
  // legs: hip pivot -> thigh (in shorts colour) -> knee pivot -> shin -> shoe
  const legs = [-0.1, 0.1].map(z => {
    const hip = new THREE.Group(); hip.position.set(0, 0.84, z);
    const thigh = cap(0.085, 0.24, cloth); thigh.position.y = -0.2; hip.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -0.42; hip.add(knee);
    const shin = cap(0.06, 0.28, skin); shin.position.y = -0.18; knee.add(shin);
    const shoe = box(0.22, 0.08, 0.12, mat(0xf4f4f4)); shoe.position.set(0.04, -0.38, 0); knee.add(shoe);
    knees.push(knee); p.add(hip); return hip;
  });
  const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.17, 0.22, 10), cloth);
  hips.scale.x = 0.7; hips.position.y = 0.84; hips.castShadow = true; p.add(hips);
  // tapered torso, flattened front-to-back (local x is facing direction)
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.16, 0.52, 10), mat(shirt));
  torso.scale.x = 0.65; torso.position.y = 1.18; torso.castShadow = true; p.add(torso);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 6), skin); neck.position.y = 1.47; p.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), skin);
  head.scale.set(0.95, 1.1, 0.9); head.position.y = 1.6; head.castShadow = true; p.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.125, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x1a120c));
  hair.position.set(-0.01, 1.62, 0); hair.scale.set(0.98, 1.1, 0.92); p.add(hair);
  // arms: shoulder pivot -> upper arm -> elbow pivot -> forearm + hand
  const arms = [-0.25, 0.25].map(z => {
    const sh = new THREE.Group(); sh.position.set(0, 1.38, z);
    const upper = cap(0.05, 0.2, skin); upper.position.y = -0.15; sh.add(upper);
    const elbow = new THREE.Group(); elbow.position.y = -0.3; sh.add(elbow);
    const fore = cap(0.045, 0.2, skin); fore.position.y = -0.13; elbow.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), skin); hand.position.y = -0.29; elbow.add(hand);
    elbows.push(elbow); p.add(sh); return sh;
  });
  p.scale.setScalar(1.3); p.position.set(-2 + i * 2, 0, -1 + i);
  scene.add(p);
  return { g: p, legs, arms, knees, elbows, target: new THREE.Vector3(), st: STYLES[i], seed: i * 17.3, yaw: 0, gesture: null, vel: new THREE.Vector3(), gait: Math.random() * 6, wait: 0 };
});

// arm poses per gesture, [arms[0], arms[1]] each as [shoulder fwd, shoulder out, elbow bend, forearm in]
const GESTURES = {
  call:  t => [[0.2, 0.1, 0.3, 0], [2.9, 0.35, 0.4 + Math.sin(t * 10) * 0.4, 0]],          // wave for the ball
  point: () => [[0.1, 0.1, 0.2, 0], [1.6, 0, 0, 0]],
  hips:  () => [[-0.15, 0.7, 0, 1.8], [-0.15, 0.7, 0, 1.8]],
  clap:  t => { const a = [1.2, -0.35 + Math.abs(Math.sin(t * 13)) * 0.3, 0.7, 0]; return [a, a]; },
  pump:  t => [[0.3, 0.1, 0.4, 0], [2.7, 0.1, 0.8 + Math.sin(t * 11) * 0.7, 0]],          // fist pump
  head:  () => [[2.7, 0.9, 2.0, 0], [2.7, 0.9, 2.0, 0]],                                  // hands on head
  shrug: () => [[0.5, 0.5, 1.5, 0], [0.5, 0.5, 1.5, 0]],
};
export const gesture = (p, type, dur) => p.gesture = { type, age: 0, dur };

// locomotion and arms for every player; game says who holds, chases, receives the ball
const RIM = rim.position, tmp = new THREE.Vector3();
export function updatePlayers(dt, t, game, ball) {
  players.forEach((p, i) => {
    tmp.subVectors(p.target, p.g.position); tmp.y = 0;
    const d = tmp.length();
    let go = false;
    if (p.wait > 0) p.wait -= dt;
    else go = d > 0.15;
    // momentum toward a pace that drifts between walk and run; everyone sprints for loose balls
    const st = p.st;
    const pace = game.mode === 'loose' && p === game.R ? 1.25 : 0.4 + 0.65 * noise(t * 0.25, p.seed);
    const top = st.speed * pace * (p === game.holder ? 0.75 : 1) * Math.min(1, d / 1.2);
    const want = go ? tmp.normalize().multiplyScalar(top) : tmp.set(0, 0, 0);
    p.vel.lerp(want, 1 - Math.exp(-dt * 5));
    p.g.position.addScaledVector(p.vel, dt);
    const spd = p.vel.length(), moving = spd > 0.25;
    const amp = Math.min(1, spd / 1.2), run = THREE.MathUtils.smoothstep(spd, 1.3, 2.4); // 0 = walk, 1 = run

    // turn smoothly: toward travel direction when running, else toward hoop (holder) or ball
    const look = p === game.holder ? (p === game.R ? game.N.g.position : RIM) : ball.position;
    const yaw = moving ? Math.atan2(-p.vel.z, p.vel.x) : Math.atan2(-(look.z - p.g.position.z), look.x - p.g.position.x);
    p.yaw += Math.atan2(Math.sin(yaw - p.yaw), Math.cos(yaw - p.yaw)) * (1 - Math.exp(-dt * 10));

    // stride: cadence follows speed so feet don't skate; style scales everything
    p.gait += dt * (3 + spd * 2.4) * st.cadence;
    const ph = p.gait, s1 = Math.sin(ph), stride = st.stride * amp * (0.6 + 0.4 * run);
    p.legs[0].rotation.z = s1 * stride; p.legs[1].rotation.z = -s1 * stride;
    // knee folds while the leg recovers from behind to front, much more when running
    const fold = (0.25 + 1.3 * run) * amp;
    p.knees[0].rotation.z = -(0.08 + Math.max(0, -Math.sin(ph - Math.PI / 4)) * fold);
    p.knees[1].rotation.z = -(0.08 + Math.max(0, Math.sin(ph - Math.PI / 4)) * fold);
    const swing = st.arm * amp * (0.5 + 0.5 * run), fwd = 0.15 * run * amp;
    p.arms[0].rotation.z = -s1 * swing + fwd; p.arms[1].rotation.z = s1 * swing + fwd;
    p.arms.forEach(a => a.rotation.x = 0); p.elbows.forEach(e => e.rotation.x = 0);
    p.elbows.forEach(e => e.rotation.z = 0.15 + 0.15 * amp + st.elbow * run * amp);
    p.g.rotation.z = -(0.03 + st.lean * run) * amp;                                   // lean forward
    p.g.rotation.y = p.yaw + Math.sin(ph) * st.sway * amp;                            // shoulder swagger
    p.g.position.y = Math.abs(Math.cos(ph)) * (0.03 + (st.bounce - 0.03) * run) * amp; // bob, airborne when running

    // off-ball players gesture now and then while standing
    if (!p.gesture && p !== game.holder && p !== game.receiver && spd < 0.6 && Math.random() < dt * 0.5)
      gesture(p, ['call', 'call', 'point', 'hips', 'clap'][Math.random() * 5 | 0], 1.2 + Math.random() * 1.5);
    if (p.gesture) {
      const g = p.gesture; g.age += dt;
      if (g.age > g.dur) p.gesture = null;
      else {
        // fade in/out, and mostly drop the gesture while running
        const w = Math.min(1, g.age / 0.2, (g.dur - g.age) / 0.2) * (1 - run * 0.7);
        GESTURES[g.type](t).forEach(([sz, sx, ez, ex], k) => {
          const side = k === 0 ? 1 : -1, a = p.arms[k], e = p.elbows[k];
          a.rotation.z += (sz - a.rotation.z) * w; a.rotation.x = side * sx * w;
          e.rotation.z += (ez - e.rotation.z) * w; e.rotation.x = -side * ex * w;
        });
      }
    }
    if (p === game.holder) { p.arms[1].rotation.z = 0.5 + Math.abs(Math.sin(t * 7)) * 0.4; p.elbows[1].rotation.z = 0.6; }
    if (p === game.receiver) { p.gesture = null; p.arms.forEach(a => a.rotation.z = 1.3); p.elbows.forEach(e => e.rotation.z = 0.4); }
    if (p.throwT > 0) { p.throwT -= dt; p.arms.forEach(a => a.rotation.z = 1.5); p.elbows.forEach(e => e.rotation.z = 0); }
    if (p.jump > 0) {
      p.jump -= dt;
      p.g.position.y = Math.sin(Math.PI * (1 - p.jump / 0.6)) * 0.5;
      p.arms.forEach(a => a.rotation.z = 2.9); p.elbows.forEach(e => e.rotation.z = 0.3);
    }
  });
}
