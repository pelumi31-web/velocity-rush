/**
 * Centralized Audio & Background Soundtrack Controller for Velocity Rush.
 *
 * Primary Soundtrack:
 *  - Uses the supplied project audio file `/assets/aistudio/WhatsApp_Audio_2026-10-20_at_7.01.12_AM_097a1e01.mpeg`
 *    with a singleton HTMLAudioElement configured for seamless, gapless looping.
 *  - Also retains procedural Web Audio synth tracks as optional alternate themes.
 *  - Separates Background Music controls (Music On/Off, Music Volume, Pause Ducking)
 *    from Engine/Collision/UI Sound Effects (SFX Volume).
 */

export const SUPPLIED_MUSIC_ASSET_PATH =
  '/assets/aistudio/WhatsApp_Audio_2026-10-20_at_7.01.12_AM_097a1e01.mpeg';

export type MusicTrackId =
  | 'supplied_soundtrack'
  | 'cyber_overdrive'
  | 'nitro_breakbeat'
  | 'apex_pursuit';

export interface MusicTrackMeta {
  id: MusicTrackId;
  title: string;
  genre: string;
  bpm: number;
  isSuppliedFile?: boolean;
}

export const MUSIC_TRACKS: MusicTrackMeta[] = [
  {
    id: 'supplied_soundtrack',
    title: 'Velocity Rush Official Mix',
    genre: 'High-Octane Electronic (Supplied Track)',
    bpm: 150,
    isSuppliedFile: true,
  },
  {
    id: 'cyber_overdrive',
    title: 'Cyber Overdrive',
    genre: '144 BPM Darksynth',
    bpm: 144,
  },
  {
    id: 'nitro_breakbeat',
    title: 'Nitro Breakbeat',
    genre: '164 BPM Neuro DnB',
    bpm: 164,
  },
  {
    id: 'apex_pursuit',
    title: 'Apex Pursuit',
    genre: '138 BPM Drift Phonk',
    bpm: 138,
  },
];

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

class SoundController {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicCompressor: DynamicsCompressorNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  // Singleton HTMLAudioElement for the user's supplied .mpeg soundtrack
  private bgAudioEl: HTMLAudioElement | null = null;
  private bgAudioStarted: boolean = false;

  // Dual-oscillator Engine Synth
  private engineSubOsc: OscillatorNode | null = null;
  private engineGrowlOsc: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  // Procedural fallback sequencer state
  private currentTrackId: MusicTrackId = 'supplied_soundtrack';
  private isMusicPlaying: boolean = false;
  private schedulerTimer: number | null = null;
  private nextStepTime: number = 0;
  private currentStep: number = 0;
  private barCount: number = 0;

  // Persistent & runtime audio settings
  private musicEnabled: boolean = true;
  private musicVolume: number = 0.65;
  private sfxVolume: number = 0.85;
  private isMuted: boolean = false;
  private isGamePaused: boolean = false;

  private currentSpeedKmh: number = 60;
  private isNitroBoostActive: boolean = false;

  private ensureBgAudioElement(): HTMLAudioElement | null {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      return null;
    }
    if (!this.bgAudioEl) {
      const audio = new Audio(SUPPLIED_MUSIC_ASSET_PATH);
      audio.loop = true;
      audio.preload = 'auto';

      // Seamless loop guard: trim trailing silence at the very end of the file
      audio.addEventListener('timeupdate', () => {
        if (
          audio.duration &&
          Number.isFinite(audio.duration) &&
          audio.duration > 5 &&
          audio.currentTime >= audio.duration - 0.22
        ) {
          audio.currentTime = 0.04;
          if (this.shouldPlaySuppliedTrack() && audio.paused) {
            void audio.play().catch(() => {});
          }
        }
      });

      audio.addEventListener('ended', () => {
        if (this.shouldPlaySuppliedTrack()) {
          audio.currentTime = 0.04;
          void audio.play().catch(() => {});
        }
      });

      this.bgAudioEl = audio;
      this.syncBgAudioElementVolume();
    }
    return this.bgAudioEl;
  }

  private shouldPlaySuppliedTrack(): boolean {
    return (
      this.isMusicPlaying &&
      this.musicEnabled &&
      !this.isMuted &&
      this.currentTrackId === 'supplied_soundtrack'
    );
  }

  private getEffectiveMusicGainValue(): number {
    if (this.isMuted || !this.musicEnabled) return 0;
    const pauseDuck = this.isGamePaused ? 0.42 : 1.0;
    return Math.max(0, Math.min(1, this.musicVolume * pauseDuck));
  }

  private syncBgAudioElementVolume(): void {
    if (!this.bgAudioEl) return;
    const effVol = this.getEffectiveMusicGainValue();
    this.bgAudioEl.volume = effVol;
    this.bgAudioEl.muted = this.isMuted || !this.musicEnabled;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : 1;
      this.masterGain.connect(this.ctx.destination);

      this.musicCompressor = this.ctx.createDynamicsCompressor();
      this.musicCompressor.threshold.value = -15;
      this.musicCompressor.knee.value = 12;
      this.musicCompressor.ratio.value = 5.5;
      this.musicCompressor.attack.value = 0.003;
      this.musicCompressor.release.value = 0.14;
      this.musicCompressor.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.getEffectiveMusicGainValue() * 0.68;
      this.musicGain.connect(this.musicCompressor);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.masterGain);

      this.createNoiseBuffer();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private createNoiseBuffer(): void {
    if (!this.ctx || this.noiseBuffer) return;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 1.0;
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  public setVolumes(musicVolume: number, sfxVolume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, musicVolume));
    this.sfxVolume = Math.max(0, Math.min(1, sfxVolume));
    this.syncBgAudioElementVolume();

    if (this.ctx && this.musicGain && this.sfxGain) {
      this.musicGain.gain.setTargetAtTime(
        this.getEffectiveMusicGainValue() * 0.68,
        this.ctx.currentTime,
        0.04
      );
      this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.04);
    }
  }

  public setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = Boolean(enabled);
    this.syncBgAudioElementVolume();

    if (this.ctx && this.musicGain) {
      this.musicGain.gain.setTargetAtTime(
        this.getEffectiveMusicGainValue() * 0.68,
        this.ctx.currentTime,
        0.04
      );
    }

    if (!this.musicEnabled) {
      if (this.bgAudioEl && !this.bgAudioEl.paused) {
        this.bgAudioEl.pause();
      }
      this.stopProceduralScheduler();
    } else if (this.isMusicPlaying) {
      this.syncActivePlaybackEngine();
    }
  }

  public getMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.syncBgAudioElementVolume();

    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.03);
    }

    if (muted) {
      if (this.bgAudioEl && !this.bgAudioEl.paused) {
        this.bgAudioEl.pause();
      }
    } else if (this.isMusicPlaying && this.musicEnabled) {
      this.syncActivePlaybackEngine();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setGamePaused(paused: boolean): void {
    this.isGamePaused = paused;
    this.syncBgAudioElementVolume();
    if (this.ctx && this.musicGain) {
      this.musicGain.gain.setTargetAtTime(
        this.getEffectiveMusicGainValue() * 0.68,
        this.ctx.currentTime,
        0.05
      );
    }
    if (paused) {
      this.stopEngine();
    }
  }

  public getTrackId(): MusicTrackId {
    return this.currentTrackId;
  }

  public getTrackMeta(): MusicTrackMeta {
    return (
      MUSIC_TRACKS.find((t) => t.id === this.currentTrackId) ?? MUSIC_TRACKS[0]
    );
  }

  public setTrackId(trackId: MusicTrackId): MusicTrackMeta {
    if (MUSIC_TRACKS.some((t) => t.id === trackId)) {
      this.currentTrackId = trackId;
      this.currentStep = 0;
      this.barCount = 0;
      if (this.isMusicPlaying) {
        this.syncActivePlaybackEngine();
      }
    }
    return this.getTrackMeta();
  }

  public cycleTrack(): MusicTrackMeta {
    const idx = MUSIC_TRACKS.findIndex((t) => t.id === this.currentTrackId);
    const next = MUSIC_TRACKS[(idx + 1) % MUSIC_TRACKS.length];
    return this.setTrackId(next.id);
  }

  private stopProceduralScheduler(): void {
    if (this.schedulerTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  private syncActivePlaybackEngine(): void {
    if (!this.isMusicPlaying || !this.musicEnabled || this.isMuted) {
      if (this.bgAudioEl && !this.bgAudioEl.paused) {
        this.bgAudioEl.pause();
      }
      this.stopProceduralScheduler();
      return;
    }

    if (this.currentTrackId === 'supplied_soundtrack') {
      this.stopProceduralScheduler();
      const audio = this.ensureBgAudioElement();
      if (audio) {
        this.syncBgAudioElementVolume();
        if (audio.paused) {
          void audio
            .play()
            .then(() => {
              this.bgAudioStarted = true;
            })
            .catch(() => {
              // Autoplay blocked until next explicit user interaction
            });
        }
      }
    } else {
      if (this.bgAudioEl && !this.bgAudioEl.paused) {
        this.bgAudioEl.pause();
      }
      const ctx = this.ensureContext();
      if (!ctx || !this.musicGain) return;
      if (this.schedulerTimer === null && typeof window !== 'undefined') {
        this.currentStep = 0;
        this.barCount = 0;
        this.nextStepTime = ctx.currentTime + 0.04;
        this.schedulerTimer = window.setInterval(() => {
          this.scheduleLookaheadSteps();
        }, 25);
      }
    }
  }

  public startMusicLoop(): void {
    this.isMusicPlaying = true;
    this.ensureContext();
    this.syncActivePlaybackEngine();
  }

  public stopMusicLoop(): void {
    this.isMusicPlaying = false;
    this.stopProceduralScheduler();
    if (this.bgAudioEl && !this.bgAudioEl.paused) {
      this.bgAudioEl.pause();
    }
  }

  public isSuppliedTrackPlaying(): boolean {
    return Boolean(this.bgAudioEl && !this.bgAudioEl.paused && this.bgAudioStarted);
  }

  private scheduleLookaheadSteps(): void {
    if (
      !this.isMusicPlaying ||
      !this.musicEnabled ||
      this.isMuted ||
      this.currentTrackId === 'supplied_soundtrack' ||
      !this.ctx ||
      !this.musicGain
    ) {
      return;
    }
    const lookaheadSec = 0.11;
    const meta = this.getTrackMeta();
    const stepDurationSec = 60 / meta.bpm / 4;

    while (this.nextStepTime < this.ctx.currentTime + lookaheadSec) {
      this.triggerSequencerStep(this.currentStep, this.barCount, this.nextStepTime, stepDurationSec);
      this.nextStepTime += stepDurationSec;
      this.currentStep = (this.currentStep + 1) % 16;
      if (this.currentStep === 0) {
        this.barCount = (this.barCount + 1) % 8;
      }
    }
  }

  private triggerSequencerStep(step: number, bar: number, time: number, stepDur: number): void {
    if (!this.ctx || !this.musicGain) return;
    const speedFactor = Math.min(1, Math.max(0, (this.currentSpeedKmh - 60) / 220));
    const nitroFactor = this.isNitroBoostActive ? 1 : 0;
    const intensity = Math.min(1, 0.55 + speedFactor * 0.35 + nitroFactor * 0.25);

    if (step % 4 === 0) {
      this.scheduleKick(time, 0.95);
    }
    if (step === 4 || step === 12) {
      this.scheduleSnare(time, 0.72);
    }
    if (step % 2 === 1) {
      this.scheduleHiHat(time, 0.09, 0.28);
    }
    const bassNotes = [38, 38, 50, 38, 41, 41, 53, 41, 43, 43, 55, 43, 45, 43, 41, 38];
    const midi = bassNotes[step % bassNotes.length] + (bar % 2 === 1 && step >= 12 ? 2 : 0);
    this.scheduleReeseBass(time, midiToFreq(midi), stepDur * 0.92, 0.34, 900 + intensity * 1200);
  }

  private scheduleKick(time: number, level: number): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(48, time + 0.045);
    osc.frequency.exponentialRampToValueAtTime(31, time + 0.2);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(level, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);

    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.23);
  }

  private scheduleSnare(time: number, level: number): void {
    if (!this.ctx || !this.musicGain) return;
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(850, time);
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(level * 0.65, time);
      nGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.musicGain);
      noise.start(time);
      noise.stop(time + 0.17);
    }
  }

  private scheduleHiHat(time: number, decaySec: number, level: number): void {
    if (!this.ctx || !this.musicGain || !this.noiseBuffer) return;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(6800, time);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(level, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + decaySec);
    noise.connect(hp);
    hp.connect(gain);
    gain.connect(this.musicGain);
    noise.start(time);
    noise.stop(time + decaySec + 0.01);
  }

  private scheduleReeseBass(
    time: number,
    freq: number,
    duration: number,
    level: number,
    cutoffHz: number
  ): void {
    if (!this.ctx || !this.musicGain) return;
    const osc1 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoffHz, time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(120, cutoffHz * 0.28), time + duration);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(level, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc1.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    osc1.start(time);
    osc1.stop(time + duration + 0.01);
  }

  // ============================================================================
  // VEHICLE ENGINE & GAMEPLAY SFX
  // ============================================================================

  public updateEngine(speedKmh: number, isNitroActive: boolean, isPausedOrMenu: boolean): void {
    this.currentSpeedKmh = speedKmh;
    this.isNitroBoostActive = isNitroActive;

    if (isPausedOrMenu || this.isGamePaused) {
      if (this.engineGain && this.ctx) {
        this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.06);
      }
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    if (!this.engineSubOsc) {
      this.engineSubOsc = ctx.createOscillator();
      this.engineGrowlOsc = ctx.createOscillator();
      this.engineFilter = ctx.createBiquadFilter();
      this.engineGain = ctx.createGain();

      this.engineSubOsc.type = 'sawtooth';
      this.engineGrowlOsc.type = 'triangle';
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 360;
      this.engineGain.gain.value = 0.01;

      this.engineSubOsc.connect(this.engineFilter);
      this.engineGrowlOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.sfxGain);

      this.engineSubOsc.start();
      this.engineGrowlOsc.start();
    }

    const normSpeed = Math.max(0, Math.min(1.5, speedKmh / 240));
    const gearRatio = (speedKmh % 52) / 52;
    const baseFreq =
      46 + normSpeed * 78 + gearRatio * 24 + (isNitroActive ? 28 : 0);

    if (this.engineSubOsc && this.engineGrowlOsc && this.engineFilter && this.engineGain) {
      this.engineSubOsc.frequency.setTargetAtTime(baseFreq, ctx.currentTime, 0.04);
      this.engineGrowlOsc.frequency.setTargetAtTime(baseFreq * 1.5, ctx.currentTime, 0.04);
      this.engineFilter.frequency.setTargetAtTime(
        280 + normSpeed * 620 + (isNitroActive ? 450 : 0),
        ctx.currentTime,
        0.05
      );
      this.engineGain.gain.setTargetAtTime(
        isNitroActive ? 0.14 : 0.095,
        ctx.currentTime,
        0.05
      );
    }
  }

  public stopEngine(): void {
    this.isNitroBoostActive = false;
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
  }

  public playButtonClick(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(540, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(860, ctx.currentTime + 0.045);
    g.gain.setValueAtTime(0.14, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.055);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  }

  public playCoinPickup(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, now);
    osc.frequency.setValueAtTime(1318.51, now + 0.055);
    g.gain.setValueAtTime(0.2, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  public playNearMiss(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(940, now + 0.14);
    g.gain.setValueAtTime(0.16, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  public playNitroActivate(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.28);
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.34);
  }

  public playDriftPulse(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.isGamePaused) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.linearRampToValueAtTime(510, now + 0.12);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100, now);
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  public playCollision(isFatal: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(isFatal ? 95 : 145, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + (isFatal ? 0.45 : 0.24));
    g.gain.setValueAtTime(isFatal ? 0.34 : 0.24, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + (isFatal ? 0.48 : 0.26));
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + (isFatal ? 0.5 : 0.28));
  }

  public playCountdownTick(isGo: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isGo ? 880 : 440, now);
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + (isGo ? 0.28 : 0.14));
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + (isGo ? 0.3 : 0.15));
  }

  public playRaceFinish(isVictory: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const notes = isVictory ? [523.25, 659.25, 783.99, 1046.5] : [440, 392, 349.23];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);
      g.gain.setValueAtTime(0.18, now + idx * 0.09);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.26);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.28);
    });
  }
}

export const soundController = new SoundController();
