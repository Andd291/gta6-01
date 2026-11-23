// All sound is synthesised with WebAudio — no audio files, no network. The context is
// created on the first user gesture (browsers block audio before one).

export function createAudio() {
  let ctx = null;
  let master = null;
  let sirenNodes = null;
  let engineNodes = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  return {
    /** Call from any user gesture so later sounds are allowed. */
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    shoot() {
      noise(0.12, 0.5, 2800);
      tone(190, 0.09, 'square', 0.22, 60);
    },
    punch() {
      tone(120, 0.12, 'sine', 0.5, 45);
      noise(0.06, 0.25, 500);
    },
    crash() {
      noise(0.25, 0.5, 700);
      tone(90, 0.2, 'sine', 0.4, 40);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.3);
      setTimeout(() => tone(990, 0.12, 'sine', 0.3), 70);
    },
    cash() {
      tone(880, 0.08, 'triangle', 0.3);
      setTimeout(() => tone(1174, 0.08, 'triangle', 0.3), 60);
      setTimeout(() => tone(1568, 0.16, 'triangle', 0.3), 120);
    },
    mission() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.32), i * 90));
    },
    fail() {
      tone(220, 0.3, 'sawtooth', 0.25, 110);
    },
    wasted() {
      [392, 311, 233].forEach((f, i) => setTimeout(() => tone(f, 0.35, 'sawtooth', 0.25), i * 200));
    },
    /** Two-tone police siren while wanted; call with the wanted level, 0 stops it. */
    siren(level) {
      if (!ensure()) return;
      if (level <= 0) {
        if (sirenNodes) {
          try { sirenNodes.osc.stop(); } catch { /* already stopped */ }
          sirenNodes.gain.disconnect();
          sirenNodes = null;
        }
        return;
      }
      if (sirenNodes) return;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 720;
      const gain = ctx.createGain();
      gain.gain.value = 0.05;
      const lfo = ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 0.55;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 190;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      lfo.start();
      sirenNodes = { osc, gain, lfo };
    },
    /** Engine hum while driving; speed01 is 0..1 of top speed, 0 stops it. */
    engine(speed01) {
      if (!ensure()) return;
      if (speed01 <= 0.02) {
        if (engineNodes) {
          try { engineNodes.osc.stop(); } catch { /* already stopped */ }
          engineNodes.gain.disconnect();
          engineNodes = null;
        }
        return;
      }
      if (!engineNodes) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 70;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500;
        const gain = ctx.createGain();
        gain.gain.value = 0.05;
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        osc.start();
        engineNodes = { osc, gain };
      }
      engineNodes.osc.frequency.value = 55 + speed01 * 165;
      engineNodes.gain.gain.value = 0.03 + speed01 * 0.05;
    },
  };
}
