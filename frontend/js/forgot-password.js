// frontend/js/forgot-password.js
document.addEventListener('DOMContentLoaded', () => {
  if (auth.isLoggedIn()) {
    window.location.href = '/account.html';
    return;
  }

  const form = document.getElementById('forgotForm');
  const errorMsg = document.getElementById('forgotErrorMsg');
  const successMsg = document.getElementById('forgotSuccessMsg');
  const submitBtn = document.getElementById('forgotSubmitBtn');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = document.getElementById('identifierInput').value.trim();
    if (!identifier) return;

    errorMsg.style.display = 'none';
    successMsg.style.display = 'none';
    submitBtn.disabled = true;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span>Đang gửi...</span>';

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

      // The backend always returns the same generic message whether or not
      // the account exists — this is intentional (prevents account
      // enumeration), so the UI always shows a success state here.
      successMsg.textContent = result.message;
      successMsg.style.display = 'block';
      form.reset();
    } catch (err) {
      errorMsg.textContent = err.message || 'Không thể gửi yêu cầu. Vui lòng thử lại.';
      errorMsg.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
});