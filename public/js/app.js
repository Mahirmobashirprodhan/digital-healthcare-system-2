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

    // Setup global form listeners
    this.setupListeners();
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('dh_theme', next);
    this.showToast(`Switched to ${next} theme mode.`, 'info');
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
        data.specialization = document.getElementById('reg-specialization').value;
        data.hospital = document.getElementById('reg-hospital').value;
        data.fee = document.getElementById('reg-fee').value;
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
      const labId = document.getElementById('lab-booking-test-id').value;
      const date = document.getElementById('lab-booking-date').value;
      const type = document.getElementById('lab-booking-type').value;
      const address = document.getElementById('lab-booking-address').value;
      const amount = parseFloat(document.getElementById('lab-booking-fee').textContent.replace('৳', '')) || 600;

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
          if (!res.ok) throw new Error(data.error);

          App.showToast('Lab test booked successfully!', 'success');
          App.navigateTo('patient-dashboard');
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

// Initialize App on DOM Load
window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
