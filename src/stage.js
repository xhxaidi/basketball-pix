// Renderer, scene, isometric camera, lights, and the pixel look: the scene renders into a low-res target, then a
// post pass tone-maps it, Bayer-dithers it down to a few colours and upscales it nearest-neighbour.
import * as THREE from 'three';

const PX = 4;        // screen pixels per "art" pixel
const LEVELS = 9.0;  // colour levels per channel after dithering

export const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;
document.body.appendChild(renderer.domElement);

export const scene = new THREE.Scene();
renderer.setClearColor(0xffffff, 0); // transparent clear -> post pass paints the page white

// isometric ortho camera
const cam = new THREE.OrthographicCamera();
cam.position.set(-20, 16, 20); // hoop end (+x) ends up top-right, away from camera
cam.lookAt(0, 0, 0);

// lights: low golden sun from the back-left (long hard shadows), cool sky bounce fills them blue-ish
scene.add(new THREE.HemisphereLight(0xa8c8ff, 0x7a6a50, 0.85));
const sun = new THREE.DirectionalLight(0xffe4bc, 4.6);
sun.position.set(-9, 7, -12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 50 });
scene.add(sun);

// ---- low-res target + dither pass ----
const rt = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.HalfFloatType });
const post = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: { tex: { value: rt.texture }, res: { value: new THREE.Vector2() }, levels: { value: LEVELS }, exposure: { value: 1.35 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
  fragmentShader: `
    uniform sampler2D tex; uniform vec2 res; uniform float levels, exposure; varying vec2 vUv;
    vec3 aces(vec3 x){ return clamp(x * (2.51 * x + .03) / (x * (2.43 * x + .59) + .14), 0., 1.); }
    float bayer4(vec2 p){
      int x = int(mod(p.x, 4.)), y = int(mod(p.y, 4.));
      int m[16] = int[16](0,8,2,10, 12,4,14,6, 3,11,1,9, 15,7,13,5);
      return float(m[y * 4 + x]) / 16. - 0.5;
    }
    void main(){
      vec2 px = floor(vUv * res);
      vec4 s = texture2D(tex, (px + .5) / res);
      vec3 c = mix(vec3(1.), pow(aces(s.rgb * exposure), vec3(1. / 2.2)), step(.5, s.a)); // filmic sun; empty = white page
      c = floor(c * (levels - 1.) + .5 + bayer4(px)) / (levels - 1.);
      gl_FragColor = vec4(clamp(c, 0., 1.), 1.);
    }`,
}));
const postScene = new THREE.Scene(); postScene.add(post);
const postCam = new THREE.Camera();

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  const lw = Math.ceil(w / PX), lh = Math.ceil(h / PX);
  rt.setSize(lw, lh);
  post.material.uniforms.res.value.set(lw, lh);
  const zoom = 10.5, a = w / h;
  const half = a > 1 ? zoom : zoom / a;
  Object.assign(cam, { left: -half * a, right: half * a, top: half, bottom: -half, near: 0.1, far: 100 });
  cam.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

export function render() {
  renderer.setRenderTarget(rt); renderer.render(scene, cam);
  renderer.setRenderTarget(null); renderer.render(postScene, postCam);
}
