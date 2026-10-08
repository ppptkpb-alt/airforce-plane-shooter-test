import { CONFIG } from '../config.js';

// เสียงทั้งหมดสังเคราะห์ด้วย Web Audio API (ไม่มีไฟล์เสียง)
// AudioContext ถูกสร้างหลัง user gesture ครั้งแรก (ข้อบังคับของเบราว์เซอร์)

// ระยะห่างขั้นต่ำระหว่างเสียงซ้ำ (วินาที) กันเสียงซ้อนจนแตก
const THROTTLE = {
  shoot: 0.07,
  enemyShoot: 0.08,
  hit: 0.05,
  explosion: 0.04,
  bigExplosion: 0.15,
  powerup: 0.05,
};

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.lastPlayed = {};
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : CONFIG.audio.masterVolume;
    // compressor กันเสียงระเบิดหลายลูกพร้อมกันแล้วแตก
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);

    // white noise buffer 1 วินาที ใช้ร่วมกันทุกเสียงระเบิด
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : CONFIG.audio.masterVolume;
    return this.muted;
  }

  play(name) {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const gap = THROTTLE[name];
    if (gap && now - (this.lastPlayed[name] || -1) < gap) return;
    this.lastPlayed[name] = now;
    const fn = this[`sfx_${name}`];
    if (fn) fn.call(this, now);
  }

  // ---------------------------------------------------------------- building blocks

  env(t, peak, attack, decay) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(this.master);
    return g;
  }

  tone(t, type, f0, f1, dur, peak, attack = 0.005) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    o.connect(this.env(t, peak, attack, dur));
    o.start(t);
    o.stop(t + attack + dur + 0.05);
  }

  noiseBurst(t, dur, peak, filterType, f0, f1, q = 1) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    src.connect(f);
    f.connect(this.env(t, peak, 0.005, dur));
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.1);
  }

  // ---------------------------------------------------------------- sound effects

  sfx_shoot(t) {
    this.tone(t, 'square', 1400, 500, 0.05, 0.05);
    this.noiseBurst(t, 0.04, 0.05, 'highpass', 3000, 1500);
  }

  sfx_enemyShoot(t) {
    this.tone(t, 'triangle', 620, 300, 0.08, 0.05);
  }

  sfx_hit(t) {
    this.noiseBurst(t, 0.04, 0.08, 'bandpass', 2500, 1200, 2);
  }

  sfx_explosion(t) {
    this.noiseBurst(t, 0.45, 0.5, 'lowpass', 1800, 120);
    this.tone(t, 'sine', 140, 40, 0.3, 0.4);
  }

  sfx_bigExplosion(t) {
    this.noiseBurst(t, 1.1, 0.8, 'lowpass', 1200, 60);
    this.tone(t, 'sine', 90, 25, 0.9, 0.7);
    this.noiseBurst(t + 0.15, 0.6, 0.4, 'lowpass', 800, 80);
  }

  sfx_playerHit(t) {
    this.tone(t, 'sawtooth', 300, 70, 0.25, 0.25);
    this.noiseBurst(t, 0.2, 0.3, 'lowpass', 2500, 300);
  }

  sfx_shieldBreak(t) {
    this.tone(t, 'sine', 1600, 300, 0.35, 0.25);
    this.tone(t, 'triangle', 2400, 600, 0.25, 0.15);
    this.noiseBurst(t, 0.25, 0.2, 'highpass', 4000, 1500);
  }

  sfx_powerup(t) {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(t + i * 0.06, 'triangle', f, f, 0.12, 0.18));
    [1047, 1319].forEach((f, i) => this.tone(t + 0.24 + i * 0.05, 'sine', f, f, 0.15, 0.1));
  }

  sfx_bomb(t) {
    this.noiseBurst(t, 1.4, 0.9, 'bandpass', 300, 60, 0.7);
    this.noiseBurst(t, 0.6, 0.5, 'highpass', 6000, 400);
    this.tone(t, 'sine', 70, 20, 1.3, 0.9);
    this.tone(t, 'sawtooth', 200, 30, 0.8, 0.2);
  }

  sfx_bossAlarm(t) {
    for (let i = 0; i < 4; i++) {
      this.tone(t + i * 0.5, 'square', 440, 440, 0.22, 0.12, 0.01);
      this.tone(t + i * 0.5 + 0.25, 'square', 330, 330, 0.22, 0.12, 0.01);
    }
  }

  sfx_stageClear(t) {
    const notes = [523, 659, 784, 659, 784, 1047];
    notes.forEach((f, i) => this.tone(t + i * 0.12, 'triangle', f, f, 0.2, 0.2));
    this.tone(t + notes.length * 0.12, 'triangle', 1047, 1047, 0.6, 0.22);
  }

  sfx_gameOver(t) {
    [392, 330, 262, 196].forEach((f, i) => this.tone(t + i * 0.25, 'triangle', f, f * 0.98, 0.35, 0.22));
  }

  sfx_select(t) {
    this.tone(t, 'square', 880, 1320, 0.08, 0.1);
  }

  sfx_pause(t) {
    this.tone(t, 'triangle', 660, 440, 0.12, 0.12);
  }
}
