// ============================================================
// VEKTOR VISUALIZER — vektor.js
// ============================================================

const canvas = document.getElementById('main');
const ctx = canvas.getContext('2d');

let mode = '3d';
let rotX = 13.15, rotY = -3.75;
let autoRot = false;
let zoom = 72;
let dragging = false, lastMX = 0, lastMY = 0;
let W, H, CX, CY;

// 2D pan offset (in canvas px)
let pan2X = 0, pan2Y = 0;

// Color palette for multiple vectors
const PALETTE = [
  { vec: '#5b8ff0', sa: '#f06a4a' },
  { vec: '#4af0a0', sa: '#f0c44a' },
  { vec: '#c44af0', sa: '#f04ab8' },
  { vec: '#4ab8f0', sa: '#f07a4a' },
];

// Vector letter names: a, b, c, ...
const VECTOR_LETTERS = 'abcdefghijklmnopqrstuvwxyz';

// Combining right-arrow-above character (für Canvas-Labels)
const ARROW = '\u20D7';

// Gibt HTML für einen Vektornamen mit sichtbarem Pfeil zurück
function arrowHtml(name) {
  return `<span class="vec-arrow"><span class="vec-arrow-sym">→</span><span class="vec-arrow-letter">${name}</span></span>`;
}

// Vector state
let vectors = [];
let nextId = 1;

// ---- GRID SIZE ----
function getGridSize() {
  const v = parseInt(document.getElementById('grid-size').value) || 6;
  return Math.max(2, Math.min(20, v));
}

// ---- VECTOR NAME ----
function getVectorName(index) {
  return VECTOR_LETTERS[index % VECTOR_LETTERS.length];
}

// ---- MODE ----
function setMode(m) {
  mode = m;
  document.getElementById('btn3d').classList.toggle('active', m === '3d');
  document.getElementById('btn2d').classList.toggle('active', m === '2d');
  document.getElementById('hint').textContent = m === '3d'
    ? 'Ziehen zum Drehen · Scroll zum Zoomen'
    : 'Ziehen zum Verschieben · Scroll zum Zoomen';
  vectors.forEach(v => updateCardMode(v.id));
  draw();
}

function updateCardMode(id) {
  const az0w = document.getElementById(`az0-wrap-${id}`);
  const az0s = document.getElementById(`az0-sep-${id}`);
  const a3w  = document.getElementById(`a3-wrap-${id}`);
  const sz0w = document.getElementById(`sz0-wrap-${id}`);
  const startLabel = document.getElementById(`start-label-${id}`);
  if (az0w) az0w.style.display = mode === '2d' ? 'none' : '';
  if (az0s) az0s.style.display = mode === '2d' ? 'none' : '';
  if (a3w)  a3w.style.display  = mode === '2d' ? 'none' : '';
  if (sz0w) sz0w.style.display = mode === '2d' ? 'none' : '';
  if (startLabel) startLabel.textContent = mode === '2d' ? 'Startpunkt x₀ | y₀' : 'Startpunkt x₀ | y₀ | z₀';
}

// ---- VECTOR MANAGEMENT ----
function addVector() {
  const id = nextId++;
  const idx = vectors.length;
  const colorIdx = idx % PALETTE.length;
  const name = getVectorName(idx);
  vectors.push({
    id, colorIdx,
    name,
    customName: null,
    customColor: null,
    customSaColor: null,
    collapsed: false,
    ax0: 0, ay0: 0, az0: 0,
    a1: 2, a2: 1, a3: 1,
    s: 2,
    showSa: false,
    sameStart: true,
    sx0: 0, sy0: 0, sz0: 0
  });
  renderVectorList();
  draw();
}

function removeVector(id) {
  vectors = vectors.filter(v => v.id !== id);
  // Standardnamen nur für Vektoren vergeben, die noch keinen benutzerdefinierten haben
  vectors.forEach((v, i) => {
    if (!v.customName) v.name = getVectorName(i);
  });
  renderVectorList();
  draw();
}

function toggleCollapse(id) {
  const v = vectors.find(v => v.id === id);
  if (!v) return;
  v.collapsed = !v.collapsed;
  const card = document.getElementById(`card-${id}`);
  if (card) card.classList.toggle('collapsed', v.collapsed);
}

function getVecColor(v) {
  if (v.customColor) return v.customColor;
  return PALETTE[v.colorIdx % PALETTE.length].vec;
}
function getSaColor(v) {
  if (v.customSaColor) return v.customSaColor;
  return PALETTE[v.colorIdx % PALETTE.length].sa;
}

function onColorChange(id) {
  const v = vectors.find(v => v.id === id);
  if (!v) return;
  const input = document.getElementById(`color-${id}`);
  v.customColor = input ? input.value : null;
  const dot = document.getElementById(`colordot-${id}`);
  if (dot) dot.style.background = getVecColor(v);
  draw();
}

function onSaColorChange(id) {
  const v = vectors.find(v => v.id === id);
  if (!v) return;
  const input = document.getElementById(`sa-color-${id}`);
  v.customSaColor = input ? input.value : null;
  const dot = document.getElementById(`sa-colordot-${id}`);
  if (dot) dot.style.background = getSaColor(v);
  draw();
}

function onNameInput(id) {
  const v = vectors.find(v => v.id === id);
  if (!v) return;
  const input = document.getElementById(`vecname-${id}`);
  const newName = (input ? input.value.trim() : '') || getVectorName(vectors.indexOf(v));
  v.name = newName;
  v.customName = newName;
  // Canvas-Label aktualisieren (kein DOM-Re-render nötig)
  draw();
}

function renderVectorList() {
  const container = document.getElementById('vector-list');
  container.innerHTML = '';
  vectors.forEach(vec => {
    container.appendChild(buildVectorCard(vec));
    updateCardMode(vec.id);
  });
}

function buildVectorCard(vec) {
  const id = vec.id;
  const col = getVecColor(vec);
  const saCol = getSaColor(vec);
  const nameArrow = vec.name + ARROW;
  const startLabelText = mode === '2d' ? 'Startpunkt x₀ | y₀' : 'Startpunkt x₀ | y₀ | z₀';

  const card = document.createElement('div');
  card.className = 'vector-card' + (vec.collapsed ? ' collapsed' : '');
  card.id = `card-${id}`;

  // ---- HEADER ----
  const header = document.createElement('div');
  header.className = 'vector-card-header';
  header.innerHTML = `
    <div class="vector-card-title">
      <span id="colordot-${id}" style="width:8px;height:8px;border-radius:50%;background:${col};display:inline-block;flex-shrink:0;"></span>
      <span>Vektor </span><input class="vec-name-input" id="vecname-${id}" value="${vec.name}" maxlength="6" title="Vektorname bearbeiten" onclick="event.stopPropagation()" oninput="onNameInput(${id})">
    </div>
    <div class="vector-card-actions">
      ${vectors.length > 1 ? `<button class="btn-remove" onclick="removeVector(${id});event.stopPropagation()">✕</button>` : ''}
      <span class="collapse-icon">▾</span>
    </div>
  `;
  header.addEventListener('click', () => toggleCollapse(id));
  card.appendChild(header);

  // ---- BODY ----
  const body = document.createElement('div');
  body.className = 'vector-card-body';

  body.innerHTML = `
    <!-- Farbe -->
    <div class="subsection-label">Farbe</div>
    <div class="color-row">
      <input type="color" id="color-${id}" value="${col}" oninput="onColorChange(${id})">
      <span class="color-row-label">Vektorfarbe</span>
    </div>

    <!-- Startpunkt -->
    <div class="subsection-label" id="start-label-${id}">${startLabelText}</div>
    <div class="vec-start-row" id="a-start-row-${id}">
      <div class="vec-start-col">
        <label>x₀</label>
        <input type="number" id="ax0-${id}" value="${vec.ax0}" step="0.5" oninput="onVecInput(${id})">
      </div>
      <div class="vec-start-sep">|</div>
      <div class="vec-start-col">
        <label>y₀</label>
        <input type="number" id="ay0-${id}" value="${vec.ay0}" step="0.5" oninput="onVecInput(${id})">
      </div>
      <div class="vec-start-sep" id="az0-sep-${id}">|</div>
      <div class="vec-start-col" id="az0-wrap-${id}">
        <label>z₀</label>
        <input type="number" id="az0-${id}" value="${vec.az0}" step="0.5" oninput="onVecInput(${id})">
      </div>
    </div>

    <!-- Richtungsvektor als Spaltenvektor -->
    <div class="subsection-label" style="margin-top:12px;">Richtungsvektor</div>
    <div class="vec-display-wrap">
      <span class="vec-name-label">${arrowHtml(vec.name)} =</span>
      <span class="vec-paren vec-paren-left">(</span>
      <div class="vec-col-inputs vec-col-compact" id="a-dir-row-${id}">
        <div class="vec-col-item">
          <input type="number" id="a1-${id}" value="${vec.a1}" step="0.5" oninput="onVecInput(${id})" placeholder="${vec.name}₁">
        </div>
        <div class="vec-col-item">
          <input type="number" id="a2-${id}" value="${vec.a2}" step="0.5" oninput="onVecInput(${id})" placeholder="${vec.name}₂">
        </div>
        <div class="vec-col-item" id="a3-wrap-${id}">
          <input type="number" id="a3-${id}" value="${vec.a3}" step="0.5" oninput="onVecInput(${id})" placeholder="${vec.name}₃">
        </div>
      </div>
      <span class="vec-paren vec-paren-right">)</span>
    </div>

    <div class="readout" id="readout-a-${id}"></div>

    <!-- s·v section -->
    <div class="sa-section">
      <div class="sa-section-header">
        <div class="sa-section-title">
          <span id="sa-colordot-${id}" style="width:6px;height:6px;border-radius:50%;background:${saCol};display:inline-block;flex-shrink:0;"></span>
          Skalar s · ${arrowHtml(vec.name)}
        </div>
        <div class="checkbox-row" style="margin-bottom:0;">
          <input type="checkbox" id="show-sa-${id}" ${vec.showSa ? 'checked' : ''} onchange="onShowSaChange(${id})">
          <label for="show-sa-${id}" style="font-size:10px;">anzeigen</label>
        </div>
      </div>
      <div class="sa-body${vec.showSa ? '' : ' hidden'}" id="sa-body-${id}">
        <div class="color-row" style="margin-bottom:8px;">
          <input type="color" id="sa-color-${id}" value="${saCol}" oninput="onSaColorChange(${id})">
          <span class="color-row-label">Skalarfarbe</span>
        </div>
        <div class="slider-field">
          <div class="slider-top">
            <label>Faktor s</label>
            <span class="val" id="sval-${id}">${vec.s.toFixed(1)}</span>
          </div>
          <input type="range" id="scalar-${id}" min="-4" max="4" step="0.1" value="${vec.s}" oninput="onScalarSlider(${id})">
        </div>
        <div class="field-row one" style="margin-bottom:8px;">
          <div class="field">
            <label>Genauer Wert</label>
            <input type="number" id="scalar-exact-${id}" value="${vec.s}" step="0.1" oninput="onScalarExact(${id})">
          </div>
        </div>
        <div class="checkbox-row">
          <input type="checkbox" id="same-start-${id}" ${vec.sameStart ? 'checked' : ''} onchange="onSameStartChange(${id})">
          <label for="same-start-${id}">Gleicher Startpunkt wie ${arrowHtml(vec.name)}</label>
        </div>
        <div id="sa-custom-start-${id}" style="display:${vec.sameStart ? 'none' : 'block'};">
          <div class="subsection-label">Startpunkt s·${arrowHtml(vec.name)}</div>
          <div class="vec-col-inputs">
            <div class="vec-col-item">
              <label>x₀</label>
              <input type="number" id="sx0-${id}" value="${vec.sx0}" step="0.5" oninput="onVecInput(${id})">
            </div>
            <div class="vec-col-item">
              <label>y₀</label>
              <input type="number" id="sy0-${id}" value="${vec.sy0}" step="0.5" oninput="onVecInput(${id})">
            </div>
            <div class="vec-col-item" id="sz0-wrap-${id}">
              <label>z₀</label>
              <input type="number" id="sz0-${id}" value="${vec.sz0}" step="0.5" oninput="onVecInput(${id})">
            </div>
          </div>
        </div>
        <div class="readout" id="readout-s-${id}"></div>
      </div>
    </div>
  `;

  card.appendChild(body);
  return card;
}

// ---- INPUT HANDLERS ----
function onVecInput(id) {
  readVecFromDOM(id);
  updateReadout(id);
  draw();
}

function onShowSaChange(id) {
  const v = vectors.find(v => v.id === id);
  if (!v) return;
  v.showSa = document.getElementById(`show-sa-${id}`).checked;
  const body = document.getElementById(`sa-body-${id}`);
  if (body) body.classList.toggle('hidden', !v.showSa);
  draw();
}

function onSameStartChange(id) {
  const v = vectors.find(v => v.id === id);
  if (!v) return;
  v.sameStart = document.getElementById(`same-start-${id}`).checked;
  const cs = document.getElementById(`sa-custom-start-${id}`);
  if (cs) cs.style.display = v.sameStart ? 'none' : 'block';
  draw();
}

function onScalarSlider(id) {
  const val = parseFloat(document.getElementById(`scalar-${id}`).value) || 0;
  const v = vectors.find(v => v.id === id);
  if (v) v.s = val;
  const sval  = document.getElementById(`sval-${id}`);
  const exact = document.getElementById(`scalar-exact-${id}`);
  if (sval)  sval.textContent = val.toFixed(1);
  if (exact) exact.value      = val.toFixed(1);
  updateReadout(id);
  draw();
}

function onScalarExact(id) {
  const val     = parseFloat(document.getElementById(`scalar-exact-${id}`).value) || 0;
  const clamped = Math.max(-4, Math.min(4, val));
  const v = vectors.find(v => v.id === id);
  if (v) v.s = val;
  const slider = document.getElementById(`scalar-${id}`);
  const sval   = document.getElementById(`sval-${id}`);
  if (slider) slider.value        = clamped;
  if (sval)   sval.textContent    = val.toFixed(1);
  updateReadout(id);
  draw();
}

function readVecFromDOM(id) {
  const v = vectors.find(v => v.id === id);
  if (!v) return;
  const g = (field) => parseFloat(document.getElementById(`${field}-${id}`)?.value) || 0;
  v.ax0 = g('ax0'); v.ay0 = g('ay0'); v.az0 = g('az0');
  v.a1  = g('a1');  v.a2  = g('a2');  v.a3  = g('a3');
  v.sx0 = g('sx0'); v.sy0 = g('sy0'); v.sz0 = g('sz0');
  v.s        = parseFloat(document.getElementById(`scalar-${id}`)?.value) || 0;
  v.showSa   = document.getElementById(`show-sa-${id}`)?.checked || false;
  v.sameStart = document.getElementById(`same-start-${id}`)?.checked ?? true;
}

function getVecData(v) {
  const a  = [v.a1, v.a2, v.a3];
  const sa = a.map(x => x * v.s);
  const sx0 = v.sameStart ? v.ax0 : v.sx0;
  const sy0 = v.sameStart ? v.ay0 : v.sy0;
  const sz0 = v.sameStart ? v.az0 : v.sz0;
  return { a, sa, sx0, sy0, sz0 };
}

// ---- READOUTS ----
function r2(n) { return Math.round(n * 100) / 100; }

// Gibt HTML für einen Spaltenvektor mit skalierten echten Klammern zurück
function colVecHtml(nums, color) {
  const colorStyle = color ? `color:${color};` : '';
  const rows = nums.map(n => `<div style="${colorStyle}">${r2(n)}</div>`).join('');
  return `<span class="readout-vec-col"><span class="readout-vec-paren">&#40;</span><span class="readout-vec-nums" style="${colorStyle}">${rows}</span><span class="readout-vec-paren">&#41;</span></span>`;
}

function updateReadout(id) {
  const v = vectors.find(v => v.id === id);
  if (!v) return;
  const { a, sa, sx0, sy0, sz0 } = getVecData(v);
  const len_a  = Math.sqrt(a.reduce((s, x)  => s + x * x, 0));
  const len_sa = Math.sqrt(sa.reduce((s, x) => s + x * x, 0));
  const nameHtml = arrowHtml(v.name);

  const ro = document.getElementById(`readout-a-${id}`);
  if (ro) {
    if (mode === '3d') {
      ro.innerHTML = `
        <div class="readout-row"><span class="key">${nameHtml} =</span><span class="value">${colVecHtml([a[0], a[1], a[2]])}</span></div>
        <div class="readout-row"><span class="key">|${nameHtml}|</span><span class="value">${r2(len_a)}</span></div>
        <div class="readout-row"><span class="key">Start</span><span class="value">${r2(v.ax0)} | ${r2(v.ay0)} | ${r2(v.az0)}</span></div>`;
    } else {
      ro.innerHTML = `
        <div class="readout-row"><span class="key">${nameHtml} =</span><span class="value">${colVecHtml([a[0], a[1]])}</span></div>
        <div class="readout-row"><span class="key">|${nameHtml}|</span><span class="value">${r2(len_a)}</span></div>
        <div class="readout-row"><span class="key">Start</span><span class="value">${r2(v.ax0)} | ${r2(v.ay0)}</span></div>`;
    }
  }

  if (!v.showSa) return;
  const rs = document.getElementById(`readout-s-${id}`);
  if (rs) {
    if (mode === '3d') {
      rs.innerHTML = `
        <div class="readout-row"><span class="key">s·${nameHtml} =</span><span class="value">${colVecHtml([sa[0], sa[1], sa[2]])}</span></div>
        <div class="readout-row"><span class="key">|s·${nameHtml}|</span><span class="value">${r2(len_sa)}</span></div>
        <div class="readout-row"><span class="key">Start</span><span class="value">${r2(sx0)} | ${r2(sy0)} | ${r2(sz0)}</span></div>`;
    } else {
      rs.innerHTML = `
        <div class="readout-row"><span class="key">s·${nameHtml} =</span><span class="value">${colVecHtml([sa[0], sa[1]])}</span></div>
        <div class="readout-row"><span class="key">|s·${nameHtml}|</span><span class="value">${r2(len_sa)}</span></div>
        <div class="readout-row"><span class="key">Start</span><span class="value">${r2(sx0)} | ${r2(sy0)}</span></div>`;
    }
  }
}

function updateAllReadouts() {
  vectors.forEach(v => updateReadout(v.id));
  updateBadge();
}

function updateBadge() {
  const badge = document.getElementById('info-badge');
  let html = '';
  vectors.forEach((v, i) => {
    const { a, sa } = getVecData(v);
    const col    = getVecColor(v);
    const saCol  = getSaColor(v);
    const nameHtml = arrowHtml(v.name);
    if (i > 0) html += `<div class="ib-sep"></div>`;
    if (mode === '3d') {
      html += `<div class="ib-row"><span class="ib-key">${nameHtml} =</span>${colVecHtml([a[0], a[1], a[2]], col)}</div>`;
      if (v.showSa) {
        html += `<div class="ib-row"><span class="ib-key">s =</span><span style="color:${saCol}">${r2(v.s)}</span></div>`;
        html += `<div class="ib-row"><span class="ib-key">s·${nameHtml} =</span>${colVecHtml([sa[0], sa[1], sa[2]], saCol)}</div>`;
      }
    } else {
      html += `<div class="ib-row"><span class="ib-key">${nameHtml} =</span>${colVecHtml([a[0], a[1]], col)}</div>`;
      if (v.showSa) {
        html += `<div class="ib-row"><span class="ib-key">s =</span><span style="color:${saCol}">${r2(v.s)}</span></div>`;
        html += `<div class="ib-row"><span class="ib-key">s·${nameHtml} =</span>${colVecHtml([sa[0], sa[1]], saCol)}</div>`;
      }
    }
  });
  badge.innerHTML = html;
}

// ---- VIEW ----
function toggleRotate() { autoRot = document.getElementById('auto-rotate').checked; }
function resetView() { rotX = 13.15; rotY = -3.75; zoom = 72; pan2X = 0; pan2Y = 0; draw(); }
function resetAll() {
  vectors = [];
  nextId = 1;
  addVector();
  resetView();
}

// ---- 3D PROJECTION ----
function project3([x, y, z]) {
  const cx = Math.cos(rotX), sx = Math.sin(rotX), cy = Math.cos(rotY), sy = Math.sin(rotY);
  const ry  = z * cx - y * sx;
  const rz  = z * sx + y * cx;
  const rx2 = x * cy + rz * sy;
  const ry2 = ry;
  return [CX + rx2 * zoom, CY - ry2 * zoom];
}

function arrow3(from3, to3, color, lw) {
  const [x1, y1] = project3(from3), [x2, y2] = project3(to3);
  ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  const angle = Math.atan2(y2 - y1, x2 - x1), hs = 11;
  ctx.beginPath(); ctx.fillStyle = color;
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - hs * Math.cos(angle - 0.4), y2 - hs * Math.sin(angle - 0.4));
  ctx.lineTo(x2 - hs * Math.cos(angle + 0.4), y2 - hs * Math.sin(angle + 0.4));
  ctx.closePath(); ctx.fill();
}

function line3(p1, p2, color, lw, dash = []) {
  const [x1, y1] = project3(p1), [x2, y2] = project3(p2);
  ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.setLineDash(dash);
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
}

function label3(p3, txt, color, dx = 8, dy = 0) {
  const [x, y] = project3(p3);
  ctx.fillStyle = color; ctx.font = '500 13px Syne,sans-serif';
  ctx.fillText(txt, x + dx, y + dy);
}

// Zeichnet einen Vektornamen mit Pfeil über dem Buchstaben auf Canvas
function labelVec3(p3, name, color, dx = 10, dy = -6) {
  const [x, y] = project3(p3);
  ctx.fillStyle = color;
  ctx.font = '500 9px Syne,sans-serif';
  ctx.fillText('→', x + dx, y + dy - 10);
  ctx.font = '500 13px Syne,sans-serif';
  ctx.fillText(name, x + dx, y + dy);
}

function labelVec2(p2, name, color, dx = 10, dy = -6) {
  const [x, y] = project2(p2);
  ctx.fillStyle = color;
  ctx.font = '500 9px Syne,sans-serif';
  ctx.fillText('→', x + dx, y + dy - 10);
  ctx.font = '500 13px Syne,sans-serif';
  ctx.fillText(name, x + dx, y + dy);
}

// ---- 2D PROJECTION (with pan) ----
function project2([x, y]) {
  return [CX + pan2X + x * zoom, CY + pan2Y - y * zoom];
}

// 2D line segment — MIT Pfeilspitze
function arrow2(from2, to2, color, lw) {
  const [x1, y1] = project2(from2), [x2, y2] = project2(to2);

  // Linie zeichnen
  ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

  // Pfeilspitze zeichnen
  const angle = Math.atan2(y2 - y1, x2 - x1), hs = 11;
  ctx.beginPath(); ctx.fillStyle = color;
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - hs * Math.cos(angle - 0.4), y2 - hs * Math.sin(angle - 0.4));
  ctx.lineTo(x2 - hs * Math.cos(angle + 0.4), y2 - hs * Math.sin(angle + 0.4));
  ctx.closePath(); ctx.fill();
}

function line2(p1, p2, color, lw, dash = []) {
  const [x1, y1] = project2(p1), [x2, y2] = project2(p2);
  ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.setLineDash(dash);
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
}

function label2(p2, txt, color, dx = 8, dy = 0) {
  const [x, y] = project2(p2);
  ctx.fillStyle = color; ctx.font = '500 13px Syne,sans-serif';
  ctx.fillText(txt, x + dx, y + dy);
}

// ---- DRAW ----
function draw() {
  const dpr  = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (
    canvas.width  !== Math.round(rect.width  * dpr) ||
    canvas.height !== Math.round(rect.height * dpr)
  ) {
    canvas.width  = Math.round(rect.width  * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.scale(dpr, dpr);
  }
  W = rect.width; H = rect.height; CX = W / 2; CY = H / 2;
  ctx.clearRect(0, 0, W, H);

  const showComp = document.getElementById('show-components').checked;
  const showGrid = document.getElementById('show-grid').checked;
  const N = getGridSize();

  if (mode === '3d') draw3d(showComp, showGrid, N);
  else              draw2d(showComp, showGrid, N);

  updateAllReadouts();
}

function draw3d(showComp, showGrid, N) {
  const gridCol = 'rgba(255,255,255,0.06)';
  const axisCol = 'rgba(255,255,255,0.25)';

  if (showGrid) {
    for (let i = -N; i <= N; i++) {
      line3([i, -N, 0], [i,  N, 0], gridCol, 0.5);
      line3([-N, i, 0], [ N, i, 0], gridCol, 0.5);
    }
  }

  const axN = N + 0.5;
  arrow3([-axN, 0, 0], [axN, 0, 0], axisCol, 1);
  arrow3([0, -axN, 0], [0, axN, 0], axisCol, 1);
  arrow3([0, 0, -axN], [0, 0, axN], axisCol, 1);
  label3([axN + 0.2, 0, 0],   'x', 'rgba(255,255,255,0.4)');
  label3([0, axN + 0.2, 0],   'y', 'rgba(255,255,255,0.4)');
  label3([0, 0, axN + 0.2],   'z', 'rgba(255,255,255,0.4)');

  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '11px DM Mono,monospace';
  for (let i = -N; i <= N; i++) {
    if (i === 0) continue;
    const [px,   py  ] = project3([i, 0, 0]); ctx.fillText(i, px - 4,  py + 16);
    const [py_x, py_y] = project3([0, i, 0]); ctx.fillText(i, py_x + 8, py_y + 4);
    const [pz_x, pz_y] = project3([0, 0, i]); ctx.fillText(i, pz_x - 16, pz_y + 4);
  }

  vectors.forEach(v => {
    const { a, sa, sx0, sy0, sz0 } = getVecData(v);
    const col    = getVecColor(v);
    const saCol  = getSaColor(v);
    const colAlpha = col + '80';

    if (showComp) {
      const tip = [v.ax0 + a[0], v.ay0 + a[1], v.az0 + a[2]];
      line3([v.ax0,         v.ay0,         v.az0        ], [v.ax0 + a[0], v.ay0,         v.az0        ], colAlpha, 1, [5, 4]);
      line3([v.ax0 + a[0],  v.ay0,         v.az0        ], [v.ax0 + a[0], v.ay0 + a[1],  v.az0        ], colAlpha, 1, [5, 4]);
      line3([v.ax0 + a[0],  v.ay0 + a[1],  v.az0        ], tip,                                          colAlpha, 1, [5, 4]);
      if (v.showSa && Math.abs(v.s) > 0.02) {
        const stip = [sx0 + sa[0], sy0 + sa[1], sz0 + sa[2]];
        line3([sx0,          sy0,          sz0          ], [sx0 + sa[0],  sy0,          sz0          ], saCol + '80', 1, [5, 4]);
        line3([sx0 + sa[0],  sy0,          sz0          ], [sx0 + sa[0],  sy0 + sa[1],  sz0          ], saCol + '80', 1, [5, 4]);
        line3([sx0 + sa[0],  sy0 + sa[1],  sz0          ], stip,                                        saCol + '80', 1, [5, 4]);
      }
    }

    const atip  = [v.ax0 + a[0], v.ay0 + a[1], v.az0 + a[2]];
    arrow3([v.ax0, v.ay0, v.az0], atip, col, 2.5);
    labelVec3(atip, v.name, col);

    if (v.showSa && Math.abs(v.s) > 0.02) {
      const stip = [sx0 + sa[0], sy0 + sa[1], sz0 + sa[2]];
      arrow3([sx0, sy0, sz0], stip, saCol, 2.5);

      // Neue Berechnung mit sWidth für perfekte Ausrichtung
      const sLabel = r2(v.s) + '\u00B7';
      const [sx, sy] = project3(stip);

      ctx.fillStyle = saCol;
      ctx.font = '500 11px Syne,sans-serif';
      const sWidth = ctx.measureText(sLabel).width;

      ctx.fillText(sLabel, sx + 10, sy + 18);

      ctx.font = '500 9px Syne,sans-serif';
      ctx.fillText('→', sx + 10 + sWidth, sy + 10);

      ctx.font = '500 13px Syne,sans-serif';
      ctx.fillText(v.name, sx + 10 + sWidth, sy + 18);
    }
  });

  const [ox, oy] = project3([0, 0, 0]);
  ctx.beginPath(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.arc(ox, oy, 3, 0, Math.PI * 2); ctx.fill();
}

function draw2d(showComp, showGrid, N) {
  const gridCol = 'rgba(255,255,255,0.06)';
  const axisCol = 'rgba(255,255,255,0.3)';

  const xMin = (-CX - pan2X) / zoom;
  const xMax = ( CX - pan2X) / zoom;
  const yMin = (-CY + pan2Y) / zoom;
  const yMax = ( CY + pan2Y) / zoom;
  const axX0 = xMin - 0.5;
  const axX1 = xMax + 0.5;
  const axY0 = yMin - 0.5;
  const axY1 = yMax + 0.5;

  if (showGrid) {
    const gxStart = Math.ceil(xMin) - 1;
    const gxEnd   = Math.floor(xMax) + 1;
    const gyStart = Math.ceil(yMin) - 1;
    const gyEnd   = Math.floor(yMax) + 1;
    for (let i = gxStart; i <= gxEnd; i++) {
      line2([i, gyStart], [i, gyEnd], gridCol, 0.5);
    }
    for (let i = gyStart; i <= gyEnd; i++) {
      line2([gxStart, i], [gxEnd, i], gridCol, 0.5);
    }
  }

  line2([axX0, 0], [axX1, 0], axisCol, 1);
  line2([0, axY0], [0, axY1], axisCol, 1);

  const margin = 18;
  const [rawXlabelX, rawXlabelY] = project2([axX1, 0]);
  const xlx = Math.min(W - margin, rawXlabelX);
  const xly = Math.max(margin, Math.min(H - margin, rawXlabelY));
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '500 13px Syne,sans-serif';
  ctx.fillText('x', xlx - 10, xly - 4);

  const [rawYlabelX, rawYlabelY] = project2([0, axY1]);
  const ylx = Math.max(margin, Math.min(W - margin, rawYlabelX));
  const yly = Math.max(margin + 4, rawYlabelY);
  ctx.fillText('y', ylx + 6, yly + 12);

  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '11px DM Mono,monospace'; ctx.textAlign = 'center';
  const tickXStart = Math.ceil(xMin);
  const tickXEnd   = Math.floor(xMax);
  const tickYStart = Math.ceil(yMin);
  const tickYEnd   = Math.floor(yMax);
  for (let i = tickXStart; i <= tickXEnd; i++) {
    if (i === 0) continue;
    const [px, py] = project2([i, 0]); ctx.fillText(i, px, py + 16);
  }
  for (let i = tickYStart; i <= tickYEnd; i++) {
    if (i === 0) continue;
    const [px2, py2] = project2([0, i]); ctx.fillText(i, px2 - 16, py2 + 4);
  }
  ctx.textAlign = 'left';

  vectors.forEach(v => {
    const { a, sa, sx0, sy0 } = getVecData(v);
    const col   = getVecColor(v);
    const saCol = getSaColor(v);

    if (showComp) {
      line2([v.ax0, v.ay0], [v.ax0 + a[0], v.ay0], col + '80', 1, [5, 4]);
      line2([v.ax0 + a[0], v.ay0], [v.ax0 + a[0], v.ay0 + a[1]], col + '80', 1, [5, 4]);
      if (v.showSa && Math.abs(v.s) > 0.02) {
        line2([sx0, sy0], [sx0 + sa[0], sy0], saCol + '80', 1, [5, 4]);
        line2([sx0 + sa[0], sy0], [sx0 + sa[0], sy0 + sa[1]], saCol + '80', 1, [5, 4]);
      }
    }

    const atip = [v.ax0 + a[0], v.ay0 + a[1]];
    arrow2([v.ax0, v.ay0], atip, col, 2.5);
    labelVec2(atip, v.name, col);

    if (v.showSa && Math.abs(v.s) > 0.02) {
      const stip = [sx0 + sa[0], sy0 + sa[1]];
      arrow2([sx0, sy0], stip, saCol, 2.5);

      // Neue Berechnung mit sWidth für perfekte Ausrichtung
      const sLabel = r2(v.s) + '\u00B7';
      const [sx, sy] = project2(stip);

      ctx.fillStyle = saCol;
      ctx.font = '500 11px Syne,sans-serif';
      const sWidth = ctx.measureText(sLabel).width;

      ctx.fillText(sLabel, sx + 10, sy + 18);

      ctx.font = '500 9px Syne,sans-serif';
      ctx.fillText('→', sx + 10 + sWidth, sy + 10);

      ctx.font = '500 13px Syne,sans-serif';
      ctx.fillText(v.name, sx + 10 + sWidth, sy + 18);
    }
  });

  const [ox, oy] = project2([0, 0]);
  ctx.beginPath(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.arc(ox, oy, 3, 0, Math.PI * 2); ctx.fill();
}

// ---- EVENTS ----
canvas.addEventListener('mousedown', e => {
  dragging = true;
  lastMX = e.clientX; lastMY = e.clientY;
});
window.addEventListener('mousemove', e => {
  if (!dragging) return;
  const dx = e.clientX - lastMX;
  const dy = e.clientY - lastMY;

  if (mode === '3d') {
    // Invertierte Steuerung: Vorzeichen getauscht
    rotY -= dx * 0.008;
    rotX += dy * 0.008;

    // Aktualisierung der Anzeige rechts oben
    const debugDiv = document.getElementById('debug-coords');
    if (debugDiv) {
      debugDiv.textContent = `rotX: ${rotX.toFixed(2)}, rotY: ${rotY.toFixed(2)}`;
    }
  }
  else {
    pan2X += dx;
    pan2Y += dy;
  }

  lastMX = e.clientX;
  lastMY = e.clientY;
  draw();
});
window.addEventListener('mouseup', () => dragging = false);

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  zoom = Math.max(20, Math.min(300, zoom - e.deltaY * 0.1));
  draw();
}, { passive: false });

canvas.addEventListener('touchstart', e => {
  dragging = true;
  lastMX = e.touches[0].clientX; lastMY = e.touches[0].clientY;
}, { passive: true });
canvas.addEventListener('touchmove', e => {
  if (!dragging) return;
  const dx = e.touches[0].clientX - lastMX;
  const dy = e.touches[0].clientY - lastMY;

  if (mode === '3d') {
    // Invertierte Steuerung: Vorzeichen getauscht
    rotY -= dx * 0.01;
    rotX -= dy * 0.01;
  }
  else {
    pan2X += dx;
    pan2Y += dy;
  }

  lastMX = e.touches[0].clientX;
  lastMY = e.touches[0].clientY;
  draw();
}, { passive: true });
canvas.addEventListener('touchend', () => dragging = false);

// Responsive: bei Fenstergröße neu zeichnen
window.addEventListener('resize', () => draw());

// ---- LOOP ----
function loop() {
  if (autoRot && mode === '3d' && !dragging) { rotY += 0.006; draw(); }
  requestAnimationFrame(loop);
}

// ---- INIT ----
addVector();
loop();
