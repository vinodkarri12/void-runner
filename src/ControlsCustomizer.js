const STORAGE_KEY = 'void-runner-controls-custom-v2';

export const DEFAULT_LAYOUT = {
  preset: 'default',
  globalScale: 1.0,
  globalOpacity: 0.85,
  elements: {
    joystickZone: { anchor: 'bottom-left', x: 36, y: 36, size: 140, opacity: 0.88, visible: true, name: 'VIRTUAL JOYSTICK' },
    runButton: { anchor: 'bottom-left', x: 42, y: 196, size: 68, opacity: 0.88, visible: true, name: 'RUN BUTTON' },
    attackButton: { anchor: 'bottom-right', x: 38, y: 38, size: 88, opacity: 0.95, visible: true, name: 'DYNAMIC ATTACK' },
    dashAttackButton: { anchor: 'bottom-right', x: 146, y: 40, size: 66, opacity: 0.88, visible: true, name: 'BOOST / DASH' },
    jumpButton: { anchor: 'bottom-right', x: 36, y: 146, size: 64, opacity: 0.88, visible: true, name: 'JUMP' },
    crouchButton: { anchor: 'bottom-right', x: 136, y: 136, size: 58, opacity: 0.88, visible: true, name: 'SIT / CROUCH' },
    weaponSwitchButton: { anchor: 'bottom-right', x: 226, y: 38, size: 54, opacity: 0.88, visible: true, name: 'WEAPON SWITCH' },
    leftPanel: { anchor: 'top-left', x: 18, y: 110, size: 160, opacity: 0.95, visible: true, name: 'HEALTH & MINIMAP' },
    objectivePanel: { anchor: 'top-right', x: 18, y: 110, size: 180, opacity: 0.92, visible: true, name: 'OBJECTIVES' }
  }
};

export const PRESETS = {
  default: {
    name: 'DEFAULT (RIGHT-HANDED)',
    isLeftHanded: false,
    elements: {
      joystickZone: { anchor: 'bottom-left', x: 36, y: 36, size: 140 },
      runButton: { anchor: 'bottom-left', x: 42, y: 196, size: 68 },
      attackButton: { anchor: 'bottom-right', x: 38, y: 38, size: 88 },
      dashAttackButton: { anchor: 'bottom-right', x: 146, y: 40, size: 66 },
      jumpButton: { anchor: 'bottom-right', x: 36, y: 146, size: 64 },
      crouchButton: { anchor: 'bottom-right', x: 136, y: 136, size: 58 },
      weaponSwitchButton: { anchor: 'bottom-right', x: 226, y: 38, size: 54 }
    }
  },
  compact: {
    name: 'COMPACT',
    isLeftHanded: false,
    elements: {
      joystickZone: { anchor: 'bottom-left', x: 24, y: 24, size: 120 },
      runButton: { anchor: 'bottom-left', x: 30, y: 162, size: 58 },
      attackButton: { anchor: 'bottom-right', x: 26, y: 26, size: 76 },
      dashAttackButton: { anchor: 'bottom-right', x: 118, y: 30, size: 56 },
      jumpButton: { anchor: 'bottom-right', x: 26, y: 118, size: 56 },
      crouchButton: { anchor: 'bottom-right', x: 110, y: 110, size: 50 },
      weaponSwitchButton: { anchor: 'bottom-right', x: 186, y: 28, size: 48 }
    }
  },
  spread: {
    name: 'WIDE / SPREAD',
    isLeftHanded: false,
    elements: {
      joystickZone: { anchor: 'bottom-left', x: 50, y: 48, size: 154 },
      runButton: { anchor: 'bottom-left', x: 60, y: 226, size: 76 },
      attackButton: { anchor: 'bottom-right', x: 54, y: 50, size: 96 },
      dashAttackButton: { anchor: 'bottom-right', x: 176, y: 54, size: 74 },
      jumpButton: { anchor: 'bottom-right', x: 50, y: 172, size: 72 },
      crouchButton: { anchor: 'bottom-right', x: 164, y: 164, size: 66 },
      weaponSwitchButton: { anchor: 'bottom-right', x: 268, y: 52, size: 60 }
    }
  },
  'left-handed': {
    name: 'LEFT-HANDED MODE',
    isLeftHanded: true,
    elements: {
      joystickZone: { anchor: 'bottom-right', x: 36, y: 36, size: 140 },
      runButton: { anchor: 'bottom-right', x: 42, y: 196, size: 68 },
      attackButton: { anchor: 'bottom-left', x: 38, y: 38, size: 88 },
      dashAttackButton: { anchor: 'bottom-left', x: 146, y: 40, size: 66 },
      jumpButton: { anchor: 'bottom-left', x: 36, y: 146, size: 64 },
      crouchButton: { anchor: 'bottom-left', x: 136, y: 136, size: 58 },
      weaponSwitchButton: { anchor: 'bottom-left', x: 226, y: 38, size: 54 }
    }
  }
};

export class ControlsCustomizer {
  constructor(settingsManager, storage = globalThis.localStorage) {
    this.settingsManager = settingsManager;
    this.storage = storage;
    this.layout = this.loadLayout();
    this.isEditing = false;
    this.selectedElementId = null;
    this.dragContext = null;
    this.originalStateBeforeEdit = null;
    this.listeners = new Set();
  }

  loadLayout() {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return this.sanitizeLayout(parsed);
        }
      }
    } catch (err) {
      console.warn('ControlsCustomizer failed to load saved layout, using default:', err);
    }
    return JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
  }

  saveLayout() {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.layout));
    } catch (err) {
      console.warn('ControlsCustomizer failed to persist layout:', err);
    }
    this.notify();
  }

  sanitizeLayout(source) {
    const layout = JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
    if (source.preset && (source.preset in PRESETS || source.preset === 'custom')) {
      layout.preset = source.preset;
    }
    if (Number.isFinite(source.globalScale)) {
      layout.globalScale = Math.max(0.65, Math.min(1.4, source.globalScale));
    }
    if (Number.isFinite(source.globalOpacity)) {
      layout.globalOpacity = Math.max(0.2, Math.min(1.0, source.globalOpacity));
    }

    if (source.elements && typeof source.elements === 'object') {
      for (const [id, def] of Object.entries(DEFAULT_LAYOUT.elements)) {
        const srcElem = source.elements[id];
        if (srcElem && typeof srcElem === 'object') {
          layout.elements[id] = {
            ...def,
            x: Number.isFinite(srcElem.x) ? Math.max(0, srcElem.x) : def.x,
            y: Number.isFinite(srcElem.y) ? Math.max(0, srcElem.y) : def.y,
            size: Number.isFinite(srcElem.size) ? Math.max(36, Math.min(220, srcElem.size)) : def.size,
            opacity: Number.isFinite(srcElem.opacity) ? Math.max(0.2, Math.min(1.0, srcElem.opacity)) : def.opacity,
            visible: srcElem.visible !== false,
            anchor: srcElem.anchor || def.anchor
          };
        }
      }
    }
    return layout;
  }

  applyPreset(presetKey) {
    const preset = PRESETS[presetKey];
    if (!preset) return;
    this.layout.preset = presetKey;
    for (const [id, presetVals] of Object.entries(preset.elements)) {
      if (this.layout.elements[id]) {
        this.layout.elements[id] = {
          ...this.layout.elements[id],
          ...presetVals
        };
      }
    }
    this.applyToDOM();
    this.notify();
  }

  resetToDefault() {
    this.layout = JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
    this.saveLayout();
    this.applyToDOM();
    this.notify();
  }

  applyToDOM() {
    const isLeftHanded = this.layout.preset === 'left-handed' || PRESETS[this.layout.preset]?.isLeftHanded;
    document.body.classList.toggle('is-left-handed', Boolean(isLeftHanded));

    const globalScale = this.layout.globalScale || 1.0;
    const globalOpacity = this.layout.globalOpacity || 0.85;

    document.documentElement.style.setProperty('--mobile-ctrl-scale', String(globalScale));
    document.documentElement.style.setProperty('--mobile-ctrl-opacity', String(globalOpacity));

    for (const [id, cfg] of Object.entries(this.layout.elements)) {
      const el = document.getElementById(id) || document.querySelector(`.${id}`);
      if (!el) continue;

      if (cfg.visible === false) {
        el.style.display = 'none';
        continue;
      } else if (!this.isEditing) {
        el.style.display = '';
      }

      const opacity = cfg.opacity ?? globalOpacity;
      el.style.opacity = String(opacity);

      const size = (cfg.size || 64) * globalScale;

      // Positioning relative to anchor corner
      el.style.position = 'absolute';
      el.style.left = '';
      el.style.right = '';
      el.style.top = '';
      el.style.bottom = '';

      const x = cfg.x;
      const y = cfg.y;

      if (cfg.anchor === 'bottom-left') {
        el.style.left = `calc(${x}px + env(safe-area-inset-left, 0px))`;
        el.style.bottom = `calc(${y}px + env(safe-area-inset-bottom, 0px))`;
      } else if (cfg.anchor === 'bottom-right') {
        el.style.right = `calc(${x}px + env(safe-area-inset-right, 0px))`;
        el.style.bottom = `calc(${y}px + env(safe-area-inset-bottom, 0px))`;
      } else if (cfg.anchor === 'top-left') {
        el.style.left = `calc(${x}px + env(safe-area-inset-left, 0px))`;
        el.style.top = `calc(${y}px + env(safe-area-inset-top, 0px))`;
      } else if (cfg.anchor === 'top-right') {
        el.style.right = `calc(${x}px + env(safe-area-inset-right, 0px))`;
        el.style.top = `calc(${y}px + env(safe-area-inset-top, 0px))`;
      }

      // Sizing for controls (not full panels)
      if (id !== 'leftPanel' && id !== 'objectivePanel') {
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
      }
    }
  }

  startCustomization() {
    this.isEditing = true;
    this.originalStateBeforeEdit = JSON.parse(JSON.stringify(this.layout));
    document.body.classList.add('customizing-controls');

    const overlay = document.getElementById('controlsEditorOverlay');
    if (overlay) {
      overlay.hidden = false;
      overlay.classList.remove('hidden');
    }

    this.applyToDOM();
    this.attachEditorDraggers();
    this.updateEditorUI();
  }

  stopCustomization(save = true) {
    this.isEditing = false;
    document.body.classList.remove('customizing-controls');
    this.removeEditorDraggers();

    const overlay = document.getElementById('controlsEditorOverlay');
    if (overlay) {
      overlay.hidden = true;
      overlay.classList.add('hidden');
    }

    if (save) {
      this.saveLayout();
    } else if (this.originalStateBeforeEdit) {
      this.layout = this.originalStateBeforeEdit;
      this.applyToDOM();
    }
    this.originalStateBeforeEdit = null;
    this.selectedElementId = null;
  }

  attachEditorDraggers() {
    for (const id of Object.keys(this.layout.elements)) {
      const el = document.getElementById(id) || document.querySelector(`.${id}`);
      if (!el) continue;

      el.classList.add('customizable-element');

      const onPointerDown = (e) => {
        if (!this.isEditing) return;
        e.preventDefault();
        e.stopPropagation();

        this.selectedElementId = id;
        document.querySelectorAll('.customizable-element').forEach((c) => c.classList.remove('is-selected'));
        el.classList.add('is-selected');
        this.updateEditorUI();

        const rect = el.getBoundingClientRect();
        this.dragContext = {
          id,
          element: el,
          startX: e.clientX,
          startY: e.clientY,
          initialLeft: rect.left,
          initialTop: rect.top,
          width: rect.width,
          height: rect.height,
          anchor: this.layout.elements[id].anchor
        };

        try { el.setPointerCapture(e.pointerId); } catch (_) {}
      };

      const onPointerMove = (e) => {
        if (!this.dragContext || this.dragContext.id !== id) return;
        e.preventDefault();
        e.stopPropagation();

        const dx = e.clientX - this.dragContext.startX;
        const dy = e.clientY - this.dragContext.startY;

        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;

        let newLeft = Math.max(10, Math.min(viewportW - this.dragContext.width - 10, this.dragContext.initialLeft + dx));
        let newTop = Math.max(10, Math.min(viewportH - this.dragContext.height - 10, this.dragContext.initialTop + dy));

        const cfg = this.layout.elements[id];
        cfg.anchor = this.dragContext.anchor;

        // Convert viewport coordinates to anchor relative
        if (cfg.anchor === 'bottom-left') {
          cfg.x = Math.round(newLeft);
          cfg.y = Math.round(viewportH - (newTop + this.dragContext.height));
        } else if (cfg.anchor === 'bottom-right') {
          cfg.x = Math.round(viewportW - (newLeft + this.dragContext.width));
          cfg.y = Math.round(viewportH - (newTop + this.dragContext.height));
        } else if (cfg.anchor === 'top-left') {
          cfg.x = Math.round(newLeft);
          cfg.y = Math.round(newTop);
        } else if (cfg.anchor === 'top-right') {
          cfg.x = Math.round(viewportW - (newLeft + this.dragContext.width));
          cfg.y = Math.round(newTop);
        }

        this.layout.preset = 'custom';
        this.applyToDOM();
      };

      const onPointerUp = (e) => {
        if (this.dragContext && this.dragContext.id === id) {
          try { el.releasePointerCapture(e.pointerId); } catch (_) {}
          this.dragContext = null;
        }
      };

      el._customDown = onPointerDown;
      el._customMove = onPointerMove;
      el._customUp = onPointerUp;

      el.addEventListener('pointerdown', onPointerDown, { passive: false });
      el.addEventListener('pointermove', onPointerMove, { passive: false });
      el.addEventListener('pointerup', onPointerUp, { passive: false });
      el.addEventListener('pointercancel', onPointerUp, { passive: false });
    }
  }

  removeEditorDraggers() {
    for (const id of Object.keys(this.layout.elements)) {
      const el = document.getElementById(id) || document.querySelector(`.${id}`);
      if (!el) continue;
      el.classList.remove('customizable-element', 'is-selected');
      if (el._customDown) {
        el.removeEventListener('pointerdown', el._customDown);
        el.removeEventListener('pointermove', el._customMove);
        el.removeEventListener('pointerup', el._customUp);
        el.removeEventListener('pointercancel', el._customUp);
        delete el._customDown;
        delete el._customMove;
        delete el._customUp;
      }
    }
  }

  updateEditorUI() {
    const presetSelect = document.getElementById('editorPresetSelect');
    if (presetSelect) presetSelect.value = this.layout.preset || 'custom';

    const scaleSlider = document.getElementById('editorScaleSlider');
    const scaleVal = document.getElementById('editorScaleValue');
    if (scaleSlider) {
      scaleSlider.value = String(this.layout.globalScale || 1.0);
      if (scaleVal) scaleVal.textContent = `${Math.round((this.layout.globalScale || 1.0) * 100)}%`;
    }

    const opacitySlider = document.getElementById('editorOpacitySlider');
    const opacityVal = document.getElementById('editorOpacityValue');
    if (opacitySlider) {
      opacitySlider.value = String(this.layout.globalOpacity || 0.85);
      if (opacityVal) opacityVal.textContent = `${Math.round((this.layout.globalOpacity || 0.85) * 100)}%`;
    }

    const elemLabel = document.getElementById('editorSelectedLabel');
    const elemSizeSlider = document.getElementById('editorElemSizeSlider');
    const elemSizeVal = document.getElementById('editorElemSizeValue');

    if (this.selectedElementId && this.layout.elements[this.selectedElementId]) {
      const cfg = this.layout.elements[this.selectedElementId];
      if (elemLabel) elemLabel.textContent = cfg.name || this.selectedElementId;
      if (elemSizeSlider) {
        elemSizeSlider.disabled = false;
        elemSizeSlider.value = String(cfg.size || 64);
        if (elemSizeVal) elemSizeVal.textContent = `${cfg.size || 64}px`;
      }
    } else {
      if (elemLabel) elemLabel.textContent = 'TAP ANY BUTTON TO EDIT';
      if (elemSizeSlider) {
        elemSizeSlider.disabled = true;
        if (elemSizeVal) elemSizeVal.textContent = '--';
      }
    }
  }

  setSelectedElementSize(newSize) {
    if (!this.selectedElementId || !this.layout.elements[this.selectedElementId]) return;
    this.layout.elements[this.selectedElementId].size = Math.max(36, Math.min(220, newSize));
    this.layout.preset = 'custom';
    this.applyToDOM();
    this.updateEditorUI();
  }

  setGlobalScale(scale) {
    this.layout.globalScale = Math.max(0.65, Math.min(1.4, scale));
    this.layout.preset = 'custom';
    this.applyToDOM();
    this.updateEditorUI();
  }

  setGlobalOpacity(opacity) {
    this.layout.globalOpacity = Math.max(0.2, Math.min(1.0, opacity));
    this.layout.preset = 'custom';
    this.applyToDOM();
    this.updateEditorUI();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    for (const cb of this.listeners) {
      try { cb(this.layout); } catch (e) { console.error(e); }
    }
  }
}
