/* ==========================================================================
   Doctor Portal & Clinical Management Module
   ========================================================================== */

const DoctorDashboard = {
  currentAppts: [],

  async loadAllData() {
    const user = Auth.getUser();
    if (!user || user.role !== 'doctor') return;

    this.loadDoctorAppointments();
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
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No scheduled patient appointments found.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.currentAppts.map(a => `
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
        <td>
          <button class="btn btn-secondary btn-sm" onclick="DoctorDashboard.viewPatientRecords(${a.patient_id}, '${a.patient_name.replace(/'/g, "\\'")}')" title="View Patient Medical History (Logged)">
            🔒 Patient Records
          </button>
        </td>
        <td>
          ${a.status === 'Confirmed' ? `
            <button class="btn btn-emerald btn-sm" onclick="VideoConsult.startCall('${a.patient_name.replace(/'/g, "\\'")}', 'Patient', ${a.id})">🎥 Consult</button>
            <button class="btn btn-primary btn-sm" onclick="DoctorDashboard.openPrescriptionModal(${a.id}, ${a.patient_id}, '${a.patient_name.replace(/'/g, "\\'")}')">✍️ Write Rx</button>
          ` : ''}
          ${a.status === 'Pending' ? `
            <button class="btn btn-emerald btn-sm" onclick="DoctorDashboard.updateStatus(${a.id}, 'Confirmed')">Accept</button>
            <button class="btn btn-rose btn-sm" onclick="DoctorDashboard.updateStatus(${a.id}, 'Rejected')">Reject</button>
          ` : ''}
        </td>
      </tr>
    `).join('');
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
