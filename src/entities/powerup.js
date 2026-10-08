import { CONFIG } from '../config.js';

const PC = CONFIG.powerups;

// สุ่มชนิดไอเทมตามน้ำหนักใน config
export function randomPowerupKind() {
  const entries = Object.entries(PC.weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [kind, w] of entries) {
    r -= w;
    if (r <= 0) return kind;
  }
  return entries[0][0];
}

// ไอเทม P/S/B/H: ลอยลงช้าๆ แบบส่ายไปมา
export class Powerup {
  constructor(kind, x, y) {
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.baseX = Math.max(30, Math.min(CONFIG.width - 30, x));
    this.r = PC.radius;
    this.t = 0;
    this.seed = Math.random() * 10;
    this.life = PC.lifetime;
    this.alive = true;
  }

  // magnetTarget: ถ้ามี ไอเทมจะพุ่งเข้าหา (ใช้หลังบอสตาย)
  update(dt, magnetTarget = null) {
    this.t += dt;
    if (magnetTarget) {
      const dx = magnetTarget.x - this.x;
      const dy = magnetTarget.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      const step = Math.min(d, PC.magnetSpeed * dt);
      this.x += (dx / d) * step;
      this.y += (dy / d) * step;
      this.baseX = this.x;
      return;
    }
    this.life -= dt;
    this.y += PC.fallSpeed * dt;
    this.x = this.baseX + Math.sin(this.t * PC.swayFreq + this.seed) * PC.swayAmp;
    if (this.life <= 0 || this.y > CONFIG.height + 30) this.alive = false;
  }
}
