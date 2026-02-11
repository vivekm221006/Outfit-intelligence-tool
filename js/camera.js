// Camera Module
// Handles camera access, video preview, and frame capture

const Camera = {
  stream: null,
  videoElement: null,

  // Initialize camera with video element
  async init(videoElement) {
    this.videoElement = videoElement;
  },

  // Start camera preview
  async startCamera(preferRear = true) {
    try {
      // Stop any existing stream
      this.stopCamera();

      // Request camera access
      const constraints = {
        video: {
          facingMode: preferRear ? { ideal: 'environment' } : 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (this.videoElement) {
        this.videoElement.srcObject = this.stream;
        
        // Wait for video to be ready
        await new Promise((resolve) => {
          this.videoElement.onloadedmetadata = () => {
            this.videoElement.play();
            resolve();
          };
        });
      }

      return true;
    } catch (error) {
      console.error('Camera access error:', error);
      throw new Error('Unable to access camera. Please ensure you have granted camera permissions.');
    }
  },

  // Capture current frame from video
  captureFrame(canvas) {
    if (!this.videoElement || !canvas) {
      throw new Error('Video or canvas element not initialized');
    }

    const ctx = canvas.getContext('2d');
    
    // Set canvas size to match video
    canvas.width = this.videoElement.videoWidth || 640;
    canvas.height = this.videoElement.videoHeight || 480;
    
    // Draw current video frame to canvas
    ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);
    
    return canvas;
  },

  // Stop camera stream
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  },

  // Check if camera is available
  async isCameraAvailable() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some(device => device.kind === 'videoinput');
    } catch (error) {
      return false;
    }
  },

  // Switch between front and rear camera
  async switchCamera() {
    if (!this.stream) return;
    
    const currentTrack = this.stream.getVideoTracks()[0];
    const currentFacingMode = currentTrack.getSettings().facingMode;
    
    const newFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
    
    await this.startCamera(newFacingMode === 'environment');
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Camera;
}
