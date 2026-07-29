// frontend/js/reset-password.js
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  const formWrap = document.getElementById('resetFormWrap');
  const invalidWrap = document.getElementById('resetInvalidWrap');
  const successWrap = document.getElementById('resetSuccessWrap');

  if (!token) {
    formWrap.style.display = 'none';
    invalidWrap.style.display = 'block';
    return;
  }

  const form = document.getElementById('resetForm');
  const errorMsg = document.getElementById('resetErrorMsg');
  const submitBtn = document.getElementById('resetSubmitBtn');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPassword = document.getElementById('newPasswordInput').value;
    const confirmPassword = document.getElementById('confirmPasswordInput').value;

    errorMsg.style.display = 'none';

    if (newPassword.length < 6) {
      errorMsg.textContent = 'Mật khẩu mới cần ít nhất 6 ký tự.';
      errorMsg.style.display = 'block';
      return;
    }
    if (newPassword !== confirmPassword) {
      errorMsg.textContent = 'Xác nhận mật khẩu mới không khớp.';
      errorMsg.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span>Đang xử lý...</span>';

    try {
      const response = await fetch(`${window.location.origin}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const result = await response.json();

      if (!response.ok || result.success === false) {
        // Expired/invalid token gets its own dedicated screen rather than
        // an inline error — the person can't fix this by retyping anything.
        if (response.status === 400) {
          formWrap.style.display = 'none';
          invalidWrap.style.display = 'block';
          return;
        }
        throw new Error(result.error || 'Đặt lại mật khẩu thất bại.');
      }

      formWrap.style.display = 'none';
      successWrap.style.display = 'block';
    } catch (err) {
      errorMsg.textContent = err.message || 'Đặt lại mật khẩu thất bại. Vui lòng thử lại.';
      errorMsg.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
});