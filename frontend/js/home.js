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
        if (el.dataset.animated === 'true') return;
        const target = parseInt(el.dataset.count);
        animateCounter(el, target);
        el.dataset.animated = 'true';
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
   SCROLL PROGRESS BAR
   ============================================================ */
function initScrollProgress() {
  const bar = document.getElementById('scrollProgress');
  if (!bar) return;

  function update() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
    bar.style.transform = `scaleX(${progress})`;
  }

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => { update(); ticking = false; });
      ticking = true;
    }
  }, { passive: true });
  update();
}

/* ============================================================
   HERO ARTWORK — auto-rotate through community designs
   ============================================================ */
async function initHeroArtworkCycle() {
  const img = document.getElementById('heroArtImg');
  if (!img) return;
  const motionOK = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let pool = [];
  try {
    const resp = await fetch(`${API_BASE}/ai-design/gallery`);
    if (resp.ok) {
      const result = await resp.json();
      pool = (result.data || []).map(d => d.frontDesignUrl || d.designUrl).filter(Boolean);
    }
  } catch { /* */ }

  if (!pool.length) {
    pool = getFallbackDesigns().map(d => d.frontDesignUrl).filter(Boolean);
  }
  if (!pool.length) return;

  img.src = pool[0];
  if (!motionOK) return;

  let i = 1;
  setInterval(() => {
    img.classList.add('crossfade-out');
    setTimeout(() => {
      img.src = pool[i % pool.length];
      img.classList.remove('crossfade-out');
    }, 500);
    i++;
  }, 4500);
}

/* ============================================================
   HERO PARALLAX (scroll-based, desktop only)
   ============================================================ */
function initHeroParallax() {
  const visual = document.querySelector('.hero-visual');
  if (!visual) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.innerWidth <= 1024) return;

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < window.innerHeight) {
          visual.style.marginTop = (y * 0.1) + 'px';
        }
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

/* ============================================================
   GALLERY CARD — 3D tilt on hover (desktop only)
   ============================================================ */
function initGalleryTilt() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  document.querySelectorAll('.gallery-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const rotateY = (x - 0.5) * 8;
      const rotateX = (0.5 - y) * 8;
      card.style.transform = `perspective(800px) translateY(-6px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}

/* ============================================================
   LIVE STATS (real numbers from backend, fallback to defaults)
   ============================================================ */
let recentOrdersPool = [];

async function loadStats() {
  const counterDesigns = document.querySelector('.stat-item [data-count="10000"]');
  const counterCustomers = document.querySelector('.stat-item [data-count="5000"]');

  try {
    const resp = await fetch(`${API_BASE}/stats`);
    if (!resp.ok) throw new Error('Failed');
    const result = await resp.json();
    if (!result.success) throw new Error('Failed');

    recentOrdersPool = result.recentOrders || [];

    if (counterDesigns) counterDesigns.dataset.count = String(Math.max(result.totalDesigns || 0, 1));
    if (counterCustomers) counterCustomers.dataset.count = String(Math.max(result.totalCustomers || 0, 1));
    if (result.totalOrders) {
      document.querySelectorAll('[data-count-orders]').forEach(el => {
        el.textContent = result.totalOrders.toLocaleString('vi-VN');
      });
    }
  } catch {
    /* keep default hardcoded numbers */
  }

  initCounters();
  initRecentOrderToasts();
}

/* ============================================================
   SOCIAL PROOF — recent order toasts
   ============================================================ */
function extractCity(address) {
  const parts = String(address || '').split(',').map(s => s.trim()).filter(Boolean);
  const last = parts[parts.length - 1] || '';
  return last.replace(/^\d+[\s.-]*/, '') || 'Việt Nam';
}

function formatTimeAgo(iso) {
  const then = new Date(iso).getTime();
  if (!iso || isNaN(then)) return 'gần đây';
  const mins = Math.max(1, Math.round((Date.now() - then) / 60000));
  if (mins < 60) return mins + ' phút trước';
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours + ' giờ trước';
  return Math.round(hours / 24) + ' ngày trước';
}

function initRecentOrderToasts() {
  const toast = document.getElementById('orderToast');
  if (!toast) return;
  let index = 0;

  function showNext() {
    if (document.hidden || !recentOrdersPool.length) return;
    const order = recentOrdersPool[index % recentOrdersPool.length];
    index++;

    const firstName = String(order.name || 'Khách hàng').trim().split(/\s+/)[0];
    const city = extractCity(order.address);
    const qty = order.quantity || 1;
    const label = qty > 1 ? qty + ' áo' : '1 áo';
    const timeAgo = formatTimeAgo(order.createdAt);

    toast.innerHTML = `
      <div class="order-toast-avatar">✓</div>
      <div class="order-toast-body">
        <div class="order-toast-title"><strong>${escapeHtml(firstName)}</strong> ở ${escapeHtml(city)} vừa đặt <strong>${label}</strong></div>
        <div class="order-toast-time">${escapeHtml(timeAgo)}</div>
      </div>
      <button class="order-toast-close" aria-label="Đóng">×</button>
    `;
    toast.classList.add('visible');
    toast.querySelector('.order-toast-close').addEventListener('click', hide);

    clearTimeout(showNext._t);
    showNext._t = setTimeout(hide, 6000);
    scheduleNext();
  }

  function hide() {
    toast.classList.remove('visible');
  }

  function scheduleNext() {
    clearTimeout(showNext._t);
    showNext._t = setTimeout(showNext, 25000);
  }

  if (recentOrdersPool.length) {
    scheduleNext();
  }
}

/* ============================================================
   GALLERY
   ============================================================ */
const STYLE_LABELS = {
  minimalist: 'Minimalist',
  streetwear: 'Streetwear',
  vintage: 'Vintage',
  abstract: 'Abstract',
  anime: 'Anime',
  ai3d: 'AI 3D',
  watercolor: 'Watercolor',
  geometric: 'Geometric',
  typography: 'Typography',
  'reference remix': 'Remix ảnh',
};

async function loadGallery() {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;

  let designs;
  try {
    const resp = await fetch(`${API_BASE}/ai-design/gallery`);
    if (!resp.ok) throw new Error('Failed');
    const result = await resp.json();
    designs = (result.data || []).slice(0, 24);
  } catch {
    designs = getFallbackDesigns();
  }

  if (!designs.length) {
    designs = getFallbackDesigns();
  } else if (designs.length < 8) {
    const fallbacks = getFallbackDesigns();
    const existingIds = new Set(designs.map(d => d.designId));
    designs = [...designs, ...fallbacks.filter(d => !existingIds.has(d.designId))].slice(0, 24);
  }

  const userId = (typeof auth !== 'undefined' && auth.user?.id) || localStorage.getItem('guest_id') || '';

  renderGalleryFilters(designs);
  renderGalleryGrid(designs, userId);
  initGalleryEvents(designs, userId);
  initGalleryTilt();
  initScrollAnimations();
}

function renderGalleryFilters(designs) {
  const filters = document.getElementById('galleryFilters');
  if (!filters) return;

  const styles = ['all', ...new Set(designs.map(d => (d.style || '').toLowerCase()).filter(Boolean))];
  filters.innerHTML = styles.map(s => `
    <button class="gallery-filter-chip ${s === 'all' ? 'active' : ''}" data-style="${escapeAttr(s)}">
      ${s === 'all' ? 'Tất cả' : (STYLE_LABELS[s] || s)}
    </button>
  `).join('');
}

function renderGalleryGrid(designs, userId) {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;

  grid.innerHTML = designs.map((d, i) => {
    const url = d.frontDesignUrl || d.designUrl || '';
    const prompt = d.prompt || 'AI Design';
    const author = d.author || 'Community';
    const badge = i < 3 ? 'Trending' : '';
    const did = d.designId || '';
    const liked = d.likedBy?.includes(userId);
    const style = (d.style || '').toLowerCase();
    const useUrl = `studio.html?designUrl=${encodeURIComponent(url)}&prompt=${encodeURIComponent(prompt)}&style=${encodeURIComponent(style || 'abstract')}&author=${encodeURIComponent(author)}`;
    return `<div class="gallery-card anim-on-scroll" data-style="${escapeAttr(style)}">
      <div class="gallery-card-media">
        <a href="${escapeAttr(useUrl)}" class="gallery-card-link" title="Dùng thiết kế này">
          <img class="gallery-card-img" src="${escapeAttr(url)}" alt="${escapeAttr(prompt)}" loading="lazy">
          ${badge ? `<span class="gallery-card-badge">${badge}</span>` : ''}
        </a>
        <a href="${escapeAttr(useUrl)}" class="gallery-card-use">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          Dùng thiết kế này
        </a>
      </div>
      <div class="gallery-card-info">
        <div class="gallery-card-prompt">"${escapeHtml(prompt)}"</div>
        <div class="gallery-card-meta">
          <span>${escapeHtml(author)}</span>
          <button class="gallery-card-like ${liked ? 'liked' : ''}" data-id="${escapeAttr(did)}" data-likes="${d.likes || 0}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <span>${d.likes || 0}</span>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function initGalleryEvents(designs, userId) {
  const filters = document.getElementById('galleryFilters');
  const grid = document.getElementById('galleryGrid');
  if (!filters || !grid) return;

  filters.querySelectorAll('.gallery-filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      filters.querySelectorAll('.gallery-filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const style = chip.dataset.style;
      grid.querySelectorAll('.gallery-card').forEach(card => {
        const match = style === 'all' || card.dataset.style === style;
        card.style.display = match ? '' : 'none';
      });
    });
  });

  grid.querySelectorAll('.gallery-card-like').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
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
      } catch { /* */ }
    });
  });
}

function generateFallbackThumb(style, prompt) {
  const palette = {
    streetwear: ['#111827', '#ff2d55', '#00f0ff'],
    minimalist: ['#f5f2ed', '#17140f', '#b43e12'],
    vintage: ['#f3e9d2', '#8a5a2b', '#5c4033'],
    anime: ['#1a1a2e', '#e94560', '#ffcce0'],
    geometric: ['#0f172a', '#8b5cf6', '#22d3ee'],
    typography: ['#ffffff', '#17140f', '#b43e12'],
    abstract: ['#12002e', '#ff6b00', '#00e5ff'],
    watercolor: ['#2d1b12', '#c96f3a', '#ffd9a0'],
  };
  const c = palette[style] || palette.abstract;
  const words = String(prompt || 'BLANKUP').split(/\s+/).slice(0, 3);
  const lines = words.map((w, i) => `<text x="512" y="${440 + i * 56}" text-anchor="middle" font-family="Fraunces,serif" font-size="44" font-weight="700" fill="${c[2]}" opacity="0.95">${escapeHtml(w)}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="${c[0]}" rx="24"/><circle cx="512" cy="340" r="150" fill="${c[1]}" opacity="0.22"/><circle cx="512" cy="340" r="95" fill="${c[1]}" opacity="0.32"/><circle cx="512" cy="340" r="45" fill="${c[1]}" opacity="0.5"/>${lines}</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
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
  ].map((d, i) => ({ ...d, designId: 'demo-' + (i + 1), frontDesignUrl: generateFallbackThumb(d.style, d.prompt) }));
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
  initScrollProgress();
  initHeroParallax();
  initHeroArtworkCycle();
  loadStats();
  loadGallery();
});
