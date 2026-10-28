// One cancellable source-loading task, with bounded buffering and quiet retries.
(() => {
  'use strict';
  class AutoLoader {
    constructor({allowed, needed, load, state = () => {}, now = Date.now, setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = timer => clearTimeout(timer)}) {
      Object.assign(this, {allowed, needed, load, state, now, setTimer, clearTimer});
      this.enabled = false; this.running = false; this.generation = 0; this.misses = 0; this.nextAt = 0; this.forced = false;
    }
    start() { this.stop(); this.enabled = true; this.reset(); }
    stop() { this.enabled = false; this.generation++; this.clearTimer(this.timer); this.state('idle'); }
    reset() { this.misses = 0; this.nextAt = 0; this.wake(true); }
    progress() { this.misses = 0; this.nextAt = 0; this.wake(); }
    wake(force = false) {
      if (!this.enabled) return;
      if (force) { this.forced = true; this.nextAt = 0; }
      this.schedule(0);
    }
    schedule(delay) {
      this.clearTimer(this.timer);
      if (this.enabled) this.timer = this.setTimer(() => { this.tick(); }, delay);
    }
    async tick() {
      if (!this.enabled) return;
      if (this.running || !this.allowed()) { this.schedule(1000); return; }
      if (!this.forced && !this.needed()) { this.state('idle'); this.schedule(1000); return; }
      if (this.nextAt > this.now()) { this.schedule(Math.min(1000, this.nextAt - this.now())); return; }
      const generation = this.generation;
      const current = () => this.enabled && this.generation === generation && this.allowed();
      this.running = true; this.forced = false; this.state('loading');
      let result;
      try { result = await this.load(current); }
      catch { result = {progress: false}; }
      finally {
        this.running = false;
        if (current()) {
          this.misses = result?.progress ? 0 : Math.min(5, this.misses + 1);
          this.nextAt = this.now() + (result?.progress ? 250 : Math.min(30000, 2000 * 2 ** (this.misses - 1)));
          this.state(result?.progress ? 'idle' : 'waiting');
        }
        this.schedule(250);
      }
    }
  }
  globalThis.XIFAutoLoader = AutoLoader;
  if (typeof module !== 'undefined' && module.exports) module.exports = AutoLoader;
})();
