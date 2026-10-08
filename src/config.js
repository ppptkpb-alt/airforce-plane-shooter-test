// ค่าบาลานซ์ทั้งหมดของเกมรวมไว้ที่นี่ — ปรับตัวเลขได้โดยไม่ต้องแตะโค้ดส่วนอื่น
// หน่วย: ระยะทาง = pixel (บนจอตรรกะ 480x720), เวลา = วินาที, ความเร็ว = pixel/วินาที, มุม = radian

export const CONFIG = {
  // ขนาดจอตรรกะ (logical resolution) — canvas จริงจะถูก scale ตามจอ
  width: 480,
  height: 720,
  fixedStep: 1 / 60,
  maxFrameTime: 0.25,
  maxPixelRatio: 2,

  player: {
    speed: 300,
    hitRadius: 6, // hitbox เล็กกว่าตัวเครื่อง (สไตล์ shmup)
    pickupRadius: 28,
    maxHp: 100,
    lives: 3,
    invulnTime: 2, // อมตะหลังโดนยิง
    respawnInvulnTime: 3,
    blinkInterval: 0.08,
    startBombs: 2,
    maxBombs: 6,
    startX: 240,
    startY: 620,
    margin: 18,
    touchSensitivity: 1.25,
    bankSpeed: 8, // ความเร็วการเอียงปีกเมื่อเลี้ยว
  },

  weapons: {
    maxLevel: 5,
    fireInterval: 0.1,
    bulletSpeed: 820,
    bulletDamage: 10,
    bulletRadius: 4,
    doubleOffset: 9, // ระยะห่างกระสุนคู่
    spread3Angle: 0.16,
    spread5Angle: 0.13,
    missileInterval: 0.5,
    missileSpeed: 440,
    missileTurnRate: 7,
    missileDamage: 22,
    missileLifetime: 2.5,
    missileRadius: 5,
    levelsLostOnDeath: 1,
  },

  bomb: {
    damage: 150,
    invulnTime: 1.5,
    flashTime: 0.6,
    shake: 18,
    bossDamageRatio: 0.4, // บอสโดนระเบิดลดดาเมจ
  },

  damage: {
    enemyBullet: 20,
    contact: 30, // ชนเครื่องบินศัตรู
    kamikaze: 40,
    boss: 45, // ชนบอส
  },

  enemyBullet: {
    radius: 5,
    bigRadius: 8,
  },

  enemies: {
    fighter: {
      hp: 20,
      speed: 170,
      radius: 18,
      score: 100,
      fireInterval: 1.5,
      firstShotDelay: 0.6,
      bulletSpeed: 230,
      dropChance: 0.08,
    },
    zigzag: {
      hp: 16,
      speed: 125,
      radius: 16,
      amplitude: 90,
      frequency: 2.2,
      score: 150,
      fireInterval: 2.0,
      firstShotDelay: 0.9,
      bulletSpeed: 200,
      dropChance: 0.1,
    },
    bomber: {
      hp: 180,
      speed: 50,
      radius: 40,
      score: 700,
      fireInterval: 2.1,
      firstShotDelay: 1.2,
      bulletSpeed: 160,
      spreadCount: 7,
      spreadArc: 1.3,
      dropChance: 0.7,
    },
    kamikaze: {
      hp: 12,
      speed: 120,
      dashSpeed: 400,
      radius: 15,
      score: 220,
      lockDelay: 0.7, // บินลงมาก่อน แล้วล็อคเป้าพุ่ง
      turnRate: 2.2,
      dropChance: 0.08,
    },
  },

  boss: {
    radius: 72,
    entrySpeed: 70,
    targetY: 150,
    sweepSpeed: 0.6, // ความถี่การส่ายซ้ายขวา
    sweepRange: 140,
    phaseThresholds: [0.66, 0.33], // เปลี่ยน phase เมื่อ HP เหลือ <66% และ <33%
    phaseTransitionTime: 1.2, // หยุดยิงชั่วครู่ตอนเปลี่ยน phase
    // ค่า base ของ pattern — คูณด้วย difficulty ของแต่ละด่าน
    spread: { interval: 1.0, count: 11, arc: 1.6, speed: 190 },
    spiral: { interval: 0.075, arms: 3, rotSpeed: 2.4, speed: 165 },
    aimed: { burstInterval: 1.2, burstCount: 5, burstGap: 0.09, speed: 300, fan: 3, fanAngle: 0.14 },
    ringInPhase3: { interval: 2.2, count: 18, speed: 140 },
    // เฉพาะบอส variant 3: ม่านกระสุนเต็มแถวมีช่องลอด (phase 0) และเรียก kamikaze คุ้มกัน (phase 2)
    curtain: { interval: 2.6, count: 15, gap: 3, speed: 120, gapJitter: 2 },
    escorts: { interval: 6, firstDelay: 1.5 },
    dropsOnDeath: 4,
  },

  powerups: {
    radius: 14,
    fallSpeed: 70,
    swayAmp: 26,
    swayFreq: 2,
    lifetime: 14,
    magnetSpeed: 420,
    weights: { P: 4, S: 2, B: 2, H: 3 },
    healAmount: 35,
    maxedBonusScore: 1000,
  },

  combo: {
    window: 1.6, // ต้องยิงศัตรูตัวถัดไปภายในเวลานี้เพื่อรักษาคอมโบ
    killsPerLevel: 5,
    maxMultiplier: 8,
  },

  fx: {
    maxShake: 22,
    shakeDecay: 40,
    hitFlashTime: 0.07,
    muzzleFlashTime: 0.05,
    explosionSmall: 22,
    explosionLarge: 60,
    damageFlashTime: 0.25,
  },

  pools: {
    playerBullets: 200,
    enemyBullets: 600,
    particles: 900,
  },

  background: {
    seaSpeed: 35,
    islandSpeed: 55,
    cloudLowSpeed: 110,
    cloudHighSpeed: 200,
  },

  stage: {
    introTime: 2.5,
    bossWarningTime: 3,
    clearDelay: 2.5, // หน่วงก่อนขึ้น Stage Clear หลังบอสตาย
  },

  // ปุ่มบนจอสำหรับ touch (พิกัดตรรกะ)
  touch: {
    bombButton: { x: 420, y: 650, r: 36 },
    pauseButton: { x: 450, y: 92, r: 20 },
  },

  audio: {
    masterVolume: 0.35,
  },

  storageKey: 'airforce-shooter-highscore',
};
