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
  const group = document.createElement('div');
  group.className = 'control-group';

  const lbl = document.createElement('label');
  lbl.className = 'control-label';
  lbl.textContent = label;

  const wrap = document.createElement('div');
  wrap.className = 'slider-wrap';

  const input = document.createElement('input');
  input.type = 'range';
  input.min = min;
  input.max = max;
  input.step = step;
  input.value = controls.get(key);

  const valueDisplay = document.createElement('span');
  valueDisplay.className = 'slider-value';
  valueDisplay.textContent = controls.get(key);

  input.addEventListener('input', () => {
    const val = parseFloat(input.value);
    valueDisplay.textContent = val;
    controls.set(key, val);
  });

  controls.onChange(key, (val) => {
    input.value = val;
    valueDisplay.textContent = val;
  });

  wrap.appendChild(input);
  wrap.appendChild(valueDisplay);
  group.appendChild(lbl);
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

function createSeparator() {
  const sep = document.createElement('div');
  sep.className = 'control-separator';
  return sep;
}

function createSectionTitle(text) {
  const title = document.createElement('div');
  title.className = 'section-title';
  title.textContent = text;
  return title;
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

sculptPanel.appendChild(createSectionTitle('Shape'));
sculptPanel.appendChild(createSelect('Vase Preset', 'vasePreset', [
  'classic', 'tall', 'bowl', 'urn', 'bottle', 'wide'
]));
sculptPanel.appendChild(createSlider('Profile Smoothing', 'profileSmoothing', 0, 100));
sculptPanel.appendChild(createSlider('Lathe Segments', 'latheSegments', 16, 128));
initProfileEditor(sculptPanel);
sculptPanel.appendChild(createButton('Reset Profile', 'clearProfile'));

sculptPanel.appendChild(createSeparator());
sculptPanel.appendChild(createSectionTitle('Handles'));
sculptPanel.appendChild(createToggle('Show Handles', 'showHandles'));
const handleThicknessControl = createSlider('Handle Thickness', 'handleThickness', 1, 50);
sculptPanel.appendChild(handleThicknessControl);
initHandleEditor(sculptPanel);
sculptPanel.appendChild(createButton('Reset Handles', 'clearHandles'));

sculptPanel.appendChild(createSeparator());
sculptPanel.appendChild(createSectionTitle('Material'));
sculptPanel.appendChild(createColorPicker('Base Color', 'baseColor'));
sculptPanel.appendChild(createSlider('Roughness', 'roughness', 0, 100));
sculptPanel.appendChild(createSlider('Metalness', 'metalness', 0, 100));

sculptPanel.appendChild(createSeparator());
sculptPanel.appendChild(createSlider('Wheel Speed', 'wheelSpeed', 0, 100));

// ---- Draw Panel ----
const drawPanel = panelElements['Draw'];

drawPanel.appendChild(createSlider('Brush Size', 'brushSize', 1, 50));
drawPanel.appendChild(createColorPicker('Brush Color', 'brushColor'));
drawPanel.appendChild(createSlider('Brush Opacity', 'brushOpacity', 1, 100));
drawPanel.appendChild(createToggle('Eraser Mode', 'eraser'));
drawPanel.appendChild(createSeparator());
drawPanel.appendChild(createButton('Clear Paint', 'clearTexture'));

// ---- Stick Panel ----
const stickPanel = panelElements['Stick'];

stickPanel.appendChild(createSectionTitle('Stickers'));

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
stickPanel.appendChild(gallery);

stickPanel.appendChild(createSlider('Sticker Scale', 'stickerScale', 10, 200));
stickPanel.appendChild(createSlider('Sticker Rotation', 'stickerRotation', 0, 360));
stickPanel.appendChild(createToggle('Randomize', 'stickerRandomize'));
stickPanel.appendChild(createSeparator());
stickPanel.appendChild(createButton('Clear Stickers', 'clearStickers'));

// ---- Export (always visible) ----
const exportSection = document.createElement('div');
exportSection.style.padding = '12px';
exportSection.style.borderTop = '1px solid var(--border)';
const exportBtn = document.createElement('button');
exportBtn.className = 'action-btn';
exportBtn.textContent = 'Export GLB';
exportBtn.addEventListener('click', exportGLB);
exportSection.appendChild(exportBtn);
const pngBtn = document.createElement('button');
pngBtn.className = 'action-btn';
pngBtn.style.marginTop = '6px';
pngBtn.textContent = 'Export PNG';
pngBtn.addEventListener('click', exportPNG);
exportSection.appendChild(pngBtn);
toolbar.appendChild(exportSection);

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
