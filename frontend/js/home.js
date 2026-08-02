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
    const artwork = document.getElementById('heroArtwork');
    if (artwork) artwork.innerHTML = '<div class="hero-artwork-empty" aria-hidden="true"></div>';
    return;
  }

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
   LIVE STATS — real numbers from backend, zeros if unavailable
   ============================================================ */
async function loadStats() {
  let stats = null;
  try {
    const resp = await fetch(`${API_BASE}/stats`);
    if (!resp.ok) throw new Error('Failed');
    const result = await resp.json();
    if (!result.success) throw new Error('Failed');
    stats = result;
  } catch { /* keep zeros */ }

  const counters = {
    designs: document.querySelector('.stat-item [data-count="designs"]'),
    customers: document.querySelector('.stat-item [data-count="customers"]'),
    orders: document.querySelector('.stat-item [data-count="orders"]'),
  };

  if (stats) {
    if (counters.designs) counters.designs.dataset.count = String(stats.totalDesigns || 0);
    if (counters.customers) counters.customers.dataset.count = String(stats.totalCustomers || 0);
    if (counters.orders) counters.orders.dataset.count = String(stats.totalOrders || 0);
  }

  const floatDesigns = document.getElementById('heroFloatDesigns');
  if (floatDesigns) floatDesigns.textContent = (stats?.totalDesigns || 0).toLocaleString('vi-VN');

  initCounters();
  renderHeroTrust(stats?.recentOrders || [], stats?.totalOrders || 0);
}

/* ============================================================
   HERO TRUST — real customer initials from recent orders
   ============================================================ */
function renderHeroTrust(recentOrders, totalOrders) {
  const trust = document.getElementById('heroTrust');
  if (!trust) return;

  if (!Array.isArray(recentOrders) || !recentOrders.length) {
    trust.style.display = 'none';
    return;
  }

  const colors = ['#ff6b00', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#f59e0b'];
  const avatars = document.getElementById('heroTrustAvatars');
  if (avatars) {
    avatars.innerHTML = recentOrders.slice(0, 4).map(o => {
      const name = String(o.name || 'K').trim();
      const initial = (name.split(/\s+/).pop() || 'K').charAt(0).toUpperCase();
      let hue = 0;
      for (const ch of name) hue = (hue + ch.charCodeAt(0)) % colors.length;
      return `<div class="hero-trust-avatar" title="${escapeAttr(name)}" style="background:${colors[hue]};">${escapeHtml(initial)}</div>`;
    }).join('');
  }

  const text = document.getElementById('heroTrustText');
  if (text) {
    text.innerHTML = `<strong>${Number(totalOrders || 0).toLocaleString('vi-VN')}</strong> đơn hàng đã được đặt`;
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

  let designs = [];
  try {
    const resp = await fetch(`${API_BASE}/ai-design/gallery`);
    if (!resp.ok) throw new Error('Failed');
    const result = await resp.json();
    designs = (result.data || []).slice(0, 24);
  } catch { /* empty gallery */ }

  const userId = (typeof auth !== 'undefined' && auth.user?.id) || localStorage.getItem('guest_id') || '';

  if (!designs.length) {
    renderGalleryEmpty();
    return;
  }

  renderGalleryFilters(designs);
  renderGalleryGrid(designs, userId);
  initGalleryEvents(designs, userId);
  initGalleryTilt();
  initScrollAnimations();
}

function renderGalleryEmpty() {
  const grid = document.getElementById('galleryGrid');
  const filters = document.getElementById('galleryFilters');
  if (!grid) return;
  if (filters) filters.innerHTML = '';
  grid.innerHTML = `
    <div class="gallery-empty">
      <div class="gallery-empty-icon">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
      </div>
      <h3>Chưa có thiết kế nào được chia sẻ</h3>
      <p>Hãy là người đầu tiên tạo một tác phẩm và chia sẻ lên cộng đồng Blankup.</p>
      <a class="hero-btn-primary" href="studio.html">Tạo thiết kế đầu tiên</a>
    </div>`;
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

  grid.innerHTML = designs.map((d) => {
    const url = d.frontDesignUrl || d.designUrl || '';
    const prompt = d.prompt || 'AI Design';
    const author = d.author || 'Community';
    const did = d.designId || '';
    const liked = d.likedBy?.includes(userId);
    const style = (d.style || '').toLowerCase();
    const useUrl = `studio.html?designUrl=${encodeURIComponent(url)}&prompt=${encodeURIComponent(prompt)}&style=${encodeURIComponent(style || 'abstract')}&author=${encodeURIComponent(author)}`;
    const authorHtml = d.authorUsername
      ? `<a href="creator.html?user=${encodeURIComponent(d.authorUsername)}" class="gallery-card-author" title="Xem hồ sơ ${escapeAttr(author)}">${escapeHtml(author)}</a>`
      : `<span>${escapeHtml(author)}</span>`;
    return `<div class="gallery-card anim-on-scroll" data-style="${escapeAttr(style)}">
      <div class="gallery-card-media">
        <a href="${escapeAttr(useUrl)}" class="gallery-card-link" title="Dùng thiết kế này">
          <img class="gallery-card-img" src="${escapeAttr(url)}" alt="${escapeAttr(prompt)}" loading="lazy">
        </a>
        <a href="${escapeAttr(useUrl)}" class="gallery-card-use">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          Dùng thiết kế này
        </a>
      </div>
      <div class="gallery-card-info">
        <div class="gallery-card-prompt">"${escapeHtml(prompt)}"</div>
        <div class="gallery-card-meta">
          <span class="gallery-card-meta-left">${authorHtml}</span>
          <span class="gallery-card-meta-actions">
            <button class="gallery-card-comment" data-id="${escapeAttr(did)}" data-count="${d.commentCount || 0}" title="Bình luận">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              <span>${d.commentCount || 0}</span>
            </button>
            <button class="gallery-card-like ${liked ? 'liked' : ''}" data-id="${escapeAttr(did)}" data-likes="${d.likes || 0}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              <span>${d.likes || 0}</span>
            </button>
          </span>
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

  grid.querySelectorAll('.gallery-card-comment').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const designId = btn.dataset.id;
      if (designId) openCommentsModal(designId, btn.dataset.count);
    });
  });
}

/* ============================================================
   COMMENTS MODAL
   ============================================================ */
const commentsState = { designId: null, list: [] };

async function openCommentsModal(designId, count) {
  const overlay = document.getElementById('commentsModal');
  const list = document.getElementById('commentsList');
  if (!overlay || !list) return;

  commentsState.designId = designId;
  const title = document.getElementById('commentsModalTitle');
  if (title) title.textContent = `Bình luận (${count || 0})`;

  const isLoggedIn = typeof auth !== 'undefined' && auth.token && auth.user?.id;
  const form = document.getElementById('commentsForm');
  const prompt = document.getElementById('commentsLoginPrompt');
  if (form) form.style.display = isLoggedIn ? '' : 'none';
  if (prompt) prompt.style.display = isLoggedIn ? 'none' : '';

  list.innerHTML = '<div class="comments-loading">Đang tải bình luận...</div>';
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  try {
    const resp = await fetch(`${API_BASE}/ai-design/${encodeURIComponent(designId)}/comments`);
    const data = await resp.json();
    commentsState.list = data.data || [];
    renderCommentsList(list);
  } catch {
    list.innerHTML = '<div class="comments-empty">Không thể tải bình luận.</div>';
  }
}

function renderCommentsList(list) {
  if (!list) return;
  if (!commentsState.list.length) {
    list.innerHTML = '<div class="comments-empty">Chưa có bình luận nào. Hãy là người đầu tiên!</div>';
    return;
  }
  list.innerHTML = commentsState.list.map(c => {
    const avatar = (c.authorName || '?').charAt(0).toUpperCase();
    return `<div class="comment-item">
      <div class="comment-avatar">${escapeHtml(avatar)}</div>
      <div class="comment-body">
        <div class="comment-meta">
          ${c.authorUsername ? `<a class="comment-author" href="creator.html?user=${encodeURIComponent(c.authorUsername)}">${escapeHtml(c.authorName)}</a>` : `<span class="comment-author">${escapeHtml(c.authorName)}</span>`}
          <span class="comment-date">${formatCommentDate(c.createdAt)}</span>
        </div>
        <div class="comment-text">${escapeHtml(c.text)}</div>
      </div>
    </div>`;
  }).join('');
}

function formatCommentDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const now = new Date();
  const diff = Math.floor((now - d) / 60000);
  if (diff < 1) return 'Vừa xong';
  if (diff < 60) return `${diff} phút trước`;
  if (diff < 1440) return `${Math.floor(diff / 60)} giờ trước`;
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function initCommentsModal() {
  const overlay = document.getElementById('commentsModal');
  if (!overlay) return;

  const close = () => {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  };
  document.getElementById('commentsModalClose')?.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('open')) close(); });

  document.getElementById('commentsSubmitBtn')?.addEventListener('click', async () => {
    const input = document.getElementById('commentsInput');
    const text = (input?.value || '').trim();
    if (!text || !commentsState.designId) return;

    const headers = { 'Content-Type': 'application/json' };
    if (typeof auth !== 'undefined' && auth.token) headers.Authorization = `Bearer ${auth.token}`;

    try {
      const resp = await fetch(`${API_BASE}/ai-design/${encodeURIComponent(commentsState.designId)}/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text }),
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.error || 'Gửi bình luận thất bại');
      commentsState.list.push(data.data);
      const list = document.getElementById('commentsList');
      renderCommentsList(list);
      if (input) input.value = '';
      const title = document.getElementById('commentsModalTitle');
      if (title) title.textContent = `Bình luận (${commentsState.list.length})`;
      document.querySelectorAll('.gallery-card-comment').forEach(b => {
        if (b.dataset.id === commentsState.designId) {
          b.dataset.count = commentsState.list.length;
          const label = b.querySelector('span');
          if (label) label.textContent = commentsState.list.length;
        }
      });
    } catch (e) {
      const list = document.getElementById('commentsList');
      if (list) list.insertAdjacentHTML('afterbegin', `<div class="comments-error">${escapeHtml(e.message)}</div>`);
    }
  });
}

/* ============================================================
   COMMUNITY COMMENTS — real comments from gallery designs
   ============================================================ */
async function loadReviews() {
  const track = document.getElementById('reviewsTrack');
  const section = document.getElementById('reviews');
  if (!track || !section) return;

  let reviews = [];
  try {
    const resp = await fetch(`${API_BASE}/ai-design/gallery`);
    if (!resp.ok) throw new Error('Failed');
    const result = await resp.json();
    const designs = (result.data || []).slice(0, 8);

    for (const d of designs) {
      if (!d.commentCount) continue;
      try {
        const cResp = await fetch(`${API_BASE}/ai-design/${encodeURIComponent(d.designId)}/comments`);
        if (!cResp.ok) continue;
        const cData = await cResp.json();
        (cData.data || []).forEach(c => {
          reviews.push({
            name: c.authorName || 'Khách hàng',
            date: c.createdAt,
            text: c.text,
          });
        });
      } catch { /* */ }
      if (reviews.length >= 6) break;
    }
  } catch { /* hide section */ }

  if (!reviews.length) {
    section.style.display = 'none';
    return;
  }

  const colors = ['#ff6b00', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444'];
  track.innerHTML = reviews.slice(0, 6).map((r, i) => {
    const initial = (r.name.charAt(0) || 'K').toUpperCase();
    let hue = 0;
    for (const ch of r.name) hue = (hue + ch.charCodeAt(0)) % colors.length;
    return `<div class="review-card anim-on-scroll" style="animation-delay:${i * 0.08}s">
      <p>"${escapeHtml(r.text)}"</p>
      <div class="review-author">
        <div class="review-avatar" style="background:${colors[hue]};">${escapeHtml(initial)}</div>
        <div>
          <div class="review-name">${escapeHtml(r.name)}</div>
          <div class="review-role">${formatCommentDate(r.date)}</div>
        </div>
      </div>
    </div>`;
  }).join('');
  initScrollAnimations();
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
  // Language switching is handled globally by i18n.js (window.i18n.init via auth.js)
  // Migrate old localStorage key used by previous versions
  const oldLang = localStorage.getItem('lang');
  if (oldLang && !localStorage.getItem('blankup_lang')) {
    localStorage.setItem('blankup_lang', oldLang === 'en' ? 'en' : 'vi');
  }
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
  initLang();
  initScrollProgress();
  initHeroParallax();
  initHeroArtworkCycle();
  initCommentsModal();
  loadStats();
  loadGallery();
  loadReviews();
});
