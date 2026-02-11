// Scoring Module
// Handles confidence scoring, mood detection, and outfit scoring

const Scoring = {
  // Calculate psychological confidence score (0-100)
  calculateConfidence(colors) {
    if (!colors || colors.length === 0) return 0;
    
    let score = 50; // Base score
    
    // Factor 1: Color contrast (higher contrast = higher confidence)
    const contrasts = [];
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        const contrast = Math.abs(colors[i].hsl.l - colors[j].hsl.l);
        contrasts.push(contrast);
      }
    }
    
    if (contrasts.length > 0) {
      const avgContrast = contrasts.reduce((a, b) => a + b, 0) / contrasts.length;
      if (avgContrast > 40) {
        score += 15; // Strong contrast = confident
      } else if (avgContrast < 15) {
        score -= 5; // Very low contrast = less confident
      } else {
        score += 5; // Moderate contrast = slight boost
      }
    }
    
    // Factor 2: Saturation strength
    const avgSaturation = colors.reduce((sum, c) => sum + c.hsl.s, 0) / colors.length;
    if (avgSaturation > 60) {
      score += 10; // Bold colors = confident
    } else if (avgSaturation < 20) {
      score -= 5; // Very muted = less confident
    }
    
    // Factor 3: Visual balance (similar lightness = balanced)
    const lightnesses = colors.map(c => c.hsl.l);
    const maxLight = Math.max(...lightnesses);
    const minLight = Math.min(...lightnesses);
    const lightRange = maxLight - minLight;
    
    if (lightRange < 30) {
      score += 10; // Balanced = confident
    } else if (lightRange > 60) {
      score += 5; // High contrast can also be intentionally confident
    }
    
    // Factor 4: Not too many neutrals
    const neutralCount = colors.filter(c => c.hsl.s < 15).length;
    if (neutralCount === colors.length) {
      score += 5; // All neutrals = minimalist confidence
    } else if (neutralCount === 0 && avgSaturation > 50) {
      score += 8; // No neutrals, bold = very confident
    }
    
    // Clamp to 0-100
    return Math.max(0, Math.min(100, Math.round(score)));
  },

  // Detect outfit mood
  detectMood(colors) {
    if (!colors || colors.length === 0) {
      return { mood: 'Unknown', emoji: '❓', explanation: 'No colors detected.' };
    }
    
    const avgHue = colors.reduce((sum, c) => sum + c.hsl.h, 0) / colors.length;
    const avgSaturation = colors.reduce((sum, c) => sum + c.hsl.s, 0) / colors.length;
    const avgLightness = colors.reduce((sum, c) => sum + c.hsl.l, 0) / colors.length;
    
    // Calculate contrast
    const lightnesses = colors.map(c => c.hsl.l);
    const maxContrast = Math.max(...lightnesses) - Math.min(...lightnesses);
    
    // Check for warm vs cool hues
    const isWarm = (avgHue >= 0 && avgHue < 60) || (avgHue >= 300 && avgHue <= 360);
    const isCool = avgHue >= 180 && avgHue < 300;
    
    // Energetic / Bold (high saturation, warm hues, strong contrast)
    if (avgSaturation > 55 && (isWarm || maxContrast > 40)) {
      return {
        mood: 'Energetic / Bold',
        emoji: '⚡',
        explanation: 'High saturation and warm tones create an energetic, attention-grabbing look. You mean business!'
      };
    }
    
    // Calm / Professional (cool hues, moderate saturation)
    if (isCool && avgSaturation >= 25 && avgSaturation <= 55 && maxContrast < 40) {
      return {
        mood: 'Calm / Professional',
        emoji: '💼',
        explanation: 'Cool colors with balanced saturation project professionalism and trustworthiness.'
      };
    }
    
    // Minimal / Elegant (low saturation, neutral tones)
    if (avgSaturation < 25 && avgLightness > 30 && avgLightness < 70) {
      return {
        mood: 'Minimal / Elegant',
        emoji: '✨',
        explanation: 'Muted tones and subtle colors create a refined, sophisticated aesthetic.'
      };
    }
    
    // Neutral (very low saturation, achromatic)
    if (avgSaturation < 15) {
      return {
        mood: 'Neutral / Classic',
        emoji: '🎯',
        explanation: 'Achromatic palette with neutral tones. Timeless and versatile for any occasion.'
      };
    }
    
    // Playful (varied saturation and hues)
    if (avgSaturation > 40 && colors.length >= 3) {
      const hues = colors.map(c => c.hsl.h);
      const hueVariance = Math.max(...hues) - Math.min(...hues);
      if (hueVariance > 60) {
        return {
          mood: 'Playful / Creative',
          emoji: '🎨',
          explanation: 'Diverse colors and high saturation create a fun, creative, and expressive vibe.'
        };
      }
    }
    
    // Default
    return {
      mood: 'Balanced',
      emoji: '⚖️',
      explanation: 'A well-balanced outfit with moderate color choices.'
    };
  },

  // Calculate final outfit score (0-100) with breakdown
  calculateOutfitScore(colors, harmonyResult) {
    let score = 0;
    const breakdown = [];
    
    // Base score from harmony (40% weight)
    const harmonyScore = harmonyResult.score * 0.4;
    score += harmonyScore;
    breakdown.push({
      category: 'Color Harmony',
      points: Math.round(harmonyScore),
      max: 40,
      detail: harmonyResult.type
    });
    
    // Contrast ratio (20% weight)
    const contrasts = [];
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        const contrast = Math.abs(colors[i].hsl.l - colors[j].hsl.l);
        contrasts.push(contrast);
      }
    }
    
    let contrastScore = 0;
    if (contrasts.length > 0) {
      const avgContrast = contrasts.reduce((a, b) => a + b, 0) / contrasts.length;
      if (avgContrast >= 30 && avgContrast <= 50) {
        contrastScore = 20; // Ideal contrast
      } else if (avgContrast > 50 || avgContrast >= 20) {
        contrastScore = 15; // Acceptable contrast
      } else {
        contrastScore = 8; // Poor contrast
      }
    }
    score += contrastScore;
    breakdown.push({
      category: 'Contrast Balance',
      points: contrastScore,
      max: 20,
      detail: contrasts.length > 0 ? `Avg: ${Math.round(contrasts.reduce((a, b) => a + b, 0) / contrasts.length)}%` : 'N/A'
    });
    
    // Color intensity balance (20% weight)
    const avgSaturation = colors.reduce((sum, c) => sum + c.hsl.s, 0) / colors.length;
    const satVariance = Math.max(...colors.map(c => c.hsl.s)) - Math.min(...colors.map(c => c.hsl.s));
    
    let intensityScore = 0;
    if (avgSaturation > 70 || avgSaturation < 10) {
      intensityScore = 12; // Very bold or very neutral - intentional choice
    } else if (satVariance > 40) {
      intensityScore = 18; // Good variation
    } else {
      intensityScore = 15; // Moderate
    }
    score += intensityScore;
    breakdown.push({
      category: 'Color Intensity',
      points: intensityScore,
      max: 20,
      detail: `Avg saturation: ${Math.round(avgSaturation)}%`
    });
    
    // Professional judgment penalty (20% weight)
    // Strict penalties for common mistakes
    let professionalScore = 20;
    const penalties = [];
    
    // Penalty for clashing colors
    if (harmonyResult.type === 'Color Clash') {
      professionalScore -= 10;
      penalties.push('Color clash detected');
    }
    
    // Penalty for too many high-saturation colors
    const highSatCount = colors.filter(c => c.hsl.s > 75).length;
    if (highSatCount >= 3) {
      professionalScore -= 5;
      penalties.push('Too many vibrant colors');
    }
    
    // Bonus for intentional design
    if (harmonyResult.type === 'Analogous' || harmonyResult.type === 'Complementary') {
      professionalScore += 5;
      penalties.push('Strong design intent (+)');
    }
    
    score += Math.max(0, professionalScore);
    breakdown.push({
      category: 'Professional Style',
      points: Math.max(0, professionalScore),
      max: 20,
      detail: penalties.length > 0 ? penalties.join(', ') : 'No issues'
    });
    
    return {
      total: Math.round(score),
      breakdown: breakdown
    };
  },

  // Get grade letter based on score
  getGrade(score) {
    if (score >= 90) return { letter: 'A+', color: 'text-green-400', description: 'Outstanding!' };
    if (score >= 85) return { letter: 'A', color: 'text-green-400', description: 'Excellent' };
    if (score >= 80) return { letter: 'B+', color: 'text-blue-400', description: 'Very Good' };
    if (score >= 75) return { letter: 'B', color: 'text-blue-400', description: 'Good' };
    if (score >= 70) return { letter: 'C+', color: 'text-yellow-400', description: 'Above Average' };
    if (score >= 65) return { letter: 'C', color: 'text-yellow-400', description: 'Average' };
    if (score >= 60) return { letter: 'D+', color: 'text-orange-400', description: 'Below Average' };
    if (score >= 50) return { letter: 'D', color: 'text-orange-400', description: 'Needs Improvement' };
    return { letter: 'F', color: 'text-red-400', description: 'Poor' };
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Scoring;
}
