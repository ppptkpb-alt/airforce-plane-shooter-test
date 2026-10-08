import { CONFIG } from './config.js';
import { Screen } from './core/screen.js';
import { Input } from './core/input.js';
import { GameLoop } from './core/loop.js';
import { Game } from './game/game.js';

const canvas = document.getElementById('game');
const screen = new Screen(canvas);
const input = new Input(screen);
const game = new Game(screen, input);

const loop = new GameLoop({
  step: CONFIG.fixedStep,
  maxFrameTime: CONFIG.maxFrameTime,
  update: (dt) => game.update(dt),
  render: (alpha) => game.render(alpha),
});
loop.start();

// เปิดให้ debug จาก console ได้
window.__game = game;
