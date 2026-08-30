// frontend/js/forgot-password.js
/**
 * Forgot Password Flow — OTP-based (BlankUp)
 *
 * Step 1: User enters email/username → POST /api/auth/forgot-password → OTP sent
 * Step 2: User enters 6-digit OTP → POST /api/auth/verify-forgot-otp → resetToken received
 * Step 3: User enters new password → POST /api/auth/reset-password → success → redirect to login
 */
document.addEventListener('DOMContentLoaded', () => {
  if (auth.isLoggedIn()) {
    window.location.href = '/account.html';
    return;
  }

  // --- State ---
  let forgotIdentifier = '';
  let resetToken = '';
  let otpCountdown = null;

  // --- Step 1: Request OTP ---
  const requestForm = document.getElementById('forgotForm');
  const requestError = document.getElementById('forgotErrorMsg');
  const requestSuccess = document.getElementById('forgotSuccessMsg');
  const requestBtn = document.getElementById('forgotSubmitBtn');

  // --- Step 2: Verify OTP ---
  const otpSection = document.getElementById('otpSection');
  const otpForm = document.getElementById('otpForm');
  const otpInput = document.getElementById('otpCodeInput');
  const otpError = document.getElementById('otpErrorMsg');
  const otpSuccess = document.getElementById('otpSuccessMsg');
  const otpBtn = document.getElementById('otpSubmitBtn');
  const otpResendBtn = document.getElementById('otpResendBtn');
  const otpCountdownEl = document.getElementById('otpCountdown');
  const otpHint = document.getElementById('otpHint');

  // --- Step 3: Reset Password ---
  const resetSection = document.getElementById('resetSection');
  const resetForm = document.getElementById('resetForm');
  const resetError = document.getElementById('resetErrorMsg');
  const resetSuccess = document.getElementById('resetSuccessMsg');
  const resetBtn = document.getElementById('resetSubmitBtn');

  // --- Error states ---
  const invalidSection = document.getElementById('resetInvalidWrap');

  // ========== Step 1: Request OTP ==========
  requestForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = document.getElementById('identifierInput').value.trim();
    if (!identifier) return;

    requestError.style.display = 'none';
    requestSuccess.style.display = 'none';
    requestBtn.disabled = true;
    const originalText = requestBtn.innerHTML;
    requestBtn.innerHTML = '<span>Đang gửi...</span>';

    try {
      const response = await fetch(`${window.location.origin}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Không thể gửi yêu cầu. Vui lòng thử lại.');
      }

      forgotIdentifier = identifier;
      requestSuccess.textContent = result.message;
      requestSuccess.style.display = 'block';
      requestForm.reset();

      // Move to OTP step
      setTimeout(() => {
        requestForm.closest('.login-card')?.querySelector('.login-card-header')?.style && (requestForm.closest('.login-card').querySelector('.login-card-header').style.display = 'none');
        requestForm.style.display = 'none';
        otpSection.style.display = 'block';
        if (otpHint) otpHint.textContent = `Mã xác thực đã gửi đến ${identifier}`;
        startOtpCountdown();
        otpInput?.focus();
      }, 1000);
    } catch (err) {
      requestError.textContent = err.message || 'Không thể gửi yêu cầu. Vui lòng thử lại.';
      requestError.style.display = 'block';
    } finally {
      requestBtn.disabled = false;
      requestBtn.innerHTML = originalText;
    }
  });

  // ========== Step 2: Verify OTP ==========
  otpForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = otpInput?.value?.trim();
    if (!code || code.length !== 6) {
      otpError.textContent = 'Vui lòng nhập đúng 6 chữ số.';
      otpError.style.display = 'block';
      return;
    }

    otpError.style.display = 'none';
    otpSuccess.style.display = 'none';
    otpBtn.disabled = true;
    const originalText = otpBtn.innerHTML;
    otpBtn.innerHTML = '<span>Đang xác nhận...</span>';

    try {
      const response = await fetch(`${window.location.origin}/api/auth/verify-forgot-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: forgotIdentifier, code }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Xác thực thất bại.');
      }

      resetToken = result.resetToken;

      // Move to reset password step
      otpSection.style.display = 'none';
      resetSection.style.display = 'block';
      document.getElementById('newPasswordInput')?.focus();
    } catch (err) {
      otpError.textContent = err.message || 'Xác thực thất bại. Vui lòng thử lại.';
      otpError.style.display = 'block';
    } finally {
      otpBtn.disabled = false;
      otpBtn.innerHTML = originalText;
    }
  });

  // Resend OTP
  otpResendBtn?.addEventListener('click', async () => {
    otpResendBtn.disabled = true;
    otpResendBtn.textContent = 'Đang gửi...';
    try {
      const response = await fetch(`${window.location.origin}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: forgotIdentifier }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      startOtpCountdown();
      otpError.style.display = 'none';
    } catch (err) {
      otpError.textContent = err.message || 'Không thể gửi lại mã.';
      otpError.style.display = 'block';
    } finally {
      otpResendBtn.disabled = false;
      otpResendBtn.textContent = 'Gửi lại mã';
    }
  });

  // Auto-submit when 6 digits entered
  otpInput?.addEventListener('input', () => {
    otpInput.value = otpInput.value.replace(/[^0-9]/g, '').slice(0, 6);
    if (otpInput.value.length === 6) {
      otpForm.dispatchEvent(new Event('submit'));
    }
  });

  // ========== Step 3: Reset Password ==========
  resetForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPassword = document.getElementById('newPasswordInput')?.value;
    const confirmPassword = document.getElementById('confirmPasswordInput')?.value;

    resetError.style.display = 'none';
    resetSuccess.style.display = 'none';

    if (!newPassword || newPassword.length < 8) {
      resetError.textContent = 'Mật khẩu mới cần ít nhất 8 ký tự.';
      resetError.style.display = 'block';
      return;
    }
    if (newPassword !== confirmPassword) {
      resetError.textContent = 'Xác nhận mật khẩu mới không khớp.';
      resetError.style.display = 'block';
      return;
    }

    resetBtn.disabled = true;
    const originalText = resetBtn.innerHTML;
    resetBtn.innerHTML = '<span>Đang xử lý...</span>';

    try {
      const response = await fetch(`${window.location.origin}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, newPassword }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Đặt lại mật khẩu thất bại.');
      }

      // Success
      resetSection.style.display = 'none';
      resetSuccess.style.display = 'block';
      resetSuccess.innerHTML = `
        <div class="login-card-header">
          <h2>Đặt lại mật khẩu thành công!</h2>
          <p>Bạn có thể đăng nhập ngay bằng mật khẩu mới.</p>
        </div>
        <a href="login.html" class="btn btn-primary btn-lg" style="width: 100%; display:flex; justify-content:center;">Đăng nhập ngay</a>
      `;
    } catch (err) {
      resetError.textContent = err.message || 'Đặt lại mật khẩu thất bại. Vui lòng thử lại.';
      resetError.style.display = 'block';
    } finally {
      resetBtn.disabled = false;
      resetBtn.innerHTML = originalText;
    }
  });

  // ========== OTP Countdown ==========
  function startOtpCountdown() {
    let seconds = 120; // 2 minutes
    if (otpCountdownEl) otpCountdownEl.textContent = `Gửi lại sau ${seconds}s`;
    if (otpResendBtn) otpResendBtn.disabled = true;

    clearInterval(otpCountdown);
    otpCountdown = setInterval(() => {
      seconds--;
      if (otpCountdownEl) otpCountdownEl.textContent = `Gửi lại sau ${seconds}s`;
      if (seconds <= 0) {
        clearInterval(otpCountdown);
        if (otpCountdownEl) otpCountdownEl.textContent = '';
        if (otpResendBtn) otpResendBtn.disabled = false;
      }
    }, 1000);
  }
});
