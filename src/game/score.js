import { CONFIG } from '../config.js';
import { loadHighScore, saveHighScore } from '../core/storage.js';

// คะแนน + combo: ยิงศัตรูต่อเนื่องภายใน combo.window วินาทีเพื่อเพิ่มตัวคูณ
export class Score {
  constructor() {
    this.highScore = loadHighScore();
    this.reset();
  }

  reset() {
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.newHighScore = false;
    this.cheated = false; // เคยเปิด God Mode ในเกมนี้ → ไม่นับ high score
  }

  get multiplier() {
    const C = CONFIG.combo;
    return Math.min(C.maxMultiplier, 1 + Math.floor(this.combo / C.killsPerLevel));
  }

  // คืนค่าคะแนนที่ได้จริง (หลังคูณ)
  addKill(base) {
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.comboTimer = CONFIG.combo.window;
    const points = base * this.multiplier;
    this.add(points);
    return points;
  }

  add(points) {
    this.score += points;
    if (!this.cheated && this.score > this.highScore) {
      this.highScore = this.score;
      this.newHighScore = true;
    }
  }

  breakCombo() {
    this.combo = 0;
    this.comboTimer = 0;
  }

  update(dt) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.breakCombo();
    }
  }

  commit() {
    if (this.newHighScore && !this.cheated) saveHighScore(this.highScore);
  }
}
