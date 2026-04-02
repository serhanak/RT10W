// src/TrackMap.js — Default map with track, barriers, environment
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class TrackMap {
  constructor(scene, world, groundMaterial) {
    this.scene = scene;
    this.world = world;

    this._buildGround(groundMaterial);
    this._buildTrack();
    this._buildBarriers();
    this._buildEnvironment();
  }

  _buildGround(groundMaterial) {
    // Visual ground plane
    const groundGeo = new THREE.PlaneGeometry(400, 400);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x4a7c3f, roughness: 0.9 });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    this.scene.add(groundMesh);

    // Physics ground — flat box instead of Plane to avoid rotation issues
    const groundBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      material: groundMaterial
    });
    groundBody.addShape(new CANNON.Box(new CANNON.Vec3(200, 0.1, 200)));
    groundBody.position.set(0, -0.1, 0);
    this.world.addBody(groundBody);
  }

  _buildTrack() {
    // Oval race track
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.7 });
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xcc0000 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });

    // Track is an oval: two straights + two semicircles
    const trackWidth = 12;
    const straightLength = 60;
    const curveRadius = 30;
    const segmentsPerCurve = 32;

    // Build track as series of flat boxes
    const trackPoints = this._generateOvalPoints(straightLength, curveRadius, segmentsPerCurve);

    // Create track surface
    for (let i = 0; i < trackPoints.length; i++) {
      const curr = trackPoints[i];
      const next = trackPoints[(i + 1) % trackPoints.length];
      const dir = new THREE.Vector2(next.x - curr.x, next.z - curr.z);
      const length = dir.length();
      const angle = Math.atan2(dir.x, dir.y);

      // Track segment
      const segGeo = new THREE.PlaneGeometry(trackWidth, length);
      const segMesh = new THREE.Mesh(segGeo, trackMat);
      segMesh.rotation.x = -Math.PI / 2;
      segMesh.rotation.z = -angle;
      segMesh.position.set(
        (curr.x + next.x) / 2,
        0.01,
        (curr.z + next.z) / 2
      );
      segMesh.receiveShadow = true;
      this.scene.add(segMesh);

      // Lane markings (dashed center line)
      if (i % 4 < 2) {
        const lineGeo = new THREE.PlaneGeometry(0.3, length);
        const lineMesh = new THREE.Mesh(lineGeo, whiteMat);
        lineMesh.rotation.x = -Math.PI / 2;
        lineMesh.rotation.z = -angle;
        lineMesh.position.set(
          (curr.x + next.x) / 2,
          0.02,
          (curr.z + next.z) / 2
        );
        this.scene.add(lineMesh);
      }

      // Curb markers (red-white on edges)
      if (i % 3 === 0) {
        const perpX = Math.cos(angle);
        const perpZ = -Math.sin(angle);
        for (const side of [-1, 1]) {
          const curbGeo = new THREE.PlaneGeometry(1.0, length * 0.6);
          const curbColor = (i % 6 === 0) ? curbMat : whiteMat;
          const curbMesh = new THREE.Mesh(curbGeo, curbColor);
          curbMesh.rotation.x = -Math.PI / 2;
          curbMesh.rotation.z = -angle;
          curbMesh.position.set(
            (curr.x + next.x) / 2 + perpX * (trackWidth / 2) * side,
            0.015,
            (curr.z + next.z) / 2 + perpZ * (trackWidth / 2) * side
          );
          this.scene.add(curbMesh);
        }
      }
    }

    // Start/finish line
    const lineGeo = new THREE.PlaneGeometry(trackWidth, 1.5);
    const checkeredCanvas = this._createCheckeredTexture();
    const checkeredTex = new THREE.CanvasTexture(checkeredCanvas);
    const lineMat = new THREE.MeshStandardMaterial({ map: checkeredTex });
    const finishLine = new THREE.Mesh(lineGeo, lineMat);
    finishLine.rotation.x = -Math.PI / 2;
    finishLine.position.set(0, 0.025, straightLength / 2 + curveRadius);
    this.scene.add(finishLine);
  }

  _generateOvalPoints(straightLength, curveRadius, segments) {
    const points = [];
    const halfStraight = straightLength / 2;

    // Right straight (going +Z)
    const numStraightPts = 20;
    for (let i = 0; i < numStraightPts; i++) {
      const t = i / numStraightPts;
      points.push({ x: curveRadius, z: -halfStraight + t * straightLength });
    }

    // Top curve (semicircle)
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI;
      points.push({
        x: curveRadius * Math.cos(angle),
        z: halfStraight + curveRadius * Math.sin(angle)
      });
    }

    // Left straight (going -Z)
    for (let i = 0; i < numStraightPts; i++) {
      const t = i / numStraightPts;
      points.push({ x: -curveRadius, z: halfStraight - t * straightLength });
    }

    // Bottom curve (semicircle)
    for (let i = 0; i <= segments; i++) {
      const angle = Math.PI + (i / segments) * Math.PI;
      points.push({
        x: curveRadius * Math.cos(angle),
        z: -halfStraight + curveRadius * Math.sin(angle)
      });
    }

    return points;
  }

  _createCheckeredTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const size = 16;
    for (let y = 0; y < canvas.height; y += size) {
      for (let x = 0; x < canvas.width; x += size) {
        const isWhite = ((x / size + y / size) % 2 === 0);
        ctx.fillStyle = isWhite ? '#ffffff' : '#222222';
        ctx.fillRect(x, y, size, size);
      }
    }
    return canvas;
  }

  _buildBarriers() {
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6 });
    const straightLength = 60;
    const curveRadius = 30;
    const halfStraight = straightLength / 2;
    const trackWidth = 12;
    const offset = trackWidth / 2 + 1.5;

    const barrierPoints = this._generateOvalPoints(straightLength, curveRadius + offset, 32);
    const innerPoints = this._generateOvalPoints(straightLength, curveRadius - offset, 32);

    // Outer barriers
    this._placeBarriersAlongPath(barrierPoints, barrierMat, 0.8);
    // Inner barriers — skip segments near pit lane (z between -15 and 25, x > 0)
    // This creates a gap for vehicles to enter/exit the pit area
    this._placeBarriersAlongPath(innerPoints, barrierMat, 0.8, (cx, cz) => {
      // Skip barrier if it's in the pit lane opening area (right side, near spawn)
      return cx > 15 && cz > -15 && cz < 25;
    });
  }

  _placeBarriersAlongPath(points, material, height, skipFn) {
    for (let i = 0; i < points.length; i += 3) {
      const curr = points[i];
      const next = points[(i + 1) % points.length];
      const cx = (curr.x + next.x) / 2;
      const cz = (curr.z + next.z) / 2;

      // Skip this barrier segment if filter says so
      if (skipFn && skipFn(cx, cz)) continue;

      const dir = new THREE.Vector2(next.x - curr.x, next.z - curr.z);
      const length = dir.length();
      if (length < 0.01) continue;
      const angle = Math.atan2(dir.x, dir.y);

      // Visual
      const barrierGeo = new THREE.BoxGeometry(0.5, height, length + 0.1);
      const mesh = new THREE.Mesh(barrierGeo, material);
      mesh.position.set(
        (curr.x + next.x) / 2,
        height / 2,
        (curr.z + next.z) / 2
      );
      mesh.rotation.y = angle;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      // Physics — use setFromAxisAngle for Y-axis rotation
      const shape = new CANNON.Box(new CANNON.Vec3(0.25, height / 2, length / 2 + 0.05));
      const body = new CANNON.Body({ type: CANNON.Body.STATIC });
      body.addShape(shape);
      body.position.set(
        (curr.x + next.x) / 2,
        height / 2,
        (curr.z + next.z) / 2
      );
      body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
      this.world.addBody(body);
    }
  }

  _buildEnvironment() {
    // Trees scattered around the track
    const treeColors = [0x2d5a1e, 0x3a7d2c, 0x1e4a12];
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b3a1f });
    const straightLength = 60;
    const curveRadius = 30;

    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 55 + Math.random() * 100;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      // Trunk
      const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 2 + Math.random(), 6);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(x, 1, z);
      trunk.castShadow = true;
      this.scene.add(trunk);

      // Foliage
      const foliageMat = new THREE.MeshStandardMaterial({
        color: treeColors[Math.floor(Math.random() * treeColors.length)]
      });
      const foliageGeo = new THREE.SphereGeometry(1.5 + Math.random(), 8, 6);
      const foliage = new THREE.Mesh(foliageGeo, foliageMat);
      foliage.position.set(x, 3 + Math.random(), z);
      foliage.castShadow = true;
      this.scene.add(foliage);
    }

    // Pit lane / starting area box
    const pitGeo = new THREE.BoxGeometry(8, 0.05, 10);
    const pitMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
    const pitMesh = new THREE.Mesh(pitGeo, pitMat);
    pitMesh.position.set(0, 0.005, 10);
    pitMesh.receiveShadow = true;
    this.scene.add(pitMesh);

    // Spawn area indicators
    const spawnPlayerGeo = new THREE.RingGeometry(0.8, 1.0, 16);
    const spawnPlayerMat = new THREE.MeshStandardMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
    const spawnPlayerMesh = new THREE.Mesh(spawnPlayerGeo, spawnPlayerMat);
    spawnPlayerMesh.rotation.x = -Math.PI / 2;
    spawnPlayerMesh.position.set(0, 0.03, 15);
    this.scene.add(spawnPlayerMesh);

    const spawnVehicleGeo = new THREE.RingGeometry(1.5, 1.8, 16);
    const spawnVehicleMat = new THREE.MeshStandardMaterial({ color: 0xff4444, side: THREE.DoubleSide });
    const spawnVehicleMesh = new THREE.Mesh(spawnVehicleGeo, spawnVehicleMat);
    spawnVehicleMesh.rotation.x = -Math.PI / 2;
    spawnVehicleMesh.position.set(0, 0.03, -5);
    this.scene.add(spawnVehicleMesh);
  }
}
