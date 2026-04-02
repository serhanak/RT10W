// src/ModularVehicle.js — Wheeled vehicle with drivetrain physics (RT10 port)
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class ModularVehicle {
  constructor(scene, world, wheelMaterial, groundMaterial) {
    this.scene = scene;
    this.world = world;

    // Chassis material — low friction so chassis doesn't drag on ground
    this.chassisMaterial = new CANNON.Material('chassis');
    world.addContactMaterial(new CANNON.ContactMaterial(groundMaterial, this.chassisMaterial, {
      friction: 0.01,
      restitution: 0.2
    }));

    // ========== DRIVETRAIN SETTINGS (from RT10 DrivetrainCalculator) ==========
    this.gearRatios = [0, 3.6, 2.3, 1.5, 1.0, 0.75]; // 0=reverse, 1-5=forward
    this.reverseRatio = -3.0;
    this.finalDriveRatio = 3.42;
    this.transmissionEfficiency = 0.85;
    this.maxEngineTorque = 400; // Nm
    this.maxRPM = 7000;
    this.idleRPM = 900;
    this.wheelRadius = 0.35; // m
    this.rollingResistance = 0.015;
    this.dragCoefficientArea = 0.9; // Cd*A
    this.airDensity = 1.225;

    // ========== VEHICLE STATE ==========
    this.currentGear = 1;
    this.engineRPM = this.idleRPM;
    this.isReversing = false;
    this.isControlled = false;
    this.throttleInput = 0;
    this.steeringInput = 0;
    this.handbrakeInput = false;
    this.currentSteeringAngle = 0;
    this.maxSteeringAngle = Math.PI / 6; // 30 deg

    // ========== CHASSIS (visual) ==========
    const chassisGroup = new THREE.Group();

    // Body
    const bodyGeo = new THREE.BoxGeometry(2.2, 0.8, 4.5);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, metalness: 0.6, roughness: 0.3 });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.castShadow = true;
    bodyMesh.position.y = 0.6;
    chassisGroup.add(bodyMesh);

    // Roof
    const roofGeo = new THREE.BoxGeometry(1.8, 0.6, 2.0);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xaa1111, metalness: 0.6, roughness: 0.3 });
    const roofMesh = new THREE.Mesh(roofGeo, roofMat);
    roofMesh.castShadow = true;
    roofMesh.position.set(0, 1.2, -0.3);
    chassisGroup.add(roofMesh);

    // Windshield
    const windGeo = new THREE.BoxGeometry(1.6, 0.5, 0.1);
    const windMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.5 });
    const windMesh = new THREE.Mesh(windGeo, windMat);
    windMesh.position.set(0, 1.1, 0.7);
    windMesh.rotation.x = -0.3;
    chassisGroup.add(windMesh);

    // Headlights
    const lightGeo = new THREE.SphereGeometry(0.12, 8, 6);
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffffcc, emissiveIntensity: 0.5 });
    const leftHeadlight = new THREE.Mesh(lightGeo, lightMat);
    leftHeadlight.position.set(-0.7, 0.55, 2.2);
    const rightHeadlight = new THREE.Mesh(lightGeo, lightMat);
    rightHeadlight.position.set(0.7, 0.55, 2.2);
    chassisGroup.add(leftHeadlight, rightHeadlight);

    // Tail lights
    const tailMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.3 });
    const leftTail = new THREE.Mesh(lightGeo, tailMat);
    leftTail.position.set(-0.7, 0.55, -2.2);
    const rightTail = new THREE.Mesh(lightGeo, tailMat);
    rightTail.position.set(0.7, 0.55, -2.2);
    chassisGroup.add(leftTail, rightTail);

    this.chassisMesh = chassisGroup;
    scene.add(this.chassisMesh);

    // ========== WHEELS (visual) ==========
    this.wheelMeshes = [];
    this.wheelPositions = [
      new THREE.Vector3(-1.0, 0.0, 1.4),   // FL
      new THREE.Vector3(1.0, 0.0, 1.4),    // FR
      new THREE.Vector3(-1.0, 0.0, -1.4),  // RL
      new THREE.Vector3(1.0, 0.0, -1.4)    // RR
    ];

    const wheelGeo = new THREE.CylinderGeometry(this.wheelRadius, this.wheelRadius, 0.25, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
    const rimGeo = new THREE.CylinderGeometry(this.wheelRadius * 0.6, this.wheelRadius * 0.6, 0.26, 8);
    rimGeo.rotateZ(Math.PI / 2);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 });

    for (let i = 0; i < 4; i++) {
      const wheelGroup = new THREE.Group();
      const tire = new THREE.Mesh(wheelGeo, wheelMat);
      tire.castShadow = true;
      const rim = new THREE.Mesh(rimGeo, rimMat);
      wheelGroup.add(tire, rim);
      this.wheelMeshes.push(wheelGroup);
      scene.add(wheelGroup);
    }

    // ========== PHYSICS — Cannon.js RaycastVehicle ==========
    const chassisShape = new CANNON.Box(new CANNON.Vec3(1.1, 0.4, 2.25));
    this.chassisBody = new CANNON.Body({
      mass: 1500,
      material: this.chassisMaterial,
      allowSleep: false
    });
    this.chassisBody.addShape(chassisShape, new CANNON.Vec3(0, 0.6, 0));
    this.chassisBody.angularDamping = 0.4;
    this.chassisBody.linearDamping = 0.05;
    world.addBody(this.chassisBody);

    this.cannonVehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassisBody,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2
    });

    const wheelOptions = {
      radius: this.wheelRadius,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: 30,
      suspensionRestLength: 0.4,
      frictionSlip: 2.5,
      dampingRelaxation: 2.3,
      dampingCompression: 4.4,
      maxSuspensionForce: 80000,
      rollInfluence: 0.05,
      axleLocal: new CANNON.Vec3(1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(0, 0, 0),
      maxSuspensionTravel: 0.3,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true
    };

    // Add 4 wheels
    for (let i = 0; i < 4; i++) {
      const p = this.wheelPositions[i];
      wheelOptions.chassisConnectionPointLocal = new CANNON.Vec3(p.x, p.y, p.z);
      wheelOptions.isFrontWheel = i < 2;
      this.cannonVehicle.addWheel(wheelOptions);
    }

    this.cannonVehicle.addToWorld(world);

    // Wheel bodies for visuals
    this.wheelBodies = [];
    for (let i = 0; i < this.cannonVehicle.wheelInfos.length; i++) {
      const wheelBody = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC });
      wheelBody.addShape(new CANNON.Sphere(this.wheelRadius));
      world.addBody(wheelBody);
      this.wheelBodies.push(wheelBody);
    }

    // Wheel spin tracking
    this._wheelSpinAngle = [0, 0, 0, 0];
  }

  spawn(position) {
    this.chassisBody.position.set(position.x, position.y + 2, position.z);
    this.chassisBody.velocity.setZero();
    this.chassisBody.angularVelocity.setZero();
    this.chassisBody.quaternion.set(0, 0, 0, 1);
  }

  setControlled(controlled) {
    this.isControlled = controlled;
    if (!controlled) {
      this.throttleInput = 0;
      this.steeringInput = 0;
      this.handbrakeInput = false;
    }
  }

  getSpeedKmh() {
    const v = this.chassisBody.velocity;
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) * 3.6;
  }

  getSpeedMph() {
    return this.getSpeedKmh() * 0.621371;
  }

  getCurrentGear() {
    return this.isReversing ? -1 : this.currentGear;
  }

  getRPM() {
    return this.engineRPM;
  }

  getExitPosition() {
    // Exit to the right side of the vehicle
    const quat = this.chassisBody.quaternion;
    const right = new CANNON.Vec3(1, 0, 0);
    quat.vmult(right, right);
    return new THREE.Vector3(
      this.chassisBody.position.x + right.x * 3,
      this.chassisBody.position.y + 0.5,
      this.chassisBody.position.z + right.z * 3
    );
  }

  // ========== DRIVETRAIN CALCULATIONS (from DrivetrainCalculator.h) ==========
  _calculateTractiveForce(torque, gearIndex) {
    const ratio = gearIndex < 0 ? this.reverseRatio : (this.gearRatios[gearIndex] || 1);
    return (torque * Math.abs(ratio) * this.finalDriveRatio * this.transmissionEfficiency) / this.wheelRadius;
  }

  _calculateDragForce(speedMs) {
    return 0.5 * this.airDensity * this.dragCoefficientArea * speedMs * speedMs;
  }

  _autoGearShift(speedKmh) {
    if (this.isReversing) return;
    // Simple auto-shift
    const shiftPoints = [0, 20, 50, 80, 120, 160];
    let newGear = 1;
    for (let i = shiftPoints.length - 1; i >= 1; i--) {
      if (speedKmh >= shiftPoints[i]) {
        newGear = Math.min(i, 5);
        break;
      }
    }
    this.currentGear = newGear;
  }

  update(dt, input) {
    if (!this.isControlled) {
      // Apply slight braking when not controlled
      for (let i = 0; i < 4; i++) {
        this.cannonVehicle.setBrake(5, i);
        this.cannonVehicle.applyEngineForce(0, i);
      }
      return;
    }

    // ========== INPUT ==========
    const throttle = (input.isDown('KeyW') ? 1 : 0) - (input.isDown('KeyS') ? 1 : 0);
    const steer = (input.isDown('KeyA') ? 1 : 0) - (input.isDown('KeyD') ? 1 : 0);
    const handbrake = input.isDown('Space');

    this.throttleInput = throttle;
    this.steeringInput = steer;
    this.handbrakeInput = handbrake;

    const speedKmh = this.getSpeedKmh();

    // ========== REVERSE LOGIC (from ModularVehiclePawn) ==========
    const isNearlyStationary = speedKmh < 5;
    if (throttle > 0) {
      this.isReversing = false;
    } else if (throttle < 0 && (isNearlyStationary || this.isReversing)) {
      this.isReversing = true;
    }

    // ========== AUTO GEAR SHIFT ==========
    this._autoGearShift(speedKmh);

    // ========== TRACTIVE FORCE ==========
    const gearIdx = this.isReversing ? -1 : this.currentGear;
    const engineTorque = this.maxEngineTorque * Math.abs(throttle);
    let tractiveForce = this._calculateTractiveForce(engineTorque, gearIdx);
    if (this.isReversing) tractiveForce = -tractiveForce;
    if (throttle < 0 && !this.isReversing) tractiveForce = 0; // braking

    // ========== RPM SIMULATION ==========
    const gearRatio = this.isReversing ? Math.abs(this.reverseRatio) : (this.gearRatios[this.currentGear] || 1);
    const wheelRPS = (speedKmh / 3.6) / (2 * Math.PI * this.wheelRadius);
    const calculatedRPM = wheelRPS * gearRatio * this.finalDriveRatio * 60;
    this.engineRPM = Math.max(this.idleRPM, Math.min(this.maxRPM, calculatedRPM + this.idleRPM));

    // ========== APPLY FORCES ==========
    const maxForce = 3000;
    const engineForce = THREE.MathUtils.clamp(tractiveForce, -maxForce, maxForce) * (throttle !== 0 ? 1 : 0);

    // Steering with speed-dependent reduction
    const steerFactor = 1.0 - Math.min(0.6, speedKmh / 250);
    const targetSteer = steer * this.maxSteeringAngle * steerFactor;
    this.currentSteeringAngle += (targetSteer - this.currentSteeringAngle) * Math.min(1, 8 * dt);

    // Apply to rear wheels (RWD) — negate force: cannon-es convention
    for (let i = 2; i < 4; i++) {
      this.cannonVehicle.applyEngineForce(-engineForce, i);
    }
    // Front wheels — no engine
    for (let i = 0; i < 2; i++) {
      this.cannonVehicle.applyEngineForce(0, i);
    }

    // Steering on front wheels
    this.cannonVehicle.setSteeringValue(this.currentSteeringAngle, 0);
    this.cannonVehicle.setSteeringValue(this.currentSteeringAngle, 1);

    // Braking
    if (handbrake) {
      for (let i = 0; i < 4; i++) {
        this.cannonVehicle.setBrake(60, i);
      }
    } else if (throttle < 0 && !this.isReversing) {
      // Normal braking
      for (let i = 0; i < 4; i++) {
        this.cannonVehicle.setBrake(Math.abs(throttle) * 40, i);
      }
    } else {
      for (let i = 0; i < 4; i++) {
        this.cannonVehicle.setBrake(0, i);
      }
    }

    // ========== DRAG FORCE ==========
    const vel = this.chassisBody.velocity;
    const speedMs = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
    if (speedMs > 0.1) {
      const dragForce = this._calculateDragForce(speedMs);
      const dragDir = new CANNON.Vec3(-vel.x, 0, -vel.z);
      dragDir.normalize();
      dragDir.scale(dragForce, dragDir);
      this.chassisBody.applyForce(dragDir, this.chassisBody.position);
    }

    // ========== WHEEL SPIN ==========
    const forwardSpeed = speedMs * (this.isReversing ? -1 : 1);
    const spinRate = forwardSpeed / this.wheelRadius;
    for (let i = 0; i < 4; i++) {
      this._wheelSpinAngle[i] += spinRate * dt;
    }
  }

  syncFromPhysics() {
    // Chassis
    const p = this.chassisBody.position;
    const q = this.chassisBody.quaternion;
    this.chassisMesh.position.set(p.x, p.y, p.z);
    this.chassisMesh.quaternion.set(q.x, q.y, q.z, q.w);

    // Wheels
    for (let i = 0; i < 4; i++) {
      this.cannonVehicle.updateWheelTransform(i);
      const t = this.cannonVehicle.wheelInfos[i].worldTransform;
      this.wheelMeshes[i].position.set(t.position.x, t.position.y, t.position.z);
      this.wheelMeshes[i].quaternion.set(t.quaternion.x, t.quaternion.y, t.quaternion.z, t.quaternion.w);

      // Apply spin
      const tireMesh = this.wheelMeshes[i].children[0];
      if (tireMesh) {
        tireMesh.rotation.x = this._wheelSpinAngle[i];
        if (this.wheelMeshes[i].children[1]) {
          this.wheelMeshes[i].children[1].rotation.x = this._wheelSpinAngle[i];
        }
      }
    }
  }
}
