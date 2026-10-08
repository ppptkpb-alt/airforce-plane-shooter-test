// วาดกราฟิกทั้งหมดด้วย Canvas API (ไม่มีไฟล์ภาพ)
// เครื่องบินทุกลำวาดในพิกัด "หันหัวขึ้น" ที่จุด (0,0) แล้ว rotate ตามทิศทาง
// เมื่อ flash = true จะใช้ palette สีขาว (hit flash)

const TAU = Math.PI * 2;

const FLASH = {
  body: '#ffffff', dark: '#f4f4f4', wing: '#ffffff', wingDark: '#eeeeee',
  canopy: '#ffffff', accent: '#ffffff', glass: '#ffffff', light: '#ffffff', stripe: '#ffffff',
};

const PLAYER = {
  body: '#d3dde8', dark: '#56697d', wing: '#8ea5bb', wingDark: '#4a5f74',
  canopy: '#5fe3ff', accent: '#e0383e', light: '#f4f8fc', stripe: '#2b4a8a',
};

const ENEMY_PAL = {
  fighter: { body: '#6c7a41', dark: '#3a4424', wing: '#7b8b4a', wingDark: '#4b5730', canopy: '#a8d8ff', accent: '#c0392b', light: '#a3b06a' },
  zigzag: { body: '#6f5390', dark: '#3e2c55', wing: '#8a6aa6', wingDark: '#4f3a6b', canopy: '#ff6b8a', accent: '#ffcf3a', light: '#b399cc' },
  bomber: { body: '#56636c', dark: '#2d363d', wing: '#64737d', wingDark: '#3c474f', glass: '#a9d8ff', accent: '#c0392b', light: '#8b9aa4' },
  kamikaze: { body: '#bd3a2f', dark: '#6e1b17', wing: '#de5246', wingDark: '#8e2a22', canopy: '#2a1414', accent: '#ffd23f', light: '#ff8a7a' },
};

const BOSS_PAL = [
  { body: '#5a6844', dark: '#2f3822', wing: '#6c7c50', wingDark: '#3d4a2b', glass: '#9fe0ff', accent: '#d8402f', light: '#9aa878', core: '#ff5a3a' },
  { body: '#4a5d75', dark: '#222c3a', wing: '#5b7089', wingDark: '#2f3d50', glass: '#7cf3ff', accent: '#ffb03a', light: '#8aa2bd', core: '#3ad8ff' },
  { body: '#6b2f35', dark: '#2e1216', wing: '#83404a', wingDark: '#4a1d23', glass: '#ffd36b', accent: '#ffcf3a', light: '#b8656f', core: '#ff3af0' },
  { body: '#8e9daa', dark: '#3a4652', wing: '#a9b8c4', wingDark: '#5c6b78', glass: '#7af0ff', accent: '#ffd83a', light: '#dfe8ef', core: '#7af0ff' },
];

// สายฟ้าซิกแซกจาก (x0,y0) ไป (x1,y1) — สุ่มใหม่ทุกเฟรม
function lightning(ctx, x0, y0, x1, y1, segments) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  for (let i = 1; i < segments; i++) {
    const k = i / segments;
    ctx.lineTo(x0 + (x1 - x0) * k + (Math.random() - 0.5) * 14, y0 + (y1 - y0) * k + (Math.random() - 0.5) * 14);
  }
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = 'rgba(122,240,255,0.35)';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function pal(base, flash) {
  return flash ? FLASH : base;
}

// วาด path ด้านขวาแล้ว mirror ไปด้านซ้าย
function mirrored(ctx, buildPath, fill, stroke) {
  for (let s = -1; s <= 1; s += 2) {
    ctx.save();
    ctx.scale(s, 1);
    ctx.beginPath();
    buildPath(ctx);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }
}

function hGrad(ctx, x0, x1, c0, c1, c2) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, c0);
  g.addColorStop(0.5, c1);
  g.addColorStop(1, c2);
  return g;
}

function ellipse(ctx, x, y, rx, ry, fill) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
}

function circle(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
}

// ไฟไอพ่น: ทิศชี้ลง (+y) ในพิกัดเครื่องบิน
export function drawFlame(ctx, x, y, width, length, time, hue = 'orange') {
  const flick = length * (0.85 + Math.sin(time * 60 + x) * 0.1 + Math.random() * 0.12);
  const g = ctx.createLinearGradient(x, y, x, y + flick);
  if (hue === 'blue') {
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.3, 'rgba(120,200,255,0.9)');
    g.addColorStop(1, 'rgba(40,80,255,0)');
  } else {
    g.addColorStop(0, 'rgba(255,255,230,0.95)');
    g.addColorStop(0.3, 'rgba(255,200,60,0.9)');
    g.addColorStop(0.7, 'rgba(255,90,20,0.6)');
    g.addColorStop(1, 'rgba(255,40,0,0)');
  }
  ctx.beginPath();
  ctx.moveTo(x - width, y);
  ctx.quadraticCurveTo(x - width * 0.6, y + flick * 0.5, x, y + flick);
  ctx.quadraticCurveTo(x + width * 0.6, y + flick * 0.5, x + width, y);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
}

// ใบพัดหมุน มองจากด้านบน
function drawProp(ctx, x, y, span, time, speed = 50) {
  ellipse(ctx, x, y, span, 1.6, 'rgba(230,230,230,0.28)');
  const w = Math.abs(Math.sin(time * speed)) * span;
  ctx.fillStyle = 'rgba(40,40,40,0.8)';
  ctx.fillRect(x - w, y - 0.8, w * 2, 1.6);
}

// เครื่องหมายวงกลมแบบกองทัพอากาศไทย (แดง-ขาว-น้ำเงิน)
function roundel(ctx, x, y, r, flash) {
  circle(ctx, x, y, r, flash ? '#fff' : '#d8343b');
  circle(ctx, x, y, r * 0.66, '#ffffff');
  circle(ctx, x, y, r * 0.36, flash ? '#fff' : '#23408e');
}

// ---------------------------------------------------------------- Player

export function drawPlayer(ctx, x, y, bank, time, flash, shielded) {
  ctx.save();
  ctx.translate(x, y);

  drawFlame(ctx, -3.6, 23, 3, 13, time, 'blue');
  drawFlame(ctx, 3.6, 23, 3, 13, time, 'blue');

  ctx.scale(1 - Math.abs(bank) * 0.22, 1);
  const P = pal(PLAYER, flash);

  // ปีกหลัก (delta)
  mirrored(ctx, (c) => {
    c.moveTo(3, -9);
    c.lineTo(25, 9);
    c.lineTo(25, 15);
    c.lineTo(5, 13);
    c.closePath();
  }, hGrad(ctx, 0, 25, P.wing, P.wing, P.wingDark), P.dark);
  // strake ข้างช่องรับอากาศ
  mirrored(ctx, (c) => {
    c.moveTo(4, -18);
    c.lineTo(8, -5);
    c.lineTo(4, -3);
    c.closePath();
  }, P.wingDark);
  // แพนหางระดับ
  mirrored(ctx, (c) => {
    c.moveTo(3, 13);
    c.lineTo(13, 21);
    c.lineTo(13, 24);
    c.lineTo(3, 22);
    c.closePath();
  }, P.wingDark, P.dark);

  // ลำตัว
  ctx.beginPath();
  ctx.moveTo(0, -27);
  ctx.bezierCurveTo(4, -23, 6, -15, 6, -4);
  ctx.lineTo(6, 16);
  ctx.lineTo(4.5, 22);
  ctx.lineTo(-4.5, 22);
  ctx.lineTo(-6, 16);
  ctx.lineTo(-6, -4);
  ctx.bezierCurveTo(-6, -15, -4, -23, 0, -27);
  ctx.closePath();
  ctx.fillStyle = hGrad(ctx, -6, 6, P.dark, P.light, P.dark);
  ctx.fill();

  // หางดิ่งคู่ (มองจากบนเป็นเส้นบาง)
  ctx.fillStyle = P.dark;
  ctx.fillRect(-5.5, 10, 1.6, 12);
  ctx.fillRect(3.9, 10, 1.6, 12);

  // ท่อไอเสีย
  ctx.fillStyle = flash ? '#fff' : '#2a2f36';
  ctx.fillRect(-5.4, 21, 3.6, 3);
  ctx.fillRect(1.8, 21, 3.6, 3);

  // ปลายจมูก + เส้นแบ่ง panel
  ctx.beginPath();
  ctx.moveTo(0, -27);
  ctx.lineTo(1.6, -23);
  ctx.lineTo(-1.6, -23);
  ctx.closePath();
  ctx.fillStyle = P.dark;
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,55,70,0.5)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, -1);
  ctx.lineTo(0, 18);
  ctx.stroke();

  // canopy
  const cg = ctx.createLinearGradient(-3, -18, 3, -4);
  cg.addColorStop(0, flash ? '#fff' : '#d8fbff');
  cg.addColorStop(0.4, P.canopy);
  cg.addColorStop(1, flash ? '#fff' : '#1a5d80');
  ellipse(ctx, 0, -11, 3.2, 7.5, cg);

  // แถบสีที่ปีก + roundel
  mirrored(ctx, (c) => {
    c.moveTo(19, 8);
    c.lineTo(25, 13);
    c.lineTo(25, 15);
    c.lineTo(19, 10.5);
    c.closePath();
  }, P.stripe);
  roundel(ctx, 14, 8, 3.6, flash);
  roundel(ctx, -14, 8, 3.6, flash);

  ctx.restore();

  if (shielded) drawShield(ctx, x, y, time);
}

export function drawShield(ctx, x, y, time) {
  const r = 32 + Math.sin(time * 6) * 1.5;
  const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r);
  g.addColorStop(0, 'rgba(80,220,255,0)');
  g.addColorStop(0.8, 'rgba(80,220,255,0.18)');
  g.addColorStop(1, 'rgba(160,240,255,0.55)');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = `rgba(190,250,255,${0.5 + Math.sin(time * 10) * 0.25})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r, time * 2, time * 2 + Math.PI * 1.2);
  ctx.stroke();
}

export function drawMuzzleFlash(ctx, x, y, size) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, size);
  g.addColorStop(0, 'rgba(255,255,240,1)');
  g.addColorStop(0.4, 'rgba(255,230,120,0.8)');
  g.addColorStop(1, 'rgba(255,160,40,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, TAU);
  ctx.fill();
}

// ---------------------------------------------------------------- Enemies

function drawFighter(ctx, e, time, P) {
  mirrored(ctx, (c) => {
    c.moveTo(3, -5);
    c.lineTo(19, -2);
    c.quadraticCurveTo(22, 1, 19, 4);
    c.lineTo(3, 6);
    c.closePath();
  }, hGrad(ctx, 0, 21, P.wing, P.wing, P.wingDark), P.dark);
  mirrored(ctx, (c) => {
    c.moveTo(2, 12);
    c.lineTo(9, 14);
    c.lineTo(9, 18);
    c.lineTo(2, 18);
    c.closePath();
  }, P.wingDark, P.dark);

  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.bezierCurveTo(4, -18, 5, -10, 5, -2);
  ctx.lineTo(2.5, 19);
  ctx.lineTo(-2.5, 19);
  ctx.lineTo(-5, -2);
  ctx.bezierCurveTo(-5, -10, -4, -18, 0, -18);
  ctx.closePath();
  ctx.fillStyle = hGrad(ctx, -5, 5, P.dark, P.light, P.dark);
  ctx.fill();

  circle(ctx, 0, -16, 4.2, P.dark);
  ellipse(ctx, 0, -5, 2.4, 4.2, P.canopy);
  circle(ctx, 12, 1, 2.8, P.accent);
  circle(ctx, -12, 1, 2.8, P.accent);
  drawProp(ctx, 0, -20, 10, time + e.seed);
}

function drawZigzag(ctx, e, time, P) {
  drawFlame(ctx, 0, 15, 2.6, 9, time);
  mirrored(ctx, (c) => {
    c.moveTo(2, -4);
    c.lineTo(18, 9);
    c.lineTo(16, 13);
    c.lineTo(3, 9);
    c.closePath();
  }, hGrad(ctx, 0, 18, P.wing, P.wing, P.wingDark), P.dark);
  mirrored(ctx, (c) => {
    c.moveTo(2, 9);
    c.lineTo(8, 17);
    c.lineTo(2, 15);
    c.closePath();
  }, P.wingDark);
  mirrored(ctx, (c) => {
    c.moveTo(9, 4);
    c.lineTo(15, 9);
    c.lineTo(14, 10.5);
    c.lineTo(8, 6);
    c.closePath();
  }, P.accent);

  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(4, -8);
  ctx.lineTo(4, 14);
  ctx.lineTo(-4, 14);
  ctx.lineTo(-4, -8);
  ctx.closePath();
  ctx.fillStyle = hGrad(ctx, -4, 4, P.dark, P.light, P.dark);
  ctx.fill();
  ellipse(ctx, 0, -7, 2, 4.5, P.canopy);
}

function drawBomber(ctx, e, time, P) {
  // ปีกยาวตรง
  mirrored(ctx, (c) => {
    c.moveTo(5, -9);
    c.lineTo(50, -3);
    c.quadraticCurveTo(53, 1, 50, 5);
    c.lineTo(5, 8);
    c.closePath();
  }, hGrad(ctx, 0, 52, P.wing, P.wing, P.wingDark), P.dark);
  // เครื่องยนต์ 4 ตัว
  for (const ex of [-34, -18, 18, 34]) {
    ellipse(ctx, ex, -9, 4.2, 10, hGrad(ctx, ex - 4, ex + 4, P.dark, P.light, P.dark));
    circle(ctx, ex, -18, 3, P.dark);
    drawProp(ctx, ex, -20, 9, time + ex * 0.1 + e.seed, 45);
  }
  // แพนหาง
  mirrored(ctx, (c) => {
    c.moveTo(3, 24);
    c.lineTo(20, 29);
    c.lineTo(20, 34);
    c.lineTo(3, 33);
    c.closePath();
  }, P.wingDark, P.dark);
  // ลำตัว
  ctx.beginPath();
  ctx.moveTo(0, -36);
  ctx.bezierCurveTo(7, -35, 8, -25, 8, -10);
  ctx.lineTo(7, 26);
  ctx.lineTo(3, 35);
  ctx.lineTo(-3, 35);
  ctx.lineTo(-7, 26);
  ctx.lineTo(-8, -10);
  ctx.bezierCurveTo(-8, -25, -7, -35, 0, -36);
  ctx.closePath();
  ctx.fillStyle = hGrad(ctx, -8, 8, P.dark, P.light, P.dark);
  ctx.fill();
  ellipse(ctx, 0, -30, 4, 5, P.glass);
  // ป้อมปืน หมุนตามเป้า
  circle(ctx, 0, -4, 5.5, P.dark);
  ctx.save();
  ctx.translate(0, -4);
  ctx.rotate(e.turretAngle || 0);
  ctx.fillStyle = P.dark;
  ctx.fillRect(-1.2, -11, 2.4, 9);
  ctx.restore();
  circle(ctx, 0, -4, 3, P.light);
  circle(ctx, 40, 1, 3.6, P.accent);
  circle(ctx, -40, 1, 3.6, P.accent);
}

function drawKamikaze(ctx, e, time, P) {
  drawFlame(ctx, 0, 12, 4, e.dashing ? 22 : 9, time);
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(13, 10);
  ctx.lineTo(4, 8);
  ctx.lineTo(0, 14);
  ctx.lineTo(-4, 8);
  ctx.lineTo(-13, 10);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -18, 0, 14);
  g.addColorStop(0, P.light);
  g.addColorStop(0.5, P.body);
  g.addColorStop(1, P.dark);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = P.dark;
  ctx.lineWidth = 1;
  ctx.stroke();
  // ลายเชฟรอน
  ctx.strokeStyle = P.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-8, 4);
  ctx.lineTo(0, -6);
  ctx.lineTo(8, 4);
  ctx.stroke();
  ellipse(ctx, 0, -4, 2, 4, P.canopy);
  // ไฟเตือนตอนล็อคเป้า
  if (e.locking && Math.floor(time * 16) % 2 === 0) circle(ctx, 0, -10, 2.2, '#ffef5a');
}

const ENEMY_DRAW = {
  fighter: drawFighter,
  zigzag: drawZigzag,
  bomber: drawBomber,
  kamikaze: drawKamikaze,
};

export function drawEnemy(ctx, e, time) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle + Math.PI / 2); // angle 0 = ไปทางขวา; sprite หันขึ้น
  const P = pal(ENEMY_PAL[e.type], e.flashTimer > 0);
  ENEMY_DRAW[e.type](ctx, e, time, P);
  ctx.restore();
}

// ---------------------------------------------------------------- Boss

export function drawBoss(ctx, b, time) {
  const base = BOSS_PAL[b.variant % BOSS_PAL.length];
  const P = pal(base, b.flashTimer > 0);
  const heavy = b.variant === 3; // THUNDER COLOSSUS: ปีกกว้าง, 8 เครื่องยนต์, canard, สายฟ้า
  const swept = b.variant === 1 ? 14 : heavy ? 10 : 0;
  const span = heavy ? 124 : 102;

  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(Math.PI); // หันหัวลงหาผู้เล่น

  // ไฟเครื่องยนต์ (ทางด้านท้าย = +y ในพิกัดนี้)
  const engines = heavy
    ? [-96, -72, -48, -24, 24, 48, 72, 96]
    : b.variant === 2 ? [-84, -56, -28, 28, 56, 84] : [-70, -40, 40, 70];
  const flameHue = b.variant === 1 || heavy ? 'blue' : 'orange';
  for (const ex of engines) drawFlame(ctx, ex, 26 + Math.abs(ex) * 0.12, 5, 20, time, flameHue);

  // ปีกหลัก (flying wing)
  mirrored(ctx, (c) => {
    c.moveTo(0, -38);
    c.lineTo(span, 6 + swept);
    c.lineTo(span + 2, 20 + swept);
    c.lineTo(heavy ? 74 : 64, 26);
    c.lineTo(44, 18);
    c.lineTo(20, 32);
    c.lineTo(0, 30);
    c.closePath();
  }, hGrad(ctx, 0, span + 2, P.wing, P.wing, P.wingDark), P.dark);

  // canard ด้านหน้า (บอสด่าน 4)
  if (heavy) {
    mirrored(ctx, (c) => {
      c.moveTo(18, -44);
      c.lineTo(56, -36);
      c.lineTo(58, -28);
      c.lineTo(20, -26);
      c.closePath();
    }, P.wingDark, P.dark);
  }

  // ปีกเสริมด่าน 3
  if (b.variant === 2) {
    mirrored(ctx, (c) => {
      c.moveTo(80, -6);
      c.lineTo(112, -24);
      c.lineTo(116, -16);
      c.lineTo(96, 10);
      c.closePath();
    }, P.wingDark, P.dark);
  }

  // แผ่นเกราะ + เส้น panel
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 24, -20);
    ctx.lineTo(s * (span - 10), 12 + swept);
    ctx.moveTo(s * 30, 10);
    ctx.lineTo(s * 80, 18 + swept * 0.5);
    ctx.stroke();
  }

  // nacelle เครื่องยนต์
  for (const ex of engines) {
    const ey = 6 + Math.abs(ex) * 0.12;
    ellipse(ctx, ex, ey, 7, 18, hGrad(ctx, ex - 7, ex + 7, P.dark, P.light, P.dark));
    circle(ctx, ex, ey - 15, 4, '#1b1b1b');
  }

  // ลำตัวกลาง
  ctx.beginPath();
  ctx.moveTo(0, -64);
  ctx.bezierCurveTo(18, -60, 22, -32, 22, 0);
  ctx.lineTo(18, 40);
  ctx.lineTo(8, 52);
  ctx.lineTo(-8, 52);
  ctx.lineTo(-18, 40);
  ctx.lineTo(-22, 0);
  ctx.bezierCurveTo(-22, -32, -18, -60, 0, -64);
  ctx.closePath();
  ctx.fillStyle = hGrad(ctx, -22, 22, P.dark, P.light, P.dark);
  ctx.fill();
  ctx.strokeStyle = P.dark;
  ctx.stroke();

  // ห้องนักบิน
  const gg = ctx.createLinearGradient(0, -56, 0, -36);
  gg.addColorStop(0, b.flashTimer > 0 ? '#fff' : '#ffffff');
  gg.addColorStop(0.5, P.glass);
  gg.addColorStop(1, P.dark);
  ellipse(ctx, 0, -46, 7, 11, gg);

  // แกนพลังงานกลาง เต้นตาม phase
  const pulse = 0.5 + Math.sin(time * (4 + b.phase * 3)) * 0.5;
  const coreR = 9 + pulse * 3;
  const cg = ctx.createRadialGradient(0, 8, 0, 0, 8, coreR * 1.8);
  cg.addColorStop(0, '#ffffff');
  cg.addColorStop(0.35, base.core);
  cg.addColorStop(1, 'rgba(0,0,0,0)');
  circle(ctx, 0, 8, coreR * 1.8, cg);

  // เครื่องหมาย
  circle(ctx, 58, 14, 6, P.accent);
  circle(ctx, -58, 14, 6, P.accent);

  // สายฟ้าจาก core ไปปลายปีก — ถี่ขึ้นตาม phase
  if (heavy && b.state !== 'dying' && Math.random() < 0.25 + b.phase * 0.25) {
    for (const s of [-1, 1]) {
      if (Math.random() < 0.7) lightning(ctx, 0, 8, s * (span - 4), 14 + swept, 6);
    }
  }

  ctx.restore();

  // ป้อมปืน (วาดในพิกัดโลก เพื่อหมุนเล็งผู้เล่นได้ตรง)
  for (const t of b.turrets) {
    const tx = b.x + t.ox;
    const ty = b.y + t.oy;
    circle(ctx, tx, ty, 8, P.dark);
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(t.angle);
    ctx.fillStyle = P.dark;
    ctx.fillRect(0, -2, 15, 4);
    ctx.fillStyle = '#111';
    ctx.fillRect(13, -2, 3, 4);
    ctx.restore();
    circle(ctx, tx, ty, 5, P.light);
    circle(ctx, tx, ty, 2, base.core);
  }
}

// ---------------------------------------------------------------- Bullets (pre-rendered)

const spriteCache = new Map();
const SPRITE_RES = 3; // วาด sprite ที่ความละเอียด 3x แล้วย่อลง → คมบนจอ retina

function makeSprite(key, w, h, draw) {
  let s = spriteCache.get(key);
  if (s) return s;
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * SPRITE_RES);
  c.height = Math.ceil(h * SPRITE_RES);
  const g = c.getContext('2d');
  g.scale(SPRITE_RES, SPRITE_RES);
  draw(g, w, h);
  s = { canvas: c, w, h };
  spriteCache.set(key, s);
  return s;
}

function orbSprite(r, core, glow) {
  return makeSprite(`orb:${r}:${core}:${glow}`, r * 4, r * 4, (g, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r * 2);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.25, core);
    grad.addColorStop(0.5, glow);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.beginPath();
    g.arc(cx, cy, r * 0.55, 0, TAU);
    g.fillStyle = '#ffffff';
    g.fill();
  });
}

const ENEMY_BULLET_STYLES = {
  red: ['#ff5d73', 'rgba(255,40,90,0.45)'],
  orange: ['#ffae3a', 'rgba(255,110,20,0.45)'],
  violet: ['#c77dff', 'rgba(150,60,255,0.45)'],
  cyan: ['#6ff3ff', 'rgba(30,170,255,0.45)'],
};

export function drawEnemyBullet(ctx, b) {
  const st = ENEMY_BULLET_STYLES[b.style] || ENEMY_BULLET_STYLES.red;
  const s = orbSprite(b.r, st[0], st[1]);
  ctx.drawImage(s.canvas, b.x - s.w / 2, b.y - s.h / 2, s.w, s.h);
}

function playerBulletSprite() {
  return makeSprite('pbullet', 16, 32, (g, w, h) => {
    const cx = w / 2;
    const halo = g.createRadialGradient(cx, h * 0.35, 0, cx, h * 0.35, 9);
    halo.addColorStop(0, 'rgba(255,230,120,0.55)');
    halo.addColorStop(1, 'rgba(255,200,60,0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, w, h);
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,245,160,1)');
    grad.addColorStop(1, 'rgba(255,170,30,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(cx, h * 0.45, 3.2, 14, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(cx, h * 0.3, 1.6, 6, 0, 0, TAU);
    g.fill();
  });
}

export function drawPlayerBullet(ctx, b) {
  const s = playerBulletSprite();
  if (b.vx === 0) {
    ctx.drawImage(s.canvas, b.x - s.w / 2, b.y - s.h * 0.35, s.w, s.h);
    return;
  }
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2);
  ctx.drawImage(s.canvas, -s.w / 2, -s.h * 0.35, s.w, s.h);
  ctx.restore();
}

export function drawMissile(ctx, m, time) {
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.rotate(Math.atan2(m.vy, m.vx) + Math.PI / 2);
  drawFlame(ctx, 0, 6, 2.2, 10, time);
  ctx.fillStyle = '#e8eef4';
  ctx.fillRect(-1.8, -7, 3.6, 13);
  ctx.fillStyle = '#e0383e';
  ctx.beginPath();
  ctx.moveTo(-1.8, -7);
  ctx.lineTo(0, -11);
  ctx.lineTo(1.8, -7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#7d8b99';
  ctx.beginPath();
  ctx.moveTo(-1.8, 3);
  ctx.lineTo(-4.5, 7);
  ctx.lineTo(4.5, 7);
  ctx.lineTo(1.8, 3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- Power-ups

const POWERUP_STYLE = {
  P: { c0: '#ffd36b', c1: '#ff7a1a', ring: '#ffb347' },
  S: { c0: '#a6f6ff', c1: '#1aa6ff', ring: '#6fe3ff' },
  B: { c0: '#ffb0f0', c1: '#b02fd8', ring: '#e07bff' },
  H: { c0: '#b8ffb0', c1: '#21b34a', ring: '#7cff8a' },
};

export function drawPowerup(ctx, p, time) {
  const st = POWERUP_STYLE[p.kind];
  const r = p.r;
  // กระพริบเมื่อใกล้หมดเวลา
  if (p.life < 3 && Math.floor(time * 10) % 2 === 0) return;

  const pulse = 1 + Math.sin(time * 6 + p.seed) * 0.12;
  ctx.save();
  ctx.translate(p.x, p.y);

  const glow = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 2 * pulse);
  glow.addColorStop(0, st.ring);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.45;
  circle(ctx, 0, 0, r * 2 * pulse, glow);
  ctx.globalAlpha = 1;

  const body = ctx.createRadialGradient(-r * 0.35, -r * 0.35, 1, 0, 0, r);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.3, st.c0);
  body.addColorStop(1, st.c1);
  circle(ctx, 0, 0, r, body);

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.stroke();

  // วงแหวนหมุน
  ctx.strokeStyle = st.ring;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r + 5, time * 3, time * 3 + Math.PI * 0.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r + 5, time * 3 + Math.PI, time * 3 + Math.PI * 1.6);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 3;
  ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText(p.kind, 0, 1);
  ctx.fillText(p.kind, 0, 1);
  ctx.restore();
}
