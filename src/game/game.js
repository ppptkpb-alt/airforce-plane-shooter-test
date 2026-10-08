import { CONFIG } from '../config.js';
import { STAGES } from '../levels.js';
import { World } from './world.js';
import { WaveManager } from './waves.js';
import { Background } from '../render/background.js';
import { Renderer } from '../render/renderer.js';
import { Hud } from '../ui/hud.js';
import * as Screens from '../ui/screens.js';
import { Audio } from '../core/audio.js';
import { Ending } from '../ui/ending.js';

const SC = CONFIG.stage;
const SCREEN_INPUT_LOCK = 0.8; // กันกดข้ามหน้าจอสรุปโดยไม่ตั้งใจ (เช่น ยังกด Space ค้าง)
const VICTORY_INPUT_LOCK = 2;
const ENDING_SKIP_LOCK = 2;
const TITLE_INPUT_LOCK = 0.5; // กันกดต่อเนื่องจากจอสรุปแล้วเข้าเกมใหม่ทันที
const STAGE_CLEAR_BONUS = 5000;

// state machine หลัก:
//   title → playing ⇄ paused → stageClear → playing (ด่านถัดไป) … → ending (คัตซีน) → victory → title
//                           ↘ gameOver → title
// หน้าสรุป/คัตซีนข้ามได้ด้วย Enter หรือแตะจอเท่านั้น (Space = ยิง จึงไม่นับ)
// ภายใน playing มี stagePhase: intro → waves → warning → boss → bossDead
export class Game {
  constructor(screen, input) {
    this.screen = screen;
    this.input = input;
    this.audio = new Audio();
    this.world = new World(this.audio);
    this.waves = new WaveManager();
    this.background = new Background();
    this.renderer = new Renderer(screen);
    this.hud = new Hud();

    this.state = 'title';
    this.stateTime = 0;
    this.stageIndex = 0;
    this.stagePhase = 'intro';
    this.phaseTimer = 0;
    this.summary = null;
    this.ending = null;

    input.onGesture(() => this.audio.unlock());
    // สลับแท็บ/หน้าต่าง → หยุดเกมอัตโนมัติ
    input.onBlurEvent(() => {
      if (this.state === 'playing') this.setState('paused');
    });
  }

  get stage() {
    return STAGES[this.stageIndex];
  }

  setState(state) {
    this.state = state;
    this.stateTime = 0;
  }

  confirmPressed() {
    const i = this.input;
    return i.pressed('confirm') || i.pressed('tap');
  }

  skipPressed() {
    const i = this.input;
    return i.pressed('skip') || i.pressed('tap');
  }

  // ---------------------------------------------------------------- flow

  newGame() {
    this.world.newGame();
    this.startStage(0);
    this.audio.play('select');
  }

  startStage(index) {
    this.stageIndex = index;
    const stage = this.stage;
    this.world.clearStage();
    this.world.difficulty = stage.difficulty;
    this.world.player.respawn(SC.introTime);
    this.background.setTheme(stage.theme);
    this.waves.start(stage);
    this.stagePhase = 'intro';
    this.phaseTimer = SC.introTime;
    this.setState('playing');
  }

  stageCleared() {
    const w = this.world;
    const bonus = STAGE_CLEAR_BONUS * (this.stageIndex + 1);
    w.score.add(bonus);
    w.score.commit();
    this.summary = {
      stage: this.stageIndex + 1,
      kills: w.kills,
      bestCombo: w.score.bestCombo,
      bonus,
      score: w.score.score,
      totalKills: w.totalKills,
      highScore: w.score.highScore,
      newHighScore: w.score.newHighScore,
    };
    if (this.stageIndex + 1 >= STAGES.length) {
      const p = w.player;
      this.ending = new Ending(this.summary, p.x, p.y, this.audio);
      this.setState('ending');
    } else {
      this.audio.play('stageClear');
      this.setState('stageClear');
    }
  }

  gameOver() {
    const w = this.world;
    w.score.commit();
    this.summary = {
      stage: this.stageIndex + 1,
      score: w.score.score,
      highScore: w.score.highScore,
      newHighScore: w.score.newHighScore,
    };
    this.audio.play('gameOver');
    this.setState('gameOver');
  }

  // ---------------------------------------------------------------- update

  update(dt) {
    const input = this.input;
    this.stateTime += dt;
    this.background.update(dt);
    if (input.pressed('mute')) this.audio.toggleMute();

    switch (this.state) {
      case 'title':
        this.world.time += dt;
        if (this.stateTime > TITLE_INPUT_LOCK && this.confirmPressed()) this.newGame();
        break;

      case 'playing':
        if (input.pressed('pause')) {
          this.audio.play('pause');
          this.setState('paused');
          break;
        }
        this.updatePlaying(dt);
        break;

      case 'paused':
        if (input.pressed('quit')) {
          this.world.score.commit();
          this.setState('title');
        } else if (input.pressed('pause') || this.confirmPressed()) {
          this.setState('playing');
        }
        break;

      case 'stageClear':
        this.world.fx.update(dt);
        this.world.time += dt;
        if (this.stateTime > SCREEN_INPUT_LOCK && this.skipPressed()) this.startStage(this.stageIndex + 1);
        break;

      case 'ending':
        this.ending.update(dt);
        this.background.speedMul = this.ending.backgroundSpeed();
        if (this.ending.done || (this.stateTime > ENDING_SKIP_LOCK && this.skipPressed())) {
          this.background.speedMul = 1;
          this.ending = null;
          this.setState('victory');
        }
        break;

      case 'gameOver':
      case 'victory': {
        this.world.fx.update(dt);
        this.world.time += dt;
        const lock = this.state === 'victory' ? VICTORY_INPUT_LOCK : SCREEN_INPUT_LOCK;
        if (this.stateTime > lock && this.skipPressed()) {
          this.audio.play('select');
          this.setState('title');
        }
        break;
      }
    }

    input.endStep();
  }

  updatePlaying(dt) {
    const w = this.world;
    w.update(dt, this.input);

    switch (this.stagePhase) {
      case 'intro':
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) this.stagePhase = 'waves';
        break;

      case 'waves':
        this.waves.update(dt, w);
        if (this.waves.allSpawned && w.enemies.length === 0) {
          this.stagePhase = 'warning';
          this.phaseTimer = SC.bossWarningTime;
          this.audio.play('bossAlarm');
        }
        break;

      case 'warning':
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) {
          w.spawnBoss(this.stage.boss);
          this.stagePhase = 'boss';
        }
        break;

      case 'boss':
        if (w.bossDefeated) {
          this.stagePhase = 'bossDead';
          this.phaseTimer = SC.clearDelay;
          w.magnet = true;
        }
        break;

      case 'bossDead':
        // ช่วงเก็บไอเทมที่บอสดรอป
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0 && w.player.alive) this.stageCleared();
        break;
    }

    if (w.gameOver) this.gameOver();
  }

  // ---------------------------------------------------------------- render

  render() {
    const ctx = this.renderer.ctx;
    const touch = this.input.touchMode;
    const t = this.stateTime;
    this.screen.beginFrame();
    this.renderer.clear(this.background);

    if (this.state === 'title') {
      this.background.drawBack(ctx);
      this.background.drawFront(ctx);
      Screens.drawTitle(ctx, this.world.time, this.world.score.highScore, touch);
      return;
    }

    if (this.state === 'ending') {
      this.background.drawBack(ctx);
      this.background.drawFront(ctx);
      this.ending.draw(ctx, this.stateTime > ENDING_SKIP_LOCK, touch);
      return;
    }

    this.renderer.drawWorld(this.world, this.background);
    this.hud.draw(ctx, this.world, this.stageIndex + 1, touch && this.state === 'playing');
    this.hud.drawBossBar(ctx, this.world.boss);

    if (this.state === 'playing') {
      if (this.stagePhase === 'intro') {
        Screens.drawStageIntro(ctx, this.stageIndex + 1, this.stage.name, 1 - this.phaseTimer / SC.introTime);
      } else if (this.stagePhase === 'warning') {
        Screens.drawBossWarning(ctx, this.world.time, this.stage.boss.name);
      }
      return;
    }

    const ready = this.stateTime > (this.state === 'victory' ? VICTORY_INPUT_LOCK : SCREEN_INPUT_LOCK);
    switch (this.state) {
      case 'paused':
        Screens.drawPause(ctx, t, touch);
        break;
      case 'stageClear':
        Screens.drawStageClear(ctx, t, { ...this.summary, ready }, touch);
        break;
      case 'gameOver':
        Screens.drawGameOver(ctx, t, { ...this.summary, ready }, touch);
        break;
      case 'victory':
        Screens.drawVictory(ctx, t, { ...this.summary, ready }, touch);
        break;
    }
  }
}
