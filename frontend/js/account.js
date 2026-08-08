// frontend/js/account.js
const API_BASE = window.location.origin + '/api';

/* ---------- Toast — intentionally disabled (no corner popups) ---------- */
function showToast() {
  /* Toasts removed globally. Keep signature for existing call sites. */
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
  awaiting_payment: { label: 'Chờ thanh toán', cls: 'status-pending' },
  processing: { label: 'Đang sản xuất', cls: 'status-pending' },
  shipped: { label: 'Đã gửi hàng', cls: 'status-pending' },
  delivered: { label: 'Đã giao hàng', cls: 'status-pending' },
  completed: { label: 'Hoàn thành', cls: 'status-completed' },
  cancelled: { label: 'Đã hủy', cls: 'status-cancelled' },
  payment_failed: { label: 'Thanh toán thất bại', cls: 'status-cancelled' },
};

let currentCredits = null;

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

  // Credits tab: render summary instantly from /auth/me data, fetch ledger lazily
  let creditsLoaded = false;
  document.querySelector('.account-tab[data-tab="credits"]')?.addEventListener('click', () => {
    renderCreditsSummary();
    if (!creditsLoaded) {
      creditsLoaded = true;
      loadCreditLedger();
      loadPlans();
    }
  });

  initPlanPurchaseModal();

  // Deep-link support: account.html#orders opens directly on the orders tab
  if (window.location.hash === '#orders') {
    document.querySelector('.account-tab[data-tab="orders"]')?.click();
  }
  if (window.location.hash === '#credits') {
    document.querySelector('.account-tab[data-tab="credits"]')?.click();
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
    currentCredits = result.credits || null;
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
        <div class="account-empty account-empty-hero">
          <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20.38 3.46 16 2 12 3.46 8 2 3.62 3.46a2 2 0 0 0-1.34 1.89v13.3a2 2 0 0 0 2.66 1.89L8 19l4-1.46L16 19l4.38-1.46a2 2 0 0 0 1.34-1.89V5.35a2 2 0 0 0-1.34-1.89z"/>
            <circle cx="12" cy="10" r="1.2" fill="currentColor" stroke="none"/>
            <path d="M10 15.5c1.2.7 2.8.7 4 0" stroke-width="1.2"/>
          </svg>
          <p class="account-empty-title">Chưa có đơn hàng nào</p>
          <p class="account-empty-desc">Mọi đơn hàng bạn đặt sẽ xuất hiện ở đây. Hãy tạo chiếc áo đầu tiên của riêng bạn ngay bây giờ!</p>
          <a href="studio.html" class="account-empty-cta">Bắt đầu thiết kế chiếc áo đầu tiên →</a>
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

/* ---------- Credits AI ---------- */

function renderCreditsSummary() {
  const summaryEl = document.getElementById('creditsSummary');
  if (!summaryEl) return;

  if (!currentCredits) {
    summaryEl.style.display = 'none';
    const list = document.getElementById('creditLedgerList');
    if (list) list.innerHTML = `<div class="account-empty">Không có thông tin credit cho tài khoản này.</div>`;
    return;
  }

  summaryEl.style.display = 'grid';
  document.getElementById('creditHigh').textContent = currentCredits.highCredits ?? 0;
  document.getElementById('creditLow').textContent = currentCredits.lowCredits ?? 0;
  document.getElementById('creditDaily').textContent = `${currentCredits.dailyFreeUsed ?? 0}/${currentCredits.dailyFreeLimit ?? 0}`;
  document.getElementById('creditPlan').textContent = currentCredits.planName || 'Free';
}

async function loadCreditLedger() {
  const container = document.getElementById('creditLedgerList');
  if (!container) return;

  try {
    const response = await fetch(`${API_BASE}/auth/me/credits-ledger`, { headers: auth.getAuthHeaders() });
    const result = await response.json();
    if (!response.ok || result.success === false) throw new Error(result.error || 'Không thể tải lịch sử credit.');

    const rows = result.data || [];
    if (rows.length === 0) {
      container.innerHTML = `
        <div class="account-empty">
          <p class="account-empty-title">Chưa có giao dịch credit</p>
          <p class="account-empty-desc">Credit sẽ được cộng khi bạn nâng gói hoặc nhận ưu đãi, và trừ khi tạo thiết kế.</p>
        </div>`;
      return;
    }

    container.innerHTML = rows.map(row => {
      const amount = Number(row.amount) || 0;
      const typeLabel = row.creditType === 'high' ? 'High' : 'Low';
      return `
        <article class="account-credit-row">
          <div class="account-credit-icon ${amount > 0 ? 'credit-in' : 'credit-out'}">${amount > 0 ? '+' : '−'}</div>
          <div class="account-credit-info">
            <div class="account-credit-title">
              ${amount > 0 ? 'Nhận credit' : 'Dùng credit'} · ${escapeHtml(typeLabel)}
              <span class="account-credit-note">${escapeHtml(row.note || '')}</span>
            </div>
            <div class="account-credit-date">${formatDate(row.createdAt)}</div>
          </div>
          <div class="account-credit-amount ${amount > 0 ? 'credit-in-text' : 'credit-out-text'}">${amount > 0 ? '+' : ''}${amount}</div>
        </article>`;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="account-empty">Không thể tải lịch sử credit. Vui lòng thử lại sau.</div>`;
  }
}

/* ---------- AI Plans ---------- */

async function loadPlans() {
  const container = document.getElementById('planList');
  if (!container) return;

  try {
    const resp = await fetch(`${API_BASE}/ai-plans`);
    const result = await resp.json();
    if (!resp.ok || result.success === false) throw new Error(result.error || 'Không thể tải danh sách gói.');

    const plans = (result.data || []).filter(p => p.isPaid && p.priceVnd > 0);
    if (plans.length === 0) {
      container.innerHTML = `<div class="account-empty">Hiện chưa có gói nào khả dụng.</div>`;
      return;
    }

    container.innerHTML = plans.map(plan => `
      <div class="account-plan-card" data-plan-id="${escapeAttr(plan.id)}" data-plan-code="${escapeAttr(plan.code)}">
        <div class="account-plan-info">
          <div class="account-plan-name">${escapeHtml(plan.name)}</div>
          <div class="account-plan-desc">${escapeHtml(plan.description || '')}</div>
          <div class="account-plan-credits">
            <span class="plan-credit-high">+${plan.highCredits} High</span>
            ${plan.bonusLowCredits > 0 ? `<span class="plan-credit-low">+${plan.bonusLowCredits} Low</span>` : ''}
          </div>
        </div>
        <div class="account-plan-action">
          <div class="account-plan-price">${formatPrice(plan.priceVnd)}</div>
          <button class="btn btn-primary btn-sm plan-buy-btn" data-plan-id="${escapeAttr(plan.id)}">Mua</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.plan-buy-btn').forEach(btn => {
      btn.addEventListener('click', () => purchasePlan(btn.dataset.planId));
    });
  } catch (err) {
    container.innerHTML = `<div class="account-empty">Không thể tải danh sách gói. ${escapeHtml(err.message)}</div>`;
  }
}

async function purchasePlan(planId) {
  if (!auth.isLoggedIn()) {
    showToast('Vui lòng đăng nhập để mua gói.', 'warning');
    return;
  }

  try {
    const resp = await fetch(`${API_BASE}/ai-plans/purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...auth.getAuthHeaders(),
      },
      body: JSON.stringify({ planId }),
    });
    const data = await resp.json();
    if (!resp.ok || data.success === false) throw new Error(data.error || 'Không thể tạo đơn mua.');

    showPlanPurchaseModal(data);
  } catch (err) {
    showToast(err.message || 'Lỗi khi mua gói.', 'error');
  }
}

function showPlanPurchaseModal(data) {
  const modal = document.getElementById('planPurchaseModal');
  if (!modal) return;

  const amount = data.amount;
  const transferContent = data.transferContent;
  const bankInfo = data.bankInfo;

  document.getElementById('planPurchaseTitle').textContent = `Mua gói ${data.planName}`;
  document.getElementById('planPurchaseInfo').textContent = `Số tiền: ${formatPrice(amount)}`;
  document.getElementById('planPurchaseTransferContent').textContent = transferContent;

  const qrUrl = `https://img.vietqr.io/image/${bankInfo.bankId}-${bankInfo.accountNumber}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(bankInfo.accountName)}`;
  document.getElementById('planPurchaseQr').src = qrUrl;

  modal.style.display = 'flex';
}

function initPlanPurchaseModal() {
  document.getElementById('planPurchaseClose')?.addEventListener('click', () => {
    document.getElementById('planPurchaseModal').style.display = 'none';
  });
  document.getElementById('planPurchaseModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'planPurchaseModal') {
      e.target.style.display = 'none';
    }
  });
}