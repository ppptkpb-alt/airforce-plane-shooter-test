import { CONFIG } from '../config.js';

const BC = CONFIG.boss;
const W = CONFIG.width;
const TAU = Math.PI * 2;

// วงกลม hitbox (พิกัดสัมพัทธ์กับจุดกลางบอส): ลำตัว + ปีก
const HITBOXES = [
  { x: 0, y: 10, r: 46 },
  { x: -55, y: -8, r: 26 },
  { x: 55, y: -8, r: 26 },
  { x: -90, y: -14, r: 16 },
  { x: 90, y: -14, r: 16 },
];
// variant 3 ปีกกว้างกว่า → เพิ่มวงที่ปลายปีก
const HITBOXES_WIDE = [...HITBOXES, { x: -118, y: -18, r: 14 }, { x: 118, y: -18, r: 14 }];

// บอสท้ายด่าน: 3 phase ตาม HP ที่เหลือ
//   phase 0 (100–66%): spread — กระสุนกระจายรูปพัดเล็งผู้เล่น
//   phase 1 (66–33%):  spiral — กระสุนหมุนเป็นเกลียว
//   phase 2 (<33%):    aimed  — ยิงชุดเล็งตรงจากป้อมปืน + วงแหวนกระสุน
// variant 3 เพิ่ม: phase 0 ม่านกระสุนมีช่องลอด, phase 1 เกลียว 4 แขน, phase 2 เรียก kamikaze คุ้มกัน
export class Boss {
  constructor(def, difficulty) {
    this.variant = def.variant;
    this.name = def.name;
    this.maxHp = def.hp;
    this.hp = def.hp;
    this.scoreValue = def.score;
    this.rate = difficulty.fireRate;
    this.speedMul = difficulty.bulletSpeed;
    this.x = W / 2;
    this.y = -130;
    this.r = BC.radius;
    this.state = 'enter'; // enter | fight | dying | dead
    this.phase = 0;
    this.t = 0;
    this.flashTimer = 0;
    this.transition = 0;
    this.fireTimer = 1.0;
    this.spiralAngle = 0;
    this.burstLeft = 0;
    this.burstTimer = 0;
    this.ringTimer = BC.ringInPhase3.interval;
    this.volley = 0;
    this.deathTimer = 0;
    this.deathBoomTimer = 0;
    this.curtainTimer = BC.curtain.interval;
    this.escortTimer = BC.escorts.firstDelay;
    this.hitboxes = this.variant >= 3 ? HITBOXES_WIDE : HITBOXES;

    this.turrets = [
      { ox: -34, oy: 20, angle: Math.PI / 2 },
      { ox: 34, oy: 20, angle: Math.PI / 2 },
      { ox: 0, oy: 44, angle: Math.PI / 2 },
    ];
    if (this.variant >= 2) {
      this.turrets.push({ ox: -78, oy: 2, angle: Math.PI / 2 }, { ox: 78, oy: 2, angle: Math.PI / 2 });
    }
    if (this.variant >= 3) {
      this.turrets.push({ ox: -110, oy: -12, angle: Math.PI / 2 }, { ox: 110, oy: -12, angle: Math.PI / 2 });
    }
  }

  get targetable() {
    return this.state === 'fight';
  }

  get showBar() {
    return this.state === 'enter' || this.state === 'fight';
  }

  hitTest(x, y, r) {
    for (const h of this.hitboxes) {
      const dx = x - (this.x + h.x);
      const dy = y - (this.y + h.y);
      const rr = r + h.r;
      if (dx * dx + dy * dy < rr * rr) return true;
    }
    return false;
  }

  hit(damage) {
    this.hp = Math.max(0, this.hp - damage);
    this.flashTimer = 0.05;
    return this.hp <= 0;
  }

  update(dt, world) {
    this.t += dt;
    this.flashTimer = Math.max(0, this.flashTimer - dt);
    const player = world.player;

    // ป้อมปืนหันหาผู้เล่นเสมอ
    for (const tr of this.turrets) {
      if (player.alive) tr.angle = Math.atan2(player.y - (this.y + tr.oy), player.x - (this.x + tr.ox));
    }

    switch (this.state) {
      case 'enter':
        this.y += BC.entrySpeed * dt;
        if (this.y >= BC.targetY) {
          this.y = BC.targetY;
          this.state = 'fight';
          this.t = 0;
        }
        break;
      case 'fight':
        this.updateFight(dt, world);
        break;
      case 'dying':
        this.updateDying(dt, world);
        break;
    }
  }

  updateFight(dt, world) {
    // ส่ายไปมา (phase สุดท้ายเร็วขึ้น)
    const sweep = BC.sweepSpeed * (this.phase === 2 ? 1.5 : 1);
    this.x = W / 2 + Math.sin(this.t * sweep) * BC.sweepRange;
    this.y = BC.targetY + Math.sin(this.t * 1.3) * 12;

    // เปลี่ยน phase ตาม HP
    const ratio = this.hp / this.maxHp;
    let phase = 0;
    if (ratio < BC.phaseThresholds[1]) phase = 2;
    else if (ratio < BC.phaseThresholds[0]) phase = 1;
    if (phase !== this.phase) {
      this.phase = phase;
      this.transition = BC.phaseTransitionTime;
      this.fireTimer = 0.3;
      this.burstLeft = 0;
      world.fx.explosion(this.x + (Math.random() - 0.5) * 140, this.y - 10, 'large');
      world.fx.flash(0.35, '255,120,80');
      world.fx.shake(14);
      world.audio?.play('bigExplosion');
    }

    if (this.transition > 0) {
      this.transition -= dt;
      return;
    }
    if (!world.player.alive) return;

    const dtFire = dt * this.rate;
    if (this.phase === 0) this.patternSpread(dtFire, world);
    else if (this.phase === 1) this.patternSpiral(dtFire, world);
    else this.patternAimed(dtFire, world);
    if (this.variant >= 3) {
      if (this.phase === 0) this.patternCurtain(dtFire, world);
      else if (this.phase === 2) this.summonEscorts(dt, world);
    }

    // ควันจากปีกเมื่อ HP ต่ำ
    if (ratio < 0.5 && Math.random() < dt * 12) {
      world.fx.smoke(this.x + (Math.random() - 0.5) * 160, this.y - 10);
    }
  }

  patternSpread(dt, world) {
    const P = BC.spread;
    this.fireTimer -= dt;
    if (this.fireTimer > 0) return;
    this.fireTimer = P.interval;
    const p = world.player;
    const ox = this.x;
    const oy = this.y + 50;
    const aim = Math.atan2(p.y - oy, p.x - ox);
    // สลับ offset ครึ่งช่องทุกชุด เพื่อไม่ให้มีจุดปลอดภัยถาวร
    const step = P.arc / (P.count - 1);
    const shift = this.volley++ % 2 ? step / 2 : 0;
    for (let i = 0; i < P.count; i++) {
      const a = aim - P.arc / 2 + step * i + shift;
      world.spawnEnemyBullet(ox, oy, a, P.speed * this.speedMul, 'orange', true);
    }
    world.audio?.play('enemyShoot');
  }

  patternSpiral(dt, world) {
    const P = BC.spiral;
    this.fireTimer -= dt;
    if (this.fireTimer > 0) return;
    this.fireTimer = P.interval;
    const ox = this.x;
    const oy = this.y - 8;
    this.spiralAngle += P.rotSpeed * P.interval;
    const arms = this.variant >= 3 ? P.arms + 1 : P.arms;
    for (let k = 0; k < arms; k++) {
      const a = this.spiralAngle + (k * TAU) / arms;
      world.spawnEnemyBullet(ox, oy, a, P.speed * this.speedMul, 'violet');
    }
    // ด่าน 2 ขึ้นไป: เพิ่มเกลียวหมุนสวนทาง
    if (this.variant >= 1 && this.volley++ % 3 === 0) {
      for (let k = 0; k < P.arms; k++) {
        const a = -this.spiralAngle * 1.3 + (k * TAU) / P.arms;
        world.spawnEnemyBullet(ox, oy, a, P.speed * 0.8 * this.speedMul, 'cyan');
      }
    }
  }

  patternAimed(dt, world) {
    const P = BC.aimed;
    const p = world.player;

    if (this.burstLeft > 0) {
      this.burstTimer -= dt;
      if (this.burstTimer <= 0) {
        this.burstTimer = P.burstGap;
        this.burstLeft--;
        for (const tr of this.turrets) {
          const tx = this.x + tr.ox;
          const ty = this.y + tr.oy;
          const aim = Math.atan2(p.y - ty, p.x - tx);
          for (let f = 0; f < P.fan; f++) {
            const a = aim + (f - (P.fan - 1) / 2) * P.fanAngle;
            world.spawnEnemyBullet(tx + Math.cos(tr.angle) * 14, ty + Math.sin(tr.angle) * 14, a, P.speed * this.speedMul, 'red');
          }
        }
        world.audio?.play('enemyShoot');
      }
    } else {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireTimer = P.burstInterval;
        this.burstLeft = P.burstCount;
        this.burstTimer = 0;
      }
    }

    // วงแหวนกระสุนรอบตัว
    const R = BC.ringInPhase3;
    this.ringTimer -= dt;
    if (this.ringTimer <= 0) {
      this.ringTimer = R.interval;
      const offset = Math.random() * TAU;
      for (let k = 0; k < R.count; k++) {
        world.spawnEnemyBullet(this.x, this.y, offset + (k * TAU) / R.count, R.speed * this.speedMul, 'cyan', true);
      }
    }
  }

  // ม่านกระสุนแถวแนวนอนเต็มจอ ตกตรงลงมา เว้นช่องลอดใกล้ๆ ตำแหน่งผู้เล่น
  patternCurtain(dt, world) {
    const P = BC.curtain;
    this.curtainTimer -= dt;
    if (this.curtainTimer > 0) return;
    this.curtainTimer = P.interval;
    const step = W / P.count;
    const playerSlot = Math.floor(world.player.x / step);
    const jitter = Math.round((Math.random() * 2 - 1) * P.gapJitter);
    const gapStart = Math.max(0, Math.min(P.count - P.gap, playerSlot - Math.floor(P.gap / 2) + jitter));
    const y = this.y + 30;
    for (let i = 0; i < P.count; i++) {
      if (i >= gapStart && i < gapStart + P.gap) continue;
      world.spawnEnemyBullet(step * (i + 0.5), y, Math.PI / 2, P.speed * this.speedMul, 'cyan', true);
    }
    world.audio?.play('enemyShoot');
  }

  // ปล่อย kamikaze คู่จากปลายปีก
  summonEscorts(dt, world) {
    this.escortTimer -= dt;
    if (this.escortTimer > 0) return;
    this.escortTimer = BC.escorts.interval;
    for (const s of [-1, 1]) {
      world.spawnEnemy('kamikaze', this.x + s * 110, this.y + 10);
      world.fx.explosion(this.x + s * 110, this.y + 10, 'small');
    }
  }

  startDying(world) {
    this.state = 'dying';
    this.deathTimer = 2.6;
    this.deathBoomTimer = 0;
    world.enemyBullets.clear();
    world.fx.flash(0.6);
    world.audio?.play('bigExplosion');
  }

  updateDying(dt, world) {
    this.deathTimer -= dt;
    this.y += 18 * dt;
    this.x += Math.sin(this.t * 30) * 0.8; // สั่นๆ
    this.flashTimer = Math.floor(this.t * 20) % 2 === 0 ? 0.02 : 0;

    this.deathBoomTimer -= dt;
    if (this.deathBoomTimer <= 0) {
      this.deathBoomTimer = 0.13;
      world.fx.explosion(this.x + (Math.random() - 0.5) * 190, this.y + (Math.random() - 0.5) * 80, Math.random() < 0.35 ? 'large' : 'small');
      world.fx.shake(6);
      world.audio?.play('explosion');
    }

    if (this.deathTimer <= 0) {
      this.state = 'dead';
      world.fx.chainExplosion(this.x, this.y, 110, 14, 0.5);
      world.fx.flash(1);
      world.fx.shake(CONFIG.fx.maxShake);
      world.audio?.play('bigExplosion');
      const kinds = ['P', 'H', 'B', 'S'];
      for (let i = 0; i < BC.dropsOnDeath; i++) {
        world.spawnPowerup(this.x - 60 + i * 40, this.y, kinds[i % kinds.length]);
      }
    }
  }
}
