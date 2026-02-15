
const ColorAnalysis = {

  // ────────────────────────────────────────────
  //  COLOR EXTRACTION — with outlier rejection
  // ────────────────────────────────────────────

  /**
   * Extract the dominant color from a canvas region.
   * Uses median-based extraction with outlier rejection
   * instead of naive averaging (which gets skewed by
   * skin, tags, buttons, and background pixels).
   */
  extractAverageColor(canvas, x, y, width, height) {
    const ctx = canvas.getContext('2d');

    // Clamp to canvas bounds
    const cx = Math.max(0, Math.round(x));
    const cy = Math.max(0, Math.round(y));
    const cw = Math.min(width, canvas.width - cx);
    const ch = Math.min(height, canvas.height - cy);

    if (cw <= 0 || ch <= 0) return { r: 128, g: 128, b: 128 };

    const imageData = ctx.getImageData(cx, cy, cw, ch);
    const data = imageData.data;

    // Collect sampled pixels (every 4th pixel for performance)
    const rValues = [];
    const gValues = [];
    const bValues = [];

    for (let i = 0; i < data.length; i += 16) {
      const a = data[i + 3];
      if (a < 128) continue; // Skip transparent pixels

      rValues.push(data[i]);
      gValues.push(data[i + 1]);
      bValues.push(data[i + 2]);
    }

    if (rValues.length === 0) return { r: 128, g: 128, b: 128 };

    // Use trimmed mean (discard top/bottom 10%) to reject outliers
    const trimmedMean = (arr) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const trimCount = Math.floor(sorted.length * 0.1);
      const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
      if (trimmed.length === 0) return sorted[Math.floor(sorted.length / 2)];
      return Math.round(trimmed.reduce((s, v) => s + v, 0) / trimmed.length);
    };

    return {
      r: trimmedMean(rValues),
      g: trimmedMean(gValues),
      b: trimmedMean(bValues)
    };
  },

  /**
   * Extract top N dominant colors from a region using
   * simple k-means-inspired bucketing. Useful for
   * detecting patterns, prints, and multi-color garments.
   */
  extractDominantColors(canvas, x, y, width, height, count = 3) {
    const ctx = canvas.getContext('2d');
    const cx = Math.max(0, Math.round(x));
    const cy = Math.max(0, Math.round(y));
    const cw = Math.min(width, canvas.width - cx);
    const ch = Math.min(height, canvas.height - cy);

    if (cw <= 0 || ch <= 0) return [];

    const imageData = ctx.getImageData(cx, cy, cw, ch);
    const data = imageData.data;

    // Bucket colors into a reduced color space (5-bit per channel = 32 levels)
    const buckets = new Map();
    const shift = 3; // 256 >> 3 = 32 buckets per channel

    for (let i = 0; i < data.length; i += 16) {
      if (data[i + 3] < 128) continue;

      const rKey = data[i] >> shift;
      const gKey = data[i + 1] >> shift;
      const bKey = data[i + 2] >> shift;
      const key = `${rKey},${gKey},${bKey}`;

      if (buckets.has(key)) {
        const bucket = buckets.get(key);
        bucket.count++;
        bucket.totalR += data[i];
        bucket.totalG += data[i + 1];
        bucket.totalB += data[i + 2];
      } else {
        buckets.set(key, {
          count: 1,
          totalR: data[i],
          totalG: data[i + 1],
          totalB: data[i + 2]
        });
      }
    }

    // Sort buckets by frequency, take top N
    const sorted = [...buckets.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, count);

    return sorted.map(b => ({
      r: Math.round(b.totalR / b.count),
      g: Math.round(b.totalG / b.count),
      b: Math.round(b.totalB / b.count),
      frequency: b.count
    }));
  },

  // ────────────────────────────────────────────
  //  COLOR CONVERSIONS
  // ────────────────────────────────────────────

  rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  },

  rgbToHex(r, g, b) {
    return '#' + [r, g, b]
      .map(x => x.toString(16).padStart(2, '0'))
      .join('');
  },

  /**
   * Convert RGB to relative luminance (WCAG standard).
   * Used for proper contrast ratio calculation.
   */
  relativeLuminance(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  },

  // ────────────────────────────────────────────
  //  HUE UTILITIES
  // ────────────────────────────────────────────

  /** Circular hue difference (0–180) */
  hueDifference(h1, h2) {
    const diff = Math.abs(h1 - h2);
    return Math.min(diff, 360 - diff);
  },

  /** Check if hue is in the warm range */
  isWarmHue(h) {
    return (h >= 0 && h < 70) || h >= 300;
  },

  /** Check if hue is in the cool range */
  isCoolHue(h) {
    return h >= 170 && h < 300;
  },

  // ────────────────────────────────────────────
  //  NEUTRAL DETECTION
  // ────────────────────────────────────────────

  /** Is this color a neutral? (black, white, gray, off-white, charcoal) */
  isNeutral(color) {
    const { s, l } = color.hsl;
    // Very low saturation = achromatic neutral
    if (s < 12) return true;
    // Near-black or near-white with low-ish saturation
    if ((l < 12 || l > 92) && s < 20) return true;
    return false;
  },

  /** Is this color a "fashion neutral"? (navy, khaki, olive, brown, beige) */
  isFashionNeutral(color) {
    if (this.isNeutral(color)) return true;

    const { h, s, l } = color.hsl;

    // Navy: dark blue, low-moderate saturation
    if (h >= 210 && h <= 250 && s >= 20 && s <= 60 && l >= 10 && l <= 30) return true;
    // Khaki/Beige: warm, low saturation, moderate lightness
    if (h >= 30 && h <= 55 && s >= 10 && s <= 40 && l >= 50 && l <= 80) return true;
    // Olive: yellow-green, low saturation, dark
    if (h >= 60 && h <= 100 && s >= 15 && s <= 45 && l >= 20 && l <= 45) return true;
    // Brown: warm, moderate saturation, dark
    if (h >= 15 && h <= 40 && s >= 20 && s <= 60 && l >= 15 && l <= 40) return true;

    return false;
  },

  // ────────────────────────────────────────────
  //  CONTRAST — WCAG Standard
  // ────────────────────────────────────────────

  /**
   * WCAG 2.0 contrast ratio between two colors.
   * Returns a ratio from 1:1 (identical) to 21:1 (black/white).
   */
  calculateContrast(color1, color2) {
    const l1 = this.relativeLuminance(color1.rgb.r, color1.rgb.g, color1.rgb.b);
    const l2 = this.relativeLuminance(color2.rgb.r, color2.rgb.g, color2.rgb.b);

    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);

    return (lighter + 0.05) / (darker + 0.05);
  },

  /**
   * Simple lightness-based contrast (backward compatible).
   * Returns 0–100.
   */
  lightnessContrast(color1, color2) {
    return Math.abs(color1.hsl.l - color2.hsl.l);
  },

  // ────────────────────────────────────────────
  //  COLOR TEMPERATURE
  // ────────────────────────────────────────────

  /**
   * Determine the temperature of a color.
   * Returns 'warm', 'cool', or 'neutral'.
   */
  getTemperature(color) {
    if (this.isNeutral(color)) return 'neutral';
    return this.isWarmHue(color.hsl.h) ? 'warm' : 'cool';
  },

  /**
   * Analyze temperature coherence across multiple colors.
   * Returns { dominant, warmCount, coolCount, neutralCount, coherence (0-1) }
   */
  analyzeTemperature(colors) {
    let warmCount = 0;
    let coolCount = 0;
    let neutralCount = 0;

    colors.forEach(c => {
      const temp = this.getTemperature(c);
      if (temp === 'warm') warmCount++;
      else if (temp === 'cool') coolCount++;
      else neutralCount++;
    });

    const chromaticTotal = warmCount + coolCount;
    const coherence = chromaticTotal > 0
      ? Math.max(warmCount, coolCount) / chromaticTotal
      : 1; // All neutral = perfectly coherent

    let dominant = 'neutral';
    if (warmCount > coolCount) dominant = 'warm';
    else if (coolCount > warmCount) dominant = 'cool';

    return { dominant, warmCount, coolCount, neutralCount, coherence };
  },

  // ────────────────────────────────────────────
  //  HARMONY ANALYSIS — Expanded & Neutral-Aware
  // ────────────────────────────────────────────

  analyzeHarmony(colors) {
    if (colors.length < 2) {
      return {
        type: 'Single Color',
        score: 50,
        explanation: 'Only one garment color detected.',
        details: {}
      };
    }

    // Separate neutrals from chromatic colors
    const neutrals = colors.filter(c => this.isNeutral(c));
    const chromatics = colors.filter(c => !this.isNeutral(c));

    // ── All neutrals ──
    if (chromatics.length === 0) {
      const lightRange = Math.max(...colors.map(c => c.hsl.l)) - Math.min(...colors.map(c => c.hsl.l));
      if (lightRange > 40) {
        return {
          type: 'Achromatic Contrast',
          score: 85,
          explanation: 'A bold neutral palette with strong light-dark contrast. Classic and impactful — think black and white.',
          details: { lightRange, neutralCount: neutrals.length }
        };
      }
      return {
        type: 'Achromatic',
        score: 72,
        explanation: 'All neutral tones. Clean and safe, but could benefit from more contrast or a pop of color.',
        details: { lightRange, neutralCount: neutrals.length }
      };
    }

    // ── One chromatic + neutrals ──
    if (chromatics.length === 1 && neutrals.length >= 1) {
      const saturation = chromatics[0].hsl.s;
      if (saturation > 50) {
        return {
          type: 'Neutral-Anchored Pop',
          score: 88,
          explanation: 'One vibrant color grounded by neutrals — a strong, intentional styling choice. The eye has a clear focal point.',
          details: { popColor: chromatics[0].hsl, neutralCount: neutrals.length }
        };
      }
      return {
        type: 'Neutral-Anchored',
        score: 80,
        explanation: 'A muted color paired with neutrals. Understated and refined. Increasing saturation would add energy.',
        details: { popColor: chromatics[0].hsl, neutralCount: neutrals.length }
      };
    }

    // ── Multiple chromatic colors: analyze hue relationships ──
    const hues = chromatics.map(c => c.hsl.h);
    const saturations = chromatics.map(c => c.hsl.s);
    const avgSaturation = saturations.reduce((a, b) => a + b, 0) / saturations.length;

    // Pairwise hue differences (only between chromatic colors)
    const differences = [];
    for (let i = 0; i < hues.length; i++) {
      for (let j = i + 1; j < hues.length; j++) {
        differences.push(this.hueDifference(hues[i], hues[j]));
      }
    }

    const maxDiff = Math.max(...differences);
    const minDiff = Math.min(...differences);
    const avgDiff = differences.reduce((a, b) => a + b, 0) / differences.length;

    // Temperature coherence
    const tempAnalysis = this.analyzeTemperature(chromatics);

    // ── Monochromatic (very similar hues) ──
    if (maxDiff < 25) {
      const satVariance = Math.max(...saturations) - Math.min(...saturations);
      const lightVariance = Math.max(...chromatics.map(c => c.hsl.l)) - Math.min(...chromatics.map(c => c.hsl.l));

      if (satVariance > 25 || lightVariance > 25) {
        return {
          type: 'Monochromatic',
          score: 87,
          explanation: 'Same hue family with good variation in shade/tint. Sophisticated and cohesive — shows deliberate color sense.',
          details: { maxDiff, satVariance, lightVariance, hasNeutrals: neutrals.length > 0 }
        };
      }
      return {
        type: 'Monochromatic - Flat',
        score: 68,
        explanation: 'Very similar colors with little variation. Try adding contrast through lighter/darker shades or a neutral accent.',
        details: { maxDiff, satVariance, lightVariance }
      };
    }

    // ── Analogous (neighbors on color wheel: 25–60°) ──
    if (maxDiff >= 25 && maxDiff <= 60) {
      const bonus = neutrals.length > 0 ? 5 : 0;
      const tempBonus = tempAnalysis.coherence === 1 ? 3 : 0;
      return {
        type: 'Analogous',
        score: Math.min(100, 88 + bonus + tempBonus),
        explanation: `Neighboring colors create natural, eye-pleasing harmony.${neutrals.length > 0 ? ' The neutral anchor elevates this further.' : ''} ${tempAnalysis.coherence === 1 ? 'Consistent temperature adds polish.' : ''}`.trim(),
        details: { avgDiff, hasNeutrals: neutrals.length > 0, temperature: tempAnalysis.dominant }
      };
    }

    // ── Split-Complementary (one color + the two neighbors of its complement: ~130–170°) ──
    if (chromatics.length >= 2 && differences.some(d => d >= 130 && d <= 170)) {
      return {
        type: 'Split-Complementary',
        score: 84,
        explanation: 'A sophisticated alternative to direct complements. High contrast without the tension of exact opposites.',
        details: { differences, avgSaturation }
      };
    }

    // ── Complementary (opposite: 150–180°) ──
    if (maxDiff >= 150 && maxDiff <= 180) {
      const hasAnchor = neutrals.length > 0;
      if (avgSaturation > 60 && !hasAnchor) {
        return {
          type: 'Complementary - Bold',
          score: 75,
          explanation: 'Two saturated opposites compete for attention without a neutral to calm things down. Powerful but intense — add a neutral to balance.',
          details: { maxDiff, avgSaturation, hasNeutralAnchor: hasAnchor }
        };
      }
      return {
        type: 'Complementary',
        score: hasAnchor ? 90 : 84,
        explanation: `Opposite colors create vibrant visual tension.${hasAnchor ? ' The neutral anchor balances the contrast beautifully.' : ' A neutral piece (black, white, gray) would polish this further.'}`,
        details: { maxDiff, avgSaturation, hasNeutralAnchor: hasAnchor }
      };
    }

    // ── Triadic (3 colors roughly 120° apart) ──
    if (chromatics.length >= 3 && differences.length >= 3) {
      const spreadVariance = maxDiff - minDiff;
      const isTriadic = differences.every(d => d >= 90 && d <= 150) || spreadVariance < 40;

      if (isTriadic && avgDiff >= 90) {
        return {
          type: 'Triadic',
          score: 82,
          explanation: 'Three evenly-spaced colors create vibrant, dynamic balance. Best when one color dominates and the others accent.',
          details: { differences, spreadVariance }
        };
      }
    }

    // ── Color Clash — awkward angles with high saturation ──
    if (avgDiff >= 60 && avgDiff < 130 && avgSaturation > 45) {
      // Check if neutrals rescue it
      if (neutrals.length >= 1 && chromatics.length <= 2) {
        return {
          type: 'Tension (Neutral-Rescued)',
          score: 62,
          explanation: 'These chromatic colors sit at an awkward angle, but the neutral piece reduces visual chaos. Still, consider swapping one color for an analogous shade.',
          details: { avgDiff, avgSaturation, neutralCount: neutrals.length }
        };
      }

      // Temperature clash amplifies the issue
      const tempClash = tempAnalysis.warmCount > 0 && tempAnalysis.coolCount > 0;
      return {
        type: 'Color Clash',
        score: tempClash ? 32 : 40,
        explanation: `Colors at awkward angles (${Math.round(avgDiff)}°) on the color wheel.${tempClash ? ' Mixing warm and cool tones intensifies the clash.' : ''} Consider replacing one piece with a neutral or analogous color.`,
        details: { avgDiff, avgSaturation, tempClash }
      };
    }

    // ── Warm Harmony / Cool Harmony ──
    if (tempAnalysis.coherence === 1 && chromatics.length >= 2) {
      return {
        type: `${tempAnalysis.dominant === 'warm' ? 'Warm' : 'Cool'} Harmony`,
        score: 78,
        explanation: `All chromatic colors share a ${tempAnalysis.dominant} temperature. This creates a naturally cohesive feel, even if hues differ. ${tempAnalysis.dominant === 'warm' ? 'Warm tones feel inviting and energetic.' : 'Cool tones feel calm and composed.'}`,
        details: { temperature: tempAnalysis }
      };
    }

    // ── Default: Mixed ──
    const mixedScore = Math.round(50 + (tempAnalysis.coherence * 15) + (neutrals.length > 0 ? 5 : 0));
    return {
      type: 'Mixed',
      score: Math.min(70, mixedScore),
      explanation: `The color combination doesn't follow a strong harmonic pattern. ${neutrals.length > 0 ? 'The neutral helps, but ' : ''}consider sticking to analogous or complementary relationships.`,
      details: { avgDiff, maxDiff, temperature: tempAnalysis, neutralCount: neutrals.length }
    };
  },

  // ────────────────────────────────────────────
  //  COLOR DESCRIPTION — Fashion-aware names
  // ────────────────────────────────────────────

  getColorDescription(color) {
    const { h, s, l } = color.hsl;

    // ── Achromatic ──
    if (s < 8) {
      if (l < 8)  return 'Black';
      if (l < 20) return 'Charcoal';
      if (l < 35) return 'Dark Gray';
      if (l < 50) return 'Gray';
      if (l < 65) return 'Silver';
      if (l < 80) return 'Light Gray';
      if (l < 92) return 'Off-White';
      return 'White';
    }

    // ── Near-neutral with slight tint ──
    if (s < 15) {
      if (l < 15) return 'Near Black';
      if (l > 85) return 'Off-White';
      // Slight warm tint
      if (h >= 20 && h < 50 && l >= 60) return 'Cream';
      if (h >= 20 && h < 50 && l < 60) return 'Taupe';
      return 'Gray';
    }

    // ── Chromatic: build description ──
    let hueName = this._getHueName(h, s, l);

    // Lightness modifier
    if (l < 18) return `Very Dark ${hueName}`;
    if (l < 30) return `Dark ${hueName}`;
    if (l > 82) return `Pale ${hueName}`;
    if (l > 70) return `Light ${hueName}`;

    // Saturation modifier
    if (s < 25) return `Muted ${hueName}`;
    if (s > 80) return `Vivid ${hueName}`;
    if (s > 65) return `Vibrant ${hueName}`;

    return hueName;
  },

  /** Map hue angle to fashion-aware color name */
  _getHueName(h, s, l) {
    // Reds (345–15)
    if (h >= 345 || h < 8) {
      if (l < 30 && s > 30) return 'Maroon';
      if (l < 40 && s > 40) return 'Burgundy';
      if (s > 60 && l > 40) return 'Red';
      return 'Red';
    }

    // Red-orange (8–20)
    if (h >= 8 && h < 20) {
      if (l > 60 && s > 50) return 'Coral';
      if (l < 35) return 'Rust';
      return 'Red-Orange';
    }

    // Orange (20–40)
    if (h >= 20 && h < 40) {
      if (l < 35 && s >= 20) return 'Brown';
      if (l >= 35 && l < 50 && s < 50) return 'Tan';
      if (s > 60 && l > 55) return 'Orange';
      if (l > 70) return 'Peach';
      return 'Orange';
    }

    // Gold / Yellow-Orange (40–50)
    if (h >= 40 && h < 50) {
      if (l < 40) return 'Dark Gold';
      if (s > 50) return 'Gold';
      if (l > 75) return 'Beige';
      return 'Gold';
    }

    // Yellow (50–70)
    if (h >= 50 && h < 70) {
      if (l < 40 && s < 50) return 'Olive';
      if (s < 40 && l > 60) return 'Khaki';
      if (l > 75) return 'Lemon';
      return 'Yellow';
    }

    // Yellow-Green (70–90)
    if (h >= 70 && h < 90) {
      if (l < 40) return 'Olive';
      if (s > 50) return 'Lime';
      return 'Yellow-Green';
    }

    // Green (90–160)
    if (h >= 90 && h < 160) {
      if (l < 25 && s < 50) return 'Forest Green';
      if (l < 35) return 'Dark Green';
      if (h >= 140 && s > 30) return 'Emerald';
      if (s > 50 && l > 40) return 'Green';
      if (s < 35) return 'Sage';
      return 'Green';
    }

    // Teal (160–185)
    if (h >= 160 && h < 185) {
      if (l < 35) return 'Dark Teal';
      return 'Teal';
    }

    // Cyan (185–200)
    if (h >= 185 && h < 200) {
      if (l > 70) return 'Light Cyan';
      return 'Cyan';
    }

    // Blue (200–250)
    if (h >= 200 && h < 250) {
      if (l < 20 && s > 25) return 'Navy';
      if (l < 35 && s > 20) return 'Dark Blue';
      if (h >= 220 && h < 245 && s > 50) return 'Royal Blue';
      if (l > 65) return 'Sky Blue';
      if (s < 35) return 'Steel Blue';
      return 'Blue';
    }

    // Indigo (250–270)
    if (h >= 250 && h < 270) {
      if (l < 30) return 'Dark Indigo';
      return 'Indigo';
    }

    // Purple / Violet (270–300)
    if (h >= 270 && h < 300) {
      if (l < 30) return 'Dark Purple';
      if (l > 70) return 'Lavender';
      if (s > 50) return 'Purple';
      return 'Mauve';
    }

    // Pink / Magenta (300–345)
    if (h >= 300 && h < 330) {
      if (s > 60 && l > 40) return 'Magenta';
      if (l > 70) return 'Pink';
      if (l < 35) return 'Plum';
      return 'Pink';
    }

    if (h >= 330 && h < 345) {
      if (l > 65) return 'Rose';
      if (l < 30) return 'Wine';
      if (s > 50) return 'Hot Pink';
      return 'Rose';
    }

    return 'Unknown';
  },

  // ────────────────────────────────────────────
  //  SUGGESTIONS ENGINE
  // ────────────────────────────────────────────

  /**
   * Generate specific improvement suggestions based on the current outfit.
   * Returns an array of suggestion strings.
   */
  generateSuggestions(colors, harmonyResult) {
    const suggestions = [];
    const neutrals = colors.filter(c => this.isNeutral(c));
    const chromatics = colors.filter(c => !this.isNeutral(c));
    const tempAnalysis = this.analyzeTemperature(colors);

    // No neutral anchor
    if (neutrals.length === 0 && chromatics.length >= 2) {
      suggestions.push(
        'Add a neutral piece (black, white, gray, or navy) to anchor the outfit and reduce visual noise.'
      );
    }

    // Warm/cool clash
    if (tempAnalysis.warmCount > 0 && tempAnalysis.coolCount > 0 && chromatics.length >= 2) {
      suggestions.push(
        `You're mixing warm and cool tones. Try committing to one temperature family — ${tempAnalysis.dominant === 'warm' ? 'swap cool pieces for warm ones' : 'swap warm pieces for cool ones'}.`
      );
    }

    // Very low contrast
    const contrasts = [];
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        contrasts.push(this.lightnessContrast(colors[i], colors[j]));
      }
    }
    const avgContrast = contrasts.length > 0
      ? contrasts.reduce((a, b) => a + b, 0) / contrasts.length
      : 0;

    if (avgContrast < 15) {
      suggestions.push(
        'The outfit lacks contrast — everything blends together. Try a lighter top with darker bottoms (or vice versa).'
      );
    }

    // Too many saturated colors
    const highSatCount = colors.filter(c => c.hsl.s > 70).length;
    if (highSatCount >= 3) {
      suggestions.push(
        'Multiple highly-saturated colors compete for attention. Tone down 1–2 pieces to let one color be the star.'
      );
    }

    // Color clash
    if (harmonyResult.type === 'Color Clash') {
      suggestions.push(
        'These colors clash. Quick fix: replace one chromatic piece with a neutral, or shift it to a neighboring hue (±30° on the color wheel).'
      );
    }

    // All neutrals — suggest adding color
    if (chromatics.length === 0) {
      suggestions.push(
        'All neutral is safe but can feel flat. Try adding one saturated accent — a colored shoe, bag, or top layer.'
      );
    }

    // Monochromatic flat
    if (harmonyResult.type === 'Monochromatic - Flat') {
      suggestions.push(
        'Same-hue outfit needs more light/dark variation. Try pairing a darker shade on bottom with a lighter shade on top.'
      );
    }

    return suggestions;
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ColorAnalysis;
}