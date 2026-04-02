// src/PlayerCharacter.js — Third-person character with sprint, jump, crouch
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class PlayerCharacter {
  constructor(scene, world, material) {
    this.scene = scene;
    this.world = world;

    // ========== MOVEMENT SETTINGS (from UE5 RT10) ==========
    this.walkSpeed = 6.0;
    this.sprintSpeed = 9.0;
    this.crouchSpeed = 3.0;
    this.currentMaxSpeed = this.walkSpeed;
    this.targetSpeed = this.walkSpeed;
    this.speedTransitionRate = 8.0;
    this.jumpVelocity = 7.0;
    this.airControl = 0.25;
    this.groundFriction = 8.0;

    // ========== STATE ==========
    this.isSprinting = false;
    this.isCrouching = false;
    this.isGrounded = true;
    this.movementSpeed = 0; // for animation
    this.yaw = 0;

    // ========== VISUAL — Capsule character ==========
    const bodyGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.4, 12);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3388ff });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.castShadow = true;
    bodyMesh.position.y = 0.7;

    // Head
    const headGeo = new THREE.SphereGeometry(0.3, 12, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffcc88 });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headMesh.castShadow = true;
    headMesh.position.y = 1.7;

    // Arms
    const armGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.9, 8);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x3388ff });
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.55, 1.0, 0);
    leftArm.castShadow = true;
    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(0.55, 1.0, 0);
    rightArm.castShadow = true;

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.8, 8);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2244aa });
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.2, 0.05, 0);
    leftLeg.castShadow = true;
    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.2, 0.05, 0);
    rightLeg.castShadow = true;

    this.mesh = new THREE.Group();
    this.mesh.add(bodyMesh, headMesh, leftArm, rightArm, leftLeg, rightLeg);
    this.leftArm = leftArm;
    this.rightArm = rightArm;
    this.leftLeg = leftLeg;
    this.rightLeg = rightLeg;
    scene.add(this.mesh);

    // Animation state
    this._animTimer = 0;

    // ========== PHYSICS — Cannon.js sphere body ==========
    const radius = 0.5;
    this.bodyRadius = radius;
    this.body = new CANNON.Body({
      mass: 70,
      shape: new CANNON.Sphere(radius),
      material: material,
      linearDamping: 0.1,
      angularDamping: 1.0, // prevent rolling
      fixedRotation: true,
      allowSleep: false
    });
    this.body.position.set(0, 2, 0);
    world.addBody(this.body);

    // Ground contact detection
    this._groundContactCount = 0;
    this.body.addEventListener('collide', (e) => {
      // Check if collision normal points upward
      const contact = e.contact;
      const normal = contact.ni;
      // If this body is bi, normal points from bi to bj, so flip
      const upDot = contact.bi === this.body ? -normal.y : normal.y;
      if (upDot > 0.5) {
        this._groundContactCount++;
        setTimeout(() => { this._groundContactCount = Math.max(0, this._groundContactCount - 1); }, 100);
      }
    });
  }

  setVisible(visible) {
    this.mesh.visible = visible;
  }

  setPhysicsEnabled(enabled) {
    if (enabled) {
      this.body.type = CANNON.Body.DYNAMIC;
      this.body.updateMassProperties();
    } else {
      this.body.type = CANNON.Body.KINEMATIC;
      this.body.velocity.setZero();
    }
  }

  teleport(x, y, z) {
    this.body.position.set(x, y + this.bodyRadius + 0.1, z);
    this.body.velocity.setZero();
    this.mesh.position.set(x, y, z);
  }

  update(dt, input, camera) {
    this.isGrounded = this._groundContactCount > 0;

    // ========== SPRINT / CROUCH ==========
    this.isSprinting = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    this.isCrouching = input.isDown('ControlLeft') || input.isDown('ControlRight');

    if (this.isCrouching) {
      this.targetSpeed = this.crouchSpeed;
    } else if (this.isSprinting) {
      this.targetSpeed = this.sprintSpeed;
    } else {
      this.targetSpeed = this.walkSpeed;
    }

    // Smooth speed transition
    this.currentMaxSpeed += (this.targetSpeed - this.currentMaxSpeed) * Math.min(1, this.speedTransitionRate * dt);

    // ========== MOVEMENT (camera-relative) ==========
    const moveX = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);
    const moveZ = (input.isDown('KeyW') ? 1 : 0) - (input.isDown('KeyS') ? 1 : 0);

    if (moveX !== 0 || moveZ !== 0) {
      this.body.wakeUp();

      // Compute forward direction from camera to player (guaranteed correct)
      const camForward = new THREE.Vector3();
      camForward.subVectors(this.mesh.position, camera.position);
      camForward.y = 0;
      camForward.normalize();

      // Right = cross(forward, up)
      const camRight = new THREE.Vector3();
      camRight.crossVectors(camForward, new THREE.Vector3(0, 1, 0)).normalize();

      // Build movement direction from input
      const moveDir = new THREE.Vector3();
      moveDir.addScaledVector(camForward, moveZ);  // W=+1 forward
      moveDir.addScaledVector(camRight, moveX);     // D=+1 right
      moveDir.normalize();

      const speed = this.currentMaxSpeed;
      const controlFactor = this.isGrounded ? 1.0 : this.airControl;

      const targetVx = moveDir.x * speed;
      const targetVz = moveDir.z * speed;

      // Directly set horizontal velocity (friction=0 on ground, we control decel)
      const vel = this.body.velocity;
      const lerp = Math.min(1, 12.0 * controlFactor * dt);
      vel.x = vel.x + (targetVx - vel.x) * lerp;
      vel.z = vel.z + (targetVz - vel.z) * lerp;

      // Rotate character to face movement direction
      this.yaw = Math.atan2(moveDir.x, moveDir.z);
    } else {
      // Deceleration (handled in JS since ground friction=0)
      const vel = this.body.velocity;
      const brakeFactor = this.isGrounded ? 12.0 : 1.0;
      const damping = 1 - Math.min(1, brakeFactor * dt);
      vel.x *= damping;
      vel.z *= damping;
    }

    // ========== JUMP ==========
    if (input.justPressed('Space') && this.isGrounded) {
      this.body.velocity.y = this.jumpVelocity;
    }

    // ========== ANIMATION ==========
    const hVel = new THREE.Vector2(this.body.velocity.x, this.body.velocity.z);
    this.movementSpeed = hVel.length();

    if (this.movementSpeed > 0.5) {
      this._animTimer += dt * this.movementSpeed * 1.5;
      const swing = Math.sin(this._animTimer) * 0.5;
      this.leftArm.rotation.x = swing;
      this.rightArm.rotation.x = -swing;
      this.leftLeg.rotation.x = -swing;
      this.rightLeg.rotation.x = swing;
    } else {
      this._animTimer = 0;
      this.leftArm.rotation.x = 0;
      this.rightArm.rotation.x = 0;
      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
    }
  }

  syncFromPhysics() {
    if (this.body.type === CANNON.Body.KINEMATIC) return;
    this.mesh.position.set(
      this.body.position.x,
      this.body.position.y - this.bodyRadius,
      this.body.position.z
    );
    this.mesh.rotation.y = this.yaw;
  }
}
