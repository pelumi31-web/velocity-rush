/**
 * High-Intensity Procedural Web Audio Synthesizer & Multi-Stem Sequencer for Velocity Rush.
 * Features a hardware-scheduled lookahead drum & synth engine with 3 selectable
 * high-octane racing soundtracks:
 *  - 'cyber_overdrive': 144 BPM Darksynth / Outrun (E Minor)
 *  - 'nitro_breakbeat': 164 BPM High-Speed Drum & Bass (F Minor)
 *  - 'apex_pursuit':    138 BPM Industrial Drift Phonk / Techno (D Minor)
 * Dynamically scales filter cutoffs, percussion layers, and energy with car speed & Nitro!
 */

export type MusicTrackId = 'cyber_overdrive' | 'nitro_breakbeat' | 'apex_pursuit';

export interface MusicTrackMeta {
  id: MusicTrackId;
  title: string;
  genre: string;
  bpm: number;
}

export const MUSIC_TRACKS: MusicTrackMeta[] = [
  {
    id: 'cyber_overdrive',
    title: 'Cyber Overdrive',
    genre: '144 BPM Darksynth',
    bpm: 144,
  },
  {
    id: 'nitro_breakbeat',
    title: 'Nitro Breakbeat',
    genre: '164 BPM Drum & Bass',
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
  private masterCompressor: DynamicsCompressorNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private engineOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  private musicVolume = 0.75;
  private sfxVolume = 0.85;
  private isMuted = false;
  private isEngineActive = false;

  // Lookahead Sequencer State
  private currentTrackId: MusicTrackId = 'cyber_overdrive';
  private isMusicPlaying = false;
  private schedulerTimerId: number | null = null;
  private nextStepTime = 0;
  private currentStep = 0; // 0..63 (4-bar 16th-note phrase)
  private raceIntensity = 0.55; // 0.45 in menus, up to 1.25 at max speed + nitro
  private isNitroBoosted = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      try {
        this.ctx = new AudioCtx();

        // Master bus compressor for punchy, glued electronic music & SFX
        this.masterCompressor = this.ctx.createDynamicsCompressor();
        this.masterCompressor.threshold.value = -14;
        this.masterCompressor.knee.value = 10;
        this.masterCompressor.ratio.value = 4.5;
        this.masterCompressor.attack.value = 0.003;
        this.masterCompressor.release.value = 0.14;
        this.masterCompressor.connect(this.ctx.destination);

        this.musicGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain.connect(this.masterCompressor);
        this.sfxGain.connect(this.masterCompressor);

        this.noiseBuffer = this.createWhiteNoiseBuffer(this.ctx);
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

  private createWhiteNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const bufferSize = ctx.sampleRate * 1.0;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
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

  public getTrackId(): MusicTrackId {
    return this.currentTrackId;
  }

  public getTrackMeta(): MusicTrackMeta {
    return (
      MUSIC_TRACKS.find((t) => t.id === this.currentTrackId) ?? MUSIC_TRACKS[0]
    );
  }

  public setTrackId(trackId: MusicTrackId): MusicTrackMeta {
    this.currentTrackId = trackId;
    this.currentStep = 0;
    if (!this.isMusicPlaying) {
      this.startMusicLoop();
    } else if (this.ctx) {
      this.nextStepTime = Math.max(this.nextStepTime, this.ctx.currentTime + 0.02);
    }
    return this.getTrackMeta();
  }

  public cycleTrack(): MusicTrackMeta {
    const idx = MUSIC_TRACKS.findIndex((t) => t.id === this.currentTrackId);
    const next = MUSIC_TRACKS[(idx + 1) % MUSIC_TRACKS.length];
    return this.setTrackId(next.id);
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.musicGain || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const mVol = this.isMuted ? 0 : this.musicVolume * 0.44;
    const sVol = this.isMuted ? 0 : this.sfxVolume * 0.46;
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
    if (isPausedOrInactive) {
      this.raceIntensity = 0.48;
      this.isNitroBoosted = false;
    } else {
      const norm = Math.max(0, Math.min(1.2, (speedKmh - 50) / 240));
      this.raceIntensity = 0.62 + norm * 0.42 + (isNitro ? 0.22 : 0);
      this.isNitroBoosted = isNitro;
    }

    if (
      !this.ctx ||
      !this.isEngineActive ||
      !this.engineOsc ||
      !this.engineSubOsc ||
      !this.engineGain ||
      !this.engineFilter
    ) {
      return;
    }
    const now = this.ctx.currentTime;
    if (isPausedOrInactive || this.isMuted) {
      this.engineGain.gain.setTargetAtTime(0.0001, now, 0.04);
      return;
    }

    const normSpeed = Math.max(0, Math.min(1.4, (speedKmh - 50) / 260));
    const gearRatio = (normSpeed * 4.2) % 1;
    const baseFreq = 54 + normSpeed * 95 + gearRatio * 28 + (isNitro ? 32 : 0);

    this.engineOsc.frequency.setTargetAtTime(baseFreq, now, 0.05);
    this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.05);
    this.engineFilter.frequency.setTargetAtTime(
      isNitro ? 680 : 210 + normSpeed * 280,
      now,
      0.06
    );
    this.engineGain.gain.setTargetAtTime(isNitro ? 0.22 : 0.14, now, 0.05);
  }

  public stopEngine(): void {
    this.raceIntensity = 0.52;
    this.isNitroBoosted = false;
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

  // ============================================================================
  // INTENSE PROCEDURAL MULTI-STEM RACING SOUNDTRACK SEQUENCER
  // ============================================================================

  public startMusicLoop(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (this.isMusicPlaying && this.schedulerTimerId !== null) return;

    this.isMusicPlaying = true;
    this.currentStep = 0;
    this.nextStepTime = ctx.currentTime + 0.03;

    const lookaheadMs = 25;
    const scheduleAheadSec = 0.11;

    this.schedulerTimerId = window.setInterval(() => {
      if (!this.ctx || !this.musicGain || !this.isMusicPlaying) return;
      if (document.hidden || this.isMuted || this.musicVolume <= 0.01) {
        this.nextStepTime = this.ctx.currentTime + 0.05;
        return;
      }

      // Catch up if tab was throttled
      if (this.nextStepTime < this.ctx.currentTime - 0.2) {
        this.nextStepTime = this.ctx.currentTime + 0.02;
      }

      while (this.nextStepTime < this.ctx.currentTime + scheduleAheadSec) {
        this.scheduleStep(this.currentStep, this.nextStepTime);
        this.advanceStep();
      }
    }, lookaheadMs);
  }

  public stopMusicLoop(): void {
    this.isMusicPlaying = false;
    if (this.schedulerTimerId !== null) {
      window.clearInterval(this.schedulerTimerId);
      this.schedulerTimerId = null;
    }
  }

  private advanceStep(): void {
    const meta = this.getTrackMeta();
    // Slight dynamic BPM push during Nitro or high-speed racing (+4% max)
    const speedTempoBoost = this.isNitroBoosted ? 1.045 : 1 + Math.max(0, this.raceIntensity - 0.6) * 0.04;
    const effectiveBpm = meta.bpm * speedTempoBoost;
    const secondsPerBeat = 60.0 / effectiveBpm;
    const sixteenthDuration = secondsPerBeat * 0.25;

    this.nextStepTime += sixteenthDuration;
    this.currentStep = (this.currentStep + 1) % 64;
  }

  private scheduleStep(step: number, time: number): void {
    if (!this.ctx || !this.musicGain) return;
    const meta = this.getTrackMeta();
    const stepLen = 60 / meta.bpm / 4;

    if (this.currentTrackId === 'cyber_overdrive') {
      this.scheduleCyberOverdriveStep(step, time, stepLen);
    } else if (this.currentTrackId === 'nitro_breakbeat') {
      this.scheduleNitroBreakbeatStep(step, time, stepLen);
    } else {
      this.scheduleApexPursuitStep(step, time, stepLen);
    }
  }

  /**
   * TRACK 1: CYBER OVERDRIVE (144 BPM Darksynth / Outrun in E Minor)
   * Driving 4-on-the-floor kick, gated snare, octave-jumping sawtooth bass, and soaring synth lead.
   */
  private scheduleCyberOverdriveStep(step: number, time: number, stepLen: number): void {
    const bar = Math.floor(step / 16); // 0..3
    const s16 = step % 16;

    // 1. Crash cymbal swell at start of 4-bar phrase
    if (step === 0) {
      this.triggerCrashCymbal(time, 0.24);
    }

    // 2. Heavy Kick Drum: 4-on-the-floor + syncopated turnaround kick at end of bar
    if (s16 % 4 === 0 || (s16 === 14 && bar % 2 === 1) || (s16 === 11 && bar === 3)) {
      this.triggerKick(time, 0.88);
    }

    // 3. Gated Darksynth Snare on beats 2 & 4 + ghost fill on bar 3
    if (s16 === 4 || s16 === 12) {
      this.triggerSnare(time, 0.62, true);
    } else if (bar === 3 && (s16 === 14 || s16 === 15)) {
      this.triggerSnare(time, 0.38, false);
    }

    // 4. Driving 16th-note Hi-Hats & Offbeat Open Hat
    const isOffbeat = s16 % 4 === 2;
    this.triggerHiHat(
      time,
      isOffbeat ? 0.24 : s16 % 2 === 0 ? 0.14 : 0.09,
      isOffbeat && this.raceIntensity > 0.6
    );

    // 5. Rolling 16th-Note Octave-Jumping Darksynth Bassline (Em -> C -> D -> B)
    const rootMidiByBar = [28, 24, 26, 23]; // E1, C1, D1, B0
    const baseMidi = rootMidiByBar[bar];
    const octaveJump = s16 % 2 === 1 ? 12 : 0;
    const fifthJump = s16 === 7 || s16 === 15 ? 7 : 0;
    const bassFreq = midiToFreq(baseMidi + octaveJump + fifthJump);
    // Sidechain duck on kick beats (0, 4, 8, 12)
    const sidechainGain = s16 % 4 === 0 ? 0.22 : 0.42;
    this.triggerDarksynthBass(
      time,
      bassFreq,
      stepLen * 0.9,
      sidechainGain,
      580 + this.raceIntensity * 850
    );

    // 6. Intense Cyber Lead Arpeggio & Hooks
    const leadPatternA = [
      64, 67, 71, 76, 74, 71, 67, 71,
      64, 67, 71, 79, 78, 76, 74, 71,
    ];
    const leadPatternB = [
      76, 79, 83, 88, 86, 83, 79, 83,
      76, 78, 79, 83, 86, 84, 83, 79,
    ];
    const activePattern = bar >= 2 || this.isNitroBoosted ? leadPatternB : leadPatternA;
    const leadMidi = activePattern[s16];
    if (leadMidi) {
      const accent = s16 % 4 === 0 || s16 === 6 || s16 === 10;
      this.triggerCyberLead(
        time,
        midiToFreq(leadMidi),
        stepLen * (accent ? 1.4 : 0.85),
        accent ? 0.22 : 0.14,
        1400 + this.raceIntensity * 1600
      );
    }

    // 7. Power Chord Brass Stab on Beat 1 of each bar
    if (s16 === 0) {
      const chordRoots = [52, 48, 50, 47]; // E3, C3, D3, B2
      const r = chordRoots[bar];
      this.triggerChordStab(time, [midiToFreq(r), midiToFreq(r + 7), midiToFreq(r + 12)], stepLen * 4.5, 0.14);
    }
  }

  /**
   * TRACK 2: NITRO BREAKBEAT (164 BPM High-Speed Drum & Bass in F Minor)
   * Syncopated Amen breakbeat drums, deep Reese sub-bass, and high-velocity neuro/liquid synth hooks.
   */
  private scheduleNitroBreakbeatStep(step: number, time: number, stepLen: number): void {
    const bar = Math.floor(step / 16);
    const s16 = step % 16;

    if (step === 0) {
      this.triggerCrashCymbal(time, 0.26);
    }

    // Classic Drum & Bass syncopated kick (steps 0 and 10, plus variation on bar 3)
    if (s16 === 0 || s16 === 10 || (bar === 3 && s16 === 7)) {
      this.triggerKick(time, 0.92);
    }

    // Crisp DnB Snare on steps 4 and 12 + Amen ghost snares on 7, 9, 15
    if (s16 === 4 || s16 === 12) {
      this.triggerSnare(time, 0.68, false);
    } else if (s16 === 7 || s16 === 9 || (bar % 2 === 1 && s16 === 15)) {
      this.triggerSnare(time, 0.34, false);
    }

    // Fast 16th-note breakbeat shaker/hat ride
    this.triggerHiHat(time, s16 % 2 === 0 ? 0.18 : 0.11, s16 === 2 || s16 === 6 || s16 === 14);

    // Growling Reese Bassline (Fm -> Db -> Eb -> C)
    const reeseRoots = [29, 25, 27, 24]; // F1, Db1, Eb1, C1
    if (s16 === 0 || s16 === 6 || s16 === 10 || s16 === 14) {
      const durSteps = s16 === 0 ? 6 : s16 === 6 ? 4 : 4;
      const pitchShift = s16 === 14 ? 7 : 0;
      this.triggerReeseBass(
        time,
        midiToFreq(reeseRoots[bar] + pitchShift),
        stepLen * durSteps * 0.95,
        0.44,
        420 + this.raceIntensity * 720
      );
    }

    // High-speed DnB Lead Arp
    const dnbArp = [
      65, 68, 72, 77, 75, 72, 68, 72,
      65, 72, 75, 77, 80, 77, 75, 72,
    ];
    const note = dnbArp[s16] + (this.isNitroBoosted ? 12 : 0);
    this.triggerCyberLead(
      time,
      midiToFreq(note),
      stepLen * 0.85,
      s16 % 3 === 0 ? 0.2 : 0.12,
      1800 + this.raceIntensity * 1800
    );
  }

  /**
   * TRACK 3: APEX PURSUIT (138 BPM Industrial Drift Phonk / Techno in D Minor)
   * Aggressive metallic drift cowbell hook, relentless distorted bass, and hard-hitting percussion.
   */
  private scheduleApexPursuitStep(step: number, time: number, stepLen: number): void {
    const bar = Math.floor(step / 16);
    const s16 = step % 16;

    if (step === 0) {
      this.triggerCrashCymbal(time, 0.24);
    }

    // Heavy Phonk Kick pattern
    if (s16 === 0 || s16 === 3 || s16 === 6 || s16 === 8 || s16 === 10 || (bar === 3 && s16 === 14)) {
      this.triggerKick(time, 0.94);
    }

    // Hard Snare Clap on 4 & 12
    if (s16 === 4 || s16 === 12) {
      this.triggerSnare(time, 0.66, true);
    }

    // Rapid trap/phonk hi-hat rolls on steps 13, 14, 15
    this.triggerHiHat(time, s16 >= 12 ? 0.22 : 0.13, s16 === 2 || s16 === 10);

    // Acid / Industrial 16th Bass in D Minor (D1 -> Bb0 -> C1 -> A0)
    const bassRoots = [26, 22, 24, 21];
    const acidOctave = s16 % 3 === 0 ? 12 : 0;
    this.triggerDarksynthBass(
      time,
      midiToFreq(bassRoots[bar] + acidOctave),
      stepLen * 0.85,
      s16 % 4 === 0 ? 0.28 : 0.44,
      720 + this.raceIntensity * 950
    );

    // Signature Drift Phonk Metallic Cowbell Melody
    const phonkMelody: (number | null)[] = [
      62, null, 62, 65, 69, null, 67, 65,
      62, 65, 69, 74, 72, 69, 67, 65,
    ];
    const bellNote = phonkMelody[s16];
    if (bellNote !== null) {
      const shifted = bellNote + (bar === 3 || this.isNitroBoosted ? 12 : 0);
      this.triggerPhonkCowbell(time, midiToFreq(shifted), stepLen * 1.15, 0.25);
    }
  }

  // ============================================================================
  // INSTRUMENT VOICE SYNTHESIZERS
  // ============================================================================

  private triggerKick(time: number, velocity: number): void {
    if (!this.ctx || !this.musicGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const clickOsc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const clickGain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, time);
      osc.frequency.exponentialRampToValueAtTime(44, time + 0.065);
      osc.frequency.exponentialRampToValueAtTime(32, time + 0.16);

      gain.gain.setValueAtTime(velocity * 0.72, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.17);

      // Punchy beater click
      clickOsc.type = 'triangle';
      clickOsc.frequency.setValueAtTime(1400, time);
      clickOsc.frequency.exponentialRampToValueAtTime(180, time + 0.018);
      clickGain.gain.setValueAtTime(velocity * 0.28, time);
      clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);

      osc.connect(gain);
      gain.connect(this.musicGain);
      clickOsc.connect(clickGain);
      clickGain.connect(this.musicGain);

      osc.start(time);
      osc.stop(time + 0.18);
      clickOsc.start(time);
      clickOsc.stop(time + 0.022);
    } catch {}
  }

  private triggerSnare(time: number, velocity: number, gatedTail: boolean): void {
    if (!this.ctx || !this.musicGain || !this.noiseBuffer) return;
    try {
      // 1. Noise burst
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(1650, time);
      noiseFilter.Q.value = 0.85;

      const noiseGain = this.ctx.createGain();
      const decay = gatedTail ? 0.17 : 0.11;
      noiseGain.gain.setValueAtTime(velocity * 0.52, time);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, time + decay);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.musicGain);

      // 2. Snare drum body tone
      const bodyOsc = this.ctx.createOscillator();
      const bodyGain = this.ctx.createGain();
      bodyOsc.type = 'triangle';
      bodyOsc.frequency.setValueAtTime(210, time);
      bodyOsc.frequency.exponentialRampToValueAtTime(115, time + 0.06);

      bodyGain.gain.setValueAtTime(velocity * 0.4, time);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

      bodyOsc.connect(bodyGain);
      bodyGain.connect(this.musicGain);

      noise.start(time);
      noise.stop(time + decay + 0.01);
      bodyOsc.start(time);
      bodyOsc.stop(time + 0.09);
    } catch {}
  }

  private triggerHiHat(time: number, velocity: number, open: boolean): void {
    if (!this.ctx || !this.musicGain || !this.noiseBuffer) return;
    try {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(7600, time);

      const gain = this.ctx.createGain();
      const decay = open ? 0.13 : 0.038;
      gain.gain.setValueAtTime(velocity * 0.42, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

      noise.connect(hp);
      hp.connect(gain);
      gain.connect(this.musicGain);

      noise.start(time);
      noise.stop(time + decay + 0.01);
    } catch {}
  }

  private triggerCrashCymbal(time: number, velocity: number): void {
    if (!this.ctx || !this.musicGain || !this.noiseBuffer) return;
    try {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(4200, time);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(velocity * 0.45, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.55);

      noise.connect(hp);
      hp.connect(gain);
      gain.connect(this.musicGain);

      noise.start(time);
      noise.stop(time + 0.56);
    } catch {}
  }

  private triggerDarksynthBass(
    time: number,
    freq: number,
    duration: number,
    velocity: number,
    cutoffHz: number
  ): void {
    if (!this.ctx || !this.musicGain) return;
    try {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq, time);

      osc2.type = 'square';
      osc2.frequency.setValueAtTime(freq * 0.5, time); // Sub-octave

      filter.type = 'lowpass';
      filter.Q.value = 3.2;
      filter.frequency.setValueAtTime(cutoffHz, time);
      filter.frequency.exponentialRampToValueAtTime(140, time + duration);

      gain.gain.setValueAtTime(velocity * 0.46, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + duration + 0.01);
      osc2.stop(time + duration + 0.01);
    } catch {}
  }

  private triggerReeseBass(
    time: number,
    freq: number,
    duration: number,
    velocity: number,
    cutoffHz: number
  ): void {
    if (!this.ctx || !this.musicGain) return;
    try {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const subOsc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq * 0.994, time);
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(freq * 1.006, time);
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(freq * 0.5, time);

      filter.type = 'lowpass';
      filter.Q.value = 2.6;
      filter.frequency.setValueAtTime(cutoffHz, time);
      filter.frequency.exponentialRampToValueAtTime(180, time + duration);

      gain.gain.setValueAtTime(0.01, time);
      gain.gain.linearRampToValueAtTime(velocity * 0.44, time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc1.connect(filter);
      osc2.connect(filter);
      subOsc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc1.start(time);
      osc2.start(time);
      subOsc.start(time);
      osc1.stop(time + duration + 0.01);
      osc2.stop(time + duration + 0.01);
      subOsc.stop(time + duration + 0.01);
    } catch {}
  }

  private triggerCyberLead(
    time: number,
    freq: number,
    duration: number,
    velocity: number,
    cutoffHz: number
  ): void {
    if (!this.ctx || !this.musicGain) return;
    try {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq, time);
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(freq * 1.005, time); // Rich chorus detune

      filter.type = 'lowpass';
      filter.Q.value = 2.2;
      filter.frequency.setValueAtTime(cutoffHz, time);
      filter.frequency.exponentialRampToValueAtTime(480, time + duration);

      gain.gain.setValueAtTime(velocity * 0.42, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + duration + 0.01);
      osc2.stop(time + duration + 0.01);
    } catch {}
  }

  private triggerPhonkCowbell(
    time: number,
    freq: number,
    duration: number,
    velocity: number
  ): void {
    if (!this.ctx || !this.musicGain) return;
    try {
      // Classic 808 cowbell uses two square oscillators at 1 : 1.504 ratio through bandpass filter
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc1.type = 'square';
      osc1.frequency.setValueAtTime(freq, time);
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(freq * 1.504, time);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(freq * 1.35, time);
      filter.Q.value = 3.5;

      gain.gain.setValueAtTime(velocity * 0.5, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + duration + 0.01);
      osc2.stop(time + duration + 0.01);
    } catch {}
  }

  private triggerChordStab(
    time: number,
    freqs: number[],
    duration: number,
    velocity: number
  ): void {
    if (!this.ctx || !this.musicGain) return;
    try {
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1600, time);
      filter.frequency.exponentialRampToValueAtTime(360, time + duration);

      gain.gain.setValueAtTime(velocity * 0.35, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      filter.connect(gain);
      gain.connect(this.musicGain);

      for (const f of freqs) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, time);
        osc.connect(filter);
        osc.start(time);
        osc.stop(time + duration + 0.01);
      }
    } catch {}
  }

  // ============================================================================
  // GAMEPLAY SOUND EFFECTS (SFX)
  // ============================================================================

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

  public playDriftPulse(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.isMuted) return;
    const now = ctx.currentTime;

    try {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1180, now);
      filter.Q.value = 4.5;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(340 + Math.random() * 60, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.12);

      g.gain.setValueAtTime(0.14, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

      osc.connect(filter);
      filter.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.14);
    } catch {}
  }

  public playRaceFinish(isWin: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || this.isMuted) return;
    const now = ctx.currentTime;

    const notes = isWin ? [523.25, 659.25, 783.99, 1046.5] : [440, 392, 349.23];
    notes.forEach((freq, idx) => {
      try {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        const startT = now + idx * 0.085;
        osc.frequency.setValueAtTime(freq, startT);

        g.gain.setValueAtTime(0.28, startT);
        g.gain.exponentialRampToValueAtTime(0.001, startT + 0.25);

        osc.connect(g);
        g.connect(this.sfxGain!);
        osc.start(startT);
        osc.stop(startT + 0.26);
      } catch {}
    });
  }
}

export const soundController = new SoundController();
