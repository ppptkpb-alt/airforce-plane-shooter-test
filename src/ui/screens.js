import { CONFIG } from '../config.js';
import { drawPlayer } from '../render/sprites.js';
import { text, pad, FONT } from './hud.js';

const W = CONFIG.width;
const H = CONFIG.height;

function dim(ctx, alpha = 0.6) {
  ctx.fillStyle = `rgba(2,8,20,${alpha})`;
  ctx.fillRect(0, 0, W, H);
}

function panel(ctx, x, y, w, h) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(18,40,70,0.92)');
  g.addColorStop(1, 'rgba(6,16,34,0.92)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,200,255,0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

// หัวข้อใหญ่สีโลหะ
export function bigTitle(ctx, str, y, size, c0 = '#ffffff', c1 = '#8fb8de') {
  ctx.font = `900 ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size / 5;
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.strokeText(str, W / 2, y);
  const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
  g.addColorStop(0, c0);
  g.addColorStop(0.55, c1);
  g.addColorStop(1, c0);
  ctx.fillStyle = g;
  ctx.fillText(str, W / 2, y);
}

function blink(t, rate = 2.5) {
  return Math.sin(t * rate * Math.PI) > -0.3;
}

function continuePrompt(ctx, t, y, label) {
  if (blink(t)) text(ctx, label, W / 2, y, 15, '#ffe36b', 'center');
}

export function drawTitle(ctx, t, highScore, touch) {
  dim(ctx, 0.35);

  // เครื่องบินลำใหญ่ลอยเด่นกลางจอ
  ctx.save();
  ctx.translate(W / 2, 330 + Math.sin(t * 1.6) * 8);
  ctx.scale(2.6, 2.6);
  drawPlayer(ctx, 0, 0, Math.sin(t * 0.8) * 0.25, t, false, false);
  ctx.restore();

  bigTitle(ctx, 'AIRFORCE', 118, 58);
  bigTitle(ctx, 'STRIKE', 172, 52, '#ffe9a8', '#ff9a3a');
  text(ctx, 'ปฏิบัติการเหยี่ยวเหล็ก — เกมยิงเครื่องบินกองทัพอากาศ', W / 2, 212, 13, '#cfe6ff', 'center', '600');

  continuePrompt(ctx, t, 448, touch ? 'แตะจอเพื่อเริ่มเกม' : 'กด ENTER / SPACE เพื่อเริ่มเกม');

  panel(ctx, 60, 480, W - 120, 170);
  const rows = [
    ['WASD / ลูกศร', 'บิน 8 ทิศ'],
    ['SPACE (กดค้าง)', 'ยิง'],
    ['B', 'ระเบิดพิเศษ (ล้างกระสุนทั้งจอ)'],
    ['P / ESC', 'หยุดชั่วคราว'],
    ['M', 'เปิด/ปิดเสียง'],
    ['มือถือ', 'ลากนิ้วเพื่อบิน • ยิงอัตโนมัติ'],
  ];
  rows.forEach(([k, v], i) => {
    const y = 503 + i * 24;
    text(ctx, k, 160, y, 12, '#ffcf6b', 'right');
    text(ctx, v, 175, y, 12, '#e6f2ff', 'left', '600');
  });

  text(ctx, `HI-SCORE  ${pad(highScore)}`, W / 2, 680, 15, '#ffcf6b', 'center');
}

export function drawStageIntro(ctx, number, name, progress) {
  // ป้ายชื่อด่าน: fade in → ค้าง → fade out
  const a = progress < 0.2 ? progress / 0.2 : progress > 0.8 ? (1 - progress) / 0.2 : 1;
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, H / 2 - 60, W, 120);
  ctx.fillStyle = 'rgba(255,207,107,0.9)';
  ctx.fillRect(0, H / 2 - 60, W, 2);
  ctx.fillRect(0, H / 2 + 58, W, 2);
  bigTitle(ctx, `STAGE ${number}`, H / 2 - 18, 44, '#ffffff', '#ffcf6b');
  text(ctx, name, W / 2, H / 2 + 30, 18, '#cfe6ff', 'center');
  ctx.restore();
}

export function drawBossWarning(ctx, t, bossName) {
  const on = Math.floor(t * 4) % 2 === 0;
  ctx.save();
  ctx.fillStyle = `rgba(255,0,0,${0.12 + Math.sin(t * 8) * 0.06})`;
  ctx.fillRect(0, 0, W, H);

  // แถบลายเตือนเลื่อน
  const y0 = H / 2 - 70;
  const y1 = H / 2 + 50;
  for (const y of [y0, y1]) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y, W, 20);
    ctx.clip();
    ctx.fillStyle = '#1a0000';
    ctx.fillRect(0, y, W, 20);
    ctx.fillStyle = '#ff2a2a';
    const off = (t * 80) % 40;
    for (let x = -40 + off; x < W + 40; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 20, y);
      ctx.lineTo(x, y + 20);
      ctx.lineTo(x - 20, y + 20);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  if (on) bigTitle(ctx, 'WARNING', H / 2 - 10, 54, '#ffffff', '#ff3a3a');
  text(ctx, `${bossName} APPROACHING`, W / 2, H / 2 + 32, 15, '#ffd0d0', 'center');
  ctx.restore();
}

export function drawPause(ctx, t, touch) {
  dim(ctx, 0.6);
  bigTitle(ctx, 'PAUSED', H / 2 - 60, 52);
  continuePrompt(ctx, t, H / 2 + 5, touch ? 'แตะจอเพื่อเล่นต่อ' : 'กด P / ESC เพื่อเล่นต่อ');
  text(ctx, 'Q — กลับหน้าแรก     M — เปิด/ปิดเสียง', W / 2, H / 2 + 45, 13, '#cfe6ff', 'center', '600');
}

function statRows(ctx, rows, y0) {
  rows.forEach(([label, value, color], i) => {
    const y = y0 + i * 32;
    text(ctx, label, 100, y, 15, '#9fc6e8', 'left');
    text(ctx, value, W - 100, y, 18, color || '#ffffff', 'right');
  });
}

export function drawStageClear(ctx, t, info, touch) {
  dim(ctx, 0.5);
  bigTitle(ctx, `STAGE ${info.stage}`, 190, 46, '#ffffff', '#ffcf6b');
  bigTitle(ctx, 'CLEAR!', 245, 56, '#fff6c0', '#ffb347');
  panel(ctx, 70, 290, W - 140, 190);
  statRows(ctx, [
    ['ศัตรูที่ทำลาย', `${info.kills}`],
    ['คอมโบสูงสุด', `${info.bestCombo}`],
    ['โบนัสด่าน', `+${info.bonus}`, '#7cff8a'],
    ['คะแนนรวม', pad(info.score), '#ffcf6b'],
  ], 325);
  if (info.ready) continuePrompt(ctx, t, 530, touch ? 'แตะจอเพื่อไปด่านถัดไป' : 'กด ENTER เพื่อไปด่านถัดไป');
}

export function drawGameOver(ctx, t, info, touch) {
  dim(ctx, 0.65);
  bigTitle(ctx, 'GAME OVER', 210, 54, '#ffffff', '#ff5a5a');
  panel(ctx, 70, 270, W - 140, 160);
  statRows(ctx, [
    ['ด่านที่ไปถึง', `${info.stage}`],
    ['คะแนน', pad(info.score), '#ffffff'],
    ['HI-SCORE', pad(info.highScore), '#ffcf6b'],
  ], 310);
  if (info.newHighScore && blink(t, 4)) text(ctx, 'NEW HIGH SCORE!', W / 2, 460, 22, '#ffe36b', 'center');
  if (info.ready) continuePrompt(ctx, t, 520, touch ? 'แตะจอเพื่อกลับหน้าแรก' : 'กด ENTER เพื่อกลับหน้าแรก');
}

export function drawVictory(ctx, t, info, touch) {
  dim(ctx, 0.55);
  bigTitle(ctx, 'MISSION', 170, 54, '#fff6c0', '#ffcf6b');
  bigTitle(ctx, 'COMPLETE', 228, 54, '#fff6c0', '#ffcf6b');
  text(ctx, 'ภารกิจสำเร็จ! น่านฟ้าปลอดภัยแล้ว', W / 2, 272, 15, '#cfe6ff', 'center');
  panel(ctx, 70, 300, W - 140, 160);
  statRows(ctx, [
    ['ศัตรูที่ทำลายทั้งหมด', `${info.totalKills}`],
    ['คะแนนสุดท้าย', pad(info.score), '#ffffff'],
    ['HI-SCORE', pad(info.highScore), '#ffcf6b'],
  ], 340);
  if (info.newHighScore && blink(t, 4)) text(ctx, 'NEW HIGH SCORE!', W / 2, 490, 22, '#ffe36b', 'center');
  if (info.ready) continuePrompt(ctx, t, 545, touch ? 'แตะจอเพื่อกลับหน้าแรก' : 'กด ENTER เพื่อกลับหน้าแรก');
}
