/* ==========================================================================
   Patient Portal & Dashboard Operations
   ========================================================================== */

const PatientDashboard = {
  profileData: null,

  async loadAllData() {
    const user = Auth.getUser();
    if (!user || user.role !== 'patient') return;

    this.loadPatientProfile();
    this.loadAppointments();
    this.loadPrescriptions();
    this.loadMedicalRecords(user.id);
    this.loadReminders();
    this.loadLabBookings();
    this.loadLabCatalogue();
    this.loadHomeServices();
  },

  toggleLabView(view) {
    const bookingsView  = document.getElementById('lab-view-bookings');
    const catalogueView = document.getElementById('lab-view-catalogue');
    const tabBookings   = document.getElementById('lab-tab-bookings');
    const tabCatalogue  = document.getElementById('lab-tab-catalogue');

    if (view === 'catalogue') {
      if (bookingsView)  bookingsView.style.display  = 'none';
      if (catalogueView) catalogueView.style.display = 'block';
      if (tabBookings)  { tabBookings.className  = 'btn btn-secondary btn-sm'; }
      if (tabCatalogue) { tabCatalogue.className = 'btn btn-primary btn-sm'; }
    } else {
      if (bookingsView)  bookingsView.style.display  = 'block';
      if (catalogueView) catalogueView.style.display = 'none';
      if (tabBookings)  { tabBookings.className  = 'btn btn-primary btn-sm'; }
      if (tabCatalogue) { tabCatalogue.className = 'btn btn-secondary btn-sm'; }
    }
  },

  async loadLabCatalogue() {
    const grid = document.getElementById('lab-catalogue-grid');
    if (!grid) return;
    grid.innerHTML = `<p style="color:var(--text-muted);">Loading available tests...</p>`;
    try {
      const res = await fetch('/api/labs');
      const data = await res.json();
      const tests = data.tests || [];

      if (tests.length === 0) {
        grid.innerHTML = `<p style="color:var(--text-muted);">No lab tests available.</p>`;
        return;
      }

      const deptColors = {
        'Hematology':    '#e2136e',
        'Biochemistry':  '#0ea5e9',
        'Endocrinology': '#8c3494',
        'Radiology':     '#f7921e',
        'Hormone':       '#f59e0b',
        'Nephrology':    '#10b981',
      };

      grid.innerHTML = tests.map(t => {
        const color = deptColors[t.department] || '#0ea5e9';
        return `
          <div style="background:var(--bg-primary); border:1px solid var(--border-color);
                      border-radius:var(--radius-md); padding:1.25rem; position:relative;
                      border-top: 3px solid ${color};">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
              <strong style="font-size:0.95rem;">${t.title}</strong>
              <span style="background:${color}20; color:${color}; font-size:0.72rem;
                           padding:2px 8px; border-radius:20px; white-space:nowrap; margin-left:0.5rem;">
                ${t.department}
              </span>
            </div>
            <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.75rem; line-height:1.5;">
              ${t.description || ''}
            </p>
            <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.75rem;">
              🧫 Sample: <strong>${t.sample_type}</strong> &nbsp;|&nbsp;
              ⏱ Result: <strong>${t.turnaround_time}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="font-size:1.1rem; color:var(--accent-emerald);">৳${t.price}</strong>
              <button class="btn btn-primary btn-sm"
                onclick="PatientDashboard.openLabBookingForm(${t.id}, '${t.title.replace(/'/g,"\\'")}', ${t.price})">
                Book Now
              </button>
            </div>
          </div>`;
      }).join('');

    } catch (err) {
      console.error(err);
      grid.innerHTML = `<p style="color:var(--text-muted);">Could not load lab tests.</p>`;
    }
  },

  openLabBookingForm(testId, testTitle, price) {
    const sel    = document.getElementById('lab-booking-test-id');
    const feeEl  = document.getElementById('lab-booking-fee');
    const typeEl = document.getElementById('lab-booking-type');
    const noteEl = document.getElementById('lab-home-extra-note');

    // Pre-select the test and reset collection type to Lab Visit
    if (sel)    sel.value = testId;
    if (typeEl) typeEl.value = 'Lab Visit';
    if (noteEl) noteEl.style.display = 'none';

    // Set base fee and display
    if (feeEl) {
      feeEl.dataset.base = price;
      feeEl.textContent  = '৳' + price;
    }

    // Update modal title
    const titleEl = document.querySelector('#modal-lab-booking .modal-title');
    if (titleEl) titleEl.textContent = '🧪 Book: ' + testTitle;

    App.openModal('modal-lab-booking');
  },

  async loadPatientProfile() {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
      });
      const data = await res.json();
      if (!res.ok) return;

      this.profileData = data.user;
      const u = data.user;
      const p = u.patient_info || {};

      const elName = document.getElementById('p-dash-name');
      const elDetails = document.getElementById('p-dash-details');

      if (elName) elName.textContent = u.name || 'Patient';
      if (elDetails) {
        elDetails.innerHTML = `Blood Group: <strong style="color: var(--accent-rose);">${p.blood_group || 'A+'}</strong> | Age: ${p.age || 30}`;
      }
    } catch (err) {
      console.error(err);
    }
  },

  async openProfileModal() {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
      });
      const data = await res.json();
      const u = data.user || Auth.getUser();
      const p = u.patient_info || {};

      document.getElementById('pat-edit-name').value = u.name || '';
      document.getElementById('pat-edit-phone').value = u.phone || '';
      document.getElementById('pat-edit-age').value = p.age || 30;
      document.getElementById('pat-edit-gender').value = p.gender || 'Male';
      document.getElementById('pat-edit-bg').value = p.blood_group || 'O+';
      document.getElementById('pat-edit-emergency').value = p.emergency_contact || '';
      document.getElementById('pat-edit-address').value = p.address || '';

      App.openModal('modal-patient-profile');
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  async submitProfile(e) {
    e.preventDefault();
    const name = document.getElementById('pat-edit-name').value;
    const phone = document.getElementById('pat-edit-phone').value;
    const age = parseInt(document.getElementById('pat-edit-age').value) || 30;
    const gender = document.getElementById('pat-edit-gender').value;
    const blood_group = document.getElementById('pat-edit-bg').value;
    const emergency_contact = document.getElementById('pat-edit-emergency').value;
    const address = document.getElementById('pat-edit-address').value;

    try {
      const res = await fetch('/api/patient/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Auth.getToken()}`
        },
        body: JSON.stringify({
          name, phone, age, gender, blood_group, emergency_contact, address
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile.');

      const currentUser = Auth.getUser();
      if (currentUser && name) {
        currentUser.name = name;
        localStorage.setItem(Auth.userKey, JSON.stringify(currentUser));
        Auth.updateNavUI();
      }

      App.showToast(data.message, 'success');
      App.closeModals();
      this.loadPatientProfile();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  async loadAppointments() {
    try {
      const res = await fetch('/api/appointments/patient', {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
      });
      const data = await res.json();
      const appts = data.appointments || [];

      const tbody = document.getElementById('patient-appointments-list');
      if (!tbody) return;

      if (appts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No appointment records found. Book your first consultation above!</td></tr>`;
        return;
      }

      tbody.innerHTML = appts.map(a => {
        // Payment badge
        let payBadge = '';
        if (a.payment_status === 'Paid') {
          payBadge = `<span class="badge badge-confirmed" title="Payment received">✓ Paid</span>`;
        } else if (a.payment_status === 'Refunded') {
          payBadge = `<span class="badge badge-cancelled" title="Payment refunded">💰 Refunded</span>`;
        } else {
          payBadge = `<span class="badge badge-pending">⏳ Unpaid</span>`;
        }

        // Actions
        let actions = '';
        if (a.status === 'Confirmed') {
          actions = `
            <button class="btn btn-emerald btn-sm" onclick="VideoConsult.startCall('${a.doctor_name.replace(/'/g, "\\'")  }', 'Doctor', ${a.id})">🎥 Join Video Consult</button>
            <button class="btn btn-rose btn-sm" onclick="PatientDashboard.cancelAppointment(${a.id})">✕ Cancel</button>
          `;
        } else if (a.status === 'Pending') {
          actions = `<button class="btn btn-rose btn-sm" onclick="PatientDashboard.cancelAppointment(${a.id})">✕ Cancel</button>`;
        } else if (a.status === 'Completed') {
          actions = `<button class="btn btn-secondary btn-sm" onclick="PatientDashboard.openReviewModal(${a.doctor_id})">&#11088; Review</button>`;
        }

        return `
        <tr>
          <td>
            <div style="font-weight: 600;">${a.doctor_name}</div>
            <div style="font-size: 0.8rem; color: var(--accent-blue);">${a.specialization}</div>
          </td>
          <td>${a.date}<br><small style="color: var(--text-secondary);">${a.time_slot}</small></td>
          <td>৳${a.fee}</td>
          <td><span class="badge badge-${a.status.toLowerCase()}">${a.status}</span></td>
          <td>${payBadge}</td>
          <td>${a.symptoms || 'General Checkup'}</td>
          <td>${actions}</td>
        </tr>`;
      }).join('');

    } catch (err) {
      console.error(err);
    }
  },

  async cancelAppointment(apptId) {
    if (!confirm('Are you sure you want to cancel this appointment? If already paid, a refund will be processed automatically.')) return;
    try {
      const res = await fetch(`/api/appointments/${apptId}/cancel`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not cancel appointment.');
      App.showToast(data.message + (data.refunded ? ' Your payment has been refunded.' : ''), 'success');
      this.loadAppointments();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  async loadPrescriptions() {
    try {
      const res = await fetch('/api/prescriptions/patient', {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
      });
      const data = await res.json();
      const rxList = data.prescriptions || [];

      const container = document.getElementById('patient-prescriptions-list');
      if (!container) return;

      if (rxList.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted);">No digital prescriptions received yet.</p>`;
        return;
      }

      container.innerHTML = rxList.map(rx => `
        <div class="prescription-card">
          <div class="rx-header">
            <div>
              <strong style="font-size: 1.1rem; color: var(--accent-blue);">${rx.doctor_name}</strong>
              <div style="font-size: 0.85rem; color: var(--text-secondary);">${rx.specialization} — ${rx.hospital}</div>
            </div>
            <button class="btn btn-primary btn-sm" onclick='PDFGenerator.generatePrescriptionPDF(${JSON.stringify(rx).replace(/'/g, "&apos;")})'>
              📄 Download PDF
            </button>
          </div>
          <div style="margin-bottom: 0.75rem;">
            <strong>Diagnosis:</strong> ${rx.diagnosis}
          </div>
          <table class="data-table" style="font-size: 0.85rem; margin-bottom: 0.75rem;">
            <thead>
              <tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th></tr>
            </thead>
            <tbody>
              ${(rx.medicines || []).map(m => `
                <tr>
                  <td><strong>${m.name}</strong></td>
                  <td>${m.dosage}</td>
                  <td>${m.frequency}</td>
                  <td>${m.duration}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${rx.instructions ? `<div style="font-size: 0.85rem; background: var(--bg-primary); padding: 0.6rem; border-radius: var(--radius-sm); color: var(--text-secondary);"><strong>Advice:</strong> ${rx.instructions}</div>` : ''}
        </div>
      `).join('');

    } catch (err) {
      console.error(err);
    }
  },

  async loadMedicalRecords(patientId) {
    try {
      const res = await fetch(`/api/medical-records/patient/${patientId}`, {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
      });
      const data = await res.json();
      const records = data.records || [];

      const container = document.getElementById('patient-medical-timeline');
      if (!container) return;

      if (records.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted);">No medical records logged.</p>`;
        return;
      }

      container.innerHTML = records.map(r => `
        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <div style="background: var(--bg-primary); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div style="display: flex; justify-content: space-between;">
              <strong style="font-size: 1.05rem;">${r.title}</strong>
              <span class="badge badge-patient">${r.record_type}</span>
            </div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin: 0.3rem 0;">Attending Doctor: ${r.doctor_name || 'Consultant'} • Date: ${r.date}</div>
            <p style="font-size: 0.9rem; color: var(--text-primary);">${r.notes}</p>
          </div>
        </div>
      `).join('');

    } catch (err) {
      console.error(err);
    }
  },

  async loadReminders() {
    try {
      const res = await fetch('/api/reminders', {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
      });
      const data = await res.json();
      const reminders = data.reminders || [];

      const container = document.getElementById('patient-reminders-list');
      if (!container) return;

      if (reminders.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">No active medicine reminders.</p>`;
        return;
      }

      container.innerHTML = reminders.map(r => `
        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-primary); padding: 0.75rem 1rem; border-radius: var(--radius-md); margin-bottom: 0.5rem; border: 1px solid var(--border-color);">
          <div>
            <strong>💊 ${r.medicine_name}</strong> (${r.dosage})
            <div style="font-size: 0.8rem; color: var(--accent-blue);">⏰ ${r.time_slot} — ${r.frequency}</div>
          </div>
          <button class="btn btn-rose btn-sm" onclick="PatientDashboard.deleteReminder(${r.id})">Delete</button>
        </div>
      `).join('');

      // Schedule Browser Notifications
      MedicineReminder.scheduleReminders(reminders);

    } catch (err) {
      console.error(err);
    }
  },

  async deleteReminder(id) {
    await fetch(`/api/reminders/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });
    App.showToast('Reminder deleted.', 'info');
    this.loadReminders();
  },

  async loadLabBookings() {
    try {
      const res = await fetch('/api/labs/my-bookings', {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
      });
      const data = await res.json();
      const bookings = data.bookings || [];

      const container = document.getElementById('patient-labs-list');
      if (!container) return;

      if (bookings.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted);">No diagnostic lab test bookings.</p>`;
        return;
      }

      container.innerHTML = bookings.map(b => `
        <div style="background: var(--bg-primary); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 0.75rem; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong>🧪 ${b.title}</strong> (${b.department})
            <div style="font-size: 0.85rem; color: var(--text-secondary);">Date: ${b.booking_date} • Type: ${b.sample_collection_type} • Status: <span class="badge badge-confirmed">${b.status}</span></div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick='PDFGenerator.generateLabReportPDF(${JSON.stringify(b).replace(/'/g, "&apos;")})'>📄 Report PDF</button>
        </div>
      `).join('');

    } catch (err) {
      console.error(err);
    }
  },

  async loadHomeServices() {
    try {
      const res = await fetch('/api/home-services/my-requests', {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
      });
      const data = await res.json();
      const reqs = data.requests || [];

      const container = document.getElementById('patient-home-services-list');
      if (!container) return;

      if (reqs.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted);">No home healthcare requests.</p>`;
        return;
      }

      container.innerHTML = reqs.map(r => `
        <div style="background: var(--bg-primary); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 0.75rem; border: 1px solid var(--border-color);">
          <div style="display: flex; justify-content: space-between;">
            <strong>🏠 ${r.service_type}</strong>
            <span class="badge badge-pending">${r.status}</span>
          </div>
          <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.4rem;">Date: ${r.schedule_date} | Address: ${r.address} | Fee: ৳${r.amount}</div>
        </div>
      `).join('');

    } catch (err) {
      console.error(err);
    }
  },

  openReviewModal(docId) {
    document.getElementById('review-doc-id').value = docId;
    App.openModal('modal-review');
  }
};
