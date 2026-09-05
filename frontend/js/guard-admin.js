// frontend/js/guard-admin.js
// Client-side admin gate for admin.html. External file (not inline) so the
// Content-Security-Policy (script-src 'self') allows it to run.
// Server-side /api/admin/* still enforces requireAdmin; this is UX only.
(function () {
  var token = localStorage.getItem('blankup_token');
  var userStr = localStorage.getItem('blankup_user');
  var isAdmin = false;
  if (token && userStr) {
    try {
      var user = JSON.parse(userStr);
      isAdmin = user.role === 'admin';
    } catch (e) {}
  }
  if (!isAdmin) {
    document.write('<div style="display:flex;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.55);backdrop-filter:blur(6px);align-items:center;justify-content:center;padding:20px;"><div style="background:#fff;border-radius:20px;max-width:400px;width:100%;overflow:hidden;box-shadow:0 25px 60px rgba(0,0,0,0.25);text-align:center;"><div style="padding:40px 32px 0;"><div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#dc2626,#ef4444);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;box-shadow:0 8px 24px rgba(220,38,38,0.3);"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div><h3 style="font-size:1.35rem;font-weight:800;margin:0 0 10px;color:#1a1a2e;">Truy cập bị từ chối</h3><p style="font-size:0.95rem;color:#64748b;margin:0;">Bạn cần đăng nhập bằng tài khoản <strong>Admin</strong> để truy cập trang này.</p></div><div style="padding:24px 32px 32px;"><a href="/login.html" style="display:block;padding:14px 24px;border-radius:12px;background:linear-gradient(135deg,#ff6b00,#e65c00);color:#fff;font-weight:700;font-size:1rem;text-decoration:none;text-align:center;">Đăng nhập lại</a></div></div></div>');
    document.close();
  }
})();
