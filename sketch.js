// ==== Stato / Parametri ====
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
  randomOffset: 0.0 // 0 = centro fisso, 1 = random pieno
};

let maskSeed = 0;
let slideIndex = 0;

// ==== Helpers DOM ====
const $ = id => document.getElementById(id);
const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); return el; };

// ==== Misure (4:5) - basate sul wrapper ====
function fitRectInBox(aspect, boxW, boxH) {
  let w = Math.floor(boxW);
  let h = Math.floor(w / aspect);
  if (h > boxH) { h = Math.floor(boxH); w = Math.floor(h * aspect); }
  w = Math.max(200, w);
  h = Math.max(200, h);
  return { w, h };
}
function sizeFromWrap() {
  const wrap = document.getElementById('canvasWrap');
  const rect = wrap?.getBoundingClientRect();
  const boxW = Math.max(0, Math.floor(rect?.width  ?? 400));
  const boxH = Math.max(0, Math.floor(rect?.height ?? 300));
  return fitRectInBox(4 / 5, boxW, boxH);
}

function hardResizeToWrap() {
  const { w, h } = sizeFromWrap();
  if (w !== width || h !== height) {
    resizeCanvas(w, h, true);
    if (pg) pg.remove();
    pg = createGraphics(w, h);
    pg.pixelDensity(1);
  }
  redraw();
}

// ==== p5 lifecycle ====
function setup() {
  const { w, h } = sizeFromWrap();
  cnv = createCanvas(w, h);
  cnv.parent('canvasWrap');

  pixelDensity(1);
  pg = createGraphics(w, h);
  pg.pixelDensity(1);

  frameRate(params.fps);

  cnv.drop(gotFile);
  bindUI();
  reflectUIFromParams();

  // Resize: osserva wrapper, sidebar e <details>
  const wrapEl = $('#canvasWrap');
  if (wrapEl) {
    const ro = new ResizeObserver(() => hardResizeToWrap());
    ro.observe(wrapEl);
  }
  const sidebar = $('#sidebar');
  if (sidebar) {
    const mo = new ResizeObserver(() => hardResizeToWrap());
    mo.observe(sidebar);
  }
  document.querySelectorAll('#sidebar details').forEach(d => {
    d.addEventListener('toggle', () => setTimeout(hardResizeToWrap, 60));
  });
  const tgl = $('#menuToggle');
  if (tgl) tgl.addEventListener('click', () => {
    $('#sidebar')?.classList.toggle('open');
    setTimeout(hardResizeToWrap, 260);
  });
  window.addEventListener('resize', hardResizeToWrap);
  setTimeout(hardResizeToWrap, 80);
}

function draw() {
  background(params.bg);

  if (images.length === 0) {
    drawEmptyHint();
    return;
  }

  if (params.mode === 'slideshow') {
    if (frameCount % Math.max(1, Math.floor(60 / params.fps)) === 0) {
      slideIndex = params.shuffle ? Math.floor(random(images.length))
                                  : (slideIndex + 1) % images.length;
    }
    drawOne(images[slideIndex], 0);
    return;
  }

  for (let k = 0; k < images.length; k++) {
    drawOne(images[k], params.perImage ? k : 0);
  }
}

// ==== Disegno frame ====
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

// ==== centro random helper (da centro verso random) ====
function randomCenter() {
  if (params.randomOffset <= 0) return [width/2, height/2];
  const maxOffsetX = (width  / 2) * params.randomOffset;
  const maxOffsetY = (height / 2) * params.randomOffset;
  const dx = random(-maxOffsetX, maxOffsetX);
  const dy = random(-maxOffsetY, maxOffsetY);
  return [width/2 + dx, height/2 + dy];
}

// ==== Maschere ====
function generateMask(seed) {
  randomSeed(seed);
  noiseSeed(seed);
  pg.clear();
  if (params.invert) { pg.background(255); pg.fill(0); }
  else { pg.background(0, 0); pg.fill(255); }
  pg.noStroke();

  switch (params.maskType) {
    // --- noise + varianti ---
    case 'noise':         drawNoiseMask(); break;
    case 'noise-radial':  drawNoiseRadialMask(); break;
    case 'noise-multi':   drawNoiseMultiMask(); break;
    case 'noise-ring':    drawNoiseRingMask(); break;

    // --- organiche (opzionali) ---
    case 'organic-center':  drawOrganicCenter(); break;
    case 'organic-scatter':
      drawOrganicScatter();
      if (random() < 0.10) { pg.circle(random(width), random(height), random(Math.min(width, height) * 0.5)); }
      break;
    case 'organic-cloud':   drawOrganicCloud(); break;
    case 'rect-random':     drawRectRandom(); break;

    default:
      drawNoiseMask();
  }

  if (params.feather > 0) pg.filter(BLUR, params.feather);
}

// ---- Noise (originale) ----
function drawNoiseMask() {
  const mag = Math.min(width, height) * (params.size / 100);
  const pts = Math.max(3, params.points);
  const [cx, cy] = randomCenter();
  pg.push();
  pg.translate(cx, cy);
  pg.beginShape();
  for (let i = 0; i < pts; i++) {
    pg.curveVertex(random(-mag, mag), random(-mag, mag));
  }
  pg.endShape(CLOSE);
  pg.pop();
}

// ---- Noise (Radial) ----
function drawNoiseRadialMask() {
  const base = Math.min(width, height) * (params.size / 100);
  const pts = Math.max(6, params.points);
  const nScale = 0.6;
  const [cx, cy] = randomCenter();
  pg.push();
  pg.translate(cx, cy);
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

// ---- Noise (Multi) ----
function drawNoiseMultiMask() {
  const blobs = Math.round(map(params.size, 10, 100, 2, 6));
  const pts = Math.max(6, params.points);
  for (let b = 0; b < blobs; b++) {
    const [cx, cy] = randomCenter(); // ogni blob con offset dal centro
    const base = Math.min(width, height) * (params.size / 100) * random(0.6, 1.2);
    pg.push();
    pg.translate(cx, cy);
    pg.beginShape();
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
    pg.endShape(CLOSE);
    pg.pop();
  }
}

// ---- Noise (Ring) ----
function drawNoiseRingMask() {
  const base = Math.min(width, height) * (params.size / 100);
  const pts = Math.max(6, params.points);
  const [cx, cy] = randomCenter();

  pg.push();
  pg.translate(cx, cy);

  // Blob esterno
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

  // foro interno
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
  pg.endShape(CLOSE);
  pg.pop();

  if (!params.invert) pg.fill(255); else pg.fill(0);
}

// ---- Organiche (facoltative) ----
function drawOrganicCenter() {
  const base = Math.min(width, height) * (params.size / 100);
  const pts = Math.max(3, params.points);
  const jitter = 0.45;
  pg.push();
  pg.translate(width / 2, height / 2);
  pg.beginShape();
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
  pg.endShape(CLOSE);
  pg.pop();
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
    const cx = random(width);
    const cy = random(height);
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
  const x = random(width);
  const y = random(height);
  const w = random(width * 0.2, width);
  const h = random(height * 0.2, height);
  pg.rectMode(CENTER);
  pg.rect(x, y, w, h);
}

// ==== Blend ====
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

// ==== UI ====
function bindUI() {
  on('fileInput','change', e => handleFiles(e.target.files));
  on('clearBtn','click', () => { images = []; updateCounter(); redraw(); });

  on('mode','change', e => { params.mode = e.target.value; toggleSlideshowSection(); redraw(); });
  on('fps','input', e => { params.fps = +e.target.value; frameRate(params.fps); redraw(); });
  on('blend','change', e => { params.blend = e.target.value; redraw(); });
  on('opacity','input', e => { params.opacity = +e.target.value; redraw(); });

  on('maskType','change', e => { params.maskType = e.target.value; redraw(); });
  on('points','input', e => { params.points = +e.target.value; redraw(); });
  on('size','input', e => { params.size = +e.target.value; redraw(); });
  on('feather','input', e => { params.feather = +e.target.value; redraw(); });
  on('invert','change', e => { params.invert = e.target.checked; redraw(); });
  on('perFrame','change', e => { params.perFrame = e.target.checked; redraw(); });
  on('perImage','change', e => { params.perImage = e.target.checked; redraw(); });
  on('randomizeBtn','click', () => { maskSeed = (maskSeed + 1) >>> 0; redraw(); });

  on('shuffle','change', e => { params.shuffle = e.target.checked; redraw(); });

  // slider Random Offset
  on('randomOffset','input', e => { params.randomOffset = parseFloat(e.target.value); redraw(); });

  on('saveBtn','click', () => saveCanvas('frame','png'));

  window.addEventListener('keydown', (e) => {
    if (e.key === 's' || e.key === 'S') saveCanvas('frame','png');
    if (e.key === ' ') { e.preventDefault(); maskSeed = (maskSeed + 1) >>> 0; redraw(); }
    if (e.key === 'r' || e.key === 'R') {
      params.perFrame = !params.perFrame;
      const el = $('#perFrame'); if (el) el.checked = params.perFrame;
      redraw();
    }
    if (params.mode === 'slideshow' && images.length > 0) {
      if (e.key === 'ArrowRight') slideIndex = (slideIndex + 1) % images.length;
      if (e.key === 'ArrowLeft')  slideIndex = (slideIndex - 1 + images.length) % images.length;
    }
  });

  toggleSlideshowSection();
}

function reflectUIFromParams() {
  const reflect = (id, val, prop='value') => { const el = $(id); if (el) el[prop] = val; };
  reflect('maskType', params.maskType);
  reflect('mode', params.mode);
  reflect('fps', params.fps);
  reflect('blend', params.blend);
  reflect('opacity', params.opacity);
  reflect('points', params.points);
  reflect('size', params.size);
  reflect('feather', params.feather);
  reflect('perFrame', params.perFrame, 'checked');
  reflect('perImage', params.perImage, 'checked');
  reflect('invert', params.invert, 'checked');
  reflect('shuffle', params.shuffle, 'checked');
  reflect('bg', params.bg);
  reflect('randomOffset', params.randomOffset);
}

function toggleSlideshowSection() {
  const sec = $('#slideshowSection');
  if (sec) sec.style.display = (params.mode === 'slideshow') ? 'block' : 'none';
}

// ==== UI extra / hint ====
function drawEmptyHint() {
  fill(200);
  textAlign(CENTER, CENTER);
  textSize(16);
  text('Carica o trascina qui immagini (JPG/PNG)\n\nSpazio: rigenera • S: salva • R: per frame • ←/→ slideshow', width/2, height/2);
}

// ==== I/O immagini ====
function updateCounter() {
  const el = $('#counter');
  if (el) el.textContent = `${images.length} immagine${images.length === 1 ? '' : 'i'}`;
}
function gotFile(file) {
  if (file && file.type && file.type.startsWith('image')) {
    loadImage(file.data, (img) => { 
      images.push(img); 
      updateCounter(); 
      redraw();
    });
  }
}
function handleFiles(fileList) {
  if (!fileList || fileList.length === 0) return;
  Array.from(fileList).filter(f => f.type.startsWith('image/')).forEach(f => {
    const reader = new FileReader();
    reader.onload = e => loadImage(e.target.result, img => { 
      images.push(img); 
      updateCounter(); 
      redraw();
    });
    reader.readAsDataURL(f);
  });
}
