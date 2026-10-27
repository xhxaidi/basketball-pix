// The 3-point shootout, the ball and the scoreboard. Roles rotate each turn: shooter (S) -> rebounder (R) -> next
// shooter (N). Only the rebounder chases a loose ball; the next shooter waits on the arc and waves for the pass.
import * as THREE from 'three';
import { scene } from './stage.js';
import { mat } from './util.js';
import { CW, CD, rim, net } from './world.js';
import { players, kits, gesture } from './players.js';

export const ball = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), mat(0xd9622a));
ball.castShadow = true; scene.add(ball);

const RIM = rim.position, V = () => new THREE.Vector3();
// five spots just outside the painted arc (arc centre x = CW/2 - 1.2)
const SPOTS = [-0.55, -0.28, 0, 0.28, 0.55].map(a => V().set(CW / 2 - 1.2 - Math.cos(a) * 5.7, 0, Math.sin(a) * 5.7));
const REB = V().set(RIM.x - 1.6, 0, 0.6);
const NAMES = ['WHITE', 'YELLOW', 'BLACK'], score = [0, 0, 0];
export const game = { holder: players[0], mode: 'held', timer: 1.5, from: V(), to: V(), u: 0, dur: 1, arc: 0, next: null, receiver: null, bounce: 0,
  S: players[0], R: players[1], N: players[2], spot: 0 };
players[0].g.position.copy(SPOTS[0]); players[0].target.copy(SPOTS[0]);
players[1].g.position.copy(REB);      players[1].target.copy(REB);
players[2].g.position.copy(SPOTS[1]); players[2].target.copy(SPOTS[1]);
let swish = 0;

function drawScore() {
  document.getElementById('score').innerHTML = players.map((p, i) =>
    `<div><i style="background:#${kits[i][0].toString(16).padStart(6, '0')};outline:1px solid #222"></i>${NAMES[i].padEnd(7)}${String(score[i]).padStart(3)}${p === game.S ? ' ◀' : ''}</div>`).join('');
}
drawScore();

function fly(to, dur, arc, next) {
  Object.assign(game, { mode: 'flight', u: 0, dur, arc, next });
  game.from.copy(ball.position); game.to.copy(to);
}
function grab(p) {
  p.gesture = null;
  Object.assign(game, { holder: p, mode: 'held', timer: p === game.S ? 0.8 + Math.random() * 0.8 : 0.4 + Math.random() * 0.4, receiver: null });
}
function rebound(r) {
  // bounce away from the board, then lie loose for the rebounder
  const a = Math.PI / 2 + Math.random() * Math.PI;
  const z = THREE.MathUtils.clamp(RIM.z + Math.sin(a) * r, -CD / 2 + 0.5, CD / 2 - 0.5);
  fly(V().set(RIM.x + Math.cos(a) * r, 0.14, z), 0.6, 0.9, () => {
    game.mode = 'loose'; game.bounce = 0.6; game.R.wait = 0;
  });
}
function rotate() {
  // the catcher is the new shooter; old shooter goes to rebound, old rebounder walks to the next spot
  const { S, R, N } = game;
  game.spot = (game.spot + 1) % SPOTS.length;
  Object.assign(game, { S: N, R: S, N: R });
  S.target.copy(REB);
  R.target.copy(SPOTS[(game.spot + 1) % SPOTS.length]);
  drawScore();
}
function react(shooter, made) {
  if (made) { score[players.indexOf(shooter)] += 3; drawScore(); }
  gesture(shooter, made ? 'pump' : Math.random() < 0.5 ? 'head' : 'shrug', 1.6);
  if (made) players.forEach(q => q !== shooter && Math.random() < 0.7 && gesture(q, 'clap', 1.2));
}

function shoot(p) {
  const d = Math.hypot(RIM.x - p.g.position.x, RIM.z - p.g.position.z), made = Math.random() < 0.45;
  p.jump = 0.6; p.wait = 0.9;
  ball.position.copy(p.g.position).y = 2.7;
  const miss = V().set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize().multiplyScalar(0.35);
  fly(RIM.clone().add(made ? V().setY(0.1) : miss), 0.7 + d * 0.08, 1.5 + d * 0.15, made
    ? () => { swish = 1; react(p, true); fly(V().set(RIM.x, 0.14, RIM.z), 0.35, 0, () => rebound(1.2)); }
    : () => { react(p, false); rebound(2.5); });
}
function pass(p, r) {
  const to = r.g.position.clone().setY(1.6), d = to.distanceTo(p.g.position);
  p.wait = 0.4; p.throwT = 0.3; r.wait = 10; game.receiver = r;   // receiver stands until caught
  ball.position.copy(p.g.position).y = 1.5;
  fly(to, 0.2 + d * 0.07, 0.3 + d * 0.04, () => { r.wait = 0.3; rotate(); grab(r); });
}

// before the players move: the rebounder runs the loose ball down
export function chaseLooseBall() {
  if (game.mode !== 'loose') return;
  const r = game.R;
  r.target.set(ball.position.x, 0, ball.position.z);
  if (Math.hypot(r.g.position.x - ball.position.x, r.g.position.z - ball.position.z) < 0.5) {
    grab(r); r.target.copy(r.g.position);
    gesture(game.N, 'call', 1.2);  // next shooter asks for it
  }
}

// after the players move: the ball is dribbled, in flight or bouncing loose; the net stretches on a make
const tmp = new THREE.Vector3();
export function updateBall(dt, t) {
  if (game.mode === 'held') {
    const h = game.holder;
    h.g.updateMatrixWorld();
    ball.position.copy(h.g.localToWorld(tmp.set(0.3, 0, 0.32)));
    ball.position.y = 0.14 + Math.abs(Math.sin(t * 7)) * 0.85;
    // shooter waits until set on their spot; rebounder feeds the next shooter
    const set = h !== game.S || h.g.position.distanceTo(h.target) < 0.3;
    if (set && (game.timer -= dt) <= 0) {
      game.holder = null;
      h === game.S ? shoot(h) : pass(h, game.N);
    }
  } else if (game.mode === 'flight') {
    const u = game.u = Math.min(1, game.u + dt / game.dur);
    ball.position.lerpVectors(game.from, game.to, u);
    ball.position.y += game.arc * 4 * u * (1 - u);
    if (u >= 1) game.next();
  } else {
    game.bounce = Math.max(0, game.bounce - dt * 0.6);
    ball.position.y = 0.14 + Math.abs(Math.sin(t * 8)) * game.bounce;
  }
  swish = Math.max(0, swish - dt * 2);
  net.scale.y = 1 + Math.sin(swish * Math.PI) * 0.35;
}
