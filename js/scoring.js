
const Scoring = {
  _mapRange(value, inMin, inMax, outMin, outMax) {
    const clamped = Math.max(inMin, Math.min(inMax, value));
    return outMin + ((clamped - inMin) / (inMax - inMin)) * (outMax - outMin);
  },

  /**
   * Bell curve — peaks at `center`, falls off by `spread`.
   * Returns 0–1. Useful for "ideal range" scoring.
   */
  _bellCurve(value, center, spread) {
    return Math.exp(-0.5 * Math.pow((value - center) / spread, 2));
  },

  /**
   * Compute pairwise lightness contrasts for a color array.
   */
  _pairwiseContrasts(colors) {
    const contrasts = [];
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        contrasts.push(Math.abs(colors[i].hsl.l - colors[j].hsl.l));
      }
    }
    return contrasts;
  },

  /**
   * Circular hue difference (0–180).
   */
  _hueDiff(h1, h2) {
    const d = Math.abs(h1 - h2);
    return Math.min(d, 360 - d);
  },

  /**
   * Check if a color is a neutral (black, white, gray).
   */
  _isNeutral(color) {
    return color.hsl.s < 12;
  },

  /**
   * Check if hue is in the warm range.
   */
  _isWarmHue(h) {
    return (h >= 0 && h < 70) || h >= 300;
  },

  /**
   * Check if hue is in the cool range.
   */
  _isCoolHue(h) {
    return h >= 170 && h < 300;
  },

  // ───────────────────────���────────────────────
  //  CONFIDENCE (0–100)
  // ────────────────────────────────────────────

  calculateConfidence(colors) {
    if (!colors || colors.length === 0) return 0;

    let score = 0;
    const weights = { contrast: 25, saturation: 20, balance: 15, neutralAnchor: 15, intentionality: 15, darkness: 10 };

    // --- Factor 1: Contrast (25 pts) ---
    // Ideal average contrast is ~35–45% lightness difference
    const contrasts = this._pairwiseContrasts(colors);
    if (contrasts.length > 0) {
      const avgContrast = contrasts.reduce((a, b) => a + b, 0) / contrasts.length;
      // Bell curve centered at 40 with spread 20
      score += this._bellCurve(avgContrast, 40, 20) * weights.contrast;
    }

    // --- Factor 2: Saturation strength (20 pts) ---
    const avgSat = colors.reduce((s, c) => s + c.hsl.s, 0) / colors.length;
    // Moderate-to-high saturation (40–70) is most confident
    score += this._bellCurve(avgSat, 55, 25) * weights.saturation;

    // --- Factor 3: Visual balance (15 pts) ---
    // Standard deviation of lightness — lower = more balanced
    const avgLight = colors.reduce((s, c) => s + c.hsl.l, 0) / colors.length;
    const lightStdDev = Math.sqrt(colors.reduce((s, c) => s + Math.pow(c.hsl.l - avgLight, 2), 0) / colors.length);
    // Ideal std dev is 10–20 (some contrast but balanced)
    score += this._bellCurve(lightStdDev, 15, 12) * weights.balance;

    // --- Factor 4: Neutral anchor rule (15 pts) ---
    // Having 1 neutral among chromatic colors is a strong styling choice
    const neutralCount = colors.filter(c => this._isNeutral(c)).length;
    const chromaticCount = colors.length - neutralCount;

    if (neutralCount === 1 && chromaticCount >= 1) {
      score += weights.neutralAnchor; // Perfect anchor
    } else if (neutralCount === colors.length) {
      score += weights.neutralAnchor * 0.75; // All neutral = minimalist
    } else if (neutralCount === 0 && avgSat > 50) {
      score += weights.neutralAnchor * 0.6; // Bold, no anchor
    } else if (neutralCount >= 2) {
      score += weights.neutralAnchor * 0.5; // Multiple neutrals = safe
    }

    // --- Factor 5: Intentionality — warm/cool coherence (15 pts) ---
    const chromaticColors = colors.filter(c => !this._isNeutral(c));
    if (chromaticColors.length >= 2) {
      const warmCount = chromaticColors.filter(c => this._isWarmHue(c.hsl.h)).length;
      const coolCount = chromaticColors.filter(c => this._isCoolHue(c.hsl.h)).length;
      const coherence = Math.max(warmCount, coolCount) / chromaticColors.length;
      score += coherence * weights.intentionality;
    } else {
      score += weights.intentionality * 0.8; // Single chromatic or all neutral
    }

    // --- Factor 6: Darkness factor (10 pts) ---
    // Very dark outfits (all-black aesthetic) naturally project confidence
    if (avgLight < 20 && avgSat < 20) {
      score += weights.darkness; // All-dark look
    } else if (avgLight < 35) {
      score += weights.darkness * 0.7; // Dark palette
    } else if (avgLight > 75) {
      score += weights.darkness * 0.4; // Very light — softer confidence
    } else {
      score += weights.darkness * 0.5; // Middle range
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  },

  // ────────────────────────────────────────────
  //  MOOD DETECTION — Expanded categories
  // ────────────────────────────────────────────

  detectMood(colors) {
    if (!colors || colors.length === 0) {
      return { mood: 'Unknown', emoji: '❓', explanation: 'No colors detected.' };
    }

    const avgHue = colors.reduce((s, c) => s + c.hsl.h, 0) / colors.length;
    const avgSat = colors.reduce((s, c) => s + c.hsl.s, 0) / colors.length;
    const avgLight = colors.reduce((s, c) => s + c.hsl.l, 0) / colors.length;

    const lightnesses = colors.map(c => c.hsl.l);
    const maxContrast = Math.max(...lightnesses) - Math.min(...lightnesses);

    const chromaticColors = colors.filter(c => !this._isNeutral(c));
    const neutralCount = colors.filter(c => this._isNeutral(c)).length;
    const hues = chromaticColors.map(c => c.hsl.h);
    const hueSpread = hues.length >= 2
      ? Math.max(...hues) - Math.min(...hues)
      : 0;

    const isWarm = this._isWarmHue(avgHue);
    const isCool = this._isCoolHue(avgHue);

    // --- Priority-ordered mood checks ---

    // 1. Dark / Edgy — very low lightness, low saturation
    if (avgLight < 18 && avgSat < 20) {
      return {
        mood: 'Dark / Edgy',
        emoji: '🖤',
        explanation: 'A very dark, moody palette. Projects power, mystery, and a bold sense of self.'
      };
    }

    // 2. Monochrome Minimal — all neutrals, moderate lightness
    if (neutralCount === colors.length && avgLight >= 18 && avgLight <= 75) {
      return {
        mood: 'Monochrome Minimal',
        emoji: '🤍',
        explanation: 'A purely neutral palette. Timeless, clean, and effortlessly chic. Works anywhere.'
      };
    }

    // 3. Energetic / Bold — high saturation + warm or high contrast
    if (avgSat > 55 && (isWarm || maxContrast > 40)) {
      return {
        mood: 'Energetic / Bold',
        emoji: '⚡',
        explanation: 'High saturation and warm tones create an energetic, attention-grabbing look. You mean business!'
      };
    }

    // 4. Romantic / Soft — pinks, pastels, light + moderate saturation
    if (avgLight > 60 && avgSat >= 20 && avgSat <= 55 && (avgHue >= 300 || avgHue < 30)) {
      return {
        mood: 'Romantic / Soft',
        emoji: '🌸',
        explanation: 'Soft pastels and warm pinks evoke warmth, romance, and approachability.'
      };
    }

    // 5. Earthy / Natural — warm hues (oranges, browns, olive), moderate saturation
    if (isWarm && avgSat >= 15 && avgSat <= 50 && avgLight >= 20 && avgLight <= 55) {
      return {
        mood: 'Earthy / Natural',
        emoji: '🍂',
        explanation: 'Warm, grounded tones inspired by nature. Feels authentic, approachable, and reliable.'
      };
    }

    // 6. Calm / Professional — cool hues, moderate saturation
    if (isCool && avgSat >= 20 && avgSat <= 55 && maxContrast < 40) {
      return {
        mood: 'Calm / Professional',
        emoji: '💼',
        explanation: 'Cool colors with balanced saturation project professionalism and trustworthiness.'
      };
    }

    // 7. Playful / Creative — diverse hues, varied saturation
    if (chromaticColors.length >= 2 && hueSpread > 60 && avgSat > 35) {
      return {
        mood: 'Playful / Creative',
        emoji: '🎨',
        explanation: 'Diverse colors and high saturation create a fun, creative, and expressive vibe.'
      };
    }

    // 8. Fresh / Sporty — high lightness, moderate-high saturation
    if (avgLight > 55 && avgSat > 40 && maxContrast > 25) {
      return {
        mood: 'Fresh / Sporty',
        emoji: '🏃',
        explanation: 'Bright, energetic colors with good contrast. Feels active, youthful, and dynamic.'
      };
    }

    // 9. Minimal / Elegant — low saturation, mid lightness
    if (avgSat < 25 && avgLight > 30 && avgLight < 70) {
      return {
        mood: 'Minimal / Elegant',
        emoji: '✨',
        explanation: 'Muted tones and subtle colors create a refined, sophisticated aesthetic.'
      };
    }

    // 10. Neutral / Classic — very low saturation
    if (avgSat < 15) {
      return {
        mood: 'Neutral / Classic',
        emoji: '🎯',
        explanation: 'Achromatic palette with neutral tones. Timeless and versatile for any occasion.'
      };
    }

    // 11. Default
    return {
      mood: 'Balanced',
      emoji: '⚖️',
      explanation: 'A well-balanced outfit with moderate color choices. Versatile for everyday wear.'
    };
  },

  // ────────────────────────────────────────────
  //  OUTFIT SCORE (0–100) — 6 weighted factors
  // ────────────────────────────────────────────

  calculateOutfitScore(colors, harmonyResult) {
    let score = 0;
    const breakdown = [];

    // ── 1. Color Harmony (30 pts) ──
    const harmonyPoints = Math.round(harmonyResult.score * 0.30);
    score += harmonyPoints;
    breakdown.push({
      category: '🎨 Color Harmony',
      points: harmonyPoints,
      max: 30,
      detail: harmonyResult.type
    });

    // ── 2. Contrast Balance (18 pts) ──
    const contrasts = this._pairwiseContrasts(colors);
    let contrastPoints = 0;
    if (contrasts.length > 0) {
      const avgContrast = contrasts.reduce((a, b) => a + b, 0) / contrasts.length;
      // Bell curve: ideal contrast at 38%, spread 18
      contrastPoints = Math.round(this._bellCurve(avgContrast, 38, 18) * 18);
    }
    score += contrastPoints;
    const avgContrastDisplay = contrasts.length > 0
      ? Math.round(contrasts.reduce((a, b) => a + b, 0) / contrasts.length)
      : 0;
    breakdown.push({
      category: '🔲 Contrast Balance',
      points: contrastPoints,
      max: 18,
      detail: contrasts.length > 0 ? `Avg difference: ${avgContrastDisplay}%` : 'N/A'
    });

    // ── 3. Color Intensity (15 pts) ──
    const avgSat = colors.reduce((s, c) => s + c.hsl.s, 0) / colors.length;
    const satVariance = Math.max(...colors.map(c => c.hsl.s)) - Math.min(...colors.map(c => c.hsl.s));

    let intensityPoints = 0;
    // Reward good saturation variance (20–50) and moderate avg saturation
    const satVarScore = this._bellCurve(satVariance, 35, 20) * 8;
    const avgSatScore = this._bellCurve(avgSat, 45, 25) * 7;
    intensityPoints = Math.round(satVarScore + avgSatScore);

    score += intensityPoints;
    breakdown.push({
      category: '💡 Color Intensity',
      points: intensityPoints,
      max: 15,
      detail: `Avg saturation: ${Math.round(avgSat)}% · Variance: ${Math.round(satVariance)}%`
    });

    // ── 4. Warm/Cool Coherence (12 pts) ──
    const chromaticColors = colors.filter(c => !this._isNeutral(c));
    let coherencePoints = 0;

    if (chromaticColors.length >= 2) {
      const warmCount = chromaticColors.filter(c => this._isWarmHue(c.hsl.h)).length;
      const coolCount = chromaticColors.filter(c => this._isCoolHue(c.hsl.h)).length;
      const dominance = Math.max(warmCount, coolCount) / chromaticColors.length;

      if (dominance === 1) {
        coherencePoints = 12; // Perfect coherence
      } else if (dominance >= 0.66) {
        coherencePoints = 8;  // Mostly coherent
      } else {
        coherencePoints = 4;  // Mixed warm/cool
      }
    } else {
      coherencePoints = 10; // All neutral or single chromatic — fine
    }

    score += coherencePoints;
    const warmCoolLabel = chromaticColors.length >= 2
      ? (() => {
          const w = chromaticColors.filter(c => this._isWarmHue(c.hsl.h)).length;
          const k = chromaticColors.filter(c => this._isCoolHue(c.hsl.h)).length;
          if (w > k) return `Warm-dominant (${w}/${chromaticColors.length})`;
          if (k > w) return `Cool-dominant (${k}/${chromaticColors.length})`;
          return 'Mixed warm/cool';
        })()
      : 'Neutral palette';

    breakdown.push({
      category: '🌡️ Warm/Cool Coherence',
      points: coherencePoints,
      max: 12,
      detail: warmCoolLabel
    });

    // ── 5. Neutral Anchoring (10 pts) ──
    const neutralCount = colors.filter(c => this._isNeutral(c)).length;
    let anchorPoints = 0;

    if (neutralCount === 1 && chromaticColors.length >= 1) {
      anchorPoints = 10; // Perfect: 1 neutral grounds the outfit
    } else if (neutralCount === 2 && colors.length === 3) {
      anchorPoints = 7; // Safe but less interesting
    } else if (neutralCount === 0 && avgSat > 50) {
      anchorPoints = 5; // All chromatic — bold but risky
    } else if (neutralCount === colors.length) {
      anchorPoints = 8; // All neutral — clean, intentional
    } else {
      anchorPoints = 6;
    }

    score += anchorPoints;
    breakdown.push({
      category: '⚓ Neutral Anchoring',
      points: anchorPoints,
      max: 10,
      detail: `${neutralCount} neutral${neutralCount !== 1 ? 's' : ''} out of ${colors.length} items`
    });

    // ── 6. Professional Polish (15 pts) ──
    let polishPoints = 15;
    const issues = [];

    // Penalty: Color clash
    if (harmonyResult.type === 'Color Clash') {
      polishPoints -= 8;
      issues.push('Color clash detected');
    }

    // Penalty: Too many high-saturation colors
    const highSatCount = colors.filter(c => c.hsl.s > 75).length;
    if (highSatCount >= 3) {
      polishPoints -= 5;
      issues.push('Too many vibrant colors');
    }

    // Penalty: Warm/cool clash (mixing warm and cool chromatics equally)
    if (chromaticColors.length >= 2) {
      const warmC = chromaticColors.filter(c => this._isWarmHue(c.hsl.h)).length;
      const coolC = chromaticColors.filter(c => this._isCoolHue(c.hsl.h)).length;
      if (warmC > 0 && coolC > 0 && Math.abs(warmC - coolC) <= 1) {
        polishPoints -= 4;
        issues.push('Warm/cool temperature clash');
      }
    }

    // Penalty: Extreme lightness mismatch (e.g., neon top with black bottom with white shoes)
    const lightnesses = colors.map(c => c.hsl.l);
    const lightStdDev = Math.sqrt(lightnesses.reduce((s, l) => s + Math.pow(l - lightnesses.reduce((a, b) => a + b, 0) / lightnesses.length, 2), 0) / lightnesses.length);
    if (lightStdDev > 30) {
      polishPoints -= 3;
      issues.push('Extreme lightness variation');
    }

    // Bonus: Strong intentional design
    if (harmonyResult.type === 'Analogous') {
      polishPoints += 3;
      issues.push('Analogous harmony (+)');
    } else if (harmonyResult.type === 'Complementary') {
      polishPoints += 2;
      issues.push('Complementary intent (+)');
    } else if (harmonyResult.type === 'Monochromatic' && chromaticColors.length >= 2) {
      polishPoints += 2;
      issues.push('Monochromatic intent (+)');
    }

    polishPoints = Math.max(0, Math.min(15, polishPoints));
    score += polishPoints;
    breakdown.push({
      category: '👔 Professional Polish',
      points: polishPoints,
      max: 15,
      detail: issues.length > 0 ? issues.join(' · ') : 'No issues detected'
    });

    return {
      total: Math.max(0, Math.min(100, Math.round(score))),
      breakdown: breakdown
    };
  },

  // ────────────────────────────────────────────
  //  GRADE — More granular scale
  // ────────────────────────────────────────────

  getGrade(score) {
    if (score >= 95) return { letter: 'S',  color: 'text-purple-400', description: 'Perfection! 💎 Runway-ready.' };
    if (score >= 90) return { letter: 'A+', color: 'text-green-400',  description: 'Outstanding! A masterclass in color.' };
    if (score >= 85) return { letter: 'A',  color: 'text-green-400',  description: 'Excellent — polished and intentional.' };
    if (score >= 80) return { letter: 'B+', color: 'text-blue-400',   description: 'Very Good — minor tweaks away from great.' };
    if (score >= 75) return { letter: 'B',  color: 'text-blue-400',   description: 'Good — solid color choices.' };
    if (score >= 70) return { letter: 'C+', color: 'text-yellow-400', description: 'Above Average — room to improve.' };
    if (score >= 65) return { letter: 'C',  color: 'text-yellow-400', description: 'Average — safe but unremarkable.' };
    if (score >= 58) return { letter: 'D+', color: 'text-orange-400', description: 'Below Average — some clashing.' };
    if (score >= 50) return { letter: 'D',  color: 'text-orange-400', description: 'Weak — needs rethinking.' };
    if (score >= 40) return { letter: 'E',  color: 'text-red-400',    description: 'Poor — significant color issues.' };
    return              { letter: 'F',  color: 'text-red-400',    description: 'Fail — complete color mismatch.' };
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Scoring;
}