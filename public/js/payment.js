/* ==========================================================================
   Bangladeshi Payment Gateways Module (SSLCommerz, bKash, Nagad, Rocket)
   ========================================================================== */

const PaymentSystem = {
  currentPayment: null,

  initCheckout(amount, relatedType, relatedId, callback) {
    this.currentPayment = { amount, relatedType, relatedId, callback };

    document.getElementById('payment-amount-display').textContent = `৳${amount}`;
    document.getElementById('payment-step-gateway').style.display = 'block';
    document.getElementById('payment-step-otp').style.display = 'none';

    App.openModal('modal-payment');
  },

  selectGateway(gatewayName) {
    if (!this.currentPayment) return;
    this.currentPayment.gateway = gatewayName;

    const brandEl = document.getElementById('payment-gateway-brand');
    brandEl.textContent = gatewayName;
    
    if (gatewayName === 'bKash') brandEl.style.color = '#e2136e';
    else if (gatewayName === 'Nagad') brandEl.style.color = '#f7921e';
    else if (gatewayName === 'Rocket') brandEl.style.color = '#8c3494';
    else brandEl.style.color = '#0ea5e9';

    document.getElementById('payment-step-gateway').style.display = 'none';
    document.getElementById('payment-step-otp').style.display = 'block';
  },

  async confirmPayment(e) {
    e.preventDefault();
    if (!this.currentPayment) return;

    const pin = document.getElementById('payment-pin-input').value;
    if (!pin) {
      App.showToast('Please enter your PIN / OTP.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Auth.getToken()}`
        },
        body: JSON.stringify({
          gateway: this.currentPayment.gateway,
          amount: this.currentPayment.amount,
          related_type: this.currentPayment.relatedType,
          related_id: this.currentPayment.relatedId
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment failed.');

      App.showToast(`Payment of ৳${data.amount} via ${data.gateway} Successful! TRX ID: ${data.transaction_id}`, 'success');
      App.closeModals();

      if (this.currentPayment.callback) {
        this.currentPayment.callback(data);
      }

    } catch (err) {
      App.showToast(err.message, 'error');
    }
  }
};
