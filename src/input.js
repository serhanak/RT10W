// src/input.js — Keyboard & Mouse input manager
export class InputManager {
  constructor(canvas) {
    this._keys = {};
    this._justPressedKeys = {};
    this._mouse = { dx: 0, dy: 0, buttons: 0 };
    this._isPointerLocked = false;
    this._canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (!this._keys[e.code]) {
        this._justPressedKeys[e.code] = true;
      }
      this._keys[e.code] = true;
    });

    window.addEventListener('keyup', (e) => {
      this._keys[e.code] = false;
    });

    document.addEventListener('mousemove', (e) => {
      if (this._isPointerLocked) {
        this._mouse.dx += e.movementX;
        this._mouse.dy += e.movementY;
      }
    });

    canvas.addEventListener('mousedown', (e) => {
      this._mouse.buttons = e.buttons;
      if (!this._isPointerLocked) {
        canvas.requestPointerLock();
      }
    });

    canvas.addEventListener('mouseup', (e) => {
      this._mouse.buttons = e.buttons;
    });

    document.addEventListener('pointerlockchange', () => {
      this._isPointerLocked = document.pointerLockElement === canvas;
    });
  }

  isDown(code) {
    return !!this._keys[code];
  }

  justPressed(code) {
    return !!this._justPressedKeys[code];
  }

  get mouseDX() { return this._mouse.dx; }
  get mouseDY() { return this._mouse.dy; }
  get isPointerLocked() { return this._isPointerLocked; }

  reset() {
    this._mouse.dx = 0;
    this._mouse.dy = 0;
    this._justPressedKeys = {};
  }

  endFrame() {
    this._mouse.dx = 0;
    this._mouse.dy = 0;
    this._justPressedKeys = {};
  }
}
