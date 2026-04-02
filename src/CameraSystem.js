// src/CameraSystem.js — Multi-mode camera (mirrors RT10 camera system)
import * as THREE from 'three';

// Camera modes for player
const PLAYER_MODES = ['thirdPerson', 'firstPerson', 'topDown', 'isometric'];
// Camera modes for vehicle
const VEHICLE_MODES = ['chase', 'cockpit', 'hood', 'cinematic'];

const PRESETS = {
  // ===== PLAYER CAMERAS (from PlayerCharacter.h) =====
  thirdPerson: {
    armLength: 8,
    pitchAngle: -15,
    fov: 90,
    socketOffset: new THREE.Vector3(0, 2, 0),
    lagSpeed: 10,
    rotationLagSpeed: 10,
    usePawnControlRotation: true,
    useMouseLook: true,
  },
  firstPerson: {
    armLength: 0,
    pitchAngle: 0,
    fov: 100,
    socketOffset: new THREE.Vector3(0, 1.7, 0),
    lagSpeed: 10,
    rotationLagSpeed: 10,
    usePawnControlRotation: true,
    useMouseLook: true,
  },
  topDown: {
    armLength: 30,
    pitchAngle: -89,
    fov: 60,
    socketOffset: new THREE.Vector3(0, 0, 0),
    lagSpeed: 5,
    rotationLagSpeed: 5,
    usePawnControlRotation: false,
    useMouseLook: false,
  },
  isometric: {
    armLength: 25,
    pitchAngle: -55,
    fov: 60,
    socketOffset: new THREE.Vector3(0, 0, 0),
    lagSpeed: 5,
    rotationLagSpeed: 5,
    usePawnControlRotation: false,
    useMouseLook: false,
    yawAngle: 45,
  },

  // ===== VEHICLE CAMERAS (from ModularVehiclePawn.h) =====
  chase: {
    armLength: 12,
    pitchAngle: -15,
    fov: 90,
    socketOffset: new THREE.Vector3(0, 3, 0),
    lagSpeed: 5,
    rotationLagSpeed: 5,
    usePawnControlRotation: false,
    useMouseLook: true,
    inheritYaw: true,
  },
  cockpit: {
    armLength: 0,
    pitchAngle: 0,
    fov: 100,
    socketOffset: new THREE.Vector3(0, 1.5, 0),
    lagSpeed: 10,
    rotationLagSpeed: 10,
    usePawnControlRotation: false,
    useMouseLook: true,
    inheritYaw: true,
  },
  hood: {
    armLength: 0.5,
    pitchAngle: -5,
    fov: 100,
    socketOffset: new THREE.Vector3(0, 1.2, 2.5),
    lagSpeed: 10,
    rotationLagSpeed: 10,
    usePawnControlRotation: false,
    useMouseLook: false,
    inheritYaw: true,
  },
  cinematic: {
    armLength: 20,
    pitchAngle: -25,
    fov: 75,
    socketOffset: new THREE.Vector3(0, 2, 0),
    lagSpeed: 3,
    rotationLagSpeed: 3,
    usePawnControlRotation: false,
    useMouseLook: false,
    inheritYaw: false,
  },
};

export class CameraSystem {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;
    this.target = null;
    this.mode = 'thirdPerson';
    this.preset = PRESETS.thirdPerson;

    // Smooth state
    this._currentArmLength = 8;
    this._currentPitch = -15;
    this._currentYaw = 0;
    this._currentFOV = 90;
    this._currentOffset = new THREE.Vector3(0, 2, 0);

    // Mouse look
    this._mousePitch = -15;
    this._mouseYaw = 0;

    // Transition
    this._transitionSpeed = 6;

    // Speed FOV boost (vehicle)
    this._speedFOVOffset = 0;

    // Auto-center
    this._timeSinceLastLook = 0;
    this._autoCenterDelay = 3;
    this._autoCenterSpeed = 3;
  }

  setTarget(target, mode) {
    this.target = target;
    if (mode && PRESETS[mode]) {
      this.mode = mode;
      this.preset = PRESETS[mode];
      // Reset mouse look to preset angles
      this._mousePitch = this.preset.pitchAngle;
      this._mouseYaw = this.preset.yawAngle || 0;
    }
  }

  cycleMode(isDriving) {
    const modes = isDriving ? VEHICLE_MODES : PLAYER_MODES;
    const idx = modes.indexOf(this.mode);
    const newIdx = (idx + 1) % modes.length;
    this.mode = modes[newIdx];
    this.preset = PRESETS[this.mode];
    this._mousePitch = this.preset.pitchAngle;
    this._mouseYaw = this.preset.yawAngle || 0;
  }

  update(dt, input, isDriving) {
    if (!this.target) return;
    const p = this.preset;

    // ========== MOUSE LOOK ==========
    if (p.useMouseLook && input.isPointerLocked) {
      const sensitivity = 0.15;
      this._mouseYaw -= input.mouseDX * sensitivity;
      this._mousePitch -= input.mouseDY * sensitivity;
      this._mousePitch = THREE.MathUtils.clamp(this._mousePitch, -89, 15);
      this._timeSinceLastLook = 0;
    } else {
      this._timeSinceLastLook += dt;
    }

    // ========== TARGET ANGLES ==========
    let targetPitch = p.useMouseLook ? this._mousePitch : p.pitchAngle;
    let targetYaw = p.useMouseLook ? this._mouseYaw : (p.yawAngle || 0);
    let targetArmLength = p.armLength;
    let targetFOV = p.fov;

    // Vehicle camera: inherit yaw from chassis
    if (isDriving && p.inheritYaw) {
      const euler = new THREE.Euler().setFromQuaternion(this.target.quaternion, 'YXZ');
      const chassisYaw = THREE.MathUtils.radToDeg(euler.y);

      if (p.useMouseLook) {
        // Mouse yaw is relative to chassis
        targetYaw = chassisYaw + this._mouseYaw;
      } else {
        targetYaw = chassisYaw;
      }

      // Auto-center after delay
      if (this._timeSinceLastLook > this._autoCenterDelay && p.useMouseLook) {
        this._mouseYaw += (0 - this._mouseYaw) * Math.min(1, this._autoCenterSpeed * dt);
        this._mousePitch += (p.pitchAngle - this._mousePitch) * Math.min(1, this._autoCenterSpeed * dt);
      }
    }

    // ========== SMOOTH INTERPOLATION ==========
    const lerpFactor = Math.min(1, this._transitionSpeed * dt);
    this._currentArmLength += (targetArmLength - this._currentArmLength) * lerpFactor;
    this._currentPitch += (targetPitch - this._currentPitch) * lerpFactor;
    this._currentFOV += (targetFOV - this._currentFOV) * lerpFactor;
    this._currentOffset.lerp(p.socketOffset, lerpFactor);

    // Yaw needs special handling for wrapping
    let yawDiff = targetYaw - this._currentYaw;
    if (yawDiff > 180) yawDiff -= 360;
    if (yawDiff < -180) yawDiff += 360;
    this._currentYaw += yawDiff * lerpFactor;

    // ========== COMPUTE CAMERA POSITION ==========
    const pitchRad = THREE.MathUtils.degToRad(this._currentPitch);
    const yawRad = THREE.MathUtils.degToRad(this._currentYaw);

    const targetPos = this.target.position.clone().add(this._currentOffset);

    if (this._currentArmLength > 0.01) {
      // Third person / chase style
      const armX = Math.sin(yawRad) * Math.cos(pitchRad) * this._currentArmLength;
      const armY = -Math.sin(pitchRad) * this._currentArmLength;
      const armZ = Math.cos(yawRad) * Math.cos(pitchRad) * this._currentArmLength;

      this.camera.position.set(
        targetPos.x - armX,
        targetPos.y + armY,
        targetPos.z - armZ
      );
      this.camera.lookAt(targetPos);
    } else {
      // First person / cockpit — attach camera directly
      // Offset forward in the direction the character/vehicle faces
      const fwdYaw = isDriving
        ? new THREE.Euler().setFromQuaternion(this.target.quaternion, 'YXZ').y
        : THREE.MathUtils.degToRad(this._currentYaw);

      this.camera.position.copy(targetPos);
      // Look forward
      const lookTarget = targetPos.clone().add(
        new THREE.Vector3(
          Math.sin(yawRad) * Math.cos(pitchRad),
          Math.sin(pitchRad),
          Math.cos(yawRad) * Math.cos(pitchRad)
        )
      );
      this.camera.lookAt(lookTarget);
    }

    // ========== FOV ==========
    this.camera.fov = this._currentFOV + this._speedFOVOffset;
    this.camera.updateProjectionMatrix();
  }

  /** Set speed-based FOV boost (for vehicle) */
  setSpeedFOVBoost(boost) {
    this._speedFOVOffset = boost;
  }
}
