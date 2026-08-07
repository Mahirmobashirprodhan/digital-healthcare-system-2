/* ==========================================================================
   Doctor Search & Filtering System
   ========================================================================== */

const DoctorSearch = {
  currentDoctors: [],

  async fetchDoctors(params = {}) {
    try {
      const queryString = new URLSearchParams(params).toString();
      const res = await fetch(`/api/doctors?${queryString}`);
      const data = await res.json();
      this.currentDoctors = data.doctors || [];
      this.renderDoctorsList(this.currentDoctors);
    } catch (err) {
      console.error('Error fetching doctors:', err);
    }
  },

  renderDoctorsList(doctors) {
    const container = document.getElementById('search-doctors-results');
    if (!container) return;

    if (doctors.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
          <h3>No doctors found matching your criteria.</h3>
          <p style="margin-top: 0.5rem;">Try adjusting your department or search keyword.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = doctors.map(doc => `
      <div class="doctor-card">
        <img src="${doc.profile_image}" alt="${doc.name}" class="doctor-card-img">
        <div class="doctor-card-info">
          <h3>${doc.name}</h3>
          <div class="doc-specialty">${doc.specialization} • ${doc.qualification}</div>
          <div class="doc-meta">
            <span>🏥 ${doc.hospital}</span>
            <span>⏱ ${doc.experience_years} Years Exp.</span>
            <span>⭐ ${doc.rating} / 5.0</span>
          </div>
          <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.75rem;">
            📅 Available: ${Array.isArray(doc.available_days) ? doc.available_days.join(', ') : 'Mon, Wed, Fri'} (${doc.available_time})
          </div>
          <div style="display: flex; gap: 0.75rem; align-items: center;">
            <span style="font-weight: 700; color: var(--accent-emerald); font-size: 1.1rem;">৳${doc.fee}</span>
            <button class="btn btn-primary btn-sm" onclick="DoctorSearch.openBookingModal(${doc.id}, '${doc.name.replace(/'/g, "\\'")}', ${doc.fee})">Book Consultation</button>
            <button class="btn btn-secondary btn-sm" onclick="DoctorSearch.viewDoctorDetail(${doc.id})">View Profile</button>
          </div>
        </div>
      </div>
    `).join('');
  },

  async viewDoctorDetail(docId) {
    try {
      const res = await fetch(`/api/doctors/${docId}`);
      const data = await res.json();
      const doc = data.doctor;
      if (!doc) return;

      const container = document.getElementById('doctor-detail-container');
      container.innerHTML = `
        <div class="card-panel">
          <div style="display: flex; gap: 2rem; align-items: flex-start; flex-wrap: wrap;">
            <img src="${doc.profile_image}" style="width: 140px; height: 140px; border-radius: var(--radius-lg); object-fit: cover; border: 3px solid var(--accent-blue);">
            <div style="flex: 1;">
              <h2 style="font-size: 2rem; font-weight: 700;">${doc.name}</h2>
              <p style="color: var(--accent-blue); font-weight: 600; font-size: 1.1rem;">${doc.specialization} — ${doc.qualification}</p>
              <p style="color: var(--text-secondary); margin: 0.5rem 0;">🏥 ${doc.hospital} | ⏱ ${doc.experience_years} Years Experience</p>
              <div style="display: flex; gap: 1rem; margin: 1rem 0;">
                <span class="badge badge-active">Rating: ${doc.rating} ★</span>
                <span class="badge badge-patient">Consultation Fee: ৳${doc.fee}</span>
              </div>
              <p style="color: var(--text-primary); margin-bottom: 1.5rem;">${doc.about || 'Experienced medical professional committed to providing exceptional care.'}</p>
              <button class="btn btn-primary" onclick="DoctorSearch.openBookingModal(${doc.id}, '${doc.name.replace(/'/g, "\\'")}', ${doc.fee})">Book Instant Appointment</button>
            </div>
          </div>
        </div>

        <div class="card-panel">
          <h3 class="panel-title" style="margin-bottom: 1rem;">Patient Reviews & Feedback (${doc.reviews ? doc.reviews.length : 0})</h3>
          ${doc.reviews && doc.reviews.length > 0 ? doc.reviews.map(r => `
            <div style="background: var(--bg-primary); border: 1px solid var(--border-color); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 0.75rem;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.4rem;">
                <strong>${r.patient_name}</strong>
                <span style="color: var(--accent-amber);">★ ${r.rating} / 5</span>
              </div>
              <p style="font-size: 0.9rem; color: var(--text-secondary);">${r.comment}</p>
            </div>
          `).join('') : '<p style="color: var(--text-muted);">No reviews yet. Be the first patient to leave a review!</p>'}
        </div>
      `;

      App.navigateTo('doctor-detail');
    } catch (err) {
      console.error(err);
    }
  },

  openBookingModal(docId, docName, fee) {
    const user = Auth.getUser();
    if (!user) {
      App.showToast('Please sign in to book an appointment.', 'info');
      App.openAuthModal('login');
      return;
    }

    document.getElementById('booking-doc-id').value = docId;
    document.getElementById('booking-doc-name').textContent = docName;
    document.getElementById('booking-doc-fee').textContent = `৳${fee}`;
    
    // Set min date to today
    const dateInput = document.getElementById('booking-date');
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;
    dateInput.value = today;

    App.openModal('modal-appointment');
  }
};
