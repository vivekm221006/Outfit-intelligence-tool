
const Camera = {

  // ────────────────────────────────────────────
  //  STATE
  // ────────────────────────────────────────────

  stream: null,
  videoElement: null,
  _currentFacingMode: 'environment',  // Track ourselves (getSettings is unreliable)
  _isMirrored: false,
  _imageCapture: null,                // ImageCapture API instance
  _capabilities: null,                // Track capabilities
  _unloadHandler: null,               // Page unload cleanup
  _isStarting: false,                 // Prevent concurrent startCamera calls

  // Configuration
  _config: {
    startTimeout: 15000,              // 15s timeout for permission + init
    idealWidth: 1920,                 // Try for 1080p
    idealHeight: 1080,
    fallbackWidth: 1280,
    fallbackHeight: 720,
    minWidth: 640,
    minHeight: 480,
  },

  // ────────────────────────────────────────────
  //  INITIALIZATION
  // ────────────────────────────────────────────

  /**
   * Initialize camera with a video element.
   * Sets up page unload cleanup.
   */
  async init(videoElement) {
    if (!videoElement) {
      throw new Error('Video element is required');
    }

    this.videoElement = videoElement;

    // Auto-cleanup when page is closed/navigated away
    if (!this._unloadHandler) {
      this._unloadHandler = () => this.stopCamera();
      window.addEventListener('beforeunload', this._unloadHandler);
      document.addEventListener('visibilitychange', () => {
        // Pause camera when tab is hidden to save resources
        if (document.hidden && this.stream) {
          this._pauseTracks();
        } else if (!document.hidden && this.stream) {
          this._resumeTracks();
        }
      });
    }
  },

  // ────────────────────────────────────────────
  //  START CAMERA
  // ────────────────────────────────────────────

  /**
   * Start camera preview.
   * @param {boolean} preferRear - true for environment camera, false for user (selfie)
   * @returns {Object} - { width, height, facingMode, capabilities }
   */
  async startCamera(preferRear = true) {
    // Prevent concurrent starts
    if (this._isStarting) {
      console.warn('Camera is already starting');
      return;
    }

    this._isStarting = true;

    try {
      // Stop any existing stream
      this.stopCamera();

      this._currentFacingMode = preferRear ? 'environment' : 'user';

      // Build constraints with progressive fallback
      const stream = await this._requestStream(this._currentFacingMode);
      this.stream = stream;

      // Set up ImageCapture for high-res stills (if supported)
      this._setupImageCapture();

      // Detect capabilities
      this._capabilities = this._detectCapabilities();

      // Connect to video element
      if (this.videoElement) {
        this.videoElement.srcObject = stream;

        // Mirror front camera via CSS
        this._isMirrored = !preferRear;
        this.videoElement.style.transform = this._isMirrored ? 'scaleX(-1)' : 'none';

        // Wait for video to be ready (with timeout)
        await this._waitForVideoReady();
      }

      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();

      this._isStarting = false;

      return {
        width: settings.width || this.videoElement?.videoWidth || 0,
        height: settings.height || this.videoElement?.videoHeight || 0,
        facingMode: this._currentFacingMode,
        capabilities: this._capabilities,
      };

    } catch (error) {
      this._isStarting = false;
      this.stopCamera();

      // Provide user-friendly error messages
      const message = this._getUserFriendlyError(error);
      console.error('Camera start failed:', error);
      throw new Error(message);
    }
  },

  /**
   * Request a camera stream with progressive constraint fallback.
   * Tries ideal → fallback → minimum resolution.
   */
  async _requestStream(facingMode) {
    const attempts = [
      // Attempt 1: Ideal constraints
      {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: this._config.idealWidth },
          height: { ideal: this._config.idealHeight },
        }
      },
      // Attempt 2: Fallback resolution
      {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: this._config.fallbackWidth },
          height: { ideal: this._config.fallbackHeight },
        }
      },
      // Attempt 3: Minimum constraints (any camera)
      {
        video: {
          width: { min: this._config.minWidth },
          height: { min: this._config.minHeight },
        }
      },
      // Attempt 4: Bare minimum — just give us any video
      { video: true }
    ];

    for (let i = 0; i < attempts.length; i++) {
      try {
        return await this._requestWithTimeout(
          navigator.mediaDevices.getUserMedia(attempts[i]),
          this._config.startTimeout
        );
      } catch (err) {
        // If it's a permission error, don't retry with lower constraints
        if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
          throw err;
        }
        // If it's the last attempt, throw
        if (i === attempts.length - 1) {
          throw err;
        }
        console.warn(`Camera attempt ${i + 1} failed, trying fallback...`, err.message);
      }
    }
  },

  /**
   * Wrap a promise with a timeout.
   */
  _requestWithTimeout(promise, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Camera request timed out. The permission dialog may have been dismissed.'));
      }, timeoutMs);

      promise
        .then(result => { clearTimeout(timer); resolve(result); })
        .catch(err => { clearTimeout(timer); reject(err); });
    });
  },

  /**
   * Wait for video element to be ready to play.
   * Handles the race condition where metadata may already be loaded.
   */
  _waitForVideoReady() {
    return new Promise((resolve, reject) => {
      const video = this.videoElement;
      if (!video) return reject(new Error('No video element'));

      const timeout = setTimeout(() => {
        reject(new Error('Video failed to initialize within timeout'));
      }, 10000);

      // If already ready
      if (video.readyState >= 2) { // HAVE_CURRENT_DATA or higher
        clearTimeout(timeout);
        video.play().then(resolve).catch(resolve); // Autoplay may be blocked — still resolve
        return;
      }

      const onReady = () => {
        clearTimeout(timeout);
        video.removeEventListener('loadeddata', onReady);
        video.removeEventListener('error', onError);
        video.play().then(resolve).catch(resolve);
      };

      const onError = (e) => {
        clearTimeout(timeout);
        video.removeEventListener('loadeddata', onReady);
        video.removeEventListener('error', onError);
        reject(new Error('Video element error: ' + (e?.message || 'Unknown')));
      };

      // Use 'loadeddata' instead of 'loadedmetadata' — ensures first frame is available
      video.addEventListener('loadeddata', onReady);
      video.addEventListener('error', onError);
    });
  },

  // ────────────────────────────────────────────
  //  FRAME CAPTURE
  // ────────────────────────────────────────────

  /**
   * Capture the current video frame to a canvas.
   * Handles front-camera mirroring so the captured image
   * matches what the user sees on screen.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {Object} options
   * @param {boolean} options.mirror - Override mirror setting (default: auto based on facing mode)
   * @returns {HTMLCanvasElement}
   */
  captureFrame(canvas, options = {}) {
    if (!this.videoElement) {
      throw new Error('Video element not initialized. Call init() first.');
    }
    if (!canvas) {
      throw new Error('Canvas element is required');
    }

    const video = this.videoElement;

    if (video.readyState < 2) {
      throw new Error('Video is not ready yet. Wait for camera to fully initialize.');
    }

    const width = video.videoWidth || this._config.fallbackWidth;
    const height = video.videoHeight || this._config.fallbackHeight;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    const shouldMirror = options.mirror !== undefined ? options.mirror : this._isMirrored;

    if (shouldMirror) {
      // Draw mirrored so capture matches the preview
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, width, height);

    // Reset transform
    if (shouldMirror) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    return canvas;
  },

  /**
   * Capture a high-resolution still photo using ImageCapture API.
   * Falls back to video frame capture if not supported.
   *
   * @param {HTMLCanvasElement} canvas
   * @returns {HTMLCanvasElement}
   */
  async capturePhoto(canvas) {
    if (!canvas) {
      throw new Error('Canvas element is required');
    }

    // Try ImageCapture API for higher resolution
    if (this._imageCapture) {
      try {
        const blob = await this._imageCapture.takePhoto();
        const bitmap = await createImageBitmap(blob);

        canvas.width = bitmap.width;
        canvas.height = bitmap.height;

        const ctx = canvas.getContext('2d');

        if (this._isMirrored) {
          ctx.translate(bitmap.width, 0);
          ctx.scale(-1, 1);
        }

        ctx.drawImage(bitmap, 0, 0);

        if (this._isMirrored) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        }

        bitmap.close();
        return canvas;
      } catch (err) {
        console.warn('ImageCapture.takePhoto() failed, falling back to frame capture:', err.message);
      }
    }

    // Fallback to standard frame capture
    return this.captureFrame(canvas);
  },

  // ────────────────────────────────────────────
  //  CAMERA SWITCHING
  // ────────────────────────────────────────────

  /**
   * Switch between front and rear camera.
   * @returns {Object} - New camera info { facingMode, width, height }
   */
  async switchCamera() {
    if (!this.stream) {
      throw new Error('No active camera to switch');
    }

    const newFacingMode = this._currentFacingMode === 'environment' ? 'user' : 'environment';
    return this.startCamera(newFacingMode === 'environment');
  },

  /**
   * Get current facing mode.
   */
  getCurrentFacingMode() {
    return this._currentFacingMode;
  },

  /**
   * Check if the device has multiple cameras.
   */
  async hasMultipleCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(d => d.kind === 'videoinput');
      return cameras.length > 1;
    } catch {
      return false;
    }
  },

  // ────────────────────────────────────────────
  //  STOP / CLEANUP
  // ────────────────────────────────────────────

  /**
   * Stop camera and release all resources.
   */
  stopCamera() {
    // Stop all tracks
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
      });
      this.stream = null;
    }

    // Disconnect video element
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement.style.transform = 'none';
    }

    // Clear ImageCapture
    this._imageCapture = null;
    this._capabilities = null;
    this._isMirrored = false;
    this._isStarting = false;
  },

  /**
   * Full cleanup — also removes unload handler.
   * Call this when the app is done with the camera entirely.
   */
  dispose() {
    this.stopCamera();

    if (this._unloadHandler) {
      window.removeEventListener('beforeunload', this._unloadHandler);
      this._unloadHandler = null;
    }

    this.videoElement = null;
  },

  // ────────────────────────────────────────────
  //  CAMERA AVAILABILITY
  // ────────────────────────────────────────────

  /**
   * Check if a camera is available.
   * Note: Before permission is granted, labels are empty
   * but deviceId may still exist on some browsers.
   */
  async isCameraAvailable() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return false;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some(d => d.kind === 'videoinput');
    } catch {
      return false;
    }
  },

  /**
   * Get a list of available cameras with labels (requires permission).
   */
  async getCameraList() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter(d => d.kind === 'videoinput')
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${i + 1}`,
          groupId: d.groupId,
        }));
    } catch {
      return [];
    }
  },

  // ────────────────────────────────────────────
  //  TORCH / FLASH
  // ────────────────────────────────────────────

  /**
   * Check if torch (flashlight) is available.
   */
  hasTorch() {
    return !!(this._capabilities && this._capabilities.torch);
  },

  /**
   * Toggle torch on/off.
   * @param {boolean} enabled
   */
  async setTorch(enabled) {
    if (!this.hasTorch()) {
      throw new Error('Torch is not available on this camera');
    }

    const track = this.stream?.getVideoTracks()[0];
    if (!track) throw new Error('No active video track');

    try {
      await track.applyConstraints({
        advanced: [{ torch: enabled }]
      });
      return true;
    } catch (err) {
      console.warn('Torch control failed:', err);
      throw new Error('Failed to control torch');
    }
  },

  // ────────────────────────────────────────────
  //  ZOOM
  // ────────────────────────────────────────────

  /**
   * Get zoom range.
   * @returns {{ min, max, step, current } | null}
   */
  getZoomRange() {
    if (!this._capabilities?.zoom) return null;

    const track = this.stream?.getVideoTracks()[0];
    const current = track ? track.getSettings().zoom : undefined;

    return {
      min: this._capabilities.zoom.min,
      max: this._capabilities.zoom.max,
      step: this._capabilities.zoom.step,
      current: current || this._capabilities.zoom.min,
    };
  },

  /**
   * Set zoom level.
   * @param {number} level
   */
  async setZoom(level) {
    const range = this.getZoomRange();
    if (!range) throw new Error('Zoom is not available on this camera');

    const clamped = Math.max(range.min, Math.min(range.max, level));
    const track = this.stream?.getVideoTracks()[0];
    if (!track) throw new Error('No active video track');

    try {
      await track.applyConstraints({
        advanced: [{ zoom: clamped }]
      });
    } catch (err) {
      console.warn('Zoom control failed:', err);
      throw new Error('Failed to set zoom level');
    }
  },

  // ────────────────────────────────────────────
  //  INTERNAL HELPERS
  // ────────────────────────────────────────────

  /**
   * Set up ImageCapture API for high-res stills.
   */
  _setupImageCapture() {
    this._imageCapture = null;

    if (typeof ImageCapture === 'undefined') return;

    const track = this.stream?.getVideoTracks()[0];
    if (!track) return;

    try {
      this._imageCapture = new ImageCapture(track);
    } catch (err) {
      console.warn('ImageCapture not supported:', err.message);
    }
  },

  /**
   * Detect camera capabilities (torch, zoom, etc.).
   */
  _detectCapabilities() {
    const track = this.stream?.getVideoTracks()[0];
    if (!track) return null;

    try {
      const capabilities = track.getCapabilities?.() || {};
      return {
        torch: !!capabilities.torch,
        zoom: capabilities.zoom ? {
          min: capabilities.zoom.min,
          max: capabilities.zoom.max,
          step: capabilities.zoom.step || 0.1,
        } : null,
        focusMode: capabilities.focusMode || [],
        whiteBalanceMode: capabilities.whiteBalanceMode || [],
        facingMode: capabilities.facingMode || [],
        width: capabilities.width || null,
        height: capabilities.height || null,
      };
    } catch {
      return null;
    }
  },

  /**
   * Pause all tracks (for background tab).
   */
  _pauseTracks() {
    if (!this.stream) return;
    this.stream.getTracks().forEach(track => {
      if (track.enabled) track.enabled = false;
    });
  },

  /**
   * Resume all tracks (when tab becomes visible).
   */
  _resumeTracks() {
    if (!this.stream) return;
    this.stream.getTracks().forEach(track => {
      if (!track.enabled) track.enabled = true;
    });
  },

  /**
   * Convert error names to user-friendly messages.
   */
  _getUserFriendlyError(error) {
    switch (error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'Camera permission denied. Please allow camera access in your browser settings and try again.';

      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'No camera found on this device.';

      case 'NotReadableError':
      case 'TrackStartError':
        return 'Camera is already in use by another application. Close other apps using the camera and try again.';

      case 'OverconstrainedError':
        return 'Camera does not support the requested settings. Trying with lower quality...';

      case 'SecurityError':
        return 'Camera access is blocked. This page must be served over HTTPS for camera access.';

      case 'AbortError':
        return 'Camera access was interrupted. Please try again.';

      default:
        if (error.message?.includes('timed out')) {
          return 'Camera request timed out. Please try again and respond to any permission prompts.';
        }
        return `Unable to access camera: ${error.message || 'Unknown error'}`;
    }
  },

  /**
   * Get current camera status for debugging.
   */
  getStatus() {
    const track = this.stream?.getVideoTracks()[0];
    return {
      hasStream: !!this.stream,
      isActive: track?.readyState === 'live',
      facingMode: this._currentFacingMode,
      isMirrored: this._isMirrored,
      isStarting: this._isStarting,
      capabilities: this._capabilities,
      settings: track?.getSettings() || null,
      videoReady: this.videoElement ? this.videoElement.readyState >= 2 : false,
    };
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Camera;
}