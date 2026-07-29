// frontend/js/account.js
const API_BASE = window.location.origin + '/api';

/* ---------- Toast (same pattern as studio.js) ---------- */
let toastContainerEl = null;
function getToastContainer() {
  if (toastContainerEl && document.body.contains(toastContainerEl)) return toastContainerEl;
  toastContainerEl = document.createElement('div');
  toastContainerEl.className = 'toast-container';
  toastContainerEl.setAttribute('aria-live', 'polite');
  document.body.appendChild(toastContainerEl);
  return toastContainerEl;
}

function showToast(message, type = 'info', duration = 4200) {
  if (!message) return;
  const container = getToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-msg"></span><button type="button" class="toast-close" aria-label="Close">✕</button>`;
  toast.querySelector('.toast-msg').textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  const remove = () => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 220); };
  toast.querySelector('.toast-close').addEventListener('click', remove);
  if (duration > 0) setTimeout(remove, duration);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

function formatMoney(amount) {
  return Number(amount || 0).toLocaleString('vi-VN') + 'đ';
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const STATUS_META = {
  pending: { label: 'Đang xử lý', cls: 'status-pending' },
  completed: { label: 'Hoàn thành', cls: 'status-completed' },
  cancelled: { label: 'Đã hủy', cls: 'status-cancelled' },
};

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadProfile();
  initProfileForm();
  initPasswordForm();

  // Orders are loaded lazily the first time the tab is opened, so a fresh
  // visitor who only checks their profile never pays for an orders fetch.
  let ordersLoaded = false;
  document.querySelector('.account-tab[data-tab="orders"]')?.addEventListener('click', () => {
    if (!ordersLoaded) {
      ordersLoaded = true;
      loadOrders();
    }
  });

  // Deep-link support: account.html#orders opens directly on the orders tab
  if (window.location.hash === '#orders') {
    document.querySelector('.account-tab[data-tab="orders"]')?.click();
  }
});

function initTabs() {
  document.querySelectorAll('.account-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.account-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.account-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`panel-${tab.dataset.tab}`)?.classList.add('active');
    });
  });
}

async function loadProfile() {
  try {
    const response = await fetch(`${API_BASE}/auth/me`, { headers: auth.getAuthHeaders() });
    const result = await response.json();
    if (!response.ok || result.success === false) throw new Error(result.error || 'Không thể tải hồ sơ.');

    const user = result.user;
    document.getElementById('accountGreetName').textContent = user.fullName || user.username;
    document.getElementById('profileUsername').value = user.username || '';
    document.getElementById('profileFullName').value = user.fullName || '';
    document.getElementById('profileEmail').value = user.email || '';
    document.getElementById('profileRole').textContent = user.role === 'admin' ? 'Quản trị viên' : 'Khách hàng';
    document.getElementById('profileProvider').textContent = user.provider === 'local' ? 'Tài khoản nội bộ' : (user.provider || '—');
    document.getElementById('profileCreatedAt').textContent = formatDate(user.createdAt);

    // Social-login accounts don't have a local password to change.
    if (user.provider && user.provider !== 'local') {
      const card = document.getElementById('passwordCard');
      if (card) {
        card.innerHTML = `
          <div class="account-card-title">Đổi mật khẩu</div>
          <p class="account-card-desc">Tài khoản của bạn đăng nhập qua ${escapeHtml(user.provider)} và không dùng mật khẩu nội bộ.</p>
        `;
      }
    }
  } catch (err) {
    showToast(err.message || 'Không thể tải hồ sơ.', 'error');
  }
}

function initProfileForm() {
  const form = document.getElementById('profileForm');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('profileSaveBtn');
    const payload = {
      username: document.getElementById('profileUsername').value.trim(),
      fullName: document.getElementById('profileFullName').value.trim(),
      email: document.getElementById('profileEmail').value.trim(),
    };

    if (!payload.fullName) {
      showToast('Họ và tên là bắt buộc.', 'warning');
      return;
    }

    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Đang lưu...';

    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        method: 'PATCH',
        headers: { ...auth.getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || result.success === false) throw new Error(result.error || 'Cập nhật thất bại.');

      localStorage.setItem('blankup_user', JSON.stringify(result.user));
      auth.user = result.user;
      document.getElementById('accountGreetName').textContent = result.user.fullName || result.user.username;
      showToast('Đã cập nhật hồ sơ thành công.', 'success');
    } catch (err) {
      showToast(err.message || 'Cập nhật thất bại.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
}

function initPasswordForm() {
  const form = document.getElementById('passwordForm');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('passwordSaveBtn');
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword.length < 6) {
      showToast('Mật khẩu mới cần ít nhất 6 ký tự.', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Xác nhận mật khẩu mới không khớp.', 'warning');
      return;
    }

    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Đang xử lý...';

    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        method: 'PATCH',
        headers: { ...auth.getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: document.getElementById('profileUsername').value.trim(),
          fullName: document.getElementById('profileFullName').value.trim(),
          email: document.getElementById('profileEmail').value.trim(),
          currentPassword,
          newPassword,
        }),
      });
      const result = await response.json();
      if (!response.ok || result.success === false) throw new Error(result.error || 'Đổi mật khẩu thất bại.');

      form.reset();
      showToast('Đổi mật khẩu thành công.', 'success');
    } catch (err) {
      showToast(err.message || 'Đổi mật khẩu thất bại.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
}

async function loadOrders() {
  const container = document.getElementById('ordersListContainer');
  try {
    const response = await fetch(`${API_BASE}/orders/me`, { headers: auth.getAuthHeaders() });
    const result = await response.json();
    if (!response.ok || result.success === false) throw new Error(result.error || 'Không thể tải đơn hàng.');

    const orders = result.data || [];
    const summary = result.summary || {};

    document.getElementById('ordersSummary').style.display = orders.length ? 'flex' : 'none';
    document.getElementById('summaryTotal').textContent = summary.totalOrders || 0;
    document.getElementById('summaryPending').textContent = summary.pendingOrders || 0;
    document.getElementById('summaryCompleted').textContent = summary.completedOrders || 0;
    document.getElementById('summarySpend').textContent = formatMoney(summary.totalSpend || 0);

    if (!orders.length) {
      container.innerHTML = `
        <div class="account-empty">
          Bạn chưa có đơn hàng nào.<br>
          <a href="studio.html">Bắt đầu thiết kế chiếc áo đầu tiên →</a>
        </div>`;
      return;
    }

    container.innerHTML = orders.map(order => {
      const status = STATUS_META[order.status] || { label: order.status || 'N/A', cls: '' };
      const total = Number(order.total || (order.price || 0) * (order.quantity || 1));
      return `
        <article class="account-order-card">
          <div class="account-order-thumb">
            ${order.designUrl ? `<img src="${escapeHtml(order.designUrl)}" alt="Thiết kế đơn ${escapeHtml(order.orderId)}">` : ''}
          </div>
          <div class="account-order-body">
            <div class="account-order-top">
              <div>
                <span class="account-order-id">#${escapeHtml(order.orderId)}</span>
                <span class="account-badge ${status.cls}">${escapeHtml(status.label)}</span>
              </div>
              <div class="account-order-price">${formatMoney(total)}</div>
            </div>
            <div class="account-order-meta">
              ${escapeHtml(order.productType || 'Áo thun')} · Size ${escapeHtml(order.size || '—')} · SL ${Number(order.quantity || 1)} · ${formatDate(order.createdAt)}
            </div>
          </div>
        </article>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="account-empty">Không thể tải đơn hàng. Vui lòng thử lại sau.</div>`;
    showToast(err.message || 'Không thể tải đơn hàng.', 'error');
  }
}