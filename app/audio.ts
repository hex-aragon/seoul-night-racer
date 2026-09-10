// Original score: "Han River Afterglow". No samples or third-party melodies.
// Music composition and synthesized audio are dedicated to CC0; see public/AUDIO-CREDITS.md.
export class DriveAudio {
  private ctx?: AudioContext;
  private musicBus?: GainNode;
  private engineBus?: GainNode;
  private oscillators: OscillatorNode[] = [];
  private filter?: BiquadFilterNode;
  private noise?: AudioBuffer;
  private musicSource?: AudioBufferSourceNode;
  private disposed = false;
  private playing = false;
  private gear = 1;
  private shiftUntil = 0;
  musicVolume = 0.5;
  engineVolume = 0.65;
  async unlock() {
    if (!this.ctx) this.init();
    await this.ctx!.resume();
  }
  private init() {
    const c = new AudioContext();
    this.ctx = c;
    const compressor = c.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.ratio.value = 5;
    compressor.connect(c.destination);
    this.musicBus = c.createGain();
    this.musicBus.gain.value = 0;
    this.musicBus.connect(compressor);
    this.engineBus = c.createGain();
    this.engineBus.gain.value = 0;
    this.engineBus.connect(compressor);
    this.filter = c.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 850;
    this.filter.Q.value = 0.7;
    this.filter.connect(this.engineBus);
    const real = new Float32Array(24),
      imag = new Float32Array(24);
    for (let i = 1; i < 24; i++)
      imag[i] = (Math.exp(-i / 7) * (i % 4 === 0 ? 1 : 0.32)) / i;
    const wave = c.createPeriodicWave(real, imag);
    for (let i = 0; i < 3; i++) {
      const o = c.createOscillator(),
        g = c.createGain();
      if (i < 2) o.setPeriodicWave(wave);
      else o.type = 'triangle';
      g.gain.value = i === 2 ? 0.3 : 0.75;
      o.connect(g);
      g.connect(this.filter);
      o.start();
      this.oscillators.push(o);
    }
    const noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate),
      data = noise.getChannelData(0);
    let seed = 42;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[i] = ((seed / 4294967296) * 2 - 1) * 0.8;
    }
    this.noise = noise;
    void this.renderMusic()
      .then((buffer) => {
        if (this.disposed) return;
        const source = c.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(this.musicBus!);
        source.start();
        this.musicSource = source;
      })
      .catch((error) => console.warn('Music rendering failed', error));
  }
  setVolumes(music: number, engine: number) {
    this.musicVolume = music;
    this.engineVolume = engine;
  }
  update(
    speed: number,
    gear: number,
    throttle: boolean,
    boost: boolean,
    mode: string,
  ) {
    if (!this.ctx) return;
    const c = this.ctx;
    const active = mode === 'racing';
    this.playing = active || mode === 'ready';
    this.musicBus!.gain.setTargetAtTime(
      this.playing ? this.musicVolume * 0.28 : 0,
      c.currentTime,
      0.2,
    );
    this.engineBus!.gain.setTargetAtTime(
      active ? this.engineVolume * (throttle ? 0.65 : 0.34) : 0,
      c.currentTime,
      0.08,
    );
    if (gear !== this.gear) {
      this.shiftUntil = c.currentTime + 0.15;
      this.gear = gear;
    }
    const low = (gear - 1) * 46,
      rpm =
        gear === 1
          ? 1000 + Math.min(1, speed / 46) * 6400
          : 4200 + Math.max(0, Math.min(1, (speed - low) / 46)) * 3200;
    const shift = c.currentTime < this.shiftUntil ? 0.76 : 1;
    this.oscillators[0].frequency.setTargetAtTime(
      (rpm / 60) * 4 * shift,
      c.currentTime,
      0.065,
    );
    this.oscillators[1].frequency.setTargetAtTime(
      (rpm / 60) * 2.012 * shift,
      c.currentTime,
      0.075,
    );
    this.oscillators[2].frequency.setTargetAtTime(
      (rpm / 60) * 0.5,
      c.currentTime,
      0.08,
    );
    this.filter!.frequency.setTargetAtTime(
      450 + rpm * 0.22 + (boost ? 700 : 0) + (throttle ? 400 : 0),
      c.currentTime,
      0.1,
    );
  }
  private note(
    midi: number,
    time: number,
    duration: number,
    volume: number,
    type: OscillatorType = 'sine',
    detune = 0,
  ) {
    const c = this.ctx!,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = type;
    o.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    o.detune.value = detune;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(volume, time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, time + duration);
    o.connect(g);
    g.connect(this.musicBus!);
    o.start(time);
    o.stop(time + duration + 0.02);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  private drum(kind: 'kick' | 'snare' | 'hat', time: number) {
    const c = this.ctx!,
      g = c.createGain();
    g.connect(this.musicBus!);
    if (kind === 'kick') {
      const o = c.createOscillator();
      o.frequency.setValueAtTime(140, time);
      o.frequency.exponentialRampToValueAtTime(44, time + 0.13);
      g.gain.setValueAtTime(0.85, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
      o.connect(g);
      o.start(time);
      o.stop(time + 0.24);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
      };
    } else {
      const n = c.createBufferSource(),
        f = c.createBiquadFilter();
      n.buffer = this.noise!;
      f.type = 'highpass';
      f.frequency.value = kind === 'hat' ? 7500 : 1500;
      g.gain.setValueAtTime(kind === 'hat' ? 0.1 : 0.32, time);
      g.gain.exponentialRampToValueAtTime(
        0.001,
        time + (kind === 'hat' ? 0.045 : 0.14),
      );
      n.connect(f);
      f.connect(g);
      n.start(time);
      n.stop(time + 0.16);
      n.onended = () => {
        n.disconnect();
        f.disconnect();
        g.disconnect();
      };
    }
  }
  private async renderMusic() {
    const offline = new OfflineAudioContext(
      2,
      Math.ceil(((128 * 60) / 104 / 4) * 44100),
      44100,
    );
    const composer = Object.create(DriveAudio.prototype) as DriveAudio;
    composer.ctx = offline as unknown as AudioContext;
    composer.musicBus = offline.createGain();
    composer.musicBus.gain.value = 1;
    composer.musicBus.connect(offline.destination);
    const noise = offline.createBuffer(1, 44100 * 2, 44100),
      data = noise.getChannelData(0);
    let seed = 42;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[i] = ((seed / 4294967296) * 2 - 1) * 0.8;
    }
    composer.noise = noise;
    for (let step = 0; step < 128; step++)
      composer.composeStep(step, (step * 60) / 104 / 4);
    return offline.startRendering();
  }
  private composeStep(step: number, next: number) {
    const n = step % 128,
      bar = Math.floor(n / 16),
      beat = n % 16,
      chords = [
        [53, 57, 60, 64],
        [55, 59, 62, 65],
        [52, 55, 59, 62],
        [57, 60, 64, 67],
        [50, 53, 57, 60],
        [55, 59, 62, 65],
        [48, 52, 55, 59],
        [57, 61, 64, 67],
      ],
      chord = chords[bar],
      time = next + (beat % 2 ? 0.012 : 0);
    if ([0, 6, 10].includes(beat)) {
      for (const note of chord) {
        this.note(note + 12, time, 0.65, 0.095, 'sine');
        this.note(note + 24, time, 0.28, 0.025, 'triangle');
      }
    }
    if ([0, 3, 6, 8, 11, 14].includes(beat))
      this.note(
        chord[0] - 12 + (beat === 14 ? 7 : beat === 11 ? 12 : 0),
        time,
        0.21,
        0.38,
        'triangle',
      );
    if ([0, 7, 8].includes(beat)) this.drum('kick', time);
    if (beat === 4 || beat === 12) this.drum('snare', time);
    if (beat % 2 === 0 || beat === 15) this.drum('hat', time);
    const melody = [0, 4, 7, 11, 7, 4, 2, 0, 7, 9, 11, 14, 11, 7, 4, 2];
    if (bar >= 2 && beat % 2 === 0) {
      const m = chord[0] + 24 + melody[(bar * 3 + beat / 2) % melody.length];
      this.note(m, time, 0.24, 0.08, 'triangle', -4);
      this.note(m, time + 0.008, 0.32, 0.035, 'sine', 5);
      this.note(m, time + 0.22, 0.18, 0.019, 'sine');
    }
  }
  crash() {
    if (!this.ctx || !this.noise) return;
    const c = this.ctx,
      n = c.createBufferSource(),
      gain = c.createGain(),
      filter = c.createBiquadFilter();
    n.buffer = this.noise;
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    gain.gain.setValueAtTime(this.engineVolume * 0.4, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4);
    n.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    n.start();
    n.stop(c.currentTime + 0.42);
    n.onended = () => {
      n.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
  get diagnostics() {
    return {
      context: this.ctx?.state || 'locked',
      musicReady: !!this.musicSource,
      position: this.ctx?.currentTime || 0,
    };
  }
  dispose() {
    this.disposed = true;
    this.musicSource?.stop();
    this.oscillators.forEach((o) => o.stop());
    void this.ctx?.close();
  }
}
