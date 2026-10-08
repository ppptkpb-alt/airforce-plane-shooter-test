import { CONFIG } from '../config.js';

function overlap(a, b, ra, rb) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = ra + rb;
  return dx * dx + dy * dy < r * r;
}

// ตรวจการชนทั้งหมดแบบ circle-vs-circle
export function handleCollisions(world) {
  const { player, enemies, boss } = world;

  // กระสุนผู้เล่น → ศัตรู / บอส
  for (const b of world.playerBullets.active) {
    if (!b.alive) continue;
    for (const e of enemies) {
      if (e.alive && overlap(b, e, b.r, e.r)) {
        b.alive = false;
        world.damageEnemy(e, b.damage, b.x, b.y);
        break;
      }
    }
    if (b.alive && boss && boss.targetable && boss.hitTest(b.x, b.y, b.r)) {
      b.alive = false;
      world.damageBoss(b.damage, b.x, b.y);
    }
  }

  if (!player.alive) return;

  // ไอเทม (เก็บได้แม้ช่วงอมตะ)
  for (const p of world.powerups) {
    if (p.alive && overlap(p, player, p.r, CONFIG.player.pickupRadius)) world.collectPowerup(p);
  }

  if (player.invulnerable) return;

  // กระสุนศัตรู → ผู้เล่น
  for (const b of world.enemyBullets.active) {
    if (b.alive && overlap(b, player, b.r * 0.8, player.r)) {
      b.alive = false;
      world.hurtPlayer(b.damage);
      return; // ได้ i-frame แล้ว ไม่ต้องเช็คต่อ
    }
  }

  // ชนเครื่องบินศัตรู: ตัวเล็กระเบิดไปด้วย ส่วน bomber โดนดาเมจ
  for (const e of enemies) {
    if (e.alive && overlap(e, player, e.r * 0.75, player.r + 6)) {
      const dmg = e.type === 'kamikaze' ? CONFIG.damage.kamikaze : CONFIG.damage.contact;
      world.damageEnemy(e, e.type === 'bomber' ? 40 : e.hp, e.x, e.y);
      world.hurtPlayer(dmg);
      return;
    }
  }

  if (boss && boss.targetable && boss.hitTest(player.x, player.y, player.r + 4)) {
    world.hurtPlayer(CONFIG.damage.boss);
  }
}
