// frontend/js/home.js — v2 Premium Landing Page
const API_BASE = window.location.origin + '/api';

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
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.anim-on-scroll').forEach(el => observer.observe(el));
}

/* ============================================================
   NAVBAR SCROLL EFFECT
   ============================================================ */
function initNavbar() {
  const nav = document.getElementById('nav');
  if (!nav) return;

  let lastScroll = 0;
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    nav.classList.toggle('scrolled', scrollY > 50);
    lastScroll = scrollY;
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
  const duration = 2000;
  const start = performance.now();
  const format = (v) => v.toLocaleString('vi-VN');

  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
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

  grid.innerHTML = designs.map(d => {
    const url = d.frontDesignUrl || d.designUrl || '';
    const prompt = d.prompt || 'AI Design';
    const author = d.author || 'Community';
    return `<div class="gallery-card anim-on-scroll" onclick="window.location.href='studio.html'">
      <img class="gallery-card-img" src="${escapeAttr(url)}" alt="${escapeAttr(prompt)}" loading="lazy">
      <div class="gallery-card-info">
        <div class="gallery-card-prompt">"${escapeHtml(prompt)}"</div>
        <div class="gallery-card-meta"><span>${escapeHtml(author)}</span><span>${d.likes || 0} ❤️</span></div>
      </div>
    </div>`;
  }).join('');

  // Re-observe new elements
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
  initNavbar();
  initScrollAnimations();
  initCounters();
  initLang();
  loadGallery();
});
