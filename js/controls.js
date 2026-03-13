const values = {
  toolMode: 'Sculpt',
  vasePreset: 'classic',
  profileSmoothing: 34,
  latheSegments: 64,
  showHandles: true,
  handleThickness: 10,
  baseColor: '#55bf40',
  roughness: 40,
  metalness: 0,
  envMap: 'Sunset',
  wheelSpeed: 25,
  brushSize: 1,
  brushColor: '#f26363',
  brushOpacity: 100,
  eraser: false,
  stickerScale: 61,
  stickerRotation: 0,
  stickerRandomize: true
};

const listeners = {};
const actions = {};

export const controls = {
  get(key) { return values[key]; },
  set(key, value) {
    values[key] = value;
    if (listeners[key]) {
      listeners[key].forEach(fn => fn(value));
    }
  },
  getAll() { return { ...values }; },
  onChange(key, fn) {
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(fn);
  },
  onAction(name, fn) {
    if (!actions[name]) actions[name] = [];
    actions[name].push(fn);
  },
  fireAction(name) {
    if (actions[name]) {
      actions[name].forEach(fn => fn());
    }
  }
};
