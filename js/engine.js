import * as THREE from 'https://esm.sh/three@0.170.0';
import { RGBELoader } from 'https://esm.sh/three@0.170.0/addons/loaders/RGBELoader.js';
import { GLTFExporter } from 'https://esm.sh/three@0.170.0/addons/exporters/GLTFExporter.js';
import { controls } from './controls.js';

// =========================================================
// Scene objects (populated by initEngine)
// =========================================================

export let renderer, camera, scene, wheelGroup;

let pmrem;

const HDR_URLS = {
  Studio: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr',
  Sunset: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kloofendal_48d_partly_cloudy_puresky_1k.hdr',
  Courtyard: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/courtyard_1k.hdr',
  Night: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/moonlit_golf_1k.hdr'
};

export function loadEnvironment(name) {
  const url = HDR_URLS[name];
  if (!url) return;

  new RGBELoader().load(
    url,
    (texture) => {
      const envMap = pmrem.fromEquirectangular(texture).texture;
      scene.environment = envMap;
      scene.background = envMap;
      texture.dispose();
    },
    undefined,
    () => {
      scene.add(new THREE.AmbientLight(0xffffff, 0.5));
      const d1 = new THREE.DirectionalLight(0xffffff, 1.5);
      d1.position.set(3, 5, 3);
      scene.add(d1);
      const d2 = new THREE.DirectionalLight(0x8899bb, 0.5);
      d2.position.set(-3, 3, -3);
      scene.add(d2);
    }
  );
}

export function initEngine(area) {
  // Renderer
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true
  });
  renderer.setSize(area.clientWidth, area.clientHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  area.appendChild(renderer.domElement);

  // Camera
  camera = new THREE.PerspectiveCamera(
    40,
    area.clientWidth / area.clientHeight,
    0.1,
    100
  );
  camera.position.set(0, 1.0, 4.0);
  camera.lookAt(0, 0.85, 0);

  // Scene
  scene = new THREE.Scene();

  // Wheel group
  wheelGroup = new THREE.Group();
  scene.add(wheelGroup);

  // PMREMGenerator
  pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  // Load environment
  loadEnvironment(controls.get('envMap'));

  // Build initial vase
  buildVase();

  // Expose globals for capture compatibility
  window.renderer = renderer;
  window.scene = scene;
  window.camera = camera;

  // Resize handler — use ResizeObserver for reliable iframe support
  const resizeFn = () => {
    const w = area.clientWidth;
    const h = area.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };

  new ResizeObserver(resizeFn).observe(area);

  // Deferred initial sizing for iframe contexts where dimensions aren't ready at parse time
  requestAnimationFrame(resizeFn);
}

// =========================================================
// Texture System
// =========================================================

export const TEX = 2048;
export const raycaster = new THREE.Raycaster();
export const mouseNDC = new THREE.Vector2();

// Paint layer
const paintCanvas = document.createElement('canvas');
paintCanvas.width = TEX;
paintCanvas.height = TEX;
export const paintCtx = paintCanvas.getContext('2d');

// Sticker layer
const stickerCanvas = document.createElement('canvas');
stickerCanvas.width = TEX;
stickerCanvas.height = TEX;
export const stickerCtx = stickerCanvas.getContext('2d');

// Composite layer
const compositeCanvas = document.createElement('canvas');
compositeCanvas.width = TEX;
compositeCanvas.height = TEX;
const compositeCtx = compositeCanvas.getContext('2d');

export function fillBaseColor(color) {
  paintCtx.fillStyle = color;
  paintCtx.fillRect(0, 0, TEX, TEX);
}

fillBaseColor(controls.get('baseColor'));
compositeCtx.drawImage(paintCanvas, 0, 0);

const canvasTexture = new THREE.CanvasTexture(compositeCanvas);
canvasTexture.colorSpace = THREE.SRGBColorSpace;

export function compositeTexture() {
  compositeCtx.clearRect(0, 0, TEX, TEX);
  compositeCtx.drawImage(paintCanvas, 0, 0);
  compositeCtx.drawImage(stickerCanvas, 0, 0);
  canvasTexture.needsUpdate = true;
}

// =========================================================
// Material
// =========================================================

export const vaseMaterial = new THREE.MeshStandardMaterial({
  map: canvasTexture,
  roughness: controls.get('roughness') / 100,
  metalness: controls.get('metalness') / 100,
  side: THREE.DoubleSide
});

// =========================================================
// Vase Sculpt System
// =========================================================

export const PRESETS = {
  classic: [
    [0, 0], [0.6, 0], [0.65, 0.05], [0.7, 0.15], [0.75, 0.3],
    [0.8, 0.5], [0.85, 0.7], [0.82, 0.9], [0.7, 1.1], [0.55, 1.3],
    [0.45, 1.5], [0.42, 1.65], [0.45, 1.8], [0.5, 1.9], [0.48, 2],
    [0.35, 2.05], [0, 2.05]
  ],
  tall: [
    [0, 0], [0.4, 0], [0.42, 0.04], [0.45, 0.14], [0.43, 0.35],
    [0.38, 0.56], [0.32, 0.84], [0.28, 1.12], [0.26, 1.4], [0.28, 1.6],
    [0.35, 1.74], [0.38, 1.82], [0.35, 1.9], [0.25, 1.96], [0, 1.96]
  ],
  bowl: [
    [0, 0], [0.3, 0], [0.35, 0.05], [0.6, 0.1], [0.8, 0.2],
    [0.95, 0.35], [1.05, 0.55], [1.08, 0.7], [1.05, 0.85], [1, 0.9],
    [0, 0.9]
  ],
  urn: [
    [0, 0], [0.5, 0], [0.55, 0.05], [0.65, 0.2], [0.8, 0.5],
    [0.9, 0.8], [0.92, 1], [0.85, 1.2], [0.7, 1.4], [0.5, 1.55],
    [0.35, 1.6], [0.3, 1.65], [0.28, 1.7], [0.3, 1.75], [0.35, 1.8],
    [0.3, 1.85], [0, 1.85]
  ],
  bottle: [
    [0, 0], [0.5, 0], [0.55, 0.05], [0.6, 0.13], [0.65, 0.35],
    [0.68, 0.6], [0.65, 0.85], [0.55, 1.05], [0.35, 1.18], [0.2, 1.3],
    [0.18, 1.48], [0.17, 1.7], [0.18, 1.85], [0.2, 1.95], [0.18, 2.0],
    [0.15, 2.05], [0, 2.05]
  ],
  wide: [
    [0, 0], [0.6, 0], [0.65, 0.05], [0.85, 0.15], [1, 0.3],
    [1.1, 0.5], [1.12, 0.7], [1.05, 0.9], [0.9, 1.05], [0.75, 1.15],
    [0.65, 1.2], [0.6, 1.25], [0.55, 1.3], [0, 1.3]
  ]
};

export const MAX_H = 2.1;
export const MAX_R = 1.2;
export const DRAW_MAX_H = MAX_H * 0.85;

let currentProfile = [...PRESETS.classic];
let profileDirty = true;

export function getCurrentProfile() { return currentProfile; }
export function setCurrentProfile(p) { currentProfile = p; }
export function isProfileDirty() { return profileDirty; }
export function setProfileDirty(v) { profileDirty = v; }

// Chaikin subdivision smoothing
export function smooth(points, iterations) {
  let pts = points.map(p => [...p]);
  for (let i = 0; i < iterations; i++) {
    const result = [pts[0]];
    for (let j = 0; j < pts.length - 1; j++) {
      result.push([
        0.75 * pts[j][0] + 0.25 * pts[j + 1][0],
        0.75 * pts[j][1] + 0.25 * pts[j + 1][1]
      ]);
      result.push([
        0.25 * pts[j][0] + 0.75 * pts[j + 1][0],
        0.25 * pts[j][1] + 0.75 * pts[j + 1][1]
      ]);
    }
    result.push(pts[pts.length - 1]);
    pts = result;
  }
  return pts;
}

let vaseMesh = null;

export function getVaseMesh() { return vaseMesh; }

export function buildVase() {
  const smoothIterations = Math.round(controls.get('profileSmoothing') / 25);
  const segments = controls.get('latheSegments');
  const smoothed = smooth(currentProfile, smoothIterations);
  const lathePoints = smoothed.map(p => new THREE.Vector2(p[0], p[1]));
  const geometry = new THREE.LatheGeometry(lathePoints, segments);

  if (vaseMesh) {
    vaseMesh.geometry.dispose();
    vaseMesh.geometry = geometry;
  } else {
    vaseMesh = new THREE.Mesh(geometry, vaseMaterial);
    wheelGroup.add(vaseMesh);
  }

  profileDirty = false;
  buildHandles();
}

// =========================================================
// Handle System
// =========================================================

let handleMeshes = [];
let handleProfile = [[0, 0.8], [0.3, 0.9], [0.4, 1.1], [0.3, 1.3], [0, 1.4]];
let handleDirty = true;

export function getHandleMeshes() { return handleMeshes; }
export function getHandleProfile() { return handleProfile; }
export function setHandleProfile(p) { handleProfile = p; }
export function isHandleDirty() { return handleDirty; }
export function setHandleDirty(v) { handleDirty = v; }

export function buildHandles() {
  for (const mesh of handleMeshes) {
    wheelGroup.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
  handleMeshes = [];

  if (!controls.get('showHandles') || handleProfile.length < 2) return;

  const thickness = controls.get('handleThickness') / 200;
  const points3D = handleProfile.map(p => new THREE.Vector3(p[0], p[1], 0));
  const curve = new THREE.CatmullRomCurve3(points3D, false, 'catmullrom', 0.5);
  const geometry = new THREE.TubeGeometry(curve, 32, thickness, 12, false);

  for (let i = 0; i < 2; i++) {
    const handleMat = new THREE.MeshStandardMaterial({
      color: controls.get('baseColor'),
      roughness: controls.get('roughness') / 100,
      metalness: controls.get('metalness') / 100,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geometry, handleMat);
    mesh.rotation.y = Math.PI * i;
    wheelGroup.add(mesh);
    handleMeshes.push(mesh);
  }

  handleDirty = false;
}

// =========================================================
// Paint/Draw System
// =========================================================

export function getUV(event) {
  if (!vaseMesh) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  mouseNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouseNDC.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouseNDC, camera);
  const hits = raycaster.intersectObject(vaseMesh, false);
  return (hits.length > 0 && hits[0].uv) ? hits[0].uv.clone() : null;
}

export function paint(uv, size, color, opacity, isEraser) {
  if (!uv) return;
  const px = uv.x * TEX;
  const py = (1 - uv.y) * TEX;
  const radius = size * (TEX / 200);
  const fillColor = isEraser ? controls.get('baseColor') : color;

  paintCtx.save();
  paintCtx.globalAlpha = opacity / 100;

  const gradient = paintCtx.createRadialGradient(px, py, 0, px, py, radius);
  gradient.addColorStop(0, fillColor);
  gradient.addColorStop(0.7, fillColor);
  gradient.addColorStop(1, fillColor + '00');
  paintCtx.fillStyle = gradient;

  paintCtx.beginPath();
  paintCtx.arc(px, py, radius, 0, Math.PI * 2);
  paintCtx.fill();

  // UV wrapping at horizontal seam
  if (px < radius) {
    paintCtx.beginPath();
    paintCtx.arc(px + TEX, py, radius, 0, Math.PI * 2);
    paintCtx.fill();
  } else if (px > TEX - radius) {
    paintCtx.beginPath();
    paintCtx.arc(px - TEX, py, radius, 0, Math.PI * 2);
    paintCtx.fill();
  }

  paintCtx.restore();
  compositeTexture();
}

export function interpolatedPaint(uv1, uv2, size, color, opacity, isEraser) {
  let dx = uv2.x - uv1.x;
  const dy = uv2.y - uv1.y;

  // Handle UV wrap-around
  if (Math.abs(dx) > 0.5) {
    dx = dx > 0 ? dx - 1 : dx + 1;
  }

  const distance = Math.sqrt(dx * dx + dy * dy);
  const stepSize = size / TEX * 0.3;
  const steps = Math.max(1, Math.ceil(distance / stepSize));

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let u = uv1.x + dx * t;
    if (u < 0) u += 1;
    if (u > 1) u -= 1;
    paint({ x: u, y: uv1.y + dy * t }, size, color, opacity * 0.5, isEraser);
  }
}

// =========================================================
// Sticker/Decal System
// =========================================================

export const STICKER_PATHS = [
  'stickers/Clay_sticker_04.png',
  'stickers/Clay_sticker_05.png',
  'stickers/Clay_sticker_06.png',
  'stickers/Clay_sticker_07.png',
  'stickers/Clay_sticker_08.png',
  'stickers/Clay_sticker_09.png',
  'stickers/Clay_sticker_010.png',
  'stickers/Clay_sticker_011.png'
];

export const stickerImages = [];
for (const path of STICKER_PATHS) {
  const img = new Image();
  img.src = path;
  stickerImages.push(img);
}

let selectedStickerIndex = 0;

export function getSelectedStickerIndex() { return selectedStickerIndex; }
export function setSelectedStickerIndex(i) { selectedStickerIndex = i; }

export function placeSticker(uv) {
  if (stickerImages.length === 0) return;

  const randomize = controls.get('stickerRandomize');
  const idx = randomize
    ? Math.floor(Math.random() * stickerImages.length)
    : selectedStickerIndex % stickerImages.length;
  const img = stickerImages[idx];
  if (!img.complete) return;

  let scale = controls.get('stickerScale') / 100;
  let rotation = controls.get('stickerRotation') * Math.PI / 180;

  if (randomize) {
    scale *= 0.5 + Math.random() * 1.0;
    rotation = Math.random() * Math.PI * 2;
  }

  const stickerSize = TEX * 0.1 * scale;
  const px = uv.x * TEX;
  const py = (1 - uv.y) * TEX;

  stickerCtx.save();
  stickerCtx.translate(px, py);
  stickerCtx.rotate(rotation);
  stickerCtx.drawImage(img, -stickerSize / 2, -stickerSize / 2, stickerSize, stickerSize);

  // UV wrapping
  if (px < stickerSize) {
    stickerCtx.drawImage(img,
      -stickerSize / 2 + TEX, -stickerSize / 2,
      stickerSize, stickerSize
    );
  } else if (px > TEX - stickerSize) {
    stickerCtx.drawImage(img,
      -stickerSize / 2 - TEX, -stickerSize / 2,
      stickerSize, stickerSize
    );
  }

  stickerCtx.restore();
  compositeTexture();
}

// =========================================================
// GLB Export
// =========================================================

export async function exportGLB() {
  compositeTexture();

  const exporter = new GLTFExporter();
  const glb = await exporter.parseAsync(wheelGroup, { binary: true });

  const blob = new Blob([glb], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'vase.glb';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportPNG() {
  const savedBg = scene.background;
  scene.background = null;

  renderer.setClearColor(0x000000, 0);
  renderer.render(scene, camera);

  renderer.domElement.toBlob((blob) => {
    scene.background = savedBg;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'vase.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 'image/png');
}
