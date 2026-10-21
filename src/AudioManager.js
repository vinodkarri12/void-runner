export class AudioManager {
  constructor() {
    this.context = null;
    this.chargeOscillator = null;
    this.chargeGain = null;
    this.masterVolume = 0.7;
    this.sfxVolume = 0.9;
  }

  init() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume();
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    if (this.context.state === 'suspended') this.context.resume();
  }

  play(kind) {
    if (!this.context) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const settings = {
      strike: [230, 500, 0.11, 'triangle'],
      slash: [460, 180, 0.16, 'sawtooth'],
      dash: [150, 620, 0.18, 'sawtooth'],
      charge: [110, 75, 0.32, 'sine'],
      overdrive: [140, 760, 0.38, 'triangle'],
      hit: [300, 95, 0.12, 'square'],
      defeat: [430, 75, 0.3, 'triangle'],
      heal: [480, 880, 0.24, 'sine'],
      'player-hit': [160, 70, 0.16, 'square'],
      button: [520, 760, 0.05, 'sine'],
      'run-start': [140, 320, 0.14, 'triangle'],
      'run-stop': [260, 90, 0.10, 'sine'],
      'boost-start': [210, 580, 0.24, 'triangle'],
      'boost-exhaust': [190, 80, 0.18, 'sawtooth'],
      step: [95, 55, 0.06, 'triangle'],
      'sword-swing': [540, 190, 0.14, 'sawtooth'],
      'sword-swing-2': [680, 260, 0.13, 'sawtooth'],
      'sword-finisher': [780, 110, 0.30, 'sawtooth'],
      'katana-hit': [880, 120, 0.14, 'square'],
      'enemy-smoke': [220, 60, 0.26, 'sine']
    }[kind];
    if (!settings) return;
    oscillator.type = settings[3];
    oscillator.frequency.setValueAtTime(settings[0], now);
    oscillator.frequency.exponentialRampToValueAtTime(settings[1], now + settings[2]);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime((kind === 'heal' ? 0.045 : 0.12) * this.masterVolume * this.sfxVolume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + settings[2]);
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + settings[2] + 0.02);
  }

  setVolume(value, sfxVolume = this.sfxVolume) {
    this.masterVolume = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : this.masterVolume;
    this.sfxVolume = Number.isFinite(sfxVolume) ? Math.max(0, Math.min(1, sfxVolume)) : this.sfxVolume;
  }

  startCharge() {
    if (!this.context || this.chargeOscillator) return;
    const now = this.context.currentTime;
    this.chargeOscillator = this.context.createOscillator();
    this.chargeGain = this.context.createGain();
    this.chargeOscillator.type = 'sine';
    this.chargeOscillator.frequency.setValueAtTime(95, now);
    this.chargeGain.gain.setValueAtTime(0.0001, now);
    this.chargeGain.gain.linearRampToValueAtTime(0.035 * this.masterVolume * this.sfxVolume, now + 0.12);
    this.chargeOscillator.connect(this.chargeGain);
    this.chargeGain.connect(this.context.destination);
    this.chargeOscillator.start(now);
  }

  setChargeLevel(level) {
    if (!this.chargeOscillator || !this.context) return;
    const now = this.context.currentTime;
    this.chargeOscillator.frequency.setTargetAtTime(95 + level * 560, now, 0.08);
    this.chargeGain.gain.setTargetAtTime((0.025 + level * 0.045) * this.masterVolume * this.sfxVolume, now, 0.08);
  }

  stopCharge() {
    if (!this.chargeOscillator || !this.context) return;
    const oscillator = this.chargeOscillator;
    const gain = this.chargeGain;
    const now = this.context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(0.0001, now, 0.035);
    oscillator.stop(now + 0.16);
    this.chargeOscillator = null;
    this.chargeGain = null;
  }
}
