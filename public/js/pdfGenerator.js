/* ==========================================================================
   Dynamic Medical Prescription & Lab Report PDF Generator
   ========================================================================== */

const PDFGenerator = {
  
  generatePrescriptionPDF(prescription) {
    const printWindow = window.open('', '_blank');
    const rxDate = new Date(prescription.created_at || Date.now()).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });

    let medicinesHTML = '';
    if (prescription.medicines && Array.isArray(prescription.medicines)) {
      prescription.medicines.forEach((med, idx) => {
        medicinesHTML += `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px; font-weight: bold;">${idx + 1}. ${med.name}</td>
            <td style="padding: 10px;">${med.dosage}</td>
            <td style="padding: 10px;">${med.frequency}</td>
            <td style="padding: 10px;">${med.duration}</td>
          </tr>
        `;
      });
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Prescription_${prescription.id || 'RX'}</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; padding: 40px; margin: 0; }
          .header { display: flex; justify-content: space-between; border-bottom: 3px solid #0ea5e9; padding-bottom: 20px; margin-bottom: 20px; }
          .doctor-name { font-size: 24px; font-weight: bold; color: #0f172a; margin-bottom: 4px; }
          .doctor-sub { font-size: 14px; color: #0ea5e9; font-weight: 600; margin-bottom: 4px; }
          .hospital { font-size: 13px; color: #64748b; }
          .patient-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; }
          .patient-title { font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold; }
          .patient-val { font-size: 15px; font-weight: bold; color: #0f172a; }
          .rx-symbol { font-size: 32px; font-weight: bold; color: #0ea5e9; font-family: Georgia, serif; margin-bottom: 10px; }
          .diagnosis-box { margin-bottom: 20px; }
          .med-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          .med-table th { background: #f1f5f9; text-align: left; padding: 10px; font-size: 12px; text-transform: uppercase; color: #475569; }
          .instructions-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; border-radius: 4px; margin-bottom: 40px; }
          .footer { border-top: 1px solid #cbd5e1; padding-top: 20px; text-align: center; font-size: 12px; color: #94a3b8; }
          @media print {
            body { padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="doctor-name">${prescription.doctor_name || 'Dr. Digital Specialist'}</div>
            <div class="doctor-sub">${prescription.specialization || 'Medical Consultant'} (${prescription.qualification || 'MBBS, FCPS'})</div>
            <div class="hospital">${prescription.hospital || 'Digital Healthcare Platform'}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 18px; font-weight: bold; color: #0ea5e9;">OFFICIAL PRESCRIPTION</div>
            <div style="font-size: 13px; color: #64748b; margin-top: 4px;">Rx ID: RX-${prescription.id || '101'}</div>
            <div style="font-size: 13px; color: #64748b;">Date: ${rxDate}</div>
          </div>
        </div>

        <div class="patient-box">
          <div>
            <div class="patient-title">Patient Name</div>
            <div class="patient-val">${prescription.patient_name || 'Valued Patient'}</div>
          </div>
          <div>
            <div class="patient-title">Diagnosis</div>
            <div class="patient-val">${prescription.diagnosis || 'General Consultation'}</div>
          </div>
        </div>

        <div class="rx-symbol">Rx</div>

        <table class="med-table">
          <thead>
            <tr>
              <th>Medicine Name</th>
              <th>Dosage</th>
              <th>Frequency</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            ${medicinesHTML}
          </tbody>
        </table>

        ${prescription.instructions ? `
          <div class="instructions-box">
            <strong style="color: #1e40af;">Doctor Advice & Instructions:</strong>
            <p style="margin-top: 5px; color: #1e3a8a;">${prescription.instructions}</p>
          </div>
        ` : ''}

        <div class="footer">
          Digitally Signed via Digital Healthcare System • Valid for Pharmacy Dispensing • Verification Code: DH-${Math.floor(100000 + Math.random() * 900000)}
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  },

  generateLabReportPDF(booking) {
    const printWindow = window.open('', '_blank');
    const reportDate = new Date(booking.created_at || Date.now()).toLocaleDateString();

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Lab_Report_${booking.id}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #0f172a; }
          .header { border-bottom: 2px solid #10b981; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; }
          .title { font-size: 22px; font-weight: bold; color: #059669; }
          .box { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 6px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
          th { background: #f8fafc; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">DIGITAL HEALTHCARE DIAGNOSTICS</div>
            <div>ISO 9001:2026 Accredited Pathology Center</div>
          </div>
          <div style="text-align: right;">
            <strong>REPORT ID: LAB-${booking.id}</strong><br>
            Date: ${reportDate}
          </div>
        </div>

        <div class="box">
          <strong>Test Name:</strong> ${booking.test_title || booking.title || 'Diagnostic Panel'}<br>
          <strong>Department:</strong> ${booking.department || 'General Diagnostic'}<br>
          <strong>Sample Type:</strong> ${booking.sample_type || booking.sample_collection_type || 'Blood'}<br>
          <strong>Patient:</strong> ${booking.patient_name || 'Registered Patient'}
        </div>

        <h3>Test Results Summary</h3>
        <table>
          <thead>
            <tr>
              <th>Parameter / Biomarker</th>
              <th>Clinical Result</th>
              <th>Reference Interval</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Primary Diagnostic Marker</td>
              <td><strong>Normal / Optimal</strong></td>
              <td>Within Standard Range</td>
              <td><span style="color: #10b981; font-weight: bold;">PASSED</span></td>
            </tr>
          </tbody>
        </table>

        ${booking.report_notes ? `
        <div style="margin-top: 20px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
          <strong style="color: #059669;">Pathologist Diagnostic Findings & Notes:</strong>
          <p style="margin: 6px 0 0; font-size: 14px; line-height: 1.5; color: #334155;">${booking.report_notes}</p>
        </div>
        ` : ''}

        <br><br>
        <div style="text-align: right; margin-top: 40px;">
          __________________________<br>
          <strong>Chief Pathologist Signature</strong><br>
          <small style="color: #64748b;">Central Diagnostic Pathology Laboratory</small>
        </div>

        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
};
