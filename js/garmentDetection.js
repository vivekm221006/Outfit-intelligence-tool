
const GarmentDetection = {

  // ────────────────────────────────────────────
  //  CONFIGURATION
  // ────────────────────────────────────────────

  _config: {
    // Zone proportions (based on typical outfit photo framing)
    // Head/neck gap at top, larger torso, shoes are smallest
    zones: {
      top:    { yStart: 0.08, yEnd: 0.42, label: '👕 Top',    color: 'rgba(129, 140, 248, ALPHA)', border: '#818cf8' },
      bottom: { yStart: 0.42, yEnd: 0.78, label: '👖 Bottom', color: 'rgba(168, 85, 247, ALPHA)',  border: '#a855f7' },
      shoes:  { yStart: 0.78, yEnd: 0.97, label: '👟 Shoes',  color: 'rgba(6, 182, 212, ALPHA)',   border: '#06b6d4' },
    },

    // Horizontal margins — sample the center portion, skip background edges
    horizontalInset: 0.20,  // Skip 20% on each side → sample center 60%

    // Vertical inner margins — skip edges within each zone to avoid zone bleed
    verticalInsetRatio: 0.10, // Skip 10% top/bottom within each zone

    // Skin color detection (HSL ranges for common skin tones)
    skinRanges: [
      { hMin: 5,  hMax: 45,  sMin: 15, sMax: 70, lMin: 20, lMax: 80 },  // Light to medium
      { hMin: 15, hMax: 40,  sMin: 20, sMax: 60, lMin: 10, lMax: 50 },  // Darker tones
    ],

    // Minimum color confidence (0–1) to consider a detection valid
    minConfidence: 0.25,

    // Overlay
    overlayAlpha: 0.18,
    overlayAlphaHover: 0.30,
    borderWidth: 2,
    labelPadding: 8,
  },

  // ────────────────────────────────────────────
  //  ZONE DETECTION
  // ──────��─────────────────────────────────────

  /**
   * Detect three garment zones with smart proportions.
   * Optionally uses edge-based body detection for horizontal cropping.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {Object} options
   * @param {boolean} options.smartCrop — attempt to find body center (default: true)
   * @returns {Object} zones — { top, bottom, shoes } each with { x, y, width, height, label, samplingRect }
   */
  detectZones(canvas, options = {}) {
    const { smartCrop = true } = options;
    const height = canvas.height;
    const width = canvas.width;
    const cfg = this._config;

    // Determine horizontal sampling bounds
    let sampleX, sampleWidth;

    if (smartCrop) {
      const bodyBounds = this._detectBodyColumn(canvas);
      if (bodyBounds) {
        sampleX = bodyBounds.x;
        sampleWidth = bodyBounds.width;
      } else {
        // Fallback to center inset
        sampleX = Math.floor(width * cfg.horizontalInset);
        sampleWidth = Math.floor(width * (1 - 2 * cfg.horizontalInset));
      }
    } else {
      sampleX = Math.floor(width * cfg.horizontalInset);
      sampleWidth = Math.floor(width * (1 - 2 * cfg.horizontalInset));
    }

    // Ensure valid bounds
    sampleX = Math.max(0, sampleX);
    sampleWidth = Math.min(sampleWidth, width - sampleX);
    sampleWidth = Math.max(1, sampleWidth);

    // Build zones
    const zones = {};
    for (const [key, zCfg] of Object.entries(cfg.zones)) {
      const zoneY = Math.floor(height * zCfg.yStart);
      const zoneH = Math.floor(height * (zCfg.yEnd - zCfg.yStart));

      // Inner sampling rect (with vertical inset to avoid zone boundaries)
      const vInset = Math.floor(zoneH * cfg.verticalInsetRatio);
      const innerY = zoneY + vInset;
      const innerH = Math.max(1, zoneH - vInset * 2);

      zones[key] = {
        // Full zone (for overlay drawing)
        x: 0,
        y: zoneY,
        width: width,
        height: zoneH,
        label: zCfg.label,

        // Inner sampling rectangle (for color extraction)
        samplingRect: {
          x: sampleX,
          y: innerY,
          width: sampleWidth,
          height: innerH,
        },
      };
    }

    return zones;
  },

  /**
   * Attempt to detect the body column by analyzing
   * vertical edge density. The column with the most
   * edges is likely where the person is standing.
   *
   * @param {HTMLCanvasElement} canvas
   * @returns {{ x, width } | null}
   */
  _detectBodyColumn(canvas) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Sample a horizontal strip from the middle of the image
    const stripY = Math.floor(height * 0.3);
    const stripH = Math.floor(height * 0.4);

    if (stripH < 10 || width < 20) return null;

    const imageData = ctx.getImageData(0, stripY, width, stripH);
    const data = imageData.data;

    // Calculate luminance per column (simplified)
    const columnBrightness = new Float32Array(width);
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let y = 0; y < stripH; y += 4) { // Sample every 4th row
        const idx = (y * width + x) * 4;
        // Luminance approximation
        sum += data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
        count++;
      }
      columnBrightness[x] = count > 0 ? sum / count : 128;
    }

    // Calculate horizontal gradient (edge strength)
    const edgeStrength = new Float32Array(width);
    for (let x = 1; x < width - 1; x++) {
      edgeStrength[x] = Math.abs(columnBrightness[x + 1] - columnBrightness[x - 1]);
    }

    // Find the densest region of edges using a sliding window
    const windowSize = Math.floor(width * 0.5); // 50% of width
    if (windowSize < 10) return null;

    let maxSum = 0;
    let maxStart = 0;

    let currentSum = 0;
    for (let i = 0; i < windowSize; i++) {
      currentSum += edgeStrength[i];
    }
    maxSum = currentSum;

    for (let i = 1; i <= width - windowSize; i++) {
      currentSum -= edgeStrength[i - 1];
      currentSum += edgeStrength[i + windowSize - 1];
      if (currentSum > maxSum) {
        maxSum = currentSum;
        maxStart = i;
      }
    }

    // Only use if there's meaningful edge contrast
    const avgEdge = maxSum / windowSize;
    if (avgEdge < 3) return null; // Too uniform — probably no clear body

    // Add small padding
    const padding = Math.floor(width * 0.05);
    const resultX = Math.max(0, maxStart - padding);
    const resultW = Math.min(width - resultX, windowSize + padding * 2);

    return { x: resultX, width: resultW };
  },

  // ────────────────────────────────────────────
  //  COLOR EXTRACTION — Enhanced
  // ────────────────────────────────────────────

  /**
   * Extract colors from detected zones.
   * Uses the inner sampling rect, rejects skin pixels,
   * and provides dominant colors + confidence.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {Object} zones
   * @returns {Object} — { top, bottom, shoes } each with { rgb, hsl, hex, name, confidence, dominantColors }
   */
  extractZoneColors(canvas, zones) {
    const colors = {};

    for (const [key, zone] of Object.entries(zones)) {
      const rect = zone.samplingRect || {
        x: zone.x, y: zone.y, width: zone.width, height: zone.height
      };

      // Get raw pixel data for this zone
      const pixelData = this._getPixelData(canvas, rect);

      // Filter out skin-colored pixels
      const filtered = this._rejectSkinPixels(pixelData);

      // Get dominant color (trimmed mean of filtered pixels)
      const dominant = this._getDominantFromPixels(filtered.length > 0 ? filtered : pixelData);

      // Get top 3 dominant colors for pattern detection
      const dominantColors = this._getDominantColorsFromPixels(
        filtered.length > 0 ? filtered : pixelData,
        3
      );

      // Calculate confidence
      const confidence = this._calculateConfidence(pixelData, filtered, dominant);

      const hsl = ColorAnalysis.rgbToHsl(dominant.r, dominant.g, dominant.b);

      colors[key] = {
        rgb: dominant,
        hsl,
        hex: ColorAnalysis.rgbToHex(dominant.r, dominant.g, dominant.b),
        name: ColorAnalysis.getColorDescription({ hsl }),
        confidence,
        dominantColors,
        isPattern: this._isPattern(dominantColors),
        pixelCount: pixelData.length,
        filteredCount: filtered.length,
      };
    }

    return colors;
  },

  /**
   * Get array of { r, g, b } pixels from a canvas region.
   */
  _getPixelData(canvas, rect) {
    const ctx = canvas.getContext('2d');

    // Clamp to canvas bounds
    const x = Math.max(0, Math.round(rect.x));
    const y = Math.max(0, Math.round(rect.y));
    const w = Math.min(Math.round(rect.width), canvas.width - x);
    const h = Math.min(Math.round(rect.height), canvas.height - y);

    if (w <= 0 || h <= 0) return [];

    const imageData = ctx.getImageData(x, y, w, h);
    const data = imageData.data;
    const pixels = [];

    // Sample every 4th pixel for performance
    for (let i = 0; i < data.length; i += 16) {
      if (data[i + 3] < 128) continue; // Skip transparent
      pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
    }

    return pixels;
  },

  /**
   * Reject pixels that fall within skin color ranges.
   */
  _rejectSkinPixels(pixels) {
    return pixels.filter(px => !this._isSkinColor(px));
  },

  /**
   * Check if a pixel is likely skin color.
   */
  _isSkinColor(pixel) {
    const hsl = ColorAnalysis.rgbToHsl(pixel.r, pixel.g, pixel.b);
    return this._config.skinRanges.some(range =>
      hsl.h >= range.hMin && hsl.h <= range.hMax &&
      hsl.s >= range.sMin && hsl.s <= range.sMax &&
      hsl.l >= range.lMin && hsl.l <= range.lMax
    );
  },

  /**
   * Get dominant color from pixel array using trimmed mean.
   */
  _getDominantFromPixels(pixels) {
    if (pixels.length === 0) return { r: 128, g: 128, b: 128 };

    const rVals = pixels.map(p => p.r);
    const gVals = pixels.map(p => p.g);
    const bVals = pixels.map(p => p.b);

    return {
      r: this._trimmedMean(rVals),
      g: this._trimmedMean(gVals),
      b: this._trimmedMean(bVals),
    };
  },

  /**
   * Get top N dominant colors from pixel array using color bucketing.
   */
  _getDominantColorsFromPixels(pixels, count = 3) {
    if (pixels.length === 0) return [];

    const buckets = new Map();
    const shift = 4; // 256 >> 4 = 16 buckets per channel

    pixels.forEach(px => {
      const key = `${px.r >> shift},${px.g >> shift},${px.b >> shift}`;
      if (buckets.has(key)) {
        const b = buckets.get(key);
        b.count++;
        b.totalR += px.r;
        b.totalG += px.g;
        b.totalB += px.b;
      } else {
        buckets.set(key, { count: 1, totalR: px.r, totalG: px.g, totalB: px.b });
      }
    });

    return [...buckets.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, count)
      .map(b => {
        const rgb = {
          r: Math.round(b.totalR / b.count),
          g: Math.round(b.totalG / b.count),
          b: Math.round(b.totalB / b.count),
        };
        const hsl = ColorAnalysis.rgbToHsl(rgb.r, rgb.g, rgb.b);
        return {
          rgb,
          hsl,
          hex: ColorAnalysis.rgbToHex(rgb.r, rgb.g, rgb.b),
          frequency: b.count / pixels.length,
        };
      });
  },

  /**
   * Detect if the zone is likely a pattern (stripes, plaid, print).
   * If the top 2 colors each have >20% frequency and are distinct, it's a pattern.
   */
  _isPattern(dominantColors) {
    if (!dominantColors || dominantColors.length < 2) return false;

    const c1 = dominantColors[0];
    const c2 = dominantColors[1];

    // Both colors must have meaningful presence
    if (c1.frequency < 0.25 || c2.frequency < 0.15) return false;

    // Colors must be visually distinct
    const hueDiff = ColorAnalysis.hueDifference(c1.hsl.h, c2.hsl.h);
    const lightDiff = Math.abs(c1.hsl.l - c2.hsl.l);
    const satDiff = Math.abs(c1.hsl.s - c2.hsl.s);

    return hueDiff > 25 || lightDiff > 25 || satDiff > 30;
  },

  /**
   * Calculate detection confidence (0–1).
   * Based on: how many pixels survived filtering,
   * color consistency within the zone, and whether
   * a clear dominant color exists.
   */
  _calculateConfidence(allPixels, filteredPixels, dominantColor) {
    if (allPixels.length === 0) return 0;

    let confidence = 0;

    // Factor 1: What percentage of pixels survived skin filtering (0.4 weight)
    const survivalRate = filteredPixels.length / allPixels.length;
    confidence += Math.min(1, survivalRate / 0.5) * 0.4; // 50%+ survival = full score

    // Factor 2: Color consistency — how close are pixels to the dominant color (0.4 weight)
    const samplePixels = filteredPixels.length > 0 ? filteredPixels : allPixels;
    const sample = samplePixels.slice(0, 200); // Limit for performance
    if (sample.length > 0) {
      let totalDist = 0;
      sample.forEach(px => {
        totalDist += Math.sqrt(
          Math.pow(px.r - dominantColor.r, 2) +
          Math.pow(px.g - dominantColor.g, 2) +
          Math.pow(px.b - dominantColor.b, 2)
        );
      });
      const avgDist = totalDist / sample.length;
      // Lower distance = higher confidence. Max expected distance ~200
      const consistencyScore = Math.max(0, 1 - avgDist / 150);
      confidence += consistencyScore * 0.4;
    }

    // Factor 3: Sufficient pixel count (0.2 weight)
    const pixelScore = Math.min(1, samplePixels.length / 100);
    confidence += pixelScore * 0.2;

    return Math.round(confidence * 100) / 100; // Round to 2 decimals
  },

  /**
   * Trimmed mean — discard top/bottom 10%.
   */
  _trimmedMean(values) {
    if (values.length === 0) return 128;
    const sorted = [...values].sort((a, b) => a - b);
    const trim = Math.floor(sorted.length * 0.1);
    const trimmed = sorted.slice(trim, sorted.length - trim);
    if (trimmed.length === 0) return sorted[Math.floor(sorted.length / 2)];
    return Math.round(trimmed.reduce((s, v) => s + v, 0) / trimmed.length);
  },

  // ──────────────────────────────────────────���─
  //  ZONE OVERLAY DRAWING — Polished visuals
  // ────────────────────────────────────────────

  /**
   * Draw zone overlays on canvas with labels and sampling rectangles.
   * @param {HTMLCanvasElement} canvas
   * @param {Object} zones
   * @param {Object} options
   * @param {boolean} options.showSamplingRect — show the inner sampling area
   * @param {Object} options.extractedColors — color data to show swatches
   */
  drawZones(canvas, zones, options = {}) {
    const { showSamplingRect = true, extractedColors = null } = options;
    const ctx = canvas.getContext('2d');
    const cfg = this._config;

    // Adaptive font size based on canvas dimensions
    const baseFontSize = Math.max(12, Math.min(28, Math.floor(canvas.height * 0.028)));

    Object.entries(zones).forEach(([key, zone]) => {
      const zoneCfg = cfg.zones[key];
      if (!zoneCfg) return;

      // ── Zone fill ──
      ctx.fillStyle = zoneCfg.color.replace('ALPHA', String(cfg.overlayAlpha));
      ctx.fillRect(zone.x, zone.y, zone.width, zone.height);

      // ── Zone border ──
      ctx.strokeStyle = zoneCfg.border;
      ctx.lineWidth = cfg.borderWidth;
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
      ctx.setLineDash([]);

      // ── Sampling rect indicator ──
      if (showSamplingRect && zone.samplingRect) {
        const sr = zone.samplingRect;
        ctx.strokeStyle = zoneCfg.border;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(sr.x, sr.y, sr.width, sr.height);
        ctx.setLineDash([]);

        // Subtle fill for sampling area
        ctx.fillStyle = zoneCfg.color.replace('ALPHA', '0.08');
        ctx.fillRect(sr.x, sr.y, sr.width, sr.height);
      }

      // ── Label with background pill ──
      const labelX = zone.x + zone.width / 2;
      const labelY = zone.y + zone.height / 2;

      ctx.font = `bold ${baseFontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const text = zone.label;
      const metrics = ctx.measureText(text);
      const pillW = metrics.width + cfg.labelPadding * 2;
      const pillH = baseFontSize + cfg.labelPadding;

      // Background pill
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      this._roundRect(ctx, labelX - pillW / 2, labelY - pillH / 2, pillW, pillH, 6);
      ctx.fill();

      // Border on pill
      ctx.strokeStyle = zoneCfg.border;
      ctx.lineWidth = 1;
      this._roundRect(ctx, labelX - pillW / 2, labelY - pillH / 2, pillW, pillH, 6);
      ctx.stroke();

      // Text
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, labelX, labelY);

      // ── Color swatch (if extracted colors provided) ──
      if (extractedColors && extractedColors[key]) {
        const color = extractedColors[key];
        const swatchSize = Math.max(16, baseFontSize);
        const swatchX = labelX + pillW / 2 + 8;
        const swatchY = labelY - swatchSize / 2;

        // Swatch circle
        ctx.beginPath();
        ctx.arc(swatchX + swatchSize / 2, labelY, swatchSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = color.hex;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Reset
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    });
  },

  /**
   * Draw a rounded rectangle path (without filling/stroking).
   * Uses native roundRect if available, otherwise manual arcs.
   */
  _roundRect(ctx, x, y, w, h, r) {
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }
  },

  // ────────────────────────────────────────────
  //  CLEAR ZONES
  // ────────────────────────────────────────────

  /**
   * Clear zone overlays and restore original image.
   * @param {HTMLCanvasElement} canvas
   * @param {ImageData} originalImageData
   */
  clearZones(canvas, originalImageData) {
    const ctx = canvas.getContext('2d');
    if (originalImageData) {
      ctx.putImageData(originalImageData, 0, 0);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  },

  // ────────────────────────────────────────────
  //  UTILITY: ZONE ADJUSTMENT
  // ────────────────────────────────────────────

  /**
   * Allow manual adjustment of zone proportions.
   * Returns new zones with updated proportions.
   * Useful if the user wants to shift zone boundaries.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {Object} proportions — { topEnd: 0.42, bottomEnd: 0.78 }
   * @returns {Object} zones
   */
  detectZonesWithProportions(canvas, proportions = {}) {
    const {
      topStart = 0.08,
      topEnd = 0.42,
      bottomEnd = 0.78,
      shoesEnd = 0.97,
    } = proportions;

    // Temporarily override config
    const original = { ...this._config.zones };

    this._config.zones = {
      top:    { ...original.top,    yStart: topStart, yEnd: topEnd },
      bottom: { ...original.bottom, yStart: topEnd,   yEnd: bottomEnd },
      shoes:  { ...original.shoes,  yStart: bottomEnd, yEnd: shoesEnd },
    };

    const zones = this.detectZones(canvas);

    // Restore config
    this._config.zones = original;

    return zones;
  },
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GarmentDetection;
}