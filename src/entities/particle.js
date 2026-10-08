import { CONFIG } from '../config.js';
import { Pool } from '../core/pool.js';
import { FONT } from '../ui/hud.js';

const TAU = Math.PI * 2;
const W = CONFIG.width;
const H = CONFIG.height;

function rand(a, b) {
  return a + Math.random() * (b - a);
}

class Particle {
  constructor() {
    this.alive = false;
  }

  init(kind, x, y, vx, vy, life, size, endSize, delay = 0) {
    this.kind = kind; // fire | spark | smoke | ring | debris | text
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.size = size;
    this.endSize = endSize;
    this.delay = delay;
    this.drag = 0;
    this.rot = Math.random() * TAU;
    this.spin = 0;
    this.text = '';
    this.color = '#fff';
    return this;
  }
}

// sprite แสงฟุ้ง (pre-render) สำหรับไฟ/ควัน — drawImage เร็วกว่าสร้าง gradient ทุก particle
function glowSprite(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}

const FIRE_SPRITES = [
  glowSprite([[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,250,210,0.9)'], [1, 'rgba(255,220,120,0)']]),
  glowSprite([[0, 'rgba(255,250,200,1)'], [0.35, 'rgba(255,200,60,0.85)'], [1, 'rgba(255,120,0,0)']]),
  glowSprite([[0, 'rgba(255,200,90,1)'], [0.4, 'rgba(255,110,20,0.75)'], [1, 'rgba(200,40,0,0)']]),
  glowSprite([[0, 'rgba(230,90,30,0.9)'], [0.5, 'rgba(150,30,10,0.5)'], [1, 'rgba(60,10,0,0)']]),
];
const SMOKE_SPRITE = glowSprite([[0, 'rgba(70,70,75,0.7)'], [0.5, 'rgba(60,60,65,0.35)'], [1, 'rgba(50,50,55,0)']]);

// ระบบ effects: particles + screen shake + screen flash + ตัวเลขคะแนนลอย
export class Fx {
  constructor() {
    this.pool = new Pool(() => new Particle(), CONFIG.pools.particles);
    this.shakeAmount = 0;
    this.flashAlpha = 0;
    this.flashColor = '255,255,255';
    this.offset = { x: 0, y: 0 };
  }

  clear() {
    this.pool.clear();
    this.shakeAmount = 0;
    this.flashAlpha = 0;
  }

  spawn(kind, x, y, vx, vy, life, size, endSize, delay) {
    // กันไม่ให้ particles ล้นจนเฟรมตก
    if (this.pool.count >= CONFIG.pools.particles * 1.5 && kind !== 'text') return null;
    return this.pool.acquire().init(kind, x, y, vx, vy, life, size, endSize, delay);
  }

  shake(amount) {
    this.shakeAmount = Math.min(CONFIG.fx.maxShake, this.shakeAmount + amount);
  }

  flash(alpha = 0.8, color = '255,255,255') {
    this.flashAlpha = Math.max(this.flashAlpha, alpha);
    this.flashColor = color;
  }

  shakeOffset() {
    return this.offset;
  }

  // ---------------------------------------------------------------- presets

  explosion(x, y, size = 'small', delay = 0) {
    const big = size === 'large';
    const n = big ? CONFIG.fx.explosionLarge : CONFIG.fx.explosionSmall;
    const power = big ? 1.8 : 1;

    const ring = this.spawn('ring', x, y, 0, 0, big ? 0.5 : 0.3, 4, big ? 90 : 40, delay);
    if (ring) ring.color = '255,230,170';

    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = rand(20, 160) * power;
      const p = this.spawn('fire', x + rand(-6, 6) * power, y + rand(-6, 6) * power, Math.cos(a) * sp, Math.sin(a) * sp,
        rand(0.35, 0.8) * (big ? 1.4 : 1), rand(10, 20) * power, rand(2, 6), delay + rand(0, big ? 0.25 : 0.05));
      if (p) p.drag = 3;
    }
    for (let i = 0; i < n * 0.5; i++) {
      const a = Math.random() * TAU;
      const sp = rand(150, 380) * power;
      const p = this.spawn('spark', x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.2, 0.5), rand(1.5, 2.5), 0, delay);
      if (p) {
        p.drag = 2.5;
        p.color = Math.random() < 0.5 ? '#fff3b0' : '#ffb347';
      }
    }
    for (let i = 0; i < n * 0.3; i++) {
      const a = Math.random() * TAU;
      const sp = rand(10, 60) * power;
      const p = this.spawn('smoke', x, y, Math.cos(a) * sp, Math.sin(a) * sp + 30, rand(0.8, 1.5), rand(10, 16) * power, rand(26, 40) * power, delay + 0.1);
      if (p) p.drag = 1.5;
    }
    for (let i = 0; i < (big ? 10 : 4); i++) {
      const a = Math.random() * TAU;
      const sp = rand(80, 220) * power;
      const p = this.spawn('debris', x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.5, 1.0), rand(2, 4.5), 0, delay);
      if (p) {
        p.drag = 1.2;
        p.spin = rand(-12, 12);
      }
    }
  }

  // ระเบิดต่อเนื่องหลายจุด (บอสตาย)
  chainExplosion(x, y, spread, count, duration) {
    for (let i = 0; i < count; i++) {
      this.explosion(x + rand(-spread, spread), y + rand(-spread * 0.5, spread * 0.5), i % 3 === 0 ? 'large' : 'small', (i / count) * duration);
    }
  }

  sparks(x, y, count = 4, color = '#fff6c0') {
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU);
      const sp = rand(80, 220);
      const p = this.spawn('spark', x, y, Math.cos(a) * sp, Math.sin(a) * sp - 40, rand(0.1, 0.25), rand(1, 2), 0);
      if (p) {
        p.drag = 4;
        p.color = color;
      }
    }
  }

  smoke(x, y) {
    const p = this.spawn('smoke', x, y, rand(-10, 10), rand(20, 50), rand(0.6, 1.0), rand(5, 8), rand(16, 24));
    if (p) p.drag = 1;
  }

  shieldBreak(x, y) {
    const ring = this.spawn('ring', x, y, 0, 0, 0.4, 30, 70);
    if (ring) ring.color = '120,230,255';
    this.sparks(x, y, 18, '#aef4ff');
  }

  bombWave(x, y) {
    for (let i = 0; i < 3; i++) {
      const ring = this.spawn('ring', x, y, 0, 0, 0.9, 10, 650, i * 0.12);
      if (ring) ring.color = i === 0 ? '255,255,255' : '230,150,255';
    }
    this.flash(0.9);
    this.shake(CONFIG.bomb.shake);
  }

  // วงแหวนตอนเก็บไอเทม
  pickup(x, y, color) {
    const ring = this.spawn('ring', x, y, 0, 0, 0.35, 10, 40);
    if (ring) ring.color = color;
  }

  floatText(x, y, str, color = '#ffffff', size = 13) {
    const p = this.spawn('text', x, y, 0, -45, 0.9, size, size);
    if (p) {
      p.text = str;
      p.color = color;
    }
  }

  // ---------------------------------------------------------------- update/draw

  update(dt) {
    for (const p of this.pool.active) {
      if (p.delay > 0) {
        p.delay -= dt;
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      if (p.drag) {
        const k = Math.max(0, 1 - p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      // particles ลอยตามฉากที่เลื่อนลง
      if (p.kind === 'smoke' || p.kind === 'debris') p.y += 30 * dt;
    }
    this.pool.sweep();

    this.shakeAmount = Math.max(0, this.shakeAmount - CONFIG.fx.shakeDecay * dt);
    const s = this.shakeAmount;
    this.offset.x = s > 0 ? rand(-s, s) : 0;
    this.offset.y = s > 0 ? rand(-s, s) : 0;
    this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.2);
  }

  // ควัน + เศษซาก อยู่ใต้เครื่องบิน
  drawBelow(ctx) {
    for (const p of this.pool.active) {
      if (p.delay > 0) continue;
      const t = 1 - p.life / p.maxLife;
      if (p.kind === 'smoke') {
        const size = p.size + (p.endSize - p.size) * t;
        ctx.globalAlpha = (1 - t) * 0.8;
        ctx.drawImage(SMOKE_SPRITE, p.x - size, p.y - size, size * 2, size * 2);
      } else if (p.kind === 'debris') {
        ctx.globalAlpha = 1 - t;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = '#2b2b2b';
        ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ไฟ ประกาย วงแหวน ข้อความ — ใช้ additive blending ให้สว่าง
  drawAbove(ctx) {
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.pool.active) {
      if (p.delay > 0) continue;
      const t = 1 - p.life / p.maxLife;
      if (p.kind === 'fire') {
        const size = p.size + (p.endSize - p.size) * t;
        const sprite = FIRE_SPRITES[Math.min(3, Math.floor(t * 4))];
        ctx.globalAlpha = 1 - t * 0.7;
        ctx.drawImage(sprite, p.x - size, p.y - size, size * 2, size * 2);
      } else if (p.kind === 'spark') {
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
      } else if (p.kind === 'ring') {
        const r = p.size + (p.endSize - p.size) * (1 - (1 - t) * (1 - t));
        ctx.globalAlpha = (1 - t) * 0.8;
        ctx.strokeStyle = `rgb(${p.color})`;
        ctx.lineWidth = 3 * (1 - t) + 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    for (const p of this.pool.active) {
      if (p.kind !== 'text' || p.delay > 0) continue;
      const t = 1 - p.life / p.maxLife;
      ctx.globalAlpha = t < 0.7 ? 1 : (1 - t) / 0.3;
      ctx.font = `bold ${p.size}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  drawScreenFlash(ctx) {
    if (this.flashAlpha <= 0) return;
    ctx.fillStyle = `rgba(${this.flashColor},${Math.min(1, this.flashAlpha)})`;
    ctx.fillRect(0, 0, W, H);
  }
}
