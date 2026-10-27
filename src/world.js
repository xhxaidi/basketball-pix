// The ground: a ragged, bumpy grass patch with a dirt path around an asphalt court, a hoop, a bench and a bin.
import * as THREE from 'three';
import { scene } from './stage.js';
import { canvasTex, speckle, fbm, mat, box } from './util.js';

export const CW = 12, CD = 8; // court size in world units (x, z)

const courtTex = canvasTex(768, 512, (g, w, h) => {
  const s = w / CW; // px per unit
  g.fillStyle = '#5e5e5f'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 9000, ['#484849', '#6e6d69', '#3a3a3c', '#7c7a74'], 3);
  // blotchy stains
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(20,20,22,${Math.random() * 0.25})`;
    g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 60, 10 + Math.random() * 30, Math.random() * 3, 0, 7); g.fill();
  }
  // blue key near the hoop end (x = +)
  const keyW = 3.6 * s, keyH = 3.2 * s;
  g.fillStyle = '#2d5670'; g.fillRect(w - keyW - 0.6 * s, h / 2 - keyH / 2, keyW, keyH);
  g.strokeStyle = '#e4e0d4'; g.lineWidth = 6;
  g.strokeRect(0.6 * s, 0.6 * s, w - 1.2 * s, h - 1.2 * s);
  g.strokeRect(w - keyW - 0.6 * s, h / 2 - keyH / 2, keyW, keyH);
  // free-throw circle
  g.beginPath(); g.arc(w - keyW - 0.6 * s, h / 2, keyH / 2, Math.PI / 2, Math.PI * 1.5); g.stroke();
  // three-point arc
  g.beginPath(); g.arc(w - 1.2 * s, h / 2, 5.2 * s, Math.PI * 0.62, Math.PI * 1.38); g.stroke();
  // half-court circle on the left edge
  g.beginPath(); g.arc(0.6 * s, h / 2, 1.4 * s, -Math.PI / 2, Math.PI / 2); g.stroke();
});

export const GW = CW + 5, GD = CD + 5, GPX = 20; // grass patch size (world units), texels per unit
const courtDist = (x, z) => Math.hypot(Math.max(Math.abs(x) - CW / 2, 0), Math.max(Math.abs(z) - CD / 2, 0));
export const onGrass = (x, z) => Math.min(GW / 2 - Math.abs(x), GD / 2 - Math.abs(z)) > 0.4 + fbm(x * 0.7, z * 0.7) * 1.6;
export const groundH = (x, z) => THREE.MathUtils.smoothstep(courtDist(x, z), 0.6, 1.6) * fbm(x * 0.8, z * 0.8) * 0.3;

const grassTex = canvasTex(GW * GPX, GD * GPX, (g, w, h) => {
  const img = g.createImageData(w, h);
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const x = px / GPX - GW / 2, z = py / GPX - GD / 2, r = Math.random();
    const edge = Math.min(GW / 2 - Math.abs(x), GD / 2 - Math.abs(z));          // distance in from patch edge
    const keep = edge > 0.2 + fbm(x * 0.7, z * 0.7) * 1.6 + r * 0.25;            // wavy, ragged outline
    let c;
    if (courtDist(x, z) < 0.3 + fbm(x * 1.3 + 20, z * 1.3) * 0.55) {           // uneven dirt path
      c = r < 0.3 ? [124, 90, 62] : r < 0.6 ? [150, 112, 78] : [138, 100, 70];
    } else {
      const k = fbm(x * 0.5 + 40, z * 0.5) + (r - 0.5) * 0.35 - Math.max(0, 1 - edge) * 0.25;
      c = k < 0.35 ? [62, 98, 42] : k < 0.5 ? [86, 128, 54] : k < 0.65 ? [112, 154, 66] : [140, 176, 82];
    }
    img.data.set([...c, keep ? 255 : 0], (py * w + px) * 4);
  }
  g.putImageData(img, 0, 0);
});

const backboardTex = canvasTex(64, 48, (g, w, h) => {
  g.fillStyle = '#e6e2d6'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#c0282a'; g.lineWidth = 3;
  g.strokeRect(2, 2, w - 4, h - 4);
  g.strokeRect(w / 2 - 12, h / 2 - 2, 24, 18);
});

// bumpy grass ground (flat under the court and path)
const grassGeo = new THREE.PlaneGeometry(GW, GD, GW * 4, GD * 4);
const gp = grassGeo.attributes.position;
for (let i = 0; i < gp.count; i++) gp.setZ(i, groundH(gp.getX(i), -gp.getY(i)));
grassGeo.computeVertexNormals();
const grass = new THREE.Mesh(grassGeo, new THREE.MeshLambertMaterial({ map: grassTex, alphaTest: 0.5 }));
grass.rotation.x = -Math.PI / 2; grass.position.y = 0.01; grass.receiveShadow = true; grass.castShadow = true; scene.add(grass);

// grass clumps scattered over the bumps
const tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(0.09, 0.3, 4), mat(0x4f7d36), 260);
tufts.castShadow = tufts.receiveShadow = true;
for (let i = 0, n = 0, m = new THREE.Matrix4(); n < tufts.count && i < 5000; i++) {
  const x = (Math.random() - 0.5) * GW, z = (Math.random() - 0.5) * GD;
  if (courtDist(x, z) < 1 || !onGrass(x, z)) continue; // only on grass
  const sc = 0.6 + Math.random() * 0.9;
  m.compose(new THREE.Vector3(x, groundH(x, z) + 0.12 * sc, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.random() * 3, 0)), new THREE.Vector3(sc, sc, sc));
  tufts.setMatrixAt(n++, m);
}
scene.add(tufts);

const court = new THREE.Mesh(new THREE.PlaneGeometry(CW, CD), mat(0xffffff, { map: courtTex }));
court.rotation.x = -Math.PI / 2; court.position.y = 0.03; court.receiveShadow = true; scene.add(court);

// hoop at +x end
const navy = mat(0x1c2233);
const pole = box(0.25, 4.2, 0.25, navy); pole.position.set(CW / 2 + 0.6, 2.1, 0); scene.add(pole);
const arm = box(0.9, 0.15, 0.15, navy); arm.position.set(CW / 2 + 0.2, 3.7, 0); scene.add(arm);
const boardFace = mat(0xffffff, { map: backboardTex }), boardEdge = mat(0xe6e2d6);
const board = box(0.1, 1.2, 1.8, [boardFace, boardFace, boardEdge, boardEdge, boardEdge, boardEdge]);
board.position.set(CW / 2 - 0.25, 3.7, 0); scene.add(board);
const bracket = box(0.2, 0.06, 0.1, mat(0xe2552a)); bracket.position.set(CW / 2 - 0.38, 3.3, 0); scene.add(bracket);
export const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 6, 16), mat(0xe2552a));
rim.rotation.x = Math.PI / 2; rim.position.set(CW / 2 - 0.65, 3.3, 0); rim.castShadow = true; scene.add(rim);
const netGeo = new THREE.CylinderGeometry(0.3, 0.18, 0.5, 12, 3, true); netGeo.translate(0, -0.25, 0); // hang from the rim
export const net = new THREE.Mesh(netGeo, new THREE.MeshBasicMaterial({ color: 0xf2f0ea, wireframe: true }));
net.position.copy(rim.position); scene.add(net);
const footing = box(1.6, 0.08, 0.15, navy); footing.position.set(CW / 2 + 0.6, 0.04, 0); scene.add(footing);

// bench + bin along the back edge
const wood = mat(0x8b5a3a);
const bench = new THREE.Group();
const seat = box(2.4, 0.12, 0.5, wood); seat.position.y = 0.55; bench.add(seat);
for (const x of [-1, 1]) { const leg = box(0.1, 0.55, 0.45, navy); leg.position.set(x, 0.27, 0); bench.add(leg); }
bench.position.set(1.5, 0, -CD / 2 - 0.6); scene.add(bench);
const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.27, 0.8, 10), mat(0x2a46a0));
bin.position.set(3.4, 0.4, -CD / 2 - 0.6); bin.castShadow = bin.receiveShadow = true; scene.add(bin);
