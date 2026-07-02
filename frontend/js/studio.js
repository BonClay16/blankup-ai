/**
 * Blankup AI Design Studio - Application Logic
 * Handles AI design generation, mockup preview, ordering, and community gallery
 */

const API_BASE = window.location.origin + '/api';

const BASIC_PRODUCT_COLORS = ['#ffffff', '#000000', '#1e293b', '#6b7280', '#dc2626', '#2563eb', '#059669'];
const UNIFORM_PRODUCT_PRICE = 10000;
const BANK_TRANSFER_INFO = {
  bankId: '970422',
  bankName: 'MB Bank',
  accountName: 'LE LY HUY',
  accountNumber: '0967145402',
  template: 'compact2',
};

const PRODUCT_TYPES = {
  tshirt: {
    label: 'T-Shirt Custom AI',
    price: UNIFORM_PRODUCT_PRICE,
    colors: BASIC_PRODUCT_COLORS,
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
  },
  hoodie: {
    label: 'Hoodie Custom AI',
    price: UNIFORM_PRODUCT_PRICE,
    colors: BASIC_PRODUCT_COLORS,
    sizes: ['M', 'L', 'XL', '2XL'],
  },
  polo: {
    label: 'Polo Custom AI',
    price: UNIFORM_PRODUCT_PRICE,
    colors: BASIC_PRODUCT_COLORS,
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
  },
};

// State
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
};

function getFrontDesignUrl(design = state.currentDesign) {
  return design?.frontDesignUrl || design?.designUrl || '';
}

function getBackDesignUrl(design = state.currentDesign) {
  return design?.backDesignUrl || '';
}

function getActiveDesignUrl(design = state.currentDesign) {
  const front = getFrontDesignUrl(design);
  const back = getBackDesignUrl(design);
  return state.currentView === 'back' ? (back || front) : front;
}

function getPreparedDesignUrl(side = state.currentView) {
  const front = state.preparedDesignUrls.front || getFrontDesignUrl();
  const back = state.preparedDesignUrls.back || getBackDesignUrl();
  return side === 'back' ? (back || front) : front;
}

function getCompositeCacheKey(designs) {
  return JSON.stringify({
    designs,
    customText: state.customText,
    customTextSides: state.customTextSides,
    printPlacement: state.printPlacement,
    textPlacement: state.textPlacement,
  });
}

function getSideCustomText(side = state.currentView) {
  const key = side === 'back' ? 'back' : 'front';
  return state.customTextSides?.[key] || state.currentDesign?.customTextSides?.[key] || state.customText || '';
}

async function getCompositeDesignsForViewer(designs) {
  const cacheKey = getCompositeCacheKey(designs);
  if (state.compositeCacheKey === cacheKey) return state.compositeDesignUrls;

  const [front, back] = await Promise.all([
    buildCompositePrintUrl(designs.front, 'front'),
    designs.back ? buildCompositePrintUrl(designs.back, 'back') : Promise.resolve(null),
  ]);
  state.compositeCacheKey = cacheKey;
  state.compositeDesignUrls = { front, back };
  return state.compositeDesignUrls;
}

function loadImageForCanvas(url) {
  return new Promise((resolve, reject) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function buildCompositePrintUrl(designUrl, side = state.currentView) {
  const sideText = getSideCustomText(side);
  if (!designUrl && !sideText) return '';
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const imagePlacement = state.printPlacement || { x: 0, y: -12, scale: 1 };
  const textPlacement = state.textPlacement || { x: 0, y: 18, scale: 1 };

  if (designUrl) {
    try {
      const img = await loadImageForCanvas(designUrl);
      if (img) {
        const maxW = size * 0.58 * imagePlacement.scale;
        const maxH = size * 0.58 * imagePlacement.scale;
        const ratio = Math.min(maxW / img.width, maxH / img.height);
        const w = img.width * ratio;
        const h = img.height * ratio;
        const x = size * (0.5 + imagePlacement.x / 100) - w / 2;
        const y = size * (0.44 + imagePlacement.y / 100) - h / 2;
        ctx.drawImage(img, x, y, w, h);
      }
    } catch (err) {
      console.warn('Could not composite print image:', err);
    }
  }

  if (sideText) {
    const text = sideText.toUpperCase();
    const fontSize = Math.max(34, 82 * textPlacement.scale);
    const x = size * (0.5 + textPlacement.x / 100);
    const y = size * (0.5 + textPlacement.y / 100);
    ctx.font = `900 ${fontSize}px Outfit, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(6, fontSize * 0.12);
    ctx.strokeStyle = 'rgba(255,255,255,0.94)';
    ctx.fillStyle = '#111827';
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  }

  return canvas.toDataURL('image/png');
}

async function applyCurrentDesignToViewer() {
  const designs = {
    front: state.preparedDesignUrls.front || getFrontDesignUrl(),
    back: state.preparedDesignUrls.back || getBackDesignUrl(),
  };
  state.printDesignUrl = getPreparedDesignUrl();
  updateOverlayPlacement();
  const shouldBakeToViewer = state.interactionMode === 'rotate';

  if (!shouldBakeToViewer) {
    if (window.tshirt360Viewer?.setDesigns) {
      window.tshirt360Viewer.setDesigns({ front: null, back: null });
    } else if (window.tshirt360Viewer?.setDesign) {
      window.tshirt360Viewer.setDesign(null);
    }
    updateThreeTexture();
    return;
  }

  const viewerDesigns = await getCompositeDesignsForViewer(designs);

  if (window.tshirt360Viewer?.setDesigns) {
    window.tshirt360Viewer.setDesigns(viewerDesigns);
    window.tshirt360Viewer.setPlacement?.(state.printPlacement);
  } else if (window.tshirt360Viewer?.setDesign) {
    window.tshirt360Viewer.setDesign(viewerDesigns.front || state.printDesignUrl);
    window.tshirt360Viewer.setPlacement?.(state.printPlacement);
  }
  updateThreeTexture();
}

function setInteractionMode(mode = 'position') {
  state.interactionMode = mode === 'rotate' ? 'rotate' : 'position';
  const mockupContainer = document.getElementById('mockupContainer');
  mockupContainer?.classList.toggle('interaction-position', state.interactionMode === 'position');
  mockupContainer?.classList.toggle('interaction-rotate', state.interactionMode === 'rotate');
  document.querySelectorAll('.placement-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.interactionMode === state.interactionMode);
  });
  window.tshirt360Viewer?.setInteractionMode?.(state.interactionMode);
  if (state.currentDesign || state.printDesignUrl || getSideCustomText()) {
    applyCurrentDesignToViewer();
  }
}

function setActivePlacementLayer(layer = 'image') {
  state.activePlacementLayer = layer === 'text' ? 'text' : 'image';
  updateOverlayPlacement();
}

function updateDesignOverlayForSide() {
  const designOverlay = document.getElementById('mockupDesign');
  if (!designOverlay) return;

  const activeUrl = getPreparedDesignUrl();
  const activeText = getSideCustomText();
  if (!activeUrl && !activeText) return;

  state.printDesignUrl = activeUrl;
  designOverlay.innerHTML = [
    activeUrl ? `<img src="${escapeAttr(activeUrl)}" alt="AI Generated Design" class="mockup-print-design processed-print" draggable="false" style="animation: fadeIn 0.5s ease;">` : '',
    activeText ? `<div class="mockup-print-text">${escapeHtml(activeText)}</div>` : '',
    activeUrl ? '<button type="button" class="placement-resize-handle placement-resize-image" data-placement-target="image" aria-label="Resize design"></button>' : '',
    activeText ? '<button type="button" class="placement-resize-handle placement-resize-text" data-placement-target="text" aria-label="Resize text"></button>' : '',
  ].join('');
  updateOverlayPlacement();
  updateThreeTexture();
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
  initOrderFlow();
  initShareDesign();
  initViewToggle();
  initThreeViewer();
  loadCommunityDesigns();

  // Load design from query parameters (e.g. from 3D Showroom)
  const urlParams = new URLSearchParams(window.location.search);
  const designUrlParam = urlParams.get('designUrl');
  if (designUrlParam) {
    const titleParam = urlParams.get('prompt') || urlParams.get('title') || '3D Showroom Artwork';
    const styleParam = urlParams.get('style') || 'abstract';
    const authorParam = urlParams.get('author') || 'Community';
    const productMockupUrlParam = urlParams.get('productMockupUrl') || '';
    const productMockupBlankParam = urlParams.get('productMockupBlank') === 'true';
    const backDesignUrlParam = urlParams.get('backDesignUrl') || '';
    setTimeout(() => {
      if (typeof window.loadCommunityDesign === 'function') {
        window.loadCommunityDesign(designUrlParam, titleParam, styleParam, authorParam, productMockupUrlParam, productMockupBlankParam, backDesignUrlParam);
      }
    }, 300);
  }
});

/* ============================================================
   TAB SWITCHING
   ============================================================ */
function initTabs() {
  const tabs = document.querySelectorAll('.studio-tab');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;

      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      contents.forEach(c => {
        c.classList.remove('active');
        if (c.id === `tabContent${capitalize(targetTab)}`) {
          c.classList.add('active');
        }
      });
    });
  });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ============================================================
   STYLE SELECTOR
   ============================================================ */
function initStyleSelector() {
  const styleGrid = document.getElementById('styleGrid');
  if (!styleGrid) return;

  styleGrid.querySelectorAll('.style-option').forEach(btn => {
    btn.addEventListener('click', () => {
      styleGrid.querySelectorAll('.style-option').forEach(b => b.classList.remove('active'));
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

  // Click to upload
  dropzone.addEventListener('click', () => fileInput.click());

  // Drag & drop
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFile(file);
    }
  });

  // File input change
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  });

  // Remove upload
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      state.uploadedFile = null;
      preview.classList.remove('show');
      dropzone.style.display = 'block';
      fileInput.value = '';
    });
  }

  function handleFile(file) {
    if (file.size > 5 * 1024 * 1024) {
      alert('File too large! Max 5MB.');
      return;
    }

    state.uploadedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      preview.classList.add('show');
      dropzone.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }
}

/* ============================================================
   COLOR PICKER
   ============================================================ */
function initColorPicker() {
  const options = document.getElementById('colorOptions');
  if (!options) return;

  options.querySelectorAll('.color-option').forEach(btn => {
    btn.onclick = () => {
      options.querySelectorAll('.color-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedColor = btn.dataset.color;
      updateMockupColor();
    };
  });
}

function updateMockupColor() {
  const mockup = document.getElementById('mockupTshirt');
  if (!mockup) return;

  // Generate SVG with selected color
  const color = state.selectedColor;
  const isLight = isLightColor(color);
  const strokeColor = isLight ? '#ddd' : 'rgba(255,255,255,0.2)';
  const gradientLight = lightenColor(color, 10);
  const gradientDark = darkenColor(color, 10);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 360">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${gradientLight}"/>
          <stop offset="100%" stop-color="${gradientDark}"/>
        </linearGradient>
      </defs>
      <path d="M75 50 L30 80 L10 140 L55 150 L65 100 L65 330 L235 330 L235 100 L245 150 L290 140 L270 80 L225 50 L195 65 Q175 80 150 80 Q125 80 105 65 Z" fill="url(#g)" stroke="${strokeColor}" stroke-width="1"/>
      <ellipse cx="150" cy="52" rx="30" ry="15" fill="none" stroke="${strokeColor}" stroke-width="1"/>
    </svg>
  `;

  mockup.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  updateThreeTexture();
  window.tshirt360Viewer?.setColor(color);
}

/* ============================================================
   PRODUCT TYPE SELECTOR
   ============================================================ */
function initProductTypeSelector() {
  const options = document.getElementById('productTypeOptions');
  if (!options) return;

  options.querySelectorAll('.product-type-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const productType = btn.dataset.productType;
      if (!PRODUCT_TYPES[productType] || productType === state.selectedProductType) return;

      state.selectedProductType = productType;
      options.querySelectorAll('.product-type-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      syncProductOptions();
      window.tshirt360Viewer?.setProductType(productType);
      if (state.currentDesign?.designUrl) applyCurrentDesignToViewer();
    });
  });

  syncProductOptions();
}

function syncProductOptions() {
  const product = PRODUCT_TYPES[state.selectedProductType] || PRODUCT_TYPES.tshirt;

  if (!product.colors.includes(state.selectedColor)) {
    state.selectedColor = product.colors[0];
  }

  if (!product.sizes.includes(state.selectedSize)) {
    state.selectedSize = product.sizes[0];
  }

  renderColorOptions(product.colors);
  renderSizeOptions(product.sizes);
  updateMockupColor();
}

function renderColorOptions(colors) {
  const options = document.getElementById('colorOptions');
  if (!options) return;

  const colorNames = {
    '#ffffff': 'White',
    '#000000': 'Black',
    '#1e293b': 'Navy',
    '#6b7280': 'Gray',
    '#374151': 'Charcoal',
    '#dc2626': 'Red',
    '#2563eb': 'Blue',
    '#1e3a5f': 'Deep navy',
    '#8b0000': 'Maroon',
    '#059669': 'Green',
  };

  options.innerHTML = colors.map(color => `
    <button class="color-option${color === state.selectedColor ? ' active' : ''}"
      data-color="${color}"
      style="background:${color};"
      title="${colorNames[color] || color}"></button>
  `).join('');

  initColorPicker();
}

function renderSizeOptions(sizes) {
  const options = document.getElementById('sizeOptions');
  if (!options) return;

  options.innerHTML = sizes.map(size => `
    <button class="size-option${size === state.selectedSize ? ' active' : ''}" data-size="${size}">${size}</button>
  `).join('');

  initSizeSelector();
}

/* ============================================================
   3D T-SHIRT VIEWER
   ============================================================ */
function initThreeViewer() {
  initCss3DViewer();
}

function initCss3DViewer() {
  const canvas = document.getElementById('mockup3dCanvas');
  const container = document.getElementById('mockupContainer');
  if (!container) return;

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let tiltX = 0;
  let tiltY = 0;

  function setTilt(x, y) {
    tiltX = Math.max(-18, Math.min(18, x));
    tiltY = Math.max(-38, Math.min(38, y));
    container.style.setProperty('--tilt-x', `${tiltX}deg`);
    container.style.setProperty('--tilt-y', `${tiltY}deg`);
  }

  state.cssViewer = {
    showFront: () => setTilt(-3, 4),
    showBack: () => setTilt(-3, -38),
  };

  container.addEventListener('pointerdown', (event) => {
    if (state.interactionMode === 'position') return;
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    container.setPointerCapture(event.pointerId);
  });

  container.addEventListener('pointermove', (event) => {
    if (state.interactionMode === 'position') return;
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    setTilt(tiltX - dy * 0.18, tiltY + dx * 0.18);
  });

  container.addEventListener('pointerup', () => {
    dragging = false;
  });

  container.addEventListener('pointercancel', () => {
    dragging = false;
  });

  container.addEventListener('dblclick', () => setTilt(0, 0));
  setTilt(-3, 4);

  if (canvas) canvas.style.display = 'none';
}

function initThreeViewerEnabled() {
  const canvas = document.getElementById('mockup3dCanvas');
  const container = document.getElementById('mockupContainer');
  if (!canvas || !container || !window.THREE) return;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0.15, 8);

  const group = new THREE.Group();
  scene.add(group);

  const frontGeometry = createCurvedShirtGeometry(1);
  const backGeometry = createCurvedShirtGeometry(-1);
  const frontTexture = createThreeTexture(true, true);
  const backTexture = createThreeTexture(true, false);

  const frontMaterial = new THREE.MeshStandardMaterial({
    map: frontTexture,
    transparent: true,
    alphaTest: 0.02,
    roughness: 0.72,
    metalness: 0.02,
    side: THREE.FrontSide,
  });

  const backMaterial = frontMaterial.clone();
  backMaterial.map = backTexture;
  backMaterial.side = THREE.BackSide;

  const frontMesh = new THREE.Mesh(frontGeometry, frontMaterial);
  const backMesh = new THREE.Mesh(backGeometry, backMaterial);
  frontMesh.rotation.x = -0.02;
  backMesh.rotation.x = -0.02;
  const shirtCore = createShirtCore();
  group.add(shirtCore, frontMesh, backMesh);

  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.43, 0.055, 12, 48, Math.PI),
    new THREE.MeshStandardMaterial({ color: state.selectedColor, roughness: 0.78 })
  );
  collar.position.set(0, 1.82, 0.13);
  collar.rotation.z = Math.PI;
  group.add(collar);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 0.45),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.08 })
  );
  shadow.position.set(0, -2.32, -0.45);
  shadow.scale.x = 0.9;
  group.add(shadow);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd7dee8, 2.2));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
  keyLight.position.set(2.5, 4, 5);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0xfff1dc, 1.2);
  rimLight.position.set(-3, 2, 3);
  scene.add(rimLight);

  state.viewer3d = {
    renderer,
    scene,
    camera,
    group,
    frontTexture,
    backTexture,
    frontMesh,
    backMesh,
    shirtCore,
    collar,
    targetRotationY: 0,
    targetRotationX: 0,
    isDragging: false,
    lastX: 0,
    lastY: 0,
  };

  container.classList.add('has-3d');
  bindThreeViewerControls(canvas);
  resizeThreeViewer();
  updateThreeTexture();
  animateThreeViewer();

  window.addEventListener('resize', resizeThreeViewer);
}

function bindThreeViewerControls(canvas) {
  const viewer = state.viewer3d;
  if (!viewer) return;

  canvas.addEventListener('pointerdown', (event) => {
    viewer.isDragging = true;
    viewer.lastX = event.clientX;
    viewer.lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!viewer.isDragging) return;
    const dx = event.clientX - viewer.lastX;
    const dy = event.clientY - viewer.lastY;
    viewer.lastX = event.clientX;
    viewer.lastY = event.clientY;
    viewer.targetRotationY += dx * 0.01;
    viewer.targetRotationX = Math.max(-0.35, Math.min(0.35, viewer.targetRotationX + dy * 0.006));
  });

  const finishDrag = () => {
    viewer.isDragging = false;
    syncViewerSideFromRotation();
  };

  canvas.addEventListener('pointerup', finishDrag);
  canvas.addEventListener('pointercancel', finishDrag);

  canvas.addEventListener('dblclick', () => setViewerSide('front'));
}

function resizeThreeViewer() {
  const canvas = document.getElementById('mockup3dCanvas');
  const viewer = state.viewer3d;
  if (!canvas || !viewer) return;

  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  viewer.renderer.setSize(width, height, false);
  viewer.camera.aspect = width / height;
  viewer.camera.updateProjectionMatrix();
}

function animateThreeViewer() {
  const viewer = state.viewer3d;
  if (!viewer) return;

  viewer.group.rotation.y += (viewer.targetRotationY - viewer.group.rotation.y) * 0.08;
  viewer.group.rotation.x += (viewer.targetRotationX - viewer.group.rotation.x) * 0.08;
  viewer.group.rotation.z = Math.sin(Date.now() * 0.0012) * 0.01;
  viewer.renderer.render(viewer.scene, viewer.camera);
  requestAnimationFrame(animateThreeViewer);
}

function updateThreeTexture() {
  const viewer = state.viewer3d;
  if (!viewer) return;

  viewer.frontTexture.image = createShirtTexture(true, true);
  viewer.backTexture.image = createShirtTexture(true, false);
  viewer.frontTexture.needsUpdate = true;
  viewer.backTexture.needsUpdate = true;
  viewer.shirtCore.material.color.set(state.selectedColor);
  viewer.collar.material.color.set(state.selectedColor);
}

function createThreeTexture(includeDesign, isFront = true) {
  const texture = new THREE.CanvasTexture(createShirtTexture(includeDesign, isFront));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createCurvedShirtGeometry(side) {
  const geometry = new THREE.PlaneGeometry(4.3, 5.15, 52, 64);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const curve = side * (0.16 - 0.075 * x * x + 0.018 * Math.cos(y * 2.4));
    position.setZ(i, curve);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function createShirtCore() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.65, 1.78);
  shape.lineTo(-1.08, 1.62);
  shape.lineTo(-1.78, 1.18);
  shape.lineTo(-2.06, 0.28);
  shape.lineTo(-1.34, 0.08);
  shape.lineTo(-1.18, 0.88);
  shape.lineTo(-1.18, -2.18);
  shape.lineTo(1.18, -2.18);
  shape.lineTo(1.18, 0.88);
  shape.lineTo(1.34, 0.08);
  shape.lineTo(2.06, 0.28);
  shape.lineTo(1.78, 1.18);
  shape.lineTo(1.08, 1.62);
  shape.lineTo(0.65, 1.78);
  shape.quadraticCurveTo(0, 1.38, -0.65, 1.78);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.28,
    bevelEnabled: true,
    bevelSize: 0.055,
    bevelThickness: 0.045,
    bevelSegments: 3,
  });
  geometry.translate(0, 0, -0.14);

  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: state.selectedColor,
      roughness: 0.82,
      metalness: 0,
    })
  );
}

function createShirtTexture(includeDesign = true, isFront = true) {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  const scaleX = canvas.width / 300;
  const scaleY = canvas.height / 360;
  ctx.scale(scaleX, scaleY);

  const shirtPath = new Path2D('M75 50 L30 80 L10 140 L55 150 L65 100 L65 330 L235 330 L235 100 L245 150 L290 140 L270 80 L225 50 L195 65 Q175 80 150 80 Q125 80 105 65 Z');
  const color = state.selectedColor;
  const gradient = ctx.createLinearGradient(0, 40, 0, 330);
  gradient.addColorStop(0, lightenColor(color, 12));
  gradient.addColorStop(1, darkenColor(color, 9));
  ctx.fillStyle = gradient;
  ctx.fill(shirtPath);
  ctx.strokeStyle = isLightColor(color) ? '#d9dee7' : 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1.2;
  ctx.stroke(shirtPath);

  ctx.beginPath();
  ctx.ellipse(150, 52, 30, 15, 0, 0, Math.PI * 2);
  ctx.strokeStyle = isLightColor(color) ? '#d9dee7' : 'rgba(255,255,255,0.25)';
  ctx.stroke();
  ctx.restore();

  if (includeDesign) drawThreeDesign(ctx, canvas, isFront ? 'front' : 'back');
  return canvas;
}

function drawThreeDesign(ctx, canvas, side = state.currentView) {
  const sideText = getSideCustomText(side);
  if (!state.printDesignUrl && !sideText) return;
  const placement = state.printPlacement || { x: 0, y: -12, scale: 1 };

  if (state.printDesignUrl && !drawThreeDesign.cache) drawThreeDesign.cache = {};
  if (state.printDesignUrl && drawThreeDesign.cache.src !== state.printDesignUrl) {
    const design = new Image();
    drawThreeDesign.cache = { src: state.printDesignUrl, image: design, loaded: false };
    design.onload = () => {
      drawThreeDesign.cache.loaded = true;
      updateThreeTexture();
    };
    design.src = state.printDesignUrl;
    return;
  }

  const centerX = canvas.width * (0.5 + placement.x / 100);
  const centerY = canvas.height * (0.38 + placement.y / 100);
  const textPlacement = state.textPlacement || { x: 0, y: 18, scale: 1 };

  ctx.save();
  ctx.globalAlpha = 0.96;
  const cached = drawThreeDesign.cache;
  if (state.printDesignUrl && cached?.loaded) {
    const img = cached.image;
    const maxW = 300 * placement.scale;
    const maxH = 270 * placement.scale;
    const ratio = Math.min(maxW / img.width, maxH / img.height);
    const w = img.width * ratio;
    const h = img.height * ratio;
    ctx.drawImage(img, centerX - w / 2, centerY - h / 2, w, h);
  }
  if (sideText) {
    const fontSize = Math.max(26, 50 * textPlacement.scale);
    const textX = canvas.width * (0.5 + textPlacement.x / 100);
    const textY = canvas.height * (0.46 + textPlacement.y / 100);
    ctx.font = `900 ${fontSize}px Outfit, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(4, fontSize * 0.12);
    ctx.strokeStyle = isLightColor(state.selectedColor) ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.55)';
    ctx.fillStyle = isLightColor(state.selectedColor) ? '#111827' : '#ffffff';
    ctx.strokeText(sideText.toUpperCase(), textX, textY);
    ctx.fillText(sideText.toUpperCase(), textX, textY);
  }
  ctx.restore();
}

/* ============================================================
   SIZE SELECTOR
   ============================================================ */
function initSizeSelector() {
  const options = document.getElementById('sizeOptions');
  if (!options) return;

  options.querySelectorAll('.size-option').forEach(btn => {
    btn.onclick = () => {
      options.querySelectorAll('.size-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedSize = btn.dataset.size;
    };
  });
}

/* ============================================================
   QUANTITY CONTROL
   ============================================================ */
function initQuantity() {
  const minusBtn = document.getElementById('qtyMinus');
  const plusBtn = document.getElementById('qtyPlus');
  const qtyInput = document.getElementById('qtyValue');

  if (!minusBtn || !plusBtn || !qtyInput) return;

  minusBtn.addEventListener('click', () => {
    if (state.quantity > 1) {
      state.quantity--;
      qtyInput.value = state.quantity;
    }
  });

  plusBtn.addEventListener('click', () => {
    if (state.quantity < 100) {
      state.quantity++;
      qtyInput.value = state.quantity;
    }
  });
}

/* ============================================================
   PRINT TEXT + PLACEMENT
   ============================================================ */
function initPrintControls() {
  const textInputs = [
    document.getElementById('customTextInput'),
    document.getElementById('customTextInputImage'),
  ].filter(Boolean);
  const xInput = document.getElementById('printPosX');
  const yInput = document.getElementById('printPosY');
  const scaleInput = document.getElementById('printScale');
  const textXInput = document.getElementById('textPosX');
  const textYInput = document.getElementById('textPosY');
  const textScaleInput = document.getElementById('textScale');
  const resetBtn = document.getElementById('placementReset');
  const quickPlacementBtns = document.querySelectorAll('.quick-placement-btn');
  const modeBtns = document.querySelectorAll('.placement-mode-btn');
  const mockupContainer = document.getElementById('mockupContainer');
  const designOverlay = document.getElementById('mockupDesign');

  textInputs.forEach(input => {
    input.addEventListener('input', () => {
      state.customText = input.value.trim();
      textInputs.forEach(other => {
        if (other !== input) other.value = input.value;
      });
      state.compositeCacheKey = '';
      updateDesignOverlayForSide();
      applyCurrentDesignToViewer();
    });
  });

  [xInput, yInput, scaleInput].forEach(input => {
    if (!input) return;
    input.addEventListener('input', () => {
      setActivePlacementLayer('image');
      state.printPlacement = {
        x: Number(xInput?.value || 0),
        y: Number(yInput?.value || -12),
        scale: Number(scaleInput?.value || 100) / 100,
      };
      state.compositeCacheKey = '';
      updateOverlayPlacement();
      applyCurrentDesignToViewer();
    });
  });

  [textXInput, textYInput, textScaleInput].forEach(input => {
    if (!input) return;
    input.addEventListener('input', () => {
      setActivePlacementLayer('text');
      state.textPlacement = {
        x: Number(textXInput?.value || 0),
        y: Number(textYInput?.value || 18),
        scale: Number(textScaleInput?.value || 100) / 100,
      };
      state.compositeCacheKey = '';
      updateOverlayPlacement();
      applyCurrentDesignToViewer();
    });
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      state.printPlacement = { x: 0, y: -12, scale: 1 };
      state.textPlacement = { x: 0, y: 18, scale: 1 };
      if (xInput) xInput.value = '0';
      if (yInput) yInput.value = '-12';
      if (scaleInput) scaleInput.value = '100';
      if (textXInput) textXInput.value = '0';
      if (textYInput) textYInput.value = '18';
      if (textScaleInput) textScaleInput.value = '100';
      state.compositeCacheKey = '';
      updateOverlayPlacement();
      applyCurrentDesignToViewer();
    });
  }

  quickPlacementBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.placementTarget;
      setActivePlacementLayer(target === 'text' ? 'text' : 'image');
      const direction = btn.dataset.placementAction === 'larger' ? 1 : -1;
      const step = target === 'text' ? 0.12 : 0.1;
      if (target === 'text') {
        const nextScale = Math.max(0.3, Math.min(2.6, state.textPlacement.scale + direction * step));
        state.textPlacement = { ...state.textPlacement, scale: nextScale };
        if (textScaleInput) textScaleInput.value = String(Math.round(nextScale * 100));
      } else {
        const nextScale = Math.max(0.2, Math.min(2.2, state.printPlacement.scale + direction * step));
        state.printPlacement = { ...state.printPlacement, scale: nextScale };
        if (scaleInput) scaleInput.value = String(Math.round(nextScale * 100));
      }
      state.compositeCacheKey = '';
      updateOverlayPlacement();
      applyCurrentDesignToViewer();
    });
  });

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      setInteractionMode(btn.dataset.interactionMode);
    });
  });

  if (designOverlay && mockupContainer) {
    let dragging = false;
    let resizing = false;
    let startX = 0;
    let startY = 0;
    let startPlacement = { ...state.printPlacement };
    let dragLayer = 'image';
    let startDistance = 1;

    designOverlay.addEventListener('pointerdown', (event) => {
      if (state.interactionMode !== 'position') return;
      const target = event.target;
      const resizeHandle = target.closest?.('.placement-resize-handle');
      const draggableLayer = target.closest?.('.mockup-print-design, .mockup-print-text');
      if (!resizeHandle && !draggableLayer) return;

      dragLayer = resizeHandle?.dataset.placementTarget || (target.closest('.mockup-print-text') ? 'text' : 'image');
      setActivePlacementLayer(dragLayer);
      dragging = true;
      resizing = Boolean(resizeHandle);
      mockupContainer.classList.add('is-positioning-print');
      mockupContainer.classList.toggle('is-resizing-print', resizing);
      startX = event.clientX;
      startY = event.clientY;
      startPlacement = dragLayer === 'text' ? { ...state.textPlacement } : { ...state.printPlacement };
      const rect = mockupContainer.getBoundingClientRect();
      const center = getPlacementPixelCenter(rect, dragLayer, startPlacement);
      startDistance = Math.max(24, Math.hypot(event.clientX - center.x, event.clientY - center.y));
      designOverlay.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    });

    designOverlay.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      const rect = mockupContainer.getBoundingClientRect();
      if (resizing) {
        const center = getPlacementPixelCenter(rect, dragLayer, startPlacement);
        const distance = Math.max(24, Math.hypot(event.clientX - center.x, event.clientY - center.y));
        const ratio = distance / startDistance;
        const minScale = dragLayer === 'text' ? 0.3 : 0.2;
        const maxScale = dragLayer === 'text' ? 2.6 : 2.2;
        const nextScale = Math.max(minScale, Math.min(maxScale, startPlacement.scale * ratio));
        if (dragLayer === 'text') {
          state.textPlacement = { ...state.textPlacement, scale: nextScale };
          if (textScaleInput) textScaleInput.value = String(Math.round(nextScale * 100));
        } else {
          state.printPlacement = { ...state.printPlacement, scale: nextScale };
          if (scaleInput) scaleInput.value = String(Math.round(nextScale * 100));
        }
      } else {
        const dx = ((event.clientX - startX) / rect.width) * 100;
        const dy = ((event.clientY - startY) / rect.height) * 100;
        const nextX = Math.max(-80, Math.min(80, startPlacement.x + dx));
        const nextY = Math.max(-75, Math.min(45, startPlacement.y + dy));
        if (dragLayer === 'text') {
          state.textPlacement = { ...state.textPlacement, x: nextX, y: nextY };
          if (textXInput) textXInput.value = String(Math.round(nextX));
          if (textYInput) textYInput.value = String(Math.round(nextY));
        } else {
          state.printPlacement = { ...state.printPlacement, x: nextX, y: nextY };
          if (xInput) xInput.value = String(Math.round(nextX));
          if (yInput) yInput.value = String(Math.round(nextY));
        }
      }
      state.compositeCacheKey = '';
      updateOverlayPlacement();
      applyCurrentDesignToViewer();
      event.preventDefault();
      event.stopPropagation();
    });

    const stopDrag = (event) => {
      dragging = false;
      resizing = false;
      mockupContainer.classList.remove('is-positioning-print');
      mockupContainer.classList.remove('is-resizing-print');
      event?.stopPropagation?.();
    };
    designOverlay.addEventListener('pointerup', stopDrag);
    designOverlay.addEventListener('pointercancel', stopDrag);
  }

  document.addEventListener('keydown', (event) => {
    const activeTag = document.activeElement?.tagName?.toLowerCase();
    if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;
    if (state.interactionMode !== 'position') return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const step = event.shiftKey ? 5 : 1;
    const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
    const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
    nudgePlacement(state.activePlacementLayer, dx, dy);
    event.preventDefault();
  });

  setInteractionMode(state.interactionMode);
  updateOverlayPlacement();
}

function getPlacementPixelCenter(rect, layer, placement) {
  const baseY = layer === 'text' ? 0.46 : 0.4;
  return {
    x: rect.left + rect.width * (0.5 + placement.x / 100),
    y: rect.top + rect.height * (baseY + placement.y / 100),
  };
}

function nudgePlacement(layer, dx, dy) {
  const xInput = document.getElementById(layer === 'text' ? 'textPosX' : 'printPosX');
  const yInput = document.getElementById(layer === 'text' ? 'textPosY' : 'printPosY');
  if (layer === 'text') {
    const nextX = Math.max(-80, Math.min(80, state.textPlacement.x + dx));
    const nextY = Math.max(-75, Math.min(45, state.textPlacement.y + dy));
    state.textPlacement = { ...state.textPlacement, x: nextX, y: nextY };
    if (xInput) xInput.value = String(Math.round(nextX));
    if (yInput) yInput.value = String(Math.round(nextY));
  } else {
    const nextX = Math.max(-80, Math.min(80, state.printPlacement.x + dx));
    const nextY = Math.max(-75, Math.min(45, state.printPlacement.y + dy));
    state.printPlacement = { ...state.printPlacement, x: nextX, y: nextY };
    if (xInput) xInput.value = String(Math.round(nextX));
    if (yInput) yInput.value = String(Math.round(nextY));
  }
  state.compositeCacheKey = '';
  updateOverlayPlacement();
  applyCurrentDesignToViewer();
}

function updateOverlayPlacement() {
  const designOverlay = document.getElementById('mockupDesign');
  const mockupContainer = document.getElementById('mockupContainer');
  if (!designOverlay) return;
  const placement = state.printPlacement || { x: 0, y: -12, scale: 1 };
  const textPlacement = state.textPlacement || { x: 0, y: 18, scale: 1 };
  designOverlay.style.setProperty('--print-x', `${placement.x}%`);
  designOverlay.style.setProperty('--print-y', `${placement.y}%`);
  designOverlay.style.setProperty('--print-scale', String(placement.scale));
  designOverlay.style.setProperty('--text-x', `${textPlacement.x}%`);
  designOverlay.style.setProperty('--text-y', `${textPlacement.y}%`);
  designOverlay.style.setProperty('--text-scale', String(textPlacement.scale));
  designOverlay.classList.toggle('active-image', state.activePlacementLayer !== 'text');
  designOverlay.classList.toggle('active-text', state.activePlacementLayer === 'text');
  designOverlay.querySelector('.mockup-print-design')?.classList.toggle('is-selected', state.activePlacementLayer !== 'text');
  designOverlay.querySelector('.mockup-print-text')?.classList.toggle('is-selected', state.activePlacementLayer === 'text');
  mockupContainer?.classList.toggle('has-custom-text', Boolean(state.customText));
  mockupContainer?.classList.toggle('is-ai-generating', Boolean(state.isGeneratingAi));
}

/* ============================================================
   VIEW TOGGLE (Front/Back)
   ============================================================ */
function initViewToggle() {
  const toggleBtns = document.querySelectorAll('.view-toggle-btn');
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      toggleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentView = btn.dataset.view;
      setViewerSide(state.currentView);
    });
  });
}

function setViewerSide(side) {
  const viewer = state.viewer3d;
  state.currentView = side;
  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === side);
  });

  if (window.tshirt360Viewer) {
    window.tshirt360Viewer.showSide(side);
  } else if (viewer) {
    const turns = Math.round(viewer.targetRotationY / (Math.PI * 2));
    viewer.targetRotationY = turns * Math.PI * 2 + (side === 'back' ? Math.PI : 0);
    viewer.targetRotationX = 0;
  } else if (state.cssViewer) {
    if (side === 'back') state.cssViewer.showBack();
    else state.cssViewer.showFront();
  }

  if (state.currentDesign) {
    updateDesignOverlayForSide();
    applyCurrentDesignToViewer();
  }
}

function syncViewerSideFromRotation() {
  const viewer = state.viewer3d;
  if (!viewer) return;
  const normalized = ((viewer.targetRotationY % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const side = normalized > Math.PI / 2 && normalized < Math.PI * 1.5 ? 'back' : 'front';
  state.currentView = side;
  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === side);
  });
}

/* ============================================================
   AI DESIGN GENERATION
   ============================================================ */
function initGenerateButtons() {
  const promptBtn = document.getElementById('generatePromptBtn');
  const imageBtn = document.getElementById('generateImageBtn');

  if (promptBtn) {
    promptBtn.addEventListener('click', () => generateFromPrompt());
  }

  if (imageBtn) {
    imageBtn.addEventListener('click', () => generateFromImage());
  }
}

function normalizeSideSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .toLowerCase();
}

function cleanDraftSidePrompt(segment, side) {
  const text = normalizeSideSearchText(segment);
  const sidePattern = side === 'back'
    ? /\b(?:mat\s*sau|phia\s*sau|sau\s*lung|lung\s*ao|sau\s*ao|sau|back)\b/g
    : /\b(?:mat\s*truoc|phia\s*truoc|truoc\s*ao|truoc|tru c|tr c|front)\b/g;
  const cleaned = text
    .replace(sidePattern, ' ')
    .replace(/\b(?:in|o|tren|vao|cho|phan|mau\s*ao|ao\s*thun|ao|thiet\s*ke|hinh|graphic|artwork|print)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, '')
    .trim();
  return normalizeDraftLandmarkIdea(cleaned);
}

function normalizeDraftLandmarkIdea(idea) {
  const normalized = normalizeSideSearchText(idea);
  const parts = [];
  if (/\b(lang bac|l ng b c|lang chu tich ho chi minh|ho chi minh mausoleum)\b/.test(normalized)) {
    parts.push('Ho Chi Minh Mausoleum landmark');
  }
  if (/\b(dinh doc lap|dinh c l p|dinh thong nhat|independence palace)\b/.test(normalized)) {
    parts.push('Independence Palace Saigon landmark');
  }
  if (/\b(hoa sen|lotus|sen)\b/.test(normalized)) {
    parts.push('Vietnamese lotus flower');
  }
  return parts.length ? `${parts.join(' with ')} illustration` : idea;
}

function cleanSideTextPrompt(segment, side) {
  const text = normalizeSideSearchText(segment);
  const sidePattern = side === 'back'
    ? /\b(?:mat\s*sau|phia\s*sau|sau\s*lung|lung\s*ao|sau\s*ao|sau|back)\b/g
    : /\b(?:mat\s*truoc|phia\s*truoc|truoc\s*ao|truoc|tru c|tr c|front)\b/g;
  return text
    .replace(/\b(?:in|them|viet|chu|text|lettering|slogan|cau chu|dong chu|o|tren|vao|cho|phan)\b/g, ' ')
    .replace(sidePattern, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, '')
    .trim()
    .slice(0, 80);
}

function extractPromptTextSides(prompt) {
  const segments = String(prompt || '').split(/[,;.\n]+/).map(part => part.trim()).filter(Boolean);
  const textSides = { front: '', back: '' };
  segments.forEach((segment) => {
    const searchable = normalizeSideSearchText(segment);
    const wantsText = /\b(chu|text|lettering|slogan|cau chu|dong chu|viet)\b/.test(searchable);
    if (!wantsText) return;
    const hasFront = /\b(mat truoc|phia truoc|truoc ao|in truoc|o truoc|tren truoc|front|truoc|tru c|tr c)\b/.test(searchable);
    const hasBack = /\b(mat sau|phia sau|sau ao|sau lung|lung ao|in sau|o sau|tren sau|back|sau)\b/.test(searchable);
    if (hasFront) textSides.front = cleanSideTextPrompt(segment, 'front') || textSides.front;
    if (hasBack) textSides.back = cleanSideTextPrompt(segment, 'back') || textSides.back;
  });
  return textSides.front || textSides.back ? textSides : null;
}

function addDraftSideIdea(ideas, idea) {
  const clean = String(idea || '').trim();
  if (!clean) return;
  const key = normalizeSideSearchText(clean);
  if (!ideas.some((existing) => normalizeSideSearchText(existing) === key)) {
    ideas.push(clean);
  }
}

function extractDraftPrintSides(prompt) {
  const segments = String(prompt || '').split(/[,;.\n]+/).map(part => part.trim()).filter(Boolean);
  const sideIdeas = { front: [], back: [] };
  segments.forEach((segment) => {
    const searchable = normalizeSideSearchText(segment);
    if (/\b(chu|text|lettering|slogan|cau chu|dong chu|viet)\b/.test(searchable)) return;
    const hasFront = /\b(mat truoc|phia truoc|truoc ao|in truoc|o truoc|tren truoc|front)\b/.test(searchable)
      || /\btruoc\b/.test(searchable)
      || /\btru c\b/.test(searchable)
      || /\btr c\b/.test(searchable);
    const hasBack = /\b(mat sau|phia sau|sau ao|sau lung|lung ao|in sau|o sau|tren sau|back)\b/.test(searchable)
      || /\bsau\b/.test(searchable);
    if (hasFront) addDraftSideIdea(sideIdeas.front, cleanDraftSidePrompt(segment, 'front'));
    if (hasBack) addDraftSideIdea(sideIdeas.back, cleanDraftSidePrompt(segment, 'back'));
  });
  if (sideIdeas.back.length && !sideIdeas.front.length && segments.length > 1) {
    const frontSegment = segments.find((segment) => {
      const searchable = normalizeSideSearchText(segment);
      return !(/\b(mat sau|phia sau|sau ao|sau lung|lung ao|back|sau)\b/.test(searchable));
    });
    if (frontSegment) addDraftSideIdea(sideIdeas.front, cleanDraftSidePrompt(frontSegment, 'front'));
  }
  const sides = {
    front: sideIdeas.front.join(' and '),
    back: sideIdeas.back.join(' and '),
  };
  return sides.front || sides.back ? sides : null;
}

async function showInstantDraftDesign(prompt, style = state.selectedStyle) {
  const draftSides = extractDraftPrintSides(prompt);
  const promptTextSides = extractPromptTextSides(prompt);
  state.customTextSides = promptTextSides || { front: '', back: '' };
  const textOnly = Boolean(promptTextSides && !draftSides);
  const draftDesign = textOnly
    ? {
      success: true,
      designId: 'text-only-' + Date.now(),
      designUrl: '',
      frontDesignUrl: '',
      prompt,
      style,
      author: auth.user?.fullName || auth.user?.username || '',
    }
    : generateMockDesign(style, draftSides?.front || prompt);
  draftDesign.provider = 'instant-draft';
  draftDesign.isDraft = true;
  draftDesign.frontDesignUrl = draftDesign.designUrl;
  if (draftSides?.back) {
    const backDraft = generateMockDesign(style, draftSides.back);
    draftDesign.backDesignUrl = backDraft.designUrl;
    draftDesign.printSides = {
      front: draftSides.front || prompt,
      back: draftSides.back,
    };
  }
  if (promptTextSides) {
    draftDesign.customTextSides = promptTextSides;
  }
  state.currentDesign = draftDesign;
  state.isGeneratingAi = true;
  setActivePlacementLayer('image');
  await showDesignOnMockup(draftDesign.designUrl);
  updateOverlayPlacement();
  return draftDesign;
}

async function generateFromPrompt() {
  const prompt = document.getElementById('promptInput')?.value?.trim();
  if (!prompt) {
    alert(i18n.currentLang === 'vi' ? 'Vui lòng nhập mô tả thiết kế!' : 'Please enter a design description!');
    return;
  }

  const btn = document.getElementById('generatePromptBtn');
  updateShareButton(false);
  setLoading(btn, true);
  const draftDesign = await showInstantDraftDesign(prompt, state.selectedStyle);
  if (draftDesign.designId?.startsWith('text-only-')) {
    state.isGeneratingAi = false;
    updateOverlayPlacement();
    setLoading(btn, false);
    return;
  }

  const requestBody = {
    prompt,
    style: state.selectedStyle,
    customText: state.customText,
    author: auth.user?.fullName || auth.user?.username || '',
  };

  try {
    const response = await fetch(`${API_BASE}/ai-design/generate`, {
      method: 'POST',
      headers: auth.getAuthHeaders(),
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    if (!response.ok || data.success === false) {
      throw new Error(formatAiError(data));
    }

    if (data.success && data.designUrl) {
      state.currentDesign = data;
      state.customTextSides = data.customTextSides || state.customTextSides || { front: '', back: '' };
      state.isGeneratingAi = false;
      await showDesignOnMockup(data.designUrl, data.productMockupUrl, data.productMockupBlank);
      updateShareButton(true);
    }
  } catch (err) {
    state.isGeneratingAi = false;
    updateOverlayPlacement();
    if (err.message && err.message !== 'Failed to fetch') {
      alert(err.message);
      console.warn('AI generation failed:', err.message);
      setLoading(btn, false);
      return;
    }
    console.warn('API unavailable, keeping instant draft design');
  }

  state.isGeneratingAi = false;
  updateOverlayPlacement();
  setLoading(btn, false);
}

async function generateFromImage() {
  if (!state.uploadedFile) {
    alert(i18n.currentLang === 'vi' ? 'Vui lòng upload ảnh!' : 'Please upload an image!');
    return;
  }

  const idea = document.getElementById('ideaInput')?.value?.trim() || '';
  const btn = document.getElementById('generateImageBtn');
  updateShareButton(false);
  setLoading(btn, true);

  try {
    const formData = new FormData();
    formData.append('image', state.uploadedFile);
    formData.append('idea', idea);
    formData.append('style', state.selectedStyle);
    formData.append('customText', state.customText);
    formData.append('author', auth.user?.fullName || auth.user?.username || '');

    const response = await fetch(`${API_BASE}/ai-design/generate-from-image`, {
      method: 'POST',
      headers: {
        Authorization: auth.token ? `Bearer ${auth.token}` : '',
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok || data.success === false) {
      throw new Error(formatAiError(data));
    }

    if (data.success && data.designUrl) {
      state.currentDesign = data;
      showDesignOnMockup(data.designUrl, data.productMockupUrl, data.productMockupBlank);
      updateShareButton(true);
    }
  } catch (err) {
    if (err.message && err.message !== 'Failed to fetch') {
      alert(err.message);
      console.warn('AI generation from image failed:', err.message);
      setLoading(btn, false);
      return;
    }
    console.warn('API unavailable, using mock design');
    const mockDesign = generateMockDesign('abstract', 'Image remix');
    state.currentDesign = mockDesign;
    showDesignOnMockup(mockDesign.designUrl);
    updateShareButton(false);
  }

  setLoading(btn, false);
}

function formatAiError(data) {
  const base = data?.error || (i18n.currentLang === 'vi'
    ? 'AI tạo ảnh thất bại. Vui lòng kiểm tra API key hoặc billing.'
    : 'AI image generation failed. Please check the API key or billing.');
  const details = Array.isArray(data?.providerErrors) && data.providerErrors.length
    ? `\n\n${data.providerErrors.join('\n')}`
    : '';
  return `${base}${details}`;
}

function setLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.classList.add('loading');
    btn.disabled = true;
  } else {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

async function showDesignOnMockup(designUrl, productMockupUrl = null, productMockupBlank = false) {
  const emptyState = document.getElementById('previewEmpty');
  const mockupContainer = document.getElementById('mockupContainer');
  const designOverlay = document.getElementById('mockupDesign');
  const productRender = document.getElementById('productRender3d');
  const orderBtn = document.getElementById('orderBtn');
  const downloadBtn = document.getElementById('downloadBtn');

  if (emptyState) emptyState.style.display = 'none';
  if (mockupContainer) {
    mockupContainer.style.display = 'flex';
    requestAnimationFrame(() => window.tshirt360Viewer?.resize());
  }
  setInteractionMode('position');

  if (productRender && mockupContainer) {
    const hasGltfViewer = Boolean(document.getElementById('tshirt360Canvas'));
    if (productMockupUrl && !hasGltfViewer) {
      productRender.src = productMockupUrl;
      productRender.dataset.sourceUrl = productMockupUrl;
      mockupContainer.classList.add('has-product-render');
      mockupContainer.classList.toggle('design-baked-in', !productMockupBlank);
    } else {
      productRender.removeAttribute('src');
      mockupContainer.classList.remove('has-product-render');
      mockupContainer.classList.remove('design-baked-in');
    }
  }

  const rawFrontUrl = getFrontDesignUrl(state.currentDesign) || designUrl;
  const rawBackUrl = getBackDesignUrl(state.currentDesign);
  state.preparedDesignUrls = { front: rawFrontUrl, back: rawBackUrl || null };
  state.printDesignUrl = getPreparedDesignUrl();

  if (designOverlay) {
    updateDesignOverlayForSide();
    applyCurrentDesignToViewer();
    preparePrintDesigns(designOverlay);
  }

  if (orderBtn) orderBtn.disabled = false;
  if (downloadBtn) downloadBtn.disabled = false;
  updateShareButton();

  updateMockupColor();
}

function removeProductMockupBackground(imageUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const size = 1024;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      canvas.width = size;
      canvas.height = size;
      ctx.drawImage(img, 0, 0, size, size);

      const imageData = ctx.getImageData(0, 0, size, size);
      const data = imageData.data;
      const labels = new Int32Array(size * size);
      const queue = new Int32Array(size * size);
      const corner = [data[0], data[1], data[2]];
      const tolerance = 12;
      let head = 0;
      let tail = 0;

      function isBackground(pixel) {
        const index = pixel * 4;
        return Math.max(
          Math.abs(data[index] - corner[0]),
          Math.abs(data[index + 1] - corner[1]),
          Math.abs(data[index + 2] - corner[2])
        ) < tolerance;
      }

      function addBackground(pixel) {
        if (labels[pixel] || !isBackground(pixel)) return;
        labels[pixel] = -1;
        queue[tail++] = pixel;
      }

      for (let x = 0; x < size; x++) {
        addBackground(x);
        addBackground((size - 1) * size + x);
      }
      for (let y = 0; y < size; y++) {
        addBackground(y * size);
        addBackground(y * size + size - 1);
      }

      while (head < tail) {
        const pixel = queue[head++];
        const x = pixel % size;
        const y = Math.floor(pixel / size);
        if (x > 0) addBackground(pixel - 1);
        if (x < size - 1) addBackground(pixel + 1);
        if (y > 0) addBackground(pixel - size);
        if (y < size - 1) addBackground(pixel + size);
      }

      for (let pixel = 0; pixel < labels.length; pixel++) {
        if (labels[pixel] === -1) data[pixel * 4 + 3] = 0;
      }

      let component = 0;
      let largestComponent = 0;
      let largestCount = 0;
      const componentSizes = [];
      const componentBounds = [];

      for (let pixel = 0; pixel < labels.length; pixel++) {
        if (labels[pixel] || data[pixel * 4 + 3] === 0) continue;
        component++;
        head = 0;
        tail = 0;
        let count = 0;
        let minX = size;
        let minY = size;
        let maxX = 0;
        let maxY = 0;
        labels[pixel] = component;
        queue[tail++] = pixel;

        while (head < tail) {
          const current = queue[head++];
          const x = current % size;
          const y = Math.floor(current / size);
          count++;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          const neighbors = [current - 1, current + 1, current - size, current + size];
          for (const next of neighbors) {
            if (next < 0 || next >= labels.length || labels[next] || data[next * 4 + 3] === 0) continue;
            if ((next === current - 1 && x === 0) || (next === current + 1 && x === size - 1)) continue;
            labels[next] = component;
            queue[tail++] = next;
          }
        }

        componentSizes[component] = count;
        componentBounds[component] = { minX, minY, maxX, maxY };
        if (count > largestCount) {
          largestCount = count;
          largestComponent = component;
        }
      }

      if (!largestComponent) return reject(new Error('No shirt subject detected'));
      const bounds = componentBounds[largestComponent];
      for (let pixel = 0; pixel < labels.length; pixel++) {
        if (labels[pixel] !== largestComponent) data[pixel * 4 + 3] = 0;
      }

      const padding = 18;
      const cropX = Math.max(0, bounds.minX - padding);
      const cropY = Math.max(0, bounds.minY - padding);
      const cropWidth = Math.min(size - cropX, bounds.maxX - bounds.minX + padding * 2 + 1);
      const cropHeight = Math.min(size - cropY, bounds.maxY - bounds.minY + padding * 2 + 1);
      ctx.putImageData(imageData, 0, 0);
      const cropped = document.createElement('canvas');
      cropped.width = cropWidth;
      cropped.height = cropHeight;
      cropped.getContext('2d').drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      resolve(cropped.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Mockup image could not be loaded'));
    img.src = imageUrl;
  });
}

async function prepareDesignImage(url) {
  if (!url || url.startsWith('data:image/svg+xml')) return url;
  try {
    return await removeLightImageBackground(url);
  } catch (err) {
    console.warn('Could not process design background:', err);
    return url;
  }
}

async function preparePrintDesigns(designOverlay) {
  if (!designOverlay) return;

  const processVersion = ++state.designProcessVersion;
  const rawFront = getFrontDesignUrl();
  const rawBack = getBackDesignUrl();
  const [front, back] = await Promise.all([
    prepareDesignImage(rawFront),
    rawBack ? prepareDesignImage(rawBack) : Promise.resolve(null),
  ]);

  if (processVersion !== state.designProcessVersion) return;

  state.preparedDesignUrls = { front, back };
  updateDesignOverlayForSide();
  applyCurrentDesignToViewer();
}

async function renderPrintDesign(designUrl, designOverlay) {
  state.preparedDesignUrls = { front: designUrl, back: null };
  await preparePrintDesigns(designOverlay);
}

function removeLightImageBackground(imageUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const size = 900;
      canvas.width = size;
      canvas.height = size;
      ctx.drawImage(img, 0, 0, size, size);

      const imageData = ctx.getImageData(0, 0, size, size);
      const data = imageData.data;
      let minX = size;
      let minY = size;
      let maxX = 0;
      let maxY = 0;

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const i = (y * size + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const isLightBackground = max > 218 && max - min < 42;

          if (isLightBackground) {
            data[i + 3] = 0;
          } else if (data[i + 3] > 0) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }

      const labels = new Int32Array(size * size);
      const queue = new Int32Array(size * size);
      let currentLabel = 0;
      let largestLabel = 0;
      let largestCount = 0;
      const bounds = [{ minX: size, minY: size, maxX: 0, maxY: 0 }];

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const start = y * size + x;
          if (labels[start] || data[start * 4 + 3] === 0) continue;

          currentLabel++;
          let head = 0;
          let tail = 0;
          let count = 0;
          let cMinX = x;
          let cMinY = y;
          let cMaxX = x;
          let cMaxY = y;
          labels[start] = currentLabel;
          queue[tail++] = start;

          while (head < tail) {
            const index = queue[head++];
            const cx = index % size;
            const cy = Math.floor(index / size);
            count++;
            cMinX = Math.min(cMinX, cx);
            cMinY = Math.min(cMinY, cy);
            cMaxX = Math.max(cMaxX, cx);
            cMaxY = Math.max(cMaxY, cy);

            const neighbors = [index - 1, index + 1, index - size, index + size];
            for (const next of neighbors) {
              if (next < 0 || next >= labels.length || labels[next]) continue;
              if ((next === index - 1 && cx === 0) || (next === index + 1 && cx === size - 1)) continue;
              if (data[next * 4 + 3] === 0) continue;
              labels[next] = currentLabel;
              queue[tail++] = next;
            }
          }

          bounds[currentLabel] = { minX: cMinX, minY: cMinY, maxX: cMaxX, maxY: cMaxY };
          if (count > largestCount) {
            largestCount = count;
            largestLabel = currentLabel;
          }
        }
      }

      if (largestLabel) {
        const largestBounds = bounds[largestLabel];
        minX = largestBounds.minX;
        minY = largestBounds.minY;
        maxX = largestBounds.maxX;
        maxY = largestBounds.maxY;

        for (let i = 0; i < labels.length; i++) {
          if (labels[i] !== largestLabel) {
            data[i * 4 + 3] = 0;
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);

      if (maxX <= minX || maxY <= minY) {
        resolve(imageUrl);
        return;
      }

      const padding = 28;
      const cropX = Math.max(0, minX - padding);
      const cropY = Math.max(0, minY - padding);
      const cropW = Math.min(size - cropX, maxX - minX + padding * 2);
      const cropH = Math.min(size - cropY, maxY - minY + padding * 2);
      const crop = document.createElement('canvas');
      crop.width = cropW;
      crop.height = cropH;
      crop.getContext('2d').drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      resolve(crop.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = imageUrl;
  });
}

/* ============================================================
   MOCK DESIGN GENERATOR (Client-side fallback)
   ============================================================ */
function generateMockDesign(style, prompt) {
  const designs = {
    minimalist: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect fill="%23f8f9fa" width="200" height="200"/><circle cx="100" cy="80" r="35" fill="none" stroke="%230f172a" stroke-width="2"/><line x1="65" y1="130" x2="135" y2="130" stroke="%230f172a" stroke-width="2"/><line x1="75" y1="145" x2="125" y2="145" stroke="%230f172a" stroke-width="1.5" opacity="0.5"/><circle cx="100" cy="80" r="8" fill="%23ff6b00"/></svg>`,

    streetwear: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%25" stop-color="%23ff6b00"/><stop offset="100%25" stop-color="%23ff0066"/></linearGradient></defs><rect fill="%23111" width="200" height="200" rx="8"/><text x="100" y="85" font-family="Arial Black" font-size="28" fill="url(%23sg)" text-anchor="middle" font-weight="900">BLANK</text><text x="100" y="118" font-family="Arial Black" font-size="28" fill="white" text-anchor="middle" font-weight="900">UP</text><rect x="40" y="135" width="120" height="3" fill="url(%23sg)" rx="1.5"/></svg>`,

    vintage: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect fill="%23f5f0e8" width="200" height="200"/><circle cx="100" cy="100" r="70" fill="none" stroke="%238b6914" stroke-width="2"/><circle cx="100" cy="100" r="60" fill="none" stroke="%238b6914" stroke-width="1" opacity="0.5"/><text x="100" y="95" font-family="Georgia" font-size="16" fill="%238b6914" text-anchor="middle">ESTD.</text><text x="100" y="115" font-family="Georgia" font-size="22" fill="%238b6914" text-anchor="middle" font-weight="bold">2024</text><path d="M60 65 Q100 50 140 65" fill="none" stroke="%238b6914" stroke-width="1.5"/><path d="M60 135 Q100 150 140 135" fill="none" stroke="%238b6914" stroke-width="1.5"/></svg>`,

    abstract: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="ag" x1="0" y1="0" x2="1" y2="1"><stop offset="0%25" stop-color="%236366f1"/><stop offset="50%25" stop-color="%23a855f7"/><stop offset="100%25" stop-color="%23ec4899"/></linearGradient></defs><rect fill="%23f8f9fa" width="200" height="200"/><circle cx="70" cy="80" r="40" fill="%236366f1" opacity="0.6"/><circle cx="130" cy="90" r="35" fill="%23ec4899" opacity="0.5"/><circle cx="100" cy="130" r="30" fill="%23a855f7" opacity="0.5"/><circle cx="100" cy="95" r="15" fill="white" opacity="0.8"/></svg>`,

    anime: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect fill="%231a1a2e" width="200" height="200" rx="8"/><circle cx="100" cy="85" r="40" fill="%23e2e8f0"/><circle cx="88" cy="78" r="8" fill="%231a1a2e"/><circle cx="112" cy="78" r="8" fill="%231a1a2e"/><circle cx="90" cy="76" r="3" fill="white"/><circle cx="114" cy="76" r="3" fill="white"/><path d="M92 95 Q100 102 108 95" fill="none" stroke="%23ff6b9d" stroke-width="2" stroke-linecap="round"/><path d="M65 60 L80 75 L60 80 Z" fill="%23e2e8f0"/><path d="M135 60 L120 75 L140 80 Z" fill="%23e2e8f0"/><text x="100" y="155" font-family="Arial" font-size="12" fill="%23ff6b00" text-anchor="middle" font-weight="bold">KAWAII ★</text></svg>`,

    ai3d: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><radialGradient id="d3a" cx="35%25" cy="25%25" r="70%25"><stop offset="0%25" stop-color="%23ffffff"/><stop offset="45%25" stop-color="%23ff9f43"/><stop offset="100%25" stop-color="%23d35400"/></radialGradient><filter id="shadow"><feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="%23000" flood-opacity="0.25"/></filter></defs><rect fill="%23f8fafc" width="200" height="200"/><circle cx="100" cy="92" r="54" fill="url(%23d3a)" filter="url(%23shadow)"/><circle cx="82" cy="78" r="9" fill="%230f172a"/><circle cx="118" cy="78" r="9" fill="%230f172a"/><ellipse cx="100" cy="105" rx="27" ry="18" fill="%23fff7ed"/><path d="M84 112 Q100 124 116 112" fill="none" stroke="%230f172a" stroke-width="4" stroke-linecap="round"/><path d="M64 55 L83 29 L92 65 Z" fill="%23ffb56b"/><path d="M136 55 L117 29 L108 65 Z" fill="%23ffb56b"/><circle cx="76" cy="70" r="11" fill="%23ffffff" opacity="0.28"/></svg>`,

    watercolor: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect fill="%23fefefe" width="200" height="200"/><ellipse cx="80" cy="90" rx="50" ry="40" fill="%2393c5fd" opacity="0.4"/><ellipse cx="120" cy="100" rx="45" ry="35" fill="%23f9a8d4" opacity="0.4"/><ellipse cx="100" cy="120" rx="40" ry="30" fill="%2386efac" opacity="0.3"/><ellipse cx="90" cy="75" rx="25" ry="20" fill="%23fcd34d" opacity="0.3"/><circle cx="100" cy="95" r="5" fill="%23334155" opacity="0.6"/></svg>`,

    geometric: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect fill="%230f172a" width="200" height="200"/><polygon points="100,30 160,100 100,170 40,100" fill="none" stroke="%23ff6b00" stroke-width="2"/><polygon points="100,50 145,100 100,150 55,100" fill="none" stroke="%2338bdf8" stroke-width="1.5"/><polygon points="100,70 130,100 100,130 70,100" fill="%23ff6b00" opacity="0.3"/><circle cx="100" cy="100" r="10" fill="%2338bdf8"/></svg>`,

    typography: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect fill="%23ffffff" width="200" height="200"/><text x="100" y="70" font-family="Georgia" font-size="48" fill="%230f172a" text-anchor="middle" font-weight="900">B</text><text x="100" y="110" font-family="Arial" font-size="14" fill="%23ff6b00" text-anchor="middle" font-weight="bold" letter-spacing="8">BLANKUP</text><line x1="40" y1="120" x2="160" y2="120" stroke="%23ff6b00" stroke-width="2"/><text x="100" y="145" font-family="Arial" font-size="9" fill="%2364748b" text-anchor="middle" letter-spacing="4">NOT JUST A SHIRT</text></svg>`,
  };

  const svgTemplate = designs[style] || designs.abstract;
  const designUrl = `data:image/svg+xml;charset=utf-8,${svgTemplate}`;

  const authorName = auth.user?.fullName || auth.user?.username || '';

  return {
    success: true,
    designId: 'mock-' + Date.now(),
    designUrl,
    prompt,
    style,
    author: authorName,
  };
}

/* ============================================================
   ORDER FLOW
   ============================================================ */
function canShareCurrentDesign() {
  const designId = state.currentDesign?.designId;
  return Boolean(
    designId &&
    !state.currentDesign?.isShared &&
    !state.currentDesign?.isDraft &&
    !designId.startsWith('community-') &&
    !designId.startsWith('text-only-')
  );
}

function updateShareButton(forceEnabled = null) {
  const shareBtn = document.getElementById('shareDesignBtn');
  if (!shareBtn) return;

  const enabled = forceEnabled === null ? canShareCurrentDesign() : Boolean(forceEnabled && canShareCurrentDesign());
  shareBtn.disabled = !enabled;
  shareBtn.classList.toggle('is-shared', state.currentDesign?.isShared === true);
  shareBtn.textContent = state.currentDesign?.isShared === true ? 'Đã chia sẻ' : 'Chia sẻ';
}

function initShareDesign() {
  const shareBtn = document.getElementById('shareDesignBtn');
  if (!shareBtn) return;

  shareBtn.addEventListener('click', async () => {
    if (!canShareCurrentDesign()) {
      alert('Hãy tạo xong một thiết kế trước khi chia sẻ lên thư viện.');
      return;
    }

    const designId = state.currentDesign.designId;
    shareBtn.disabled = true;
    shareBtn.textContent = 'Đang chia sẻ...';

    try {
      const response = await fetch(`${API_BASE}/ai-design/${encodeURIComponent(designId)}/share`, {
        method: 'POST',
        headers: auth.getAuthHeaders(),
      });
      const result = await response.json();
      if (!response.ok || result.success === false) {
        throw new Error(result.error || 'Không thể chia sẻ thiết kế lúc này.');
      }

      state.currentDesign = {
        ...state.currentDesign,
        ...(result.data || {}),
        designId,
        isShared: true,
      };
      updateShareButton();
      loadCommunityDesigns();
      alert('Thiết kế đã được chia sẻ lên thư viện cộng đồng.');
    } catch (err) {
      alert(err.message || 'Không thể chia sẻ thiết kế lúc này.');
      updateShareButton();
    }
  });

  updateShareButton();
}

function initOrderFlow() {
  const orderBtn = document.getElementById('orderBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const modal = document.getElementById('orderModal');
  const modalClose = document.getElementById('modalClose');
  const orderForm = document.getElementById('orderForm');
  const orderCloseBtn = document.getElementById('orderCloseBtn');
  const paymentMethodOptions = document.getElementById('paymentMethodOptions');

  if (paymentMethodOptions) {
    paymentMethodOptions.querySelectorAll('.payment-method-option').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selectedPaymentMethod = btn.dataset.paymentMethod || 'COD';
        updatePaymentMethodUI();
      });
    });
  }

  // Open order modal
  if (orderBtn) {
    orderBtn.addEventListener('click', () => {
      if (!state.currentDesign) return;
      updateOrderSummary();
      updatePaymentMethodUI();
      
      // Pre-fill user's name if logged in
      if (auth.isLoggedIn()) {
        const orderNameInput = document.getElementById('orderName');
        if (orderNameInput && !orderNameInput.value) {
          orderNameInput.value = auth.user.fullName || auth.user.username;
        }
      }
      
      modal.classList.add('open');
    });
  }

  // Close modal
  if (modalClose) {
    modalClose.addEventListener('click', () => modal.classList.remove('open'));
  }
  if (orderCloseBtn) {
    orderCloseBtn.addEventListener('click', () => {
      modal.classList.remove('open');
      resetOrderModal();
    });
  }

  // Close on overlay click
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });
  }

  // Submit order
  if (orderForm) {
    orderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await submitOrder();
    });
  }

  // Download design
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      const url = getActiveDesignUrl();
      if (url) {
        downloadDesign(url);
      }
    });
  }
}

function updatePaymentMethodUI() {
  const note = document.getElementById('paymentMethodNote');
  document.querySelectorAll('.payment-method-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.paymentMethod === state.selectedPaymentMethod);
  });
  if (!note) return;
  if (state.selectedPaymentMethod === 'BANK_TRANSFER') {
    note.textContent = 'Sau khi tạo đơn, hệ thống sẽ hiển thị QR chuyển khoản và chờ xác nhận thanh toán.';
  } else {
    note.textContent = 'Thanh toán khi nhận hàng (COD).';
  }
}

function getOrderTotalAmount() {
  const product = PRODUCT_TYPES[state.selectedProductType] || PRODUCT_TYPES.tshirt;
  return product.price * state.quantity;
}

function buildVietQrUrl({ amount, transferContent }) {
  const bankId = encodeURIComponent(BANK_TRANSFER_INFO.bankId);
  const accountNumber = encodeURIComponent(BANK_TRANSFER_INFO.accountNumber);
  const template = encodeURIComponent(BANK_TRANSFER_INFO.template || 'compact2');
  const params = new URLSearchParams({
    amount: String(amount || 0),
    addInfo: transferContent || '',
    accountName: BANK_TRANSFER_INFO.accountName || '',
  });
  return `https://img.vietqr.io/image/${bankId}-${accountNumber}-${template}.png?${params.toString()}`;
}

function updateOrderSummary() {
  const isVi = i18n.currentLang === 'vi';
  const product = PRODUCT_TYPES[state.selectedProductType] || PRODUCT_TYPES.tshirt;
  const total = getOrderTotalAmount();

  const colorNames = {
    '#ffffff': isVi ? 'Trắng' : 'White',
    '#000000': isVi ? 'Đen' : 'Black',
    '#1e293b': 'Navy',
    '#6b7280': isVi ? 'Xám' : 'Gray',
    '#374151': isVi ? 'Than chì' : 'Charcoal',
    '#dc2626': isVi ? 'Đỏ' : 'Red',
    '#2563eb': isVi ? 'Xanh dương' : 'Blue',
    '#1e3a5f': isVi ? 'Xanh navy đậm' : 'Deep navy',
    '#8b0000': isVi ? 'Đỏ rượu' : 'Maroon',
    '#059669': isVi ? 'Xanh lá' : 'Green',
  };

  document.getElementById('orderProduct').textContent = product.label;
  document.getElementById('orderColor').textContent = colorNames[state.selectedColor] || state.selectedColor;
  document.getElementById('orderSize').textContent = state.selectedSize;
  document.getElementById('orderQty').textContent = state.quantity;

  if (isVi) {
    document.getElementById('orderTotal').textContent = total.toLocaleString('vi-VN') + 'đ';
  } else {
    document.getElementById('orderTotal').textContent = '$' + (total / 25000).toFixed(0);
  }
}

async function submitOrder() {
  const submitBtn = document.getElementById('orderSubmitBtn');
  const name = document.getElementById('orderName').value.trim();
  const phone = document.getElementById('orderPhone').value.trim();
  const address = document.getElementById('orderAddress').value.trim();
  const note = document.getElementById('orderNote').value.trim();

  if (!name || !phone || !address) {
    alert(i18n.currentLang === 'vi' ? 'Vui lòng điền đầy đủ thông tin!' : 'Please fill in all required fields!');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span>${i18n.t('order.submitting')}</span>`;

  const orderData = {
    designUrl: state.currentDesign?.designUrl || '',
    frontDesignUrl: getFrontDesignUrl(),
    backDesignUrl: getBackDesignUrl(),
    productType: state.selectedProductType,
    color: state.selectedColor,
    size: state.selectedSize,
    quantity: state.quantity,
    customText: state.customText,
    customTextSides: state.customTextSides,
    printPlacement: state.printPlacement,
    textPlacement: state.textPlacement,
    customer: { name, phone, address, note },
    payment: state.selectedPaymentMethod,
    userId: auth.user?.id,
    authorName: auth.user?.fullName || auth.user?.username || '',
  };

  try {
    const response = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: auth.getAuthHeaders(),
      body: JSON.stringify(orderData),
    });

    const data = await response.json();
    if (!response.ok || data.success === false) {
      throw new Error(data.error || (i18n.currentLang === 'vi' ? 'Đặt hàng thất bại. Vui lòng thử lại.' : 'Order failed. Please try again.'));
    }
    showOrderSuccess(data.orderId || 'BU-' + Date.now(), data.payment || state.selectedPaymentMethod, data.transferContent);
  } catch (err) {
    alert(err.message || (i18n.currentLang === 'vi' ? 'Đặt hàng thất bại. Vui lòng thử lại.' : 'Order failed. Please try again.'));
  }

  submitBtn.disabled = false;
  submitBtn.innerHTML = `<span data-i18n="order.submit">${i18n.t('order.submit')}</span>`;
}

function showOrderSuccess(orderId, paymentMethod = state.selectedPaymentMethod, transferContent = '') {
  const formContent = document.getElementById('orderFormContent');
  const successContent = document.getElementById('orderSuccess');
  const orderIdEl = document.getElementById('orderSuccessId');
  const titleEl = successContent?.querySelector('.order-success-title');
  const noteEl = successContent?.querySelector('.order-success-note');
  const iconEl = successContent?.querySelector('.order-success-icon');
  const bankBox = document.getElementById('bankTransferBox');
  const isBankTransfer = paymentMethod === 'BANK_TRANSFER';

  if (formContent) formContent.style.display = 'none';
  if (successContent) successContent.classList.add('show');
  if (orderIdEl) {
    orderIdEl.textContent = isBankTransfer
      ? `Mã đơn: ${orderId}. Vui lòng chuyển khoản đúng số tiền và nội dung bên dưới.`
      : `${i18n.t('order.success.desc')}${orderId}`;
  }
  if (titleEl) {
    titleEl.textContent = isBankTransfer ? 'Đang chờ thanh toán' : 'Đặt hàng thành công!';
  }
  if (noteEl) {
    noteEl.textContent = isBankTransfer
      ? 'Đơn hàng sẽ chuyển sang trạng thái thành công sau khi hệ thống xác nhận giao dịch.'
      : 'Chúng tôi sẽ liên hệ xác nhận trong vòng 24 giờ.';
  }
  if (iconEl) iconEl.textContent = isBankTransfer ? '⏳' : '🎉';
  if (bankBox) {
    bankBox.classList.toggle('show', isBankTransfer);
    const transferText = transferContent || `BLANKUP ${orderId}`;
    const qrImage = document.getElementById('successQrImage');
    const statusEl = document.getElementById('bankTransferStatus');
    document.getElementById('successBankName').textContent = BANK_TRANSFER_INFO.bankName;
    document.getElementById('successAccountName').textContent = BANK_TRANSFER_INFO.accountName;
    document.getElementById('successAccountNumber').textContent = BANK_TRANSFER_INFO.accountNumber;
    document.getElementById('successTransferContent').textContent = transferText;
    if (statusEl) {
      statusEl.textContent = isBankTransfer
        ? 'Đang chờ hệ thống xác nhận chuyển khoản...'
        : '';
      statusEl.classList.toggle('paid', false);
    }
    if (qrImage) {
      qrImage.src = buildVietQrUrl({
        amount: getOrderTotalAmount(),
        transferContent: transferText,
      });
      qrImage.alt = `QR chuyển khoản ${orderId}`;
    }
  }

  stopPaymentPolling();
  if (isBankTransfer) {
    startPaymentPolling(orderId);
  }
}

function stopPaymentPolling() {
  if (state.paymentPollingTimer) {
    clearInterval(state.paymentPollingTimer);
    state.paymentPollingTimer = null;
  }
}

async function refreshPaymentStatus(orderId) {
  const response = await fetch(`${API_BASE}/orders/${encodeURIComponent(orderId)}`);
  if (!response.ok) return;
  const result = await response.json();
  const order = result?.data;
  if (order?.paymentStatus === 'paid') {
    markBankTransferPaid(orderId);
    stopPaymentPolling();
  } else if (order?.paymentStatus === 'underpaid') {
    const statusEl = document.getElementById('bankTransferStatus');
    if (statusEl) {
      const received = Number(order.paymentReceivedAmount || 0).toLocaleString('vi-VN') + 'đ';
      statusEl.textContent = `Hệ thống đã nhận ${received}, nhưng số tiền chưa đủ. Vui lòng kiểm tra lại đơn hàng.`;
    }
  }
}

function startPaymentPolling(orderId) {
  let checks = 0;
  refreshPaymentStatus(orderId).catch(() => {});
  state.paymentPollingTimer = setInterval(() => {
    checks += 1;
    if (checks > 120) {
      stopPaymentPolling();
      const statusEl = document.getElementById('bankTransferStatus');
      if (statusEl) {
        statusEl.textContent = 'Chưa thấy giao dịch. Bạn vẫn có thể đóng cửa sổ, shop sẽ kiểm tra lại theo mã đơn.';
      }
      return;
    }
    refreshPaymentStatus(orderId).catch(() => {});
  }, 5000);
}

function markBankTransferPaid(orderId) {
  const successContent = document.getElementById('orderSuccess');
  const titleEl = successContent?.querySelector('.order-success-title');
  const noteEl = successContent?.querySelector('.order-success-note');
  const iconEl = successContent?.querySelector('.order-success-icon');
  const orderIdEl = document.getElementById('orderSuccessId');
  const statusEl = document.getElementById('bankTransferStatus');

  if (titleEl) titleEl.textContent = 'Thanh toán thành công!';
  if (noteEl) noteEl.textContent = 'Đơn hàng đã được xác nhận thanh toán. Chúng tôi sẽ xử lý và liên hệ bạn sớm.';
  if (iconEl) iconEl.textContent = '✅';
  if (orderIdEl) orderIdEl.textContent = `Mã đơn: ${orderId}`;
  if (statusEl) {
    statusEl.textContent = 'Đã nhận chuyển khoản. Cảm ơn bạn!';
    statusEl.classList.add('paid');
  }
}

function resetOrderModal() {
  const formContent = document.getElementById('orderFormContent');
  const successContent = document.getElementById('orderSuccess');
  const orderForm = document.getElementById('orderForm');

  if (formContent) formContent.style.display = 'block';
  if (successContent) successContent.classList.remove('show');
  stopPaymentPolling();
  document.getElementById('bankTransferBox')?.classList.remove('show');
  document.getElementById('successQrImage')?.removeAttribute('src');
  if (orderForm) orderForm.reset();
}

async function downloadDesign(url) {
  const link = document.createElement('a');

  if (url.startsWith('data:')) {
    link.href = url;
    link.download = `blankup-design-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Download failed');

    const blob = await response.blob();
    const ext = blob.type.includes('png') ? 'png' : 'jpg';
    const objectUrl = URL.createObjectURL(blob);

    link.href = objectUrl;
    link.download = `blankup-design-${Date.now()}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  } catch (err) {
    window.open(url, '_blank');
  }
}

/* ============================================================
   COMMUNITY GALLERY
   ============================================================ */
async function loadCommunityDesigns() {
  const grid = document.getElementById('communityGrid');
  if (!grid) return;

  let designs;
  try {
    const response = await fetch(`${API_BASE}/ai-design/gallery`);
    if (!response.ok) throw new Error('Failed');
    const result = await response.json();
    designs = result.data || [];
  } catch (err) {
    designs = getFallbackDesigns();
  }

  const isVi = i18n.currentLang === 'vi';

  grid.innerHTML = designs.map(design => {
    const prompt = isVi ? design.prompt : (design.promptEn || design.prompt);
    const previewUrl = design.frontDesignUrl || design.designUrl || generateMockDesign(design.style, prompt).designUrl;
    const backDesignUrl = design.backDesignUrl || '';
    const productMockupUrl = design.productMockupUrl || '';
    const productMockupBlank = Boolean(design.productMockupBlank);
    const author = design.author || 'Anonymous';

    return `
      <div class="community-card" style="cursor: pointer;" title="${isVi ? 'Nhấp để thử thiết kế này' : 'Click to try this design'}"
        data-design-url="${escapeAttr(previewUrl)}"
        data-back-design-url="${escapeAttr(backDesignUrl)}"
        data-product-mockup-url="${escapeAttr(productMockupUrl)}"
        data-product-mockup-blank="${productMockupBlank ? 'true' : 'false'}"
        data-prompt="${escapeAttr(prompt)}"
        data-style="${escapeAttr(design.style)}"
        data-author="${escapeAttr(author)}">
        <div class="community-card-image">
          <img src="${previewUrl}" alt="${escapeAttr(prompt)}">
        </div>
        <div class="community-card-info">
          <div class="community-card-prompt">"${escapeHtml(prompt)}"</div>
          <div class="community-card-meta">
            <span class="community-card-author">👤 ${escapeHtml(author)}</span>
            <span class="community-card-likes">❤️ ${design.likes || 0}</span>
          </div>
          <span class="community-card-style">${escapeHtml(i18n.t('style.' + design.style) || design.style)}</span>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.community-card').forEach(card => {
    card.addEventListener('click', () => {
      loadCommunityDesign(card.dataset.designUrl, card.dataset.prompt, card.dataset.style, card.dataset.author, card.dataset.productMockupUrl, card.dataset.productMockupBlank === 'true', card.dataset.backDesignUrl);
    });
  });
}

// Function to load community design into workspace
window.loadCommunityDesign = function(url, prompt, style, author, productMockupUrl = '', productMockupBlank = false, backDesignUrl = '') {
  state.currentDesign = {
    success: true,
    designId: 'community-' + Date.now(),
    designUrl: url,
    frontDesignUrl: url,
    backDesignUrl,
    prompt: prompt,
    style: style,
    author: author,
    productMockupUrl,
    productMockupBlank,
  };
  
  showDesignOnMockup(url, productMockupUrl, productMockupBlank);

  // Set prompt textarea value
  const promptInput = document.getElementById('promptInput');
  if (promptInput) promptInput.value = prompt;

  // Set style option active state
  const styleBtn = document.querySelector(`.style-option[data-style="${style}"]`);
  if (styleBtn) {
    document.querySelectorAll('.style-option').forEach(b => b.classList.remove('active'));
    styleBtn.classList.add('active');
    state.selectedStyle = style;
  }
};

i18n.onChange(() => {
  loadCommunityDesigns();
});

function getFallbackDesigns() {
  return [
    { id: 'd1', prompt: 'Rồng Việt Nam cyberpunk', promptEn: 'Vietnamese dragon cyberpunk', style: 'streetwear', author: 'Minh T.', likes: 234 },
    { id: 'd2', prompt: 'Hoa sen minimalist', promptEn: 'Minimalist lotus flower', style: 'minimalist', author: 'An N.', likes: 189 },
    { id: 'd3', prompt: 'Phong cảnh Hội An vintage', promptEn: 'Hoi An landscape vintage', style: 'vintage', author: 'Hương L.', likes: 156 },
    { id: 'd4', prompt: 'Samurai Nhật Bản anime', promptEn: 'Japanese samurai anime', style: 'anime', author: 'Khoa P.', likes: 312 },
    { id: 'd5', prompt: 'Geometric abstract neon', promptEn: 'Geometric abstract neon', style: 'geometric', author: 'Trang V.', likes: 198 },
    { id: 'd6', prompt: 'Typography nghệ thuật', promptEn: 'Artistic typography', style: 'typography', author: 'Đức M.', likes: 145 },
  ];
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}

/* ============================================================
   COLOR UTILITIES
   ============================================================ */
function isLightColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

function lightenColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
  const B = Math.min(255, (num & 0x0000FF) + amt);
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

function darkenColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, (num >> 16) - amt);
  const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
  const B = Math.max(0, (num & 0x0000FF) - amt);
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}
