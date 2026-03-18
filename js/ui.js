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
  group.className = 'ct-group';

  // Label row: [Name] ... [min — max]
  const labelRow = document.createElement('div');
  labelRow.className = 'ct-slider-label-row';

  const lbl = document.createElement('label');
  lbl.className = 'ct-label';
  lbl.style.marginBottom = '0';
  lbl.textContent = label;

  const rangeRow = document.createElement('div');
  rangeRow.className = 'ct-slider-range';

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
  wrap.className = 'ct-slider-wrap';

  const fill = document.createElement('div');
  fill.className = 'ct-slider-fill';

  const valueOverlay = document.createElement('div');
  valueOverlay.className = 'ct-slider-value-overlay';
  valueOverlay.textContent = controls.get(key);

  const input = document.createElement('input');
  input.type = 'range';
  input.className = 'ct-slider';
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
      rangeRow.classList.add('ct-shake');
      setTimeout(() => rangeRow.classList.remove('ct-shake'), 300);
      minInput.value = curMin;
      maxInput.value = curMax;
      return;
    }
    curMin = newMin;
    curMax = newMax;
    input.min = curMin;
    input.max = curMax;
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
  group.className = 'ct-group';

  const lbl = document.createElement('label');
  lbl.className = 'ct-label';
  lbl.textContent = label;

  const colorWrap = document.createElement('div');
  colorWrap.className = 'ct-color-wrap';

  const input = document.createElement('input');
  input.type = 'color';
  input.className = 'ct-color-input';
  input.value = controls.get(key);

  const hexLabel = document.createElement('span');
  hexLabel.className = 'ct-color-hex';
  hexLabel.textContent = controls.get(key);

  input.addEventListener('input', () => {
    controls.set(key, input.value);
    hexLabel.textContent = input.value;
  });

  controls.onChange(key, (val) => {
    input.value = val;
    hexLabel.textContent = val;
  });

  colorWrap.appendChild(input);
  colorWrap.appendChild(hexLabel);
  group.appendChild(lbl);
  group.appendChild(colorWrap);
  return group;
}

function createToggle(label, key) {
  const group = document.createElement('div');
  group.className = 'ct-group';

  const wrap = document.createElement('div');
  wrap.className = 'ct-toggle-wrap';

  const lbl = document.createElement('span');
  lbl.className = 'ct-label';
  lbl.style.marginBottom = '0';
  lbl.textContent = label;

  const track = document.createElement('div');
  track.className = 'ct-toggle-track' + (controls.get(key) ? ' active' : '');

  const thumb = document.createElement('div');
  thumb.className = 'ct-toggle-thumb';
  track.appendChild(thumb);

  wrap.addEventListener('click', () => {
    const newVal = !controls.get(key);
    controls.set(key, newVal);
    track.classList.toggle('active', newVal);
  });

  controls.onChange(key, (val) => {
    track.classList.toggle('active', val);
  });

  wrap.appendChild(lbl);
  wrap.appendChild(track);
  group.appendChild(wrap);
  return group;
}

function createSelect(label, key, options) {
  const group = document.createElement('div');
  group.className = 'ct-group';

  const lbl = document.createElement('label');
  lbl.className = 'ct-label';
  lbl.textContent = label;

  const select = document.createElement('select');
  select.className = 'ct-select';
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
  const btn = document.createElement('button');
  btn.className = 'ct-button';
  btn.textContent = label;
  btn.addEventListener('click', () => controls.fireAction(actionName));
  return btn;
}

// =========================================================
// Collapsible Section Builder
// =========================================================

function createCollapsibleSection(title, children, startOpen = true) {
  const card = document.createElement('div');
  card.className = 'ct-group';

  const header = document.createElement('div');
  header.className = 'ct-section-header' + (startOpen ? ' open' : '');

  const label = document.createElement('span');
  label.className = 'ct-section-label';
  label.textContent = title;
  header.appendChild(label);

  const chevron = document.createElement('span');
  chevron.className = 'ct-section-chevron';
  chevron.textContent = startOpen ? '—' : '+';
  header.appendChild(chevron);

  const body = document.createElement('div');
  body.className = 'ct-section-body';
  if (startOpen) {
    body.classList.add('ct-open');
  } else {
    body.classList.add('collapsed');
  }

  for (const child of children) {
    if (child) {
      if (child.classList && child.classList.contains('ct-group')) {
        child.style.background = 'transparent';
        child.style.padding = '0';
        child.style.borderRadius = '0';
      }
      body.appendChild(child);
    }
  }

  header.addEventListener('click', function() {
    const isOpen = header.classList.toggle('open');
    chevron.textContent = isOpen ? '—' : '+';
    body.classList.toggle('collapsed', !isOpen);
    if (isOpen) {
      body.classList.remove('ct-open');
      body.style.display = '';
      body.style.maxHeight = body.scrollHeight + 'px';
      body.addEventListener('transitionend', function handler() {
        body.removeEventListener('transitionend', handler);
        if (header.classList.contains('open')) body.classList.add('ct-open');
      });
    } else {
      body.classList.remove('ct-open');
      body.style.maxHeight = body.scrollHeight + 'px';
      requestAnimationFrame(function() { body.style.maxHeight = '0'; });
    }
  });

  card.appendChild(header);
  card.appendChild(body);
  return { card, body };
}

// =========================================================
// Build Toolbar
// =========================================================

const toolbar = document.getElementById('toolbar');

// Mode selection buttons (wrapped in ct-group card with label)
const modeGroup = document.createElement('div');
modeGroup.className = 'ct-group';

const modeLabel = document.createElement('div');
modeLabel.className = 'ct-label';
modeLabel.textContent = 'Mode';

const tabsDiv = document.createElement('div');
tabsDiv.className = 'ct-selection-btns';
const MODES = ['Sculpt', 'Draw', 'Stick'];
const tabElements = {};

for (const mode of MODES) {
  const tab = document.createElement('button');
  tab.className = 'ct-selection-btn' + (mode === 'Sculpt' ? ' selected' : '');
  tab.textContent = mode;
  tab.dataset.mode = mode;
  tab.addEventListener('click', () => controls.set('toolMode', mode));
  tabsDiv.appendChild(tab);
  tabElements[mode] = tab;
}

modeGroup.append(modeLabel, tabsDiv);
toolbar.appendChild(modeGroup);

// Create panels
const panelElements = {};
for (const mode of MODES) {
  const panel = document.createElement('div');
  panel.style.cssText = (mode === 'Sculpt' ? 'display:flex;' : 'display:none;') + 'flex-direction:column;gap:5px;';
  panelElements[mode] = panel;
  toolbar.appendChild(panel);
}

// ---- Sculpt Panel ----
const sculptPanel = panelElements['Sculpt'];

// Shape section
const shapeSection = createCollapsibleSection('Shape', [
  createSelect('Vase Preset', 'vasePreset', [
    'classic', 'tall', 'bowl', 'urn', 'bottle', 'wide'
  ]),
  createSlider('Profile Smoothing', 'profileSmoothing', 0, 100),
  createSlider('Lathe Segments', 'latheSegments', 16, 128),
], true);
initProfileEditor(shapeSection.body);
shapeSection.body.appendChild(createButton('Reset Profile', 'clearProfile'));
sculptPanel.appendChild(shapeSection.card);

// Handles section
const handlesSection = createCollapsibleSection('Handles', [
  createToggle('Show Handles', 'showHandles'),
], true);
const handleThicknessControl = createSlider('Handle Thickness', 'handleThickness', 1, 50);
handleThicknessControl.style.background = 'transparent';
handleThicknessControl.style.padding = '0';
handleThicknessControl.style.borderRadius = '0';
handlesSection.body.appendChild(handleThicknessControl);
initHandleEditor(handlesSection.body);
handlesSection.body.appendChild(createButton('Reset Handles', 'clearHandles'));
sculptPanel.appendChild(handlesSection.card);

// Material section
sculptPanel.appendChild(createCollapsibleSection('Material', [
  createColorPicker('Base Color', 'baseColor'),
  createSlider('Roughness', 'roughness', 0, 100),
  createSlider('Metalness', 'metalness', 0, 100),
  createSlider('Wheel Speed', 'wheelSpeed', 0, 100),
], true).card);

// ---- Draw Panel ----
const drawPanel = panelElements['Draw'];

drawPanel.appendChild(createCollapsibleSection('Brush', [
  createSlider('Brush Size', 'brushSize', 1, 50),
  createColorPicker('Brush Color', 'brushColor'),
  createSlider('Brush Opacity', 'brushOpacity', 1, 100),
  createToggle('Eraser Mode', 'eraser'),
  createButton('Clear Paint', 'clearTexture'),
], true).card);

// ---- Stick Panel ----
const stickPanel = panelElements['Stick'];

const stickersSection = createCollapsibleSection('Stickers', [], true);
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
stickersSection.body.appendChild(gallery);

const stickerScaleSlider = createSlider('Sticker Scale', 'stickerScale', 10, 200);
stickerScaleSlider.style.background = 'transparent';
stickerScaleSlider.style.padding = '0';
stickerScaleSlider.style.borderRadius = '0';
stickersSection.body.appendChild(stickerScaleSlider);

const stickerRotSlider = createSlider('Sticker Rotation', 'stickerRotation', 0, 360);
stickerRotSlider.style.background = 'transparent';
stickerRotSlider.style.padding = '0';
stickerRotSlider.style.borderRadius = '0';
stickersSection.body.appendChild(stickerRotSlider);

const randomizeToggle = createToggle('Randomize', 'stickerRandomize');
randomizeToggle.style.background = 'transparent';
randomizeToggle.style.padding = '0';
randomizeToggle.style.borderRadius = '0';
stickersSection.body.appendChild(randomizeToggle);

stickersSection.body.appendChild(createButton('Clear Stickers', 'clearStickers'));
stickPanel.appendChild(stickersSection.card);

// ---- Export (always visible) ----
const exportCard = document.createElement('div');
exportCard.className = 'ct-group';

const exportHeader = document.createElement('div');
exportHeader.className = 'ct-section-header ct-section-static open';
const exportLabel = document.createElement('span');
exportLabel.className = 'ct-section-label';
exportLabel.textContent = 'Export';
exportHeader.appendChild(exportLabel);
exportCard.appendChild(exportHeader);

const exportBody = document.createElement('div');
exportBody.className = 'ct-section-body ct-open';

const exportBtn = document.createElement('button');
exportBtn.className = 'ct-button';
exportBtn.textContent = 'Export GLB';
exportBtn.addEventListener('click', exportGLB);
exportBody.appendChild(exportBtn);

const pngBtn = document.createElement('button');
pngBtn.className = 'ct-button';
pngBtn.textContent = 'Export PNG';
pngBtn.addEventListener('click', exportPNG);
exportBody.appendChild(pngBtn);

exportCard.appendChild(exportBody);
toolbar.appendChild(exportCard);

// =========================================================
// Interaction & Mode Switching
// =========================================================

function updateMode(mode) {
  for (const m of MODES) {
    tabElements[m].classList.toggle('selected', m === mode);
    panelElements[m].style.display = m === mode ? 'flex' : 'none';
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
