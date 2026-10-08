import { CONFIG } from '../config.js';

// จัดการขนาด canvas: คงอัตราส่วนจอตรรกะ (480x720) แล้ว scale ให้พอดีหน้าต่าง (letterbox)
// และรองรับจอความละเอียดสูง (devicePixelRatio)
export class Screen {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = CONFIG.width;
    this.height = CONFIG.height;
    this.pixelScale = 1;
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', this.resize);
    this.resize();
  }

  resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.min(vw / this.width, vh / this.height);
    const cssW = Math.floor(this.width * scale);
    const cssH = Math.floor(this.height * scale);
    const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxPixelRatio);

    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.pixelScale = this.canvas.width / this.width;
  }

  // เรียกก่อนวาดทุกเฟรม: ตั้ง transform ให้วาดด้วยพิกัดตรรกะได้เลย
  beginFrame() {
    this.ctx.setTransform(this.pixelScale, 0, 0, this.pixelScale, 0, 0);
  }

  // แปลงพิกัดหน้าจอ (clientX/Y) เป็นพิกัดตรรกะของเกม
  toLogical(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * this.width,
      y: ((clientY - rect.top) / rect.height) * this.height,
    };
  }

  // แปลงระยะ (delta) จาก pixel หน้าจอเป็นหน่วยตรรกะ
  toLogicalDelta(dx, dy) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: (dx / rect.width) * this.width, y: (dy / rect.height) * this.height };
  }
}
