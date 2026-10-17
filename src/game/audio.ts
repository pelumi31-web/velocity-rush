/**
 * Procedural Web Audio synthesizer for Velocity Rush.
 * Provides separate Music and SFX volume channels, engine pitch modulation,
 * nitro boost whoosh, coin pickup, near-miss chime, collision crunch, and
 * automatic pause/background silencing.
 */

class SoundController {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  private musicVolume = 0.65;
  private sfxVolume = 0.85;
  private isMuted = false;
  private isEngineActive = false;
  private musicIntervalId: number | null = null;
  private musicStep = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      try {
        this.ctx = new AudioCtx();
        this.musicGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain.connect(this.ctx.destination);
        this.sfxGain.connect(this.ctx.destination);
        this.applyVolumes();
      } catch {
        return null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setVolumes(music: number, sfx: number): void {
    this.musicVolume = Math.max(0, Math.min(1, music));
    this.sfxVolume = Math.max(0, Math.min(1, sfx));
    this.applyVolumes();
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.applyVolumes();
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.musicGain || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const mVol = this.isMuted ? 0 : this.musicVolume * 0.18;
    const sVol = this.isMuted ? 0 : this.sfxVolume * 0.45;
    this.musicGain.gain.setTargetAtTime(mVol, now, 0.03);
    this.sfxGain.gain.setTargetAtTime(sVol, now, 0.03);
  }

  public startEngine(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    if (this.isEngineActive) return;

    try {
      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0.001;

      this.engineFilter = ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 240;

      this.engineOsc = ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 65;

      this.engineSubOsc = ctx.createOscillator();
      this.engineSubOsc.type = 'triangle';
      this.engineSubOsc.frequency.value = 32.5;

      this.engineOsc.connect(this.engineFilter);
      this.engineSubOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.sfxGain);

      this.engineOsc.start();
      this.engineSubOsc.start();
      this.isEngineActive = true;
    } catch {
      // Ignore audio errors on restricted devices
    }
  }

  public updateEngine(speedKmh: number, isNitro: boolean, isPausedOrInactive: boolean): void {
    if (!this.ctx || !this.isEngineActive || !this.engineOsc || !this.engineSubOsc || !this.engineGain || !this.engineFilter) {
      return;
    }
    const now = this.ctx.currentTime;
    if (isPausedOrInactive || this.isMuted) {
      this.engineGain.gain.setTargetAtTime(0.0001, now, 0.04);
      return;
    }

    const normSpeed = Math.max(0, Math.min(1.4, (speedKmh - 50) / 260));
    // Simulate 5-speed gear tooth sawtooth modulation
    const gearRatio = (normSpeed * 4.2) % 1;
    const baseFreq = 54 + normSpeed * 95 + gearRatio * 28 + (isNitro ? 32 : 0);

    this.engineOsc.frequency.setTargetAtTime(baseFreq, now, 0.05);
    this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.05);
    this.engineFilter.frequency.setTargetAtTime(
      isNitro ? 680 : 210 + normSpeed * 280,
      now,
      0.06
    );
    this.engineGain.gain.setTargetAtTime(isNitro ? 0.24 : 0.15, now, 0.05);
  }

  public stopEngine(): void {
    if (!this.isEngineActive) return;
    try {
      this.engineOsc?.stop();
      this.engineSubOsc?.stop();
      this.engineOsc?.disconnect();
      this.engineSubOsc?.disconnect();
      this.engineGain?.disconnect();
    } catch {
      // Ignore
    }
    this.engineOsc = null;
    this.engineSubOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.isEngineActive = false;
  }

  public startMusicLoop(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.musicIntervalId !== null) return;

    const bassNotes = [55, 55, 65.41, 55, 73.42, 65.41, 49, 49];
    this.musicIntervalId = window.setInterval(() => {
      if (!this.ctx || !this.musicGain || this.isMuted || this.musicVolume <= 0.01) return;
      if (document.hidden) return;

      const now = this.ctx.currentTime;
      const freq = bassNotes[this.musicStep % bassNotes.length];
      this.musicStep++;

      try {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(320, now);
        filter.frequency.exponentialRampToValueAtTime(110, now + 0.22);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);

        g.gain.setValueAtTime(0.28, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

        osc.connect(filter);
        filter.connect(g);
        g.connect(this.musicGain);

        osc.start(now);
        osc.stop(now + 0.25);
      } catch {
        // Ignore
      }
    }, 260);
  }

  public stopMusicLoop(): void {
    if (this.musicIntervalId !== null) {
      window.clearInterval(this.musicIntervalId);
      this.musicIntervalId = null;
    }
  }

  public playCoinPickup(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.isMuted) return;
    const now = ctx.currentTime;
    const detune = 1 + (Math.random() - 0.5) * 0.1;

    try {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880 * detune, now);
      osc.frequency.setValueAtTime(1318.5 * detune, now + 0.055);

      g.gain.setValueAtTime(0.32, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.23);
    } catch {}
  }

  public playNearMiss(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.isMuted) return;
    const now = ctx.currentTime;

    try {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(980, now + 0.14);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.28);

      g.gain.setValueAtTime(0.35, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.31);
    } catch {}
  }

  public playNitroActivate(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.isMuted) return;
    const now = ctx.currentTime;

    try {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.32);

      g.gain.setValueAtTime(0.3, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.36);
    } catch {}
  }

  public playCollision(isFatal: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.isMuted) return;
    const now = ctx.currentTime;

    try {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(isFatal ? 150 : 210, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + (isFatal ? 0.48 : 0.26));

      g.gain.setValueAtTime(0.55, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + (isFatal ? 0.5 : 0.28));

      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + (isFatal ? 0.52 : 0.3));
    } catch {}
  }

  public playButtonClick(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.isMuted) return;
    const now = ctx.currentTime;

    try {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(640, now);
      osc.frequency.exponentialRampToValueAtTime(820, now + 0.04);

      g.gain.setValueAtTime(0.18, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.06);
    } catch {}
  }

  public playCountdownTick(isGo: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.isMuted) return;
    const now = ctx.currentTime;

    try {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isGo ? 880 : 440, now);

      g.gain.setValueAtTime(0.3, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + (isGo ? 0.28 : 0.14));

      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + (isGo ? 0.3 : 0.16));
    } catch {}
  }
}

export const soundController = new SoundController();
