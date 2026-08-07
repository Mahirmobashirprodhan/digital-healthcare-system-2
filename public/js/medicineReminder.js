/* ==========================================================================
   Medicine Reminder & Browser Notification System
   ========================================================================== */

const MedicineReminder = {
  
  init() {
    if ("Notification" in window) {
      if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
      }
    }
  },

  scheduleReminders(reminders) {
    this.init();
    if (!reminders || reminders.length === 0) return;

    reminders.forEach(r => {
      // Trigger a sample alert toast or browser notification demo
      console.log(`Medicine Reminder Scheduled for ${r.medicine_name} at ${r.time_slot}`);
    });
  },

  triggerNotification(medicineName, dosage) {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("💊 Time to take your medicine!", {
        body: `${medicineName} (${dosage}) - Please take your scheduled dose now.`,
        icon: "https://cdn-icons-png.flaticon.com/512/2966/2966327.png"
      });
    } else {
      App.showToast(`💊 REMINDER: Time for ${medicineName} (${dosage})`, 'info');
    }
  }
};
