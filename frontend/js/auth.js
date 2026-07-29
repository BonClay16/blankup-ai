// frontend/js/auth.js
// Immediate Theme Initialization (prevents page flicker)
(function() {
  const currentTheme = localStorage.getItem('blankup_theme') || 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);
})();

const AUTH_API = window.location.origin + '/api/auth';

class AuthManager {
  constructor() {
    this.token = localStorage.getItem('blankup_token');
    this.user = null;
    const userStr = localStorage.getItem('blankup_user');
    if (userStr) {
      try {
        this.user = JSON.parse(userStr);
      } catch (e) {
        localStorage.removeItem('blankup_user');
      }
    }
  }

  isLoggedIn() {
    return !!this.token && !!this.user;
  }

  isAdmin() {
    return this.isLoggedIn() && this.user.role === 'admin';
  }

  getDisplayName() {
    return this.user?.fullName || this.user?.username || 'Tài khoản';
  }

  getInitials() {
    const parts = this.getDisplayName().trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'US';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': this.token ? `Bearer ${this.token}` : '',
    };
  }

  async login(username, password) {
    try {
      const response = await fetch(`${AUTH_API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        if (data.requiresVerification) {
          return { success: false, requiresVerification: true, userId: data.userId, verificationMethods: data.verificationMethods, error: data.error };
        }
        return { success: false, error: data.error || 'Đăng nhập thất bại.' };
      }

      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('blankup_token', data.token);
      localStorage.setItem('blankup_user', JSON.stringify(data.user));

      return { success: true, user: data.user };
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, error: 'Không thể kết nối đến server.' };
    }
  }

  async register(username, password, fullName, email, phone) {
    try {
      const response = await fetch(`${AUTH_API}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, fullName, email, phone }),
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Đăng ký thất bại.' };
      }

      if (data.requiresVerification) {
        return { success: true, requiresVerification: true, userId: data.userId, verificationMethods: data.verificationMethods };
      }

      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('blankup_token', data.token);
      localStorage.setItem('blankup_user', JSON.stringify(data.user));

      return { success: true, user: data.user };
    } catch (err) {
      console.error('Registration error:', err);
      return { success: false, error: 'Không thể kết nối đến server.' };
    }
  }

  clearSession() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('blankup_token');
    localStorage.removeItem('blankup_user');
  }

  logout() {
    this.clearSession();
    window.location.href = '/';
  }

  init() {
    this.initThemeToggle();
    this.updateNavbar();

    if (this.isLoggedIn()) {
      this.checkSession();
    }
  }

  initThemeToggle() {
    const btn = document.getElementById('themeToggleBtn');
    if (!btn) return;
    
    // Set active class or state initially
    const syncButtonState = () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      btn.setAttribute('aria-label', `Switch to ${current === 'dark' ? 'light' : 'dark'} theme`);
    };
    syncButtonState();

    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const target = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', target);
      localStorage.setItem('blankup_theme', target);
      syncButtonState();
    });
  }

  async checkSession() {
    try {
      const response = await fetch(`${AUTH_API}/me`, {
        headers: this.getAuthHeaders(),
      });
      if (!response.ok) {
        this.logout();
      }
    } catch (err) {
      console.warn('Network issue when checking session, using offline session state.');
    }
  }

  updateNavbar() {
    if (window.location.pathname.includes('login.html')) return;

    const navbarActions = document.querySelector('.navbar-actions');
    if (!navbarActions) return;

    document.getElementById('navLoginBtn')?.remove();
    document.getElementById('userMenu')?.remove();

    if (this.isLoggedIn()) {
      this.renderUserMenu(navbarActions);
    } else {
      this.renderLoginButton(navbarActions);
    }

    if (window.i18n && typeof window.i18n.updateDOM === 'function') {
      window.i18n.updateDOM();
    }
  }

  renderUserMenu(navbarActions) {
    const name = this.getDisplayName();
    const safeName = this.escapeHtml(name);
    const safeUsername = this.escapeHtml(this.user.username || '');
    const safeRole = this.escapeHtml(this.user.role || 'user');
    const initials = this.escapeHtml(this.getInitials());
    const adminItemHtml = this.isAdmin()
      ? `<a href="admin.html" class="dropdown-item"><span class="dropdown-item-icon">AD</span><span>Admin Dashboard</span></a>`
      : '';

    const menuHtml = `
      <div class="user-menu" id="userMenu">
        <button class="user-menu-trigger" id="userMenuTrigger" type="button" aria-haspopup="true" aria-expanded="false">
          <span class="avatar-circle">${initials}</span>
          <span class="user-trigger-copy">
            <span class="user-trigger-label">Đang đăng nhập</span>
            <span class="user-name-text">${safeName}</span>
          </span>
          <span class="chevron-down">▾</span>
        </button>
        <div class="user-dropdown" id="userDropdown">
          <div class="user-dropdown-header">
            <div class="user-dropdown-avatar">${initials}</div>
            <div>
              <strong>${safeName}</strong>
              <span>@${safeUsername} · ${safeRole}</span>
            </div>
          </div>
          <hr>
          <a href="studio.html" class="dropdown-item"><span class="dropdown-item-icon">AI</span><span>AI Design Studio</span></a>
          ${adminItemHtml}
          <a href="account.html" class="dropdown-item"><span class="dropdown-item-icon">ID</span><span>Tài khoản của tôi</span></a>
          <a href="account.html#orders" class="dropdown-item"><span class="dropdown-item-icon">ĐH</span><span>Đơn hàng của tôi</span></a>
          <hr>
          <button class="dropdown-item" id="navSwitchAccountBtn" type="button"><span class="dropdown-item-icon">IN</span><span>Đăng nhập tài khoản khác</span></button>
          <button class="dropdown-item logout-btn" id="navLogoutBtn" type="button"><span class="dropdown-item-icon">OUT</span><span data-i18n="nav.logout">Đăng xuất</span></button>
        </div>
      </div>
    `;

    const langToggle = document.getElementById('langToggle');
    if (langToggle) {
      langToggle.insertAdjacentHTML('beforebegin', menuHtml);
    } else {
      navbarActions.insertAdjacentHTML('beforeend', menuHtml);
    }

    this.bindUserMenuActions();
  }

  bindUserMenuActions() {
    const trigger = document.getElementById('userMenuTrigger');
    const dropdown = document.getElementById('userDropdown');
    if (trigger && dropdown) {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdown.classList.toggle('show');
        trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });

      dropdown.addEventListener('click', (e) => e.stopPropagation());

      document.addEventListener('click', () => {
        dropdown.classList.remove('show');
        trigger.setAttribute('aria-expanded', 'false');
      });
    }

    document.getElementById('navSwitchAccountBtn')?.addEventListener('click', () => {
      this.clearSession();
      window.location.href = '/login.html';
    });

    document.getElementById('navLogoutBtn')?.addEventListener('click', () => this.logout());
  }

  renderLoginButton(navbarActions) {
    const loginBtnHtml = `
      <button class="btn btn-ghost btn-sm" id="navLoginBtn" data-i18n="nav.login" style="margin-right: 10px;">Đăng nhập</button>
    `;

    const langToggle = document.getElementById('langToggle');
    if (langToggle) {
      langToggle.insertAdjacentHTML('beforebegin', loginBtnHtml);
    } else {
      navbarActions.insertAdjacentHTML('beforeend', loginBtnHtml);
    }

    document.getElementById('navLoginBtn')?.addEventListener('click', () => {
      window.location.href = '/login.html';
    });
  }
}

const auth = new AuthManager();
document.addEventListener('DOMContentLoaded', () => {
  auth.init();
});