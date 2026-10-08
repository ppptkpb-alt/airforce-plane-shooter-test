import { CONFIG } from '../config.js';

const OFFSCREEN_MARGIN = 40;

// กระสุนใช้ class เดียวทั้งของผู้เล่น/ศัตรู/missile — จัดเก็บใน object pool
export class Bullet {
  constructor() {
    this.alive = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.r = 4;
    this.damage = 0;
    this.style = 'red';
    this.homing = false;
    this.life = Infinity;
    this.speed = 0;
  }

  init(x, y, vx, vy, r, damage, style = 'red') {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.r = r;
    this.damage = damage;
    this.style = style;
    this.homing = false;
    this.life = Infinity;
    this.speed = Math.hypot(vx, vy);
    return this;
  }

  initMissile(x, y, angle) {
    const W = CONFIG.weapons;
    this.init(x, y, Math.cos(angle) * W.missileSpeed, Math.sin(angle) * W.missileSpeed, W.missileRadius, W.missileDamage, 'missile');
    this.homing = true;
    this.life = W.missileLifetime;
    return this;
  }

  update(dt, world) {
    if (this.homing) this.steer(dt, world);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (
      this.life <= 0 ||
      this.x < -OFFSCREEN_MARGIN ||
      this.x > CONFIG.width + OFFSCREEN_MARGIN ||
      this.y < -OFFSCREEN_MARGIN ||
      this.y > CONFIG.height + OFFSCREEN_MARGIN
    ) {
      this.alive = false;
    }
  }

  // missile หันหาเป้าที่ใกล้ที่สุด โดยจำกัดอัตราการเลี้ยว
  steer(dt, world) {
    const target = world.findNearestTarget(this.x, this.y);
    if (!target) return;
    const desired = Math.atan2(target.y - this.y, target.x - this.x);
    let current = Math.atan2(this.vy, this.vx);
    let diff = desired - current;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const maxTurn = CONFIG.weapons.missileTurnRate * dt;
    current += Math.max(-maxTurn, Math.min(maxTurn, diff));
    this.vx = Math.cos(current) * this.speed;
    this.vy = Math.sin(current) * this.speed;
  }
}
