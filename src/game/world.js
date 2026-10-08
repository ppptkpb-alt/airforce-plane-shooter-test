import { CONFIG } from '../config.js';
import { Pool } from '../core/pool.js';
import { Bullet } from '../entities/bullet.js';
import { Player } from '../entities/player.js';
import { Enemy } from '../entities/enemy.js';
import { Powerup, randomPowerupKind } from '../entities/powerup.js';
import { Fx } from '../entities/particle.js';
import { Boss } from '../entities/boss.js';
import { Score } from './score.js';
import { handleCollisions } from './collision.js';

const DEFAULT_DIFFICULTY = { hp: 1, fireRate: 1, bulletSpeed: 1 };

// ที่เก็บ entities ทั้งหมดของเกม + กฎการเล่น (ดาเมจ, ตาย, เกิดใหม่, คะแนน)
export class World {
  constructor(audio) {
    this.audio = audio;
    this.fx = new Fx();
    this.player = new Player();
    this.score = new Score();
    this.playerBullets = new Pool(() => new Bullet(), CONFIG.pools.playerBullets);
    this.enemyBullets = new Pool(() => new Bullet(), CONFIG.pools.enemyBullets);
    this.enemies = [];
    this.powerups = [];
    this.boss = null;
    this.bossDefeated = false;
    this.difficulty = DEFAULT_DIFFICULTY;
    this.time = 0;
    this.kills = 0; // ต่อด่าน
    this.totalKills = 0;
    this.respawnTimer = 0;
    this.damageFlash = 0;
  }

  // เริ่มเกมใหม่ทั้งหมด
  newGame() {
    this.player.newGame();
    this.score.reset();
    this.totalKills = 0;
    this.clearStage();
  }

  // ล้างสิ่งของบนจอ (ใช้ตอนเริ่มด่าน)
  clearStage() {
    this.playerBullets.clear();
    this.enemyBullets.clear();
    this.enemies.length = 0;
    this.powerups.length = 0;
    this.boss = null;
    this.bossDefeated = false;
    this.magnet = false;
    this.kills = 0;
    this.respawnTimer = 0;
    this.damageFlash = 0;
    this.fx.clear();
  }

  get gameOver() {
    return !this.player.alive && this.player.lives <= 0 && this.respawnTimer <= 0;
  }

  // ---------------------------------------------------------------- spawn

  spawnPlayerBullet(x, y, vx, vy, damage) {
    this.playerBullets.acquire().init(x, y, vx, vy, CONFIG.weapons.bulletRadius, damage, 'player');
  }

  spawnMissile(x, y, angle) {
    this.playerBullets.acquire().initMissile(x, y, angle);
  }

  spawnEnemyBullet(x, y, angle, speed, style = 'red', big = false) {
    const r = big ? CONFIG.enemyBullet.bigRadius : CONFIG.enemyBullet.radius;
    this.enemyBullets
      .acquire()
      .init(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, r, CONFIG.damage.enemyBullet, style);
  }

  spawnEnemy(type, x, y, opts) {
    const e = new Enemy(type, x, y, opts, this.difficulty);
    this.enemies.push(e);
    return e;
  }

  spawnBoss(def) {
    this.boss = new Boss(def, this.difficulty);
    this.bossDefeated = false;
    return this.boss;
  }

  findNearestTarget(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const e of this.enemies) {
      if (!e.alive || e.y < 0) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    if (this.boss && this.boss.targetable) {
      const d = (this.boss.x - x) ** 2 + (this.boss.y - y) ** 2;
      if (d < bestD) best = this.boss;
    }
    return best;
  }

  spawnPowerup(x, y, kind = randomPowerupKind()) {
    this.powerups.push(new Powerup(kind, x, y));
  }

  collectPowerup(pu) {
    pu.alive = false;
    const p = this.player;
    const PC = CONFIG.powerups;
    let label = '';
    let color = '#fff';
    switch (pu.kind) {
      case 'P':
        if (p.weaponLevel < CONFIG.weapons.maxLevel) {
          p.weaponLevel++;
          label = p.weaponLevel === CONFIG.weapons.maxLevel ? 'MAX POWER!' : 'POWER UP';
        } else {
          this.score.add(PC.maxedBonusScore);
          label = `+${PC.maxedBonusScore}`;
        }
        color = '#ffb347';
        break;
      case 'S':
        p.shield = true;
        label = 'SHIELD';
        color = '#6fe3ff';
        break;
      case 'B':
        p.bombs = Math.min(CONFIG.player.maxBombs, p.bombs + 1);
        label = 'BOMB +1';
        color = '#e07bff';
        break;
      case 'H':
        p.hp = Math.min(CONFIG.player.maxHp, p.hp + PC.healAmount);
        label = `HP +${PC.healAmount}`;
        color = '#7cff8a';
        break;
    }
    this.fx.pickup(pu.x, pu.y, '255,255,255');
    this.fx.floatText(p.x, p.y - 34, label, color, 15);
    this.audio?.play('powerup');
  }

  // ระเบิดพิเศษ: ล้างกระสุนศัตรูทั้งจอ + ดาเมจศัตรูทุกตัว
  useBomb() {
    const p = this.player;
    if (!p.alive || p.bombs <= 0) return false;
    p.bombs--;
    p.invuln = Math.max(p.invuln, CONFIG.bomb.invulnTime);

    let cleared = 0;
    for (const b of this.enemyBullets.active) {
      if (!b.alive) continue;
      b.alive = false;
      cleared++;
      if (cleared % 3 === 0) this.fx.sparks(b.x, b.y, 2, '#e9b8ff');
    }
    this.score.add(cleared * 10);

    for (const e of this.enemies) {
      if (e.alive && e.y > -e.r) this.damageEnemy(e, CONFIG.bomb.damage, e.x, e.y);
    }
    if (this.boss && this.boss.targetable) {
      this.damageBoss(CONFIG.bomb.damage * CONFIG.bomb.bossDamageRatio, this.boss.x, this.boss.y);
    }

    this.fx.bombWave(p.x, p.y);
    this.audio?.play('bomb');
    return true;
  }

  // ---------------------------------------------------------------- damage

  damageEnemy(e, damage, hx, hy) {
    if (!e.alive) return;
    if (e.hit(damage)) {
      this.killEnemy(e);
    } else {
      this.fx?.sparks(hx, hy, 4);
      this.audio?.play('hit');
    }
  }

  killEnemy(e) {
    e.alive = false;
    this.kills++;
    this.totalKills++;
    const points = this.score.addKill(e.cfg.score);
    const big = e.type === 'bomber';
    this.fx?.explosion(e.x, e.y, big ? 'large' : 'small');
    this.fx?.floatText(e.x, e.y - 10, `${points}`, big ? '#ffd36b' : '#ffffff');
    this.fx?.shake(big ? 12 : 3);
    this.audio?.play(big ? 'bigExplosion' : 'explosion');
    if (e.forcedDrop) this.spawnPowerup(e.x, e.y, e.forcedDrop);
    else if (Math.random() < e.cfg.dropChance) this.spawnPowerup(e.x, e.y);
  }

  damageBoss(damage, hx, hy) {
    const boss = this.boss;
    if (!boss || !boss.targetable) return;
    if (boss.hit(damage)) {
      const points = boss.scoreValue;
      this.score.add(points);
      this.fx.floatText(boss.x, boss.y + 60, `BOSS DESTROYED  +${points}`, '#ffd36b', 16);
      boss.startDying(this);
    } else {
      this.fx.sparks(hx, hy, 3);
      this.audio?.play('hit');
    }
  }

  hurtPlayer(damage) {
    const p = this.player;
    if (!p.alive || p.invulnerable) return;
    this.score.breakCombo();

    // โล่รับได้ 1 ครั้ง
    if (p.shield) {
      p.shield = false;
      p.invuln = CONFIG.player.invulnTime;
      this.fx?.shieldBreak(p.x, p.y);
      this.audio?.play('shieldBreak');
      return;
    }

    p.hp -= damage;
    p.flashTimer = 0.12;
    this.damageFlash = CONFIG.fx.damageFlashTime;
    this.fx?.shake(9);
    this.fx?.sparks(p.x, p.y, 10, '#9fe8ff');
    this.audio?.play('playerHit');

    if (p.hp <= 0) this.killPlayer();
    else p.invuln = CONFIG.player.invulnTime;
  }

  killPlayer() {
    const p = this.player;
    p.hp = 0;
    p.alive = false;
    p.lives--;
    p.shield = false;
    p.weaponLevel = Math.max(1, p.weaponLevel - CONFIG.weapons.levelsLostOnDeath);
    this.fx?.explosion(p.x, p.y, 'large');
    this.fx?.shake(CONFIG.fx.maxShake);
    this.audio?.play('bigExplosion');
    this.respawnTimer = 1.6;
  }

  // ---------------------------------------------------------------- update

  update(dt, input, canFire = true) {
    this.time += dt;
    const p = this.player;

    p.update(dt, input, this, canFire);
    if (canFire && input.pressed('bomb')) this.useBomb();

    // เกิดใหม่หลังตาย (ถ้ายังมีชีวิตเหลือ)
    if (!p.alive && this.respawnTimer > 0) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0 && p.lives > 0) {
        p.respawn(CONFIG.player.respawnInvulnTime);
        this.enemyBullets.clear();
      }
    }

    for (const b of this.playerBullets.active) b.update(dt, this);
    for (const b of this.enemyBullets.active) b.update(dt, this);
    for (const e of this.enemies) e.update(dt, this);
    const magnet = this.magnet && p.alive ? p : null;
    for (const pu of this.powerups) pu.update(dt, magnet);
    if (this.boss) {
      this.boss.update(dt, this);
      if (this.boss.state === 'dead') {
        this.boss = null;
        this.bossDefeated = true;
      }
    }

    handleCollisions(this);

    this.playerBullets.sweep();
    this.enemyBullets.sweep();
    if (this.enemies.some((e) => !e.alive)) this.enemies = this.enemies.filter((e) => e.alive);
    if (this.powerups.some((p) => !p.alive)) this.powerups = this.powerups.filter((p) => p.alive);

    this.fx.update(dt);
    this.score.update(dt);
    this.damageFlash = Math.max(0, this.damageFlash - dt);
  }
}
