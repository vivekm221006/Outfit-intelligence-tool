
const App = {

  // ────────────────────────────────────────────
  //  STATE
  // ────────────────────────────────────────────

  currentMode: null,
  garmentColors: { top: null, bottom: null, shoes: null },
  capturedCanvas: null,
  originalImageData: null,
  detectedZones: null,
  cropMode: false,
  pendingCropGarment: null,
  isAnalyzing: false,
  cropClickHandler: null,
  analysisHistory: [],

  // Cached DOM references
  _dom: {},

  // ────────────────────────────────────────────
  //  CONSTANTS
  // ────────────────────────────────────────────

  MAX_IMAGE_DIMENSION: 1920,
  MAX_FILE_SIZE_MB: 15,
  ACCEPTED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  TOAST_DURATION: 4000,

  // ────────────────────────────────────────────
  //  INITIALIZATION
  // ────────────────────────────────────────────

  init() {
    this._cacheDom();
    this._setupEventListeners();
    this._checkCameraAvailability();
    this._updateAnalyzeButton();
    this._setupKeyboardShortcuts();
    this._createToastContainer();
    this._showWelcomeStats();
  },

  /** Cache all repeatedly-accessed DOM elements once */
  _cacheDom() {
    const ids = [
      'manual-mode-btn', 'camera-mode-btn', 'upload-mode-btn',
      'manual-section', 'camera-section', 'upload-section',
      'top-color', 'bottom-color', 'shoes-color',
      'start-camera-btn', 'capture-btn', 'switch-camera-btn',
      'camera-preview', 'capture-canvas', 'upload-canvas',
      'upload-input', 'crop-controls', 'crop-instructions',
      'crop-top-btn', 'crop-bottom-btn', 'crop-shoes-btn', 'cancel-crop-btn',
      'top-preview', 'bottom-preview', 'shoes-preview',
      'top-label', 'bottom-label', 'shoes-label',
      'analyze-btn', 'reset-btn', 'results-section',
      'harmony-type', 'harmony-score', 'harmony-explanation',
      'confidence-score', 'confidence-bar',
      'mood-label', 'mood-explanation',
      'overall-score', 'grade-letter', 'grade-description',
      'score-breakdown', 'comparison-section',
      'comparison-message', 'comparison-details'
    ];

    ids.forEach(id => {
      this._dom[id] = document.getElementById(id);
    });
  },

  /** Shortcut to get a cached DOM element */
  $(id) {
    return this._dom[id] || document.getElementById(id);
  },

  // ────────────────────────────────────────────
  //  EVENT LISTENERS
  // ───��────────────────────────────────────────

  _setupEventListeners() {
    // Mode selection
    this.$('manual-mode-btn').addEventListener('click', () => this.selectMode('manual'));
    this.$('camera-mode-btn').addEventListener('click', () => this.selectMode('camera'));
    this.$('upload-mode-btn').addEventListener('click', () => this.selectMode('upload'));

    // Manual color inputs — live drag + final pick
    ['top', 'bottom', 'shoes'].forEach(garment => {
      const input = this.$(`${garment}-color`);
      const handler = (e) => this._handleManualColorChange(garment, e.target.value);
      input.addEventListener('input', handler);
      input.addEventListener('change', handler);
    });

    // Camera controls
    this.$('start-camera-btn').addEventListener('click', () => this._startCamera());
    this.$('capture-btn').addEventListener('click', () => this._captureFrame());
    this.$('switch-camera-btn').addEventListener('click', () => this._switchCamera());

    // Upload
    this.$('upload-input').addEventListener('change', (e) => this._handleImageUpload(e));

    // Drag-and-drop on upload zone
    this._setupDragDrop();

    // Crop controls
    this.$('crop-top-btn').addEventListener('click', () => this._startCrop('top'));
    this.$('crop-bottom-btn').addEventListener('click', () => this._startCrop('bottom'));
    this.$('crop-shoes-btn').addEventListener('click', () => this._startCrop('shoes'));
    this.$('cancel-crop-btn').addEventListener('click', () => this._cancelCrop());

    // Analyze & reset
    this.$('analyze-btn').addEventListener('click', () => this._analyzeOutfit());
    this.$('reset-btn').addEventListener('click', () => this._reset());
  },

  /** Setup drag-and-drop on the upload section */
  _setupDragDrop() {
    const uploadSection = this.$('upload-section');
    if (!uploadSection) return;

    const dropZone = uploadSection.querySelector('.border-dashed');
    if (!dropZone) return;

    ['dragenter', 'dragover'].forEach(evt => {
      dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZone.classList.add('border-blue-500');
        dropZone.style.background = 'rgba(99, 102, 241, 0.08)';
      });
    });

    ['dragleave', 'drop'].forEach(evt => {
      dropZone.addEventListener(evt, () => {
        dropZone.classList.remove('border-blue-500');
        dropZone.style.background = '';
      });
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file) this._processUploadedFile(file);
    });
  },

  /** Keyboard shortcuts */
  _setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Escape → cancel crop
      if (e.key === 'Escape' && this.cropMode) {
        this._cancelCrop();
      }

      // Enter → analyze (when ready)
      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        const btn = this.$('analyze-btn');
        if (btn && !btn.disabled && !this.isAnalyzing) {
          e.preventDefault();
          this._analyzeOutfit();
        }
      }

      // Ctrl/Cmd + Z → undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        this._undoAnalysis();
      }
    });
  },

  // ────────────────────────────────────────────
  //  TOAST NOTIFICATIONS
  // ────────────────────────────────────────────

  _createToastContainer() {
    if (document.getElementById('toast-container')) return;

    const container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed; top: 1.5rem; right: 1.5rem; z-index: 10000;
      display: flex; flex-direction: column; gap: 0.75rem;
      pointer-events: none; max-width: 420px;
    `;
    document.body.appendChild(container);
  },

  /**
   * Show a toast notification.
   * @param {string} message
   * @param {'info'|'success'|'warning'|'error'} type
   */
  _toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const styles = {
      info:    { bg: 'rgba(99, 102, 241, 0.95)',  icon: 'ℹ️' },
      success: { bg: 'rgba(16, 185, 129, 0.95)',   icon: '✅' },
      warning: { bg: 'rgba(245, 158, 11, 0.95)',   icon: '⚠️' },
      error:   { bg: 'rgba(239, 68, 68, 0.95)',    icon: '❌' },
    };

    const cfg = styles[type] || styles.info;

    const toast = document.createElement('div');
    toast.style.cssText = `
      background: ${cfg.bg}; color: white; padding: 0.875rem 1.25rem;
      border-radius: 0.75rem; font-size: 0.9rem; font-weight: 500;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3); pointer-events: auto;
      display: flex; align-items: center; gap: 0.5rem;
      transform: translateX(120%); transition: all 0.4s cubic-bezier(0.25,0.46,0.45,0.94);
      cursor: pointer; backdrop-filter: blur(8px); line-height: 1.4;
    `;
    toast.textContent = `${cfg.icon}  ${message}`;
    toast.addEventListener('click', () => this._dismissToast(toast));

    container.appendChild(toast);
    requestAnimationFrame(() => { toast.style.transform = 'translateX(0)'; });

    setTimeout(() => this._dismissToast(toast), this.TOAST_DURATION);
  },

  _dismissToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.style.transform = 'translateX(120%)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  },

  // ────────────────────────────────────────────
  //  WELCOME / STATS
  // ────────────────────────────────────────────

  /** Show returning user stats on load */
  _showWelcomeStats() {
    const count = Comparison.getHistoryCount();
    if (count > 0) {
      const stats = Comparison.getStatistics();
      const best = Comparison.getPersonalBest();
      const bestScore = best ? best.score.total : 0;

      setTimeout(() => {
        this._toast(
          `Welcome back! ${count} outfit${count !== 1 ? 's' : ''} analyzed · Avg: ${stats.averageScore} · Best: ${bestScore}/100`,
          'info'
        );
      }, 800);
    }
  },

  // ────────────────────────────────────────────
  //  CAMERA AVAILABILITY
  // ────────────────────────────────────────────

  async _checkCameraAvailability() {
    try {
      const available = await Camera.isCameraAvailable();
      if (!available) {
        const btn = this.$('camera-mode-btn');
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
        btn.title = 'Camera not available on this device';
      } else {
        // Check for multiple cameras to conditionally show switch button
        const hasMultiple = await Camera.hasMultipleCameras();
        if (!hasMultiple) {
          this.$('switch-camera-btn').style.display = 'none';
        }
      }
    } catch (err) {
      console.warn('Camera check failed:', err);
    }
  },

  // ────────────────────────────────────────────
  //  MODE SELECTION
  // ────────────────────────────────────────────

  selectMode(mode) {
    // Stop camera if switching away
    if (this.currentMode === 'camera' && mode !== 'camera') {
      Camera.stopCamera();
      this.$('camera-preview').classList.add('hidden');
      this.$('capture-btn').disabled = true;
      this.$('switch-camera-btn').disabled = true;
      this.$('start-camera-btn').textContent = '📷 Start Camera';
      this.$('start-camera-btn').disabled = false;
    }

    // Cancel active crop
    if (this.cropMode) {
      this._cancelCrop();
    }

    this.currentMode = mode;

    // Update button ring states
    ['manual', 'camera', 'upload'].forEach(m => {
      const btn = this.$(`${m}-mode-btn`);
      btn.classList.toggle('ring-2', m === mode);
      btn.classList.toggle('ring-blue-500', m === mode);
    });

    // Show/hide sections
    this.$('manual-section').classList.toggle('hidden', mode !== 'manual');
    this.$('camera-section').classList.toggle('hidden', mode !== 'camera');
    this.$('upload-section').classList.toggle('hidden', mode !== 'upload');

    // Reset color state
    this.garmentColors = { top: null, bottom: null, shoes: null };
    this.originalImageData = null;
    this._updateColorPreviews();
    this._updateAnalyzeButton();

    // Hide results and crop controls
    this.$('results-section').classList.add('hidden');
    this.$('crop-controls').classList.add('hidden');

    // Auto-initialize manual mode
    if (mode === 'manual') {
      requestAnimationFrame(() => {
        ['top', 'bottom', 'shoes'].forEach(garment => {
          const input = this.$(`${garment}-color`);
          if (input) this._handleManualColorChange(garment, input.value);
        });
      });
    }

    const modeNames = { manual: 'Manual Colors', camera: 'Live Camera', upload: 'Image Upload' };
    this._toast(`Switched to ${modeNames[mode]} mode`, 'info');
  },

  // ────────────────────────────────────────────
  //  MANUAL COLOR INPUT
  // ────────────────────────────────────────────

  _handleManualColorChange(garment, hexColor) {
    const rgb = this.hexToRgb(hexColor);
    if (!rgb) return;

    const hsl = ColorAnalysis.rgbToHsl(rgb.r, rgb.g, rgb.b);

    this.garmentColors[garment] = {
      rgb,
      hsl,
      hex: hexColor,
      name: ColorAnalysis.getColorDescription({ hsl }),
      confidence: 1.0,
      dominantColors: [],
      isPattern: false,
    };

    this._updateColorPreviews();
    this._updateAnalyzeButton();
  },

  // ────────────────────────────────────────────
  //  CAMERA
  // ────────────────────────────────────────────

  async _startCamera() {
    const btn = this.$('start-camera-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Starting…';

    try {
      const video = this.$('camera-preview');
      await Camera.init(video);
      const info = await Camera.startCamera(true);

      video.classList.remove('hidden');
      this.$('capture-btn').disabled = false;
      this.$('switch-camera-btn').disabled = false;

      btn.textContent = '📷 Camera Active';

      const resolution = info ? `${info.width}×${info.height}` : '';
      this._toast(`Camera started ${resolution ? `(${resolution})` : ''}`, 'success');

      // Show torch button if available
      if (Camera.hasTorch()) {
        this._toast('💡 Flashlight available — torch support detected', 'info');
      }
    } catch (error) {
      btn.disabled = false;
      btn.textContent = '📷 Start Camera';
      this._toast(error.message || 'Failed to start camera', 'error');
    }
  },

  async _switchCamera() {
    try {
      const info = await Camera.switchCamera();
      const mode = Camera.getCurrentFacingMode();
      this._toast(`Switched to ${mode === 'environment' ? 'rear' : 'front'} camera`, 'info');
    } catch (error) {
      this._toast('Failed to switch camera: ' + error.message, 'error');
    }
  },

  async _captureFrame() {
    try {
      const canvas = this.$('capture-canvas');

      // Try high-res capture first, fallback to frame capture
      try {
        await Camera.capturePhoto(canvas);
      } catch {
        Camera.captureFrame(canvas);
      }

      Camera.stopCamera();
      this.$('camera-preview').classList.add('hidden');
      this.$('start-camera-btn').textContent = '📷 Start Camera';
      this.$('start-camera-btn').disabled = false;

      canvas.classList.remove('hidden');
      this._processImage(canvas);
      this._toast('Frame captured! Colors auto-detected.', 'success');
    } catch (error) {
      this._toast('Failed to capture frame: ' + error.message, 'error');
    }
  },

  // ────────────────────────────────────────────
  //  IMAGE UPLOAD
  // ────────────────────────────────────────────

  _handleImageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    this._processUploadedFile(file);
  },

  _processUploadedFile(file) {
    // Validate type
    if (!this.ACCEPTED_TYPES.includes(file.type)) {
      this._toast(`Unsupported file type. Use JPG, PNG, or WebP.`, 'error');
      return;
    }

    // Validate size
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > this.MAX_FILE_SIZE_MB) {
      this._toast(`File too large (${sizeMB.toFixed(1)}MB). Max ${this.MAX_FILE_SIZE_MB}MB.`, 'error');
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => {
      this._toast('Failed to read file', 'error');
    };

    reader.onload = (e) => {
      const img = new Image();

      img.onerror = () => {
        this._toast('Failed to load image. It may be corrupted.', 'error');
      };

      img.onload = () => {
        const canvas = this.$('upload-canvas');

        // Downscale if needed
        let { width, height } = img;
        if (width > this.MAX_IMAGE_DIMENSION || height > this.MAX_IMAGE_DIMENSION) {
          const ratio = Math.min(this.MAX_IMAGE_DIMENSION / width, this.MAX_IMAGE_DIMENSION / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.classList.remove('hidden');
        this._processImage(canvas);
        this._toast(`Image loaded (${width}×${height}). Colors auto-detected.`, 'success');
      };

      img.src = e.target.result;
    };

    reader.readAsDataURL(file);
  },

  // ────────────────────────────────────────────
  //  IMAGE PROCESSING
  // ────────────────────────────────────────────

  _processImage(canvas) {
    this.capturedCanvas = canvas;

    const ctx = canvas.getContext('2d');
    this.originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Smart zone detection (with body column detection)
    this.detectedZones = GarmentDetection.detectZones(canvas, { smartCrop: true });

    // Extract colors with skin rejection and confidence
    this.garmentColors = GarmentDetection.extractZoneColors(canvas, this.detectedZones);

    // Draw zones with extracted color swatches
    GarmentDetection.drawZones(canvas, this.detectedZones, {
      showSamplingRect: true,
      extractedColors: this.garmentColors,
    });

    // Show crop controls
    this.$('crop-controls').classList.remove('hidden');

    this._updateColorPreviews();
    this._updateAnalyzeButton();

    // Show confidence warnings for low-confidence zones
    ['top', 'bottom', 'shoes'].forEach(garment => {
      const color = this.garmentColors[garment];
      if (color && color.confidence < 0.4) {
        this._toast(
          `Low confidence for ${garment} color — consider manually selecting the region`,
          'warning'
        );
      }
    });
  },

  // ────────────────────────────────────────────
  //  CROP TOOL
  // ────────────────────────────────────────────

  _startCrop(garment) {
    if (!this.capturedCanvas || !this.originalImageData) return;

    // Cancel existing crop first
    if (this.cropMode) {
      this._cancelCrop();
    }

    this.cropMode = true;
    this.pendingCropGarment = garment;

    // Restore original image
    const ctx = this.capturedCanvas.getContext('2d');
    ctx.putImageData(this.originalImageData, 0, 0);

    // Initialize crop tool
    CropTool.init(this.capturedCanvas);

    // Show instructions
    const instructions = this.$('crop-instructions');
    instructions.classList.remove('hidden');
    const labels = { top: '👕 Top', bottom: '👖 Bottom', shoes: '👟 Shoes' };
    instructions.textContent = `Drag on the image to select the ${labels[garment] || garment} region`;

    this._setupCropCompletion();
  },

  _setupCropCompletion() {
    const canvas = this.capturedCanvas;

    // Remove stacked handler
    if (this.cropClickHandler) {
      canvas.removeEventListener('click', this.cropClickHandler);
      this.cropClickHandler = null;
    }

    this.cropClickHandler = () => {
      if (CropTool.isSelecting) return;

      setTimeout(() => {
        const selection = CropTool.getSelection();
        if (selection) {
          const color = CropTool.extractColorFromCrop(selection);
          if (color) {
            // Add confidence and pattern data for manually-cropped regions
            color.confidence = 0.95; // Manual selection = high confidence
            color.dominantColors = [];
            color.isPattern = false;

            this.garmentColors[this.pendingCropGarment] = color;
            this._updateColorPreviews();
            this._updateAnalyzeButton();
            this._toast(`${this.pendingCropGarment} color updated from selection`, 'success');
          }
        }

        // Cleanup
        CropTool.destroy();
        this.cropMode = false;
        this.$('crop-instructions').classList.add('hidden');

        canvas.removeEventListener('click', this.cropClickHandler);
        this.cropClickHandler = null;

        // Redraw zones
        if (this.originalImageData && this.detectedZones) {
          const ctx = canvas.getContext('2d');
          ctx.putImageData(this.originalImageData, 0, 0);
          GarmentDetection.drawZones(canvas, this.detectedZones, {
            showSamplingRect: true,
            extractedColors: this.garmentColors,
          });
        }
      }, 100);
    };

    canvas.addEventListener('click', this.cropClickHandler);
  },

  _cancelCrop() {
    if (!this.cropMode) return;

    CropTool.destroy();
    this.cropMode = false;
    this.$('crop-instructions').classList.add('hidden');

    if (this.cropClickHandler && this.capturedCanvas) {
      this.capturedCanvas.removeEventListener('click', this.cropClickHandler);
      this.cropClickHandler = null;
    }

    // Restore original + redraw zones
    if (this.originalImageData && this.capturedCanvas && this.detectedZones) {
      const ctx = this.capturedCanvas.getContext('2d');
      ctx.putImageData(this.originalImageData, 0, 0);
      GarmentDetection.drawZones(this.capturedCanvas, this.detectedZones, {
        showSamplingRect: true,
        extractedColors: this.garmentColors,
      });
    }
  },

  // ────────────────────────────────────────────
  //  COLOR PREVIEWS — Enhanced with confidence
  // ────────────────────────────────────────────

  _updateColorPreviews() {
    ['top', 'bottom', 'shoes'].forEach(garment => {
      const preview = this.$(`${garment}-preview`);
      const label = this.$(`${garment}-label`);
      if (!preview || !label) return;

      const color = this.garmentColors[garment];
      if (color) {
        preview.style.backgroundColor = color.hex;
        preview.classList.remove('opacity-50');

        // Build label with name, hex, and confidence
        let labelText = `${color.name} (${color.hex})`;

        if (color.confidence !== undefined && color.confidence < 1.0) {
          const pct = Math.round(color.confidence * 100);
          labelText += ` · ${pct}% confident`;
        }

        if (color.isPattern) {
          labelText += ' · 🔲 Pattern detected';
        }

        label.textContent = labelText;
      } else {
        preview.style.backgroundColor = '#374151';
        label.textContent = 'Not detected';
        preview.classList.add('opacity-50');
      }
    });
  },

  // ────────────────────────────────────────────
  //  ANALYZE BUTTON STATE
  // ────────────────────────────────────────────

  _updateAnalyzeButton() {
    const btn = this.$('analyze-btn');
    if (!btn) return;

    const ready = !!(this.garmentColors.top && this.garmentColors.bottom && this.garmentColors.shoes);

    btn.disabled = !ready || this.isAnalyzing;
    btn.classList.toggle('opacity-50', !ready);
    btn.classList.toggle('cursor-not-allowed', !ready);
  },

  // ────────────────────────────────────────────
  //  OUTFIT ANALYSIS — Full pipeline
  // ────────────────────────────────────────────

  async _analyzeOutfit() {
    const colors = [
      this.garmentColors.top,
      this.garmentColors.bottom,
      this.garmentColors.shoes
    ].filter(Boolean);

    if (colors.length < 3) {
      this._toast('Please ensure all three garment colors are detected.', 'warning');
      return;
    }

    if (this.isAnalyzing) return;
    this.isAnalyzing = true;

    const btn = this.$('analyze-btn');
    const originalText = btn.textContent;
    btn.textContent = '⏳ Analyzing…';
    btn.disabled = true;

    try {
      // Let UI update before heavy computation
      await new Promise(resolve => requestAnimationFrame(resolve));

      // Core analysis
      const harmonyResult = ColorAnalysis.analyzeHarmony(colors);
      const confidence = Scoring.calculateConfidence(colors);
      const mood = Scoring.detectMood(colors);
      const scoreResult = Scoring.calculateOutfitScore(colors, harmonyResult);
      const grade = Scoring.getGrade(scoreResult.total);

      // Suggestions from ColorAnalysis
      const suggestions = ColorAnalysis.generateSuggestions(colors, harmonyResult);

      // Temperature analysis
      const temperature = ColorAnalysis.analyzeTemperature(colors);

      // WCAG contrast ratios
      const contrastRatios = [];
      for (let i = 0; i < colors.length; i++) {
        for (let j = i + 1; j < colors.length; j++) {
          contrastRatios.push({
            pair: `${['Top', 'Bottom', 'Shoes'][i]} ↔ ${['Top', 'Bottom', 'Shoes'][j]}`,
            ratio: ColorAnalysis.calculateContrast(colors[i], colors[j]),
          });
        }
      }

      const analysisData = {
        timestamp: new Date().toISOString(),
        colors: { ...this.garmentColors },
        harmony: harmonyResult,
        confidence,
        mood,
        score: scoreResult,
        grade,
        suggestions,
        temperature,
        contrastRatios,
      };

      // Save to undo history
      this.analysisHistory.push(analysisData);

      // Compare with previous
      const comparison = Comparison.compareOutfits(analysisData);

      // Save to persistent storage
      Comparison.saveAnalysis(analysisData);

      // Display results
      this._displayResults(analysisData, comparison);

      // Personal best notification
      if (comparison.isNewPersonalBest && comparison.hasPrevious) {
        setTimeout(() => {
          this._toast(`🏆 New personal best! ${scoreResult.total}/100`, 'success');
        }, 1500);
      }

      this._toast(
        `Score: ${scoreResult.total}/100 — ${grade.letter} (${grade.description})`,
        scoreResult.total >= 75 ? 'success' : scoreResult.total >= 50 ? 'warning' : 'error'
      );

    } catch (error) {
      console.error('Analysis failed:', error);
      this._toast('Analysis failed: ' + (error.message || 'Unknown error'), 'error');
    } finally {
      this.isAnalyzing = false;
      btn.textContent = originalText;
      this._updateAnalyzeButton();
    }
  },

  // ────────────────────────────────────────────
  //  DISPLAY RESULTS — Animated & comprehensive
  // ────────────────────────────────────────────

  _displayResults(analysis, comparison) {
    // ── Harmony ──
    this.$('harmony-type').textContent = analysis.harmony.type;
    this.$('harmony-score').textContent = `${analysis.harmony.score}/100`;
    this.$('harmony-explanation').textContent = analysis.harmony.explanation;

    // ── Confidence — animated ──
    this._animateCounter(this.$('confidence-score'), analysis.confidence, val => `${val} / 100`);
    this.$('confidence-bar').style.width = '0%';
    requestAnimationFrame(() => {
      this.$('confidence-bar').style.width = `${analysis.confidence}%`;
    });

    // ── Mood ──
    this.$('mood-label').textContent = `${analysis.mood.emoji} ${analysis.mood.mood}`;
    this.$('mood-explanation').textContent = analysis.mood.explanation;

    // ── Overall score — animated ──
    this._animateCounter(this.$('overall-score'), analysis.score.total);

    // ── Grade ──
    const gradeLetter = this.$('grade-letter');
    gradeLetter.textContent = analysis.grade.letter;
    gradeLetter.className = `text-6xl font-bold ${analysis.grade.color}`;
    this.$('grade-description').textContent = analysis.grade.description;

    // ── Score breakdown ──
    this._buildScoreBreakdown(analysis.score.breakdown);

    // ── Suggestions panel ──
    this._buildSuggestionsPanel(analysis.suggestions);

    // ── Temperature info ──
    this._buildTemperatureInfo(analysis.temperature);

    // ── Contrast ratios ──
    this._buildContrastInfo(analysis.contrastRatios);

    // ── Comparison ──
    if (comparison.hasPrevious) {
      this.$('comparison-section').classList.remove('hidden');
      this.$('comparison-message').textContent = comparison.message;

      if (comparison.details && comparison.details.length > 0) {
        this._buildComparisonDetails(comparison.details);
      }

      // Trend info
      if (comparison.trend && comparison.trend.message) {
        this._buildTrendInfo(comparison.trend);
      }
    } else {
      this.$('comparison-section').classList.add('hidden');
    }

    // Show results
    this.$('results-section').classList.remove('hidden');

    // Scroll to results
    setTimeout(() => {
      this.$('results-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  },

  // ────────────────────────────────────────────
  //  RESULT BUILDERS — Safe DOM construction
  // ────────────────────────────────────────────

  /** Animate a number counting up */
  _animateCounter(element, target, formatter) {
    if (!element) return;

    const duration = 800;
    const start = performance.now();
    const format = formatter || (val => String(val));

    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = format(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  },

  /** Build score breakdown rows with staggered animation */
  _buildScoreBreakdown(breakdown) {
    const container = this.$('score-breakdown');
    if (!container) return;
    container.innerHTML = '';

    breakdown.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'flex justify-between items-center p-3 bg-gray-700 rounded';
      row.style.opacity = '0';
      row.style.transform = 'translateY(10px)';
      row.style.transition = `all 0.4s cubic-bezier(0.25,0.46,0.45,0.94) ${index * 80}ms`;

      const left = document.createElement('div');

      const category = document.createElement('div');
      category.className = 'font-medium';
      category.textContent = item.category;
      left.appendChild(category);

      const detail = document.createElement('div');
      detail.className = 'text-sm text-gray-400';
      detail.textContent = item.detail;
      left.appendChild(detail);

      const right = document.createElement('div');
      right.className = 'text-lg font-bold';
      right.textContent = `${item.points}/${item.max}`;

      // Color-code the score
      const ratio = item.points / item.max;
      if (ratio >= 0.8) right.classList.add('text-green-400');
      else if (ratio >= 0.5) right.classList.add('text-yellow-400');
      else right.classList.add('text-red-400');

      row.appendChild(left);
      row.appendChild(right);
      container.appendChild(row);

      // Trigger animation
      requestAnimationFrame(() => {
        row.style.opacity = '1';
        row.style.transform = 'translateY(0)';
      });
    });
  },

  /** Build suggestions panel (injected after score breakdown) */
  _buildSuggestionsPanel(suggestions) {
    // Remove existing suggestions panel
    const existing = document.getElementById('suggestions-panel');
    if (existing) existing.remove();

    if (!suggestions || suggestions.length === 0) return;

    const scoreBreakdown = this.$('score-breakdown');
    if (!scoreBreakdown) return;

    const panel = document.createElement('div');
    panel.id = 'suggestions-panel';
    panel.className = 'bg-slate-700 rounded-lg p-6 mb-6';
    panel.style.opacity = '0';
    panel.style.transform = 'translateY(10px)';
    panel.style.transition = 'all 0.5s cubic-bezier(0.25,0.46,0.45,0.94) 0.3s';

    const title = document.createElement('h3');
    title.className = 'text-xl font-bold mb-3 text-purple-400';
    title.textContent = '💡 Styling Suggestions';
    panel.appendChild(title);

    const list = document.createElement('ul');
    list.className = 'space-y-2';

    suggestions.forEach(suggestion => {
      const li = document.createElement('li');
      li.className = 'flex gap-2 text-gray-300';

      const bullet = document.createElement('span');
      bullet.textContent = '→';
      bullet.className = 'text-purple-400 flex-shrink-0 mt-0.5';

      const text = document.createElement('span');
      text.textContent = suggestion;

      li.appendChild(bullet);
      li.appendChild(text);
      list.appendChild(li);
    });

    panel.appendChild(list);

    // Insert after the score breakdown's parent (the mb-6 div)
    const breakdownParent = scoreBreakdown.closest('.mb-6') || scoreBreakdown.parentElement;
    if (breakdownParent && breakdownParent.nextSibling) {
      breakdownParent.parentNode.insertBefore(panel, breakdownParent.nextSibling);
    } else {
      scoreBreakdown.parentNode.appendChild(panel);
    }

    requestAnimationFrame(() => {
      panel.style.opacity = '1';
      panel.style.transform = 'translateY(0)';
    });
  },

  /** Build temperature info block */
  _buildTemperatureInfo(temperature) {
    const existing = document.getElementById('temperature-info');
    if (existing) existing.remove();

    if (!temperature) return;

    const harmonySection = this.$('harmony-explanation');
    if (!harmonySection) return;

    const info = document.createElement('div');
    info.id = 'temperature-info';
    info.className = 'mt-3 p-3 bg-slate-800 rounded text-sm';

    const tempEmoji = temperature.dominant === 'warm' ? '🔥' : temperature.dominant === 'cool' ? '❄️' : '⚖️';
    const coherencePct = Math.round(temperature.coherence * 100);

    info.innerHTML = '';
    const text = document.createElement('span');
    text.className = 'text-gray-300';
    text.textContent = `${tempEmoji} Temperature: ${temperature.dominant.charAt(0).toUpperCase() + temperature.dominant.slice(1)} (${coherencePct}% coherent) · Warm: ${temperature.warmCount} · Cool: ${temperature.coolCount} · Neutral: ${temperature.neutralCount}`;
    info.appendChild(text);

    harmonySection.parentNode.insertBefore(info, harmonySection.nextSibling);
  },

  /** Build contrast ratios info */
  _buildContrastInfo(contrastRatios) {
    const existing = document.getElementById('contrast-info');
    if (existing) existing.remove();

    if (!contrastRatios || contrastRatios.length === 0) return;

    const confidenceSection = this.$('confidence-score');
    if (!confidenceSection) return;

    const container = confidenceSection.closest('.bg-slate-700');
    if (!container) return;

    const info = document.createElement('div');
    info.id = 'contrast-info';
    info.className = 'mt-3 space-y-1';

    contrastRatios.forEach(cr => {
      const row = document.createElement('div');
      row.className = 'flex justify-between text-sm';

      const label = document.createElement('span');
      label.className = 'text-gray-400';
      label.textContent = cr.pair;

      const value = document.createElement('span');
      value.className = 'font-semibold';
      const ratioVal = cr.ratio.toFixed(1);
      value.textContent = `${ratioVal}:1`;

      // WCAG color coding
      if (cr.ratio >= 7) value.classList.add('text-green-400');
      else if (cr.ratio >= 4.5) value.classList.add('text-yellow-400');
      else value.classList.add('text-red-400');

      row.appendChild(label);
      row.appendChild(value);
      info.appendChild(row);
    });

    container.appendChild(info);
  },

  /** Build comparison details with structured data */
  _buildComparisonDetails(details) {
    const container = this.$('comparison-details');
    if (!container) return;
    container.innerHTML = '';

    details.forEach(detail => {
      const li = document.createElement('li');
      li.className = 'text-gray-300 flex items-center gap-2';

      // Use structured data if available
      if (typeof detail === 'object' && detail.text) {
        const icon = document.createElement('span');
        icon.textContent = detail.icon || '•';
        li.appendChild(icon);

        const text = document.createElement('span');
        text.textContent = detail.text;

        // Color-code sentiment
        if (detail.sentiment === 'positive') text.classList.add('text-green-400');
        else if (detail.sentiment === 'negative') text.classList.add('text-red-400');

        li.appendChild(text);
      } else {
        // Fallback for plain strings
        li.textContent = typeof detail === 'string' ? detail : detail.text || '';
      }

      container.appendChild(li);
    });
  },

  /** Build trend info block */
  _buildTrendInfo(trend) {
    const existing = document.getElementById('trend-info');
    if (existing) existing.remove();

    if (!trend || !trend.message || trend.direction === 'insufficient') return;

    const compSection = this.$('comparison-section');
    if (!compSection) return;

    const info = document.createElement('div');
    info.id = 'trend-info';
    info.className = 'mt-4 p-4 bg-slate-800 rounded-lg';

    const title = document.createElement('div');
    title.className = 'font-semibold mb-2 text-purple-400';
    title.textContent = '📊 Trend Analysis';
    info.appendChild(title);

    const message = document.createElement('p');
    message.className = 'text-gray-300 text-sm mb-2';
    message.textContent = trend.message;
    info.appendChild(message);

    // Mini score chart (text-based)
    if (trend.recentScores && trend.recentScores.length > 1) {
      const chart = document.createElement('div');
      chart.className = 'flex items-end gap-1 mt-2';
      chart.style.height = '40px';

      const maxScore = Math.max(...trend.recentScores, 1);

      trend.recentScores.forEach((score, i) => {
        const bar = document.createElement('div');
        const heightPct = (score / maxScore) * 100;
        bar.style.cssText = `
          flex: 1; min-width: 8px; max-width: 24px;
          height: ${heightPct}%; border-radius: 3px 3px 0 0;
          transition: height 0.5s ease ${i * 50}ms;
        `;

        // Color: green for recent, dimmer for older
        const isLast = i === trend.recentScores.length - 1;
        if (isLast) {
          bar.style.background = 'linear-gradient(to top, #818cf8, #a855f7)';
        } else {
          bar.style.background = 'rgba(129, 140, 248, 0.3)';
        }

        bar.title = `Score: ${score}`;
        chart.appendChild(bar);
      });

      info.appendChild(chart);
    }

    // Stats line
    if (trend.totalAnalyses > 1) {
      const stats = document.createElement('div');
      stats.className = 'text-xs text-gray-400 mt-2';
      stats.textContent = `${trend.totalAnalyses} outfits analyzed · Average: ${trend.averageScore}/100${trend.streak > 0 ? ` · ${trend.streak} improvement streak 🔥` : ''}`;
      info.appendChild(stats);
    }

    compSection.appendChild(info);
  },

  // ────────────────────────────────────────────
  //  UNDO
  // ────────────────────────────────────────────

  _undoAnalysis() {
    if (this.analysisHistory.length < 2) {
      this._toast('No previous analysis to undo', 'info');
      return;
    }

    this.analysisHistory.pop();
    const previous = this.analysisHistory[this.analysisHistory.length - 1];

    if (previous) {
      this.garmentColors = { ...previous.colors };
      this._updateColorPreviews();
      this._updateAnalyzeButton();

      const comparison = Comparison.compareOutfits(previous);
      this._displayResults(previous, comparison);
      this._toast('Reverted to previous analysis', 'info');
    }
  },

  // ────────────────────────────────────────────
  //  RESET
  // ────────────────────────────────────────────

  _reset() {
    if (this.cropMode) {
      this._cancelCrop();
    }

    this.currentMode = null;
    this.garmentColors = { top: null, bottom: null, shoes: null };
    this.capturedCanvas = null;
    this.originalImageData = null;
    this.detectedZones = null;
    this.cropMode = false;
    this.isAnalyzing = false;

    // Reset mode buttons
    ['manual', 'camera', 'upload'].forEach(m => {
      this.$(`${m}-mode-btn`).classList.remove('ring-2', 'ring-blue-500');
    });

    // Hide sections
    ['manual-section', 'camera-section', 'upload-section', 'results-section', 'crop-controls'].forEach(id => {
      this.$(id).classList.add('hidden');
    });

    // Clear canvases & free memory
    ['capture-canvas', 'upload-canvas'].forEach(id => {
      const canvas = this.$(id);
      canvas.classList.add('hidden');
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 1;
      canvas.height = 1;
    });

    // Stop camera
    Camera.stopCamera();
    this.$('camera-preview').classList.add('hidden');
    this.$('start-camera-btn').textContent = '📷 Start Camera';
    this.$('start-camera-btn').disabled = false;
    this.$('capture-btn').disabled = true;
    this.$('switch-camera-btn').disabled = true;

    // Reset upload input
    this.$('upload-input').value = '';

    // Remove dynamically injected panels
    ['suggestions-panel', 'temperature-info', 'contrast-info', 'trend-info'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    this._updateColorPreviews();
    this._updateAnalyzeButton();

    window.scrollTo({ top: 0, behavior: 'smooth' });
    this._toast('Reset complete — ready for a new outfit!', 'info');
  },

  // ────────────────────────────────────────────
  //  UTILITIES
  // ────────────────────────────────────────────

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  },
};

// ── Bootstrap ──
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});