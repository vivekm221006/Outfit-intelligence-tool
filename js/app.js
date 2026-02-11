// Main Application Logic
// Handles UI flow, event handling, and orchestration

const App = {
  // State
  currentMode: null, // 'manual', 'camera', 'upload'
  garmentColors: {
    top: null,
    bottom: null,
    shoes: null
  },
  capturedCanvas: null,
  detectedZones: null,
  cropMode: false,
  pendingCropGarment: null,

  // Initialize application
  init() {
    this.setupEventListeners();
    this.checkCameraAvailability();
    this.updateAnalyzeButton();
  },

  // Setup all event listeners
  setupEventListeners() {
    // Input mode selection
    document.getElementById('manual-mode-btn').addEventListener('click', () => this.selectMode('manual'));
    document.getElementById('camera-mode-btn').addEventListener('click', () => this.selectMode('camera'));
    document.getElementById('upload-mode-btn').addEventListener('click', () => this.selectMode('upload'));

    // Manual color inputs
    ['top', 'bottom', 'shoes'].forEach(garment => {
      const input = document.getElementById(`${garment}-color`);
      input.addEventListener('change', (e) => this.handleManualColorChange(garment, e.target.value));
    });

    // Camera controls
    document.getElementById('start-camera-btn').addEventListener('click', () => this.startCamera());
    document.getElementById('capture-btn').addEventListener('click', () => this.captureFrame());
    document.getElementById('switch-camera-btn').addEventListener('click', () => this.switchCamera());

    // Upload control
    document.getElementById('upload-input').addEventListener('change', (e) => this.handleImageUpload(e));

    // Crop controls
    document.getElementById('crop-top-btn').addEventListener('click', () => this.startCrop('top'));
    document.getElementById('crop-bottom-btn').addEventListener('click', () => this.startCrop('bottom'));
    document.getElementById('crop-shoes-btn').addEventListener('click', () => this.startCrop('shoes'));
    document.getElementById('cancel-crop-btn').addEventListener('click', () => this.cancelCrop());

    // Analyze button
    document.getElementById('analyze-btn').addEventListener('click', () => this.analyzeOutfit());

    // Reset button
    document.getElementById('reset-btn').addEventListener('click', () => this.reset());
  },

  // Check if camera is available
  async checkCameraAvailability() {
    const available = await Camera.isCameraAvailable();
    if (!available) {
      document.getElementById('camera-mode-btn').disabled = true;
      document.getElementById('camera-mode-btn').classList.add('opacity-50', 'cursor-not-allowed');
      document.getElementById('camera-mode-btn').title = 'Camera not available on this device';
    }
  },

  // Select input mode
  selectMode(mode) {
    this.currentMode = mode;
    
    // Update button states
    ['manual', 'camera', 'upload'].forEach(m => {
      const btn = document.getElementById(`${m}-mode-btn`);
      if (m === mode) {
        btn.classList.add('ring-2', 'ring-blue-500');
      } else {
        btn.classList.remove('ring-2', 'ring-blue-500');
      }
    });

    // Show/hide sections
    document.getElementById('manual-section').classList.toggle('hidden', mode !== 'manual');
    document.getElementById('camera-section').classList.toggle('hidden', mode !== 'camera');
    document.getElementById('upload-section').classList.toggle('hidden', mode !== 'upload');

    // Reset state
    this.garmentColors = { top: null, bottom: null, shoes: null };
    this.updateColorPreviews();
    this.updateAnalyzeButton();
    
    // Hide results and crop controls
    document.getElementById('results-section').classList.add('hidden');
    document.getElementById('crop-controls').classList.add('hidden');
    
    // Auto-initialize manual colors if manual mode is selected
    if (mode === 'manual') {
      setTimeout(() => {
        ['top', 'bottom', 'shoes'].forEach(garment => {
          const input = document.getElementById(`${garment}-color`);
          if (input) {
            this.handleManualColorChange(garment, input.value);
          }
        });
      }, 100);
    }
  },

  // Manual color change handler
  handleManualColorChange(garment, hexColor) {
    const rgb = this.hexToRgb(hexColor);
    const hsl = ColorAnalysis.rgbToHsl(rgb.r, rgb.g, rgb.b);
    
    this.garmentColors[garment] = {
      rgb: rgb,
      hsl: hsl,
      hex: hexColor,
      name: ColorAnalysis.getColorDescription({ hsl: hsl })
    };
    
    this.updateColorPreviews();
    this.updateAnalyzeButton();
  },

  // Start camera
  async startCamera() {
    try {
      const video = document.getElementById('camera-preview');
      await Camera.init(video);
      await Camera.startCamera(true);
      
      document.getElementById('camera-preview').classList.remove('hidden');
      document.getElementById('capture-btn').disabled = false;
      document.getElementById('switch-camera-btn').disabled = false;
    } catch (error) {
      alert(error.message);
    }
  },

  // Switch camera
  async switchCamera() {
    try {
      await Camera.switchCamera();
    } catch (error) {
      alert('Failed to switch camera: ' + error.message);
    }
  },

  // Capture frame from camera
  captureFrame() {
    const canvas = document.getElementById('capture-canvas');
    Camera.captureFrame(canvas);
    
    // Stop camera
    Camera.stopCamera();
    document.getElementById('camera-preview').classList.add('hidden');
    
    // Show canvas and process image
    canvas.classList.remove('hidden');
    this.processImage(canvas);
  },

  // Handle image upload
  handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.getElementById('upload-canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        canvas.classList.remove('hidden');
        this.processImage(canvas);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  // Process captured/uploaded image
  processImage(canvas) {
    this.capturedCanvas = canvas;
    
    // Auto-detect zones
    this.detectedZones = GarmentDetection.detectZones(canvas);
    
    // Store original image data for crop tool
    const ctx = canvas.getContext('2d');
    const originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Draw zones
    GarmentDetection.drawZones(canvas, this.detectedZones);
    
    // Extract colors from zones
    const zoneColors = GarmentDetection.extractZoneColors(canvas, this.detectedZones);
    this.garmentColors = zoneColors;
    
    // Show crop controls
    document.getElementById('crop-controls').classList.remove('hidden');
    
    // Update UI
    this.updateColorPreviews();
    this.updateAnalyzeButton();
  },

  // Start crop mode
  startCrop(garment) {
    if (!this.capturedCanvas) return;
    
    this.cropMode = true;
    this.pendingCropGarment = garment;
    
    // Reset canvas to original image
    const ctx = this.capturedCanvas.getContext('2d');
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.capturedCanvas.width;
    tempCanvas.height = this.capturedCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(this.capturedCanvas, 0, 0);
    
    // Clear and redraw original
    ctx.clearRect(0, 0, this.capturedCanvas.width, this.capturedCanvas.height);
    ctx.drawImage(tempCanvas, 0, 0);
    
    // Initialize crop tool
    CropTool.init(this.capturedCanvas);
    
    // Show instructions
    document.getElementById('crop-instructions').classList.remove('hidden');
    document.getElementById('crop-instructions').textContent = `Drag on the image to select the ${garment} region`;
    
    // Setup crop completion
    this.setupCropCompletion();
  },

  // Setup crop completion handler
  setupCropCompletion() {
    const canvas = this.capturedCanvas;
    
    const completeCrop = () => {
      const selection = CropTool.getSelection();
      if (selection) {
        const color = CropTool.extractColorFromCrop(selection);
        if (color) {
          this.garmentColors[this.pendingCropGarment] = color;
          this.updateColorPreviews();
          this.updateAnalyzeButton();
        }
      }
      
      CropTool.destroy();
      this.cropMode = false;
      document.getElementById('crop-instructions').classList.add('hidden');
      
      // Redraw zones
      if (this.detectedZones) {
        GarmentDetection.drawZones(canvas, this.detectedZones);
      }
    };
    
    // Complete on next click after selection
    const clickHandler = (e) => {
      if (!CropTool.isSelecting) {
        setTimeout(() => {
          completeCrop();
          canvas.removeEventListener('click', clickHandler);
        }, 100);
      }
    };
    
    canvas.addEventListener('click', clickHandler);
  },

  // Cancel crop
  cancelCrop() {
    if (this.cropMode) {
      CropTool.destroy();
      this.cropMode = false;
      document.getElementById('crop-instructions').classList.add('hidden');
      
      // Redraw zones
      if (this.detectedZones && this.capturedCanvas) {
        GarmentDetection.drawZones(this.capturedCanvas, this.detectedZones);
      }
    }
  },

  // Update color previews
  updateColorPreviews() {
    ['top', 'bottom', 'shoes'].forEach(garment => {
      const preview = document.getElementById(`${garment}-preview`);
      const label = document.getElementById(`${garment}-label`);
      
      if (this.garmentColors[garment]) {
        const color = this.garmentColors[garment];
        preview.style.backgroundColor = color.hex;
        label.textContent = color.name;
        preview.classList.remove('opacity-50');
      } else {
        preview.style.backgroundColor = '#374151';
        label.textContent = 'Not detected';
        preview.classList.add('opacity-50');
      }
    });
  },

  // Update analyze button state
  updateAnalyzeButton() {
    const btn = document.getElementById('analyze-btn');
    const allColorsDetected = this.garmentColors.top && this.garmentColors.bottom && this.garmentColors.shoes;
    
    btn.disabled = !allColorsDetected;
    btn.classList.toggle('opacity-50', !allColorsDetected);
    btn.classList.toggle('cursor-not-allowed', !allColorsDetected);
  },

  // Analyze outfit
  analyzeOutfit() {
    const colors = [
      this.garmentColors.top,
      this.garmentColors.bottom,
      this.garmentColors.shoes
    ].filter(c => c !== null);
    
    if (colors.length < 3) {
      alert('Please ensure all three garment colors are detected.');
      return;
    }

    // Perform analysis
    const harmonyResult = ColorAnalysis.analyzeHarmony(colors);
    const confidence = Scoring.calculateConfidence(colors);
    const mood = Scoring.detectMood(colors);
    const scoreResult = Scoring.calculateOutfitScore(colors, harmonyResult);
    const grade = Scoring.getGrade(scoreResult.total);

    const analysisData = {
      colors: this.garmentColors,
      harmony: harmonyResult,
      confidence: confidence,
      mood: mood,
      score: scoreResult,
      grade: grade
    };

    // Compare with previous
    const comparison = Comparison.compareOutfits(analysisData);
    
    // Save current analysis
    Comparison.saveAnalysis(analysisData);

    // Display results
    this.displayResults(analysisData, comparison);
  },

  // Display analysis results
  displayResults(analysis, comparison) {
    // Harmony
    document.getElementById('harmony-type').textContent = analysis.harmony.type;
    document.getElementById('harmony-score').textContent = `${analysis.harmony.score}/100`;
    document.getElementById('harmony-explanation').textContent = analysis.harmony.explanation;

    // Confidence
    document.getElementById('confidence-score').textContent = `${analysis.confidence} / 100`;
    document.getElementById('confidence-bar').style.width = `${analysis.confidence}%`;

    // Mood
    document.getElementById('mood-label').textContent = `${analysis.mood.emoji} ${analysis.mood.mood}`;
    document.getElementById('mood-explanation').textContent = analysis.mood.explanation;

    // Overall score
    document.getElementById('overall-score').textContent = analysis.score.total;
    document.getElementById('grade-letter').textContent = analysis.grade.letter;
    document.getElementById('grade-letter').className = `text-6xl font-bold ${analysis.grade.color}`;
    document.getElementById('grade-description').textContent = analysis.grade.description;

    // Score breakdown
    const breakdownHtml = analysis.score.breakdown.map(item => `
      <div class="flex justify-between items-center p-3 bg-gray-700 rounded">
        <div>
          <div class="font-medium">${item.category}</div>
          <div class="text-sm text-gray-400">${item.detail}</div>
        </div>
        <div class="text-lg font-bold">${item.points}/${item.max}</div>
      </div>
    `).join('');
    document.getElementById('score-breakdown').innerHTML = breakdownHtml;

    // Comparison
    if (comparison.hasPrevious) {
      document.getElementById('comparison-section').classList.remove('hidden');
      document.getElementById('comparison-message').textContent = comparison.message;
      
      if (comparison.details.length > 0) {
        const detailsHtml = comparison.details.map(detail => `
          <li class="text-gray-300">${detail}</li>
        `).join('');
        document.getElementById('comparison-details').innerHTML = detailsHtml;
      }
    } else {
      document.getElementById('comparison-section').classList.add('hidden');
    }

    // Show results section
    document.getElementById('results-section').classList.remove('hidden');
    
    // Scroll to results
    document.getElementById('results-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  // Reset application
  reset() {
    this.currentMode = null;
    this.garmentColors = { top: null, bottom: null, shoes: null };
    this.capturedCanvas = null;
    this.detectedZones = null;
    this.cropMode = false;
    
    // Reset UI
    ['manual', 'camera', 'upload'].forEach(m => {
      document.getElementById(`${m}-mode-btn`).classList.remove('ring-2', 'ring-blue-500');
    });
    
    document.getElementById('manual-section').classList.add('hidden');
    document.getElementById('camera-section').classList.add('hidden');
    document.getElementById('upload-section').classList.add('hidden');
    document.getElementById('results-section').classList.add('hidden');
    document.getElementById('crop-controls').classList.add('hidden');
    
    // Clear canvases
    ['capture-canvas', 'upload-canvas'].forEach(id => {
      const canvas = document.getElementById(id);
      canvas.classList.add('hidden');
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
    
    // Reset camera
    Camera.stopCamera();
    document.getElementById('camera-preview').classList.add('hidden');
    
    // Reset form
    document.getElementById('upload-input').value = '';
    
    this.updateColorPreviews();
    this.updateAnalyzeButton();
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  // Utility: Convert hex to RGB
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
