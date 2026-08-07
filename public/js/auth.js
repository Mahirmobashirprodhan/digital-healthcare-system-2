/* ==========================================================================
   User Authentication & State Management Module
   ========================================================================== */

const Auth = {
  tokenKey: 'dh_jwt_token',
  userKey: 'dh_user_data',

  getToken() {
    return localStorage.getItem(this.tokenKey);
  },

  getUser() {
    const raw = localStorage.getItem(this.userKey);
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setAuth(token, user) {
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem(this.userKey, JSON.stringify(user));
    this.updateNavUI();
  },

  logout() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.updateNavUI();
    App.navigateTo('home');
    App.showToast('You have logged out.', 'info');
  },

  async login(email, password) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed.');
      }

      this.setAuth(data.token, data.user);
      App.closeModals();
      App.showToast(`Welcome back, ${data.user.name}!`, 'success');

      // Navigate to respective dashboard
      if (data.user.role === 'patient') App.navigateTo('patient-dashboard');
      else if (data.user.role === 'doctor') App.navigateTo('doctor-dashboard');
      else if (data.user.role === 'admin') App.navigateTo('admin-dashboard');

    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  async register(formData) {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed.');
      }

      this.setAuth(data.token, data.user);
      App.closeModals();
      App.showToast(`Registration successful! Welcome, ${data.user.name}.`, 'success');

      if (data.user.role === 'patient') App.navigateTo('patient-dashboard');
      else if (data.user.role === 'doctor') App.navigateTo('doctor-dashboard');

    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  updateNavUI() {
    const user = this.getUser();
    const navAuthContainer = document.getElementById('nav-auth-container');
    const patientDashLink = document.getElementById('nav-link-patient');
    const doctorDashLink = document.getElementById('nav-link-doctor');
    const adminDashLink = document.getElementById('nav-link-admin');

    // Reset visibility
    if (patientDashLink) patientDashLink.style.display = 'none';
    if (doctorDashLink) doctorDashLink.style.display = 'none';
    if (adminDashLink) adminDashLink.style.display = 'none';

    if (!user) {
      navAuthContainer.innerHTML = `
        <button class="btn btn-secondary btn-sm" onclick="App.openAuthModal('login')">Sign In</button>
        <button class="btn btn-primary btn-sm" onclick="App.openAuthModal('register')">Get Started</button>
      `;
    } else {
      let dashBtn = '';
      if (user.role === 'patient') {
        if (patientDashLink) patientDashLink.style.display = 'block';
        dashBtn = `<button class="btn btn-secondary btn-sm" onclick="App.navigateTo('patient-dashboard')">Patient Dashboard</button>`;
      } else if (user.role === 'doctor') {
        if (doctorDashLink) doctorDashLink.style.display = 'block';
        dashBtn = `<button class="btn btn-secondary btn-sm" onclick="App.navigateTo('doctor-dashboard')">Doctor Portal</button>`;
      } else if (user.role === 'admin') {
        if (adminDashLink) adminDashLink.style.display = 'block';
        dashBtn = `<button class="btn btn-secondary btn-sm" onclick="App.navigateTo('admin-dashboard')">Admin Panel</button>`;
      }

      navAuthContainer.innerHTML = `
        ${dashBtn}
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <img src="${user.profile_image || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80'}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 2px solid var(--accent-blue);">
          <span style="font-weight: 600; font-size: 0.9rem; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${user.name}</span>
          <button class="btn btn-sm btn-rose" onclick="Auth.logout()" title="Logout" style="padding: 0.3rem 0.6rem;">✕</button>
        </div>
      `;
    }
  }
};
