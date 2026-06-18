// Tiny Web Audio alarm — synthesizes a short two-tone beep, no asset needed.
// The AudioContext must be created from a user gesture (the Start button), so
// construct this in the session's start handler.
export class Beeper {
  private ctx: AudioContext | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (Ctx) this.ctx = new Ctx();
    }
  }

  // A pair of descending blips — attention-getting but not jarring.
  alarm(): void {
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();
    const now = this.ctx.currentTime;
    this.blip(now, 880);
    this.blip(now + 0.18, 660);
  }

  private blip(start: number, freq: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    // Quick fade in/out to avoid clicks.
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
    gain.gain.linearRampToValueAtTime(0, start + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.16);
  }

  close(): void {
    void this.ctx?.close();
    this.ctx = null;
  }
}
