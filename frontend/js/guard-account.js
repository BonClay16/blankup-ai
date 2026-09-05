// frontend/js/guard-account.js
// Client-side auth gate for account.html. External file (not inline) so the
// Content-Security-Policy (script-src 'self') allows it to run.
// Server-side APIs still enforce authentication; this is UX fast-path only.
(function () {
  var token = localStorage.getItem('blankup_token');
  var userStr = localStorage.getItem('blankup_user');
  if (!token || !userStr) {
    window.location.href = '/login.html';
  }
})();
