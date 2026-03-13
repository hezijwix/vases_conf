import { controls } from './controls.js';
import {
  MAX_H, MAX_R, DRAW_MAX_H, smooth,
  getCurrentProfile, setCurrentProfile, setProfileDirty,
  buildVase,
  getHandleProfile, setHandleProfile, setHandleDirty,
  buildHandles
} from './engine.js';

// =========================================================
// Profile Editor
// =========================================================

let peCanvas, peCtx;
let isDrawingProfile = false;
let drawnProfilePoints = [];

function profileToCanvas(point, canvasW, canvasH) {
  const margin = 20;
  const usableW = canvasW - margin * 2;
  const usableH = canvasH - margin * 2;
  return [
    margin + (point[0] / MAX_R) * usableW,
    canvasH - margin - (point[1] / MAX_H) * usableH
  ];
}

function canvasToProfile(x, y, canvasW, canvasH) {
  const margin = 20;
  const usableW = canvasW - margin * 2;
  const usableH = canvasH - margin * 2;
  return [
    Math.max(0, Math.min(MAX_R, (x - margin) / usableW * MAX_R)),
    Math.max(0, Math.min(DRAW_MAX_H, (canvasH - margin - y) / usableH * MAX_H))
  ];
}

function processDrawnPoints(pts) {
  const currentProfile = getCurrentProfile();
  if (pts.length < 2) return currentProfile;

  const sorted = [...pts]
    .sort((a, b) => a[1] - b[1])
    .map(p => [
      Math.max(0, Math.min(p[0], MAX_R)),
      Math.max(0, Math.min(p[1], MAX_H))
    ]);

  const step = Math.max(1, Math.floor(sorted.length / 16));
  const sampled = [];
  for (let i = 0; i < sorted.length; i += step) {
    sampled.push(sorted[i]);
  }
  if (sampled[sampled.length - 1] !== sorted[sorted.length - 1]) {
    sampled.push(sorted[sorted.length - 1]);
  }

  const base = [sampled[0][0], 0];
  const baseAxis = [0, 0];
  const top = sampled[sampled.length - 1];
  const topAxis = [0, top[1]];

  return [baseAxis, base, ...sampled, topAxis];
}

export function drawProfileEditor() {
  if (!peCanvas) return;
  const w = peCanvas.width;
  const h = peCanvas.height;
  const ctx = peCtx;
  const currentProfile = getCurrentProfile();

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, w, h);

  // Grid
  const margin = 20;
  ctx.strokeStyle = '#1a1a3a';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 10; i++) {
    const x = margin + (i / 10) * (w - margin * 2);
    const y = margin + (i / 10) * (h - margin * 2);
    ctx.beginPath(); ctx.moveTo(x, margin); ctx.lineTo(x, h - margin); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(margin, y); ctx.lineTo(w - margin, y); ctx.stroke();
  }

  // Axis of revolution (dashed blue)
  ctx.strokeStyle = '#4a9eff44';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(margin, margin);
  ctx.lineTo(margin, h - margin);
  ctx.stroke();
  ctx.setLineDash([]);

  // Max safe height line (dashed green)
  const safeHY = profileToCanvas([0, DRAW_MAX_H], w, h)[1];
  ctx.strokeStyle = '#4aff4a44';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(margin, safeHY);
  ctx.lineTo(w - margin, safeHY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#4aff4a66';
  ctx.font = '8px sans-serif';
  ctx.fillText('max height', w - margin - 50, safeHY - 3);

  // Danger zone
  const maxHY = profileToCanvas([0, MAX_H], w, h)[1];
  ctx.fillStyle = 'rgba(255, 50, 50, 0.06)';
  ctx.fillRect(margin, maxHY, w - margin * 2, safeHY - maxHY);

  // Draw smoothed profile curve
  if (currentProfile.length > 1) {
    const smoothIter = Math.round(controls.get('profileSmoothing') / 25);
    const smoothed = smooth(currentProfile, smoothIter);

    // Filled area
    ctx.beginPath();
    let first = profileToCanvas(smoothed[0], w, h);
    ctx.moveTo(first[0], first[1]);
    for (let i = 1; i < smoothed.length; i++) {
      const p = profileToCanvas(smoothed[i], w, h);
      ctx.lineTo(p[0], p[1]);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(74, 158, 255, 0.08)';
    ctx.fill();

    // Stroke
    ctx.beginPath();
    ctx.moveTo(first[0], first[1]);
    for (let i = 1; i < smoothed.length; i++) {
      const p = profileToCanvas(smoothed[i], w, h);
      ctx.lineTo(p[0], p[1]);
    }
    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Control points
    for (const p of currentProfile) {
      const [cx, cy] = profileToCanvas(p, w, h);
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
  }

  // Labels
  ctx.fillStyle = '#555';
  ctx.font = '9px sans-serif';
  ctx.fillText('\u2190 axis', margin + 2, h - 5);
  ctx.fillText('radius \u2192', w - 60, h - 5);
}

export function initProfileEditor(container) {
  const wrap = document.createElement('div');
  wrap.className = 'editor-wrap';
  wrap.id = 'pe-wrap';

  const label = document.createElement('div');
  label.className = 'editor-label';
  label.textContent = 'Draw vase profile (right side)';

  peCanvas = document.createElement('canvas');
  peCanvas.width = 220;
  peCanvas.height = 320;
  peCanvas.className = 'editor-canvas';
  peCtx = peCanvas.getContext('2d');

  wrap.appendChild(label);
  wrap.appendChild(peCanvas);
  container.appendChild(wrap);

  peCanvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (controls.get('toolMode') !== 'Sculpt') return;
    peCanvas.setPointerCapture(e.pointerId);
    isDrawingProfile = true;
    drawnProfilePoints = [];
    const rect = peCanvas.getBoundingClientRect();
    const sx = peCanvas.width / rect.width;
    const sy = peCanvas.height / rect.height;
    drawnProfilePoints.push(canvasToProfile(
      (e.clientX - rect.left) * sx,
      (e.clientY - rect.top) * sy,
      peCanvas.width, peCanvas.height
    ));
  });

  peCanvas.addEventListener('pointermove', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDrawingProfile) return;
    const rect = peCanvas.getBoundingClientRect();
    const sx = peCanvas.width / rect.width;
    const sy = peCanvas.height / rect.height;
    drawnProfilePoints.push(canvasToProfile(
      (e.clientX - rect.left) * sx,
      (e.clientY - rect.top) * sy,
      peCanvas.width, peCanvas.height
    ));
    setCurrentProfile(processDrawnPoints(drawnProfilePoints));
    setProfileDirty(true);
    drawProfileEditor();
  });

  peCanvas.addEventListener('pointerup', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDrawingProfile) return;
    isDrawingProfile = false;
    if (drawnProfilePoints.length > 2) {
      setCurrentProfile(processDrawnPoints(drawnProfilePoints));
      setProfileDirty(true);
      buildVase();
      drawProfileEditor();
    }
  });

  peCanvas.addEventListener('pointerleave', (e) => {
    e.stopPropagation();
    if (isDrawingProfile) {
      isDrawingProfile = false;
      if (drawnProfilePoints.length > 2) {
        setCurrentProfile(processDrawnPoints(drawnProfilePoints));
        setProfileDirty(true);
        buildVase();
      }
    }
  });

  drawProfileEditor();
}

// =========================================================
// Handle Editor
// =========================================================

let heCanvas, heCtx;
let isDrawingHandle = false;
let drawnHandlePoints = [];
let heWrapEl;

export function getHandleEditorWrap() { return heWrapEl; }

function handleToCanvas(point, canvasW, canvasH) {
  const margin = 15;
  const usableW = canvasW - margin * 2;
  const usableH = canvasH - margin * 2;
  return [
    margin + (point[0] / MAX_R) * usableW,
    canvasH - margin - (point[1] / MAX_H) * usableH
  ];
}

function canvasToHandle(x, y, canvasW, canvasH) {
  const margin = 15;
  const usableW = canvasW - margin * 2;
  const usableH = canvasH - margin * 2;
  return [
    Math.max(0, Math.min(MAX_R, (x - margin) / usableW * MAX_R)),
    Math.max(0, Math.min(MAX_H, (canvasH - margin - y) / usableH * MAX_H))
  ];
}

export function drawHandleEditor() {
  if (!heCanvas) return;
  const w = heCanvas.width;
  const h = heCanvas.height;
  const ctx = heCtx;
  const handleProfile = getHandleProfile();

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, w, h);

  // Grid
  const margin = 15;
  ctx.strokeStyle = '#1a1a3a';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 10; i++) {
    const x = margin + (i / 10) * (w - margin * 2);
    const y = margin + (i / 10) * (h - margin * 2);
    ctx.beginPath(); ctx.moveTo(x, margin); ctx.lineTo(x, h - margin); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(margin, y); ctx.lineTo(w - margin, y); ctx.stroke();
  }

  // Center axis (dashed pink)
  ctx.strokeStyle = '#ff4a9e44';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(margin, margin);
  ctx.lineTo(margin, h - margin);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw handle profile
  if (handleProfile.length > 1) {
    ctx.beginPath();
    const first = handleToCanvas(handleProfile[0], w, h);
    ctx.moveTo(first[0], first[1]);
    for (let i = 1; i < handleProfile.length; i++) {
      const p = handleToCanvas(handleProfile[i], w, h);
      ctx.lineTo(p[0], p[1]);
    }
    ctx.strokeStyle = '#ff4a9e';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Control points
    for (const p of handleProfile) {
      const [cx, cy] = handleToCanvas(p, w, h);
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
  }

  // Labels
  ctx.fillStyle = '#555';
  ctx.font = '9px sans-serif';
  ctx.fillText('\u2190 center', margin + 2, h - 5);
  ctx.fillText('width \u2192', w - 60, h - 5);
}

export function initHandleEditor(container) {
  heWrapEl = document.createElement('div');
  heWrapEl.className = 'editor-wrap';
  heWrapEl.id = 'he-wrap';

  const label = document.createElement('div');
  label.className = 'editor-label';
  label.textContent = 'Draw handle shape (from center)';

  heCanvas = document.createElement('canvas');
  heCanvas.width = 220;
  heCanvas.height = 160;
  heCanvas.className = 'editor-canvas';
  heCtx = heCanvas.getContext('2d');

  heWrapEl.appendChild(label);
  heWrapEl.appendChild(heCanvas);
  container.appendChild(heWrapEl);

  heCanvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    heCanvas.setPointerCapture(e.pointerId);
    isDrawingHandle = true;
    drawnHandlePoints = [];
    const rect = heCanvas.getBoundingClientRect();
    const sx = heCanvas.width / rect.width;
    const sy = heCanvas.height / rect.height;
    drawnHandlePoints.push(canvasToHandle(
      (e.clientX - rect.left) * sx,
      (e.clientY - rect.top) * sy,
      heCanvas.width, heCanvas.height
    ));
  });

  heCanvas.addEventListener('pointermove', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDrawingHandle) return;
    const rect = heCanvas.getBoundingClientRect();
    const sx = heCanvas.width / rect.width;
    const sy = heCanvas.height / rect.height;
    drawnHandlePoints.push(canvasToHandle(
      (e.clientX - rect.left) * sx,
      (e.clientY - rect.top) * sy,
      heCanvas.width, heCanvas.height
    ));
    setHandleProfile([...drawnHandlePoints]);
    setHandleDirty(true);
    drawHandleEditor();
  });

  heCanvas.addEventListener('pointerup', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDrawingHandle) return;
    isDrawingHandle = false;
    if (drawnHandlePoints.length > 2) {
      setHandleProfile([...drawnHandlePoints]);
      setHandleDirty(true);
      buildHandles();
      drawHandleEditor();
    }
  });

  heCanvas.addEventListener('pointerleave', (e) => {
    e.stopPropagation();
    if (isDrawingHandle) {
      isDrawingHandle = false;
      if (drawnHandlePoints.length > 2) {
        setHandleProfile([...drawnHandlePoints]);
        setHandleDirty(true);
        buildHandles();
      }
    }
  });

  drawHandleEditor();
}
