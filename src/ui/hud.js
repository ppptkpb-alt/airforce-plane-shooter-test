import { CONFIG } from '../config.js';
import { drawPlayer } from '../render/sprites.js';

const W = CONFIG.width;
const H = CONFIG.height;
export const FONT = '"Segoe UI", "Leelawadee UI", Tahoma, Arial, sans-serif';

export function text(ctx, str, x, y, size, color = '#fff', align = 'left', weight = 'bold') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2, size / 6);
  ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  ctx.lineJoin = 'round';
  ctx.strokeText(str, x, y);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

export function pad(n, len = 7) {
  return String(Math.floor(n)).padStart(len, '0');
}

function bar(ctx, x, y, w, h, ratio, c0, c1) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x, y, w, h);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, Math.max(0, w * ratio), h);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x, y, Math.max(0, w * ratio), h / 3);
}

function bombIcon(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, 7);
  g.addColorStop(0, '#ffb0f0');
  g.addColorStop(1, '#8a1fb0');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 9px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('B', 0, 0.5);
  ctx.restore();
}

export class Hud {
  draw(ctx, world, stageNumber, touchMode) {
    const p = world.player;
    const s = world.score;

    // แถบด้านบน
    const g = ctx.createLinearGradient(0, 0, 0, 44);
    g.addColorStop(0, 'rgba(0,10,25,0.75)');
    g.addColorStop(1, 'rgba(0,10,25,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, 44);

    text(ctx, 'SCORE', 12, 12, 10, '#9fc6e8');
    text(ctx, pad(s.score), 12, 27, 18, '#ffffff');
    text(ctx, 'HI-SCORE', W / 2, 12, 10, '#ffcf6b', 'center');
    text(ctx, pad(s.highScore), W / 2, 27, 18, s.newHighScore ? '#ffcf6b' : '#ffe9b8', 'center');
    if (stageNumber) text(ctx, `STAGE ${stageNumber}`, W - 12, 12, 10, '#9fc6e8', 'right');

    // HP
    const hpRatio = p.hp / CONFIG.player.maxHp;
    const low = hpRatio < 0.3;
    text(ctx, 'HP', 12, 52, 11, low ? '#ff6b6b' : '#b8f7c8');
    bar(ctx, 32, 47, 130, 9, hpRatio, low ? '#ff8a8a' : '#7dffa0', low ? '#c0262b' : '#18a74a');

    // combo
    if (s.combo >= 2) {
      const pulse = 1 + Math.max(0, s.comboTimer - CONFIG.combo.window + 0.2) * 1.5;
      text(ctx, `${s.combo} COMBO`, W - 12, 30, 13 * pulse, '#ffe36b', 'right');
      text(ctx, `x${s.multiplier}`, W - 12, 50, 18, s.multiplier >= 4 ? '#ff7a3a' : '#ffffff', 'right');
      const ratio = s.comboTimer / CONFIG.combo.window;
      ctx.fillStyle = 'rgba(255,227,107,0.85)';
      ctx.fillRect(W - 12 - 70 * ratio, 62, 70 * ratio, 3);
    }

    // ชีวิต / ระเบิด / ระดับปืน (ล่างซ้าย)
    const baseY = H - 18;
    for (let i = 0; i < p.lives; i++) {
      ctx.save();
      ctx.translate(18 + i * 22, baseY - 34);
      ctx.scale(0.42, 0.42);
      drawPlayer(ctx, 0, 0, 0, 0, false, false);
      ctx.restore();
    }
    for (let i = 0; i < p.bombs; i++) bombIcon(ctx, 18 + i * 17, baseY - 8);

    text(ctx, 'PWR', 12, baseY + 8, 10, '#ffcf6b');
    for (let i = 0; i < CONFIG.weapons.maxLevel; i++) {
      ctx.fillStyle = i < p.weaponLevel ? (p.weaponLevel === 5 ? '#ff7a3a' : '#ffcf3a') : 'rgba(255,255,255,0.18)';
      ctx.fillRect(40 + i * 12, baseY + 4, 9, 8);
    }

    if (touchMode) this.drawTouchButtons(ctx, p);
  }

  drawBossBar(ctx, boss) {
    if (!boss || !boss.showBar) return;
    const x = 60;
    const w = W - 120;
    text(ctx, boss.name, W / 2, 76, 11, '#ffb3b3', 'center');
    bar(ctx, x, 86, w, 8, boss.hp / boss.maxHp, '#ff7a7a', '#b3122a');
    // ขีดแบ่ง phase
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (const t of CONFIG.boss.phaseThresholds) ctx.fillRect(x + w * t - 1, 84, 2, 12);
  }

  drawTouchButtons(ctx, p) {
    const { bombButton: b, pauseButton: pb } = CONFIG.touch;
    ctx.save();
    ctx.globalAlpha = p.bombs > 0 ? 0.75 : 0.3;
    const g = ctx.createRadialGradient(b.x - 8, b.y - 8, 4, b.x, b.y, b.r);
    g.addColorStop(0, 'rgba(230,140,255,0.9)');
    g.addColorStop(1, 'rgba(110,30,150,0.7)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
    text(ctx, 'BOMB', b.x, b.y - 4, 12, '#ffffff', 'center');
    text(ctx, `x${p.bombs}`, b.x, b.y + 11, 11, '#ffe0ff', 'center');

    ctx.globalAlpha = 0.7;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.arc(pb.x, pb.y, pb.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(pb.x - 6, pb.y - 7, 4, 14);
    ctx.fillRect(pb.x + 2, pb.y - 7, 4, 14);
    ctx.restore();
  }
}
