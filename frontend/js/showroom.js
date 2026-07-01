import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// Showroom State
const state = {
  camera: null,
  mouse: new THREE.Vector2(),
  targetMouse: new THREE.Vector2(),
  raycaster: new THREE.Raycaster(),
  hoveredUUID: null,
  textureLoader: new THREE.TextureLoader(),
  interactiveObjects: [],
  marqueeTexture: null,
  composer: null,
  dust: null,
  mannequinPrint: null,
  mannequinBubble: null,
  mannequinGroup: null,
  mannequinCurrentDesign: null,
};

// Item Metadata for interactive clicking (Upgraded and synchronized with floating items)
const GALLERY_ITEMS = {
  mannequin: {
    category: "CYBER MANNEQUIN",
    title: "BILLIE HANGER STAND",
    desc: "Mô hình treo áo thun 3D của bạn. Hãy nhấn vào các phong cách thiết kế bên dưới hoặc click vào các vật thể bay để mặc thử áo cho mô hình.",
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&auto=format&fit=crop&q=60"
  },
  sodacan: {
    category: "DRESS STYLE",
    title: "STREETWEAR STYLE",
    desc: "Phong cách đường phố bụi bặm, nổi loạn và phá cách với các nét chữ graffiti, họa tiết tương phản cao. Thích hợp in nhiệt trực tiếp cỡ lớn trước ngực.",
    image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&auto=format&fit=crop&q=60"
  },
  neonheart: {
    category: "DRESS STYLE",
    title: "ANIME STYLE",
    desc: "Họa tiết rực rỡ lấy cảm hứng từ thế giới Manga, nhân vật hoạt hình và văn hóa Pop-art sinh động của Nhật Bản. Thể hiện sự đáng yêu và trẻ trung.",
    image: "https://images.unsplash.com/photo-1549490349-8643362247b5?w=600&auto=format&fit=crop&q=60"
  },
  futurecube: {
    category: "DRESS STYLE",
    title: "ABSTRACT STYLE",
    desc: "Các mảng màu phối hợp phi cấu trúc, hình khối đa diện mờ ảo mang tính nghệ thuật trừu tượng cao. Cho chiếc áo vẻ ngoài độc đáo và huyền bí.",
    image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=60"
  },
  retrocamera: {
    category: "DRESS STYLE",
    title: "VINTAGE STYLE",
    desc: "Họa tiết hoài cổ đậm chất retro thập niên 80-90, máy ảnh cổ điển cũ kỹ mang sắc thái vintage nhẹ nhàng, lãng mạn đầy tính nghệ thuật.",
    image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&auto=format&fit=crop&q=60"
  },
  pictureframe: {
    category: "DRESS STYLE",
    title: "MINIMALIST STYLE",
    desc: "Tôn vinh sự tinh tế tối giản với những đường nét thanh mảnh, màu sắc đơn sắc đơn giản nhưng tinh xảo. Thể hiện đẳng cấp 'less is more'.",
    image: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=60"
  },
  neonheadphones: {
    category: "DRESS STYLE",
    title: "AI 3D STYLE",
    desc: "Họa tiết 3D nổi bật tạo hiệu ứng lập thể sinh động như một tác phẩm điêu khắc nghệ thuật nổi trên bề mặt vải áo, thu hút mọi ánh nhìn.",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=60"
  },
  watercolor: {
    category: "DRESS STYLE",
    title: "WATERCOLOR STYLE",
    desc: "Những vết loang màu nước mềm mại, nghệ thuật đậm chất tranh vẽ tay truyền thống. Mang lại sự nhẹ nhàng, bay bổng cho chiếc áo thun.",
    image: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=60"
  }
};

// Setup 3D elements
const canvas = document.getElementById('showroomCanvas');
const loaderOverlay = document.getElementById('loaderOverlay');
const loaderBar = document.getElementById('loaderBar');

if (canvas) {
  init();
}

function init() {
  // 1. Scene Setup
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0d1c, 0.012);

  // 2. Renderer Setup
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  updateProgress(15);

  // 3. Camera Setup
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.2, 11);
  state.camera = camera;

  // 4. Controls Setup (Restricted to keep user inside the showroom)
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 3.5;
  controls.maxDistance = 14;
  controls.minPolarAngle = Math.PI * 0.25; 
  controls.maxPolarAngle = Math.PI * 0.51; 
  controls.minAzimuthAngle = -Math.PI * 0.25; 
  controls.maxAzimuthAngle = Math.PI * 0.25;  
  controls.target.set(0, 1, 0);

  updateProgress(30);

  // 5. Lights Setup
  const ambientLight = new THREE.AmbientLight(0x282040, 2.5); // Warm violet/indigo ambient fill
  scene.add(ambientLight);

  // Glowing point lights for neon reflections (increased intensities for modern three.js physical decay)
  const purpleLight = new THREE.PointLight(0xd946ef, 65, 22); // magenta
  purpleLight.position.set(-6, 3, 2);
  scene.add(purpleLight);

  const orangeLight = new THREE.PointLight(0xff6b00, 80, 24); // brand orange
  orangeLight.position.set(6, 4, -2);
  scene.add(orangeLight);

  const cyanLight = new THREE.PointLight(0x06b6d4, 45, 16); // cyan
  cyanLight.position.set(0, 2.5, -4);
  scene.add(cyanLight);

  // Overhead soft directional light
  const overheadLight = new THREE.DirectionalLight(0xffffff, 1.2);
  overheadLight.position.set(0, 8, 4);
  overheadLight.castShadow = true;
  scene.add(overheadLight);

  // Front fill light to illuminate front of mannequin and objects
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.9);
  fillLight.position.set(0, 2, 8);
  scene.add(fillLight);

  // 6. Post-processing: Bloom effect for professional glow (subtle, non-blinding parameters)
  const renderScene = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.45, // strength
    0.35, // radius
    0.55  // threshold
  );
  bloomPass.threshold = 0.55;
  bloomPass.strength = 0.45;
  bloomPass.radius = 0.35;

  state.composer = new EffectComposer(renderer);
  state.composer.addPass(renderScene);
  state.composer.addPass(bloomPass);

  updateProgress(45);

  // 7. Room construction
  buildRoom(scene);

  // 8. Dust particles system
  state.dust = createDustParticles(scene);

  updateProgress(65);

  // 9. Spawn detailed geometries representing showroom artifacts
  spawnMannequin(scene);
  spawnShelvesAndItems(scene);

  updateProgress(100);
  
  // Hide loader overlay
  setTimeout(() => {
    loaderOverlay.style.opacity = '0';
    setTimeout(() => loaderOverlay.style.display = 'none', 800);
  }, 500);

  // 10. Event Listeners
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('click', onClick);

  // Details card close
  const detailsCard = document.getElementById('detailsCard');
  document.getElementById('detailsCloseBtn').addEventListener('click', () => {
    detailsCard.classList.remove('active');
  });

  // 11. Render loop
  const clock = new THREE.Clock();
  
  function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    // Smooth camera drift based on mouse coordinates (parallax depth)
    state.mouse.x += (state.targetMouse.x - state.mouse.x) * 0.05;
    state.mouse.y += (state.targetMouse.y - state.mouse.y) * 0.05;
    
    // Float & rotate interactive items
    state.interactiveObjects.forEach((obj) => {
      const freq = obj.userData.floatFreq || 1;
      const amp = obj.userData.floatAmp || 0.15;
      const baseHeight = obj.userData.baseHeight || 0;
      
      obj.position.y = baseHeight + Math.sin(elapsedTime * freq + obj.userData.offset) * amp;
      obj.rotation.y += 0.005 * (obj.userData.rotSpeed || 1);
      
      // Floating rings
      obj.children.forEach(child => {
        if (child.name === 'ring') {
          child.rotation.x += 0.008;
          child.rotation.y += 0.012;
        }
      });
    });

    // Update marquee texture
    if (state.marqueeTexture) {
      state.marqueeTexture.offset.x += 0.0006;
    }

    // Animate dust particles
    if (state.dust) {
      const positions = state.dust.particles.geometry.attributes.position.array;
      for (let i = 0; i < state.dust.speeds.length; i++) {
        positions[i * 3 + 1] += state.dust.speeds[i].y;
        positions[i * 3] += Math.sin(elapsedTime + state.dust.speeds[i].phase) * 0.002;
        
        // Reset if float out of ceiling
        if (positions[i * 3 + 1] > 6.5) {
          positions[i * 3 + 1] = -0.5;
        }
      }
      state.dust.particles.geometry.attributes.position.needsUpdate = true;
    }

    // Raycast hover styling
    state.raycaster.setFromCamera(state.targetMouse, camera);
    const intersects = state.raycaster.intersectObjects(state.interactiveObjects, true);

    if (intersects.length > 0) {
      let targetMesh = intersects[0].object;
      while (targetMesh.parent && !state.interactiveObjects.includes(targetMesh)) {
        targetMesh = targetMesh.parent;
      }
      
      if (state.hoveredUUID !== targetMesh.uuid) {
        state.hoveredUUID = targetMesh.uuid;
        document.body.style.cursor = 'pointer';
      }
      
      targetMesh.traverse((child) => {
        if (child.isMesh && child.material && child.material.emissive) {
          child.material.emissiveIntensity = child.userData.origEmissive ? child.userData.origEmissive * 2.5 : 1.2;
        }
      });
    } else {
      if (state.hoveredUUID) {
        state.interactiveObjects.forEach(obj => {
          obj.traverse((child) => {
            if (child.isMesh && child.material && child.material.emissive) {
              child.material.emissiveIntensity = child.userData.origEmissive || 0.3;
            }
          });
        });
        state.hoveredUUID = null;
        document.body.style.cursor = 'default';
      }
    }

    // Shift target position based on mouse position
    if (controls.enabled) {
      camera.position.x += (state.mouse.x * 1.2 - camera.position.x + controls.target.x) * 0.02;
    }

    controls.update();
    state.composer.render();
  }

  animate();

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    state.composer.setSize(window.innerWidth, window.innerHeight);
  }
}

// Draw dynamic scrolling marquee on baseboard and neon sign on wall
function buildRoom(scene) {
  // Premium dark matte floor (no mirror reflection distraction)
  const floorGeo = new THREE.PlaneGeometry(35, 35);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x08050e, // deep dark violet/black floor
    roughness: 0.85,
    metalness: 0.1,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotateX(-Math.PI / 2);
  floor.position.y = -1;
  scene.add(floor);

  // Grid overlay for reflective floor (cyberpunk design)
  const gridHelper = new THREE.GridHelper(35, 35, 0xff6b00, 0x47198a);
  gridHelper.position.y = -0.99;
  gridHelper.material.opacity = 0.22;
  gridHelper.material.transparent = true;
  scene.add(gridHelper);

  // Ceiling
  const ceilingGeo = new THREE.PlaneGeometry(35, 35);
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: 0x120d24,
    roughness: 0.7,
  });
  const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
  ceiling.rotateX(Math.PI / 2);
  ceiling.position.y = 7;
  scene.add(ceiling);

  // Back Wall
  const backWallGeo = new THREE.PlaneGeometry(35, 8);
  const backWallMat = new THREE.MeshStandardMaterial({
    color: 0x22173f, // Lighter violet
    roughness: 0.45,  // Shiny concrete/metallic
    metalness: 0.45
  });
  const backWall = new THREE.Mesh(backWallGeo, backWallMat);
  backWall.position.set(0, 3, -12);
  scene.add(backWall);

  // Left Wall
  const leftWallGeo = new THREE.PlaneGeometry(35, 8);
  const leftWallMat = new THREE.MeshStandardMaterial({
    color: 0x19102f, // Lighter violet
    roughness: 0.5,
    metalness: 0.3
  });
  const leftWall = new THREE.Mesh(leftWallGeo, leftWallMat);
  leftWall.rotateY(Math.PI / 2);
  leftWall.position.set(-15, 3, 0);
  scene.add(leftWall);

  // Right Wall
  const rightWall = new THREE.Mesh(leftWallGeo, leftWallMat);
  rightWall.rotateY(-Math.PI / 2);
  rightWall.position.set(15, 3, 0);
  scene.add(rightWall);

  // Back Wall Glowing Neon Logo Sign
  const canvasText = document.createElement('canvas');
  canvasText.width = 1024;
  canvasText.height = 256;
  const ctx = canvasText.getContext('2d');
  ctx.fillStyle = '#0d091b';
  ctx.fillRect(0, 0, 1024, 256);
  
  // Neon glowing style (reduced 2D blur to keep text readable under 3D bloom)
  ctx.shadowColor = '#d946ef';
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 60px Outfit, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('NOT JUST A SHIRT', 512, 128);

  const neonSignTex = new THREE.CanvasTexture(canvasText);
  const neonSignMat = new THREE.MeshBasicMaterial({
    map: neonSignTex,
    transparent: true,
  });
  const neonSignPlane = new THREE.PlaneGeometry(12, 3);
  const neonSign = new THREE.Mesh(neonSignPlane, neonSignMat);
  neonSign.position.set(0, 4.3, -11.9);
  scene.add(neonSign);

  // Baseboard Scrolling Banner
  const marqueeCanvas = document.createElement('canvas');
  marqueeCanvas.width = 2048;
  marqueeCanvas.height = 128;
  const marqueeCtx = marqueeCanvas.getContext('2d');
  marqueeCtx.fillStyle = '#07040f';
  marqueeCtx.fillRect(0, 0, 2048, 128);

  marqueeCtx.font = '900 34px Outfit, sans-serif';
  marqueeCtx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  for (let i = 0; i < 6; i++) {
    marqueeCtx.fillText('BLANKUP', i * 400 + 40, 75);
    marqueeCtx.fillStyle = '#ff6b00';
    marqueeCtx.fillText('★', i * 400 + 260, 75);
    marqueeCtx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  }

  state.marqueeTexture = new THREE.CanvasTexture(marqueeCanvas);
  state.marqueeTexture.wrapS = THREE.RepeatWrapping;
  state.marqueeTexture.repeat.set(1, 1);

  const marqueeMat = new THREE.MeshStandardMaterial({
    map: state.marqueeTexture,
    roughness: 0.2,
    metalness: 0.85,
    emissive: 0xff6b00,
    emissiveIntensity: 0.85, // Bright glow
  });

  const marqueeGeo = new THREE.PlaneGeometry(35, 0.8);
  const marqueeLeft = new THREE.Mesh(marqueeGeo, marqueeMat);
  marqueeLeft.position.set(0, -0.6, -11.8);
  scene.add(marqueeLeft);
}

// Particle system to generate floating dust elements
function createDustParticles(scene) {
  const particleCount = 180;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const speeds = [];

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 25;
    positions[i * 3 + 1] = Math.random() * 7;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 20;

    speeds.push({
      x: (Math.random() - 0.5) * 0.008,
      y: Math.random() * 0.006 + 0.003,
      z: (Math.random() - 0.5) * 0.008,
      phase: Math.random() * Math.PI * 2
    });
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 16, 16);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.PointsMaterial({
    size: 0.14,
    map: texture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    color: 0xffaa44, // glow gold/orange
  });

  const particles = new THREE.Points(geometry, material);
  scene.add(particles);

  return { particles, speeds };
}

// Generate the futuristic speech-bubble cyber model mannequin (Billie)
function spawnMannequin(scene) {
  const mannequin = new THREE.Group();
  mannequin.name = "mannequin";
  mannequin.userData = {
    itemId: "mannequin",
    baseHeight: 0.6,
    floatFreq: 0.35,
    floatAmp: 0.04,
    rotSpeed: 0.15,
    offset: 0
  };

  // 1. Stylized Metallic Mannequin Stand
  const standMat = new THREE.MeshStandardMaterial({
    color: 0x88888c,
    metalness: 0.95,
    roughness: 0.15,
  });
  
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 32), standMat);
  base.position.y = -0.6;
  mannequin.add(base);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.0, 16), standMat);
  pole.position.y = 0.4;
  mannequin.add(pole);

  // 2. Futuristic Chrome Mannequin Head
  const headGeo = new THREE.SphereGeometry(0.24, 32, 32);
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xff6b00, // brand orange metallic
    metalness: 0.9,
    roughness: 0.1,
    emissive: 0xff6b00,
    emissiveIntensity: 0.15
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 1.9;
  mannequin.add(head);

  // visors
  const visorMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
  const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.09, 24, 1, true, -Math.PI/3, Math.PI * 2/3), visorMat);
  visor.rotateX(Math.PI / 2);
  visor.position.set(0, 1.91, 0.14);
  mannequin.add(visor);

  // 3. Load the Real 3D T-Shirt model from assets
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  
  loader.load('assets/models/tshirt-web.glb', (gltf) => {
    const tshirt = gltf.scene;
    
    // Scale the model
    tshirt.scale.set(2.3, 2.3, 2.3);
    tshirt.rotation.y = 0; // facing front

    // Compute bounding box to align correctly
    const box = new THREE.Box3().setFromObject(tshirt);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // Center the geometry and set y level to 0.95 so collar meets neck/head
    tshirt.position.x = -center.x;
    tshirt.position.y = 0.95 - center.y;
    tshirt.position.z = -center.z;

    tshirt.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        
        // Give the fabric a premium dark grey textured look
        child.material = new THREE.MeshStandardMaterial({
          color: 0x22222a, // Charcoal fabric
          roughness: 0.85,
          metalness: 0.12,
        });
      }
    });

    mannequin.add(tshirt);
  }, undefined, (error) => {
    console.warn("Failed to load gltf T-shirt in showroom, building fallback cylinder body.", error);
    const fallbackTorso = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.44, 1.0, 16), new THREE.MeshStandardMaterial({ color: 0x22222a }));
    fallbackTorso.position.y = 1.0;
    mannequin.add(fallbackTorso);
  });

  // 4. Hoodie Front Print Mesh for Dress-up (aligned with centered T-shirt)
  const printGeo = new THREE.PlaneGeometry(0.48, 0.48);
  const printMat = new THREE.MeshStandardMaterial({
    transparent: true,
    opacity: 0.0, // start invisible
    roughness: 0.6,
    metalness: 0.1,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const printMesh = new THREE.Mesh(printGeo, printMat);
  printMesh.position.set(0, 1.05, 0.23); // positioned right on the chest of the loaded 3D shirt
  mannequin.add(printMesh);
  state.mannequinPrint = printMesh;

  // 5. Speech Bubble
  const bubbleCanvas = document.createElement('canvas');
  bubbleCanvas.width = 256;
  bubbleCanvas.height = 64;
  const bCtx = bubbleCanvas.getContext('2d');
  bCtx.fillStyle = 'rgba(10, 5, 20, 0.85)';
  bCtx.fillRect(0, 0, 256, 64);
  bCtx.strokeStyle = '#00ffcc';
  bCtx.lineWidth = 3;
  bCtx.strokeRect(2, 2, 252, 60);
  bCtx.fillStyle = '#ffffff';
  bCtx.font = '900 13px Courier New, sans-serif';
  bCtx.textAlign = 'center';
  bCtx.textBaseline = 'middle';
  bCtx.fillText('TAP STYLE BELOW!', 128, 32);

  const bubbleTex = new THREE.CanvasTexture(bubbleCanvas);
  const bubbleMat = new THREE.MeshBasicMaterial({ map: bubbleTex, transparent: true });
  const bubble = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), bubbleMat);
  bubble.position.set(0, 2.45, 0.25);
  mannequin.add(bubble);
  state.mannequinBubble = bubble;

  mannequin.position.set(-9.5, 0.6, -4.5);
  scene.add(mannequin);
  state.interactiveObjects.push(mannequin);
  state.mannequinGroup = mannequin;
}

// Generate the floating neon shelves and populate with detailed models
function spawnShelvesAndItems(scene) {
  // Helper to generate glowing textures
  const getGlossyMaterial = (emissiveColor) => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x3a4256, // Lighter steel grey
      roughness: 0.15,
      metalness: 0.95,
      emissive: emissiveColor,
      emissiveIntensity: 0.35,
    });
    mat.userData = { origEmissive: 0.35 };
    return mat;
  };

  // Helper to construct a glowing shelf board
  const createNeonShelf = (x, y, z, width, neonColor) => {
    // Shelf slab
    const shelfGeo = new THREE.BoxGeometry(width, 0.08, 1.3);
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x221738, roughness: 0.45, metalness: 0.8 });
    const shelf = new THREE.Mesh(shelfGeo, shelfMat);
    shelf.position.set(x, y - 0.72, z);
    scene.add(shelf);

    // Front edge neon strip
    const stripGeo = new THREE.BoxGeometry(width, 0.03, 0.03);
    const stripMat = new THREE.MeshBasicMaterial({ color: neonColor });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(x, y - 0.72, z + 0.66);
    scene.add(strip);
  };

  // 1. Soda Can shelf & item (Position: x = -3.0, y = 1.6, z = -6.0)
  createNeonShelf(-3.0, 1.6, -6, 2.0, 0x06b6d4);
  const canGroup = new THREE.Group();
  canGroup.name = "sodacan";
  canGroup.userData = { itemId: "sodacan", baseHeight: 1.6, floatFreq: 0.8, floatAmp: 0.12, rotSpeed: 0.4, offset: 0 };
  
  // Can cylinder
  const canBodyGeo = new THREE.CylinderGeometry(0.44, 0.44, 1.5, 32);
  const canBody = new THREE.Mesh(canBodyGeo, getGlossyMaterial(0x06b6d4));
  canGroup.add(canBody);

  // Pop tab rings
  const ringL = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.025, 8, 64), new THREE.MeshBasicMaterial({ color: 0x06b6d4 }));
  ringL.name = "ring";
  ringL.rotateX(Math.PI / 2);
  canGroup.add(ringL);

  // Draw custom high-definition canvas label
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 512;
  labelCanvas.height = 512;
  const labelCtx = labelCanvas.getContext('2d');
  
  const grad = labelCtx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, '#06b6d4');
  grad.addColorStop(0.5, '#0891b2');
  grad.addColorStop(1, '#06b6d4');
  labelCtx.fillStyle = grad;
  labelCtx.fillRect(0, 0, 512, 512);

  labelCtx.fillStyle = '#ffffff';
  labelCtx.shadowColor = '#000000';
  labelCtx.shadowBlur = 8;
  labelCtx.font = 'bold 84px Outfit, sans-serif';
  labelCtx.textAlign = 'center';
  labelCtx.fillText('REFRESH!', 256, 200);
  labelCtx.font = '600 36px Outfit, sans-serif';
  labelCtx.fillText('BLANKUP PREMIUM COLD', 256, 320);

  const labelTex = new THREE.CanvasTexture(labelCanvas);
  const labelMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.444, 0.444, 1.1, 32), new THREE.MeshStandardMaterial({
    map: labelTex,
    roughness: 0.15,
    metalness: 0.7,
  }));
  canGroup.add(labelMesh);
  
  canGroup.position.set(-3.0, 1.6, -6);
  scene.add(canGroup);
  state.interactiveObjects.push(canGroup);


  // 2. Neon Heart shelf & item (Position: x = 0.0, y = 1.6, z = -6.0)
  createNeonShelf(0.0, 1.6, -6, 2.0, 0xef4444);
  const heartGroup = new THREE.Group();
  heartGroup.name = "neonheart";
  heartGroup.userData = { itemId: "neonheart", baseHeight: 1.6, floatFreq: 1.1, floatAmp: 0.14, rotSpeed: 0.7, offset: Math.PI / 3 };

  const heartShape = new THREE.Shape();
  heartShape.moveTo( 25, 25 );
  heartShape.bezierCurveTo( 25, 37, 20, 40, 0, 17 );
  heartShape.bezierCurveTo( -30, 40, -35, 37, -35, 25 );
  heartShape.bezierCurveTo( -35, 10, -25, 0, 0, -25 );
  heartShape.bezierCurveTo( 25, 0, 25, 10, 25, 25 );

  const extrudeSettings = { depth: 14, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 4, bevelThickness: 4 };
  const heartGeo = new THREE.ExtrudeGeometry( heartShape, extrudeSettings );
  heartGeo.center();
  heartGeo.scale(0.018, 0.018, 0.018);

  const heartMesh = new THREE.Mesh(heartGeo, getGlossyMaterial(0xef4444));
  heartMesh.rotateZ(Math.PI);
  heartGroup.add(heartMesh);

  // Outer orbit ring
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.025, 8, 64), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  ring2.name = "ring";
  ring2.rotateY(Math.PI / 4);
  heartGroup.add(ring2);

  heartGroup.position.set(0.0, 1.6, -6);
  scene.add(heartGroup);
  state.interactiveObjects.push(heartGroup);


  // 3. Chrome Octahedron shelf & item (Position: x = 3.0, y = 1.6, z = -6.0)
  createNeonShelf(3.0, 1.6, -6, 2.0, 0xa855f7);
  const cubeGroup = new THREE.Group();
  cubeGroup.name = "futurecube";
  cubeGroup.userData = { itemId: "futurecube", baseHeight: 1.6, floatFreq: 0.9, floatAmp: 0.16, rotSpeed: 0.35, offset: Math.PI * 0.7 };

  const octaGeo = new THREE.OctahedronGeometry(0.6, 0);
  const octaMesh = new THREE.Mesh(octaGeo, getGlossyMaterial(0xa855f7));
  cubeGroup.add(octaMesh);

  const ring3 = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.02, 8, 64), new THREE.MeshBasicMaterial({ color: 0xa855f7 }));
  ring3.name = "ring";
  cubeGroup.add(ring3);

  cubeGroup.position.set(3.0, 1.6, -6);
  scene.add(cubeGroup);
  state.interactiveObjects.push(cubeGroup);


  // 4. Retro Camera shelf & item (Position: x = 6.0, y = 1.6, z = -6.0)
  createNeonShelf(6.0, 1.6, -6, 2.0, 0xff8c00);
  const cameraGroup = new THREE.Group();
  cameraGroup.name = "retrocamera";
  cameraGroup.userData = { itemId: "retrocamera", baseHeight: 1.6, floatFreq: 0.75, floatAmp: 0.1, rotSpeed: 0.5, offset: Math.PI * 1.1 };

  // Frame Box
  const camBody = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.56, 0.44), getGlossyMaterial(0xff6b00));
  cameraGroup.add(camBody);

  // Cylinder lens
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.22, 24), getGlossyMaterial(0xffbe3b));
  lens.rotateX(Math.PI / 2);
  lens.position.set(0, 0, 0.26);
  cameraGroup.add(lens);

  // Camera flash light box
  const flash = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  flash.position.set(0.24, 0.2, 0.18);
  cameraGroup.add(flash);

  const ring4 = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.025, 8, 64), new THREE.MeshBasicMaterial({ color: 0xff6b00 }));
  ring4.name = "ring";
  ring4.rotateX(Math.PI / 3);
  cameraGroup.add(ring4);

  cameraGroup.position.set(6.0, 1.6, -6);
  scene.add(cameraGroup);
  state.interactiveObjects.push(cameraGroup);


  // 5. Picture Frame shelf & item (Position: x = 9.0, y = 1.6, z = -6.0)
  createNeonShelf(9.0, 1.6, -6, 2.0, 0xdddddd);
  const frameGroup = new THREE.Group();
  frameGroup.name = "pictureframe";
  frameGroup.userData = { itemId: "pictureframe", baseHeight: 1.6, floatFreq: 0.65, floatAmp: 0.08, rotSpeed: 0.25, offset: Math.PI * 0.4 };

  const borderGeo = new THREE.BoxGeometry(1.3, 1.7, 0.08);
  const silverMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.08, metalness: 0.95 });
  const border = new THREE.Mesh(borderGeo, silverMat);
  frameGroup.add(border);

  // Frame canvas print
  const artGeo = new THREE.PlaneGeometry(1.15, 1.55);
  const artCanvas = document.createElement('canvas');
  artCanvas.width = 256;
  artCanvas.height = 384;
  const aCtx = artCanvas.getContext('2d');
  aCtx.fillStyle = '#06050b';
  aCtx.fillRect(0, 0, 256, 384);
  aCtx.strokeStyle = '#ff6b00';
  aCtx.lineWidth = 8;
  aCtx.strokeRect(5, 5, 246, 374);
  
  aCtx.fillStyle = '#ffffff';
  aCtx.font = 'bold 30px Outfit, sans-serif';
  aCtx.textAlign = 'center';
  aCtx.fillText('AGENCY', 128, 120);
  aCtx.fillText('OF THE', 128, 180);
  aCtx.fillStyle = '#ff6b00';
  aCtx.fillText('YEAR', 128, 240);

  const artTex = new THREE.CanvasTexture(artCanvas);
  const artMat = new THREE.MeshBasicMaterial({ map: artTex });
  const artMesh = new THREE.Mesh(artGeo, artMat);
  artMesh.position.z = 0.05;
  frameGroup.add(artMesh);

  const ring5 = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.02, 8, 64), new THREE.MeshBasicMaterial({ color: 0xdddddd }));
  ring5.name = "ring";
  frameGroup.add(ring5);

  frameGroup.position.set(9.0, 1.6, -6);
  scene.add(frameGroup);
  state.interactiveObjects.push(frameGroup);


  // 6. Neon Headphones shelf & item (Position: x = 12.0, y = 1.6, z = -6.0)
  createNeonShelf(12.0, 1.6, -6, 2.0, 0xec4899);
  const hpGroup = new THREE.Group();
  hpGroup.name = "neonheadphones";
  hpGroup.userData = { itemId: "neonheadphones", baseHeight: 1.6, floatFreq: 1.0, floatAmp: 0.15, rotSpeed: 0.45, offset: Math.PI * 1.5 };

  // Arch headband
  const bandGeo = new THREE.TorusGeometry(0.44, 0.046, 8, 32, Math.PI);
  const hpMat = getGlossyMaterial(0xec4899);
  const band = new THREE.Mesh(bandGeo, hpMat);
  band.position.y = 0.16;
  hpGroup.add(band);

  // Left & right cups
  const cupGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.15, 24);
  const cupL = new THREE.Mesh(cupGeo, hpMat);
  cupL.position.set(-0.44, 0.08, 0);
  cupL.rotateZ(Math.PI / 2);
  hpGroup.add(cupL);

  const cupR = new THREE.Mesh(cupGeo, hpMat);
  cupR.position.set(0.44, 0.08, 0);
  cupR.rotateZ(Math.PI / 2);
  hpGroup.add(cupR);

  // Cyan neon glow rings on ear cups
  const glowL = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.016, 8, 24), new THREE.MeshBasicMaterial({ color: 0x00ffcc }));
  glowL.position.set(-0.54, 0.08, 0);
  glowL.rotateY(Math.PI / 2);
  hpGroup.add(glowL);

  const glowR = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.016, 8, 24), new THREE.MeshBasicMaterial({ color: 0x00ffcc }));
  glowR.position.set(0.54, 0.08, 0);
  glowR.rotateY(Math.PI / 2);
  hpGroup.add(glowR);

  // Floating banner "NOW PLAYING"
  const npCanvas = document.createElement('canvas');
  npCanvas.width = 256;
  npCanvas.height = 64;
  const nCtx = npCanvas.getContext('2d');
  nCtx.fillStyle = 'rgba(0,0,0,0)';
  nCtx.clearRect(0,0,256,64);
  nCtx.shadowColor = '#ec4899';
  nCtx.shadowBlur = 4;
  nCtx.fillStyle = '#ec4899';
  nCtx.font = 'bold 24px Courier New, sans-serif';
  nCtx.textAlign = 'center';
  nCtx.fillText('NOW PLAYING', 128, 38);

  const npTex = new THREE.CanvasTexture(npCanvas);
  const np = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.28), new THREE.MeshBasicMaterial({ map: npTex, transparent: true }));
  np.position.set(0, -0.38, 0.08);
  hpGroup.add(np);

  const ring6 = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.024, 8, 64), new THREE.MeshBasicMaterial({ color: 0xec4899 }));
  ring6.name = "ring";
  hpGroup.add(ring6);

  hpGroup.position.set(12.0, 1.6, -6);
  scene.add(hpGroup);
  state.interactiveObjects.push(hpGroup);

  // 7. Watercolor Paint Splashes shelf & item (Position: x = -6.0, y = 1.6, z = -6.0)
  createNeonShelf(-6.0, 1.6, -6, 2.0, 0x00ffcc);
  const wcGroup = new THREE.Group();
  wcGroup.name = "watercolor";
  wcGroup.userData = { itemId: "watercolor", baseHeight: 1.6, floatFreq: 0.95, floatAmp: 0.14, rotSpeed: 0.5, offset: Math.PI * 0.9 };
  
  // Splatter core sphere
  const wcGeo = new THREE.IcosahedronGeometry(0.48, 2);
  const wcMat = getGlossyMaterial(0x00ffcc);
  const wcMesh = new THREE.Mesh(wcGeo, wcMat);
  wcGroup.add(wcMesh);

  // Floating paint drops around core
  for (let i = 0; i < 4; i++) {
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color: 0x00ffcc }));
    const angle = (i / 4) * Math.PI * 2;
    drop.position.set(Math.cos(angle) * 0.6, Math.sin(angle) * 0.25, Math.sin(angle) * 0.6);
    wcGroup.add(drop);
  }

  const ring7 = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.024, 8, 64), new THREE.MeshBasicMaterial({ color: 0x00ffcc }));
  ring7.name = "ring";
  wcGroup.add(ring7);

  wcGroup.position.set(-6.0, 1.6, -6);
  scene.add(wcGroup);
  state.interactiveObjects.push(wcGroup);
}

// Progress loading bar display updating
function updateProgress(value) {
  if (loaderBar) {
    loaderBar.style.width = `${value}%`;
  }
}

// Track mouse positioning
function onMouseMove(event) {
  state.targetMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  state.targetMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

// Raycaster check on click to open Details Card
function onClick() {
  if (!state.camera) return;

  state.raycaster.setFromCamera(state.targetMouse, state.camera);
  const intersects = state.raycaster.intersectObjects(state.interactiveObjects, true);

  if (intersects.length > 0) {
    let target = intersects[0].object;
    while (target.parent && !state.interactiveObjects.includes(target)) {
      target = target.parent;
    }
    
    const itemId = target.userData.itemId;
    if (itemId && GALLERY_ITEMS[itemId]) {
      showItemDetails(itemId);

      // Auto-dress the mannequin if clicking on a floating style item!
      if (itemId !== 'mannequin') {
        const styleMap = {
          sodacan: 'streetwear',
          neonheart: 'anime',
          futurecube: 'abstract',
          retrocamera: 'vintage',
          pictureframe: 'minimalist',
          neonheadphones: 'ai3d',
          watercolor: 'watercolor'
        };
        const style = styleMap[itemId];
        if (style) {
          applyStyleDesignToMannequin(style);
        }
      }
    }
  }
}

// Pop details into HTML and slide details card open
function showItemDetails(itemId) {
  let item = GALLERY_ITEMS[itemId];
  
  // Override mannequin details if a style design has been loaded onto it
  if (itemId === 'mannequin' && state.mannequinCurrentDesign) {
    item = state.mannequinCurrentDesign;
  }

  const card = document.getElementById('detailsCard');
  
  document.getElementById('detailsImage').innerHTML = `<img src="${item.image}" alt="${item.title}">`;
  document.getElementById('detailsCategory').textContent = item.category;
  document.getElementById('detailsTitle').textContent = item.title;
  document.getElementById('detailsDesc').textContent = item.desc;
  
  // Set action link with query params so studio.js can load it!
  document.getElementById('detailsAction').href = `studio.html?designUrl=${encodeURIComponent(item.image)}&title=${encodeURIComponent(item.title)}`;

  card.classList.add('active');
}

// Local SVGs for mannequin design dressing (styled with white/neon colors to pop on black shirt)
const STYLE_PRESET_SVGS = {
  minimalist: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400"><circle cx="200" cy="180" r="80" fill="none" stroke="#ffffff" stroke-width="4"/><line x1="200" y1="100" x2="200" y2="260" stroke="#ffffff" stroke-width="3"/><line x1="120" y1="180" x2="280" y2="180" stroke="#ffffff" stroke-width="3"/><text x="200" y="320" text-anchor="middle" font-family="'Outfit', sans-serif" font-size="28" fill="#ffffff" font-weight="900" letter-spacing="4">MINIMALIST</text></svg>`,
  streetwear: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400"><polygon points="200,40 260,140 340,160 280,230 296,330 200,284 104,330 120,230 60,160 140,140" fill="none" stroke="#e94560" stroke-width="6"/><polygon points="200,80 240,144 300,156 256,210 268,290 200,256 132,290 144,210 100,156 160,144" fill="#e94560" opacity="0.4"/><text x="200" y="360" text-anchor="middle" font-family="Impact, sans-serif" font-size="36" fill="#e94560" letter-spacing="6">STREETWEAR</text></svg>`,
  vintage: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400"><circle cx="200" cy="180" r="100" fill="none" stroke="#ff8c00" stroke-width="4"/><circle cx="200" cy="180" r="85" fill="none" stroke="#ff8c00" stroke-width="2" stroke-dasharray="8,6"/><text x="200" y="170" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="#f8fafc" font-weight="700">VINTAGE</text><text x="200" y="200" text-anchor="middle" font-family="Georgia, serif" font-size="16" fill="#ff8c00">— EST. 2024 —</text><text x="200" y="330" text-anchor="middle" font-family="'Outfit', sans-serif" font-size="20" fill="#f8fafc" font-weight="600" letter-spacing="2">PREMIUM GOODS</text></svg>`,
  abstract: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400"><circle cx="120" cy="140" r="80" fill="#00ffcc" opacity="0.6"/><circle cx="280" cy="120" r="60" fill="#d946ef" opacity="0.5"/><circle cx="200" cy="260" r="90" fill="#ff8c00" opacity="0.4"/><text x="200" y="360" text-anchor="middle" font-family="'Outfit', sans-serif" font-size="28" fill="#ffffff" font-weight="900" letter-spacing="4">ABSTRACT</text></svg>`,
  anime: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400"><polygon points="200,30 230,110 320,110 250,160 276,240 200,190 124,240 150,160 80,110 170,110" fill="#ff6b6b"/><text x="200" y="340" text-anchor="middle" font-family="'Outfit', sans-serif" font-size="32" fill="#feca57" font-weight="900" letter-spacing="2">ANIME SPIRIT</text></svg>`,
  ai3d: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400"><circle cx="200" cy="180" r="90" fill="#ff9f43"/><circle cx="170" cy="150" r="16" fill="#0f172a"/><circle cx="230" cy="150" r="16" fill="#0f172a"/><path d="M170 210 Q200 240 230 210" fill="none" stroke="#0f172a" stroke-width="8" stroke-linecap="round"/><text x="200" y="340" text-anchor="middle" font-family="'Outfit', sans-serif" font-size="32" fill="#d35400" font-weight="900">AI 3D CHIP</text></svg>`,
  watercolor: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400"><circle cx="160" cy="160" r="100" fill="#74b9ff" opacity="0.65"/><circle cx="240" cy="220" r="90" fill="#ff7675" opacity="0.65"/><text x="200" y="350" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="#ffffff" font-weight="700">WATERCOLOR</text></svg>`,
};

async function applyStyleDesignToMannequin(style) {
  if (!state.mannequinPrint) return;

  // 1. Re-fetch community gallery
  let matchedDesigns = [];
  try {
    const response = await fetch('/api/ai-design/gallery');
    if (response.ok) {
      const result = await response.json();
      const allDesigns = result.data || [];
      matchedDesigns = allDesigns.filter(d => d.style === style);
    }
  } catch (err) {
    console.warn('Failed to fetch gallery for showroom dress-up, using fallback.');
  }

  let designUrl = '';
  let promptText = '';

  if (matchedDesigns.length > 0) {
    // Select a random design from the gallery for this style
    const randomIndex = Math.floor(Math.random() * matchedDesigns.length);
    const chosen = matchedDesigns[randomIndex];
    designUrl = chosen.designUrl;
    promptText = chosen.prompt;
  } else {
    // Fallback to local SVG preset styled for dark shirts
    const svg = STYLE_PRESET_SVGS[style] || STYLE_PRESET_SVGS.minimalist;
    designUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    promptText = `Mẫu thiết kế phong cách ${style.toUpperCase()}`;
  }

  // 2. Load the design texture
  state.textureLoader.load(designUrl, (texture) => {
    // Apply to mannequin print mesh
    if (state.mannequinPrint) {
      // Clean old texture map if any
      if (state.mannequinPrint.material.map) {
        state.mannequinPrint.material.map.dispose();
      }
      state.mannequinPrint.material.map = texture;
      state.mannequinPrint.material.opacity = 1.0;
      state.mannequinPrint.material.needsUpdate = true;
    }

    // Capture the metadata of this loaded design so clicks on mannequin display it
    state.mannequinCurrentDesign = {
      category: `${style.toUpperCase()} DRESS`,
      title: `${style.toUpperCase()} ARTWORK`,
      desc: `Tác phẩm thiết kế phong cách ${style} được lựa chọn trình diễn ngẫu nhiên. Click nút dưới để ứng dụng hình in này lên áo thun 3D của bạn!`,
      image: designUrl
    };

    // 3. Update speech bubble text dynamic canvas
    updateMannequinSpeech(`DRESS: ${style.toUpperCase()}!`);
  });
}

function updateMannequinSpeech(text) {
  if (!state.mannequinBubble) return;
  const canvas = state.mannequinBubble.material.map.image;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(10, 5, 20, 0.85)';
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = '#00ffcc';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, 252, 60);
  
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 13px Courier New, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 32);
  state.mannequinBubble.material.map.needsUpdate = true;
}
