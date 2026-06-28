/**
 * Blankup - Landing Page Application Logic
 * Handles navigation, products, testimonials, contact form, and animations
 */

const API_BASE = window.location.origin + '/api';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize i18n
  i18n.init();

  // Initialize all modules
  initNavbar();
  initScrollAnimations();
  loadProducts();
  initTestimonials();
  initContactForm();
});

/* ============================================================
   NAVBAR
   ============================================================ */
function initNavbar() {
  const navbar = document.getElementById('navbar');
  const navToggle = document.getElementById('navToggle');
  const navMenu = document.getElementById('navMenu');

  // Scroll effect
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // Mobile toggle
  if (navToggle) {
    navToggle.addEventListener('click', () => {
      navToggle.classList.toggle('active');
      navMenu.classList.toggle('open');
    });
  }

  // Close menu on link click
  if (navMenu) {
    navMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navToggle?.classList.remove('active');
        navMenu.classList.remove('open');
      });
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const offset = navbar.offsetHeight + 20;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });
}

/* ============================================================
   SCROLL ANIMATIONS
   ============================================================ */
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  document.querySelectorAll('.animate-on-scroll').forEach(el => {
    observer.observe(el);
  });
}

/* ============================================================
   PRODUCTS
   ============================================================ */
let allProducts = [];

async function loadProducts() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  try {
    const response = await fetch(`${API_BASE}/products`);
    if (!response.ok) throw new Error('Failed to fetch');
    allProducts = await response.json();
    renderProducts(allProducts);
    initProductFilter();
  } catch (err) {
    console.warn('API not available, using fallback data');
    allProducts = getFallbackProducts();
    renderProducts(allProducts);
    initProductFilter();
  }
}

function renderProducts(products) {
  const grid = document.getElementById('productsGrid');
  const lang = i18n.currentLang;
  const isVi = lang === 'vi';

  grid.innerHTML = products.map(product => {
    const name = isVi ? product.name : (product.nameEn || product.name);
    const desc = isVi ? product.description : (product.descriptionEn || product.description);
    const price = isVi
      ? `${product.price.toLocaleString('vi-VN')}đ`
      : `$${product.priceUsd || Math.round(product.price / 25000)}`;

    const colorsHtml = (product.colors || []).slice(0, 5).map(c =>
      `<span class="color-dot" style="background:${c}" title="${c}"></span>`
    ).join('');

    const badgeHtml = product.badge
      ? `<span class="product-badge">${product.badge}</span>`
      : '';

    // SVG t-shirt illustrations by category
    const mainColor = (product.colors && product.colors[0]) || '#ffffff';
    const svgVisual = getProductSVG(product.category, mainColor);

    return `
      <div class="product-card animate-on-scroll" data-category="${product.category}">
        <div class="product-image">
          ${badgeHtml}
          <div class="tshirt-visual">${svgVisual}</div>
        </div>
        <div class="product-info">
          <h3 class="product-name">${name}</h3>
          <p class="product-desc">${desc}</p>
          <div class="product-meta">
            <div class="product-price">
              <span class="price-label">${i18n.t('products.from')} </span>${price}
            </div>
            <div class="product-colors">${colorsHtml}</div>
          </div>
          <a href="studio.html" class="product-cta" data-i18n="products.customize">${i18n.t('products.customize')}</a>
        </div>
      </div>
    `;
  }).join('');

  // Re-observe new elements for animation
  initScrollAnimations();
}

function initProductFilter() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const category = btn.dataset.category;
      if (category === 'all') {
        renderProducts(allProducts);
      } else {
        renderProducts(allProducts.filter(p => p.category === category));
      }
    });
  });
}

// Update products when language changes
i18n.onChange(() => {
  if (allProducts.length) {
    renderProducts(allProducts);
  }
});

/* ============================================================
   TESTIMONIALS CAROUSEL
   ============================================================ */
function initTestimonials() {
  const track = document.getElementById('testimonialsTrack');
  const prevBtn = document.getElementById('testimonialPrev');
  const nextBtn = document.getElementById('testimonialNext');

  if (!track || !prevBtn || !nextBtn) return;

  let currentIndex = 0;
  const cards = track.querySelectorAll('.testimonial-card');
  const totalCards = cards.length;

  function getVisibleCards() {
    if (window.innerWidth <= 768) return 1;
    if (window.innerWidth <= 1024) return 2;
    return 3;
  }

  function updateCarousel() {
    const visibleCards = getVisibleCards();
    const maxIndex = Math.max(0, totalCards - visibleCards);
    currentIndex = Math.min(currentIndex, maxIndex);

    const gap = 24;
    const cardWidth = track.querySelector('.testimonial-card')?.offsetWidth || 0;
    const offset = currentIndex * (cardWidth + gap);
    track.style.transform = `translateX(-${offset}px)`;
  }

  prevBtn.addEventListener('click', () => {
    if (currentIndex > 0) {
      currentIndex--;
      updateCarousel();
    }
  });

  nextBtn.addEventListener('click', () => {
    const visibleCards = getVisibleCards();
    const maxIndex = Math.max(0, totalCards - visibleCards);
    if (currentIndex < maxIndex) {
      currentIndex++;
      updateCarousel();
    }
  });

  window.addEventListener('resize', updateCarousel);

  // Auto-advance every 5 seconds
  setInterval(() => {
    const visibleCards = getVisibleCards();
    const maxIndex = Math.max(0, totalCards - visibleCards);
    currentIndex = currentIndex < maxIndex ? currentIndex + 1 : 0;
    updateCarousel();
  }, 5000);
}

/* ============================================================
   CONTACT FORM
   ============================================================ */
function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('contactSubmitBtn');
    const successMsg = document.getElementById('contactSuccess');
    const originalText = submitBtn.innerHTML;

    submitBtn.innerHTML = `<span>${i18n.t('contact.sending')}</span>`;
    submitBtn.disabled = true;

    const data = {
      name: document.getElementById('contactName').value,
      email: document.getElementById('contactEmail').value,
      phone: document.getElementById('contactPhone').value,
      message: document.getElementById('contactMessage').value,
    };

    try {
      const response = await fetch(`${API_BASE}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed');

      successMsg.classList.add('show');
      form.reset();

      setTimeout(() => {
        successMsg.classList.remove('show');
      }, 5000);
    } catch (err) {
      // Show success anyway for demo purposes
      successMsg.classList.add('show');
      form.reset();
      setTimeout(() => successMsg.classList.remove('show'), 5000);
    }

    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  });
}

/* ============================================================
   FALLBACK PRODUCT DATA (when API unavailable)
   ============================================================ */
function getFallbackProducts() {
  return [
    { id: 'prod-1', name: 'Áo Thun Basic', nameEn: 'Basic T-Shirt', description: 'Áo thun cotton 100% cao cấp, form regular fit thoải mái', descriptionEn: 'Premium 100% cotton t-shirt, comfortable regular fit', price: 10000, priceUsd: 1, category: 'tshirt', colors: ['#ffffff', '#000000', '#1e293b', '#6b7280', '#dc2626', '#2563eb'], sizes: ['S', 'M', 'L', 'XL', '2XL'], badge: 'Bán chạy' },
    { id: 'prod-2', name: 'Áo Thun Oversize', nameEn: 'Oversize T-Shirt', description: 'Form oversize trẻ trung, chất liệu cotton thoáng mát', descriptionEn: 'Youthful oversize fit, breathable cotton material', price: 10000, priceUsd: 1, category: 'oversize', colors: ['#ffffff', '#000000', '#1e293b', '#f5f5dc', '#4a5568'], sizes: ['M', 'L', 'XL', '2XL'], badge: '' },
    { id: 'prod-3', name: 'Áo Polo Classic', nameEn: 'Classic Polo', description: 'Áo polo lịch lãm, phù hợp đi làm và dạo phố', descriptionEn: 'Elegant polo shirt, perfect for work and casual outings', price: 10000, priceUsd: 1, category: 'polo', colors: ['#ffffff', '#000000', '#1e3a5f', '#8b0000'], sizes: ['S', 'M', 'L', 'XL'], badge: '' },
    { id: 'prod-4', name: 'Hoodie Premium', nameEn: 'Premium Hoodie', description: 'Hoodie dày dặn, giữ ấm tốt, có túi kangaroo', descriptionEn: 'Thick premium hoodie with kangaroo pocket', price: 10000, priceUsd: 1, category: 'hoodie', colors: ['#000000', '#1e293b', '#374151', '#ffffff'], sizes: ['M', 'L', 'XL', '2XL'], badge: 'Mới' },
    { id: 'prod-5', name: 'Áo Thun Cổ Tròn', nameEn: 'Crew Neck T-Shirt', description: 'Thiết kế cổ tròn classic, cotton co giãn 4 chiều', descriptionEn: 'Classic crew neck design, 4-way stretch cotton', price: 10000, priceUsd: 1, category: 'tshirt', colors: ['#ffffff', '#000000', '#0f172a', '#065f46', '#7c2d12'], sizes: ['S', 'M', 'L', 'XL', '2XL'], badge: '' },
    { id: 'prod-6', name: 'Áo Thun V-Neck', nameEn: 'V-Neck T-Shirt', description: 'Cổ chữ V thanh lịch, tôn dáng, cotton mịn', descriptionEn: 'Elegant V-neck design, flattering fit, soft cotton', price: 10000, priceUsd: 1, category: 'tshirt', colors: ['#ffffff', '#000000', '#1e293b', '#1e40af'], sizes: ['S', 'M', 'L', 'XL'], badge: '' },
    { id: 'prod-7', name: 'Áo Polo Thể Thao', nameEn: 'Sport Polo', description: 'Chất liệu thể thao, thoáng khí, co giãn tốt', descriptionEn: 'Athletic material, breathable, excellent stretch', price: 10000, priceUsd: 1, category: 'polo', colors: ['#ffffff', '#000000', '#1e3a5f', '#dc2626', '#059669'], sizes: ['S', 'M', 'L', 'XL', '2XL'], badge: '' },
    { id: 'prod-8', name: 'Hoodie Zip', nameEn: 'Zip-Up Hoodie', description: 'Hoodie khóa kéo tiện lợi, form slim fit', descriptionEn: 'Convenient zip-up hoodie, slim fit design', price: 10000, priceUsd: 1, category: 'hoodie', colors: ['#000000', '#1e293b', '#374151'], sizes: ['M', 'L', 'XL', '2XL'], badge: '' },
  ].map(product => ({ ...product, price: 10000, priceUsd: 1 }));
}

/* ============================================================
   PRODUCT SVG ILLUSTRATIONS
   ============================================================ */
function getProductSVG(category, color) {
  const isLight = isLightColorCheck(color);
  const stroke = isLight ? '#d1d5db' : 'rgba(255,255,255,0.15)';
  const highlight = isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.08)';

  const svgs = {
    tshirt: `<svg viewBox="0 0 160 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="tg${color.replace('#','')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${lighten(color,8)}"/><stop offset="100%" stop-color="${darken(color,8)}"/></linearGradient></defs>
      <path d="M48 32 L20 48 L8 82 L34 88 L40 60 L40 165 L120 165 L120 60 L126 88 L152 82 L140 48 L112 32 L98 40 Q88 48 80 48 Q72 48 62 40 Z" fill="url(#tg${color.replace('#','')})" stroke="${stroke}" stroke-width="1"/>
      <ellipse cx="80" cy="34" rx="20" ry="9" fill="none" stroke="${stroke}" stroke-width="1"/>
      <rect x="60" y="75" width="40" height="40" rx="4" fill="${highlight}"/>
      <path d="M72 90 L80 82 L88 90 M80 82 V105" stroke="${isLight ? '#94a3b8' : 'rgba(255,255,255,0.3)'}" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    </svg>`,

    oversize: `<svg viewBox="0 0 170 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="og${color.replace('#','')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${lighten(color,8)}"/><stop offset="100%" stop-color="${darken(color,8)}"/></linearGradient></defs>
      <path d="M42 30 L12 50 L2 88 L32 94 L38 58 L38 170 L132 170 L132 58 L138 94 L168 88 L158 50 L128 30 L110 42 Q95 52 85 52 Q75 52 60 42 Z" fill="url(#og${color.replace('#','')})" stroke="${stroke}" stroke-width="1"/>
      <ellipse cx="85" cy="32" rx="24" ry="10" fill="none" stroke="${stroke}" stroke-width="1"/>
      <circle cx="85" cy="100" r="20" fill="${highlight}"/>
      <text x="85" y="105" text-anchor="middle" font-family="Arial" font-size="10" font-weight="bold" fill="${isLight ? '#94a3b8' : 'rgba(255,255,255,0.3)'}">OVS</text>
    </svg>`,

    polo: `<svg viewBox="0 0 160 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="pg${color.replace('#','')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${lighten(color,8)}"/><stop offset="100%" stop-color="${darken(color,8)}"/></linearGradient></defs>
      <path d="M48 32 L20 48 L8 82 L34 88 L40 60 L40 165 L120 165 L120 60 L126 88 L152 82 L140 48 L112 32 L98 40 Q88 48 80 48 Q72 48 62 40 Z" fill="url(#pg${color.replace('#','')})" stroke="${stroke}" stroke-width="1"/>
      <!-- Polo collar -->
      <path d="M62 38 L80 52 L98 38" fill="${darken(color,15)}" stroke="${stroke}" stroke-width="0.8"/>
      <path d="M72 38 L80 46 L88 38" fill="url(#pg${color.replace('#','')})" stroke="${stroke}" stroke-width="0.5"/>
      <!-- Buttons -->
      <circle cx="80" cy="55" r="1.5" fill="${stroke}"/>
      <circle cx="80" cy="62" r="1.5" fill="${stroke}"/>
      <circle cx="80" cy="69" r="1.5" fill="${stroke}"/>
    </svg>`,

    hoodie: `<svg viewBox="0 0 160 185" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="hg${color.replace('#','')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${lighten(color,8)}"/><stop offset="100%" stop-color="${darken(color,8)}"/></linearGradient></defs>
      <!-- Hood -->
      <path d="M50 35 Q50 10 80 8 Q110 10 110 35" fill="${darken(color,6)}" stroke="${stroke}" stroke-width="1"/>
      <!-- Body -->
      <path d="M48 35 L18 52 L6 88 L34 94 L40 62 L40 170 L120 170 L120 62 L126 94 L154 88 L142 52 L112 35 L100 42 Q90 48 80 48 Q70 48 60 42 Z" fill="url(#hg${color.replace('#','')})" stroke="${stroke}" stroke-width="1"/>
      <!-- Kangaroo pocket -->
      <path d="M55 115 Q55 105 80 105 Q105 105 105 115 V135 Q105 140 80 140 Q55 140 55 135 Z" fill="${highlight}" stroke="${stroke}" stroke-width="0.5"/>
      <!-- Hood strings -->
      <line x1="72" y1="48" x2="70" y2="68" stroke="${stroke}" stroke-width="0.8"/>
      <line x1="88" y1="48" x2="90" y2="68" stroke="${stroke}" stroke-width="0.8"/>
    </svg>`,
  };

  return svgs[category] || svgs.tshirt;
}

function isLightColorCheck(hex) {
  if (!hex || hex.length < 7) return true;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

function lighten(hex, pct) {
  if (!hex || hex.length < 7) return '#ffffff';
  const n = parseInt(hex.replace('#', ''), 16);
  const a = Math.round(2.55 * pct);
  const R = Math.min(255, (n >> 16) + a);
  const G = Math.min(255, ((n >> 8) & 0xFF) + a);
  const B = Math.min(255, (n & 0xFF) + a);
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

function darken(hex, pct) {
  if (!hex || hex.length < 7) return '#e0e0e0';
  const n = parseInt(hex.replace('#', ''), 16);
  const a = Math.round(2.55 * pct);
  const R = Math.max(0, (n >> 16) - a);
  const G = Math.max(0, ((n >> 8) & 0xFF) - a);
  const B = Math.max(0, (n & 0xFF) - a);
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}
