import { CONFIG } from '../config.js';

// high score ใน localStorage (ห่อ try/catch เผื่อ private mode / storage ถูกบล็อก)
export function loadHighScore() {
  try {
    return parseInt(localStorage.getItem(CONFIG.storageKey), 10) || 0;
  } catch {
    return 0;
  }
}

export function saveHighScore(score) {
  try {
    localStorage.setItem(CONFIG.storageKey, String(score));
  } catch {
    // storage ใช้ไม่ได้ — ข้ามไป
  }
}
