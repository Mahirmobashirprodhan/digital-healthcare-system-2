/* ==========================================================================
   Core Application Router, State Manager & Event Controller
   ========================================================================== */

const App = {
  currentView: 'home',

  init() {
    Auth.updateNavUI();
    DoctorSearch.fetchDoctors();
    
    // Check theme preference
    const savedTheme = localStorage.getItem('dh_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Setup mobile responsive navbar
    this.setupMobileNav();

    // Setup global form listeners
    this.setupListeners();

    // Initialize page-specific scripts based on pathname
    const path = window.location.pathname;
    if (path.includes('blood-donors')) {
      BloodDonorPage.init();
    } else if (path.includes('home-care')) {
      HomeCarePage.init();
    }
  },

  setupMobileNav() {
    const toggleBtn = document.getElementById('nav-toggle-btn');
    const navLinks = document.getElementById('nav-links');
    if (toggleBtn && navLinks) {
      toggleBtn.addEventListener('click', () => {
        navLinks.classList.toggle('open');
      });
      navLinks.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
          navLinks.classList.remove('open');
        });
      });
    }
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('dh_theme', next);
    // this.showToast(`Switched to ${next} theme mode.`, 'info');
  },

  navigateTo(viewName) {
    const views = document.querySelectorAll('.view-section');
    views.forEach(v => v.classList.remove('active'));

    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
      targetView.classList.add('active');
      this.currentView = viewName;
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Update Nav Link highlighting
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      const activeLink = document.getElementById(`nav-link-${viewName}`);
      if (activeLink) activeLink.classList.add('active');

      // Trigger data loads per view
      if (viewName === 'patient-dashboard') PatientDashboard.loadAllData();
      else if (viewName === 'doctor-dashboard') DoctorDashboard.loadAllData();
      else if (viewName === 'admin-dashboard') AdminDashboard.loadAllData();
      else if (viewName === 'search') DoctorSearch.fetchDoctors();
    }
  },

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
    }
  },

  closeModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  },

  openAuthModal(tab = 'login') {
    const loginTab = document.getElementById('auth-tab-login');
    const regTab = document.getElementById('auth-tab-register');
    const loginForm = document.getElementById('form-login');
    const regForm = document.getElementById('form-register');

    if (tab === 'login') {
      loginTab.classList.add('active');
      regTab.classList.remove('active');
      loginForm.style.display = 'block';
      regForm.style.display = 'none';
    } else {
      regTab.classList.add('active');
      loginTab.classList.remove('active');
      regForm.style.display = 'block';
      loginForm.style.display = 'none';
    }

    this.openModal('modal-auth');
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    else if (type === 'error') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <div>${message}</div>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  setupListeners() {
    // Auth Form Login
    document.getElementById('form-login')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const pwd = document.getElementById('login-password').value;
      Auth.login(email, pwd);
    });

    // Auth Form Register
    document.getElementById('form-register')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const role = document.getElementById('reg-role').value;
      const data = {
        name: document.getElementById('reg-name').value,
        email: document.getElementById('reg-email').value,
        password: document.getElementById('reg-password').value,
        phone: document.getElementById('reg-phone').value,
        role: role
      };
      if (role === 'patient') {
        data.blood_group = document.getElementById('reg-blood-group').value;
        data.age = document.getElementById('reg-age').value;
      } else if (role === 'doctor') {
        data.specialization = document.getElementById('reg-specialization')?.value || 'General Physician';
      }
      Auth.register(data);
    });

    // Appointment Booking Form
    document.getElementById('form-appointment-booking')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const doctorId = document.getElementById('booking-doc-id').value;
      const date = document.getElementById('booking-date').value;
      const timeSlot = document.getElementById('booking-slot').value;
      const symptoms = document.getElementById('booking-symptoms').value;
      const feeText = document.getElementById('booking-doc-fee').textContent.replace('৳', '');
      const fee = parseFloat(feeText) || 1000;

      // Launch Bangladeshi Payment Modal before finalizing
      App.closeModals();
      PaymentSystem.initCheckout(fee, 'Appointment', doctorId, async (paymentInfo) => {
        try {
          const res = await fetch('/api/appointments', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Auth.getToken()}`
            },
            body: JSON.stringify({
              doctor_id: doctorId,
              date,
              time_slot: timeSlot,
              symptoms,
              fee
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Booking failed.');

          App.showToast('Appointment booked & paid successfully!', 'success');
          App.navigateTo('patient-dashboard');

        } catch (err) {
          App.showToast(err.message, 'error');
        }
      });
    });

    // Lab Booking Form
    document.getElementById('form-lab-booking')?.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!Auth.getToken()) {
        App.showToast('Please log in as a patient to book a lab test.', 'error');
        App.closeModals();
        App.openAuthModal('login');
        return;
      }

      const labId   = document.getElementById('lab-booking-test-id').value;
      const date    = document.getElementById('lab-booking-date').value;
      const type    = document.getElementById('lab-booking-type').value;
      const address = document.getElementById('lab-booking-address').value;

      // Read the total fee (already updated by onchange handlers, includes +৳200 if home)
      const feeEl  = document.getElementById('lab-booking-fee');
      const amount = parseFloat(feeEl.textContent.replace('৳', '').replace(',', '')) || 600;

      if (!date) {
        App.showToast('Please select a booking date.', 'error');
        return;
      }
      if (!address.trim()) {
        App.showToast('Please enter a collection address.', 'error');
        return;
      }

      App.closeModals();

      PaymentSystem.initCheckout(amount, 'LabTest', labId, async () => {
        try {
          const res = await fetch('/api/labs/book', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Auth.getToken()}`
            },
            body: JSON.stringify({
              lab_test_id: labId,
              booking_date: date,
              sample_collection_type: type,
              address: address,
              amount: amount
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Booking failed.');

          App.showToast('🧪 Lab test booked successfully!', 'success');

          // Reload lab bookings panel and switch to My Bookings tab
          if (window.PatientDashboard) {
            PatientDashboard.loadLabBookings();
            setTimeout(() => PatientDashboard.toggleLabView('bookings'), 300);
            document.getElementById('panel-lab-tests')?.scrollIntoView({ behavior: 'smooth' });
          }

        } catch (err) {
          App.showToast(err.message, 'error');
        }
      });
    });

    // Home Service Form
    document.getElementById('form-home-service')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const serviceType = document.getElementById('hs-service-type').value;
      const date = document.getElementById('hs-date').value;
      const phone = document.getElementById('hs-phone').value;
      const address = document.getElementById('hs-address').value;

      try {
        const res = await fetch('/api/home-services/request', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Auth.getToken()}`
          },
          body: JSON.stringify({ service_type: serviceType, schedule_date: date, phone, address, amount: 1500.0 })
        });
        const data = await res.json();
        App.showToast(data.message, 'success');
        App.closeModals();
        App.navigateTo('patient-dashboard');
      } catch (err) {
        App.showToast(err.message, 'error');
      }
    });

    // Blood Donor Registration Form
    document.getElementById('form-blood-donor')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = {
        name: document.getElementById('donor-name').value,
        blood_group: document.getElementById('donor-bg').value,
        city: document.getElementById('donor-city').value,
        area: document.getElementById('donor-area').value,
        phone: document.getElementById('donor-phone').value,
        last_donated: document.getElementById('donor-last-donated').value
      };
      try {
        const res = await fetch('/api/blood-donors/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        App.showToast(data.message, 'success');
        App.closeModals();
      } catch (err) {
        App.showToast(err.message, 'error');
      }
    });

    // Medicine Reminder Form
    document.getElementById('form-add-reminder')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = {
        medicine_name: document.getElementById('rem-med-name').value,
        dosage: document.getElementById('rem-dosage').value,
        time_slot: document.getElementById('rem-time').value,
        frequency: document.getElementById('rem-freq').value
      };
      try {
        const res = await fetch('/api/reminders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Auth.getToken()}`
          },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        App.showToast(data.message, 'success');
        App.closeModals();
        PatientDashboard.loadReminders();
      } catch (err) {
        App.showToast(err.message, 'error');
      }
    });

    // Doctor Review Form
    document.getElementById('form-review')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const docId = document.getElementById('review-doc-id').value;
      const rating = document.getElementById('review-rating').value;
      const comment = document.getElementById('review-comment').value;

      try {
        const res = await fetch('/api/reviews', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Auth.getToken()}`
          },
          body: JSON.stringify({ doctor_id: docId, rating: parseInt(rating), comment })
        });
        const data = await res.json();
        App.showToast(data.message, 'success');
        App.closeModals();
      } catch (err) {
        App.showToast(err.message, 'error');
      }
    });
  }
};

/* ==========================================================================
   Blood Donor Dedicated Page Controller
   ========================================================================== */
const BloodDonorPage = {
  init() {
    this.searchDonors();
    this.setupListeners();
  },

  async searchDonors() {
    const groupEl = document.getElementById('page-bd-search-group');
    const cityEl = document.getElementById('page-bd-search-city');
    const resultsContainer = document.getElementById('page-blood-donors-results');
    const badgeEl = document.getElementById('donor-count-badge');

    if (!resultsContainer) return;

    const group = groupEl ? groupEl.value : '';
    const city = cityEl ? cityEl.value : '';

    resultsContainer.innerHTML = '<div style="color: var(--text-muted); grid-column: 1/-1;">Searching blood donors database...</div>';

    try {
      const res = await fetch(`/api/blood-donors?blood_group=${encodeURIComponent(group)}&city=${encodeURIComponent(city)}`);
      const data = await res.json();
      const donors = data.donors || [];

      if (badgeEl) {
        badgeEl.textContent = `${donors.length} Donors Found`;
      }

      if (donors.length === 0) {
        resultsContainer.innerHTML = `
          <div style="grid-column: 1/-1; background: var(--bg-secondary); border: 1px dashed var(--border-color); padding: 2rem; border-radius: var(--radius-md); text-align: center;">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">🩸</div>
            <h4 style="font-size: 1.1rem; margin-bottom: 0.5rem;">No Donors Found</h4>
            <p style="color: var(--text-secondary); font-size: 0.9rem;">No active donors matched your criteria. Be the first to register as a voluntary donor!</p>
          </div>
        `;
        return;
      }

      resultsContainer.innerHTML = donors.map(donor => `
        <div class="blood-donor-card">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
              <strong style="font-size: 1.1rem;">${donor.name}</strong>
              <span class="badge badge-rejected">${donor.blood_group}</span>
            </div>
            <div style="font-size: 0.85rem; color: var(--text-secondary);">
              📍 ${donor.area ? donor.area + ', ' : ''}${donor.city}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
              Last Donated: ${donor.last_donated || 'Never'}
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 0.4rem; background: var(--bg-secondary); padding: 0.4rem 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); font-weight: 600; font-size: 0.9rem; color: var(--text-primary);">
            <span>📞</span> <span>${donor.phone}</span>
          </div>
        </div>
      `).join('');
    } catch (err) {
      if (resultsContainer) {
        resultsContainer.innerHTML = `<div style="color: var(--accent-rose); grid-column: 1/-1;">Error loading donor list: ${err.message}</div>`;
      }
    }
  },

  setupListeners() {
    const form = document.getElementById('page-form-blood-donor');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          name: document.getElementById('page-donor-name').value,
          blood_group: document.getElementById('page-donor-group').value,
          city: document.getElementById('page-donor-city').value,
          area: document.getElementById('page-donor-area').value,
          phone: document.getElementById('page-donor-phone').value,
          last_donated: document.getElementById('page-donor-last-date').value || 'Never'
        };

        try {
          const res = await fetch('/api/blood-donors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to register');
          App.showToast(data.message || 'Voluntary donor registration successful!', 'success');
          form.reset();
          this.searchDonors();
        } catch (err) {
          App.showToast(err.message, 'error');
        }
      });
    }
  }
};

/* ==========================================================================
   Home Care Dedicated Page Controller
   ========================================================================== */
const HomeCarePage = {
  init() {
    this.loadUserRequests();
    this.setupListeners();
  },

  async loadUserRequests() {
    const container = document.getElementById('page-home-requests-list');
    if (!container) return;

    const user = Auth.getUser();
    if (!user) {
      container.innerHTML = `
        <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem; text-align: center;">
          <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem;">Log in as a patient to view your home care request history and tracking.</p>
          <button class="btn btn-primary btn-sm" onclick="App.openAuthModal('login')">🔑 Log In to Account</button>
        </div>
      `;
      return;
    }

    container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem;">Fetching your requests...</div>';

    try {
      const res = await fetch('/api/home-services/my-requests', {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
      });
      const data = await res.json();
      const requests = data.requests || [];

      if (requests.length === 0) {
        container.innerHTML = `
          <div style="background: var(--bg-primary); border: 1px dashed var(--border-color); padding: 1.25rem; border-radius: var(--radius-md); text-align: center; color: var(--text-muted); font-size: 0.9rem;">
            You have no home care requests yet. Submit a request using the form on the left!
          </div>
        `;
        return;
      }

      container.innerHTML = requests.map(req => `
        <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 0.75rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.4rem;">
            <strong style="font-size: 0.95rem;">${req.service_type}</strong>
            <span class="badge badge-pending">${req.status || 'Pending'}</span>
          </div>
          <div style="font-size: 0.85rem; color: var(--text-secondary);">
            📅 Scheduled: ${req.schedule_date} • 📞 ${req.phone}
          </div>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
            📍 ${req.address}
          </div>
        </div>
      `).join('');
    } catch (err) {
      container.innerHTML = `<div style="color: var(--accent-rose); font-size: 0.9rem;">Error fetching requests: ${err.message}</div>`;
    }
  },

  setupListeners() {
    const form = document.getElementById('page-form-home-service');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = Auth.getUser();
        if (!user) {
          App.showToast('Please log in to submit a home healthcare request.', 'error');
          App.openAuthModal('login');
          return;
        }

        const payload = {
          service_type: document.getElementById('page-hs-service-type').value,
          schedule_date: document.getElementById('page-hs-date').value,
          phone: document.getElementById('page-hs-phone').value,
          address: document.getElementById('page-hs-address').value,
          notes: document.getElementById('page-hs-notes')?.value || '',
          amount: 1500.0
        };

        try {
          const res = await fetch('/api/home-services/request', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Auth.getToken()}`
            },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to submit request');
          App.showToast(data.message || 'Home healthcare request submitted successfully!', 'success');
          form.reset();
          this.loadUserRequests();
        } catch (err) {
          App.showToast(err.message, 'error');
        }
      });
    }
  }
};

// Initialize App on DOM Load
window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
