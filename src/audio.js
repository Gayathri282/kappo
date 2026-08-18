/* ==========================================================================
   WEB AUDIO API SOUND SYNTHESIZER
   Creates procedural crunch sounds, drop impacts, level-up chimes, and UI blips.
   ========================================================================== */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('kappo_muted') === 'true';
    this.musicMuted = localStorage.getItem('kappo_music_muted') === 'true';
    this.bgmInterval = null;
    this.bgmPlaying = false;
    this.bgmStep = 0;

    this.rustleBreakBuffer = null;
    this.crumbleLandingBuffer = null;
    this.chipsPacketRowPopBuffer = null;
    this.samplesLoading = false;
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
    this.loadAudioSamples();
  }

  async loadAudioSamples() {
    if (this.samplesLoading || !this.ctx) return;
    this.samplesLoading = true;

    try {
      const res1 = await fetch('/assets/chip_rustle_break.mp3');
      if (res1.ok) {
        const buf1 = await res1.arrayBuffer();
        this.rustleBreakBuffer = await this.ctx.decodeAudioData(buf1);
        console.log('[AudioEngine] Successfully loaded & decoded /assets/chip_rustle_break.mp3');
      }
    } catch (e) {
      console.warn('[AudioEngine] Could not decode chip_rustle_break.mp3:', e);
    }

    try {
      const res2 = await fetch('/assets/chip_crumble_landing.mp3');
      if (res2.ok) {
        const buf2 = await res2.arrayBuffer();
        this.crumbleLandingBuffer = await this.ctx.decodeAudioData(buf2);
        console.log('[AudioEngine] Successfully loaded & decoded /assets/chip_crumble_landing.mp3');
      }
    } catch (e) {
      console.warn('[AudioEngine] Could not decode chip_crumble_landing.mp3:', e);
    }

    try {
      const res3 = await fetch('/assets/freesound_community-chips-packet-63796.mp3');
      if (res3.ok) {
        const buf3 = await res3.arrayBuffer();
        this.chipsPacketRowPopBuffer = await this.ctx.decodeAudioData(buf3);
        console.log('[AudioEngine] Successfully loaded & decoded /assets/freesound_community-chips-packet-63796.mp3');
      }
    } catch (e) {
      console.warn('[AudioEngine] Could not decode freesound_community-chips-packet-63796.mp3:', e);
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

  toggleMusic() {
    this.musicMuted = !this.musicMuted;
    localStorage.setItem('kappo_music_muted', this.musicMuted);
    if (this.musicMuted) {
      this.stopBGM();
    } else {
      this.startBGM();
    }
    return this.musicMuted;
  }

  isMusicMuted() {
    return this.musicMuted;
  }

  // Upbeat, playful, bouncy background music loop using Web Audio API (Moderate tempo ~125 BPM)
  startBGM() {
    if (this.musicMuted || this.bgmPlaying) return;
    this.initContext();
    if (!this.ctx) return;

    this.bgmStep = 0;
    const melody = [523.25, 659.25, 783.99, 659.25, 880.00, 783.99, 659.25, 523.25, 587.33, 659.25, 783.99, 1046.50, 880.00, 783.99, 659.25, 587.33];
    const bass = [130.81, 130.81, 164.81, 164.81, 196.00, 196.00, 146.83, 146.83];

    const playNextBGMNote = () => {
      if (this.musicMuted || !this.bgmPlaying || !this.ctx) return;
      const now = this.ctx.currentTime;
      const melFreq = melody[this.bgmStep % melody.length];
      const bassFreq = bass[Math.floor(this.bgmStep / 2) % bass.length];
      this.bgmStep++;

      // Bouncy melody note
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(melFreq, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1600, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.035, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.18);

      // Playful bass note (every 2 steps)
      if (this.bgmStep % 2 === 1) {
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();

        bassOsc.type = 'sine';
        bassOsc.frequency.setValueAtTime(bassFreq, now);

        bassGain.gain.setValueAtTime(0.001, now);
        bassGain.gain.linearRampToValueAtTime(0.03, now + 0.04);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        bassOsc.connect(bassGain);
        bassGain.connect(this.ctx.destination);

        bassOsc.start(now);
        bassOsc.stop(now + 0.22);
      }
    };

    this.bgmPlaying = true;
    playNextBGMNote();
    this.bgmInterval = setInterval(() => playNextBGMNote(), 240);
  }

  stopBGM() {
    this.bgmPlaying = false;
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }

  pauseBGM() {
    this.stopBGM();
  }

  resumeBGM() {
    if (!this.musicMuted) {
      this.startBGM();
    }
  }

  /* --- SOUND EFFECTS --- */

  // 1. Line Clear / Row Break Sound (Authentic Chips Packet Breaking Crunch + Foil Crinkle)
  playCrunch(linesCleared = 1) {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // A. Real Chips Packet Audio Sample Break Burst (freesound chips packet / rustle break)
    if (this.chipsPacketRowPopBuffer || this.rustleBreakBuffer) {
      try {
        const sampleBuf = this.chipsPacketRowPopBuffer || this.rustleBreakBuffer;
        const src = this.ctx.createBufferSource();
        src.buffer = sampleBuf;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.85, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

        src.connect(gain);
        gain.connect(this.ctx.destination);
        src.start(now, 0, 0.35);
      } catch (e) {
        console.warn('[AudioEngine] Could not play chips packet break sample:', e);
      }
    }

    // B. Procedural Crisp Chips Packet Foil Rustle & Crunchy Potato Chip Transients
    const duration = 0.22 + linesCleared * 0.06;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      const env = Math.exp(-t * 9) + 0.35 * Math.exp(-Math.pow(t - 0.12, 2) * 40);
      const crackleSpike = Math.random() > 0.82 ? 2.8 : 0.7;
      output[i] = (Math.random() * 2 - 1) * env * crackleSpike;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3800 + linesCleared * 250, now);
    filter.Q.setValueAtTime(1.0, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.40, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);

    // C. Celebratory pitch chime accent
    const baseFreqs = [523.25, 659.25, 783.99, 1046.50];
    const countToPlay = Math.min(4, linesCleared + 1);

    for (let idx = 0; idx < countToPlay; idx++) {
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      const noteTime = now + idx * 0.04;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreqs[idx], noteTime);
      osc.frequency.exponentialRampToValueAtTime(baseFreqs[idx] * 1.2, noteTime + 0.12);

      oscGain.gain.setValueAtTime(0.12, noteTime);
      oscGain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.12);

      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);
      osc.start(noteTime);
      osc.stop(noteTime + 0.12);
    }
  }

  // 2. Full Crunch (4-line Tetris Jackpot Fanfare with Gentle Harmonies)
  playFullCrunch() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    this.playCrunch(4);

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // Soft C Major arpeggio

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const noteTime = now + idx * 0.07;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.15, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + 0.25);
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

  // 2b. Row-Break Loop (freesound_community-chips-packet-63796.mp3)
  startRowBreakRustleLoop() {
    console.log('row-clear sound: chips-packet-63796');
    if (this.muted) return;
    this.initContext();
    if (!this.ctx || !this.chipsPacketRowPopBuffer) return;

    this.stopRowBreakRustleLoop();

    try {
      this.rowPopLoopSource = this.ctx.createBufferSource();
      this.rowPopLoopSource.buffer = this.chipsPacketRowPopBuffer;
      this.rowPopLoopSource.loop = true;

      const gain = this.ctx.createGain();
      gain.gain.value = 0.45;

      this.rowPopLoopSource.connect(gain);
      gain.connect(this.ctx.destination);
      this.rowPopLoopSource.start(0);
    } catch (e) {
      console.warn('[AudioEngine] Could not start chips-packet-63796 row clear loop:', e);
    }
  }

  stopRowBreakRustleLoop() {
    if (this.rowPopLoopSource) {
      console.log('[AudioEngine] Stopping row-clear sound loop');
      try {
        this.rowPopLoopSource.stop();
        this.rowPopLoopSource.disconnect();
      } catch (e) {}
      this.rowPopLoopSource = null;
    }
  }

  // 1. Piece Placement Sound: High volume placement sound (gain 0.85) using chip_rustle_break.mp3
  playBagLanding() {
    console.log('placement sound: chip-rustle-break (volume 0.85)');
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    if (this.rustleBreakBuffer) {
      try {
        const src = this.ctx.createBufferSource();
        src.buffer = this.rustleBreakBuffer;
        const gain = this.ctx.createGain();
        gain.gain.value = 0.85; // High volume headroom
        src.connect(gain);
        gain.connect(this.ctx.destination);
        src.start(0);
      } catch (e) {
        console.warn('[AudioEngine] Could not play placement sound:', e);
      }
    }
  }

  // 2. Row Collapse / Settling Fall Sound (49603404-packets-of-chips-crumbling-331803.mp3)
  playRowCollapseSettle() {
    console.log('row-collapse fall sound: 49603404-packets-of-chips-crumbling-331803.mp3');
    if (this.muted) return;
    this.initContext();
    if (!this.ctx || !this.crumbleLandingBuffer) return;

    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this.crumbleLandingBuffer;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.45;
      src.connect(gain);
      gain.connect(this.ctx.destination);
      src.start(0);
    } catch (e) {
      console.warn('[AudioEngine] Could not play row-collapse crumble sound:', e);
    }
  }

  // 3b. Legacy playDrop wrapper
  playDrop() {
    this.playBagLanding();
  }

  // 3c. Subtle Plastic Packet Crinkle — sounds like crisp bag being crumpled/broken
  playSequentialPacketPops(totalItems = 10, stepMs = 30) {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    for (let i = 0; i < totalItems; i++) {
      setTimeout(() => {
        if (this.muted || !this.ctx) return;
        const now = this.ctx.currentTime;

        // === A: Plastic foil crinkle burst (very short filtered noise) ===
        const crinkleDur = 0.022 + Math.random() * 0.012; // 22-34ms
        const bufSz = Math.floor(this.ctx.sampleRate * crinkleDur);
        const buf = this.ctx.createBuffer(1, bufSz, this.ctx.sampleRate);
        const dat = buf.getChannelData(0);
        for (let k = 0; k < bufSz; k++) {
          // Sparse crackle: random impulses with exponential decay
          const t = k / bufSz;
          const env = Math.exp(-t * 14);
          // Mix of smooth noise + occasional sharper crackle spike
          dat[k] = (Math.random() * 2 - 1) * env * (Math.random() > 0.85 ? 2.2 : 0.7);
        }

        const crinkleNoise = this.ctx.createBufferSource();
        crinkleNoise.buffer = buf;

        // High-pass to cut muddiness, bandpass to shape "plastic foil" timbre
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(1800, now);

        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        // Slightly randomise centre freq per cell for natural variation
        bp.frequency.setValueAtTime(4200 + Math.random() * 1800, now);
        bp.Q.setValueAtTime(0.9, now);

        const crinkleGain = this.ctx.createGain();
        crinkleGain.gain.setValueAtTime(0.10, now);
        crinkleGain.gain.exponentialRampToValueAtTime(0.001, now + crinkleDur);

        crinkleNoise.connect(hp);
        hp.connect(bp);
        bp.connect(crinkleGain);
        crinkleGain.connect(this.ctx.destination);
        crinkleNoise.start(now);

        // === B: Tiny snap transient (like a single micro-crack in the foil) ===
        const snapDur = 0.006;
        const snapSz = Math.floor(this.ctx.sampleRate * snapDur);
        const snapBuf = this.ctx.createBuffer(1, snapSz, this.ctx.sampleRate);
        const snapDat = snapBuf.getChannelData(0);
        for (let k = 0; k < snapSz; k++) {
          snapDat[k] = (Math.random() * 2 - 1) * Math.exp(-k / (snapSz * 0.15));
        }
        const snap = this.ctx.createBufferSource();
        snap.buffer = snapBuf;
        const snapGain = this.ctx.createGain();
        snapGain.gain.setValueAtTime(0.08, now);
        snapGain.gain.exponentialRampToValueAtTime(0.001, now + snapDur);
        snap.connect(snapGain);
        snapGain.connect(this.ctx.destination);
        snap.start(now);

      }, i * stepMs);
    }
  }

  // 3d. Soothing Plastic Block Moving Down SFX (Soft Foil Crinkle + Air Glide)
  playMoveDown() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const duration = 0.04;

    if (this.lastMoveDownTime && (now - this.lastMoveDownTime) < 0.035) {
      return;
    }
    this.lastMoveDownTime = now;

    // A. Soft Plastic Foil Micro-Crinkle
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const noiseVal = (Math.random() * 2 - 1) * 0.35;
      output[i] = noiseVal * Math.exp(-i / (bufferSize * 0.4));
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3600, now);
    filter.Q.setValueAtTime(1.1, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.08, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noiseSource.start(now);

    // B. Subtle Pitched Air Glide
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + duration);

    oscGain.gain.setValueAtTime(0.05, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  // 3c. Chips Packet Step Breaking Sound (Sample playback + plastic foil crinkle & chip crunch)
  playBubblePop(stepIndex = 0) {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // A. Play real chips packet audio sample if decoded
    if (this.chipsPacketRowPopBuffer || this.rustleBreakBuffer) {
      try {
        const sampleBuf = this.chipsPacketRowPopBuffer || this.rustleBreakBuffer;
        const src = this.ctx.createBufferSource();
        src.buffer = sampleBuf;

        const pitch = 0.95 + (stepIndex % 7) * 0.05;
        src.playbackRate.setValueAtTime(pitch, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.75, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

        src.connect(gain);
        gain.connect(this.ctx.destination);

        const offset = (stepIndex * 0.07) % Math.max(0.1, sampleBuf.duration - 0.15);
        src.start(now, offset, 0.12);
      } catch (e) {}
    }

    // B. Layered procedural foil crinkle & chip crunch transient
    const duration = 0.06;
    const bufSize = Math.floor(this.ctx.sampleRate * duration);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const output = buf.getChannelData(0);

    for (let i = 0; i < bufSize; i++) {
      const t = i / bufSize;
      const env = Math.exp(-t * 12);
      const crackleSpike = Math.random() > 0.80 ? 2.5 : 0.6;
      output[i] = (Math.random() * 2 - 1) * env * crackleSpike;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;

    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(2200 + stepIndex * 140, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(hp);
    hp.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
  }

  // 3d. Soft Plastic Sliding / Squishing Sound (Chip bag pushed/squeezed, ~70ms, subtle)
  playMove() {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    if (now - (this.lastMoveTime || 0) < 0.04) return; // Non-fatiguing cooldown
    this.lastMoveTime = now;

    const duration = 0.07; // 70ms soft plastic squish/slide
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);

    // Filtered noise simulating smooth plastic foil friction
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      const env = Math.sin(t * Math.PI) * Math.exp(-t * 4); // Soft attack & smooth decay
      output[i] = (Math.random() * 2 - 1) * env;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;

    // Low-pass/band-pass filter to sound soft & squishy (no harsh crinkle tick)
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(700, now + duration);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.07, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noiseSource.start(now);

    // Subtle low pitch squish (trapped air inside packet squeezing)
    const squishOsc = this.ctx.createOscillator();
    const squishGain = this.ctx.createGain();
    squishOsc.type = 'sine';
    squishOsc.frequency.setValueAtTime(160, now);
    squishOsc.frequency.exponentialRampToValueAtTime(80, now + duration);

    squishGain.gain.setValueAtTime(0.05, now);
    squishGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    squishOsc.connect(squishGain);
    squishGain.connect(this.ctx.destination);
    squishOsc.start(now);
    squishOsc.stop(now + duration);
  }

  // Legacy wrappers for move down & rotate using the soft plastic squish
  playMoveDown() {
    this.playMove();
  }

  playRotate() {
    this.playMove();
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

  // 7. Rich Arcade Game Over Sound Sequence (Classic 4-step descending melody + pitch bend + sub-bass thud)
  playGameOver() {
    console.log('[AudioEngine] Game Over -> playing 4-note descending arcade game-over sequence');
    if (this.muted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // A. Classic Retro Arcade Descending 4-Tone Sequence (D#4 -> D4 -> C#4 -> C4 with sad pitch bend)
    const notes = [311.13, 293.66, 277.18, 261.63];
    const stepDuration = 0.18; // 180ms per note

    notes.forEach((freq, i) => {
      const startTime = now + i * stepDuration;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = i === 3 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      // Sad pitch bend on each note
      osc.frequency.exponentialRampToValueAtTime(freq * 0.91, startTime + stepDuration);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, startTime);
      filter.frequency.exponentialRampToValueAtTime(400, startTime + stepDuration);

      const gainVal = i === 3 ? 0.35 : 0.22;
      gain.gain.setValueAtTime(gainVal, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + (i === 3 ? 0.45 : stepDuration));

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + (i === 3 ? 0.45 : stepDuration));
    });

    // B. Low Sub-Bass Decompression Thud (150Hz -> 35Hz over 0.8s)
    const bassOsc = this.ctx.createOscillator();
    const bassGain = this.ctx.createGain();

    bassOsc.type = 'sine';
    bassOsc.frequency.setValueAtTime(150, now);
    bassOsc.frequency.exponentialRampToValueAtTime(35, now + 0.8);

    bassGain.gain.setValueAtTime(0.28, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    bassOsc.connect(bassGain);
    bassGain.connect(this.ctx.destination);

    bassOsc.start(now);
    bassOsc.stop(now + 0.8);
  }
}

export const sound = new SoundEngine();
