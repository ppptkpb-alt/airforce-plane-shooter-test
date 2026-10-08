import { CONFIG } from '../config.js';
import { STAGES } from '../levels.js';
import { drawPlayer } from '../render/sprites.js';
import { text, pad } from './hud.js';
import { bigTitle } from './screens.js';

const W = CONFIG.width;
const H = CONFIG.height;
const TAU = Math.PI * 2;

// เวลาของแต่ละฉาก (วินาที)
const T = {
  formUp: 1.4, // ฝูงบินเข้าประกบ
  climb: 3.2, // เริ่มพุ่งขึ้น (หลังข้อความฉากแรกจางหายไปแล้ว)
  dawn: 4.5, // ท้องฟ้ารุ่งอรุณ + พลุ
  story: 6.0,
  creditsStart: 10.5,
  end: 19, // จบคัตซีน → จอสรุป
};
const CREDITS_SPEED = 110;
const CREDITS_STOP_Y = 210; // บรรทัดแรกของเครดิตหยุดที่ตำแหน่งนี้ แล้ว THE END ขึ้นด้านบน
const LINE_GAP = 30;

// ตำแหน่งลูกฝูงรอบหัวหน้าเป็นรูปตัว V
const WINGMEN = [
  { dx: -52, dy: 42, fromX: -60 },
  { dx: 52, dy: 42, fromX: W + 60 },
  { dx: -104, dy: 84, fromX: -120 },
  { dx: 104, dy: 84, fromX: W + 120 },
];

const STORY = ['กองเรือศัตรูทั้ง 4 แนวรบถูกทำลายสิ้น', 'น่านฟ้ากลับคืนสู่ความสงบอีกครั้ง', 'ขอบคุณ นักบินผู้กล้าหาญ!'];
const FIREWORK_COLORS = ['#ffd36b', '#ff6b8a', '#6ff3ff', '#a8ff7a', '#c77dff', '#ffffff'];

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => v * v * (3 - 2 * v); // smoothstep
const fadeIn = (t, start, dur = 0.8) => clamp01((t - start) / dur);

// คัตซีนฉากจบหลังปราบบอสด่านสุดท้าย:
//   บินกลับฐานเป็นฝูง → ท้องฟ้ารุ่งอรุณ + พลุ + เรื่องราว → เครดิต + THE END
export class Ending {
  constructor(summary, startX, startY, audio) {
    this.summary = summary;
    this.audio = audio;
    this.t = 0;
    this.startX = startX;
    this.startY = startY;
    this.sparks = [];
    this.nextFirework = T.dawn + 0.3;
    this.credits = this.buildCredits();
    audio?.play('fanfare');
  }

  get done() {
    return this.t >= T.end;
  }

  buildCredits() {
    const s = this.summary;
    const lines = [
      { str: 'AIRFORCE STRIKE', size: 30, color: '#ffe9a8', title: true },
      { str: 'ปฏิบัติการเหยี่ยวเหล็ก', size: 14, color: '#cfe6ff' },
      { gap: true },
      { str: 'ศัตรูที่ปราบได้', size: 15, color: '#ffcf6b' },
    ];
    STAGES.forEach((st, i) => lines.push({ str: `ด่าน ${i + 1}  ${st.name}  —  ${st.boss.name}`, size: 13, color: '#e6f2ff' }));
    lines.push(
      { gap: true },
      { str: `ศัตรูที่ทำลายทั้งหมด  ${s.totalKills}`, size: 15, color: '#ffffff' },
      { str: `คะแนนสุดท้าย  ${pad(s.score)}`, size: 17, color: '#ffcf6b' },
    );
    if (s.continues > 0) lines.push({ str: `CONTINUE ที่ใช้  ${s.continues}`, size: 13, color: '#ff9a9a' });
    return lines;
  }

  // background เร่งความเร็วตอนฝูงบินพุ่งขึ้น
  backgroundSpeed() {
    return 1 + ease(clamp01((this.t - T.climb) / 2.5)) * 2.5;
  }

  update(dt) {
    this.t += dt;

    // พลุ
    if (this.t >= this.nextFirework && this.t < T.end - 1.5) {
      this.nextFirework = this.t + 0.45 + Math.random() * 0.5;
      this.burst(60 + Math.random() * (W - 120), 90 + Math.random() * 280);
    }
    for (const p of this.sparks) {
      p.life -= dt;
      p.vy += 70 * dt;
      p.vx *= 1 - 1.2 * dt;
      p.vy *= 1 - 1.2 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.sparks = this.sparks.filter((p) => p.life > 0);
  }

  burst(x, y) {
    const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
    const n = 36 + Math.floor(Math.random() * 16);
    const speed = 110 + Math.random() * 70;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + Math.random() * 0.1;
      const v = speed * (0.75 + Math.random() * 0.3);
      const life = 1.1 + Math.random() * 0.7;
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, maxLife: life, color });
    }
    this.sparks.push({ x, y, vx: 0, vy: 0, life: 0.18, maxLife: 0.18, color: '#ffffff', flash: true });
    this.audio?.play('firework');
  }

  // ---------------------------------------------------------------- draw

  draw(ctx, skipReady, touch) {
    const t = this.t;
    this.drawDawn(ctx);
    this.drawSparks(ctx);
    this.drawFormation(ctx);
    this.drawFlyover(ctx);

    // ฉาก 1: ภารกิจสำเร็จ
    const a1 = fadeIn(t, 0.6) * (1 - fadeIn(t, T.climb + 0.2, 0.5));
    if (a1 > 0) {
      ctx.save();
      ctx.globalAlpha = a1;
      bigTitle(ctx, 'MISSION', 200, 50, '#fff6c0', '#ffcf6b');
      bigTitle(ctx, 'ACCOMPLISHED', 254, 42, '#fff6c0', '#ffcf6b');
      text(ctx, 'ภารกิจสำเร็จ — มุ่งหน้ากลับฐานทัพ', W / 2, 300, 16, '#e6f2ff', 'center');
      ctx.restore();
    }

    // ฉาก 2: เรื่องราว
    const storyOut = 1 - fadeIn(t, T.creditsStart - 0.6, 0.6);
    STORY.forEach((line, i) => {
      const a = fadeIn(t, T.story + i * 1.2) * storyOut;
      if (a <= 0) return;
      ctx.save();
      ctx.globalAlpha = a;
      text(ctx, line, W / 2, 230 + i * 40 - (1 - a) * 10, i === 2 ? 20 : 17, i === 2 ? '#ffe36b' : '#ffffff', 'center');
      ctx.restore();
    });

    // ฉาก 3: เครดิตเลื่อนขึ้น แล้ว THE END
    if (t >= T.creditsStart) {
      const scrolled = (t - T.creditsStart) * CREDITS_SPEED;
      const top = Math.max(CREDITS_STOP_Y, H + 20 - scrolled);
      let y = top;
      for (const line of this.credits) {
        if (line.gap) {
          y += LINE_GAP * 0.6;
          continue;
        }
        if (line.title) bigTitle(ctx, line.str, y, line.size, '#fff6c0', '#ffb347');
        else text(ctx, line.str, W / 2, y, line.size, line.color, 'center');
        y += LINE_GAP;
      }
      if (top === CREDITS_STOP_Y) {
        const stopAt = T.creditsStart + (H + 20 - CREDITS_STOP_Y) / CREDITS_SPEED;
        const a = fadeIn(t, stopAt, 1);
        ctx.save();
        ctx.globalAlpha = a;
        bigTitle(ctx, 'THE END', 120 + (1 - a) * 12, 64, '#ffffff', '#ffcf6b');
        ctx.restore();
      }
    }

    if (skipReady) text(ctx, touch ? 'แตะจอเพื่อข้าม' : 'ENTER = ข้าม', W - 12, H - 16, 11, 'rgba(230,242,255,0.75)', 'right');
  }

  // ท้องฟ้ารุ่งอรุณค่อยๆ ทับฉากทะเล + ดวงอาทิตย์ขึ้น
  drawDawn(ctx) {
    const a = ease(fadeIn(this.t, T.dawn, 1.6));
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1d1640');
    g.addColorStop(0.45, '#5a2d6b');
    g.addColorStop(0.75, '#d9606f');
    g.addColorStop(1, '#ffb36b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const sunY = H + 40 - ease(clamp01((this.t - T.dawn) / 9)) * 150;
    const sg = ctx.createRadialGradient(W / 2, sunY, 10, W / 2, sunY, 220);
    sg.addColorStop(0, 'rgba(255,250,220,1)');
    sg.addColorStop(0.25, 'rgba(255,210,120,0.8)');
    sg.addColorStop(1, 'rgba(255,140,80,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, sunY - 220, W, 440);
    ctx.restore();
  }

  drawSparks(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.sparks) {
      const k = p.life / p.maxLife;
      ctx.globalAlpha = k;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.flash ? 26 * (1 - k) + 6 : 1.4 + k * 1.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // ฉาก 1: ผู้เล่นไปกลางจอ ลูกฝูงบินเข้าประกบ แล้วพุ่งขึ้นออกจอ
  drawFormation(ctx) {
    const t = this.t;
    const k = ease(clamp01(t / T.formUp));
    const climb = t > T.climb ? (t - T.climb) ** 2 * 125 : 0;
    const lx = this.startX + (W / 2 - this.startX) * k;
    const ly = this.startY + (560 - this.startY) * k - climb;
    if (ly < -200) return; // ทั้งฝูงพ้นขอบบนแล้ว
    const bank = (W / 2 - this.startX) * 0.004 * (1 - k);

    for (const [i, m] of WINGMEN.entries()) {
      const mk = ease(clamp01((t - 0.2 - i * 0.15) / T.formUp));
      const x = m.fromX + (lx + m.dx - m.fromX) * mk;
      const y = ly + m.dy + (1 - mk) * 120;
      drawPlayer(ctx, x, y, (1 - mk) * Math.sign(m.dx) * -0.6, t, false, false);
    }
    drawPlayer(ctx, lx, ly, bank, t, false, false);
  }

  // ฉาก 2: ฝูงบินเล็กๆ บินผ่านหน้าดวงอาทิตย์
  drawFlyover(ctx) {
    const t = this.t - (T.story - 0.5);
    if (t < 0 || t > 6) return;
    for (let i = 0; i < 5; i++) {
      const x = 90 + i * 75;
      const y = H + 60 - t * 150 + Math.abs(i - 2) * 30;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(0.6, 0.6);
      drawPlayer(ctx, 0, 0, 0, this.t, false, false);
      ctx.restore();
    }
  }
}
