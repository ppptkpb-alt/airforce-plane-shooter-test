import { CONFIG } from '../config.js';

const SPAWN_Y = -40;

// แปลง wave หนึ่งรายการเป็นรายการ spawn รายลำ { time, type, x, y, opts }
function expandWave(w) {
  const out = [];
  const n = w.n || 1;
  const interval = w.interval || 0;
  const opts = w.opts || {};
  const yFor = (type) => -CONFIG.enemies[type].radius - 10;

  switch (w.f) {
    case 'single':
      out.push({ time: w.t, x: w.x, y: yFor(w.type) });
      break;
    case 'line':
      for (let i = 0; i < n; i++) {
        const x = n === 1 ? w.x : w.x + ((w.x2 - w.x) * i) / (n - 1);
        out.push({ time: w.t, x, y: yFor(w.type) });
      }
      break;
    case 'column':
    case 'snake':
    case 'diagonal':
      for (let i = 0; i < n; i++) out.push({ time: w.t + i * interval, x: w.x, y: SPAWN_Y });
      break;
    case 'vee': {
      // หัวหน้าอยู่ตรงกลาง ลูกทีมเรียงถอยหลังเป็นรูปตัว V
      const spacing = 44;
      for (let i = 0; i < n; i++) {
        const k = Math.ceil(i / 2) * (i % 2 === 0 ? 1 : -1);
        out.push({ time: w.t, x: w.x + k * spacing, y: SPAWN_Y - Math.abs(k) * 34 });
      }
      break;
    }
    case 'scatter':
      for (let i = 0; i < n; i++) out.push({ time: w.t + i * interval, x: w.xs[i % w.xs.length], y: SPAWN_Y });
      break;
    default:
      console.warn('unknown formation', w.f);
  }

  for (const s of out) {
    s.type = w.type;
    s.opts = opts;
  }
  // ลำที่มาช้าที่สุดถือไอเทม
  if (w.drop && out.length) out[out.length - 1].drop = w.drop;
  return out;
}

// ปล่อยศัตรูตาม timeline ของด่าน
export class WaveManager {
  start(stage) {
    this.events = stage.waves.flatMap(expandWave).sort((a, b) => a.time - b.time);
    this.index = 0;
    this.time = 0;
  }

  update(dt, world) {
    this.time += dt;
    while (this.index < this.events.length && this.events[this.index].time <= this.time) {
      const ev = this.events[this.index++];
      const e = world.spawnEnemy(ev.type, ev.x, ev.y, ev.opts);
      if (ev.drop) e.forcedDrop = ev.drop;
    }
  }

  get allSpawned() {
    return this.index >= this.events.length;
  }

  get progress() {
    if (!this.events.length) return 1;
    return Math.min(1, this.time / this.events[this.events.length - 1].time);
  }
}
