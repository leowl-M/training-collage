// Mask Playground — canvas 4:5 robusto + stato empty

let cnv, pg;
let images = [];

const params = {
  maskType: 'noise',
  mode: 'overlay',
  fps: 2,
  blend: 'BLEND',
  opacity: 100,
  points: 12,
  size: 32,
  feather: 0,
  perFrame: true,
  perImage: true,
  invert: false,
  shuffle: false,
  bg: '#000000',
  randomOffset: 0.0
};

let maskSeed = 0;
let slideIndex = 0;

// DOM helpers
const $ = id => document.getElementById(id);
const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); return el; };

// UI sync
function updateCounterUI(){
  const n = images.length;
  const txt = `${n} immagine${n === 1 ? '' : 'i'}`;
  const a = $('#counter');   if (a) a.textContent = txt;
  const b = $('#infoCount'); if (b) b.textContent = txt;
}
function updateFPSUI(p5inst){
  const el = $('#infoFps'); if (!el) return;
  if (!updateFPSUI._last || performance.now() - updateFPSUI._last > 250){
    el.textContent = `FPS: ${Math.round(p5inst.frameRate())}`;
    updateFPSUI._last = performance.now();
  }
}
function setWrapEmptyState(isEmpty){
  const w = $('#canvasWrap');
  if (w) w.classList.toggle('empty', !!isEmpty);
}

// Misure (4:5) + retry layout
function fitRectInBox(aspect, boxW, boxH) {
  let w = Math.floor(boxW);
  let h = Math.floor(w / aspect);
  if (h > boxH) { h = Math.floor(boxH); w = Math.floor(h * aspect); }
  w = Math.max(200, w); h = Math.max(200, h);
  return { w, h };
}
function sizeFromWrapMaybe() {
  const wrap = $('#canvasWrap');
  if (!wrap) return null;
  const rect = wrap.getBoundingClientRect();
  const boxW = Math.floor(rect.width);
  const boxH = Math.floor(rect.height);
  if (boxW <= 0 || boxH <= 0) return null;
  return fitRectInBox(4/5, boxW, boxH);
}
function ensureSizedCanvas(retries = 24) {
  const sz = sizeFromWrapMaybe();
  if (sz) {
    if (width !== sz.w || height !== sz.h) {
      resizeCanvas(sz.w, sz.h, true);
      if (pg) pg.remove();
      pg = createGraphics(sz.w, sz.h);
      pg.pixelDensity(1);
    }
    redraw();
    return;
  }
  if (retries > 0) setTimeout(() => ensureSizedCanvas(retries - 1), 80);
}
function hardResizeToWrap(){ ensureSizedCanvas(1); } // alias compat

// p5 lifecycle
function setup() {
  // fallback visibile 800×1000
  cnv = createCanvas(800, 1000);
  cnv.parent('canvasWrap');

  pixelDensity(1);
  pg = createGraphics(width, height);
  pg.pixelDensity(1);

  frameRate(params.fps);
  cnv.drop(gotFile);

  bindUI();
  reflectUIFromParams();
  updateCounterUI();

  // ridimensiona quando il layout è pronto
  ensureSizedCanvas();

  // observers
  const wrapEl = $('#canvasWrap');
  if (wrapEl) new ResizeObserver(() => ensureSizedCanvas()).observe(wrapEl);
  const sidebar = $('#sidebar');
  if (sidebar) new ResizeObserver(() => ensureSizedCanvas()).observe(sidebar);
  document.querySelectorAll('#sidebar details').forEach(d => {
    d.addEventListener('toggle', () => setTimeout(ensureSizedCanvas, 60));
  });
  const tgl = $('#menuToggle');
  if (tgl) tgl.addEventListener('click', () => {
    $('#sidebar')?.classList.toggle('open');
    setTimeout(ensureSizedCanvas, 260);
  });
  window.addEventListener('resize', ensureSizedCanvas);

  loopIfNeeded();
  noSmooth();
}

function draw() {
  background(params.bg);

  // stato "vuoto" per CSS
  setWrapEmptyState(images.length === 0);

  if (images.length === 0) {
    updateFPSUI(this);
    return;
  }

  if (params.mode === 'slideshow') {
    if (frameCount % Math.max(1, Math.floor(60 / params.fps)) === 0) {
      slideIndex = params.shuffle ? Math.floor(random(images.length))
                                  : (slideIndex + 1) % images.length;
    }
    drawOne(images[slideIndex], 0);
  } else {
    for (let k = 0; k < images.length; k++) {
      drawOne(images[k], params.perImage ? k : 0);
    }
  }

  updateFPSUI(this);
}

// Disegno frame
function drawOne(img, offset) {
  if (!img) return;
  const displayImg = img.get();
  displayImg.resize(width, height);

  const seed = maskSeed + (params.perFrame ? frameCount * 99991 : 0) + offset * 1013904223;
  generateMask(seed);

  const masked = displayImg.get();
  masked.mask(pg);

  push();
  applyBlend(params.blend);
  tint(255, Math.round(map(params.opacity, 0, 100, 0, 255)));
  image(masked, 0, 0);
  pop();
}

// Centro random
function randomCenter() {
  if (params.randomOffset <= 0) return [width/2, height/2];
  const maxOffsetX = (width  / 2) * params.randomOffset;
  const maxOffsetY = (height / 2) * params.randomOffset;
  const dx = random(-maxOffsetX, maxOffsetX);
  const dy = random(-maxOffsetY, maxOffsetY);
  return [width/2 + dx, height/2 + dy];
}

// Maschere
function generateMask(seed) {
  randomSeed(seed);
  noiseSeed(seed);
  pg.clear();
  if (params.invert) { pg.background(255); pg.fill(0); }
  else { pg.background(0, 0); pg.fill(255); }
  pg.noStroke();

  switch (params.maskType) {
    case 'noise':         drawNoiseMask(); break;
    case 'noise-radial':  drawNoiseRadialMask(); break;
    case 'noise-multi':   drawNoiseMultiMask(); break;
    case 'noise-ring':    drawNoiseRingMask(); break;
    case 'organic-center':  drawOrganicCenter(); break;
    case 'organic-scatter':
      drawOrganicScatter();
      if (random() < 0.10) { pg.circle(random(width), random(height), random(Math.min(width, height) * 0.5)); }
      break;
    case 'organic-cloud':   drawOrganicCloud(); break;
    case 'rect-random':     drawRectRandom(); break;
    default: drawNoiseMask();
  }

  if (params.feather > 0) pg.filter(BLUR, params.feather);
}

// Noise base
function drawNoiseMask() {
  const mag = Math.min(width, height) * (params.size / 100);
  const pts = Math.max(3, params.points);
  const [cx, cy] = randomCenter();
  pg.push(); pg.translate(cx, cy);
  pg.beginShape();
  for (let i = 0; i < pts; i++) pg.curveVertex(random(-mag, mag), random(-mag, mag));
  pg.endShape(CLOSE);
  pg.pop();
}
// Noise radial
function drawNoiseRadialMask() {
  const base = Math.min(width, height) * (params.size / 100);
  const pts = Math.max(6, params.points);
  const nScale = 0.6;
  const [cx, cy] = randomCenter();
  pg.push(); pg.translate(cx, cy);
  pg.beginShape();
  for (let i = 0; i < pts; i++) {
    const a = (TWO_PI / pts) * i;
    const r = base * (0.75 + noise(i * nScale) * 0.8);
    pg.curveVertex(cos(a) * r, sin(a) * r);
  }
  for (let i = 0; i < 3; i++) {
    const a = (TWO_PI / pts) * i;
    const r = base * (0.75 + noise(i * nScale) * 0.8);
    pg.curveVertex(cos(a) * r, sin(a) * r);
  }
  pg.endShape(CLOSE);
  pg.pop();
}
// Noise multi
function drawNoiseMultiMask() {
  const blobs = Math.round(map(params.size, 10, 100, 2, 6));
  const pts = Math.max(6, params.points);
  for (let b = 0; b < blobs; b++) {
    const [cx, cy] = randomCenter();
    const base = Math.min(width, height) * (params.size / 100) * random(0.6, 1.2);
    pg.push(); pg.translate(cx, cy); pg.beginShape();
    for (let i = 0; i < pts; i++) {
      const a = (TWO_PI / pts) * i;
      const r = base * (0.6 + noise(b * 10 + i * 0.5) * 0.9);
      pg.curveVertex(cos(a) * r, sin(a) * r);
    }
    for (let i = 0; i < 3; i++) {
      const a = (TWO_PI / pts) * i;
      const r = base * (0.6 + noise(b * 10 + i * 0.5) * 0.9);
      pg.curveVertex(cos(a) * r, sin(a) * r);
    }
    pg.endShape(CLOSE); pg.pop();
  }
}
// Noise ring
function drawNoiseRingMask() {
  const base = Math.min(width, height) * (params.size / 100);
  const pts = Math.max(6, params.points);
  const [cx, cy] = randomCenter();
  pg.push(); pg.translate(cx, cy);

  pg.beginShape();
  for (let i = 0; i < pts; i++) {
    const a = (TWO_PI / pts) * i;
    const r = base * (0.9 + noise(i * 0.6) * 0.8);
    pg.curveVertex(cos(a) * r, sin(a) * r);
  }
  for (let i = 0; i < 3; i++) {
    const a = (TWO_PI / pts) * i;
    const r = base * (0.9 + noise(i * 0.6) * 0.8);
    pg.curveVertex(cos(a) * r, sin(a) * r);
  }
  pg.endShape(CLOSE);

  pg.fill(0);
  const innerBase = base * 0.55;
  const innerPts = Math.max(6, Math.round(params.points * 0.8));
  pg.beginShape();
  for (let i = 0; i < innerPts; i++) {
    const a = (TWO_PI / innerPts) * i;
    const r = innerBase * (0.8 + noise(100 + i * 0.7) * 0.7);
    pg.curveVertex(cos(a) * r, sin(a) * r);
  }
  for (let i = 0; i < 3; i++) {
    const a = (TWO_PI / innerPts) * i;
    const r = innerBase * (0.8 + noise(100 + i * 0.7) * 0.7);
    pg.curveVertex(cos(a) * r, sin(a) * r);
  }
  pg.endShape(CLOSE); pg.pop();

  if (!params.invert) pg.fill(255); else pg.fill(0);
}
// Organiche
function drawOrganicCenter() {
  const base = Math.min(width, height) * (params.size / 100);
  const pts = Math.max(3, params.points);
  const jitter = 0.45;
  pg.push(); pg.translate(width / 2, height / 2); pg.beginShape();
  for (let i = 0; i < pts; i++) {
    const a = (TWO_PI / pts) * i;
    const r = base * (1 - jitter + random(jitter * 2));
    pg.curveVertex(cos(a) * r, sin(a) * r);
  }
  for (let i = 0; i < 3; i++) {
    const a = (TWO_PI / pts) * i;
    const r = base * (1 - jitter + random(jitter * 2));
    pg.curveVertex(cos(a) * r, sin(a) * r);
  }
  pg.endShape(CLOSE); pg.pop();
}
function drawOrganicScatter() {
  const pts = Math.max(8, params.points + 4);
  pg.beginShape();
  for (let i = 0; i < pts; i++) {
    const x = random(-width, width * 2);
    const y = random(-height, height * 2);
    pg.curveVertex(x, y);
  }
  pg.endShape(CLOSE);
}
function drawOrganicCloud() {
  const blobs = Math.round(map(params.size, 10, 100, 3, 12));
  const localPts = Math.max(5, Math.round(params.points * 0.75));
  const maxD = Math.min(width, height) * 0.35;
  for (let b = 0; b < blobs; b++) {
    const cx = random(width), cy = random(height);
    const base = random(maxD * 0.25, maxD);
    pg.beginShape();
    for (let i = 0; i < localPts; i++) {
      const a = (TWO_PI / localPts) * i;
      const r = base * (0.75 + random(0.5));
      pg.curveVertex(cx + cos(a) * r, cy + sin(a) * r);
    }
    pg.endShape(CLOSE);
  }
}
function drawRectRandom() {
  const x = random(width), y = random(height);
  const w = random(width * 0.2, width), h = random(height * 0.2, height);
  pg.rectMode(CENTER); pg.rect(x, y, w, h);
}

// Blend
function applyBlend(name) {
  switch (name) {
    case 'ADD': blendMode(ADD); break;
    case 'MULTIPLY': blendMode(MULTIPLY); break;
    case 'SCREEN': blendMode(SCREEN); break;
    case 'DARKEST': blendMode(DARKEST); break;
    case 'LIGHTEST': blendMode(LIGHTEST); break;
    case 'DIFFERENCE': blendMode(DIFFERENCE); break;
    case 'EXCLUSION': blendMode(EXCLUSION); break;
    default: blendMode(BLEND);
  }
}

// UI
function bindUI() {
  on('fileInput','change', e => handleFiles(e.target.files));
  on('clearBtn','click', () => { images = []; updateCounterUI(); redraw(); });

  on('mode','change', e => { params.mode = e.target.value; toggleSlideshowSection(); loopIfNeeded(); redraw(); });
  on('fps','input', e => { params.fps = +e.target.value; const o=$('#fpsVal'); if(o)o.textContent=String(params.fps); frameRate(params.fps); loopIfNeeded(); redraw(); });
  on('blend','change', e => { params.blend = e.target.value; redraw(); });
  on('opacity','input', e => { params.opacity = +e.target.value; const o=$('#opacityVal'); if(o)o.textContent=String(params.opacity); redraw(); });

  on('maskType','change', e => { params.maskType = e.target.value; redraw(); });
  on('points','input', e => { params.points = +e.target.value; const o=$('#pointsVal'); if(o)o.textContent=String(params.points); redraw(); });
  on('size','input', e => { params.size = +e.target.value; const o=$('#sizeVal'); if(o)o.textContent=String(params.size); redraw(); });
  on('feather','input', e => { params.feather = +e.target.value; const o=$('#featherVal'); if(o)o.textContent=String(params.feather); redraw(); });
  on('invert','change', e => { params.invert = e.target.checked; redraw(); });
  on('perFrame','change', e => { params.perFrame = e.target.checked; loopIfNeeded(); redraw(); });
  on('perImage','change', e => { params.perImage = e.target.checked; redraw(); });
  on('randomizeBtn','click', () => { maskSeed = (maskSeed + 1) >>> 0; loopOnce(); });

  on('shuffle','change', e => { params.shuffle = e.target.checked; redraw(); });

  on('randomOffset','input', e => {
    params.randomOffset = parseFloat(e.target.value);
    const o=$('#randomOffsetVal'); if(o)o.textContent=String(params.randomOffset);
    redraw();
  });

  on('saveBtn','click', () => saveCanvas('frame','png'));

  toggleSlideshowSection();

  // Drag overlay UX (se presente)
  const drop = $('#dropHint');
  if (drop){
    ['dragenter','dragover'].forEach(ev => window.addEventListener(ev, (e)=>{ e.preventDefault(); drop.style.display='grid'; }));
    ['dragleave','drop'].forEach(ev => window.addEventListener(ev, (e)=>{ e.preventDefault(); drop.style.display='none'; }));
  }
}

function reflectUIFromParams() {
  const reflect = (id, val, prop='value') => { const el = $(id); if (el) el[prop] = val; };
  reflect('maskType', params.maskType);
  reflect('mode', params.mode);
  reflect('fps', params.fps); const o1=$('#fpsVal'); if(o1)o1.textContent=String(params.fps);
  reflect('blend', params.blend);
  reflect('opacity', params.opacity); const o2=$('#opacityVal'); if(o2)o2.textContent=String(params.opacity);
  reflect('points', params.points); const o3=$('#pointsVal'); if(o3)o3.textContent=String(params.points);
  reflect('size', params.size); const o4=$('#sizeVal'); if(o4)o4.textContent=String(params.size);
  reflect('feather', params.feather); const o5=$('#featherVal'); if(o5)o5.textContent=String(params.feather);
  reflect('perFrame', params.perFrame, 'checked');
  reflect('perImage', params.perImage, 'checked');
  reflect('invert', params.invert, 'checked');
  reflect('shuffle', params.shuffle, 'checked');
  reflect('randomOffset', params.randomOffset); const o6=$('#randomOffsetVal'); if(o6)o6.textContent=String(params.randomOffset);
}

function toggleSlideshowSection() {
  const sec = $('#slideshowSection');
  if (sec) sec.style.display = (params.mode === 'slideshow') ? 'block' : 'none';
}

// loop gestione
function loopIfNeeded(){ if (params.mode === 'slideshow' || params.perFrame) loop(); else noLoop(); }
function loopOnce(){ if (!isLooping()) redraw(); }

// I/O immagini
function gotFile(file) {
  if (file && file.type && file.type.startsWith('image')) {
    loadImage(file.data, (img) => { images.push(img); updateCounterUI(); loopOnce(); });
  }
}
function handleFiles(fileList) {
  if (!fileList || fileList.length === 0) return;
  Array.from(fileList).filter(f => f.type.startsWith('image/')).forEach(f => {
    const reader = new FileReader();
    reader.onload = e => loadImage(e.target.result, img => { images.push(img); updateCounterUI(); loopOnce(); });
    reader.readAsDataURL(f);
  });
}
