/* ==========================================================================
   Lab Assistant & Diagnostic Staff Portal Module
   ========================================================================== */

const StaffDashboard = {
  currentBookings: [],
  selectedBooking: null,
  activeFilter: 'all',

  async loadAllData() {
    const user = Auth.getUser();
    if (!user || (user.role !== 'staff' && user.role !== 'admin')) return;

    this.loadStats();
    this.loadBookings();
  },

  async loadStats() {
    try {
      const res = await fetch('/api/staff/stats', {
        headers: { 'Authorization': 'Bearer ' + Auth.getToken() }
      });
      const data = await res.json();
      if (!res.ok) return;

      const elTotal = document.getElementById('staff-stat-total');
      const elPending = document.getElementById('staff-stat-pending');
      const elProcessing = document.getElementById('staff-stat-processing');
      const elCompleted = document.getElementById('staff-stat-completed');

      if (elTotal) elTotal.textContent = data.total_bookings || 0;
      if (elPending) elPending.textContent = data.pending_samples || 0;
      if (elProcessing) elProcessing.textContent = data.processing_tests || 0;
      if (elCompleted) elCompleted.textContent = data.completed_reports || 0;
    } catch (err) {
      console.error('Error loading staff stats:', err);
    }
  },

  async loadBookings() {
    const tbody = document.getElementById('staff-lab-bookings-list');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Loading lab test bookings...</td></tr>';
    }

    try {
      const res = await fetch('/api/staff/lab-bookings', {
        headers: { 'Authorization': 'Bearer ' + Auth.getToken() }
      });
      const data = await res.json();
      this.currentBookings = data.bookings || [];
      this.renderBookings();
    } catch (err) {
      console.error('Error loading lab bookings:', err);
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--accent-rose);">Failed to load lab bookings.</td></tr>';
      }
    }
  },

  setFilter(status) {
    this.activeFilter = status;
    document.querySelectorAll('.staff-filter-btn').forEach(btn => {
      if (btn.dataset.status === status) {
        btn.className = 'btn btn-primary btn-sm staff-filter-btn';
      } else {
        btn.className = 'btn btn-secondary btn-sm staff-filter-btn';
      }
    });
    this.renderBookings();
  },

  renderBookings() {
    const tbody = document.getElementById('staff-lab-bookings-list');
    if (!tbody) return;

    const searchInput = document.getElementById('staff-search-input');
    const searchTerm = (searchInput ? searchInput.value : '').toLowerCase().trim();

    let filtered = this.currentBookings;
    if (this.activeFilter !== 'all') {
      filtered = filtered.filter(b => b.status.toLowerCase() === this.activeFilter.toLowerCase());
    }

    if (searchTerm) {
      filtered = filtered.filter(b => 
        (b.patient_name && b.patient_name.toLowerCase().includes(searchTerm)) ||
        (b.test_title && b.test_title.toLowerCase().includes(searchTerm)) ||
        (b.patient_phone && b.patient_phone.includes(searchTerm)) ||
        (b.id && b.id.toString().includes(searchTerm))
      );
    }

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No diagnostic bookings found matching criteria.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(b => {
      let statusBadge = '';
      if (b.status === 'Completed') {
        statusBadge = '<span class="badge badge-confirmed">✓ Completed</span>';
      } else if (b.status === 'Processing') {
        statusBadge = '<span class="badge badge-patient">🔬 Processing</span>';
      } else {
        statusBadge = '<span class="badge badge-pending">⏳ Scheduled</span>';
      }

      let reportBadge = '';
      if (b.status === 'Completed' || b.report_url) {
        reportBadge = '<button class="btn btn-secondary btn-sm" onclick='PDFGenerator.generateLabReportPDF(' + JSON.stringify(b).replace(/'/g, '&apos;') + ')' title="Preview Generated PDF">📄 View PDF</button>';
      } else {
        reportBadge = '<span style="color: var(--text-muted); font-size: 0.8rem;">Pending Upload</span>';
      }

      return '<tr>' +
        '<td><strong style="color: var(--accent-blue);">#LAB-' + b.id + '</strong></td>' +
        '<td><strong>' + b.patient_name + '</strong><div style="font-size: 0.8rem; color: var(--text-secondary);">' + (b.patient_phone || 'N/A') + ' • ' + (b.patient_gender || 'Male') + ', ' + (b.patient_age || 30) + 'y</div></td>' +
        '<td><strong>' + b.test_title + '</strong><div style="font-size: 0.8rem; color: var(--accent-purple);">' + b.department + ' • ৳' + b.amount + '</div></td>' +
        '<td>' + b.booking_date + '<div style="font-size: 0.8rem; color: var(--text-muted);">' + b.sample_collection_type + '</div></td>' +
        '<td>' + statusBadge + '</td>' +
        '<td>' + reportBadge + '</td>' +
        '<td><button class="btn btn-primary btn-sm" onclick="StaffDashboard.openUploadModal(' + b.id + ')">📤 Upload / Update</button></td>' +
      '</tr>';
    }).join('');
  },

  openUploadModal(bookingId) {
    const booking = this.currentBookings.find(b => b.id === bookingId);
    if (!booking) return;
    this.selectedBooking = booking;

    document.getElementById('upload-lab-id').value = booking.id;
    document.getElementById('upload-lab-patient-name').textContent = booking.patient_name;
    document.getElementById('upload-lab-test-title').textContent = booking.test_title + ' (' + booking.department + ')';
    document.getElementById('upload-lab-sample-info').textContent = booking.sample_type + ' • ' + booking.sample_collection_type + ' on ' + booking.booking_date;
    document.getElementById('upload-lab-status').value = booking.status || 'Completed';
    document.getElementById('upload-lab-notes').value = booking.report_notes || ('All diagnostic parameters for ' + booking.test_title + ' tested and verified. Normal physiological range observed.');
    document.getElementById('upload-lab-filename').value = booking.report_url || ('Lab_Report_LAB-' + booking.id + '_' + booking.test_title.replace(/\s+/g, '_') + '.pdf');

    App.openModal('modal-upload-lab-report');
  },

  async submitReport(e) {
    e.preventDefault();
    if (!this.selectedBooking) return;

    const bookingId = this.selectedBooking.id;
    const status = document.getElementById('upload-lab-status').value;
    const reportNotes = document.getElementById('upload-lab-notes').value;
    const reportFilename = document.getElementById('upload-lab-filename').value;

    const submitBtn = document.getElementById('btn-submit-lab-report');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Publishing Report...';
    }

    try {
      const res = await fetch('/api/staff/lab-bookings/' + bookingId + '/upload-report', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + Auth.getToken()
        },
        body: JSON.stringify({
          status: status,
          report_notes: reportNotes,
          report_url: reportFilename
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload lab report.');

      App.showToast(data.message || 'Lab report uploaded and published successfully!', 'success');
      App.closeModals();
      this.loadStats();
      this.loadBookings();
    } catch (err) {
      App.showToast(err.message, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '💾 Save & Publish to Patient Profile';
      }
    }
  }
};
