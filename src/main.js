// src/main.js — RT10W Entry Point
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { InputManager } from './input.js';
import { PlayerCharacter } from './PlayerCharacter.js';
import { ModularVehicle } from './ModularVehicle.js';
import { TrackMap } from './TrackMap.js';
import { CameraSystem } from './CameraSystem.js';

// ========== RENDERER ==========
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

// ========== SCENE ==========
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 200, 800);

// ========== LIGHTING ==========
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(50, 80, 30);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.left = -100;
dirLight.shadow.camera.right = 100;
dirLight.shadow.camera.top = 100;
dirLight.shadow.camera.bottom = -100;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 250;
scene.add(dirLight);

const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x362907, 0.3);
scene.add(hemiLight);

// ========== PHYSICS WORLD ==========
const world = new CANNON.World({
  gravity: new CANNON.Vec3(0, -9.82, 0)
});
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;

// Ground material
const groundMaterial = new CANNON.Material('ground');
const wheelMaterial = new CANNON.Material('wheel');
const characterMaterial = new CANNON.Material('character');

world.addContactMaterial(new CANNON.ContactMaterial(groundMaterial, wheelMaterial, {
  friction: 0.8,
  restitution: 0.1
}));
world.addContactMaterial(new CANNON.ContactMaterial(groundMaterial, characterMaterial, {
  friction: 0.0,
  restitution: 0.0
}));

// ========== CAMERA ==========
const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 1000);

// ========== INPUT ==========
const input = new InputManager(renderer.domElement);

// ========== TRACK / MAP ==========
const trackMap = new TrackMap(scene, world, groundMaterial);

// ========== PLAYER ==========
const player = new PlayerCharacter(scene, world, characterMaterial);
player.mesh.position.set(0, 2, 15);
player.body.position.set(0, 2, 15);

// ========== VEHICLE ==========
const vehicle = new ModularVehicle(scene, world, wheelMaterial, groundMaterial);
vehicle.spawn(new THREE.Vector3(0, 1, -5));

// ========== CAMERA SYSTEM ==========
const cameraSystem = new CameraSystem(camera, renderer.domElement);

// ========== STATE ==========
let isDriving = false;
const hudEl = document.getElementById('hud');
const promptEl = document.getElementById('prompt');
const telemetryEl = document.getElementById('telemetry');

// ========== ENTER / EXIT VEHICLE ==========
function enterVehicle() {
  isDriving = true;
  player.setVisible(false);
  player.setPhysicsEnabled(false);
  vehicle.setControlled(true);
  cameraSystem.setTarget(vehicle.chassisMesh, 'chase');
  hudEl.classList.add('driving');
  promptEl.style.display = 'none';
  input.reset();
}

function exitVehicle() {
  const speed = vehicle.getSpeedKmh();
  if (speed > 10) return; // Must slow down

  isDriving = false;
  const exitPos = vehicle.getExitPosition();
  player.teleport(exitPos.x, exitPos.y, exitPos.z);
  player.setVisible(true);
  player.setPhysicsEnabled(true);
  vehicle.setControlled(false);
  cameraSystem.setTarget(player.mesh, 'thirdPerson');
  hudEl.classList.remove('driving');
  input.reset();
}

// ========== GAME LOOP ==========
const clock = new THREE.Clock();
const fixedTimeStep = 1 / 60;
let accumulator = 0;

cameraSystem.setTarget(player.mesh, 'thirdPerson');

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);
  accumulator += dt;

  // E key — enter/exit
  if (input.justPressed('KeyE')) {
    if (isDriving) {
      exitVehicle();
    } else {
      const dist = player.mesh.position.distanceTo(vehicle.chassisMesh.position);
      if (dist < 6) {
        enterVehicle();
      }
    }
  }

  // C key — change camera mode
  if (input.justPressed('KeyC')) {
    cameraSystem.cycleMode(isDriving);
  }

  // Update game logic BEFORE physics step
  // Ensure camera matrix is fresh for direction calculations
  camera.updateMatrixWorld();

  if (isDriving) {
    vehicle.update(dt, input);
    const speed = vehicle.getSpeedKmh();
    const gear = vehicle.getCurrentGear();
    const rpm = vehicle.getRPM();
    telemetryEl.textContent = `${speed.toFixed(0)} km/h | Gear: ${gear} | RPM: ${rpm.toFixed(0)}`;
  } else {
    player.update(dt, input, camera);

    const dist = player.mesh.position.distanceTo(vehicle.chassisMesh.position);
    promptEl.style.display = dist < 6 ? 'block' : 'none';
  }

  // Physics step AFTER velocity is set
  while (accumulator >= fixedTimeStep) {
    world.step(fixedTimeStep);
    accumulator -= fixedTimeStep;
  }

  // Sync physics → visuals
  player.syncFromPhysics();
  vehicle.syncFromPhysics();

  cameraSystem.update(dt, input, isDriving);
  renderer.render(scene, camera);
  input.endFrame();
}

animate();

// ========== RESIZE ==========
window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});
