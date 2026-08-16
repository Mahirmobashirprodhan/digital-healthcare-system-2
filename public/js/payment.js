/* ==========================================================================
   Bangladeshi & Card Payment Gateways (bKash, Nagad, Rocket, Credit/Debit Card)
   ========================================================================== */

const PaymentSystem = {
  currentPayment: null,

  initCheckout(amount, relatedType, relatedId, callback) {
    this.currentPayment = { amount, relatedType, relatedId, callback };

    const amtDisplay = document.getElementById('payment-amount-display');
    if (amtDisplay) amtDisplay.textContent = `৳${amount}`;

    this.showGateways();

    // Reset all form inputs
    ['payment-mobile-number','payment-mobile-pin',
     'payment-card-number','payment-card-name',
     'payment-card-expiry','payment-card-cvv'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    App.openModal('modal-payment');
  },

  showGateways() {
    const stepGateway = document.getElementById('payment-step-gateway');
    const stepMobile  = document.getElementById('payment-step-mobile');
    const stepCard    = document.getElementById('payment-step-card');
    if (stepGateway) stepGateway.style.display = 'block';
    if (stepMobile)  stepMobile.style.display  = 'none';
    if (stepCard)    stepCard.style.display    = 'none';
  },

  selectGateway(gatewayName) {
    if (!this.currentPayment) return;
    this.currentPayment.gateway = gatewayName;

    const stepGateway = document.getElementById('payment-step-gateway');
    const stepMobile  = document.getElementById('payment-step-mobile');
    const stepCard    = document.getElementById('payment-step-card');
    if (stepGateway) stepGateway.style.display = 'none';

    if (gatewayName === 'Card') {
      if (stepMobile) stepMobile.style.display = 'none';
      if (stepCard)   stepCard.style.display   = 'block';
      const btn = document.getElementById('payment-card-btn');
      if (btn) btn.textContent = `Confirm & Pay ৳${this.currentPayment.amount} via Card`;
    } else {
      if (stepCard)   stepCard.style.display   = 'none';
      if (stepMobile) stepMobile.style.display = 'block';

      const brandEl = document.getElementById('payment-mobile-brand');
      if (brandEl) {
        brandEl.textContent = gatewayName;
        if (gatewayName === 'bKash')  brandEl.style.color = '#e2136e';
        else if (gatewayName === 'Nagad')  brandEl.style.color = '#f7921e';
        else if (gatewayName === 'Rocket') brandEl.style.color = '#8c3494';
      }
      const numInput = document.getElementById('payment-mobile-number');
      if (numInput) numInput.placeholder = `01XXXXXXXXX (${gatewayName} wallet)`;

      const btn = document.getElementById('payment-mobile-btn');
      if (btn) btn.textContent = `Confirm & Pay ৳${this.currentPayment.amount} via ${gatewayName}`;
    }
  },

  async confirmPayment(e) {
    e.preventDefault();
    if (!this.currentPayment) return;

    const gateway = this.currentPayment.gateway;
    let paymentDetails = {};

    if (gateway === 'Card') {
      // ---- Card validation ----
      const rawNum  = (document.getElementById('payment-card-number')?.value || '').replace(/\s+/g, '');
      const name    = (document.getElementById('payment-card-name')?.value   || '').trim();
      const expiry  = (document.getElementById('payment-card-expiry')?.value || '').trim();
      const cvv     = (document.getElementById('payment-card-cvv')?.value    || '').trim();

      if (!rawNum || rawNum.length < 13 || !/^\d+$/.test(rawNum)) {
        App.showToast('Please enter a valid card number (13–19 digits).', 'error'); return;
      }
      if (!name) {
        App.showToast('Please enter the cardholder name.', 'error'); return;
      }
      if (!expiry || !/^(0[1-9]|1[0-2])\/?(\d{2})$/.test(expiry)) {
        App.showToast('Please enter a valid expiry date (MM/YY).', 'error'); return;
      }
      if (!cvv || !/^\d{3,4}$/.test(cvv)) {
        App.showToast('Please enter a valid 3 or 4-digit CVV.', 'error'); return;
      }

      paymentDetails = {
        card_holder: name,
        card_masked: `\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 ${rawNum.slice(-4)}`
      };
    } else {
      // ---- Mobile wallet validation ----
      const mobNum = (document.getElementById('payment-mobile-number')?.value || '').trim();
      const pin    = (document.getElementById('payment-mobile-pin')?.value    || '').trim();

      if (!mobNum || mobNum.length !== 11 || !mobNum.startsWith('01') || !/^\d+$/.test(mobNum)) {
        App.showToast(`Enter a valid 11-digit ${gateway} number starting with 01.`, 'error'); return;
      }
      if (!pin || pin.length < 4) {
        App.showToast('Please enter your 4–5 digit PIN or OTP.', 'error'); return;
      }

      paymentDetails = { wallet_number: mobNum };
    }

    try {
      const res = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Auth.getToken()}`
        },
        body: JSON.stringify({
          gateway,
          amount:       this.currentPayment.amount,
          related_type: this.currentPayment.relatedType,
          related_id:   this.currentPayment.relatedId,
          details:      paymentDetails
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment failed.');

      App.showToast(
        `Payment of ৳${data.amount} via ${data.gateway} successful! TRX: ${data.transaction_id}`,
        'success'
      );
      App.closeModals();

      if (this.currentPayment.callback) {
        this.currentPayment.callback(data);
      }

    } catch (err) {
      App.showToast(err.message, 'error');
    }
  }
};
