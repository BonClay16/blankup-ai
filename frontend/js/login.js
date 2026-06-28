/**
 * Blankup Dedicated Login Page Logic
 * Integrates with auth.js to handle login/register operations and redirects.
 */

document.addEventListener('DOMContentLoaded', () => {
  // If user is already logged in, redirect them away from login page
  if (auth.isLoggedIn()) {
    redirectAfterLogin();
    return;
  }

  // State
  let isRegisterMode = false;

  const form = document.getElementById('loginForm');
  const title = document.getElementById('loginTitle');
  const fullNameGroup = document.getElementById('fullNameGroup');
  const loginFullName = document.getElementById('loginFullName');
  const submitText = document.getElementById('loginSubmitText');
  const switchPrompt = document.getElementById('loginSwitchPrompt');
  const switchBtn = document.getElementById('loginSwitchBtn');
  const errorMsg = document.getElementById('loginErrorMsg');
  const submitBtn = document.getElementById('loginSubmitBtn');

  // Toggle between Login and Register
  if (switchBtn) {
    switchBtn.addEventListener('click', () => {
      isRegisterMode = !isRegisterMode;
      errorMsg.style.display = 'none';
      form.reset();

      if (isRegisterMode) {
        title.setAttribute('data-i18n', 'auth.modal.registerTitle');
        fullNameGroup.style.display = 'block';
        loginFullName.required = true;
        submitText.setAttribute('data-i18n', 'auth.modal.registerBtn');
        switchPrompt.setAttribute('data-i18n', 'auth.modal.hasAccount');
        switchBtn.setAttribute('data-i18n', 'auth.modal.switchToLogin');
      } else {
        title.setAttribute('data-i18n', 'auth.modal.title');
        fullNameGroup.style.display = 'none';
        loginFullName.required = false;
        submitText.setAttribute('data-i18n', 'auth.modal.loginBtn');
        switchPrompt.setAttribute('data-i18n', 'auth.modal.noAccount');
        switchBtn.setAttribute('data-i18n', 'auth.modal.switchToRegister');
      }

      if (window.i18n && typeof window.i18n.updateDOM === 'function') {
        window.i18n.updateDOM();
      }
    });
  }

  // Handle Form Submission
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = document.getElementById('loginUsername').value.trim();
      const password = document.getElementById('loginPassword').value;

      errorMsg.style.display = 'none';
      submitBtn.disabled = true;

      const origBtnHtml = submitBtn.innerHTML;
      submitBtn.innerHTML = `<span class="spinner" style="display:inline-block; width:16px; height:16px; border:2px solid rgba(255,255,255,0.3); border-radius:50%; border-top-color:#fff; animation:spin 0.8s linear infinite; margin-right:8px; vertical-align:middle;"></span> <span data-i18n="auth.modal.loading">Đang xử lý...</span>`;
      if (window.i18n) window.i18n.updateDOM();

      let result;
      if (isRegisterMode) {
        const fullName = loginFullName.value.trim();
        result = await auth.register(username, password, fullName);
      } else {
        result = await auth.login(username, password);
      }

      submitBtn.disabled = false;
      submitBtn.innerHTML = origBtnHtml;
      if (window.i18n) window.i18n.updateDOM();

      if (result.success) {
        // Update navbar actions and redirect
        auth.updateNavbar();
        redirectAfterLogin();
      } else {
        errorMsg.textContent = result.error;
        errorMsg.style.display = 'block';
      }
    });
  }
});

// Helper function to redirect user after successful login
function redirectAfterLogin() {
  const host = window.location.hostname;
  const isLocalMachine = (host === 'localhost' || host === '127.0.0.1' || host === '::1');
  const redirectTarget = getSafeRedirectTarget();

  if (redirectTarget) {
    window.location.href = redirectTarget;
    return;
  }

  // Admin can ONLY access the dashboard from the server machine (localhost)
  if (auth.isAdmin() && isLocalMachine) {
    window.location.href = '/admin.html';
  } else {
    // Check if we came from another page in the app (like studio.html)
    const referrer = document.referrer;
    if (referrer && referrer.includes(window.location.origin) && !referrer.includes('login.html') && !referrer.includes('admin.html')) {
      window.location.href = referrer;
    } else {
      window.location.href = '/';
    }
  }
}

function getSafeRedirectTarget() {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect');
  if (!redirect) return '';

  try {
    const target = new URL(redirect, window.location.origin);
    if (target.origin !== window.location.origin) return '';
    if (target.pathname.includes('login.html') || target.pathname.includes('admin.html')) return '';
    return target.pathname + target.search + target.hash;
  } catch (_err) {
    return '';
  }
}
