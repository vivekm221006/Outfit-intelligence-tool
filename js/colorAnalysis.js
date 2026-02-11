// Color Analysis Module
// Handles pixel-based color extraction, RGB to HSL conversion, and harmony analysis

const ColorAnalysis = {
  // Extract average color from a canvas region
  extractAverageColor(canvas, x, y, width, height) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(x, y, width, height);
    const data = imageData.data;
    
    let totalR = 0, totalG = 0, totalB = 0;
    let pixelCount = 0;
    
    // Sample every 4th pixel for performance (stride of 16 bytes = 4 pixels * 4 bytes/pixel)
    for (let i = 0; i < data.length; i += 16) {
      totalR += data[i];
      totalG += data[i + 1];
      totalB += data[i + 2];
      pixelCount++;
    }
    
    const avgR = Math.round(totalR / pixelCount);
    const avgG = Math.round(totalG / pixelCount);
    const avgB = Math.round(totalB / pixelCount);
    
    return { r: avgR, g: avgG, b: avgB };
  },

  // Convert RGB to HSL
  rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
      h = s = 0;
    } else {
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

  // Convert RGB to hex
  rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  },

  // Calculate hue difference (accounting for circular nature)
  hueDifference(h1, h2) {
    const diff = Math.abs(h1 - h2);
    return Math.min(diff, 360 - diff);
  },

  // Analyze color harmony between multiple garments
  analyzeHarmony(colors) {
    if (colors.length < 2) {
      return { type: 'Single Color', score: 50, explanation: 'Only one garment color detected.' };
    }

    const hues = colors.map(c => c.hsl.h);
    const saturations = colors.map(c => c.hsl.s);
    const lightnesses = colors.map(c => c.hsl.l);
    
    // Calculate pairwise hue differences
    const differences = [];
    for (let i = 0; i < hues.length; i++) {
      for (let j = i + 1; j < hues.length; j++) {
        differences.push(this.hueDifference(hues[i], hues[j]));
      }
    }
    
    const maxDiff = Math.max(...differences);
    const minDiff = Math.min(...differences);
    const avgSaturation = saturations.reduce((a, b) => a + b, 0) / saturations.length;
    
    // Check for monochromatic (similar hues)
    if (maxDiff < 30) {
      const satVariance = Math.max(...saturations) - Math.min(...saturations);
      if (satVariance > 20) {
        return {
          type: 'Monochromatic',
          score: 85,
          explanation: 'Similar hues with varied saturation create a cohesive, sophisticated look.'
        };
      }
      return {
        type: 'Monochromatic',
        score: 75,
        explanation: 'Very similar colors throughout. Consider varying saturation for more depth.'
      };
    }
    
    // Check for analogous (nearby on color wheel)
    if (maxDiff >= 30 && maxDiff <= 60) {
      return {
        type: 'Analogous',
        score: 90,
        explanation: 'Neighboring colors create natural harmony. This is visually pleasing and balanced.'
      };
    }
    
    // Check for complementary (opposite on color wheel)
    if (maxDiff >= 150 && maxDiff <= 210) {
      if (avgSaturation > 60) {
        return {
          type: 'Complementary - Bold',
          score: 80,
          explanation: 'Strong complementary contrast. Bold and attention-grabbing, but can be intense.'
        };
      }
      return {
        type: 'Complementary',
        score: 88,
        explanation: 'Complementary colors with balanced saturation. Creates visual interest and harmony.'
      };
    }
    
    // Check for color clash (awkward angles)
    if ((maxDiff >= 60 && maxDiff < 150) && avgSaturation > 50) {
      return {
        type: 'Color Clash',
        score: 40,
        explanation: 'Colors at awkward angles on the color wheel. This combination may appear jarring.'
      };
    }
    
    // Triadic or complex
    if (differences.length >= 3) {
      const isBalanced = Math.max(...differences) - Math.min(...differences) < 50;
      if (isBalanced) {
        return {
          type: 'Triadic',
          score: 82,
          explanation: 'Evenly spaced colors create balanced visual interest.'
        };
      }
    }
    
    // Default case
    return {
      type: 'Mixed',
      score: 65,
      explanation: 'Color combination is acceptable but lacks strong harmonic structure.'
    };
  },

  // Calculate contrast ratio between two colors
  calculateContrast(color1, color2) {
    const l1 = color1.hsl.l;
    const l2 = color2.hsl.l;
    return Math.abs(l1 - l2);
  },

  // Determine if a color is neutral (low saturation)
  isNeutral(color) {
    return color.hsl.s < 20;
  },

  // Get color description
  getColorDescription(color) {
    const { h, s, l } = color.hsl;
    
    let hueName = '';
    if (s < 10) {
      if (l < 20) return 'Black';
      if (l > 80) return 'White';
      return 'Gray';
    }
    
    if (h < 15 || h >= 345) hueName = 'Red';
    else if (h < 45) hueName = 'Orange';
    else if (h < 75) hueName = 'Yellow';
    else if (h < 150) hueName = 'Green';
    else if (h < 210) hueName = 'Cyan';
    else if (h < 260) hueName = 'Blue';
    else if (h < 300) hueName = 'Purple';
    else hueName = 'Pink';
    
    if (l < 30) return 'Dark ' + hueName;
    if (l > 70) return 'Light ' + hueName;
    if (s < 30) return 'Muted ' + hueName;
    if (s > 70) return 'Vibrant ' + hueName;
    
    return hueName;
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ColorAnalysis;
}
