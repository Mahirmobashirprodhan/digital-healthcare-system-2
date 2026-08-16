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

  async upgradeToDoctor() {
    try {
      const res = await fetch('/api/auth/upgrade-doctor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getToken()}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upgrade account.');

      this.setAuth(data.token, data.user);
      App.showToast(data.message, 'success');
      App.navigateTo('doctor-dashboard');
      if (window.DoctorDashboard) DoctorDashboard.loadAllData();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  loginGoogle() {
    // Remove any stale popup
    const existing = document.getElementById('google-signin-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'google-signin-popup';
    popup.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
    `;
    popup.innerHTML = `
      <div style="
        background: #fff; border-radius: 16px; width: 380px; max-width: 95vw;
        box-shadow: 0 24px 64px rgba(0,0,0,0.25); overflow: hidden; font-family: 'Google Sans', Roboto, sans-serif;
      ">
        <!-- Header -->
        <div style="padding: 28px 28px 16px; text-align: center;">
          <svg width="75" height="24" viewBox="0 0 75 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom:12px">
            <path d="M29.64 12.205c0-.639-.057-1.252-.164-1.84H15.3v3.48h8.037a6.871 6.871 0 01-2.98 4.508v3.748h4.826c2.822-2.598 4.457-6.426 4.457-10.896z" fill="#4285F4"/>
            <path d="M15.3 24c4.026 0 7.404-1.332 9.876-3.607l-4.826-3.748c-1.34.896-3.052 1.426-5.05 1.426-3.882 0-7.172-2.622-8.347-6.15H1.984v3.87A14.944 14.944 0 0015.3 24z" fill="#34A853"/>
            <path d="M6.953 11.921a9.025 9.025 0 010-5.762V2.289H1.984a14.944 14.944 0 000 13.422l4.969-3.79z" fill="#FBBC05"/>
            <path d="M15.3 4.77a8.08 8.08 0 015.715 2.235l4.287-4.287C22.698 1.189 19.322 0 15.3 0A14.944 14.944 0 001.984 2.289l4.969 3.87C8.128 2.63 11.418.77 15.3.77z" fill="#EA4335"/>
          </svg>
          <h2 style="font-size:1.25rem; font-weight:600; color:#202124; margin:0 0 4px;">Sign in with Google</h2>
          <p style="font-size:0.85rem; color:#5f6368; margin:0;">Use your Google Account</p>
        </div>
        <!-- Form -->
        <div style="padding: 0 28px 24px;">
          <div style="margin-bottom: 14px;">
            <label style="display:block; font-size:0.8rem; color:#5f6368; margin-bottom:5px;">Email address</label>
            <input id="google-email-input" type="email" placeholder="you@gmail.com"
              style="width:100%; padding: 10px 14px; border: 1.5px solid #dadce0; border-radius: 8px;
                     font-size: 0.95rem; outline: none; box-sizing: border-box;
                     transition: border 0.2s;"
              onfocus="this.style.borderColor='#1a73e8'" onblur="this.style.borderColor='#dadce0'" />
          </div>
          <div style="margin-bottom: 20px;">
            <label style="display:block; font-size:0.8rem; color:#5f6368; margin-bottom:5px;">Display name</label>
            <input id="google-name-input" type="text" placeholder="Your name"
              style="width:100%; padding: 10px 14px; border: 1.5px solid #dadce0; border-radius: 8px;
                     font-size: 0.95rem; outline: none; box-sizing: border-box;
                     transition: border 0.2s;"
              onfocus="this.style.borderColor='#1a73e8'" onblur="this.style.borderColor='#dadce0'" />
          </div>
          <div style="display:flex; gap:10px; justify-content:flex-end;">
            <button onclick="document.getElementById('google-signin-popup').remove()"
              style="padding: 9px 20px; border-radius: 8px; border: none; background: transparent;
                     font-size: 0.9rem; font-weight: 500; color: #1a73e8; cursor: pointer;">
              Cancel
            </button>
            <button id="google-signin-btn"
              onclick="Auth._submitGoogleLogin()"
              style="padding: 9px 20px; border-radius: 8px; border: none; background: #1a73e8;
                     color: #fff; font-size: 0.9rem; font-weight: 500; cursor: pointer;
                     display: flex; align-items: center; gap: 8px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1 14.414l-3.707-3.707 1.414-1.414L11 13.586l5.293-5.293 1.414 1.414L11 16.414z"/>
              </svg>
              Continue
            </button>
          </div>
        </div>
        <div style="padding: 12px 28px; background: #f8f9fa; font-size: 0.75rem; color: #5f6368; border-top: 1px solid #e8eaed;">
          Before using Google Sign-In, read Google's
          <a href="#" style="color:#1a73e8;">Privacy Policy</a> and
          <a href="#" style="color:#1a73e8;">Terms of Service</a>.
        </div>
      </div>
    `;
    document.body.appendChild(popup);
    // Close on backdrop click
    popup.addEventListener('click', e => { if (e.target === popup) popup.remove(); });
    // Auto-focus email
    setTimeout(() => {
      const em = document.getElementById('google-email-input');
      if (em) em.focus();
    }, 100);
    // Enter key submits
    popup.addEventListener('keydown', e => { if (e.key === 'Enter') Auth._submitGoogleLogin(); });
  },

  async _submitGoogleLogin() {
    const emailEl = document.getElementById('google-email-input');
    const nameEl  = document.getElementById('google-name-input');
    const email   = (emailEl?.value || '').trim();
    const name    = (nameEl?.value  || '').trim();

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      emailEl.style.borderColor = '#d93025';
      emailEl.focus();
      return;
    }
    if (!name) {
      nameEl.style.borderColor = '#d93025';
      nameEl.focus();
      return;
    }

    const btn = document.getElementById('google-signin-btn');
    if (btn) { btn.textContent = 'Signing in...'; btn.disabled = true; }

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Google sign-in failed.');

      document.getElementById('google-signin-popup')?.remove();
      App.closeModals();
      this.setAuth(data.token, data.user);
      App.showToast(`Welcome, ${data.user.name}! Signed in via Google.`, 'success');

      if (data.user.role === 'patient')      App.navigateTo('patient-dashboard');
      else if (data.user.role === 'doctor')  App.navigateTo('doctor-dashboard');
      else if (data.user.role === 'admin')   App.navigateTo('admin-dashboard');

    } catch (err) {
      if (btn) { btn.textContent = 'Continue'; btn.disabled = false; }
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
