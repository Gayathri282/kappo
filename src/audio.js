/* ==========================================================================
   WEB AUDIO API SOUND SYNTHESIZER
   Creates procedural crunch sounds, drop impacts, level-up chimes, and UI blips.
   ========================================================================== */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('kappo_muted') === 'true';
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('kappo_muted', this.muted);
    return this.muted;
  }

  isMuted() {
    return this.muted;
  }

  /* --- SOUND EFFECTS --- */

  // 1. Line Clear / Crunch Sound (Procedural white-noise bursts)
  playCrunch(linesCleared = 1) {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const duration = 0.15 + linesCleared * 0.05;

    // Create noise buffer for crunch feel
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      // Crackle bursts pattern
      const crackle = Math.random() < 0.3 ? (Math.random() * 2 - 1) : (Math.random() * 0.4 - 0.2);
      output[i] = crackle * Math.exp(-i / (bufferSize * 0.4));
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    // Highpass & Bandpass filtering to sound like crispy potato/banana chips
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2500 + linesCleared * 500, now);
    filter.Q.setValueAtTime(1.5, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    whiteNoise.start(now);

    // Add tone pop accent
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300 + linesCleared * 120, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + duration);

    oscGain.gain.setValueAtTime(0.2, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  // 2. Full Crunch (4-line Tetris Jackpot Fanfare)
  playFullCrunch() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    this.playCrunch(4);

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 arpeggio

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const noteTime = now + idx * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.3, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + 0.3);
    });
  }

  // 2b. Distinct "Big Crunch" Mono-Flavor Sound Effect (Full Batch Clear)
  playMonoCrunch(monoCount = 1) {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const duration = 0.35 + monoCount * 0.1;

    // Sub-bass impact thud
    const bassOsc = this.ctx.createOscillator();
    const bassGain = this.ctx.createGain();
    bassOsc.type = 'sine';
    bassOsc.frequency.setValueAtTime(220 + monoCount * 40, now);
    bassOsc.frequency.exponentialRampToValueAtTime(35, now + duration);

    bassGain.gain.setValueAtTime(0.6, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    bassOsc.connect(bassGain);
    bassGain.connect(this.ctx.destination);
    bassOsc.start(now);
    bassOsc.stop(now + duration);

    // Enhanced procedural crunch burst
    this.playCrunch(2 + monoCount);

    // Triumphant shimmer chord
    const baseFreqs = monoCount > 1 ? [523.25, 659.25, 783.99, 1046.50, 1318.51] : [587.33, 739.99, 880.00, 1174.66]; // D Major / C Major chord
    baseFreqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const noteTime = now + idx * 0.06;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.35, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + 0.35);
    });
  }

  // 3. Realistic Plastic Chip Bag Landing SFX (Crinkle + Thud)
  playBagLanding() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const duration = 0.12;

    // A. Plastic Foil Crinkle Noise Burst
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const crackle = Math.random() < 0.4 ? (Math.random() * 2 - 1) : (Math.random() * 0.2 - 0.1);
      output[i] = crackle * Math.exp(-i / (bufferSize * 0.3));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(3200, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(now);

    // B. Puffed Bag Cushion Thud
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + duration);

    oscGain.gain.setValueAtTime(0.28, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  // 3b. Legacy playDrop wrapper
  playDrop() {
    this.playBagLanding();
  }

  // 3c. Sequential Plastic Crinkle/Pop Sequence across Row
  playSequentialPacketPops(totalItems = 10, stepMs = 35) {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    for (let i = 0; i < totalItems; i++) {
      setTimeout(() => {
        if (this.muted || !this.ctx) return;
        const now = this.ctx.currentTime;
        const pitchMultiplier = 1.0 + (i / totalItems) * 0.5;

        // Plastic pop frequency
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400 * pitchMultiplier, now);
        osc.frequency.exponentialRampToValueAtTime(150 * pitchMultiplier, now + 0.04);

        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.04);

        // Crinkle click burst
        const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.03), this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let k = 0; k < data.length; k++) {
          data[k] = (Math.random() * 2 - 1) * Math.exp(-k / (data.length * 0.2));
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const nFilter = this.ctx.createBiquadFilter();
        nFilter.type = 'bandpass';
        nFilter.frequency.setValueAtTime(3500 * pitchMultiplier, now);
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.25, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

        noise.connect(nFilter);
        nFilter.connect(nGain);
        nGain.connect(this.ctx.destination);
        noise.start(now);
      }, i * stepMs);
    }
  }

  // 4. Piece Rotate Tick
  playRotate() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.setValueAtTime(1200, now + 0.02);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  // 5. Hold Piece Swoosh
  playHold() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.12);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  // 6. Level Up Chime
  playLevelUp() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const time = now + idx * 0.06;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.25, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(time);
      osc.stop(time + 0.25);
    });
  }

  // 7. Game Over Collapse Sound
  playGameOver() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.6);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  }
}

export const sound = new SoundEngine();
