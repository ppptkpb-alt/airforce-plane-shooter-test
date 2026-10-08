import { CONFIG } from '../config.js';

// แผนที่ action → ปุ่มคีย์บอร์ด (event.code)
const BINDINGS = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  fire: ['Space'],
  bomb: ['KeyB'],
  pause: ['KeyP', 'Escape'],
  confirm: ['Enter', 'Space'],
  mute: ['KeyM'],
  quit: ['KeyQ'],
};

const CODE_TO_ACTIONS = new Map();
for (const [action, codes] of Object.entries(BINDINGS)) {
  for (const code of codes) {
    if (!CODE_TO_ACTIONS.has(code)) CODE_TO_ACTIONS.set(code, []);
    CODE_TO_ACTIONS.get(code).push(action);
  }
}

function inCircle(p, c) {
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return dx * dx + dy * dy <= c.r * c.r;
}

// รวม input จากคีย์บอร์ดและ touch
// - held: กดค้างอยู่ / pressed: เพิ่งกดใน step นี้ (ล้างด้วย endStep())
// - touch: ลากนิ้วแบบ relative → สะสมเป็น delta ให้ผู้เล่นใช้
export class Input {
  constructor(screen) {
    this.screen = screen;
    this.heldCodes = new Set();
    this.pressedActions = new Set();
    this.touchMode = false; // เปิดเมื่อมีการแตะจอครั้งแรก (แสดงปุ่ม + ยิงอัตโนมัติ)
    this.dragPointerId = null;
    this.dragLast = { x: 0, y: 0 };
    this.touchDelta = { x: 0, y: 0 };
    this.gestureListeners = [];
    this.blurListeners = [];

    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.heldCodes.delete(e.code));
    window.addEventListener('blur', () => this.onBlur());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.onBlur();
    });

    const canvas = screen.canvas;
    canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    canvas.addEventListener('pointercancel', (e) => this.onPointerUp(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // callback เมื่อผู้ใช้มีปฏิสัมพันธ์ครั้งแรก (ใช้ปลดล็อก AudioContext)
  onGesture(fn) {
    this.gestureListeners.push(fn);
  }

  onBlurEvent(fn) {
    this.blurListeners.push(fn);
  }

  emitGesture() {
    for (const fn of this.gestureListeners) fn();
  }

  onKeyDown(e) {
    const actions = CODE_TO_ACTIONS.get(e.code);
    if (actions) {
      e.preventDefault();
      if (!e.repeat) for (const a of actions) this.pressedActions.add(a);
    }
    this.heldCodes.add(e.code);
    this.emitGesture();
  }

  onBlur() {
    this.heldCodes.clear();
    this.dragPointerId = null;
    for (const fn of this.blurListeners) fn();
  }

  onPointerDown(e) {
    e.preventDefault();
    this.emitGesture();
    const p = this.screen.toLogical(e.clientX, e.clientY);
    this.pressedActions.add('tap');

    if (e.pointerType === 'mouse') return; // เมาส์ใช้แค่คลิกเมนู
    this.touchMode = true;

    if (inCircle(p, CONFIG.touch.bombButton)) {
      this.pressedActions.add('bomb');
      return;
    }
    if (inCircle(p, CONFIG.touch.pauseButton)) {
      this.pressedActions.add('pause');
      return;
    }
    if (this.dragPointerId === null) {
      this.dragPointerId = e.pointerId;
      this.dragLast.x = e.clientX;
      this.dragLast.y = e.clientY;
      this.screen.canvas.setPointerCapture?.(e.pointerId);
    }
  }

  onPointerMove(e) {
    if (e.pointerId !== this.dragPointerId) return;
    e.preventDefault();
    const d = this.screen.toLogicalDelta(e.clientX - this.dragLast.x, e.clientY - this.dragLast.y);
    this.touchDelta.x += d.x;
    this.touchDelta.y += d.y;
    this.dragLast.x = e.clientX;
    this.dragLast.y = e.clientY;
  }

  onPointerUp(e) {
    if (e.pointerId === this.dragPointerId) this.dragPointerId = null;
  }

  down(action) {
    const codes = BINDINGS[action];
    if (!codes) return false;
    for (const c of codes) if (this.heldCodes.has(c)) return true;
    return false;
  }

  pressed(action) {
    return this.pressedActions.has(action);
  }

  get touching() {
    return this.dragPointerId !== null;
  }

  // คืนค่าระยะลากนิ้วที่สะสมไว้ แล้วรีเซ็ต
  consumeTouchDelta(out) {
    out.x = this.touchDelta.x;
    out.y = this.touchDelta.y;
    this.touchDelta.x = 0;
    this.touchDelta.y = 0;
    return out;
  }

  endStep() {
    this.pressedActions.clear();
  }
}
