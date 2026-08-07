/* ==========================================================================
   Patient Portal & Dashboard Operations
   ========================================================================== */

const PatientDashboard = {

  async loadAllData() {
    const user = Auth.getUser();
    if (!user || user.role !== 'patient') return;

    // Load Patient Appointments
    this.loadAppointments();
    // Load Prescriptions
    this.loadPrescriptions();
    // Load Medical Records
    this.loadMedicalRecords(user.id);
    // Load Medicine Reminders
    this.loadReminders();
    // Load Lab Bookings
    this.loadLabBookings();
    // Load Home Service Requests
    this.loadHomeServices();
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
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No appointment records found. Book your first consultation above!</td></tr>`;
        return;
      }

      tbody.innerHTML = appts.map(a => `
        <tr>
          <td>
            <div style="font-weight: 600;">${a.doctor_name}</div>
            <div style="font-size: 0.8rem; color: var(--accent-blue);">${a.specialization}</div>
          </td>
          <td>${a.date}<br><small style="color: var(--text-secondary);">${a.time_slot}</small></td>
          <td>৳${a.fee}</td>
          <td><span class="badge badge-${a.status.toLowerCase()}">${a.status}</span></td>
          <td>${a.symptoms || 'General Checkup'}</td>
          <td>
            ${a.status === 'Confirmed' ? `
              <button class="btn btn-emerald btn-sm" onclick="VideoConsult.startCall('${a.doctor_name.replace(/'/g, "\\'")}', 'Doctor', ${a.id})">🎥 Join Video Consult</button>
            ` : ''}
            ${a.status === 'Completed' ? `
              <button class="btn btn-secondary btn-sm" onclick="PatientDashboard.openReviewModal(${a.doctor_id})">⭐ Review</button>
            ` : ''}
          </td>
        </tr>
      `).join('');

    } catch (err) {
      console.error(err);
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
