import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const viewer = {
  ready: false,
  pendingDesignUrl: null,
  pendingColor: '#ffffff',
  decalMeshes: [],
  shirtMeshes: [],
};

window.tshirt360Viewer = {
  setDesign(url) {
    viewer.pendingDesignUrl = url;
    if (viewer.ready) applyDesign(url);
  },
  setColor(color) {
    viewer.pendingColor = color;
    if (viewer.ready) applyColor(color);
  },
  resize() {
    if (viewer.resize) viewer.resize();
  },
  showSide(side) {
    if (viewer.ready) frameModel(side);
  },
  setRemoveWhiteBg(enabled) {
    return setRemoveWhiteBg(enabled);
  },
};

const canvas = document.getElementById('tshirt360Canvas');
const container = document.getElementById('mockupContainer') || document.getElementById('canvasViewer') || document.getElementById('canvasWrapper') || (canvas ? canvas.parentElement : null);

if (canvas && container) {
  container.classList.add('viewer-loading');
  initializeViewer();
}

function initializeViewer() {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minPolarAngle = Math.PI * 0.32;
  controls.maxPolarAngle = Math.PI * 0.68;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8692a5, 2.2));
  const keyLight = new THREE.DirectionalLight(0xffffff, 3.4);
  keyLight.position.set(3.5, 5, 4);
  keyLight.castShadow = true;
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xdbeafe, 1.4);
  fillLight.position.set(-4, 2, 2);
  scene.add(fillLight);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(5, 64),
    new THREE.ShadowMaterial({ color: 0x0f172a, opacity: 0.14 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  viewer.renderer = renderer;
  viewer.scene = scene;
  viewer.camera = camera;
  viewer.controls = controls;
  viewer.floor = floor;

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(
    'assets/models/tshirt-web.glb',
    (gltf) => onModelLoaded(gltf.scene),
    undefined,
    (error) => {
      container.classList.remove('viewer-loading');
      container.classList.add('viewer-fallback');
      const fallbackMsg = document.createElement('div');
      fallbackMsg.className = 'viewer-error-msg';
      fallbackMsg.textContent = 'Không thể tải mô hình 3D — đang hiển thị bản xem 2D.';
      fallbackMsg.setAttribute('role', 'status');
      container.appendChild(fallbackMsg);
      console.warn('Could not load 3D t-shirt model:', error);
      if (window.showToast) window.showToast('Không thể tải mô hình 3D, đã chuyển sang xem 2D.', 'warning');
    }
  );

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  };

  viewer.resize = resize;
  new ResizeObserver(resize).observe(container);
  window.addEventListener('resize', resize);
  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });
}

function onModelLoaded(model) {
  model.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    if (/FRONT/i.test(object.name)) viewer.shirtMeshes.push(object);
  });

  if (!viewer.shirtMeshes.length) {
    model.traverse((object) => {
      if (object.isMesh) viewer.shirtMeshes.push(object);
    });
  }

  viewer.model = model;
  viewer.scene.add(model);
  frameModel();
  viewer.ready = true;
  container.classList.remove('viewer-loading');
  container.classList.add('has-real-3d');
  applyColor(viewer.pendingColor);
  if (viewer.pendingDesignUrl) applyDesign(viewer.pendingDesignUrl);
}

function frameModel(side = 'front') {
  const box = new THREE.Box3().setFromObject(viewer.model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const largest = Math.max(size.x, size.y, size.z);

  viewer.bounds = { box, size, center };
  const direction = side === 'back' ? -1 : 1;
  viewer.camera.position.set(center.x, center.y + size.y * 0.06, center.z + direction * largest * 2.45);
  viewer.controls.target.set(center.x, center.y, center.z);
  viewer.controls.update();
  viewer.floor.position.set(center.x, box.min.y - size.y * 0.02, center.z);
}

function applyColor(color) {
  viewer.shirtMeshes.forEach((mesh) => {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      if (material?.color) material.color.set(color);
    });
  });
}

function applyDesign(url) {
  viewer.decalMeshes.forEach((mesh) => {
    mesh.geometry.dispose();
    mesh.material.dispose();
    viewer.scene.remove(mesh);
  });
  viewer.decalMeshes = [];
  viewer.decalUniforms = [];

  if (!url) return;
  new THREE.TextureLoader().load(url, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = true;
    texture.anisotropy = Math.min(8, viewer.renderer.capabilities.getMaxAnisotropy());
    texture.needsUpdate = true;

    const { box, size, center } = viewer.bounds;
    const position = new THREE.Vector3(center.x, center.y + size.y * 0.06, box.max.z + size.z * 0.012);
    const orientation = new THREE.Euler(0, 0, 0);
    const decalSize = new THREE.Vector3(size.x * 0.42, size.y * 0.36, Math.max(0.08, size.z * 1.8));

    viewer.shirtMeshes.forEach((target) => {
      const geometry = new DecalGeometry(target, position, orientation, decalSize);
      if (!geometry.attributes.position?.count) return;
      const uniforms = {
        map: { value: texture },
        uRemoveWhite: { value: viewer.removeWhiteBg !== false },
      };
      const material = new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D map;
          uniform float uRemoveWhite;
          varying vec2 vUv;
          void main() {
            vec4 pixel = texture2D(map, vUv);
            if (pixel.a < 0.08) discard;
            if (uRemoveWhite > 0.5) {
              float high = max(pixel.r, max(pixel.g, pixel.b));
              float low = min(pixel.r, min(pixel.g, pixel.b));
              if (high > 0.84 && high - low < 0.22) discard;
            }
            gl_FragColor = pixel;
          }
        `,
      });
      const decal = new THREE.Mesh(geometry, material);
      decal.renderOrder = 2;
      viewer.scene.add(decal);
      viewer.decalMeshes.push(decal);
      viewer.decalUniforms.push(uniforms);
    });
  }, undefined, (err) => {
    console.warn('[3D] Failed to load decal texture:', url, err);
    if (window.showToast) window.showToast('Không thể tải họa tiết lên mô hình 3D.', 'warning');
  });
}

function setRemoveWhiteBg(enabled) {
  if (!viewer) return;
  viewer.removeWhiteBg = !!enabled;
  if (viewer.decalUniforms) {
    viewer.decalUniforms.forEach((u) => { u.uRemoveWhite.value = viewer.removeWhiteBg; });
  }
  return viewer.removeWhiteBg;
}
