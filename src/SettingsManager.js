const STORAGE_KEY = 'void-runner-settings-v1';

const DEFAULTS = Object.freeze({
  masterVolume: 0.7,
  sfxVolume: 0.9,
  sensitivity: 1,
  joystickSensitivity: 1,
  joystickDeadzone: 0.15,
  controlScale: 1,
  cameraFollow: 1,
  cameraShake: 1,
  screenFlash: 1,
  motionBlur: 0.75,
  reducedEffects: false,
  graphics: 'high'
});

export class SettingsManager {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.values = { ...DEFAULTS };
    try {
      const saved = this.storage?.getItem(STORAGE_KEY);
      if (saved) this.values = { ...DEFAULTS, ...JSON.parse(saved) };
    } catch (error) {
      console.warn('VOID RUNNER settings could not be loaded.', error);
    }
    this.validate();
  }

  validate() {
    for (const key of ['masterVolume', 'sfxVolume', 'sensitivity', 'cameraFollow', 'cameraShake', 'screenFlash', 'motionBlur']) {
      const value = Number(this.values[key]);
      this.values[key] = Number.isFinite(value) ? Math.max(0, Math.min(key === 'masterVolume' ? 1 : 2, value)) : DEFAULTS[key];
    }
    const joySens = Number(this.values.joystickSensitivity);
    this.values.joystickSensitivity = Number.isFinite(joySens) ? Math.max(0.4, Math.min(2.5, joySens)) : DEFAULTS.joystickSensitivity;

    const joyDead = Number(this.values.joystickDeadzone);
    this.values.joystickDeadzone = Number.isFinite(joyDead) ? Math.max(0.04, Math.min(0.35, joyDead)) : DEFAULTS.joystickDeadzone;

    const ctrlScale = Number(this.values.controlScale);
    this.values.controlScale = Number.isFinite(ctrlScale) ? Math.max(0.75, Math.min(1.4, ctrlScale)) : DEFAULTS.controlScale;

    this.values.reducedEffects = Boolean(this.values.reducedEffects);
    if (!['low', 'medium', 'high'].includes(this.values.graphics)) this.values.graphics = DEFAULTS.graphics;
  }

  set(key, value) {
    if (!(key in DEFAULTS)) return;
    this.values[key] = value;
    this.validate();
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.values));
    } catch (error) {
      console.warn('VOID RUNNER settings could not be saved.', error);
    }
  }
}
