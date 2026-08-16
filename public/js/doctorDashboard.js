/* ==========================================================================
   Doctor Portal & Clinical Management Module
   ========================================================================== */

const DoctorDashboard = {
  currentAppts: [],
  profileData: null,

  async loadAllData() {
    const user = Auth.getUser();
    if (!user || user.role !== 'doctor') return;

    this.loadDoctorProfile();
    this.loadDoctorAppointments();
  },

  async loadDoctorProfile() {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
      });
      const data = await res.json();
      if (!res.ok) return;
      
      this.profileData = data.user;
      const u = data.user;
      const d = u.doctor_info || {};

      const elName = document.getElementById('doc-dash-name');
      const elSpec = document.getElementById('doc-dash-spec');
      const elHosp = document.getElementById('doc-dash-hospital');
      const elFee = document.getElementById('doc-dash-fee');

      if (elName) elName.textContent = u.name || 'Doctor';
      if (elSpec) elSpec.textContent = d.specialization || 'General Physician';
      if (elHosp) elHosp.textContent = `Hospital: ${d.hospital || 'Not specified'}`;
      if (elFee) elFee.textContent = `Fee: ৳${d.fee || 1000}`;

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
      const d = u.doctor_info || {};

      document.getElementById('doc-edit-name').value = u.name || '';
      document.getElementById('doc-edit-phone').value = u.phone || '';
      document.getElementById('doc-edit-spec').value = d.specialization || 'General Physician';
      document.getElementById('doc-edit-fee').value = d.fee || 1000;
      document.getElementById('doc-edit-hospital').value = d.hospital || '';
      document.getElementById('doc-edit-qualification').value = d.qualification || 'MBBS';
      document.getElementById('doc-edit-exp').value = d.experience_years || 5;
      document.getElementById('doc-edit-time').value = d.available_time || '10:00 AM - 04:00 PM';
      document.getElementById('doc-edit-about').value = d.about || '';

      App.openModal('modal-doctor-profile');
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  async submitProfile(e) {
    e.preventDefault();
    const name = document.getElementById('doc-edit-name').value;
    const phone = document.getElementById('doc-edit-phone').value;
    const specialization = document.getElementById('doc-edit-spec').value;
    const fee = parseFloat(document.getElementById('doc-edit-fee').value) || 1000.0;
    const hospital = document.getElementById('doc-edit-hospital').value;
    const qualification = document.getElementById('doc-edit-qualification').value;
    const experience_years = parseInt(document.getElementById('doc-edit-exp').value) || 5;
    const available_time = document.getElementById('doc-edit-time').value;
    const about = document.getElementById('doc-edit-about').value;

    try {
      const res = await fetch('/api/doctors/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Auth.getToken()}`
        },
        body: JSON.stringify({
          name, phone, specialization, fee, hospital, qualification, experience_years, available_time, about
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
      this.loadDoctorProfile();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  async loadDoctorAppointments() {
    try {
      const res = await fetch('/api/appointments/doctor', {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load doctor appointments');
      }

      this.currentAppts = data.appointments || [];
      this.renderAppointments();
      this.renderDoctorStats();
    } catch (err) {
      console.error(err);
      App.showToast(err.message, 'error');
    }
  },

  renderDoctorStats() {
    const total = this.currentAppts.length;
    const confirmed = this.currentAppts.filter(a => a.status === 'Confirmed').length;
    const completed = this.currentAppts.filter(a => a.status === 'Completed').length;

    const elTotal = document.getElementById('doc-stat-total');
    const elConfirmed = document.getElementById('doc-stat-confirmed');
    const elCompleted = document.getElementById('doc-stat-completed');

    if (elTotal) elTotal.textContent = total;
    if (elConfirmed) elConfirmed.textContent = confirmed;
    if (elCompleted) elCompleted.textContent = completed;
  },

  renderAppointments() {
    const tbody = document.getElementById('doctor-appointments-list');
    if (!tbody) return;

    if (this.currentAppts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No scheduled patient appointments found.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.currentAppts.map(a => {
      // Payment badge
      let payBadge = '';
      if (a.payment_status === 'Paid') {
        payBadge = `<span class="badge badge-confirmed" title="Payment received">✓ Paid</span>`;
      } else if (a.payment_status === 'Refunded') {
        payBadge = `<span class="badge badge-cancelled" title="Payment refunded">💰 Refunded</span>`;
      } else {
        payBadge = `<span class="badge badge-pending" title="Payment pending">⏳ Unpaid</span>`;
      }

      // Action buttons
      let actions = '';
      if (a.status === 'Confirmed') {
        actions = `
          <button class="btn btn-emerald btn-sm" onclick="VideoConsult.startCall('${a.patient_name.replace(/'/g, "\\'")}', 'Patient', ${a.id})">🎥 Consult</button>
          <button class="btn btn-primary btn-sm" onclick="DoctorDashboard.openPrescriptionModal(${a.id}, ${a.patient_id}, '${a.patient_name.replace(/'/g, "\\'")}')">✍️ Write Rx</button>
          <button class="btn btn-rose btn-sm" onclick="DoctorDashboard.updateStatus(${a.id}, 'Cancelled')">✕ Cancel</button>
        `;
      } else if (a.status === 'Pending') {
        actions = `
          <button class="btn btn-emerald btn-sm" onclick="DoctorDashboard.updateStatus(${a.id}, 'Confirmed')">Accept</button>
          <button class="btn btn-rose btn-sm" onclick="DoctorDashboard.updateStatus(${a.id}, 'Rejected')">Reject</button>
        `;
      }

      return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <img src="${a.patient_image || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80'}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
            <div>
              <strong>${a.patient_name}</strong>
              <div style="font-size: 0.8rem; color: var(--text-secondary);">${a.gender || 'Male'}, ${a.age || 30} yrs | Blood: <span style="color: var(--accent-rose); font-weight: bold;">${a.blood_group || 'A+'}</span></div>
            </div>
          </div>
        </td>
        <td>${a.date}<br><small style="color: var(--accent-blue); font-weight: 600;">${a.time_slot}</small></td>
        <td>${a.symptoms || 'Routine Checkup'}</td>
        <td><span class="badge badge-${a.status.toLowerCase()}">${a.status}</span></td>
        <td>${payBadge}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="DoctorDashboard.viewPatientRecords(${a.patient_id}, '${a.patient_name.replace(/'/g, "\\'")}')" title="View Patient Medical History">
            🔒 Patient Records
          </button>
        </td>
        <td>${actions}</td>
      </tr>`;
    }).join('');
  },

  async updateStatus(apptId, status) {
    try {
      const res = await fetch(`/api/appointments/${apptId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Auth.getToken()}`
        },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      App.showToast(data.message, 'success');
      this.loadDoctorAppointments();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  async viewPatientRecords(patientId, patientName) {
    try {
      const res = await fetch(`/api/medical-records/patient/${patientId}`, {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Access to records denied.');
      }

      const records = data.records || [];
      const container = document.getElementById('doctor-patient-records-modal-body');
      
      let html = `
        <div style="background: rgba(14, 165, 233, 0.1); border: 1px solid var(--accent-blue); padding: 0.75rem; border-radius: var(--radius-md); font-size: 0.85rem; color: var(--accent-blue); margin-bottom: 1rem;">
          🛡️ Privacy Audit Active: Your access to ${patientName}'s medical records has been logged for security auditing.
        </div>
      `;

      if (records.length === 0) {
        html += `<p style="color: var(--text-muted);">No past medical records uploaded for this patient.</p>`;
      } else {
        html += records.map(r => `
          <div style="background: var(--bg-primary); border: 1px solid var(--border-color); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 0.75rem;">
            <div style="display: flex; justify-content: space-between;">
              <strong>${r.title}</strong>
              <span class="badge badge-patient">${r.record_type}</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin: 0.3rem 0;">Doctor: ${r.doctor_name || 'Consultant'} • Date: ${r.date}</div>
            <p style="font-size: 0.9rem;">${r.notes}</p>
          </div>
        `).join('');
      }

      container.innerHTML = html;
      document.getElementById('patient-records-title').textContent = `Medical History — ${patientName}`;
      App.openModal('modal-doctor-patient-records');

    } catch (err) {
      App.showToast(err.message, 'error');
    }
  },

  openPrescriptionModal(apptId, patientId, patientName) {
    document.getElementById('rx-appt-id').value = apptId;
    document.getElementById('rx-patient-id').value = patientId;
    document.getElementById('rx-patient-name-display').textContent = patientName;
    document.getElementById('rx-medicines-container').innerHTML = ''; // Reset
    
    // Add default 1 medicine row
    this.addMedicineRow();
    App.openModal('modal-prescription');
  },

  addMedicineRow() {
    const container = document.getElementById('rx-medicines-container');
    const div = document.createElement('div');
    div.className = 'form-row rx-med-row';
    div.style.marginBottom = '0.5rem';
    div.innerHTML = `
      <input type="text" class="form-control med-name" placeholder="Medicine Name (e.g. Tab. Amlodipine)" required>
      <input type="text" class="form-control med-dosage" placeholder="Dosage (5mg)" required>
      <input type="text" class="form-control med-freq" placeholder="Frequency (1-0-1)" required>
      <input type="text" class="form-control med-dur" placeholder="Duration (30 Days)" required>
    `;
    container.appendChild(div);
  },

  async submitPrescription(e) {
    e.preventDefault();
    const apptId = document.getElementById('rx-appt-id').value;
    const patientId = document.getElementById('rx-patient-id').value;
    const diagnosis = document.getElementById('rx-diagnosis').value;
    const instructions = document.getElementById('rx-instructions').value;

    const rows = document.querySelectorAll('.rx-med-row');
    const medicines = [];
    rows.forEach(row => {
      const name = row.querySelector('.med-name').value;
      const dosage = row.querySelector('.med-dosage').value;
      const frequency = row.querySelector('.med-freq').value;
      const duration = row.querySelector('.med-dur').value;
      if (name) {
        medicines.push({ name, dosage, frequency, duration });
      }
    });

    try {
      const res = await fetch('/api/prescriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Auth.getToken()}`
        },
        body: JSON.stringify({
          appointment_id: apptId,
          patient_id: patientId,
          diagnosis,
          medicines,
          instructions
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Prescription submission failed.');

      App.showToast(data.message, 'success');
      App.closeModals();
      this.loadDoctorAppointments();
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  }
};
