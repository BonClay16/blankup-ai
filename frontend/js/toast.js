// frontend/js/toast.js — shared toast/banner for all pages
// Minimal, dependency-free, accessible. Respects "no corner spam" by using top-center slide-down.
(function () {
  const DURATION = { success: 3200, error: 4200, warning: 3600, info: 2800 };
  const TYPE_CLASS = { success: 'toast--success', error: 'toast--error', warning: 'toast--warning', info: 'toast--info' };

  function getContainer() {
    let c = document.getElementById('toast-container');
    if (c) return c;
    c = document.createElement('div');
    c.id = 'toast-container';
    c.setAttribute('role', 'status');
    c.setAttribute('aria-live', 'polite');
    c.setAttribute('aria-atomic', 'false');
    document.body.appendChild(c);
    return c;
  }

  function iconFor(type) {
    if (type === 'success') return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
    if (type === 'error') return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    if (type === 'warning') return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function showToastImpl(message, typeOrOpts, duration) {
    if (!message) return;
    var type = 'info';
    var dur = null;
    if (typeof typeOrOpts === 'string') type = typeOrOpts;
    else if (typeOrOpts && typeof typeOrOpts === 'object') {
      type = typeOrOpts.type || 'info';
      dur = typeOrOpts.duration;
    }
    if (!TYPE_CLASS[type]) type = 'info';
    if (duration != null) dur = duration;
    if (dur == null) dur = DURATION[type] || 3200;

    var container = getContainer();
    var el = document.createElement('div');
    el.className = 'toast ' + (TYPE_CLASS[type] || '');
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = '<span class="toast-icon" aria-hidden="true">' + iconFor(type) + '</span>'
      + '<span class="toast-msg">' + escapeHtml(message) + '</span>'
      + '<button type="button" class="toast-close" aria-label="Đóng">×</button>';
    var closeBtn = el.querySelector('.toast-close');
    var timer = setTimeout(dismiss, dur);
    function dismiss() {
      clearTimeout(timer);
      el.classList.add('toast--exit');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    }
    closeBtn.addEventListener('click', dismiss);
    el.addEventListener('mouseenter', function () { clearTimeout(timer); });
    el.addEventListener('mouseleave', function () { timer = setTimeout(dismiss, 900); });
    container.appendChild(el);
    // trigger entrance
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { el.classList.add('toast--in'); });
    });
  }

  // Overloads: showToast(msg), showToast(msg, type), showToast(msg, type, duration)
  window.showToast = function (a, b, c) {
    if (typeof a === 'object' && a && a.message) return showToastImpl(a.message, a.type || b, a.duration || c);
    return showToastImpl(a, b, c);
  };
  window.showAdminToast = function (a, b, c) { return window.showToast(a, b, c); };

  // Shared fetch with timeout (used by studio/admin). Safe idempotent GET — caller decides retry.
  window.fetchWithTimeout = function (url, opts, ms) {
    ms = ms || 12000;
    var controller = new AbortController();
    var t = setTimeout(function () { controller.abort(); }, ms);
    var signal = controller.signal;
    var merged = Object.assign({}, opts || {}, { signal: signal });
    return fetch(url, merged).then(function (r) { clearTimeout(t); return r; }, function (e) {
      clearTimeout(t);
      if (e && e.name === 'AbortError') { var err = new Error('Request timed out'); err.name = 'TimeoutError'; throw err; }
      throw e;
    });
  };
})();
