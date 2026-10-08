import { CONFIG } from '../config.js';

const PC = CONFIG.player;
const WC = CONFIG.weapons;
const move = { x: 0, y: 0 };

export class Player {
  constructor() {
    this.newGame();
  }

  newGame() {
    this.lives = PC.lives;
    this.bombs = PC.startBombs;
    this.weaponLevel = 1;
    this.shield = false;
    this.respawn(PC.respawnInvulnTime);
  }

  respawn(invuln) {
    this.x = PC.startX;
    this.y = PC.startY;
    this.hp = PC.maxHp;
    this.bank = 0;
    this.invuln = invuln;
    this.fireCooldown = 0;
    this.missileCooldown = 0;
    this.muzzleTimer = 0;
    this.flashTimer = 0;
    this.alive = true;
  }

  get r() {
    return PC.hitRadius;
  }

  get invulnerable() {
    return this.invuln > 0;
  }

  // ซ่อนในจังหวะกระพริบระหว่างอมตะ
  get visible() {
    if (!this.alive) return false;
    if (this.invuln <= 0) return true;
    return Math.floor(this.invuln / PC.blinkInterval) % 2 === 0;
  }

  update(dt, input, world, canFire = true) {
    if (!this.alive) return;

    // ----- เคลื่อนที่ 8 ทิศ (ปรับความเร็วแนวทแยงให้เท่ากัน)
    let mx = (input.down('right') ? 1 : 0) - (input.down('left') ? 1 : 0);
    let my = (input.down('down') ? 1 : 0) - (input.down('up') ? 1 : 0);
    if (mx !== 0 && my !== 0) {
      mx *= Math.SQRT1_2;
      my *= Math.SQRT1_2;
    }
    this.x += mx * PC.speed * dt;
    this.y += my * PC.speed * dt;

    // ----- touch: ลากนิ้วแบบ relative
    input.consumeTouchDelta(move);
    this.x += move.x * PC.touchSensitivity;
    this.y += move.y * PC.touchSensitivity;

    this.x = Math.max(PC.margin, Math.min(CONFIG.width - PC.margin, this.x));
    this.y = Math.max(PC.margin + 30, Math.min(CONFIG.height - PC.margin, this.y));

    // เอียงปีกตามทิศเลี้ยว
    const touchBank = dt > 0 ? Math.max(-1, Math.min(1, move.x / (PC.speed * dt))) : 0;
    const targetBank = mx !== 0 ? Math.sign(mx) : touchBank;
    this.bank += (targetBank - this.bank) * Math.min(1, PC.bankSpeed * dt);

    // ----- ยิง: กดค้าง Space หรือยิงอัตโนมัติในโหมด touch
    this.fireCooldown -= dt;
    this.missileCooldown -= dt;
    const firing = canFire && (input.down('fire') || input.touchMode);
    if (firing && this.fireCooldown <= 0) {
      this.fire(world);
      this.fireCooldown = WC.fireInterval;
    }
    if (firing && this.weaponLevel >= 5 && this.missileCooldown <= 0) {
      world.spawnMissile(this.x - 16, this.y, -Math.PI / 2 - 0.6);
      world.spawnMissile(this.x + 16, this.y, -Math.PI / 2 + 0.6);
      this.missileCooldown = WC.missileInterval;
    }

    this.invuln = Math.max(0, this.invuln - dt);
    this.muzzleTimer = Math.max(0, this.muzzleTimer - dt);
    this.flashTimer = Math.max(0, this.flashTimer - dt);
  }

  // รูปแบบกระสุนตามระดับปืน: 1 เดี่ยว → 2 คู่ → 3 กระจาย 3 → 4-5 กระจาย 5 (+missile ที่ระดับ 5)
  fire(world) {
    const y = this.y - 26;
    const shoot = (dx, angle) => {
      world.spawnPlayerBullet(this.x + dx, y, Math.sin(angle) * WC.bulletSpeed, -Math.cos(angle) * WC.bulletSpeed, WC.bulletDamage);
    };
    const off = WC.doubleOffset;
    switch (this.weaponLevel) {
      case 1:
        shoot(0, 0);
        break;
      case 2:
        shoot(-off / 2 - 1, 0);
        shoot(off / 2 + 1, 0);
        break;
      case 3:
        shoot(0, 0);
        shoot(-5, -WC.spread3Angle);
        shoot(5, WC.spread3Angle);
        break;
      default: {
        const a = WC.spread5Angle;
        shoot(0, 0);
        shoot(-7, -a);
        shoot(7, a);
        shoot(-10, -a * 2);
        shoot(10, a * 2);
        break;
      }
    }
    this.muzzleTimer = CONFIG.fx.muzzleFlashTime;
    world.audio?.play('shoot');
  }
}
