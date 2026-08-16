/* ==========================================================================
   Admin Control Panel & Audit Log Viewer
   ========================================================================== */

const AdminDashboard = {

  async loadAllData() {
    const user = Auth.getUser();
    if (!user || user.role !== 'admin') return;

    this.loadStats();
    this.loadUsers();
    this.loadAppointments();
    this.loadAuditLogs();
  },

  async loadStats() {
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
      });
      const data = await res.json();
      if (!res.ok) return;

      document.getElementById('admin-stat-patients').textContent = data.total_patients || 0;
      document.getElementById('admin-stat-doctors').textContent = data.total_doctors || 0;
      document.getElementById('admin-stat-appointments').textContent = data.total_appointments || 0;
      document.getElementById('admin-stat-revenue').textContent = `৳${(data.total_revenue || 0).toLocaleString()}`;

    } catch (err) {
      console.error(err);
    }
  },

  async loadAppointments() {
    try {
      const res = await fetch('/api/admin/appointments', {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
      });
      const data = await res.json();
      const appts = data.appointments || [];

      const tbody = document.getElementById('admin-appointments-list');
      if (!tbody) return;

      if (appts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No appointments booked in the system yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = appts.map(a => {
        let payBadge = '';
        if (a.payment_status === 'Paid') {
          payBadge = `<span class="badge badge-confirmed">✓ Paid</span>`;
        } else if (a.payment_status === 'Refunded') {
          payBadge = `<span class="badge badge-cancelled">💰 Refunded</span>`;
        } else {
          payBadge = `<span class="badge badge-pending">⏳ Pending</span>`;
        }

        return `
        <tr>
          <td>#${a.id}</td>
          <td>
            <strong>${a.patient_name}</strong>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">${a.patient_email}</div>
          </td>
          <td>
            <strong>${a.doctor_name}</strong>
            <div style="font-size: 0.8rem; color: var(--accent-blue);">${a.specialization}</div>
          </td>
          <td>${a.date}<br><small style="color: var(--text-secondary);">${a.time_slot}</small></td>
          <td><strong>৳${a.fee}</strong></td>
          <td><span class="badge badge-${a.status.toLowerCase()}">${a.status}</span></td>
          <td>${payBadge}</td>
        </tr>`;
      }).join('');

    } catch (err) {
      console.error(err);
    }
  },

  async loadUsers() {
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
      });
      const data = await res.json();
      const users = data.users || [];

      const tbody = document.getElementById('admin-users-list');
      if (!tbody) return;

      tbody.innerHTML = users.map(u => `
        <tr>
          <td><strong>${u.name}</strong></td>
          <td>${u.email}</td>
          <td><span class="badge badge-${u.role}">${u.role}</span></td>
          <td>${u.phone || 'N/A'}</td>
          <td><span class="badge badge-active">Verified</span></td>
          <td>${new Date(u.created_at).toLocaleDateString()}</td>
        </tr>
      `).join('');

    } catch (err) {
      console.error(err);
    }
  },

  async loadAuditLogs() {
    try {
      const res = await fetch('/api/admin/audit-logs', {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
      });
      const data = await res.json();
      const logs = data.audit_logs || [];

      const tbody = document.getElementById('admin-audit-logs-list');
      if (!tbody) return;

      if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No security audit records logged yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = logs.map(l => `
        <tr>
          <td>${new Date(l.timestamp).toLocaleString()}</td>
          <td>
            <strong>${l.actor_name}</strong>
            <span class="badge badge-${l.actor_role}">${l.actor_role}</span>
          </td>
          <td>${l.target_patient_name}</td>
          <td><span class="badge badge-${l.action.includes('BLOCKED') ? 'rejected' : 'confirmed'}">${l.action}</span></td>
          <td><code style="background: rgba(0,0,0,0.3); padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.8rem;">${l.endpoint}</code></td>
        </tr>
      `).join('');

    } catch (err) {
      console.error(err);
    }
  }
};

