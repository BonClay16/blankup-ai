// frontend/js/studio.js — v2 Redesign
const API_BASE = window.location.origin + '/api';

/* ============================================================
   TOAST NOTIFICATIONS — intentionally disabled
   ============================================================ */
function showToast() {
  /* Toasts removed globally. Keep signature for existing call sites. */
}

/* ============================================================
   CONSTANTS
   ============================================================ */
const PRODUCT_PRICES = { tshirt: 250000, hoodie: 450000, polo: 350000 };
const PRODUCT_LABELS = { tshirt: 'T-Shirt Custom AI', hoodie: 'Hoodie Custom AI', polo: 'Polo Custom AI' };
const BANK_TRANSFER_INFO = { bankId: '970422', bankName: 'MB Bank', accountName: 'LE LY HUY', accountNumber: '0967145402', template: 'compact2' };

/* ============================================================
   STATE
   ============================================================ */
const state = {
  currentDesign: null,
  selectedProductType: 'tshirt',
  selectedColor: '#ffffff',
  selectedSize: 'M',
  quantity: 1,
  selectedPaymentMethod: 'COD',
  paymentPollingTimer: null,
  currentView: 'front',
  selectedStyle: 'minimalist',
  uploadedFile: null,
  printDesignUrl: null,
  preparedDesignUrls: { front: null, back: null },
  customText: '',
  printPlacement: { x: 0, y: -12, scale: 1 },
  textPlacement: { x: 0, y: 18, scale: 1 },
  compositeDesignUrls: { front: null, back: null },
  compositeCacheKey: '',
  interactionMode: 'position',
  activePlacementLayer: 'image',
  isGeneratingAi: false,
  customTextSides: { front: '', back: '' },
  designProcessVersion: 0,
  viewer3d: null,
  cssViewer: null,
};

function getFrontDesignUrl(d = state.currentDesign) { return d?.frontDesignUrl || d?.designUrl || ''; }
function getBackDesignUrl(d = state.currentDesign) { return d?.backDesignUrl || ''; }
function getActiveDesignUrl(d = state.currentDesign) {
  const f = getFrontDesignUrl(d), b = getBackDesignUrl(d);
  return state.currentView === 'back' ? (b || f) : f;
}
function getPreparedDesignUrl(side = state.currentView) {
  const f = state.preparedDesignUrls.front || getFrontDesignUrl();
  const b = state.preparedDesignUrls.back || getBackDesignUrl();
  return side === 'back' ? (b || f) : f;
}
function getSideCustomText(side = state.currentView) {
  const key = side === 'back' ? 'back' : 'front';
  return state.customTextSides?.[key] || state.currentDesign?.customTextSides?.[key] || state.customText || '';
}
function getCompositeCacheKey(designs) {
  return JSON.stringify({ designs, customText: state.customText, customTextSides: state.customTextSides, printPlacement: state.printPlacement, textPlacement: state.textPlacement });
}

/* ============================================================
   UTILITY
   ============================================================ */
function escapeHtml(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function escapeAttr(s) { return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function formatPrice(v) { return v.toLocaleString('vi-VN') + '₫'; }
function isLightColor(hex) { const c = hex.replace('#', ''); const r = parseInt(c.substr(0, 2), 16), g = parseInt(c.substr(2, 2), 16), b = parseInt(c.substr(4, 2), 16); return (r * 299 + g * 587 + b * 114) / 1000 > 128; }
function lightenColor(hex, pct) { const c = hex.replace('#', ''); let r = parseInt(c.substr(0, 2), 16), g = parseInt(c.substr(2, 2), 16), b = parseInt(c.substr(4, 2), 16); r = Math.min(255, r + Math.round((255 - r) * pct / 100)); g = Math.min(255, g + Math.round((255 - g) * pct / 100)); b = Math.min(255, b + Math.round((255 - b) * pct / 100)); return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`; }
function darkenColor(hex, pct) { const c = hex.replace('#', ''); let r = parseInt(c.substr(0, 2), 16), g = parseInt(c.substr(2, 2), 16), b = parseInt(c.substr(4, 2), 16); r = Math.max(0, r - Math.round(r * pct / 100)); g = Math.max(0, g - Math.round(g * pct / 100)); b = Math.max(0, b - Math.round(b * pct / 100)); return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`; }
function setLoading(btn, loading) { if (!btn) return; btn.classList.toggle('loading', loading); btn.disabled = loading; }
function formatAiError(data) { if (data?.error) return data.error; if (data?.message) return data.message; return 'AI generation failed. Please try again.'; }

/* ============================================================
   TRIAL MODE HELPERS
   ============================================================ */
function isTrialMode() { return document.documentElement.dataset.trial === 'true'; }

function consumeTrial() {
  localStorage.setItem('blankup_guest_trial_used', 'true');
  document.documentElement.dataset.trial = 'trial-consumed';
  const banner = document.getElementById('trialBanner');
  if (banner) banner.classList.remove('active');
}

function showTrialExpiredModal() {
  const modal = document.getElementById('authRequiredModal');
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    const heading = modal.querySelector('h3');
    const desc = modal.querySelector('p');
    if (heading) heading.textContent = 'Đã hết lượt dùng thử';
    if (desc) desc.innerHTML = 'Bạn đã dùng xong lượt tạo miễn phí. Đăng ký tài khoản để <strong>dùng không giới hạn</strong> và tải về thiết kế!';
  }
}

function addWatermark(canvasEl) {
  if (!isTrialMode()) return;
  const existing = canvasEl?.querySelector('.watermark-overlay');
  if (existing) return;
  const wm = document.createElement('div');
  wm.className = 'watermark-overlay';
  wm.innerHTML = '<svg viewBox="0 0 200 200"><text x="100" y="100" text-anchor="middle" dominant-baseline="central" font-size="18" font-weight="800" fill="currentColor" transform="rotate(-25,100,100)">BLANKUP<br/>TRIAL</text></svg>';
  if (canvasEl) canvasEl.appendChild(wm);
}

function removeWatermark(canvasEl) {
  const wm = canvasEl?.querySelector('.watermark-overlay');
  if (wm) wm.remove();
}

function guardTrialBeforeGenerate() {
  const used = localStorage.getItem('blankup_guest_trial_used') === 'true';
  if (used) {
    showTrialExpiredModal();
    return true;
  }
  return false;
}

function markTrialUsedAfterGenerate() {
  if (isTrialMode()) {
    consumeTrial();
    showTrialExpiredModal();
    showToast('Bạn đã dùng hết lượt dùng thử. Đăng ký để dùng không giới hạn!', 'info', 6000);
  }
}

/* ============================================================
   AI GENERATION PROGRESS
   ============================================================ */
const GEN_STAGES = [
  { pct: 8,  msg: 'Đang khởi tạo AI...' },
  { pct: 20, msg: 'AI đang phân tích từ khóa tiếng Việt...' },
  { pct: 35, msg: 'Nhận diện phong cách và ý tưởng thiết kế...' },
  { pct: 50, msg: 'Tối ưu hóa prompt sang tiếng Anh thời trang...' },
  { pct: 65, msg: 'Đang chọn màu sắc và bố cục hài hòa...' },
  { pct: 78, msg: 'Đang vẽ chi tiết thiết kế bằng mô hình Flux...' },
  { pct: 88, msg: 'Hoàn thiện chi tiết và hiệu ứng ánh sáng...' },
  { pct: 95, msg: 'Áp bản decal lên mô hình 3D...' },
];

const genProgress = {
  overlay: null,
  fill: null,
  messageEl: null,
  percentEl: null,
  timer: null,
  currentPct: 0,
  stageIdx: 0,
  done: false,
};

function initGenProgress() {
  genProgress.overlay = document.getElementById('genProgressOverlay');
  genProgress.fill = document.getElementById('genProgressFill');
  genProgress.messageEl = document.getElementById('genProgressMessage');
  genProgress.percentEl = document.getElementById('genProgressPercent');
}

function startGenProgress() {
  if (!genProgress.overlay) initGenProgress();
  genProgress.done = false;
  genProgress.currentPct = 0;
  genProgress.stageIdx = 0;
  genProgress.overlay.classList.remove('error', 'success');
  genProgress.overlay.classList.add('active');
  updateGenProgressUI(0, GEN_STAGES[0].msg);
  clearInterval(genProgress.timer);
  genProgress.timer = setInterval(() => {
    if (genProgress.done) return;
    const step = 1 + Math.floor(Math.random() * 3);
    const next = Math.min(genProgress.currentPct + step, GEN_STAGES[GEN_STAGES.length - 1].pct);
    genProgress.currentPct = next;
    let msg = GEN_STAGES[genProgress.stageIdx].msg;
    for (let i = 0; i < GEN_STAGES.length; i++) {
      if (next >= GEN_STAGES[i].pct) {
        genProgress.stageIdx = i;
        msg = GEN_STAGES[i].msg;
      }
    }
    updateGenProgressUI(next, msg);
  }, 650);
}

function updateGenProgressUI(pct, msg) {
  if (genProgress.fill) genProgress.fill.style.width = pct + '%';
  if (genProgress.percentEl) genProgress.percentEl.textContent = pct + '%';
  if (genProgress.messageEl && msg) genProgress.messageEl.textContent = msg;
}

function completeGenProgress(success = true, message = '') {
  if (!genProgress.overlay || genProgress.done) return;
  genProgress.done = true;
  clearInterval(genProgress.timer);
  genProgress.currentPct = 100;
  updateGenProgressUI(100, message || (success ? 'Hoàn tất!' : ''));
  genProgress.overlay.classList.add(success ? 'success' : 'error');
  const title = genProgress.overlay.querySelector('.gen-progress-title');
  if (title) title.textContent = success ? 'Thiết kế đã sẵn sàng!' : 'Có lỗi xảy ra';
  setTimeout(() => {
    genProgress.overlay.classList.remove('active', 'success', 'error');
    if (title) title.textContent = 'AI đang sáng tạo...';
    genProgress.currentPct = 0;
    updateGenProgressUI(0, GEN_STAGES[0].msg);
  }, success ? 900 : 2200);
}

function failGenProgress(message = 'Vui lòng thử lại sau') {
  completeGenProgress(false, message);
}

/* ============================================================
   COMPOSITE DESIGN (canvas overlay for text + image)
   ============================================================ */
function loadImageForCanvas(url) {
  return new Promise((resolve, reject) => {
    if (!url) return resolve(null);
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img); img.onerror = reject; img.src = url;
  });
}

async function buildCompositePrintUrl(designUrl, side = state.currentView) {
  const sideText = getSideCustomText(side);
  if (!designUrl && !sideText) return '';
  const size = 1024;
  const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, size, size);
  const ip = state.printPlacement || { x: 0, y: -12, scale: 1 };
  const tp = state.textPlacement || { x: 0, y: 18, scale: 1 };

  if (designUrl) {
    try {
      const img = await loadImageForCanvas(designUrl);
      if (img) {
        const maxW = size * 0.58 * ip.scale, maxH = size * 0.58 * ip.scale;
        const ratio = Math.min(maxW / img.width, maxH / img.height);
        const w = img.width * ratio, h = img.height * ratio;
        const x = size * (0.5 + ip.x / 100) - w / 2, y = size * (0.44 + ip.y / 100) - h / 2;
        ctx.drawImage(img, x, y, w, h);
      }
    } catch (e) { console.warn('Composite print error:', e); }
  }
  if (sideText) {
    const text = sideText.toUpperCase();
    const fs = Math.max(34, 82 * tp.scale);
    const x = size * (0.5 + tp.x / 100), y = size * (0.5 + tp.y / 100);
    ctx.font = `900 ${fs}px Outfit, Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(6, fs * 0.12);
    ctx.strokeStyle = 'rgba(255,255,255,0.94)'; ctx.fillStyle = '#111827';
    ctx.strokeText(text, x, y); ctx.fillText(text, x, y);
  }
  return canvas.toDataURL('image/png');
}

async function getCompositeDesignsForViewer(designs) {
  const key = getCompositeCacheKey(designs);
  if (state.compositeCacheKey === key) return state.compositeDesignUrls;
  const [front, back] = await Promise.all([
    buildCompositePrintUrl(designs.front, 'front'),
    designs.back ? buildCompositePrintUrl(designs.back, 'back') : Promise.resolve(null),
  ]);
  state.compositeCacheKey = key; state.compositeDesignUrls = { front, back };
  return state.compositeDesignUrls;
}

/* ============================================================
   DESIGN OVERLAY
   ============================================================ */
function updateDesignOverlayForSide() {
  const overlay = document.getElementById('mockupDesign');
  if (!overlay) return;
  const activeUrl = getPreparedDesignUrl();
  const activeText = getSideCustomText();
  if (!activeUrl && !activeText) return;
  state.printDesignUrl = activeUrl;
  overlay.innerHTML = [
    activeUrl ? `<img src="${escapeAttr(activeUrl)}" alt="Design" class="mockup-print-design" draggable="false">` : '',
    activeText ? `<div class="mockup-print-text">${escapeHtml(activeText)}</div>` : '',
  ].join('');
  updateOverlayPlacement();
  updateThreeTexture();
}

function updateOverlayPlacement() {
  const overlay = document.getElementById('mockupDesign');
  if (!overlay) return;
  const ip = state.printPlacement || { x: 0, y: -12, scale: 1 };
  const tp = state.textPlacement || { x: 0, y: 18, scale: 1 };
  overlay.style.setProperty('--print-x', `${ip.x}%`);
  overlay.style.setProperty('--print-y', `${ip.y}%`);
  overlay.style.setProperty('--print-scale', String(ip.scale));
  overlay.style.setProperty('--text-x', `${tp.x}%`);
  overlay.style.setProperty('--text-y', `${tp.y}%`);
  overlay.style.setProperty('--text-scale', String(tp.scale));
}

function updateThreeTexture() {
  try { window.tshirt360Viewer?.setDesign?.(state.printDesignUrl || null); } catch (e) { /* ignore */ }
}

async function applyCurrentDesignToViewer() {
  const designs = { front: state.preparedDesignUrls.front || getFrontDesignUrl(), back: state.preparedDesignUrls.back || getBackDesignUrl() };
  state.printDesignUrl = getPreparedDesignUrl();
  updateOverlayPlacement();
  if (state.interactionMode !== 'rotate') {
    try { window.tshirt360Viewer?.setDesign?.(null); } catch (e) { /* */ }
    updateThreeTexture(); return;
  }
  const vd = await getCompositeDesignsForViewer(designs);
  try { window.tshirt360Viewer?.setDesign?.(vd.front || state.printDesignUrl); } catch (e) { /* */ }
  updateThreeTexture();
}

function setInteractionMode(mode = 'position') {
  state.interactionMode = mode === 'rotate' ? 'rotate' : 'position';
  document.getElementById('placementModeBtn')?.classList.toggle('active', state.interactionMode === 'position');
  document.getElementById('rotateModeBtn')?.classList.toggle('active', state.interactionMode === 'rotate');
  const viewer = document.getElementById('canvasViewer');
  viewer?.classList.toggle('interaction-position', state.interactionMode === 'position');
  viewer?.classList.toggle('interaction-rotate', state.interactionMode === 'rotate');
  try { window.tshirt360Viewer?.setInteractionMode?.(state.interactionMode); } catch (e) { /* */ }
  if (state.currentDesign || state.printDesignUrl || getSideCustomText()) applyCurrentDesignToViewer();
}

function setActivePlacementLayer(layer = 'image') { state.activePlacementLayer = layer === 'text' ? 'text' : 'image'; updateOverlayPlacement(); }

/* ============================================================
   MOCKUP SVG & COLOR
   ============================================================ */
function updateMockupColor() {
  const mockup = document.getElementById('mockupTshirt');
  if (!mockup) return;
  const c = state.selectedColor, light = isLightColor(c);
  const sc = light ? '#ddd' : 'rgba(255,255,255,0.2)';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 360"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${lightenColor(c, 10)}"/><stop offset="100%" stop-color="${darkenColor(c, 10)}"/></linearGradient></defs><path d="M75 50 L30 80 L10 140 L55 150 L65 100 L65 330 L235 330 L235 100 L245 150 L290 140 L270 80 L225 50 L195 65 Q175 80 150 80 Q125 80 105 65 Z" fill="url(#g)" stroke="${sc}" stroke-width="1"/><ellipse cx="150" cy="52" rx="30" ry="15" fill="none" stroke="${sc}" stroke-width="1"/></svg>`;
  mockup.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  updateThreeTexture();
  try { window.tshirt360Viewer?.setColor?.(c); } catch (e) { /* */ }
}

/* ============================================================
   MOCK DESIGN (SVG fallback)
   ============================================================ */
function generateMockDesign(style, prompt) {
  const colors = ['#ff6b00', '#e65c00', '#ff8c38', '#cc5200', '#ff4500', '#ff7f50', '#ffa500', '#ff6347'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const words = String(prompt || 'DESIGN').split(/\s+/).slice(0, 4);
  const lines = [];
  for (let i = 0; i < words.length && i < 3; i++) {
    lines.push(`<text x="512" y="${420 + i * 60}" text-anchor="middle" font-family="Outfit,Arial,sans-serif" font-size="42" font-weight="800" fill="${color}" opacity="0.9">${escapeHtml(words[i])}</text>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#111827" rx="24"/><circle cx="512" cy="380" r="120" fill="${color}" opacity="0.15"/><circle cx="512" cy="380" r="80" fill="${color}" opacity="0.25"/><circle cx="512" cy="380" r="40" fill="${color}" opacity="0.4"/>${lines.join('')}</svg>`;
  return { success: true, designId: 'draft-' + Date.now(), designUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), prompt, style, author: 'AI Draft', isDraft: true };
}

/* ============================================================
   SHOW DESIGN ON MOCKUP
   ============================================================ */
async function showDesignOnMockup(designUrl, productMockupUrl, productMockupBlank) {
  const viewer = document.getElementById('canvasViewer');
  const empty = document.getElementById('canvasEmpty');
  if (viewer) viewer.style.display = 'flex';
  if (empty) empty.style.display = 'none';

  state.preparedDesignUrls = { front: null, back: null };
  if (designUrl) state.preparedDesignUrls.front = designUrl;
  if (state.currentDesign?.backDesignUrl) state.preparedDesignUrls.back = state.currentDesign.backDesignUrl;

  updateDesignOverlayForSide();
  applyCurrentDesignToViewer();
  document.getElementById('placementPanel')?.style && (document.getElementById('placementPanel').style.display = 'block');
  updatePrice();
  updateActionButtons(true);

  if (isTrialMode()) addWatermark(viewer);
  else removeWatermark(viewer);
}

/* ============================================================
   TAB SWITCHING
   ============================================================ */
function initTabs() {
  document.querySelectorAll('.toolbar-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.toolbar-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = document.querySelector(`.tab-panel[data-panel="${tab.dataset.tab}"]`);
      if (panel) panel.classList.add('active');
    });
  });
}

/* ============================================================
   STYLE SELECTOR
   ============================================================ */
function initStyleSelector() {
  document.querySelectorAll('.style-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.style-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedStyle = btn.dataset.style;
    });
  });
}

/* ============================================================
   IMAGE UPLOAD
   ============================================================ */
function initUpload() {
  const dropzone = document.getElementById('uploadDropzone');
  const fileInput = document.getElementById('imageUpload');
  const preview = document.getElementById('uploadPreview');
  const previewImg = document.getElementById('uploadPreviewImg');
  const removeBtn = document.getElementById('removeUpload');
  if (!dropzone || !fileInput) return;

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', e => { e.preventDefault(); dropzone.classList.remove('dragover'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
  fileInput.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });
  if (removeBtn) removeBtn.addEventListener('click', () => { state.uploadedFile = null; preview.style.display = 'none'; dropzone.style.display = 'flex'; fileInput.value = ''; });

  function handleFile(file) {
    if (!file.type.startsWith('image/')) { showToast('Chỉ chấp nhận file ảnh!', 'warning'); return; }
    if (file.size > 5 * 1024 * 1024) { showToast('File quá lớn (tối đa 5MB)!', 'warning'); return; }
    state.uploadedFile = file;
    const reader = new FileReader();
    reader.onload = e => { previewImg.src = e.target.result; preview.style.display = 'block'; dropzone.style.display = 'none'; };
    reader.readAsDataURL(file);
  }
}

/* ============================================================
   COLOR PICKER
   ============================================================ */
function initColorPicker() {
  const options = document.getElementById('colorOptions');
  if (!options) return;
  options.querySelectorAll('.color-dot').forEach(btn => {
    btn.addEventListener('click', () => {
      options.querySelectorAll('.color-dot').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedColor = btn.dataset.color;
      updateMockupColor();
    });
  });
}

/* ============================================================
   PRODUCT TYPE SELECTOR
   ============================================================ */
function initProductTypeSelector() {
  const options = document.getElementById('productTypeOptions');
  if (!options) return;
  options.querySelectorAll('.product-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pt = btn.dataset.productType;
      if (!PRODUCT_PRICES[pt] || pt === state.selectedProductType) return;
      state.selectedProductType = pt;
      options.querySelectorAll('.product-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updatePrice();
      updateMockupColor();
      if (state.currentDesign?.designUrl) applyCurrentDesignToViewer();
    });
  });
}

/* ============================================================
   SIZE SELECTOR
   ============================================================ */
function initSizeSelector() {
  const options = document.getElementById('sizeOptions');
  if (!options) return;
  options.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      options.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedSize = btn.dataset.size;
    });
  });
}

/* ============================================================
   QUANTITY
   ============================================================ */
function initQuantity() {
  const minus = document.getElementById('qtyMinus');
  const plus = document.getElementById('qtyPlus');
  const display = document.getElementById('qtyValue');
  if (!minus || !plus || !display) return;
  minus.addEventListener('click', () => { if (state.quantity > 1) { state.quantity--; display.textContent = state.quantity; updatePrice(); } });
  plus.addEventListener('click', () => { if (state.quantity < 100) { state.quantity++; display.textContent = state.quantity; updatePrice(); } });
}

/* ============================================================
   PRICE
   ============================================================ */
function updatePrice() {
  const price = PRODUCT_PRICES[state.selectedProductType] || 250000;
  const total = price * state.quantity;
  const el = document.getElementById('totalPrice');
  if (el) el.textContent = formatPrice(total);
}

/* ============================================================
   ACTION BUTTONS
   ============================================================ */
function updateActionButtons(enabled) {
  document.getElementById('orderBtn').disabled = !enabled;
  document.getElementById('downloadBtn').disabled = !enabled;
  document.getElementById('shareDesignBtn').disabled = !enabled;
}

function updateShareButton() {
  const btn = document.getElementById('shareDesignBtn');
  if (!btn) return;
  const canShare = state.currentDesign?.designId && !state.currentDesign?.isDraft && !state.currentDesign?.designId?.startsWith('community-') && !state.currentDesign?.designId?.startsWith('text-only-');
  btn.disabled = !canShare;
}

/* ============================================================
   PROMPT ENHANCE (NEW)
   ============================================================ */
async function enhancePrompt() {
  const input = document.getElementById('promptInput');
  const btn = document.getElementById('promptEnhanceBtn');
  if (!input || !btn) return;
  const prompt = input.value.trim();
  if (!prompt) { showToast('Nhập prompt trước khi enhance!', 'warning'); return; }

  btn.classList.add('enhancing');
  btn.disabled = true;

  try {
    const response = await fetch(`${API_BASE}/ai-design/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth.token ? `Bearer ${auth.token}` : '' },
      body: JSON.stringify({ prompt, style: state.selectedStyle, enhanceOnly: true }),
    });
    const data = await response.json();
    if (data.enhancedPrompt) {
      input.value = data.enhancedPrompt;
      state.customText = '';
      showToast('Prompt đã được AI tối ưu!', 'success');
    } else {
      showToast('Không thể enhance prompt. Thử lại sau.', 'warning');
    }
  } catch (e) {
    // Client-side fallback: simple enhancement
    const enhanced = prompt.charAt(0).toUpperCase() + prompt.slice(1) + ', high quality, detailed, professional artwork, t-shirt design, centered composition, clean background';
    input.value = enhanced;
    showToast('Prompt đã được tối ưu (offline mode)', 'info');
  }

  btn.classList.remove('enhancing');
  btn.disabled = false;
}

/* ============================================================
   DESIGN HISTORY (NEW - localStorage)
   ============================================================ */
const HISTORY_KEY = 'blankup_design_history';
function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
function saveToHistory(design) {
  if (!design || design.isDraft) return;
  const history = getHistory();
  const entry = {
    id: design.designId || 'design-' + Date.now(),
    prompt: design.prompt || '',
    style: design.style || 'minimalist',
    designUrl: design.designUrl || '',
    frontDesignUrl: design.frontDesignUrl || '',
    backDesignUrl: design.backDesignUrl || '',
    timestamp: Date.now(),
  };
  history.unshift(entry);
  if (history.length > 20) history.length = 20;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderHistory();
}
function renderHistory() {
  const list = document.getElementById('historyList');
  if (!list) return;
  const history = getHistory();
  if (history.length === 0) { list.innerHTML = '<div style="padding:8px 12px;font-size:0.78rem;color:var(--s-text-muted);">Chưa có thiết kế nào</div>'; return; }
  list.innerHTML = history.map(h => {
    const time = new Date(h.timestamp);
    const timeStr = time.toLocaleDateString('vi-VN') + ' ' + time.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return `<div class="history-item" data-id="${escapeAttr(h.id)}">
      <img class="history-item-thumb" src="${escapeAttr(h.designUrl || h.frontDesignUrl)}" alt="">
      <div class="history-item-info">
        <div class="history-item-prompt">${escapeHtml(h.prompt || 'Untitled')}</div>
        <div class="history-item-time">${timeStr}</div>
      </div>
      <button class="history-item-delete" title="Xoá">✕</button>
    </div>`;
  }).join('');

  list.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.history-item-delete')) return;
      const id = item.dataset.id;
      const entry = history.find(h => h.id === id);
      if (entry) {
        state.currentDesign = { success: true, designId: entry.id, designUrl: entry.designUrl, frontDesignUrl: entry.frontDesignUrl || entry.designUrl, backDesignUrl: entry.backDesignUrl, prompt: entry.prompt, style: entry.style, author: 'History' };
        showDesignOnMockup(state.currentDesign.designUrl);
        const promptInput = document.getElementById('promptInput');
        if (promptInput && entry.prompt) promptInput.value = entry.prompt;
        showToast('Đã khôi phục thiết kế', 'success');
      }
    });
  });

  list.querySelectorAll('.history-item-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = btn.closest('.history-item');
      const id = item?.dataset.id;
      if (!id) return;
      const h = getHistory().filter(x => x.id !== id);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
      renderHistory();
    });
  });
}

function initHistory() {
  document.getElementById('historyToggle')?.addEventListener('click', () => {
    document.getElementById('panelHistory')?.classList.toggle('open');
  });
  renderHistory();
}

/* ============================================================
   AI GENERATION - PROMPT
   ============================================================ */
function initGenerateButtons() {
  document.getElementById('generatePromptBtn')?.addEventListener('click', generateFromPrompt);
  document.getElementById('generateImageBtn')?.addEventListener('click', generateFromImage);
  document.getElementById('promptEnhanceBtn')?.addEventListener('click', enhancePrompt);
}

async function generateFromPrompt() {
  if (guardTrialBeforeGenerate()) return;
  const prompt = document.getElementById('promptInput')?.value?.trim();
  if (!prompt) { showToast('Vui lòng nhập mô tả thiết kế!', 'warning'); return; }
  const btn = document.getElementById('generatePromptBtn');
  updateActionButtons(false);
  setLoading(btn, true);
  startGenProgress();

  const draft = generateMockDesign(state.selectedStyle, prompt);
  draft.isDraft = true;
  state.currentDesign = draft;
  state.isGeneratingAi = true;
  await showDesignOnMockup(draft.designUrl);

  try {
    const resp = await fetch(`${API_BASE}/ai-design/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth.token ? `Bearer ${auth.token}` : '' },
      body: JSON.stringify({ prompt, style: state.selectedStyle, customText: state.customText, author: auth.user?.fullName || auth.user?.username || '' }),
    });
    const data = await resp.json();
    if (!resp.ok || data.success === false) throw new Error(formatAiError(data));
    if (data.success && data.designUrl) {
      state.currentDesign = data;
      state.customTextSides = data.customTextSides || state.customTextSides;
      state.isGeneratingAi = false;
      completeGenProgress(true);
      await showDesignOnMockup(data.designUrl, data.productMockupUrl, data.productMockupBlank);
      updateShareButton();
      saveToHistory(data);
      markTrialUsedAfterGenerate();
    } else {
      failGenProgress();
    }
  } catch (e) {
    state.isGeneratingAi = false;
    failGenProgress();
    if (e.message && e.message !== 'Failed to fetch') {
      showToast(e.message, 'error', 7000);
      setLoading(btn, false); return;
    }
    console.warn('API unavailable, keeping draft');
  }
  state.isGeneratingAi = false;
  setLoading(btn, false);
}

/* ============================================================
   AI GENERATION - IMAGE
   ============================================================ */
async function generateFromImage() {
  if (guardTrialBeforeGenerate()) return;
  if (!state.uploadedFile) { showToast('Vui lòng upload ảnh!', 'warning'); return; }
  const idea = document.getElementById('ideaInput')?.value?.trim() || '';
  const btn = document.getElementById('generateImageBtn');
  updateActionButtons(false);
  setLoading(btn, true);
  startGenProgress();

  try {
    const formData = new FormData();
    formData.append('image', state.uploadedFile);
    formData.append('idea', idea);
    formData.append('style', state.selectedStyle);
    formData.append('customText', state.customText);
    formData.append('author', auth.user?.fullName || auth.user?.username || '');

    const resp = await fetch(`${API_BASE}/ai-design/generate-from-image`, {
      method: 'POST',
      headers: { Authorization: auth.token ? `Bearer ${auth.token}` : '' },
      body: formData,
    });
    const data = await resp.json();
    if (!resp.ok || data.success === false) throw new Error(formatAiError(data));
    if (data.success && data.designUrl) {
      state.currentDesign = data;
      completeGenProgress(true);
      showDesignOnMockup(data.designUrl, data.productMockupUrl, data.productMockupBlank);
      updateShareButton();
      saveToHistory(data);
      markTrialUsedAfterGenerate();
    } else {
      failGenProgress();
    }
  } catch (e) {
    failGenProgress();
    if (e.message && e.message !== 'Failed to fetch') {
      showToast(e.message, 'error', 7000);
      setLoading(btn, false); return;
    }
    const mock = generateMockDesign('abstract', 'Image remix');
    state.currentDesign = mock;
    showDesignOnMockup(mock.designUrl);
  }
  setLoading(btn, false);
}

/* ============================================================
   VIEW TOGGLE (Front/Back)
   ============================================================ */
function initViewToggle() {
  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentView = btn.dataset.view;
      setViewerSide(state.currentView);
    });
  });
}

function setViewerSide(side) {
  state.currentView = side;
  document.querySelectorAll('.view-toggle-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.view === side));
  try { window.tshirt360Viewer?.showSide?.(side); } catch (e) { /* */ }
  if (state.cssViewer) { side === 'back' ? state.cssViewer.showBack() : state.cssViewer.showFront(); }
  if (state.currentDesign) { updateDesignOverlayForSide(); applyCurrentDesignToViewer(); }
}

/* ============================================================
   INTERACTION MODE (Position/Rotate)
   ============================================================ */
function initInteractionMode() {
  document.getElementById('placementModeBtn')?.addEventListener('click', () => setInteractionMode('position'));
  document.getElementById('rotateModeBtn')?.addEventListener('click', () => setInteractionMode('rotate'));
  document.getElementById('resetViewBtn')?.addEventListener('click', () => {
    state.printPlacement = { x: 0, y: -12, scale: 1 };
    state.textPlacement = { x: 0, y: 18, scale: 1 };
    syncPlacementInputs();
    state.compositeCacheKey = '';
    updateOverlayPlacement();
    applyCurrentDesignToViewer();
    try { window.tshirt360Viewer?.showSide?.(state.currentView); } catch (e) { /* */ }
  });
  document.getElementById('removeWhiteBgBtn')?.addEventListener('click', () => {
    const btn = document.getElementById('removeWhiteBgBtn');
    const enabled = window.tshirt360Viewer?.setRemoveWhiteBg ? window.tshirt360Viewer.setRemoveWhiteBg(btn.classList.contains('active') === false) : true;
    btn.classList.toggle('active', enabled);
  });
}

/* ============================================================
   PLACEMENT CONTROLS
   ============================================================ */
function syncPlacementInputs() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  set('printPosX', Math.round(state.printPlacement.x));
  set('printPosY', Math.round(state.printPlacement.y));
  set('printScale', Math.round(state.printPlacement.scale * 100));
  set('textPosX', Math.round(state.textPlacement.x));
  set('textPosY', Math.round(state.textPlacement.y));
  set('textScale', Math.round(state.textPlacement.scale * 100));
}

function initPrintControls() {
  const textInputs = [document.getElementById('customTextInput'), document.getElementById('customTextInputImage')].filter(Boolean);
  textInputs.forEach(input => {
    input.addEventListener('input', () => {
      state.customText = input.value.trim();
      textInputs.forEach(o => { if (o !== input) o.value = input.value; });
      state.compositeCacheKey = '';
      updateDesignOverlayForSide();
      applyCurrentDesignToViewer();
    });
  });

  // Image placement
  const bind = (ids, stateKey, defaults) => {
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => {
        setActivePlacementLayer(stateKey === 'printPlacement' ? 'image' : 'text');
        state[stateKey] = {
          x: Number(document.getElementById(ids[0])?.value || defaults.x),
          y: Number(document.getElementById(ids[1])?.value || defaults.y),
          scale: Number(document.getElementById(ids[2])?.value || defaults.scale * 100) / 100,
        };
        state.compositeCacheKey = '';
        updateOverlayPlacement();
        applyCurrentDesignToViewer();
      });
    });
  };
  bind(['printPosX', 'printPosY', 'printScale'], 'printPlacement', { x: 0, y: -12, scale: 1 });
  bind(['textPosX', 'textPosY', 'textScale'], 'textPlacement', { x: 0, y: 18, scale: 1 });

  document.getElementById('placementReset')?.addEventListener('click', () => {
    state.printPlacement = { x: 0, y: -12, scale: 1 };
    state.textPlacement = { x: 0, y: 18, scale: 1 };
    syncPlacementInputs();
    state.compositeCacheKey = '';
    updateOverlayPlacement();
    applyCurrentDesignToViewer();
  });

  // Keyboard nudge
  document.addEventListener('keydown', e => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    if (state.interactionMode !== 'position') return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const step = e.shiftKey ? 5 : 1;
    const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
    const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
    nudgePlacement(state.activePlacementLayer, dx, dy);
    e.preventDefault();
  });

  setInteractionMode(state.interactionMode);
  syncPlacementInputs();
  updateOverlayPlacement();
}

function nudgePlacement(layer, dx, dy) {
  if (layer === 'text') {
    state.textPlacement.x = Math.max(-80, Math.min(80, state.textPlacement.x + dx));
    state.textPlacement.y = Math.max(-75, Math.min(45, state.textPlacement.y + dy));
  } else {
    state.printPlacement.x = Math.max(-80, Math.min(80, state.printPlacement.x + dx));
    state.printPlacement.y = Math.max(-75, Math.min(45, state.printPlacement.y + dy));
  }
  syncPlacementInputs();
  state.compositeCacheKey = '';
  updateOverlayPlacement();
  applyCurrentDesignToViewer();
}

/* ============================================================
   3D VIEWER
   ============================================================ */
function initThreeViewer() {
  // Wait for tshirt-360.js module to load
  const check = setInterval(() => {
    if (window.tshirt360Viewer) {
      clearInterval(check);
      window.tshirt360Viewer.setColor(state.selectedColor);
    }
  }, 200);
  setTimeout(() => clearInterval(check), 5000);

  // CSS 3D fallback
  initCss3DViewer();
}

function initCss3DViewer() {
  const container = document.getElementById('canvasViewer');
  if (!container) return;
  let dragging = false, lastX = 0, lastY = 0, tiltX = -3, tiltY = 4;

  function setTilt(x, y) {
    tiltX = Math.max(-18, Math.min(18, x));
    tiltY = Math.max(-38, Math.min(38, y));
    container.style.setProperty('--tilt-x', `${tiltX}deg`);
    container.style.setProperty('--tilt-y', `${tiltY}deg`);
  }

  state.cssViewer = { showFront: () => setTilt(-3, 4), showBack: () => setTilt(-3, -38) };

  container.addEventListener('pointerdown', e => {
    if (state.interactionMode === 'position') return;
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    container.setPointerCapture(e.pointerId);
  });
  container.addEventListener('pointermove', e => {
    if (state.interactionMode === 'position' || !dragging) return;
    setTilt(tiltX - (e.clientY - lastY) * 0.18, tiltY + (e.clientX - lastX) * 0.18);
    lastX = e.clientX; lastY = e.clientY;
  });
  container.addEventListener('pointerup', () => dragging = false);
  container.addEventListener('pointercancel', () => dragging = false);
  container.addEventListener('dblclick', () => setTilt(0, 0));
  setTilt(-3, 4);
}

/* ============================================================
   ORDER FLOW
   ============================================================ */
function initOrderFlow() {
  const modal = document.getElementById('orderModal');
  const form = document.getElementById('orderForm');
  const closeBtn = document.getElementById('modalClose');
  const closeBtn2 = document.getElementById('orderCloseBtn');

  document.getElementById('orderBtn')?.addEventListener('click', () => {
    if (guardTrialBeforeGenerate()) return;
    if (!state.currentDesign) return;
    updateOrderSummary();
    if (auth.isLoggedIn()) {
      const nameInput = document.getElementById('orderName');
      if (nameInput && !nameInput.value) nameInput.value = auth.user?.fullName || auth.user?.username || '';
    }
    modal?.classList.add('active');
  });

  closeBtn?.addEventListener('click', () => modal?.classList.remove('active'));
  closeBtn2?.addEventListener('click', () => { modal?.classList.remove('active'); resetOrderModal(); });
  modal?.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('active'); });

  // Payment method
  document.querySelectorAll('.payment-method-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.payment-method-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedPaymentMethod = btn.dataset.paymentMethod || 'COD';
    });
  });

  form?.addEventListener('submit', e => { e.preventDefault(); submitOrder(); });
}

function updateOrderSummary() {
  const product = PRODUCT_LABELS[state.selectedProductType] || 'T-Shirt Custom AI';
  const price = PRODUCT_PRICES[state.selectedProductType] || 250000;
  const total = price * state.quantity;
  const colorNames = { '#ffffff': 'Trắng', '#000000': 'Đen', '#1e293b': 'Navy', '#6b7280': 'Xám', '#dc2626': 'Đỏ', '#2563eb': 'Xanh', '#059669': 'Xanh lá' };
  document.getElementById('orderProduct').textContent = product;
  document.getElementById('orderColor').textContent = colorNames[state.selectedColor] || state.selectedColor;
  document.getElementById('orderSize').textContent = state.selectedSize;
  document.getElementById('orderQty').textContent = state.quantity;
  document.getElementById('orderTotal').textContent = formatPrice(total);
}

function resetOrderModal() {
  document.getElementById('orderFormContent').style.display = 'block';
  document.getElementById('orderSuccess').style.display = 'none';
  document.getElementById('bankTransferBox').style.display = 'none';
  document.getElementById('orderForm')?.reset();
  document.getElementById('orderSubmitBtn').disabled = false;
}

async function submitOrder() {
  const submitBtn = document.getElementById('orderSubmitBtn');
  const name = document.getElementById('orderName')?.value?.trim();
  const phone = document.getElementById('orderPhone')?.value?.trim();
  const address = document.getElementById('orderAddress')?.value?.trim();
  const note = document.getElementById('orderNote')?.value?.trim();

  if (!name || !phone || !address) { showToast('Vui lòng điền đầy đủ thông tin!', 'warning'); return; }
  if (!/^(\+?84|0)[3-9]\d{8}$/.test(phone.replace(/[\s.\-]/g, ''))) { showToast('Số điện thoại không hợp lệ!', 'warning'); return; }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Đang xử lý...';

  const orderData = {
    designUrl: state.currentDesign?.designUrl || '',
    frontDesignUrl: getFrontDesignUrl(),
    backDesignUrl: getBackDesignUrl(),
    productType: state.selectedProductType,
    color: state.selectedColor,
    size: state.selectedSize,
    quantity: state.quantity,
    customText: state.customText,
    printPlacement: state.printPlacement,
    textPlacement: state.textPlacement,
    customer: { name, phone, address, note },
    payment: state.selectedPaymentMethod,
    userId: auth.user?.id,
    authorName: auth.user?.fullName || auth.user?.username || '',
  };

  try {
    const resp = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth.token ? `Bearer ${auth.token}` : '' },
      body: JSON.stringify(orderData),
    });
    const data = await resp.json();
    if (!resp.ok || data.success === false) throw new Error(data.error || 'Đặt hàng thất bại.');

    const orderId = data.orderId || 'BU-' + Date.now();
    const payment = data.payment || state.selectedPaymentMethod;

    if (payment === 'VNPAY') {
      showOrderSuccess(orderId, payment, data.transferContent);
      try {
        const payResp = await fetch(`${API_BASE}/payment/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: auth.token ? `Bearer ${auth.token}` : '' },
          body: JSON.stringify({ orderId, paymentMethod: 'VNPAY' }),
        });
        const payData = await payResp.json();
        if (payData.success && payData.paymentUrl) {
          window.location.href = payData.paymentUrl;
          return;
        }
        showToast('Không thể tạo link thanh toán. Vui lòng thử lại.', 'error');
      } catch {
        showToast('Không thể kết nối cổng thanh toán.', 'error');
      }
      return;
    }

    showOrderSuccess(orderId, payment, data.transferContent);
  } catch (e) {
    showToast(e.message || 'Đặt hàng thất bại. Thử lại sau.', 'error', 7000);
  }
  submitBtn.disabled = false;
  submitBtn.textContent = 'Xác nhận đặt hàng';
}

function showOrderSuccess(orderId, payment, transferContent) {
  document.getElementById('orderFormContent').style.display = 'none';
  document.getElementById('orderSuccess').style.display = 'block';
  document.getElementById('orderSuccessId').textContent = `Mã đơn hàng: ${orderId}`;

  if (payment === 'BANK_TRANSFER') {
    const box = document.getElementById('bankTransferBox');
    box.style.display = 'block';
    const amount = PRODUCT_PRICES[state.selectedProductType] * state.quantity;
    const qrUrl = `https://img.vietqr.io/image/${BANK_TRANSFER_INFO.bankId}-${BANK_TRANSFER_INFO.accountNumber}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(transferContent || orderId)}&accountName=${encodeURIComponent(BANK_TRANSFER_INFO.accountName)}`;
    document.getElementById('successQrImage').src = qrUrl;
    document.getElementById('successBankName').textContent = BANK_TRANSFER_INFO.bankName;
    document.getElementById('successAccountName').textContent = BANK_TRANSFER_INFO.accountName;
    document.getElementById('successAccountNumber').textContent = BANK_TRANSFER_INFO.accountNumber;
    document.getElementById('successTransferContent').textContent = transferContent || orderId;
  }

  if (payment === 'VNPAY') {
    const note = document.querySelector('.order-success-note');
    if (note) note.textContent = 'Đang chuyển hướng đến cổng thanh toán VNPay...';
  }
}

/* ============================================================
   DOWNLOAD
   ============================================================ */
function initDownload() {
  document.getElementById('downloadBtn')?.addEventListener('click', async () => {
    if (guardTrialBeforeGenerate()) return;
    const url = getActiveDesignUrl();
    if (!url) return;
    const link = document.createElement('a');
    if (url.startsWith('data:')) {
      link.href = url; link.download = `blankup-design-${Date.now()}.svg`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      return;
    }
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Download failed');
      const blob = await resp.blob();
      const ext = blob.type.includes('png') ? 'png' : 'jpg';
      const objUrl = URL.createObjectURL(blob);
      link.href = objUrl; link.download = `blankup-design-${Date.now()}.${ext}`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      URL.revokeObjectURL(objUrl);
    } catch { window.open(url, '_blank'); }
  });
}

/* ============================================================
   SHARE
   ============================================================ */
function initShareDesign() {
  document.getElementById('shareDesignBtn')?.addEventListener('click', async () => {
    if (guardTrialBeforeGenerate()) return;
    if (!state.currentDesign?.designId || state.currentDesign?.isDraft || state.currentDesign?.designId?.startsWith('community-') || state.currentDesign?.designId?.startsWith('text-only-')) {
      showToast('Cần có thiết kế AI thật để chia sẻ!', 'warning'); return;
    }
    const btn = document.getElementById('shareDesignBtn');
    btn.disabled = true; btn.textContent = 'Đang chia sẻ...';
    try {
      const resp = await fetch(`${API_BASE}/ai-design/${encodeURIComponent(state.currentDesign.designId)}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth.token ? `Bearer ${auth.token}` : '' },
        body: JSON.stringify({ designUrl: state.currentDesign.designUrl, frontDesignUrl: getFrontDesignUrl(), backDesignUrl: getBackDesignUrl(), prompt: state.currentDesign.prompt, style: state.currentDesign.style, author: auth.user?.fullName || auth.user?.username || '', userId: auth.user?.id || null, authorUsername: auth.user?.username || null }),
      });
      const result = await resp.json();
      if (!resp.ok || result.success === false) throw new Error(result.error || 'Share failed');
      state.currentDesign.isShared = true;
      updateShareButton();
      loadCommunityDesigns();
      showToast('Đã chia sẻ thiết kế!', 'success');
    } catch (e) { showToast(e.message || 'Chia sẻ thất bại', 'error'); }
    btn.disabled = false; btn.textContent = 'Chia sẻ';
  });
}

/* ============================================================
   COMMUNITY GALLERY
   ============================================================ */
function getUserId() {
  return auth.user?.id || ('guest_' + (localStorage.getItem('guest_id') || (() => { const id = Date.now().toString(36); localStorage.setItem('guest_id', id); return id; })()));
}

async function loadCommunityDesigns() {
  const grid = document.getElementById('communityGrid');
  if (!grid) return;
  let designs;
  try {
    const resp = await fetch(`${API_BASE}/ai-design/gallery`);
    if (!resp.ok) throw new Error('Failed');
    const result = await resp.json();
    designs = result.data || [];
  } catch { return; }

  const userId = getUserId();

  grid.innerHTML = designs.map(d => {
    const previewUrl = d.frontDesignUrl || d.designUrl || '';
    const liked = d.likedBy?.includes(userId);
    return `<div class="community-card" data-id="${escapeAttr(d.designId || '')}">
      <div class="community-card-img-wrap" data-url="${escapeAttr(previewUrl)}" data-prompt="${escapeAttr(d.prompt || '')}" data-style="${escapeAttr(d.style || '')}" data-author="${escapeAttr(d.author || 'Anonymous')}" data-back="${escapeAttr(d.backDesignUrl || '')}">
        <img class="community-card-img" src="${escapeAttr(previewUrl)}" alt="${escapeAttr(d.prompt || '')}" loading="lazy">
      </div>
      <div class="community-card-info">
        <div class="community-card-prompt">"${escapeHtml(d.prompt || '')}"</div>
        <div class="community-card-meta">
          <span class="community-card-author" data-author="${escapeAttr(d.author || 'Anonymous')}">👤 ${escapeHtml(d.author || 'Anonymous')}</span>
          <button class="community-card-like ${liked ? 'liked' : ''}" data-id="${escapeAttr(d.designId || '')}" data-likes="${d.likes || 0}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <span>${d.likes || 0}</span>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.community-card-img-wrap').forEach(wrap => {
    wrap.addEventListener('click', () => {
      state.currentDesign = { success: true, designId: 'community-' + Date.now(), designUrl: wrap.dataset.url, frontDesignUrl: wrap.dataset.url, backDesignUrl: wrap.dataset.back, prompt: wrap.dataset.prompt, style: wrap.dataset.style, author: wrap.dataset.author };
      showDesignOnMockup(wrap.dataset.url);
      const pi = document.getElementById('promptInput');
      if (pi && wrap.dataset.prompt) pi.value = wrap.dataset.prompt;
      const sb = document.querySelector(`.style-chip[data-style="${wrap.dataset.style}"]`);
      if (sb) { document.querySelectorAll('.style-chip').forEach(b => b.classList.remove('active')); sb.classList.add('active'); state.selectedStyle = wrap.dataset.style; }
    });
  });

  grid.querySelectorAll('.community-card-like').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const designId = btn.dataset.id;
      if (!designId) return;
      try {
        const resp = await fetch(`${API_BASE}/ai-design/${encodeURIComponent(designId)}/like`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
        const data = await resp.json();
        if (data.success) {
          btn.classList.toggle('liked', data.liked);
          const heart = btn.querySelector('svg');
          if (heart) heart.setAttribute('fill', data.liked ? 'currentColor' : 'none');
          const label = btn.querySelector('span');
          if (label) label.textContent = data.likes;
        }
      } catch { /* silently fail */ }
    });
  });
}

/* ============================================================
   INIT
   ============================================================ */
/* ============================================================
   ONBOARDING
   ============================================================ */
function initOnboarding() {
  if (localStorage.getItem('blankup_onboarding_done') === 'true') return;
  if (localStorage.getItem('blankup_guest_trial_used') === 'true') return;
  const authModal = document.getElementById('authRequiredModal');
  if (authModal && authModal.style.display === 'flex') return;

  const steps = [
    {
      title: 'Chào mừng đến với AI Studio',
      desc: 'Tạo thiết kế áo thun độc đáo với AI. Chúng tôi sẽ hướng dẫn bạn các bước cơ bản để bắt đầu.',
      target: null,
      arrow: null,
    },
    {
      title: 'Nhập mô tả thiết kế',
      desc: 'Viết mô tả chi tiết về thiết kế bạn muốn. AI sẽ biến ý tưởng của bạn thành hiện thực.',
      target: '#promptInput',
      arrow: 'bottom',
    },
    {
      title: 'Chọn phong cách',
      desc: 'Lựa chọn từ 8 phong cách: Tối giản, Streetwear, Vintage, Anime, Màu nước và nhiều hơn nữa.',
      target: '.style-grid',
      arrow: 'bottom',
    },
    {
      title: 'Tạo thiết kế',
      desc: 'Nhấn nút này để AI tạo ra thiết kế độc đáo dựa trên mô tả và phong cách bạn đã chọn.',
      target: '#generatePromptBtn',
      arrow: 'right',
    },
    {
      title: 'Xem trước 3D',
      desc: 'Thiết kế hiển thị trực tiếp trên mô hình áo 3D. Xoay, phóng to để xem mọi góc cạnh.',
      target: '#canvasWrapper',
      arrow: 'top',
    },
    {
      title: 'Tùy chỉnh & Đặt hàng',
      desc: 'Chọn loại áo, màu sắc, kích cỡ và số lượng. Khi hài lòng, bạn có thể đặt hàng hoặc tải về.',
      target: '.studio-right',
      arrow: 'left',
    },
    {
      title: 'Sẵn sàng sáng tạo!',
      desc: 'Bạn đã nắm được các thao tác cơ bản. Hãy tạo ra những thiết kế độc đáo của riêng bạn!',
      target: null,
      arrow: null,
    },
  ];

  let currentStep = 0;
  const overlay = document.getElementById('onboardingOverlay');
  const tooltip = document.getElementById('onboardingTooltip');
  const dots = document.getElementById('onboardingDots');
  const skipBtn = document.getElementById('onboardingSkip');
  const prevBtn = document.getElementById('onboardingPrev');
  const nextBtn = document.getElementById('onboardingNext');
  let highlightEl = null;

  function removeHighlight() {
    if (highlightEl) { highlightEl.remove(); highlightEl = null; }
  }

  function showStep(idx) {
    const step = steps[idx];
    currentStep = idx;

    removeHighlight();
    prevBtn.style.display = idx === 0 ? 'none' : '';
    nextBtn.textContent = idx === steps.length - 1 ? 'Bắt đầu!' : 'Tiếp theo';
    skipBtn.style.display = idx === steps.length - 1 ? 'none' : '';

    dots.querySelectorAll('.onboarding-dot').forEach((d, i) => {
      d.classList.toggle('active', i === idx);
    });

    tooltip.className = 'onboarding-tooltip';
    tooltip.innerHTML = `
      <div class="onboarding-tooltip-step">Bước ${idx + 1}/${steps.length}</div>
      <div class="onboarding-tooltip-title">${step.title}</div>
      <div class="onboarding-tooltip-desc">${step.desc}</div>
      <div class="onboarding-tooltip-arrow"></div>
    `;

    if (!step.target) {
      tooltip.style.position = 'relative';
      tooltip.style.left = 'auto';
      tooltip.style.top = 'auto';
      tooltip.style.transform = 'none';
      tooltip.style.maxWidth = '420px';
      return;
    }

    const targetEl = document.querySelector(step.target);
    if (!targetEl) {
      tooltip.style.position = 'relative';
      tooltip.style.left = 'auto';
      tooltip.style.top = 'auto';
      tooltip.style.transform = 'none';
      return;
    }

    const rect = targetEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Highlight ring
    highlightEl = document.createElement('div');
    highlightEl.className = 'onboarding-highlight';
    highlightEl.style.left = rect.left + 'px';
    highlightEl.style.top = rect.top + 'px';
    highlightEl.style.width = rect.width + 'px';
    highlightEl.style.height = rect.height + 'px';
    overlay.appendChild(highlightEl);

    const tipW = 340;
    const tipH = 160;

    tooltip.style.position = 'absolute';
    tooltip.style.maxWidth = tipW + 'px';
    tooltip.classList.add('onboarding-arrow-' + step.arrow);

    switch (step.arrow) {
      case 'bottom':
        tooltip.style.left = Math.max(16, Math.min(rect.left + rect.width / 2 - tipW / 2, vw - tipW - 16)) + 'px';
        tooltip.style.top = (rect.bottom + 12) + 'px';
        break;
      case 'top':
        tooltip.style.left = Math.max(16, Math.min(rect.left + rect.width / 2 - tipW / 2, vw - tipW - 16)) + 'px';
        tooltip.style.top = (rect.top - tipH - 12) + 'px';
        break;
      case 'left':
        tooltip.style.left = (rect.left - tipW - 12) + 'px';
        tooltip.style.top = Math.max(16, Math.min(rect.top + rect.height / 2 - tipH / 2, vh - tipH - 16)) + 'px';
        break;
      case 'right':
        tooltip.style.left = (rect.right + 12) + 'px';
        tooltip.style.top = Math.max(16, Math.min(rect.top + rect.height / 2 - tipH / 2, vh - tipH - 16)) + 'px';
        break;
    }

    // Clamp tooltip within viewport
    const tRect = tooltip.getBoundingClientRect();
    if (tRect.right > vw) tooltip.style.left = (vw - tRect.width - 16) + 'px';
    if (tRect.left < 0) tooltip.style.left = '16px';
    if (tRect.bottom > vh) tooltip.style.top = (vh - tRect.height - 16) + 'px';
    if (tRect.top < 0) tooltip.style.top = '16px';
  }

  function finish() {
    overlay.style.display = 'none';
    document.body.style.overflow = '';
    removeHighlight();
    localStorage.setItem('blankup_onboarding_done', 'true');
  }

  skipBtn.addEventListener('click', finish);
  prevBtn.addEventListener('click', () => { if (currentStep > 0) showStep(currentStep - 1); });
  nextBtn.addEventListener('click', () => {
    if (currentStep < steps.length - 1) showStep(currentStep + 1);
    else finish();
  });

  // Build dots
  dots.innerHTML = steps.map((_, i) => `<span class="onboarding-dot${i === 0 ? ' active' : ''}"></span>`).join('');

  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  setTimeout(() => showStep(0), 150);
}

document.addEventListener('DOMContentLoaded', () => {
  i18n.init();
  initTabs();
  initStyleSelector();
  initUpload();
  initProductTypeSelector();
  initColorPicker();
  initSizeSelector();
  initQuantity();
  initGenerateButtons();
  initPrintControls();
  initInteractionMode();
  initOrderFlow();
  initDownload();
  initShareDesign();
  initViewToggle();
  initThreeViewer();
  initHistory();
  initOnboarding();
  loadCommunityDesigns();
  updatePrice();

  // Handle payment return from VNPay
  const urlParams = new URLSearchParams(window.location.search);
  const paymentStatus = urlParams.get('payment');
  if (paymentStatus === 'success') {
    const orderId = urlParams.get('orderId');
    showToast(`Thanh toán thành công! Mã đơn: ${orderId}`, 'success', 8000);
  } else if (paymentStatus === 'failed') {
    showToast(`Thanh toán thất bại (mã: ${urlParams.get('code') || 'unknown'}). Vui lòng thử lại.`, 'error', 8000);
  }
  if (paymentStatus) {
    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, '', cleanUrl);
  }

  // Load design from URL params
  const params = new URLSearchParams(window.location.search);
  const designUrl = params.get('designUrl');
  if (designUrl) {
    setTimeout(() => {
      if (typeof window.loadCommunityDesign === 'function') {
        window.loadCommunityDesign(designUrl, params.get('prompt') || '', params.get('style') || 'abstract', params.get('author') || 'Community');
      } else {
        state.currentDesign = { success: true, designId: 'url-' + Date.now(), designUrl, prompt: params.get('prompt') || '', style: params.get('style') || 'abstract' };
        showDesignOnMockup(designUrl);
      }
    }, 300);
  }

  // Prefill prompt + style from URL (e.g. homepage collection cards)
  const promptParam = params.get('prompt');
  if (promptParam && !designUrl) {
    setTimeout(() => {
      const input = document.getElementById('promptInput');
      if (input) {
        input.value = promptParam;
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      const styleParam = (params.get('style') || '').toLowerCase();
      if (styleParam) {
        const chip = document.querySelector(`.style-chip[data-style="${styleParam}"]`);
        if (chip) {
          document.querySelectorAll('.style-chip').forEach(b => b.classList.remove('active'));
          chip.classList.add('active');
          state.selectedStyle = styleParam;
        }
      }
      showToast('Đã tải sẵn ý tưởng — bấm "Tạo thiết kế" để bắt đầu!', 'info', 5000);
    }, 300);
  }
});

i18n.onChange?.(() => loadCommunityDesigns());
