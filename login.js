(() => {
  const form = document.querySelector('#login-form');
  const password = document.querySelector('#password');
  const error = document.querySelector('#login-error');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.hidden = true;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Signing in...';
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.value })
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Sign-in failed.');
      }
      window.location.assign('/staff');
    } catch (reason) {
      error.textContent = reason.message || 'Could not sign in. Try again.';
      error.hidden = false;
      password.focus();
      password.select();
    } finally {
      button.disabled = false;
      button.textContent = 'Sign in';
    }
  });
})();