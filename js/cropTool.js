// Crop Tool Module
// Handles manual crop selection on canvas

const CropTool = {
  isSelecting: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  canvas: null,
  ctx: null,
  originalImageData: null,

  // Initialize crop tool on a canvas
  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // Save original image data
    this.originalImageData = this.ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Add mouse event listeners
    canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    
    // Add touch event listeners for mobile
    canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
    canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
    canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
    
    canvas.style.cursor = 'crosshair';
  },

  // Mouse event handlers
  handleMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.startX = e.clientX - rect.left;
    this.startY = e.clientY - rect.top;
    this.isSelecting = true;
  },

  handleMouseMove(e) {
    if (!this.isSelecting) return;
    
    const rect = this.canvas.getBoundingClientRect();
    this.currentX = e.clientX - rect.left;
    this.currentY = e.clientY - rect.top;
    
    this.drawSelection();
  },

  handleMouseUp(e) {
    if (!this.isSelecting) return;
    
    this.isSelecting = false;
    const rect = this.canvas.getBoundingClientRect();
    this.currentX = e.clientX - rect.left;
    this.currentY = e.clientY - rect.top;
    
    this.finalizeSelection();
  },

  // Touch event handlers
  handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    this.startX = touch.clientX - rect.left;
    this.startY = touch.clientY - rect.top;
    this.isSelecting = true;
  },

  handleTouchMove(e) {
    e.preventDefault();
    if (!this.isSelecting) return;
    
    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    this.currentX = touch.clientX - rect.left;
    this.currentY = touch.clientY - rect.top;
    
    this.drawSelection();
  },

  handleTouchEnd(e) {
    e.preventDefault();
    if (!this.isSelecting) return;
    
    this.isSelecting = false;
    this.finalizeSelection();
  },

  // Draw selection rectangle
  drawSelection() {
    // Restore original image
    this.ctx.putImageData(this.originalImageData, 0, 0);
    
    // Calculate rectangle dimensions
    const width = this.currentX - this.startX;
    const height = this.currentY - this.startY;
    
    // Draw selection rectangle
    this.ctx.strokeStyle = 'yellow';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(this.startX, this.startY, width, height);
    
    // Draw semi-transparent fill
    this.ctx.fillStyle = 'rgba(255, 255, 0, 0.2)';
    this.ctx.fillRect(this.startX, this.startY, width, height);
  },

  // Finalize selection and return crop area
  finalizeSelection() {
    const width = Math.abs(this.currentX - this.startX);
    const height = Math.abs(this.currentY - this.startY);
    const x = Math.min(this.startX, this.currentX);
    const y = Math.min(this.startY, this.currentY);
    
    // Minimum selection size
    if (width < 20 || height < 20) {
      this.reset();
      return null;
    }
    
    return {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height)
    };
  },

  // Get current selection
  getSelection() {
    if (!this.isSelecting && this.currentX && this.currentY) {
      return this.finalizeSelection();
    }
    return null;
  },

  // Reset crop tool
  reset() {
    this.isSelecting = false;
    if (this.originalImageData) {
      this.ctx.putImageData(this.originalImageData, 0, 0);
    }
  },

  // Extract color from cropped region
  extractColorFromCrop(cropArea) {
    if (!cropArea) return null;
    
    const rgb = ColorAnalysis.extractAverageColor(
      this.canvas,
      cropArea.x,
      cropArea.y,
      cropArea.width,
      cropArea.height
    );
    
    return {
      rgb: rgb,
      hsl: ColorAnalysis.rgbToHsl(rgb.r, rgb.g, rgb.b),
      hex: ColorAnalysis.rgbToHex(rgb.r, rgb.g, rgb.b),
      name: ColorAnalysis.getColorDescription({
        hsl: ColorAnalysis.rgbToHsl(rgb.r, rgb.g, rgb.b)
      })
    };
  },

  // Cleanup
  destroy() {
    if (this.canvas) {
      this.canvas.style.cursor = 'default';
      // Remove all event listeners
      const newCanvas = this.canvas.cloneNode(true);
      this.canvas.parentNode.replaceChild(newCanvas, this.canvas);
    }
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CropTool;
}
