
const CropTool = {

  // ────────────────────────────────────────────
  //  STATE
  // ────────────────────────────────────────────

  isSelecting: false,
  hasSelection: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  canvas: null,
  ctx: null,
  originalImageData: null,

  // Store bound handlers so we can remove them cleanly
  _boundHandlers: null,

  // Active resize handle (null if not resizing)
  _resizeHandle: null,
  _resizeStartSelection: null,

  // Current finalized selection (in canvas pixel coords)
  _selection: null,

  // Visual config
  _config: {
    minSelectionSize: 15,        // Minimum px for valid selection
    overlayColor: 'rgba(0, 0, 0, 0.55)',
    selectionStroke: '#818cf8',  // Indigo accent
    selectionStrokeActive: '#facc15', // Yellow while dragging
    selectionFill: 'rgba(129, 140, 248, 0.12)',
    handleSize: 10,
    handleColor: '#ffffff',
    handleBorder: '#818cf8',
    infoFont: 'bold 13px Inter, system-ui, sans-serif',
    infoColor: '#ffffff',
    infoBg: 'rgba(0, 0, 0, 0.7)',
  },

  // ────────────────────────────────────────────
  //  INITIALIZATION
  // ────────────────────────────────────────────

  init(canvas) {
    // Clean up any previous instance
    if (this.canvas) {
      this._removeListeners();
    }

    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.isSelecting = false;
    this.hasSelection = false;
    this._selection = null;
    this._resizeHandle = null;

    // Save original image data (before any overlays)
    this.originalImageData = this.ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Create bound handlers ONCE so we can remove them later
    this._boundHandlers = {
      mousedown: this._onMouseDown.bind(this),
      mousemove: this._onMouseMove.bind(this),
      mouseup: this._onMouseUp.bind(this),
      touchstart: this._onTouchStart.bind(this),
      touchmove: this._onTouchMove.bind(this),
      touchend: this._onTouchEnd.bind(this),
      contextmenu: (e) => e.preventDefault(), // Prevent right-click menu on canvas
    };

    // Attach listeners
    canvas.addEventListener('mousedown', this._boundHandlers.mousedown);
    canvas.addEventListener('mousemove', this._boundHandlers.mousemove);
    canvas.addEventListener('mouseup', this._boundHandlers.mouseup);
    canvas.addEventListener('touchstart', this._boundHandlers.touchstart, { passive: false });
    canvas.addEventListener('touchmove', this._boundHandlers.touchmove, { passive: false });
    canvas.addEventListener('touchend', this._boundHandlers.touchend, { passive: false });
    canvas.addEventListener('contextmenu', this._boundHandlers.contextmenu);

    // Also listen on document for mouseup (in case user drags outside canvas)
    document.addEventListener('mouseup', this._boundHandlers.mouseup);
    document.addEventListener('mousemove', this._boundHandlers.mousemove);

    canvas.style.cursor = 'crosshair';
  },

  // ────────────────────────────────────────────
  //  COORDINATE SCALING
  //  Canvas can be CSS-scaled (max-width: 100%),
  //  so display size ≠ canvas pixel size.
  // ────────────────────────────────────────────

  _getCanvasCoords(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();

    // Scale from display coords → canvas pixel coords
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    let x = (clientX - rect.left) * scaleX;
    let y = (clientY - rect.top) * scaleY;

    // Clamp to canvas bounds
    x = Math.max(0, Math.min(this.canvas.width, x));
    y = Math.max(0, Math.min(this.canvas.height, y));

    return { x, y };
  },

  // ────────────────────────────────────────────
  //  MOUSE EVENTS
  // ────────────────────────────────────────────

  _onMouseDown(e) {
    if (e.button !== 0) return; // Left click only

    const coords = this._getCanvasCoords(e.clientX, e.clientY);

    // Check if clicking on a resize handle of existing selection
    if (this.hasSelection && this._selection) {
      const handle = this._hitTestHandles(coords.x, coords.y);
      if (handle) {
        this._resizeHandle = handle;
        this._resizeStartSelection = { ...this._selection };
        this.startX = coords.x;
        this.startY = coords.y;
        this.canvas.style.cursor = this._getHandleCursor(handle);
        return;
      }
    }

    // Start new selection
    this.startX = coords.x;
    this.startY = coords.y;
    this.currentX = coords.x;
    this.currentY = coords.y;
    this.isSelecting = true;
    this.hasSelection = false;
    this._selection = null;
    this._resizeHandle = null;
  },

  _onMouseMove(e) {
    const coords = this._getCanvasCoords(e.clientX, e.clientY);

    // Resize handle drag
    if (this._resizeHandle && this._resizeStartSelection) {
      this._performResize(coords.x, coords.y);
      this._draw();
      return;
    }

    // New selection drag
    if (this.isSelecting) {
      this.currentX = coords.x;
      this.currentY = coords.y;
      this._draw();
      return;
    }

    // Hover cursor: show resize cursor when over handles
    if (this.hasSelection && this._selection) {
      const handle = this._hitTestHandles(coords.x, coords.y);
      this.canvas.style.cursor = handle
        ? this._getHandleCursor(handle)
        : 'crosshair';
    }
  },

  _onMouseUp(e) {
    if (this._resizeHandle) {
      this._resizeHandle = null;
      this._resizeStartSelection = null;
      this._finalizeCurrentSelection();
      return;
    }

    if (!this.isSelecting) return;
    this.isSelecting = false;

    const coords = this._getCanvasCoords(e.clientX, e.clientY);
    this.currentX = coords.x;
    this.currentY = coords.y;

    this._finalizeCurrentSelection();
  },

  // ────────────────────────────────────────────
  //  TOUCH EVENTS (single-touch only)
  // ────────────────────────────────────────────

  _onTouchStart(e) {
    if (e.touches.length !== 1) return; // Ignore multi-touch
    e.preventDefault();

    const touch = e.touches[0];
    const coords = this._getCanvasCoords(touch.clientX, touch.clientY);

    // Check resize handles
    if (this.hasSelection && this._selection) {
      const handle = this._hitTestHandles(coords.x, coords.y);
      if (handle) {
        this._resizeHandle = handle;
        this._resizeStartSelection = { ...this._selection };
        this.startX = coords.x;
        this.startY = coords.y;
        return;
      }
    }

    this.startX = coords.x;
    this.startY = coords.y;
    this.currentX = coords.x;
    this.currentY = coords.y;
    this.isSelecting = true;
    this.hasSelection = false;
    this._selection = null;
  },

  _onTouchMove(e) {
    if (e.touches.length !== 1) return;
    e.preventDefault();

    const touch = e.touches[0];
    const coords = this._getCanvasCoords(touch.clientX, touch.clientY);

    if (this._resizeHandle && this._resizeStartSelection) {
      this._performResize(coords.x, coords.y);
      this._draw();
      return;
    }

    if (!this.isSelecting) return;
    this.currentX = coords.x;
    this.currentY = coords.y;
    this._draw();
  },

  _onTouchEnd(e) {
    e.preventDefault();

    if (this._resizeHandle) {
      this._resizeHandle = null;
      this._resizeStartSelection = null;
      this._finalizeCurrentSelection();
      return;
    }

    if (!this.isSelecting) return;
    this.isSelecting = false;
    this._finalizeCurrentSelection();
  },

  // ────────────────────────────────────────────
  //  SELECTION LOGIC
  // ──────��─────────────────────────────────────

  _getCurrentRect() {
    const x = Math.min(this.startX, this.currentX);
    const y = Math.min(this.startY, this.currentY);
    const w = Math.abs(this.currentX - this.startX);
    const h = Math.abs(this.currentY - this.startY);

    // Clamp to canvas
    return {
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: Math.min(w, this.canvas.width - Math.max(0, x)),
      height: Math.min(h, this.canvas.height - Math.max(0, y))
    };
  },

  _finalizeCurrentSelection() {
    const rect = this._selection || this._getCurrentRect();

    if (rect.width < this._config.minSelectionSize || rect.height < this._config.minSelectionSize) {
      // Selection too small — reset
      this.hasSelection = false;
      this._selection = null;
      this._restoreImage();
      return;
    }

    this._selection = {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
    this.hasSelection = true;
    this._draw();
  },

  // ────────────────────────────────────────────
  //  RESIZE HANDLES
  // ────────────────────────────────────────────

  _getHandlePositions(sel) {
    if (!sel) return {};
    const { x, y, width: w, height: h } = sel;
    const half = this._config.handleSize / 2;
    return {
      'nw': { x: x - half,     y: y - half },
      'ne': { x: x + w - half, y: y - half },
      'sw': { x: x - half,     y: y + h - half },
      'se': { x: x + w - half, y: y + h - half },
    };
  },

  _hitTestHandles(px, py) {
    const positions = this._getHandlePositions(this._selection);
    const size = this._config.handleSize + 8; // Extra padding for touch targets

    for (const [name, pos] of Object.entries(positions)) {
      if (px >= pos.x - 4 && px <= pos.x + size &&
          py >= pos.y - 4 && py <= pos.y + size) {
        return name;
      }
    }
    return null;
  },

  _getHandleCursor(handle) {
    const cursors = {
      'nw': 'nw-resize', 'ne': 'ne-resize',
      'sw': 'sw-resize', 'se': 'se-resize',
    };
    return cursors[handle] || 'crosshair';
  },

  _performResize(mouseX, mouseY) {
    const orig = this._resizeStartSelection;
    if (!orig) return;

    const dx = mouseX - this.startX;
    const dy = mouseY - this.startY;

    let newX = orig.x;
    let newY = orig.y;
    let newW = orig.width;
    let newH = orig.height;

    switch (this._resizeHandle) {
      case 'nw':
        newX = orig.x + dx;
        newY = orig.y + dy;
        newW = orig.width - dx;
        newH = orig.height - dy;
        break;
      case 'ne':
        newY = orig.y + dy;
        newW = orig.width + dx;
        newH = orig.height - dy;
        break;
      case 'sw':
        newX = orig.x + dx;
        newW = orig.width - dx;
        newH = orig.height + dy;
        break;
      case 'se':
        newW = orig.width + dx;
        newH = orig.height + dy;
        break;
    }

    // Enforce minimums
    if (newW < this._config.minSelectionSize) {
      newW = this._config.minSelectionSize;
      if (this._resizeHandle.includes('w')) newX = orig.x + orig.width - newW;
    }
    if (newH < this._config.minSelectionSize) {
      newH = this._config.minSelectionSize;
      if (this._resizeHandle.includes('n')) newY = orig.y + orig.height - newH;
    }

    // Clamp to canvas
    newX = Math.max(0, newX);
    newY = Math.max(0, newY);
    newW = Math.min(newW, this.canvas.width - newX);
    newH = Math.min(newH, this.canvas.height - newY);

    this._selection = {
      x: Math.round(newX),
      y: Math.round(newY),
      width: Math.round(newW),
      height: Math.round(newH)
    };
    this.hasSelection = true;
  },

  // ────────────────────────────────────────────
  //  DRAWING — Rich visual feedback
  // ────────────────────────────────────────────

  _draw() {
    const cfg = this._config;

    // Restore original image
    this._restoreImage();

    const rect = this._selection || this._getCurrentRect();
    if (rect.width < 2 || rect.height < 2) return;

    // ── 1. Dimmed overlay outside selection ──
    this.ctx.fillStyle = cfg.overlayColor;

    // Top strip
    this.ctx.fillRect(0, 0, this.canvas.width, rect.y);
    // Bottom strip
    this.ctx.fillRect(0, rect.y + rect.height, this.canvas.width, this.canvas.height - rect.y - rect.height);
    // Left strip
    this.ctx.fillRect(0, rect.y, rect.x, rect.height);
    // Right strip
    this.ctx.fillRect(rect.x + rect.width, rect.y, this.canvas.width - rect.x - rect.width, rect.height);

    // ── 2. Selection fill ──
    this.ctx.fillStyle = cfg.selectionFill;
    this.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

    // ── 3. Dashed border ──
    this.ctx.strokeStyle = this.isSelecting ? cfg.selectionStrokeActive : cfg.selectionStroke;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([6, 4]);
    this.ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    this.ctx.setLineDash([]);

    // ── 4. Corner resize handles ──
    if (this.hasSelection && this._selection) {
      const handles = this._getHandlePositions(this._selection);
      const hs = cfg.handleSize;

      Object.values(handles).forEach(pos => {
        // White fill with border
        this.ctx.fillStyle = cfg.handleColor;
        this.ctx.strokeStyle = cfg.handleBorder;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.roundRect(pos.x, pos.y, hs, hs, 2);
        this.ctx.fill();
        this.ctx.stroke();
      });
    }

    // ── 5. Size info label ──
    this._drawSizeLabel(rect);
  },

  _drawSizeLabel(rect) {
    const cfg = this._config;
    const text = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;

    this.ctx.font = cfg.infoFont;
    const metrics = this.ctx.measureText(text);
    const padding = 6;
    const labelW = metrics.width + padding * 2;
    const labelH = 22;

    // Position: below selection, centered. If no room below, put above.
    let lx = rect.x + (rect.width - labelW) / 2;
    let ly = rect.y + rect.height + 8;

    if (ly + labelH > this.canvas.height) {
      ly = rect.y - labelH - 8;
    }

    // Clamp horizontal
    lx = Math.max(4, Math.min(this.canvas.width - labelW - 4, lx));

    // Draw background pill
    this.ctx.fillStyle = cfg.infoBg;
    this.ctx.beginPath();
    this.ctx.roundRect(lx, ly, labelW, labelH, 4);
    this.ctx.fill();

    // Draw text
    this.ctx.fillStyle = cfg.infoColor;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, lx + labelW / 2, ly + labelH / 2);

    // Reset
    this.ctx.textAlign = 'start';
    this.ctx.textBaseline = 'alphabetic';
  },

  _restoreImage() {
    if (this.originalImageData && this.ctx) {
      this.ctx.putImageData(this.originalImageData, 0, 0);
    }
  },

  // ────────────────────────────────────────────
  //  PUBLIC API
  // ────────────────────────────────────────────

  /** Get the current selection rectangle (in canvas pixel coords), or null */
  getSelection() {
    if (this.hasSelection && this._selection) {
      return { ...this._selection };
    }

    // Fallback: try to finalize from current drag coords
    if (!this.isSelecting && this.currentX && this.currentY) {
      const rect = this._getCurrentRect();
      if (rect.width >= this._config.minSelectionSize && rect.height >= this._config.minSelectionSize) {
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      }
    }

    return null;
  },

  /** Reset selection and restore original image */
  reset() {
    this.isSelecting = false;
    this.hasSelection = false;
    this._selection = null;
    this._resizeHandle = null;
    this._resizeStartSelection = null;
    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.currentY = 0;
    this._restoreImage();
  },

  /**
   * Extract color from the current crop selection.
   * Uses the original (un-overlayed) image data for accurate color.
   */
  extractColorFromCrop(cropArea) {
    if (!cropArea || !this.originalImageData) return null;

    // Create a temporary canvas with original image data
    // to avoid sampling from the overlay-drawn canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.canvas.width;
    tempCanvas.height = this.canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.putImageData(this.originalImageData, 0, 0);

    const rgb = ColorAnalysis.extractAverageColor(
      tempCanvas,
      cropArea.x,
      cropArea.y,
      cropArea.width,
      cropArea.height
    );

    const hsl = ColorAnalysis.rgbToHsl(rgb.r, rgb.g, rgb.b);

    return {
      rgb,
      hsl,
      hex: ColorAnalysis.rgbToHex(rgb.r, rgb.g, rgb.b),
      name: ColorAnalysis.getColorDescription({ hsl })
    };
  },

  /**
   * Get a live color preview of the current selection.
   * Useful for showing the user what color they're selecting
   * before they confirm.
   */
  getSelectionPreview() {
    const sel = this.getSelection();
    if (!sel) return null;

    return this.extractColorFromCrop(sel);
  },

  // ────────────────────────────────────────────
  //  CLEANUP — Proper listener removal
  // ────────────────────────────────────────────

  /** Remove all event listeners and free memory. Does NOT replace the canvas node. */
  destroy() {
    this._removeListeners();

    if (this.canvas) {
      this.canvas.style.cursor = 'default';
    }

    // Free memory
    this.canvas = null;
    this.ctx = null;
    this.originalImageData = null;
    this._selection = null;
    this._resizeHandle = null;
    this._resizeStartSelection = null;
    this.isSelecting = false;
    this.hasSelection = false;
    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.currentY = 0;
  },

  /** Cleanly remove all event listeners without replacing the canvas */
  _removeListeners() {
    if (!this._boundHandlers || !this.canvas) return;

    this.canvas.removeEventListener('mousedown', this._boundHandlers.mousedown);
    this.canvas.removeEventListener('mousemove', this._boundHandlers.mousemove);
    this.canvas.removeEventListener('mouseup', this._boundHandlers.mouseup);
    this.canvas.removeEventListener('touchstart', this._boundHandlers.touchstart);
    this.canvas.removeEventListener('touchmove', this._boundHandlers.touchmove);
    this.canvas.removeEventListener('touchend', this._boundHandlers.touchend);
    this.canvas.removeEventListener('contextmenu', this._boundHandlers.contextmenu);

    document.removeEventListener('mouseup', this._boundHandlers.mouseup);
    document.removeEventListener('mousemove', this._boundHandlers.mousemove);

    this._boundHandlers = null;
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CropTool;
}