/* ==========================================================================
   Real-Time WebRTC Video Consultation Module
   ========================================================================== */

const VideoConsult = {
  localStream: null,
  callTimerInterval: null,
  secondsElapsed: 0,

  async startCall(peerName, peerRole, appointmentId) {
    App.openModal('modal-webrtc-consult');

    document.getElementById('webrtc-peer-name').textContent = peerName;
    document.getElementById('webrtc-peer-role').textContent = peerRole;

    // Start local camera media stream
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const localVideo = document.getElementById('webrtc-local-video');
      if (localVideo) {
        localVideo.srcObject = this.localStream;
      }
    } catch (err) {
      console.warn('Camera/Mic permission not granted or device not present. Simulating stream placeholder.', err);
    }

    // Start Call Duration Timer
    this.secondsElapsed = 0;
    const timerDisplay = document.getElementById('webrtc-timer');
    if (this.callTimerInterval) clearInterval(this.callTimerInterval);

    this.callTimerInterval = setInterval(() => {
      this.secondsElapsed++;
      const mins = String(Math.floor(this.secondsElapsed / 60)).padStart(2, '0');
      const secs = String(this.secondsElapsed % 60).padStart(2, '0');
      if (timerDisplay) timerDisplay.textContent = `${mins}:${secs}`;
    }, 1000);

    App.showToast(`Connected to WebRTC Video Room with ${peerName}`, 'success');
  },

  toggleAudio() {
    if (!this.localStream) return;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      const btn = document.getElementById('btn-toggle-mic');
      btn.classList.toggle('muted', !audioTrack.enabled);
      App.showToast(audioTrack.enabled ? 'Microphone unmuted' : 'Microphone muted', 'info');
    }
  },

  toggleVideo() {
    if (!this.localStream) return;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      const btn = document.getElementById('btn-toggle-cam');
      btn.classList.toggle('muted', !videoTrack.enabled);
      App.showToast(videoTrack.enabled ? 'Camera turned on' : 'Camera turned off', 'info');
    }
  },

  endCall() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.callTimerInterval) {
      clearInterval(this.callTimerInterval);
    }
    App.closeModals();
    App.showToast('Video consultation ended.', 'info');
  }
};
