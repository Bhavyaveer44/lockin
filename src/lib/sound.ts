// Tiny Web Audio alarm — synthesizes a repeating, attention-demanding beep with
// no asset. The AudioContext must be created from a user gesture (the Start
// button), so construct this in the session's start handler.
export class Beeper {
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (Ctx) this.ctx = new Ctx();
    }
  }

  // Begin ringing and KEEP ringing until stop() is called. Idempotent — calling
  // start() while already ringing is a no-op, so it's safe to call every sample.
  start(): void {
    if (!this.ctx || this.timer !== null) return;
    this.ring();
    // Re-fire faster than the ~1.5s sampling so there's no silent gap.
    this.timer = setInterval(() => this.ring(), 1000);
  }

  // Silence the alarm. Idempotent.
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  get ringing(): boolean {
    return this.timer !== null;
  }

  // One urgent burst: three rising square-wave blips. Square + higher gain reads
  // as a harsh "alarm" rather than a gentle chime — the point is to be annoying.
  private ring(): void {
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();
    const now = this.ctx.currentTime;
    this.blip(now, 880);
    this.blip(now + 0.18, 1175);
    this.blip(now + 0.36, 880);
  }

  private blip(start: number, freq: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    // Quick fade in/out to avoid clicks; punchy level so it cuts through.
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.35, start + 0.01);
    gain.gain.linearRampToValueAtTime(0, start + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.16);
  }

  close(): void {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
  }
}
