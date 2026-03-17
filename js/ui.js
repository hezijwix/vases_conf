import * as THREE from 'https://esm.sh/three@0.170.0';
import { controls } from './controls.js';
import {
  initEngine, renderer, camera, scene, wheelGroup,
  PRESETS, buildVase, buildHandles, getVaseMesh,
  setCurrentProfile, setProfileDirty, isProfileDirty,
  getHandleMeshes, setHandleProfile, setHandleDirty, isHandleDirty,
  vaseMaterial, fillBaseColor, compositeTexture, TEX,
  stickerCtx,
  getUV, paint, interpolatedPaint, mouseNDC, raycaster,
  STICKER_PATHS, stickerImages, placeSticker, setSelectedStickerIndex,
  exportGLB, exportPNG
} from './engine.js';
import {
  initProfileEditor, initHandleEditor,
  drawProfileEditor, drawHandleEditor,
  getHandleEditorWrap
} from './editors.js';

// =========================================================
// Initialize Engine
// =========================================================

const area = document.getElementById('canvas-area');
initEngine(area);

// =========================================================
// UI Helper Functions
// =========================================================

function createSlider(label, key, min, max, step = 1) {
  let curMin = min;
  let curMax = max;

  const group = document.createElement('div');
  group.className = 'control-group';

  // Label row: [Name] ... [min — max]
  const labelRow = document.createElement('div');
  labelRow.className = 'slider-label-row';

  const lbl = document.createElement('label');
  lbl.className = 'control-label';
  lbl.style.marginBottom = '0';
  lbl.textContent = label;

  const rangeRow = document.createElement('div');
  rangeRow.className = 'slider-range';

  const minInput = document.createElement('input');
  minInput.type = 'number';
  minInput.value = curMin;

  const rangeSep = document.createElement('span');
  rangeSep.textContent = '—';

  const maxInput = document.createElement('input');
  maxInput.type = 'number';
  maxInput.value = curMax;

  rangeRow.append(minInput, rangeSep, maxInput);
  labelRow.append(lbl, rangeRow);

  // Slider pill
  const wrap = document.createElement('div');
  wrap.className = 'slider-wrap';

  const fill = document.createElement('div');
  fill.className = 'slider-fill';

  const valueOverlay = document.createElement('div');
  valueOverlay.className = 'slider-value-overlay';
  valueOverlay.textContent = controls.get(key);

  const input = document.createElement('input');
  input.type = 'range';
  input.min = curMin;
  input.max = curMax;
  input.step = step;
  input.value = controls.get(key);

  function updateFill(val) {
    const pct = curMax > curMin ? ((val - curMin) / (curMax - curMin)) * 100 : 0;
    const clampedPct = Math.max(0, Math.min(100, pct));
    fill.style.width = clampedPct + '%';
    valueOverlay.textContent = val;
    valueOverlay.style.backgroundImage =
      `linear-gradient(90deg, #fff 0%, #fff ${clampedPct}%, #000 ${clampedPct}%, #000 100%)`;
  }

  updateFill(controls.get(key));

  input.addEventListener('input', () => {
    const val = parseFloat(input.value);
    updateFill(val);
    controls.set(key, val);
  });

  controls.onChange(key, (val) => {
    input.value = val;
    updateFill(val);
  });

  function applyRange() {
    const newMin = parseFloat(minInput.value);
    const newMax = parseFloat(maxInput.value);
    if (isNaN(newMin) || isNaN(newMax) || newMax <= newMin) {
      rangeRow.classList.add('slider-shake');
      setTimeout(() => rangeRow.classList.remove('slider-shake'), 300);
      minInput.value = curMin;
      maxInput.value = curMax;
      return;
    }
    curMin = newMin;
    curMax = newMax;
    input.min = curMin;
    input.max = curMax;
    // Clamp current value
    let val = parseFloat(input.value);
    if (val < curMin) { val = curMin; input.value = val; controls.set(key, val); }
    if (val > curMax) { val = curMax; input.value = val; controls.set(key, val); }
    updateFill(val);
  }

  minInput.addEventListener('change', applyRange);
  maxInput.addEventListener('change', applyRange);

  wrap.appendChild(fill);
  wrap.appendChild(valueOverlay);
  wrap.appendChild(input);
  group.appendChild(labelRow);
  group.appendChild(wrap);
  return group;
}

function createColorPicker(label, key) {
  const group = document.createElement('div');
  group.className = 'control-group';

  const lbl = document.createElement('label');
  lbl.className = 'control-label';
  lbl.textContent = label;

  const input = document.createElement('input');
  input.type = 'color';
  input.value = controls.get(key);

  input.addEventListener('input', () => {
    controls.set(key, input.value);
  });

  controls.onChange(key, (val) => {
    input.value = val;
  });

  group.appendChild(lbl);
  group.appendChild(input);
  return group;
}

function createToggle(label, key) {
  const group = document.createElement('div');
  group.className = 'control-group';

  const wrap = document.createElement('div');
  wrap.className = 'toggle-wrap';

  const lbl = document.createElement('span');
  lbl.className = 'control-label';
  lbl.style.marginBottom = '0';
  lbl.textContent = label;

  const toggle = document.createElement('div');
  toggle.className = 'toggle' + (controls.get(key) ? ' on' : '');

  toggle.addEventListener('click', () => {
    const newVal = !controls.get(key);
    controls.set(key, newVal);
    toggle.classList.toggle('on', newVal);
  });

  controls.onChange(key, (val) => {
    toggle.classList.toggle('on', val);
  });

  wrap.appendChild(lbl);
  wrap.appendChild(toggle);
  group.appendChild(wrap);
  return group;
}

function createSelect(label, key, options) {
  const group = document.createElement('div');
  group.className = 'control-group';

  const lbl = document.createElement('label');
  lbl.className = 'control-label';
  lbl.textContent = label;

  const select = document.createElement('select');
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = typeof opt === 'string' ? opt : opt.value;
    o.textContent = typeof opt === 'string' ? opt : opt.label;
    if (o.value === String(controls.get(key))) o.selected = true;
    select.appendChild(o);
  }

  select.addEventListener('change', () => {
    controls.set(key, select.value);
  });

  controls.onChange(key, (val) => {
    select.value = val;
  });

  group.appendChild(lbl);
  group.appendChild(select);
  return group;
}

function createButton(label, actionName) {
  const group = document.createElement('div');
  group.className = 'control-group';

  const btn = document.createElement('button');
  btn.className = 'action-btn';
  btn.textContent = label;
  btn.addEventListener('click', () => controls.fireAction(actionName));

  group.appendChild(btn);
  return group;
}

function createSectionTitle(text) {
  const title = document.createElement('div');
  title.className = 'section-title';
  title.textContent = text;
  return title;
}

function createSectionCard(title, children) {
  const card = document.createElement('div');
  card.className = 'section-card';
  if (title) card.appendChild(createSectionTitle(title));
  for (const child of children) card.appendChild(child);
  return card;
}

// =========================================================
// Build Toolbar
// =========================================================

const toolbar = document.getElementById('toolbar');

// Header
const header = document.createElement('div');
header.className = 'toolbar-header';
header.textContent = 'Vase Designer';
toolbar.appendChild(header);

// Mode tabs
const tabsDiv = document.createElement('div');
tabsDiv.className = 'mode-tabs';
const MODES = ['Sculpt', 'Draw', 'Stick'];
const tabElements = {};
const panelElements = {};

for (const mode of MODES) {
  const tab = document.createElement('button');
  tab.className = 'mode-tab' + (mode === 'Sculpt' ? ' active' : '');
  tab.textContent = mode;
  tab.dataset.mode = mode;
  tab.addEventListener('click', () => controls.set('toolMode', mode));
  tabsDiv.appendChild(tab);
  tabElements[mode] = tab;
}
toolbar.appendChild(tabsDiv);

// Create panels
for (const mode of MODES) {
  const panel = document.createElement('div');
  panel.className = 'mode-panel' + (mode === 'Sculpt' ? ' active' : '');
  panelElements[mode] = panel;
  toolbar.appendChild(panel);
}

// ---- Sculpt Panel ----
const sculptPanel = panelElements['Sculpt'];

// Shape card
const shapeCard = createSectionCard('Shape', [
  createSelect('Vase Preset', 'vasePreset', [
    'classic', 'tall', 'bowl', 'urn', 'bottle', 'wide'
  ]),
  createSlider('Profile Smoothing', 'profileSmoothing', 0, 100),
  createSlider('Lathe Segments', 'latheSegments', 16, 128),
]);
initProfileEditor(shapeCard);
shapeCard.appendChild(createButton('Reset Profile', 'clearProfile'));
sculptPanel.appendChild(shapeCard);

// Handles card
const handlesCard = createSectionCard('Handles', [
  createToggle('Show Handles', 'showHandles'),
]);
const handleThicknessControl = createSlider('Handle Thickness', 'handleThickness', 1, 50);
handlesCard.appendChild(handleThicknessControl);
initHandleEditor(handlesCard);
handlesCard.appendChild(createButton('Reset Handles', 'clearHandles'));
sculptPanel.appendChild(handlesCard);

// Material card
sculptPanel.appendChild(createSectionCard('Material', [
  createColorPicker('Base Color', 'baseColor'),
  createSlider('Roughness', 'roughness', 0, 100),
  createSlider('Metalness', 'metalness', 0, 100),
]));

// Wheel Speed card
sculptPanel.appendChild(createSectionCard(null, [
  createSlider('Wheel Speed', 'wheelSpeed', 0, 100),
]));

// ---- Draw Panel ----
const drawPanel = panelElements['Draw'];

drawPanel.appendChild(createSectionCard('Brush', [
  createSlider('Brush Size', 'brushSize', 1, 50),
  createColorPicker('Brush Color', 'brushColor'),
  createSlider('Brush Opacity', 'brushOpacity', 1, 100),
  createToggle('Eraser Mode', 'eraser'),
]));

drawPanel.appendChild(createSectionCard(null, [
  createButton('Clear Paint', 'clearTexture'),
]));

// ---- Stick Panel ----
const stickPanel = panelElements['Stick'];

const stickersCard = createSectionCard('Stickers', []);
const gallery = document.createElement('div');
gallery.className = 'sticker-gallery';
STICKER_PATHS.forEach((path, idx) => {
  const thumb = document.createElement('div');
  thumb.className = 'sticker-thumb' + (idx === 0 ? ' selected' : '');
  const img = document.createElement('img');
  img.src = path;
  img.alt = `Sticker ${idx + 1}`;
  thumb.appendChild(img);
  thumb.addEventListener('click', () => {
    setSelectedStickerIndex(idx);
    gallery.querySelectorAll('.sticker-thumb').forEach(t => t.classList.remove('selected'));
    thumb.classList.add('selected');
  });
  gallery.appendChild(thumb);
});
stickersCard.appendChild(gallery);
stickersCard.appendChild(createSlider('Sticker Scale', 'stickerScale', 10, 200));
stickersCard.appendChild(createSlider('Sticker Rotation', 'stickerRotation', 0, 360));
stickersCard.appendChild(createToggle('Randomize', 'stickerRandomize'));
stickPanel.appendChild(stickersCard);

stickPanel.appendChild(createSectionCard(null, [
  createButton('Clear Stickers', 'clearStickers'),
]));

// ---- Export (always visible) ----
const exportCard = createSectionCard('Export', []);
const exportBtn = document.createElement('button');
exportBtn.className = 'action-btn';
exportBtn.textContent = 'Export GLB';
exportBtn.addEventListener('click', exportGLB);
exportCard.appendChild(exportBtn);
const pngBtn = document.createElement('button');
pngBtn.className = 'action-btn';
pngBtn.style.marginTop = '6px';
pngBtn.textContent = 'Export PNG';
pngBtn.addEventListener('click', exportPNG);
exportCard.appendChild(pngBtn);
toolbar.appendChild(exportCard);

// =========================================================
// Interaction & Mode Switching
// =========================================================

function updateMode(mode) {
  for (const m of MODES) {
    tabElements[m].classList.toggle('active', m === mode);
    panelElements[m].classList.toggle('active', m === mode);
  }

  // Cursor
  renderer.domElement.style.cursor =
    mode === 'Draw' ? 'crosshair' :
    mode === 'Stick' ? 'copy' : 'default';

  updateHandleEditorVisibility();
}

function updateHandleEditorVisibility() {
  const showH = controls.get('showHandles');
  const heWrapEl = getHandleEditorWrap();
  if (heWrapEl) {
    heWrapEl.style.display = showH ? '' : 'none';
  }
  if (handleThicknessControl) {
    handleThicknessControl.style.display = showH ? '' : 'none';
  }
}

controls.onChange('toolMode', updateMode);

controls.onChange('showHandles', () => {
  setHandleDirty(true);
  buildHandles();
  updateHandleEditorVisibility();
});

updateHandleEditorVisibility();

// Prevent context menu on canvas
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

// ---- Mouse/Pointer Events ----
let isPainting = false;
let lastPaintUV = null;

renderer.domElement.addEventListener('pointerdown', (e) => {
  const mode = controls.get('toolMode');

  if (mode === 'Draw') {
    isPainting = true;
    const uv = getUV(e);
    if (uv) {
      paint(
        uv,
        controls.get('brushSize'),
        controls.get('brushColor'),
        controls.get('brushOpacity'),
        controls.get('eraser')
      );
      lastPaintUV = uv;
    }
  } else if (mode === 'Stick') {
    const uv = getUV(e);
    if (uv) placeSticker(uv);
  }
});

renderer.domElement.addEventListener('pointermove', (e) => {
  const rect = renderer.domElement.getBoundingClientRect();
  mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  const mode = controls.get('toolMode');
  if (mode === 'Draw' && isPainting) {
    const uv = getUV(e);
    if (uv) {
      if (lastPaintUV) {
        interpolatedPaint(
          lastPaintUV, uv,
          controls.get('brushSize'),
          controls.get('brushColor'),
          controls.get('brushOpacity'),
          controls.get('eraser')
        );
      } else {
        paint(
          uv,
          controls.get('brushSize'),
          controls.get('brushColor'),
          controls.get('brushOpacity'),
          controls.get('eraser')
        );
      }
      lastPaintUV = uv;
    }
  }
});

renderer.domElement.addEventListener('pointerup', () => {
  isPainting = false;
  lastPaintUV = null;
});

renderer.domElement.addEventListener('pointerleave', () => {
  isPainting = false;
  lastPaintUV = null;
});

// Continuous painting while rotating (30ms interval)
setInterval(() => {
  if (!isPainting || controls.get('toolMode') !== 'Draw' || !getVaseMesh()) return;
  raycaster.setFromCamera(mouseNDC, camera);
  const hits = raycaster.intersectObject(getVaseMesh(), false);
  if (hits.length > 0 && hits[0].uv) {
    paint(
      hits[0].uv.clone(),
      controls.get('brushSize') * 0.8,
      controls.get('brushColor'),
      controls.get('brushOpacity') * 0.6,
      controls.get('eraser')
    );
  }
}, 30);

// =========================================================
// Control Callbacks
// =========================================================

controls.onChange('baseColor', (color) => {
  fillBaseColor(color);
  compositeTexture();
  for (const m of getHandleMeshes()) {
    if (m.material) m.material.color.set(color);
  }
});

controls.onChange('roughness', (val) => {
  const r = val / 100;
  vaseMaterial.roughness = r;
  for (const m of getHandleMeshes()) {
    if (m.material) m.material.roughness = r;
  }
});

controls.onChange('metalness', (val) => {
  const mVal = val / 100;
  vaseMaterial.metalness = mVal;
  for (const m of getHandleMeshes()) {
    if (m.material) m.material.metalness = mVal;
  }
});

controls.onChange('vasePreset', (id) => {
  if (PRESETS[id]) {
    setCurrentProfile([...PRESETS[id]]);
    setProfileDirty(true);
    buildVase();
    drawProfileEditor();
  }
});

controls.onChange('profileSmoothing', () => {
  setProfileDirty(true);
  buildVase();
  drawProfileEditor();
});

controls.onChange('latheSegments', () => {
  setProfileDirty(true);
  buildVase();
});

controls.onChange('handleThickness', () => {
  setHandleDirty(true);
  buildHandles();
});

// Actions
controls.onAction('clearProfile', () => {
  setCurrentProfile([...PRESETS.classic]);
  setProfileDirty(true);
  buildVase();
  drawProfileEditor();
});

controls.onAction('clearTexture', () => {
  fillBaseColor(controls.get('baseColor'));
  stickerCtx.clearRect(0, 0, TEX, TEX);
  compositeTexture();
});

controls.onAction('clearHandles', () => {
  setHandleProfile([[0, 0.6], [0.4, 0.8], [0.6, 1.0], [0.4, 1.2], [0, 1.4]]);
  setHandleDirty(true);
  buildHandles();
  drawHandleEditor();
});

controls.onAction('clearStickers', () => {
  stickerCtx.clearRect(0, 0, TEX, TEX);
  compositeTexture();
});

// =========================================================
// Animation Loop
// =========================================================

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();
  const speed = controls.get('wheelSpeed') / 100;
  wheelGroup.rotation.y += speed * dt * 2;

  if (isProfileDirty()) buildVase();
  if (isHandleDirty()) buildHandles();

  renderer.render(scene, camera);
}

animate();
