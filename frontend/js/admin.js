// frontend/js/admin.js
/**
 * Blankup Admin Dashboard
 * Operational dashboard for orders, payment status, users, and generated designs.
 */

const API_ADMIN = window.location.origin + '/api/admin';
const API_ORDERS = window.location.origin + '/api/orders';

const adminState = {
  stats: null,
  orders: [],
  users: [],
  designs: [],
  currentTab: 'overview',
  orderFilter: 'all',
  paymentFilter: 'all',
  orderSearch: '',
  designVisibilityFilter: 'all',
  userSearch: '',
  orderUserFilter: null,
  orderUserFilterLabel: '',
  selectedPreviewOrder: null,
  previewSide: 'front',
  previewShirtColor: '#ffffff',
};

const STATUS_META = {
  pending: { label: 'Đang xử lý', cls: 'badge-pending' },
  completed: { label: 'Hoàn thành', cls: 'badge-completed' },
  cancelled: { label: 'Đã hủy', cls: 'badge-cancelled' },
};

const PAYMENT_META = {
  COD: { label: 'COD', cls: 'badge-cod' },
  BANK_TRANSFER: { label: 'QR chuyển khoản', cls: 'badge-bank' },
};

const PAYMENT_STATUS_META = {
  cod_pending: { label: 'COD khi nhận hàng', cls: 'badge-muted' },
  awaiting_transfer: { label: 'Chờ chuyển khoản', cls: 'badge-awaiting' },
  paid: { label: 'Đã thanh toán', cls: 'badge-paid' },
  underpaid: { label: 'Chuyển thiếu', cls: 'badge-underpaid' },
};

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initOrderFilters();
  initOrderTools();
  initDesignFilters();
  initUserTools();
  initColorDotPreview();
  initPreviewSideToggle();
  initPreviewModalClose();
  initUserDetailModalClose();
  initUserFormModal();
  initRefreshActions();
  initExportActions();
  loadDashboardData();
});

async function loadDashboardData() {
  setDashboardLoading(true);
  try {
    const [statsResponse, ordersResponse, designsResponse] = await Promise.all([
      fetch(`${API_ADMIN}/stats`, { headers: auth.getAuthHeaders() }),
      fetch(API_ORDERS, { headers: auth.getAuthHeaders() }),
      fetch(`${API_ADMIN}/designs`, { headers: auth.getAuthHeaders() }),
    ]);

    if (!statsResponse.ok) throw new Error('Không thể tải thống kê admin.');
    if (!ordersResponse.ok) throw new Error('Không thể tải danh sách đơn hàng.');

    const statsData = await statsResponse.json();
    const ordersData = await ordersResponse.json();
    let designsData = { data: [] };
    if (designsResponse.ok) {
      const ct = designsResponse.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        designsData = await designsResponse.json();
      }
    }

    adminState.stats = statsData.stats || null;
    adminState.users = statsData.users || [];
    adminState.orders = ordersData.data || [];
    adminState.designs = designsData.data || [];
    console.log('[Admin] Data loaded:', { users: adminState.users.length, orders: adminState.orders.length, designs: adminState.designs.length });

    renderDashboard();
  } catch (err) {
    console.error('Admin data error:', err);
    showAdminToast(err.message || 'Không thể tải dữ liệu admin.', 'error');
  } finally {
    setDashboardLoading(false);
  }
}

function renderDashboard() {
  renderOverview();
  renderOrdersList();
  renderUsersList();
  renderDesignsGrid();
}

function setDashboardLoading(isLoading) {
  document.body.classList.toggle('admin-loading', Boolean(isLoading));
  const refreshBtn = document.getElementById('adminRefreshBtn');
  if (refreshBtn) {
    refreshBtn.disabled = Boolean(isLoading);
    refreshBtn.textContent = isLoading ? 'Đang tải...' : 'Làm mới';
  }
}

function initTabs() {
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', () => switchTab(link.dataset.tab));
  });

  document.getElementById('viewAllOrdersBtn')?.addEventListener('click', () => switchTab('orders'));
}

function switchTab(tabName) {
  adminState.currentTab = tabName;
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.classList.toggle('active', link.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `panel-${tabName}`);
  });
  window.scrollTo({ top: 0, behavior: 'auto' });
  document.querySelector('.admin-workspace')?.scrollIntoView({ block: 'start', behavior: 'auto' });
}

function initOrderFilters() {
  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(item => item.classList.remove('active'));
      pill.classList.add('active');
      adminState.orderFilter = pill.dataset.filter || 'all';
      renderOrdersList();
    });
  });
}

function initOrderTools() {
  const searchInput = document.getElementById('orderSearchInput');
  const paymentFilter = document.getElementById('paymentFilterSelect');

  searchInput?.addEventListener('input', () => {
    adminState.orderSearch = searchInput.value.trim().toLowerCase();
    renderOrdersList();
  });

  paymentFilter?.addEventListener('change', () => {
    adminState.paymentFilter = paymentFilter.value;
    renderOrdersList();
  });

  document.getElementById('orderUserFilterClear')?.addEventListener('click', (e) => {
    e.stopPropagation();
    clearUserOrderFilter();
  });
}

function initRefreshActions() {
  document.getElementById('adminRefreshBtn')?.addEventListener('click', loadDashboardData);
}

function initExportActions() {
  document.getElementById('adminExportBtn')?.addEventListener('click', exportOrdersCsv);
}

function initDesignFilters() {
  document.querySelectorAll('.design-filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.design-filter-pill').forEach(item => item.classList.remove('active'));
      pill.classList.add('active');
      adminState.designVisibilityFilter = pill.dataset.designFilter || 'all';
      renderDesignsGrid();
    });
  });
}

function initUserTools() {
  const searchInput = document.getElementById('userSearchInput');
  searchInput?.addEventListener('input', () => {
    adminState.userSearch = searchInput.value.trim().toLowerCase();
    renderUsersList();
  });
}

function viewOrdersForUser(user) {
  switchTab('orders');
  adminState.orderUserFilter = user.id;
  adminState.orderUserFilterLabel = user.fullName || user.username;
  document.querySelectorAll('.filter-pill').forEach(item => item.classList.remove('active'));
  document.querySelector('.filter-pill[data-filter="all"]')?.classList.add('active');
  adminState.orderFilter = 'all';
  const searchInput = document.getElementById('orderSearchInput');
  if (searchInput) searchInput.value = '';
  adminState.orderSearch = '';
  renderOrdersList();
}

function clearUserOrderFilter() {
  adminState.orderUserFilter = null;
  adminState.orderUserFilterLabel = '';
  renderOrdersList();
}

function renderOverview() {
  const stats = adminState.stats;
  if (!stats) return;

  const paymentStats = getPaymentStats(adminState.orders);
  setText('stat-revenue', formatMoney(stats.totalRevenue));
  setText('stat-pending-revenue', formatMoney(stats.pendingRevenue));
  setText('stat-average-value', formatMoney(stats.averageOrderValue));
  setText('stat-total-orders', stats.totalOrdersCount);
  setText('stat-users-count', stats.usersCount);
  setText('stat-designs-count', stats.designsCount);
  setText('stat-paid-orders', paymentStats.paid);
  setText('stat-awaiting-payment', paymentStats.awaiting);

  setText('summary-completed', stats.completedCount);
  setText('summary-pending', stats.pendingCount);
  setText('summary-cancelled', stats.cancelledCount);
  setText('summary-paid', paymentStats.paid);
  setText('summary-awaiting', paymentStats.awaiting);
  setText('ops-paid-revenue', formatMoney(paymentStats.paidRevenue));
  setText('ops-awaiting-money', formatMoney(paymentStats.awaitingRevenue));
  setText('ops-underpaid-count', paymentStats.underpaid);

  renderCategoryBreakdown(stats.categories || {});
  renderRecentOrders();
}

function renderCategoryBreakdown(categories) {
  const list = document.getElementById('categoryBreakdownList');
  if (!list) return;

  const names = {
    tshirt: 'Áo thun',
    oversize: 'Oversize',
    polo: 'Polo',
    hoodie: 'Hoodie',
  };
  const maxRevenue = Math.max(...Object.values(categories).map(cat => cat.revenue || 0), 1);
  list.innerHTML = Object.entries(categories).map(([key, cat]) => {
    const pct = Math.round(((cat.revenue || 0) / maxRevenue) * 100);
    return `
      <div class="category-row">
        <div class="category-labels">
          <span class="cat-name">${escapeHtml(names[key] || key)}</span>
          <span class="cat-count">${Number(cat.count || 0)} cái · ${formatMoney(cat.revenue || 0)}</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderRecentOrders() {
  const recentBody = document.getElementById('recentOrdersTableBody');
  if (!recentBody) return;
  const recent = [...adminState.orders]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);
  recentBody.innerHTML = recent.length
    ? recent.map(order => renderOrderRow(order, true)).join('')
    : renderEmptyRow(8, 'Chưa có đơn hàng nào.');
  bindRowActions(recentBody);
}

function renderOrdersList() {
  const tbody = document.getElementById('allOrdersTableBody');
  const countEl = document.getElementById('ordersResultCount');
  if (!tbody) return;

  const filteredOrders = getFilteredOrders();
  if (countEl) countEl.textContent = `${filteredOrders.length}/${adminState.orders.length} đơn`;

  const filterChip = document.getElementById('orderUserFilterChip');
  if (filterChip) {
    if (adminState.orderUserFilter) {
      filterChip.style.display = 'inline-flex';
      filterChip.querySelector('.filter-chip-label').textContent = `Khách: ${adminState.orderUserFilterLabel}`;
    } else {
      filterChip.style.display = 'none';
    }
  }

  tbody.innerHTML = filteredOrders.length
    ? filteredOrders.map(order => renderOrderRow(order)).join('')
    : renderEmptyRow(8, 'Không có đơn hàng nào khớp bộ lọc.');
  bindRowActions(tbody);
}

function getFilteredOrders() {
  return adminState.orders.filter(order => {
    const statusMatch = adminState.orderFilter === 'all' || order.status === adminState.orderFilter;
    const paymentStatus = order.paymentStatus || '';
    const paymentMatch = adminState.paymentFilter === 'all'
      || order.payment === adminState.paymentFilter
      || paymentStatus === adminState.paymentFilter;
    const userMatch = !adminState.orderUserFilter || order.userId === adminState.orderUserFilter;
    const haystack = [
      order.orderId,
      order.customer?.name,
      order.customer?.phone,
      order.customer?.address,
      order.transferContent,
      order.productType,
      order.payment,
      paymentStatus,
    ].join(' ').toLowerCase();
    const searchMatch = !adminState.orderSearch || haystack.includes(adminState.orderSearch);
    return statusMatch && paymentMatch && userMatch && searchMatch;
  });
}

function renderOrderRow(order, compact = false) {
  const total = getOrderTotal(order);
  const status = STATUS_META[order.status] || { label: order.status || 'N/A', cls: 'badge-muted' };
  const payment = PAYMENT_META[order.payment] || { label: order.payment || 'N/A', cls: 'badge-muted' };
  const paymentStatus = PAYMENT_STATUS_META[order.paymentStatus] || { label: order.paymentStatus || 'Chưa rõ', cls: 'badge-muted' };
  const dateStr = formatDate(order.createdAt);
  const paidAt = order.paidAt ? `<div class="row-muted">Thanh toán: ${formatDate(order.paidAt)}</div>` : '';
  const transferLine = order.transferContent ? `<div class="row-muted">${escapeHtml(order.transferContent)}</div>` : '';
  const customerNote = order.customer?.note ? `<div class="row-muted">Ghi chú: ${escapeHtml(order.customer.note)}</div>` : '';
  const completeActionHtml = order.status === 'pending'
    ? `<button class="btn-icon btn-complete-action" data-action="complete" data-id="${escapeAttr(order.orderId)}" title="Đánh dấu hoàn thành">✓</button>`
    : '';
  const cancelActionHtml = order.status === 'pending'
    ? `<button class="btn-icon btn-cancel-action" data-action="cancel" data-id="${escapeAttr(order.orderId)}" title="Hủy đơn">×</button>`
    : '';
  const markPaidActionHtml = order.payment === 'BANK_TRANSFER' && order.paymentStatus !== 'paid'
    ? `<button class="btn-icon btn-paid-action" data-action="mark-paid" data-id="${escapeAttr(order.orderId)}" title="Xác nhận đã nhận tiền">₫</button>`
    : '';
  const copyActionHtml = order.transferContent
    ? `<button class="btn-icon btn-copy-action" data-action="copy-transfer" data-id="${escapeAttr(order.orderId)}" title="Copy nội dung chuyển khoản">⧉</button>`
    : '';

  return `
    <tr data-order-id="${escapeAttr(order.orderId)}">
      <td>
        <div class="order-code">${escapeHtml(order.orderId)}</div>
        ${transferLine}
      </td>
      <td>
        <div class="table-primary">${escapeHtml(order.customer?.name || 'Khách lẻ')}</div>
        <div class="row-muted">${escapeHtml(order.customer?.phone || 'Không có SĐT')}</div>
        ${compact ? '' : `<div class="row-muted address-line">${escapeHtml(order.customer?.address || '')}</div>`}
        ${compact ? '' : customerNote}
      </td>
      <td>
        <div class="table-primary">${escapeHtml(getProductName(order.productType))}</div>
        <div class="row-muted">${escapeHtml(order.size || 'N/A')} · SL ${Number(order.quantity || 1)} · ${escapeHtml(order.color || '')}</div>
      </td>
      <td>
        <div class="money-cell">${formatMoney(total)}</div>
        <div class="row-muted">${formatMoney(order.price || 0)}/áo</div>
      </td>
      <td>
        <span class="badge ${payment.cls}">${payment.label}</span>
        <span class="badge ${paymentStatus.cls}">${paymentStatus.label}</span>
      </td>
      <td><span class="badge ${status.cls}">${status.label}</span></td>
      <td>
        <div class="table-primary">${dateStr}</div>
        ${paidAt}
      </td>
      <td>
        <div class="action-buttons">
          <button class="btn-icon btn-view-action" data-action="preview" data-id="${escapeAttr(order.orderId)}" title="Xem chi tiết">👁</button>
          ${copyActionHtml}
          ${markPaidActionHtml}
          ${completeActionHtml}
          ${cancelActionHtml}
        </div>
      </td>
    </tr>
  `;
}

function bindRowActions(container) {
  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      const action = btn.dataset.action;
      const orderId = btn.dataset.id;
      if (action === 'complete') updateOrderStatus(orderId, 'completed');
      if (action === 'mark-paid') markOrderPaid(orderId);
      if (action === 'copy-transfer') copyTransferContent(orderId);
      if (action === 'cancel' && confirm('Bạn chắc chắn muốn hủy đơn hàng này?')) {
        updateOrderStatus(orderId, 'cancelled');
      }
      if (action === 'preview') openPreviewModal(orderId);
    });
  });
}

async function markOrderPaid(orderId) {
  const order = adminState.orders.find(item => item.orderId === orderId);
  if (!order) return;
  if (!confirm(`Xác nhận đã nhận ${formatMoney(getOrderTotal(order))} cho đơn ${orderId}?`)) return;

  try {
    const response = await fetch(`${API_ORDERS}/${encodeURIComponent(orderId)}/payment`, {
      method: 'PUT',
      headers: auth.getAuthHeaders(),
      body: JSON.stringify({
        paymentStatus: 'paid',
        receivedAmount: getOrderTotal(order),
        note: 'Admin manual confirmation',
      }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Không thể xác nhận thanh toán.');
    }
    showAdminToast('Đã xác nhận thanh toán.');
    await loadDashboardData();
  } catch (err) {
    console.error('Payment update error:', err);
    showAdminToast(err.message || 'Không thể xác nhận thanh toán.', 'error');
  }
}

async function copyTransferContent(orderId) {
  const order = adminState.orders.find(item => item.orderId === orderId);
  const content = order?.transferContent || orderId;
  try {
    await navigator.clipboard.writeText(content);
    showAdminToast(`Đã copy: ${content}`);
  } catch (err) {
    showAdminToast('Không thể copy nội dung chuyển khoản.', 'error');
  }
}

function exportOrdersCsv() {
  const rows = getFilteredOrders();
  const headers = [
    'orderId',
    'customerName',
    'phone',
    'product',
    'size',
    'quantity',
    'total',
    'payment',
    'paymentStatus',
    'transferContent',
    'status',
    'createdAt',
  ];
  const csv = [
    headers.join(','),
    ...rows.map(order => headers.map(key => csvCell({
      orderId: order.orderId,
      customerName: order.customer?.name || '',
      phone: order.customer?.phone || '',
      product: order.productType || '',
      size: order.size || '',
      quantity: order.quantity || 1,
      total: getOrderTotal(order),
      payment: order.payment || '',
      paymentStatus: order.paymentStatus || '',
      transferContent: order.transferContent || '',
      status: order.status || '',
      createdAt: order.createdAt || '',
    }[key])).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `blankup-orders-${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showAdminToast(`Đã xuất ${rows.length} đơn hàng.`);
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function renderUsersList() {
  console.log('[Admin] renderUsersList called, users:', adminState.users.length);
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) { console.warn('[Admin] #usersTableBody not found'); return; }

  const search = adminState.userSearch;
  const filtered = !search
    ? adminState.users
    : adminState.users.filter(u =>
        (u.username || '').toLowerCase().includes(search) ||
        (u.fullName || '').toLowerCase().includes(search)
      );

  const countEl = document.getElementById('usersResultCount');
  if (countEl) countEl.textContent = `${filtered.length}/${adminState.users.length} người dùng`;

  tbody.innerHTML = filtered.length
    ? filtered.map(user => {
      const isAdmin = user.role === 'admin';
      const isCurrentUser = user.id === auth.user?.id;
      return `
      <tr>
        <td><span class="table-primary">@${escapeHtml(user.username)}</span></td>
        <td><span class="table-primary">${escapeHtml(user.fullName)}</span></td>
        <td>
          <select class="admin-select user-role-select" data-user-id="${escapeAttr(user.id)}" data-current-role="${escapeAttr(user.role)}" ${isCurrentUser ? 'disabled title="Không thể đổi vai trò của chính mình"' : ''}>
            <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
            <option value="admin" ${isAdmin ? 'selected' : ''}>Admin</option>
          </select>
        </td>
        <td>${formatDate(user.createdAt, false)}</td>
        <td class="center-cell">${Number(user.ordersCount || 0)}</td>
        <td><span class="money-cell">${formatMoney(user.totalSpend || 0)}</span></td>
        <td>
          <div class="action-buttons">
            <button class="btn-icon btn-view-action" data-user-detail-id="${escapeAttr(user.id)}" title="Xem chi tiết">👁</button>
            <button class="btn-icon btn-view-action" data-user-edit-id="${escapeAttr(user.id)}" title="Chỉnh sửa">✎</button>
            <button class="btn-icon btn-view-action" data-user-id="${escapeAttr(user.id)}" data-user-label="${escapeAttr(user.fullName || user.username)}" title="Xem đơn hàng">📋</button>
            ${!isCurrentUser && !isAdmin ? `<button class="btn-icon btn-cancel-action" data-user-delete-id="${escapeAttr(user.id)}" data-user-delete-name="${escapeAttr(user.username)}" title="Xóa tài khoản">×</button>` : ''}
          </div>
        </td>
      </tr>
    `}).join('')
    : renderEmptyRow(7, search ? 'Không tìm thấy người dùng khớp.' : 'Chưa có tài khoản người dùng.');

  tbody.querySelectorAll('[data-user-id]:not([data-user-detail-id]):not([data-user-delete-id])').forEach(btn => {
    btn.addEventListener('click', () => {
      viewOrdersForUser({ id: btn.dataset.userId, fullName: btn.dataset.userLabel });
    });
  });

  tbody.querySelectorAll('[data-user-detail-id]').forEach(btn => {
    btn.addEventListener('click', () => openUserDetailModal(btn.dataset.userDetailId));
  });

  tbody.querySelectorAll('[data-user-edit-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const user = adminState.users.find(u => u.id === btn.dataset.userEditId);
      if (user) openUserFormModal(user);
    });
  });

  tbody.querySelectorAll('[data-user-delete-id]').forEach(btn => {
    btn.addEventListener('click', () => confirmDeleteUser(btn.dataset.userDeleteId, btn.dataset.userDeleteName));
  });

  tbody.querySelectorAll('.user-role-select').forEach(select => {
    select.addEventListener('change', async () => {
      const userId = select.dataset.userId;
      const newRole = select.value;
      await updateUserRole(userId, newRole);
    });
  });
}

function renderDesignsGrid() {
  const grid = document.getElementById('designsGrid');
  if (!grid) return;

  const filter = adminState.designVisibilityFilter;
  const filtered = adminState.designs.filter(d => {
    if (filter === 'shared') return d.isShared !== false;
    if (filter === 'hidden') return d.isShared === false;
    return true;
  });

  const countEl = document.getElementById('designsResultCount');
  if (countEl) countEl.textContent = `${filtered.length}/${adminState.designs.length} thiết kế`;

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state">${adminState.designs.length ? 'Không có thiết kế nào khớp bộ lọc.' : 'Chưa có thiết kế AI nào được tạo.'}</div>`;
    return;
  }

  grid.innerHTML = filtered.map(design => {
    const prompt = design.prompt || design.promptEn || 'Không có prompt';
    const previewUrl = design.designUrl || design.frontDesignUrl || '';
    const isHidden = design.isShared === false;
    return `
      <article class="design-item-card ${isHidden ? 'is-hidden' : ''}">
        <div class="design-card-preview">
          ${previewUrl ? `<img src="${escapeAttr(previewUrl)}" alt="${escapeAttr(prompt)}">` : '<span>Không có ảnh</span>'}
          <span class="design-visibility-badge ${isHidden ? 'badge-muted' : 'badge-completed'}">${isHidden ? 'Đã ẩn' : 'Công khai'}</span>
        </div>
        <div class="design-card-details">
          <div class="design-card-prompt">"${escapeHtml(prompt)}"</div>
          <div class="design-card-meta">
            <span>${escapeHtml(design.author || 'Guest')}</span>
            <span>${formatDate(design.createdAt || design.updatedAt || Date.now(), false)}</span>
          </div>
          <button class="btn btn-secondary btn-sm design-visibility-toggle" data-design-id="${escapeAttr(design.id)}" data-next-visible="${isHidden ? 'true' : 'false'}">
            ${isHidden ? 'Hiện lại trên thư viện' : 'Ẩn khỏi thư viện'}
          </button>
        </div>
      </article>
    `;
  }).join('');

  grid.querySelectorAll('.design-visibility-toggle').forEach(btn => {
    btn.addEventListener('click', () => toggleDesignVisibility(btn.dataset.designId, btn.dataset.nextVisible === 'true'));
  });
}

async function toggleDesignVisibility(designId, nextIsShared) {
  try {
    const response = await fetch(`${API_ADMIN}/designs/${encodeURIComponent(designId)}/visibility`, {
      method: 'PUT',
      headers: auth.getAuthHeaders(),
      body: JSON.stringify({ isShared: nextIsShared }),
    });
    const result = await response.json();
    if (!response.ok || result.success === false) {
      throw new Error(result.error || 'Không thể cập nhật trạng thái thiết kế.');
    }
    const index = adminState.designs.findIndex(d => d.id === designId);
    if (index !== -1) adminState.designs[index] = result.data;
    renderDesignsGrid();
    showAdminToast(nextIsShared ? 'Đã hiện lại thiết kế trên thư viện.' : 'Đã ẩn thiết kế khỏi thư viện.');
  } catch (err) {
    showAdminToast(err.message || 'Không thể cập nhật trạng thái thiết kế.', 'error');
  }
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    const response = await fetch(`${API_ORDERS}/${encodeURIComponent(orderId)}/status`, {
      method: 'PUT',
      headers: auth.getAuthHeaders(),
      body: JSON.stringify({ status: newStatus }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Không thể cập nhật đơn hàng.');
    }

    showAdminToast(newStatus === 'completed' ? 'Đã đánh dấu hoàn thành.' : 'Đã cập nhật đơn hàng.');
    await loadDashboardData();
  } catch (err) {
    console.error('Order status error:', err);
    showAdminToast(err.message || 'Lỗi cập nhật đơn hàng.', 'error');
  }
}

function openPreviewModal(orderId) {
  const order = adminState.orders.find(item => item.orderId === orderId);
  if (!order) return;

  adminState.selectedPreviewOrder = order;
  adminState.previewSide = 'front';
  adminState.previewShirtColor = order.color || '#ffffff';

  setText('prev-order-id', order.orderId);
  setText('prev-customer-name', order.customer?.name || 'Khách lẻ');
  setText('prev-customer-contact', order.customer?.phone || 'Không có SĐT');
  setText('prev-customer-address', order.customer?.address || 'Không có địa chỉ');
  setText('prev-customer-note', order.customer?.note || 'Không có ghi chú');
  setText('prev-product-details', `${getProductName(order.productType)} (${order.size || 'N/A'}) · ${formatMoney(order.price || 0)}/áo`);
  setText('prev-quantity', `${Number(order.quantity || 1)} áo · ${formatMoney(getOrderTotal(order))}`);
  setText('prev-author', order.authorName || 'Guest');
  setText('prev-payment', `${PAYMENT_META[order.payment]?.label || order.payment || 'N/A'} · ${PAYMENT_STATUS_META[order.paymentStatus]?.label || order.paymentStatus || 'N/A'}`);
  setText('prev-transfer-content', order.transferContent || 'Không có');
  setText('prev-paid-at', order.paidAt ? formatDate(order.paidAt) : 'Chưa thanh toán');

  syncAdminPreviewSideButtons();
  renderAdminPreviewDesign();
  updateAdminMockupColor();
  document.querySelectorAll('.admin-color-dot').forEach(dot => {
    dot.classList.toggle('active', dot.dataset.color === adminState.previewShirtColor);
  });
  document.getElementById('designPreviewModal')?.classList.add('open');
}

function initPreviewSideToggle() {
  document.querySelectorAll('.admin-side-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      adminState.previewSide = btn.dataset.side || 'front';
      syncAdminPreviewSideButtons();
      renderAdminPreviewDesign();
    });
  });
}

function syncAdminPreviewSideButtons() {
  const order = adminState.selectedPreviewOrder;
  const hasBack = Boolean(order?.backDesignUrl);
  document.querySelectorAll('.admin-side-btn').forEach(btn => {
    const side = btn.dataset.side;
    btn.classList.toggle('active', side === adminState.previewSide);
    btn.disabled = side === 'back' && !hasBack;
  });
}

function renderAdminPreviewDesign() {
  const order = adminState.selectedPreviewOrder;
  const designUrl = getOrderDesignUrl(order, adminState.previewSide);
  const overlay = document.getElementById('mockupDesignAdmin');
  const dlLink = document.getElementById('downloadSvgLink');

  if (overlay) {
    overlay.innerHTML = designUrl
      ? `<img src="${escapeAttr(designUrl)}" alt="Thiết kế in áo">`
      : '<span class="row-muted">Không có thiết kế</span>';
  }

  if (dlLink) {
    dlLink.style.display = designUrl ? 'inline-flex' : 'none';
    if (designUrl) {
      dlLink.href = designUrl;
      dlLink.download = `blankup-${order?.orderId || 'order'}-${adminState.previewSide}.png`;
    }
  }
}

function getOrderDesignUrl(order, side = adminState.previewSide) {
  if (!order) return '';
  const front = order.frontDesignUrl || order.designUrl || '';
  const back = order.backDesignUrl || '';
  return side === 'back' ? (back || front) : front;
}

function initColorDotPreview() {
  document.querySelectorAll('.admin-color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      adminState.previewShirtColor = dot.dataset.color;
      document.querySelectorAll('.admin-color-dot').forEach(item => item.classList.remove('active'));
      dot.classList.add('active');
      updateAdminMockupColor();
    });
  });
}

function initPreviewModalClose() {
  const modal = document.getElementById('designPreviewModal');
  document.getElementById('previewModalClose')?.addEventListener('click', () => modal?.classList.remove('open'));
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) modal.classList.remove('open');
  });
}

function updateAdminMockupColor() {
  const mockup = document.getElementById('mockupTshirtAdmin');
  if (!mockup) return;

  const color = adminState.previewShirtColor;
  const strokeColor = isLightColorAdmin(color) ? '#dbe2ea' : 'rgba(255,255,255,0.24)';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 360">
      <defs>
        <linearGradient id="g-admin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${lightenColorAdmin(color, 12)}"/>
          <stop offset="100%" stop-color="${darkenColorAdmin(color, 10)}"/>
        </linearGradient>
      </defs>
      <path d="M75 50 L30 80 L10 140 L55 150 L65 100 L65 330 L235 330 L235 100 L245 150 L290 140 L270 80 L225 50 L195 65 Q175 80 150 80 Q125 80 105 65 Z" fill="url(#g-admin)" stroke="${strokeColor}" stroke-width="1"/>
      <ellipse cx="150" cy="52" rx="30" ry="15" fill="none" stroke="${strokeColor}" stroke-width="1"/>
    </svg>
  `;
  mockup.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function getPaymentStats(orders) {
  return orders.reduce((acc, order) => {
    const total = getOrderTotal(order);
    if (order.paymentStatus === 'paid') {
      acc.paid += 1;
      acc.paidRevenue += total;
    }
    if (order.paymentStatus === 'awaiting_transfer') {
      acc.awaiting += 1;
      acc.awaitingRevenue += total;
    }
    if (order.paymentStatus === 'underpaid') acc.underpaid += 1;
    return acc;
  }, { paid: 0, awaiting: 0, underpaid: 0, paidRevenue: 0, awaitingRevenue: 0 });
}

function getOrderTotal(order) {
  return Number(order.total || ((order.price || 0) * (order.quantity || 1)));
}

function getProductName(type) {
  return {
    tshirt: 'T-shirt',
    oversize: 'Oversize',
    polo: 'Polo',
    hoodie: 'Hoodie',
  }[type] || type || 'Sản phẩm';
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

function formatDate(value, withTime = true) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('vi-VN', withTime
    ? { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function renderEmptyRow(colspan, message) {
  return `<tr><td colspan="${colspan}" class="empty-table">${escapeHtml(message)}</td></tr>`;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function showAdminToast(message, type = 'success') {
  const toast = document.getElementById('adminToast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `admin-toast show ${type}`;
  clearTimeout(showAdminToast.timer);
  showAdminToast.timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function isLightColorAdmin(hex) {
  if (!hex || hex.length < 7) return true;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

function lightenColorAdmin(hex, percent) {
  const num = parseInt(String(hex).replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, (num >> 16) + amt);
  const g = Math.min(255, ((num >> 8) & 0x00FF) + amt);
  const b = Math.min(255, (num & 0x0000FF) + amt);
  return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
}

function darkenColorAdmin(hex, percent) {
  const num = parseInt(String(hex).replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.max(0, (num >> 16) - amt);
  const g = Math.max(0, ((num >> 8) & 0x00FF) - amt);
  const b = Math.max(0, (num & 0x0000FF) - amt);
  return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
}

async function updateUserRole(userId, newRole) {
  try {
    const response = await fetch(`${API_ADMIN}/users/${encodeURIComponent(userId)}/role`, {
      method: 'PUT',
      headers: auth.getAuthHeaders(),
      body: JSON.stringify({ role: newRole }),
    });
    const result = await response.json();
    if (!response.ok || result.success === false) {
      throw new Error(result.error || 'Không thể cập nhật vai trò.');
    }
    const userIndex = adminState.users.findIndex(u => u.id === userId);
    if (userIndex !== -1) adminState.users[userIndex].role = newRole;
    renderUsersList();
    showAdminToast(`Đã đổi vai trò thành ${newRole}.`);
  } catch (err) {
    showAdminToast(err.message || 'Lỗi cập nhật vai trò.', 'error');
    renderUsersList();
  }
}

async function confirmDeleteUser(userId, username) {
  if (!confirm(`Bạn chắc chắn muốn xóa tài khoản "@${username}"?\nHành động này không thể hoàn tác.`)) return;

  try {
    const response = await fetch(`${API_ADMIN}/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: auth.getAuthHeaders(),
    });
    const result = await response.json();
    if (!response.ok || result.success === false) {
      throw new Error(result.error || 'Không thể xóa tài khoản.');
    }
    adminState.users = adminState.users.filter(u => u.id !== userId);
    renderUsersList();
    showAdminToast(`Đã xóa tài khoản @${username}.`);
  } catch (err) {
    showAdminToast(err.message || 'Lỗi xóa tài khoản.', 'error');
  }
}

async function openUserDetailModal(userId) {
  const modal = document.getElementById('userDetailModal');
  if (!modal) return;

  setText('ud-username', 'Đang tải...');
  setText('ud-fullname', '');
  setText('ud-email', '');
  setText('ud-role', '');
  setText('ud-provider', '');
  setText('ud-registered', '');
  setText('ud-orders-count', '');
  setText('ud-total-spend', '');
  document.getElementById('ud-recent-orders').innerHTML = '<tr><td colspan="5" class="empty-table">Đang tải...</td></tr>';
  modal.classList.add('open');

  try {
    const response = await fetch(`${API_ADMIN}/users/${encodeURIComponent(userId)}`, {
      headers: auth.getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Không thể tải thông tin người dùng.');
    const result = await response.json();
    const user = result.data;

    setText('ud-username', `@${user.username}`);
    setText('ud-fullname', user.fullName || 'N/A');
    setText('ud-email', user.email || 'Chưa cập nhật');
    setText('ud-role', user.role === 'admin' ? 'Admin' : 'User');
    setText('ud-provider', user.provider || 'local');
    setText('ud-registered', formatDate(user.createdAt, true));
    setText('ud-orders-count', user.ordersCount || 0);
    setText('ud-total-spend', formatMoney(user.totalSpend || 0));

    const recentBody = document.getElementById('ud-recent-orders');
    if (recentBody) {
      if (user.recentOrders && user.recentOrders.length) {
        recentBody.innerHTML = user.recentOrders.map(o => {
          const status = STATUS_META[o.status] || { label: o.status || 'N/A', cls: 'badge-muted' };
          return `<tr>
            <td>${escapeHtml(o.orderId)}</td>
            <td>${escapeHtml(o.productType || 'N/A')}</td>
            <td><span class="money-cell">${formatMoney(getOrderTotal(o))}</span></td>
            <td><span class="badge ${status.cls}">${status.label}</span></td>
            <td>${formatDate(o.createdAt, false)}</td>
          </tr>`;
        }).join('');
      } else {
        recentBody.innerHTML = renderEmptyRow(5, 'Chưa có đơn hàng.');
      }
    }
  } catch (err) {
    showAdminToast(err.message || 'Lỗi tải thông tin người dùng.', 'error');
    modal.classList.remove('open');
  }
}

function initUserDetailModalClose() {
  const modal = document.getElementById('userDetailModal');
  document.getElementById('userDetailModalClose')?.addEventListener('click', () => modal?.classList.remove('open'));
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('open');
  });
}

function initUserFormModal() {
  const modal = document.getElementById('userFormModal');
  const form = document.getElementById('userForm');

  document.getElementById('createUserBtn')?.addEventListener('click', () => openUserFormModal());
  document.getElementById('userFormModalClose')?.addEventListener('click', () => modal?.classList.remove('open'));
  document.getElementById('userFormCancel')?.addEventListener('click', () => modal?.classList.remove('open'));
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('open');
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleUserFormSubmit();
  });
}

function openUserFormModal(userData = null) {
  const modal = document.getElementById('userFormModal');
  const title = document.getElementById('userFormTitle');
  const submitBtn = document.getElementById('userFormSubmit');
  const editIdField = document.getElementById('uf-edit-id');
  const usernameField = document.getElementById('uf-username');
  const passwordGroup = document.getElementById('uf-password-group');
  const passwordField = document.getElementById('uf-password');
  const fullnameField = document.getElementById('uf-fullname');
  const emailField = document.getElementById('uf-email');
  const roleField = document.getElementById('uf-role');

  if (userData) {
    title.textContent = 'Chỉnh sửa tài khoản';
    submitBtn.textContent = 'Lưu thay đổi';
    editIdField.value = userData.id || '';
    usernameField.value = userData.username || '';
    usernameField.disabled = true;
    passwordGroup.style.display = 'none';
    passwordField.removeAttribute('required');
    fullnameField.value = userData.fullName || '';
    emailField.value = userData.email || '';
    roleField.value = userData.role || 'user';
  } else {
    title.textContent = 'Tạo tài khoản mới';
    submitBtn.textContent = 'Tạo tài khoản';
    editIdField.value = '';
    usernameField.value = '';
    usernameField.disabled = false;
    passwordGroup.style.display = '';
    passwordField.setAttribute('required', '');
    fullnameField.value = '';
    emailField.value = '';
    roleField.value = 'user';
  }

  modal?.classList.add('open');
  if (!userData) usernameField.focus();
}

async function handleUserFormSubmit() {
  const editId = document.getElementById('uf-edit-id').value;
  const username = document.getElementById('uf-username').value.trim();
  const password = document.getElementById('uf-password').value;
  const fullName = document.getElementById('uf-fullname').value.trim();
  const email = document.getElementById('uf-email').value.trim();
  const role = document.getElementById('uf-role').value;

  if (editId) {
    try {
      const response = await fetch(`${API_ADMIN}/users/${encodeURIComponent(editId)}`, {
        method: 'PUT',
        headers: auth.getAuthHeaders(),
        body: JSON.stringify({ fullName, email, role }),
      });
      const result = await response.json();
      if (!response.ok || result.success === false) throw new Error(result.error || 'Không thể cập nhật.');

      const idx = adminState.users.findIndex(u => u.id === editId);
      if (idx !== -1) {
        adminState.users[idx].fullName = fullName;
        adminState.users[idx].email = email;
        adminState.users[idx].role = role;
      }
      renderUsersList();
      document.getElementById('userFormModal')?.classList.remove('open');
      showAdminToast('Đã cập nhật tài khoản.');
    } catch (err) {
      showAdminToast(err.message || 'Lỗi cập nhật tài khoản.', 'error');
    }
  } else {
    if (!username || !password || !fullName) {
      showAdminToast('Vui lòng điền đầy đủ thông tin bắt buộc.', 'error');
      return;
    }
    try {
      const response = await fetch(`${API_ADMIN}/users`, {
        method: 'POST',
        headers: auth.getAuthHeaders(),
        body: JSON.stringify({ username, password, fullName, email, role }),
      });
      const result = await response.json();
      if (!response.ok || result.success === false) throw new Error(result.error || 'Không thể tạo tài khoản.');

      adminState.users.push(result.data);
      renderUsersList();
      document.getElementById('userFormModal')?.classList.remove('open');
      showAdminToast(`Đã tạo tài khoản @${username}.`);
    } catch (err) {
      showAdminToast(err.message || 'Lỗi tạo tài khoản.', 'error');
    }
  }
}

i18n.onChange(() => renderDashboard());