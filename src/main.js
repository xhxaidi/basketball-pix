// Pixel Court: an isometric pixel-art basketball court that plays itself.
// Modules build their part of the scene when imported, in this order.
import * as THREE from 'three';
import { renderer, render } from './stage.js';
import './world.js';
import { updateRain } from './rain.js';
import { updatePlayers } from './players.js';
import { game, ball, chaseLooseBall, updateBall } from './game.js';

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  chaseLooseBall();
  updatePlayers(dt, t, game, ball);
  updateBall(dt, t);
  updateRain(dt);
  render();
});
