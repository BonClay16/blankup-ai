// frontend/js/home.js — v4 Premium Interactions
const API_BASE = window.location.origin + '/api';

/* ============================================================
   CURSOR GLOW
   ============================================================ */
function initCursorGlow() {
  const glow = document.getElementById('cursorGlow');
  if (!glow) return;
  let raf = null;
  let mouseX = -400;
  let mouseY = -400;
  let currentX = -400;
  let currentY = -400;

  function update() {
    currentX += (mouseX - currentX) * 0.08;
    currentY += (mouseY - currentY) * 0.08;
    glow.style.transform = `translate(${currentX}px, ${currentY}px) translate(-50%, -50%)`;
    raf = requestAnimationFrame(update);
  }

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    glow.classList.remove('hidden');
    if (!raf) raf = requestAnimationFrame(update);
  });

  document.addEventListener('mouseleave', () => {
    glow.classList.add('hidden');
  });
}

/* ============================================================
   TYPING ANIMATION
   ============================================================ */
function initTypingAnimation() {
  const el = document.getElementById('heroTyping');
  if (!el) return;

  const phrases = [
    'Một con rồng Việt Nam phong cách cyberpunk',
    'Hoa sen kết hợp sóng nước nghệ thuật',
    'Phượng hoàng lửa vintage anime style',
    'Geometric abstract neon pattern',
    'Bức tranh phố cổ Hội An',
    'Chữ thư pháp kết hợp minimal',
  ];

  let phraseIndex = 0;
  let charIndex = 0;
  let isDeleting = false;
  let isPaused = false;

  function type() {
    if (isPaused) {
      setTimeout(type, 3000);
      isPaused = false;
      return;
    }

    const current = phrases[phraseIndex];
    if (!isDeleting) {
      charIndex++;
      el.textContent = current.substring(0, charIndex);
      if (charIndex === current.length) {
        isPaused = true;
        isDeleting = true;
        setTimeout(type, 2000);
        return;
      }
      setTimeout(type, 50 + Math.random() * 60);
    } else {
      charIndex--;
      el.textContent = current.substring(0, charIndex);
      if (charIndex === 0) {
        isDeleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        setTimeout(type, 400);
        return;
      }
      setTimeout(type, 25 + Math.random() * 30);
    }
  }

  type();
}

/* ============================================================
   3D TILT ON HERO MOCKUP
   ============================================================ */
function initHeroTilt() {
  const card = document.getElementById('heroMockup');
  if (!card) return;

  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const tiltX = (y - 0.5) * 6;
    const tiltY = (0.5 - x) * 6;
    card.style.transform = `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(1.02,1.02,1.02)`;
    card.style.transition = 'transform 0.1s ease-out';
  });

  card.addEventListener('mouseleave', () => {
    card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)';
    card.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
  });
}

/* ============================================================
   MAGNETIC BUTTONS
   ============================================================ */
function initMagneticButtons() {
  document.querySelectorAll('.hero-btn-primary, .hero-btn-secondary, .nav-cta').forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const dx = (x - 0.5) * 8;
      const dy = (y - 0.5) * 8;
      btn.style.transform = `translate(${dx}px, ${dy}px)`;
      btn.style.transition = 'transform 0.2s ease-out';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
      btn.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
    });
  });
}

/* ============================================================
   SCROLL ANIMATIONS (Intersection Observer)
   ============================================================ */
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

  document.querySelectorAll('.anim-on-scroll').forEach(el => observer.observe(el));
}

/* ============================================================
   NAVBAR SCROLL EFFECT
   ============================================================ */
function initNavbar() {
  const nav = document.getElementById('nav');
  if (!nav) return;

  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 50);
  }, { passive: true });

  // Theme toggle
  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const html = document.documentElement;
      const current = html.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    });
  }

  // Restore theme
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  // Mobile menu
  const burger = document.getElementById('navToggle');
  const menu = document.getElementById('navMenu');
  if (burger && menu) {
    burger.addEventListener('click', () => {
      menu.classList.toggle('open');
      burger.classList.toggle('active');
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id === '#') return;
      const target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        menu?.classList.remove('open');
      }
    });
  });
}

/* ============================================================
   COUNTER ANIMATION
   ============================================================ */
function initCounters() {
  const counters = document.querySelectorAll('[data-count]');
  if (!counters.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.count);
        animateCounter(el, target);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(c => observer.observe(c));
}

function animateCounter(el, target) {
  const duration = 2500;
  const start = performance.now();
  const format = (v) => v.toLocaleString('vi-VN');

  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(eased * target);
    el.textContent = format(current);
    if (progress < 1) requestAnimationFrame(update);
    else el.textContent = format(target);
  }

  requestAnimationFrame(update);
}

/* ============================================================
   GALLERY
   ============================================================ */
async function loadGallery() {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;

  let designs;
  try {
    const resp = await fetch(`${API_BASE}/ai-design/gallery`);
    if (!resp.ok) throw new Error('Failed');
    const result = await resp.json();
    designs = (result.data || []).slice(0, 8);
  } catch {
    designs = getFallbackDesigns();
  }

  if (!designs.length) {
    designs = getFallbackDesigns();
  }

  grid.innerHTML = designs.map((d, i) => {
    const url = d.frontDesignUrl || d.designUrl || '';
    const prompt = d.prompt || 'AI Design';
    const author = d.author || 'Community';
    const badge = i < 3 ? 'Trending' : '';
    return `<div class="gallery-card anim-on-scroll" onclick="window.location.href='studio.html'">
      <img class="gallery-card-img" src="${escapeAttr(url)}" alt="${escapeAttr(prompt)}" loading="lazy">
      ${badge ? `<span class="gallery-card-badge">${badge}</span>` : ''}
      <div class="gallery-card-info">
        <div class="gallery-card-prompt">"${escapeHtml(prompt)}"</div>
        <div class="gallery-card-meta"><span>${escapeHtml(author)}</span><span>${d.likes || 0} ♥</span></div>
      </div>
    </div>`;
  }).join('');

  initScrollAnimations();
}

function getFallbackDesigns() {
  return [
    { prompt: 'Rồng Việt Nam cyberpunk neon', style: 'streetwear', author: 'Minh T.', likes: 234 },
    { prompt: 'Hoa sen minimalist', style: 'minimalist', author: 'An N.', likes: 189 },
    { prompt: 'Phong cảnh Hội An vintage', style: 'vintage', author: 'Hương L.', likes: 156 },
    { prompt: 'Samurai Nhật Bản anime', style: 'anime', author: 'Khoa P.', likes: 312 },
    { prompt: 'Geometric abstract neon', style: 'geometric', author: 'Trang V.', likes: 198 },
    { prompt: 'Typography nghệ thuật', style: 'typography', author: 'Đức M.', likes: 145 },
    { prompt: 'Mèo cyberpunk', style: 'abstract', author: 'Linh K.', likes: 267 },
    { prompt: 'Vietnamese coffee art', style: 'watercolor', author: 'Hải P.', likes: 178 },
  ];
}

/* ============================================================
   UTILITIES
   ============================================================ */
function escapeHtml(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function escapeAttr(s) { return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

/* ============================================================
   i18n
   ============================================================ */
function initLang() {
  const toggle = document.getElementById('langToggle');
  if (!toggle) return;
  toggle.querySelectorAll('span').forEach(span => {
    span.addEventListener('click', () => {
      toggle.querySelectorAll('span').forEach(s => s.classList.remove('active'));
      span.classList.add('active');
      const lang = span.dataset.lang;
      document.documentElement.setAttribute('data-lang', lang);
      localStorage.setItem('lang', lang);
    });
  });
  const savedLang = localStorage.getItem('lang') || 'vi';
  document.documentElement.setAttribute('data-lang', savedLang);
  toggle.querySelectorAll('span').forEach(s => s.classList.toggle('active', s.dataset.lang === savedLang));
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initCursorGlow();
  initTypingAnimation();
  initHeroTilt();
  initMagneticButtons();
  initNavbar();
  initScrollAnimations();
  initCounters();
  initLang();
  loadGallery();
});
