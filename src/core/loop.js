// Fixed-timestep game loop: update ด้วย dt คงที่, render ทุกเฟรมของ requestAnimationFrame
export class GameLoop {
  constructor({ step, maxFrameTime, update, render }) {
    this.step = step;
    this.maxFrameTime = maxFrameTime;
    this.update = update;
    this.render = render;
    this.accumulator = 0;
    this.lastTime = 0;
    this.running = false;
    this.frame = this.frame.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.frame);
  }

  frame(now) {
    if (!this.running) return;
    // clamp กัน "spiral of death" เมื่อแท็บถูกพักหรือเครื่องกระตุก
    const frameTime = Math.min((now - this.lastTime) / 1000, this.maxFrameTime);
    this.lastTime = now;
    this.accumulator += frameTime;

    while (this.accumulator >= this.step) {
      this.update(this.step);
      this.accumulator -= this.step;
    }

    this.render(this.accumulator / this.step);
    requestAnimationFrame(this.frame);
  }
}
