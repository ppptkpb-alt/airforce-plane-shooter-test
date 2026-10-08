import { CONFIG } from '../config.js';
import {
  drawPlayer, drawPlayerBullet, drawMissile, drawEnemyBullet, drawMuzzleFlash, drawEnemy, drawBoss, drawPowerup,
} from './sprites.js';

const W = CONFIG.width;
const H = CONFIG.height;

// วาดทุกอย่างตามลำดับ layer:
// ทะเล/เกาะ/เมฆล่าง → ศัตรู/บอส → ไอเทม → กระสุนผู้เล่น → ผู้เล่น → particles → กระสุนศัตรู → เมฆบน → flash
export class Renderer {
  constructor(screen) {
    this.screen = screen;
    this.ctx = screen.ctx;
  }

  // ใช้สีทะเลเป็นสีพื้น เพื่อไม่ให้เห็นขอบดำตอนจอสั่น
  clear(background) {
    this.ctx.fillStyle = background ? background.theme.seaTop : '#05101f';
    this.ctx.fillRect(0, 0, W, H);
  }

  drawWorld(world, background) {
    const ctx = this.ctx;
    const t = world.time;
    const fx = world.fx;

    ctx.save();
    if (fx) {
      const s = fx.shakeOffset();
      ctx.translate(s.x, s.y);
    }

    background.drawBack(ctx);
    fx?.drawBelow(ctx);

    if (world.boss) drawBoss(ctx, world.boss, t);
    for (const e of world.enemies) drawEnemy(ctx, e, t);
    for (const p of world.powerups) drawPowerup(ctx, p, t);

    for (const b of world.playerBullets.active) {
      if (b.homing) drawMissile(ctx, b, t);
      else drawPlayerBullet(ctx, b);
    }

    const p = world.player;
    if (p.visible) {
      drawPlayer(ctx, p.x, p.y, p.bank, t, p.flashTimer > 0, p.shield);
      if (p.muzzleTimer > 0) drawMuzzleFlash(ctx, p.x, p.y - 28, 10 + Math.random() * 3);
    }

    fx?.drawAbove(ctx);
    for (const b of world.enemyBullets.active) drawEnemyBullet(ctx, b);

    background.drawFront(ctx);
    ctx.restore();

    // ขอบจอแดงเมื่อโดนยิง
    if (world.damageFlash > 0) {
      const a = world.damageFlash / CONFIG.fx.damageFlashTime;
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
      g.addColorStop(0, 'rgba(255,0,0,0)');
      g.addColorStop(1, `rgba(255,30,30,${0.45 * a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    fx?.drawScreenFlash(ctx);
  }
}
