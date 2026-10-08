import { CONFIG } from '../config.js';

// พื้นหลังแบบ parallax หลายชั้น: ทะเล → เกาะ → เมฆล่าง → (entities) → เมฆบน
// ทุกอย่างสร้างแบบ procedural แล้ว cache เป็น offscreen canvas

export const THEMES = {
  tropical: {
    seaTop: '#0f5a92', seaBottom: '#0a3868', wave: 'rgba(255,255,255,0.13)', shallow: 'rgba(110,225,225,0.45)',
    sand: '#ecd9a0', land: '#4a9a3e', landDark: '#2f7030', rock: '#8a8a76', cloud: '255,255,255', tint: null,
  },
  sunset: {
    seaTop: '#41427e', seaBottom: '#22234f', wave: 'rgba(255,190,140,0.14)', shallow: 'rgba(240,160,120,0.35)',
    sand: '#dcb57c', land: '#7d8a3c', landDark: '#59632a', rock: '#8a6f5c', cloud: '255,212,188', tint: 'rgba(255,110,50,0.10)',
  },
  night: {
    seaTop: '#0c1c38', seaBottom: '#050b1a', wave: 'rgba(140,180,255,0.10)', shallow: 'rgba(60,110,160,0.35)',
    sand: '#6e6650', land: '#2d3f2e', landDark: '#1b291c', rock: '#4a4a52', cloud: '150,165,200', tint: 'rgba(10,20,70,0.18)', lights: true,
  },
  arctic: {
    seaTop: '#2c5470', seaBottom: '#152a3c', wave: 'rgba(220,240,255,0.16)', shallow: 'rgba(170,215,240,0.45)',
    sand: '#cfe3ef', land: '#f2f8fc', landDark: '#b5cfe0', rock: '#8ea4b4', cloud: '225,235,245', tint: 'rgba(170,210,255,0.08)', snow: true,
  },
};

const SNOW_COUNT = 70;

const W = CONFIG.width;
const H = CONFIG.height;
const SEA_TILE_H = 512;

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// tile ทะเลที่ต่อกันแนวตั้งได้แบบไร้รอยต่อ
function makeSeaTile(theme) {
  const c = makeCanvas(W, SEA_TILE_H);
  const g = c.getContext('2d');
  g.fillStyle = theme.seaTop;
  g.fillRect(0, 0, W, SEA_TILE_H);
  // จุดสีเข้ม-อ่อนของน้ำ
  for (let i = 0; i < 26; i++) {
    const x = rand(0, W);
    const y = rand(0, SEA_TILE_H);
    const r = rand(40, 110);
    // วาดซ้ำที่ ±ความสูง tile เพื่อให้ขอบบน-ล่างต่อกันพอดี
    for (const oy of [-SEA_TILE_H, 0, SEA_TILE_H]) {
      const grad = g.createRadialGradient(x, y + oy, 0, x, y + oy, r);
      grad.addColorStop(0, i % 2 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.04)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(x - r, y - r + oy, r * 2, r * 2);
    }
  }
  // คลื่น: เส้นโค้งสั้นๆ
  g.strokeStyle = theme.wave;
  g.lineCap = 'round';
  for (let i = 0; i < 140; i++) {
    const x = rand(0, W);
    const y = rand(0, SEA_TILE_H);
    const len = rand(6, 18);
    g.lineWidth = rand(1, 2);
    for (const oy of [-SEA_TILE_H, 0, SEA_TILE_H]) {
      g.beginPath();
      g.moveTo(x - len, y + oy);
      g.quadraticCurveTo(x, y + oy - 3, x + len, y + oy);
      g.stroke();
    }
  }
  return c;
}

// เส้นขอบเกาะแบบ noisy แล้วทำ smooth ด้วย quadratic curve ผ่านจุดกึ่งกลาง
function islandShape(n, r) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * rand(0.68, 1.0);
    pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr * rand(0.75, 1.0) });
  }
  return pts;
}

function tracePath(g, pts, cx, cy, scale) {
  const n = pts.length;
  g.beginPath();
  const mx = (pts[n - 1].x + pts[0].x) / 2;
  const my = (pts[n - 1].y + pts[0].y) / 2;
  g.moveTo(cx + mx * scale, cy + my * scale);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    g.quadraticCurveTo(cx + p.x * scale, cy + p.y * scale, cx + ((p.x + q.x) / 2) * scale, cy + ((p.y + q.y) / 2) * scale);
  }
  g.closePath();
}

function makeIsland(theme, r) {
  const size = Math.ceil(r * 2.8);
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;
  const pts = islandShape(18, r);

  tracePath(g, pts, cx, cy, 1.28);
  g.fillStyle = theme.shallow;
  g.fill();
  tracePath(g, pts, cx, cy, 1.08);
  g.fillStyle = theme.sand;
  g.fill();
  tracePath(g, pts, cx, cy, 0.94);
  const lg = g.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  lg.addColorStop(0, theme.land);
  lg.addColorStop(1, theme.landDark);
  g.fillStyle = lg;
  g.fill();

  // ป่า/หิน ภายในเกาะ (clip ให้อยู่ในแผ่นดิน)
  g.save();
  tracePath(g, pts, cx, cy, 0.9);
  g.clip();
  for (let i = 0; i < r * 0.6; i++) {
    const x = cx + rand(-r, r);
    const y = cy + rand(-r, r);
    g.beginPath();
    g.arc(x, y, rand(3, 8), 0, Math.PI * 2);
    g.fillStyle = Math.random() < 0.8 ? theme.landDark : theme.rock;
    g.fill();
  }
  // ภูเขาเล็กๆ
  if (r > 50) {
    const mx = cx + rand(-r * 0.3, r * 0.3);
    const my = cy + rand(-r * 0.3, r * 0.3);
    const mg = g.createRadialGradient(mx - 6, my - 6, 2, mx, my, r * 0.35);
    mg.addColorStop(0, 'rgba(255,255,255,0.25)');
    mg.addColorStop(0.4, theme.rock);
    mg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = mg;
    g.fillRect(mx - r, my - r, r * 2, r * 2);
  }
  // ไฟเมืองตอนกลางคืน
  if (theme.lights) {
    for (let i = 0; i < r * 0.4; i++) {
      g.fillStyle = Math.random() < 0.7 ? 'rgba(255,220,120,0.9)' : 'rgba(255,255,255,0.8)';
      g.fillRect(cx + rand(-r * 0.7, r * 0.7), cy + rand(-r * 0.6, r * 0.6), 1.5, 1.5);
    }
  }
  g.restore();
  return c;
}

function makeCloud(theme, w) {
  const h = w * 0.6;
  const c = makeCanvas(Math.ceil(w), Math.ceil(h));
  const g = c.getContext('2d');
  const puffs = 7 + Math.floor(Math.random() * 5);
  for (let i = 0; i < puffs; i++) {
    const x = rand(w * 0.22, w * 0.78);
    const y = rand(h * 0.35, h * 0.65);
    const r = rand(w * 0.12, w * 0.22);
    const grad = g.createRadialGradient(x - r * 0.2, y - r * 0.3, 0, x, y, r);
    grad.addColorStop(0, `rgba(${theme.cloud},0.95)`);
    grad.addColorStop(0.6, `rgba(${theme.cloud},0.55)`);
    grad.addColorStop(1, `rgba(${theme.cloud},0)`);
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return c;
}

class Layer {
  constructor(speed, spawn, gapMin, gapMax) {
    this.speed = speed;
    this.spawn = spawn; // (y) => item
    this.gapMin = gapMin;
    this.gapMax = gapMax;
    this.items = [];
    this.nextGap = 0;
  }

  prefill() {
    this.items.length = 0;
    let y = H;
    while (y > 0) {
      this.items.push(this.spawn(y));
      y -= rand(this.gapMin, this.gapMax);
    }
    // ระยะที่เลื่อนไปแล้วนับจากชิ้นล่าสุด (ชิ้นถัดไปจะโผล่เมื่อครบ nextGap)
    this.sinceSpawn = -y;
    this.nextGap = rand(this.gapMin, this.gapMax);
  }

  update(dt, speedMul) {
    const dy = this.speed * speedMul * dt;
    for (const it of this.items) it.y += dy;
    this.items = this.items.filter((it) => it.y - it.canvas.height / 2 < H + 20);
    this.sinceSpawn += dy;
    if (this.sinceSpawn >= this.nextGap) {
      const it = this.spawn(0);
      it.y = -it.canvas.height / 2;
      this.items.push(it);
      this.sinceSpawn = 0;
      this.nextGap = rand(this.gapMin, this.gapMax);
    }
  }

  draw(ctx, alpha = 1) {
    ctx.globalAlpha = alpha;
    for (const it of this.items) {
      ctx.drawImage(it.canvas, it.x - it.canvas.width / 2, it.y - it.canvas.height / 2);
    }
    ctx.globalAlpha = 1;
  }
}

export class Background {
  constructor() {
    this.speedMul = 1;
    this.setTheme('tropical');
  }

  setTheme(name) {
    const theme = THEMES[name] || THEMES.tropical;
    this.theme = theme;
    this.seaTile = makeSeaTile(theme);
    this.seaOffset = 0;

    // cache ภาพเกาะ/เมฆไว้หลายแบบแล้วสุ่มใช้ซ้ำ
    const islandArt = [];
    for (let i = 0; i < 6; i++) islandArt.push(makeIsland(theme, rand(30, 85)));
    const cloudArt = [];
    for (let i = 0; i < 6; i++) cloudArt.push(makeCloud(theme, rand(120, 220)));
    const bigCloudArt = [];
    for (let i = 0; i < 3; i++) bigCloudArt.push(makeCloud(theme, rand(260, 380)));

    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const bg = CONFIG.background;
    this.islands = new Layer(bg.islandSpeed, (y) => ({ x: rand(40, W - 40), y, canvas: pick(islandArt) }), 260, 480);
    this.cloudsLow = new Layer(bg.cloudLowSpeed, (y) => ({ x: rand(0, W), y, canvas: pick(cloudArt) }), 160, 320);
    this.cloudsHigh = new Layer(bg.cloudHighSpeed, (y) => ({ x: rand(-40, W + 40), y, canvas: pick(bigCloudArt) }), 500, 900);
    this.islands.prefill();
    this.cloudsLow.prefill();
    this.cloudsHigh.prefill();

    // เกล็ดหิมะ (ธีมที่มี snow) — ใกล้ = ใหญ่ เร็ว ชัด
    this.snow = [];
    if (theme.snow) {
      for (let i = 0; i < SNOW_COUNT; i++) {
        const depth = rand(0.3, 1);
        this.snow.push({ x: rand(0, W), y: rand(0, H), r: 0.8 + depth * 1.8, vy: 60 + depth * 160, a: 0.35 + depth * 0.5, ph: rand(0, Math.PI * 2) });
      }
    }
    this.snowTime = 0;
  }

  update(dt) {
    this.seaOffset = (this.seaOffset + CONFIG.background.seaSpeed * this.speedMul * dt) % SEA_TILE_H;
    this.islands.update(dt, this.speedMul);
    this.cloudsLow.update(dt, this.speedMul);
    this.cloudsHigh.update(dt, this.speedMul);

    // หิมะปลิวเฉียงตามลม
    this.snowTime += dt;
    const wind = 40 + Math.sin(this.snowTime * 0.4) * 30;
    for (const s of this.snow) {
      s.y += s.vy * this.speedMul * dt;
      s.x += (wind + Math.sin(this.snowTime * 2 + s.ph) * 20) * (s.r / 2.6) * dt;
      if (s.y > H + 4) {
        s.y = -4;
        s.x = rand(-40, W);
      }
      if (s.x > W + 4) s.x -= W + 8;
    }
  }

  drawBack(ctx) {
    // ทะเล: วาด tile ซ้ำแนวตั้ง
    for (let y = this.seaOffset - SEA_TILE_H; y < H; y += SEA_TILE_H) {
      ctx.drawImage(this.seaTile, 0, Math.floor(y));
    }
    // ไล่สีให้ด้านล่างเข้มขึ้นเล็กน้อย
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, this.theme.seaBottom + '88');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    this.islands.draw(ctx);
    this.cloudsLow.draw(ctx, 0.55);
  }

  drawFront(ctx) {
    this.cloudsHigh.draw(ctx, 0.28);
    for (const s of this.snow) {
      ctx.globalAlpha = s.a;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (this.theme.tint) {
      ctx.fillStyle = this.theme.tint;
      ctx.fillRect(0, 0, W, H);
    }
  }
}
