import { CONFIG } from '../config.js';

const H = CONFIG.height;
const W = CONFIG.width;
const DOWN = Math.PI / 2;

function angleTo(from, to) {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

function turnToward(current, target, maxTurn) {
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + Math.max(-maxTurn, Math.min(maxTurn, diff));
}

// ศัตรู 4 แบบ: fighter / zigzag / bomber / kamikaze
// opts (จาก wave config): vx, amplitude, phase, speedMul, noFire
export class Enemy {
  constructor(type, x, y, opts = {}, difficulty = { hp: 1, fireRate: 1, bulletSpeed: 1 }) {
    const C = CONFIG.enemies[type];
    this.type = type;
    this.cfg = C;
    this.x = x;
    this.y = y;
    this.baseX = x;
    this.vx = opts.vx || 0;
    this.speed = C.speed * (opts.speedMul || 1);
    this.amplitude = opts.amplitude ?? C.amplitude ?? 0;
    this.phase = opts.phase || 0;
    this.noFire = !!opts.noFire;
    this.r = C.radius;
    this.maxHp = Math.round(C.hp * difficulty.hp);
    this.hp = this.maxHp;
    this.difficulty = difficulty;
    this.fireTimer = (C.firstShotDelay || 1) + Math.random() * 0.6;
    this.angle = DOWN;
    this.turretAngle = DOWN;
    this.t = 0;
    this.flashTimer = 0;
    this.seed = Math.random() * 10;
    this.alive = true;
    this.entered = false;
    this.locking = false;
    this.dashing = false;
    this.dashTime = 0;
    this.smokeTimer = 0;
  }

  hit(damage) {
    this.hp -= damage;
    this.flashTimer = CONFIG.fx.hitFlashTime;
    return this.hp <= 0;
  }

  update(dt, world) {
    this.t += dt;
    this.flashTimer = Math.max(0, this.flashTimer - dt);
    const player = world.player;

    switch (this.type) {
      case 'fighter':
        this.x += this.vx * dt;
        this.y += this.speed * dt;
        this.angle = Math.atan2(this.speed, this.vx);
        break;

      case 'zigzag': {
        // บินส่ายเป็น sine wave รอบแกน baseX
        const f = this.cfg.frequency;
        this.y += this.speed * dt;
        this.baseX += this.vx * dt;
        this.x = this.baseX + Math.sin(this.t * f + this.phase) * this.amplitude;
        const dx = Math.cos(this.t * f + this.phase) * this.amplitude * f + this.vx;
        this.angle = Math.atan2(this.speed, dx);
        break;
      }

      case 'bomber':
        this.x += this.vx * dt;
        this.y += this.speed * dt;
        this.turretAngle = player.alive ? angleTo(this, player) : DOWN;
        // ควันเมื่อเสียหายหนัก
        if (this.hp < this.maxHp * 0.5) {
          this.smokeTimer -= dt;
          if (this.smokeTimer <= 0) {
            world.fx?.smoke(this.x + (Math.random() - 0.5) * 50, this.y - 6);
            this.smokeTimer = 0.08;
          }
        }
        break;

      case 'kamikaze':
        this.updateKamikaze(dt, player);
        break;
    }

    if (this.y > -this.r) this.entered = true;
    if (!this.dashing) this.tryFire(dt, world);

    // หลุดจอแล้ว → ลบทิ้ง (ไม่ได้คะแนน)
    if (this.entered && (this.y > H + 80 || this.y < -120 || this.x < -100 || this.x > W + 100)) {
      this.alive = false;
    }
  }

  updateKamikaze(dt, player) {
    const C = this.cfg;
    if (!this.dashing) {
      // บินลงช้าๆ แล้วหันหน้าหาผู้เล่น (ล็อคเป้า)
      this.y += this.speed * dt;
      this.x += this.vx * dt;
      this.locking = this.t > C.lockDelay * 0.4;
      if (this.locking && player.alive) this.angle = turnToward(this.angle, angleTo(this, player), 6 * dt);
      if (this.t >= C.lockDelay) {
        this.dashing = true;
        this.locking = false;
        this.dashTime = 0;
      }
    } else {
      // พุ่ง: เลี้ยวตามผู้เล่นได้ช่วงสั้นๆ แล้วพุ่งตรง
      this.dashTime += dt;
      if (this.dashTime < 0.6 && player.alive) {
        this.angle = turnToward(this.angle, angleTo(this, player), C.turnRate * dt);
      }
      const speed = Math.min(C.dashSpeed, this.speed + (C.dashSpeed - this.speed) * this.dashTime * 3);
      this.x += Math.cos(this.angle) * speed * dt;
      this.y += Math.sin(this.angle) * speed * dt;
    }
  }

  tryFire(dt, world) {
    const C = this.cfg;
    if (this.noFire || !C.fireInterval) return;
    this.fireTimer -= dt * this.difficulty.fireRate;
    if (this.fireTimer > 0) return;
    this.fireTimer = C.fireInterval * (0.85 + Math.random() * 0.3);

    const player = world.player;
    // ยิงเฉพาะตอนอยู่ในจอส่วนบน และผู้เล่นยังมีชีวิต
    if (this.y < 10 || this.y > H * 0.72 || !player.alive) return;
    const speed = C.bulletSpeed * this.difficulty.bulletSpeed;

    switch (this.type) {
      case 'fighter':
        // ยิงตรงตามทิศที่หัวเครื่องชี้
        world.spawnEnemyBullet(this.x, this.y + 16, this.angle, speed, 'orange');
        world.audio?.play('enemyShoot');
        break;
      case 'zigzag':
        world.spawnEnemyBullet(this.x, this.y + 12, angleTo(this, player), speed, 'violet');
        world.audio?.play('enemyShoot');
        break;
      case 'bomber': {
        // กระสุนกระจายรูปพัด เล็งไปทางผู้เล่น
        const n = C.spreadCount;
        const base = this.turretAngle;
        for (let i = 0; i < n; i++) {
          const a = base - C.spreadArc / 2 + (C.spreadArc * i) / (n - 1);
          world.spawnEnemyBullet(this.x, this.y + 4, a, speed, 'red', true);
        }
        world.audio?.play('enemyShoot');
        break;
      }
    }
  }
}
