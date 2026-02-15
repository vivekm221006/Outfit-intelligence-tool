
const Comparison = {

  // ────────────────────────────────────────────
  //  STORAGE KEYS
  // ────────────────────────────────────────────

  STORAGE_KEY: 'outfit-intelligence-history',
  BEST_KEY: 'outfit-intelligence-best',
  MAX_HISTORY: 50,       // Keep last 50 analyses
  CURRENT_VERSION: 2,    // Data schema version for migrations

  // ────────────────────────────────────────────
  //  SAVE
  // ────────────────────────────────────────────

  /**
   * Save an analysis result to history.
   * Also updates personal best if applicable.
   * @param {Object} analysisData
   * @returns {boolean}
   */
  saveAnalysis(analysisData) {
    if (!this._validateAnalysisData(analysisData)) {
      console.error('Invalid analysis data — not saving');
      return false;
    }

    try {
      const entry = {
        version: this.CURRENT_VERSION,
        id: this._generateId(),
        timestamp: new Date().toISOString(),
        colors: this._serializeColors(analysisData.colors),
        score: analysisData.score,
        harmony: {
          type: analysisData.harmony.type,
          score: analysisData.harmony.score,
        },
        confidence: analysisData.confidence,
        mood: {
          mood: analysisData.mood.mood,
          emoji: analysisData.mood.emoji,
        },
        grade: analysisData.grade ? {
          letter: analysisData.grade.letter,
          description: analysisData.grade.description,
        } : null,
      };

      // Load existing history
      const history = this._loadHistory();

      // Add new entry
      history.push(entry);

      // Trim to max size (keep most recent)
      if (history.length > this.MAX_HISTORY) {
        history.splice(0, history.length - this.MAX_HISTORY);
      }

      this._saveHistory(history);

      // Update personal best
      this._updatePersonalBest(entry);

      return true;
    } catch (error) {
      if (this._isQuotaError(error)) {
        console.warn('localStorage quota exceeded — pruning old entries');
        this._pruneHistory();
        // Retry once
        try {
          return this.saveAnalysis(analysisData);
        } catch {
          console.error('Failed to save even after pruning');
          return false;
        }
      }
      console.error('Failed to save analysis:', error);
      return false;
    }
  },

  // ────────────────────────────────────────────
  //  LOAD
  // ────────────────────────────────────────────

  /**
   * Load the most recent analysis.
   * @returns {Object|null}
   */
  loadLastAnalysis() {
    const history = this._loadHistory();
    if (history.length === 0) return null;
    return history[history.length - 1];
  },

  /**
   * Load the Nth most recent analysis (0 = most recent).
   * @param {number} index
   * @returns {Object|null}
   */
  loadAnalysis(index = 0) {
    const history = this._loadHistory();
    const i = history.length - 1 - index;
    return i >= 0 ? history[i] : null;
  },

  /**
   * Load full history (newest first).
   * @returns {Array}
   */
  getFullHistory() {
    return this._loadHistory().reverse();
  },

  /**
   * Get total number of analyses saved.
   * @returns {number}
   */
  getHistoryCount() {
    return this._loadHistory().length;
  },

  // ────────────────────────────────────────────
  //  COMPARISON — Rich diffs
  // ────────────────────────────────────────────

  /**
   * Compare current outfit with the most recent previous one.
   * Returns a rich comparison object with structured diffs.
   * @param {Object} currentAnalysis
   * @returns {Object}
   */
  compareOutfits(currentAnalysis) {
    const history = this._loadHistory();
    const previousAnalysis = history.length > 0 ? history[history.length - 1] : null;

    if (!previousAnalysis) {
      return {
        hasPrevious: false,
        isFirstAnalysis: true,
        message: '🎉 Welcome! This is your first outfit analysis. Future outfits will be compared to this one.',
        details: [],
        trend: null,
        personalBest: null,
      };
    }

    const scoreDiff = currentAnalysis.score.total - previousAnalysis.score.total;
    const confidenceDiff = currentAnalysis.confidence - previousAnalysis.confidence;
    const harmonyScoreDiff = currentAnalysis.harmony.score - previousAnalysis.harmony.score;

    // ── Build structured details ──
    const details = [];

    // Overall score change
    if (scoreDiff !== 0) {
      details.push({
        category: 'Overall Score',
        icon: scoreDiff > 0 ? '📈' : '📉',
        previous: previousAnalysis.score.total,
        current: currentAnalysis.score.total,
        diff: scoreDiff,
        text: `Score: ${currentAnalysis.score.total}/100 (${this._formatDiff(scoreDiff)})`,
        sentiment: scoreDiff > 0 ? 'positive' : scoreDiff < 0 ? 'negative' : 'neutral',
      });
    }

    // Confidence change
    if (Math.abs(confidenceDiff) > 3) {
      details.push({
        category: 'Confidence',
        icon: confidenceDiff > 0 ? '💪' : '😔',
        previous: previousAnalysis.confidence,
        current: currentAnalysis.confidence,
        diff: confidenceDiff,
        text: `Confidence: ${currentAnalysis.confidence}/100 (${this._formatDiff(confidenceDiff)})`,
        sentiment: confidenceDiff > 0 ? 'positive' : 'negative',
      });
    }

    // Harmony change
    if (currentAnalysis.harmony.type !== previousAnalysis.harmony.type) {
      details.push({
        category: 'Harmony',
        icon: harmonyScoreDiff >= 0 ? '🎨' : '⚠️',
        previous: previousAnalysis.harmony.type,
        current: currentAnalysis.harmony.type,
        diff: harmonyScoreDiff,
        text: `Harmony: ${previousAnalysis.harmony.type} → ${currentAnalysis.harmony.type} (${this._formatDiff(harmonyScoreDiff)})`,
        sentiment: harmonyScoreDiff > 0 ? 'positive' : harmonyScoreDiff < 0 ? 'negative' : 'neutral',
      });
    }

    // Mood change
    if (currentAnalysis.mood.mood !== previousAnalysis.mood?.mood) {
      details.push({
        category: 'Mood',
        icon: '😊',
        previous: previousAnalysis.mood?.mood || 'Unknown',
        current: currentAnalysis.mood.mood,
        diff: null,
        text: `Mood: ${previousAnalysis.mood?.mood || 'Unknown'} → ${currentAnalysis.mood.emoji} ${currentAnalysis.mood.mood}`,
        sentiment: 'neutral',
      });
    }

    // Per-category score breakdown comparison
    if (currentAnalysis.score.breakdown && previousAnalysis.score?.breakdown) {
      this._compareBreakdowns(currentAnalysis.score.breakdown, previousAnalysis.score.breakdown, details);
    }

    // ── Grade change ──
    const gradeChanged = currentAnalysis.grade?.letter !== previousAnalysis.grade?.letter;
    if (gradeChanged && currentAnalysis.grade && previousAnalysis.grade) {
      details.push({
        category: 'Grade',
        icon: scoreDiff > 0 ? '🏆' : '📋',
        previous: previousAnalysis.grade.letter,
        current: currentAnalysis.grade.letter,
        diff: scoreDiff,
        text: `Grade: ${previousAnalysis.grade.letter} → ${currentAnalysis.grade.letter}`,
        sentiment: scoreDiff > 0 ? 'positive' : scoreDiff < 0 ? 'negative' : 'neutral',
      });
    }

    // ── Summary message ──
    const message = this._generateComparisonMessage(scoreDiff, confidenceDiff, details);

    // ── Trend analysis ──
    const trend = this._analyzeTrend(history, currentAnalysis);

    // ── Personal best check ──
    const personalBest = this._getPersonalBest();
    const isNewBest = personalBest
      ? currentAnalysis.score.total > personalBest.score.total
      : true;

    return {
      hasPrevious: true,
      isFirstAnalysis: false,
      previous: previousAnalysis,
      scoreDiff,
      confidenceDiff,
      harmonyScoreDiff,
      isImprovement: scoreDiff > 0,
      isNewPersonalBest: isNewBest,
      message,
      details,
      trend,
      personalBest,
      timeSinceLast: previousAnalysis.timestamp
        ? this.formatTimestamp(previousAnalysis.timestamp)
        : null,
    };
  },

  /**
   * Compare per-category breakdowns between current and previous.
   */
  _compareBreakdowns(currentBreakdown, previousBreakdown, details) {
    // Build lookup by category name for previous
    const prevMap = new Map();
    previousBreakdown.forEach(item => {
      prevMap.set(item.category, item);
    });

    currentBreakdown.forEach(item => {
      const prev = prevMap.get(item.category);
      if (!prev) return;

      const diff = item.points - prev.points;
      if (Math.abs(diff) >= 2) { // Only show meaningful changes
        details.push({
          category: item.category,
          icon: diff > 0 ? '✅' : '❌',
          previous: `${prev.points}/${prev.max}`,
          current: `${item.points}/${item.max}`,
          diff,
          text: `${item.category}: ${prev.points} → ${item.points}/${item.max} (${this._formatDiff(diff)})`,
          sentiment: diff > 0 ? 'positive' : 'negative',
        });
      }
    });
  },

  /**
   * Generate a contextual comparison message.
   */
  _generateComparisonMessage(scoreDiff, confidenceDiff, details) {
    const positiveCount = details.filter(d => d.sentiment === 'positive').length;
    const negativeCount = details.filter(d => d.sentiment === 'negative').length;

    if (scoreDiff > 15) {
      return '🚀 Massive improvement! This outfit is dramatically better than your last one!';
    }
    if (scoreDiff > 8) {
      return '🎉 Great job! This outfit is significantly better than your previous one!';
    }
    if (scoreDiff > 0) {
      return '✅ Slight improvement — you\'re heading in the right direction.';
    }
    if (scoreDiff === 0) {
      if (positiveCount > negativeCount) {
        return '⚖️ Same overall score, but some categories improved. Nice adjustments!';
      }
      return '⚖️ This outfit scores the same as your previous one.';
    }
    if (scoreDiff > -5) {
      return '⚠️ Slightly weaker than your last outfit, but close. Small tweaks could help.';
    }
    if (scoreDiff > -15) {
      return '📉 Your previous outfit scored higher. Check the breakdown to see what changed.';
    }
    return '📉 Significant score drop compared to your previous outfit. Review the category changes below.';
  },

  // ────────────────────────────────────────────
  //  TREND ANALYSIS
  // ────────────────────────────────────────────

  /**
   * Analyze scoring trends over recent history.
   * @param {Array} history
   * @param {Object} currentAnalysis
   * @returns {Object}
   */
  _analyzeTrend(history, currentAnalysis) {
    // Need at least 3 data points (including current) for a trend
    if (history.length < 2) {
      return {
        direction: 'insufficient',
        message: 'Need more outfits to detect a trend.',
        recentScores: [currentAnalysis.score.total],
        averageScore: currentAnalysis.score.total,
        streak: 0,
      };
    }

    // Last N scores (newest last) + current
    const recentHistory = history.slice(-9); // Up to last 9 + current
    const scores = recentHistory.map(h => h.score?.total || 0);
    scores.push(currentAnalysis.score.total);

    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    // Calculate streak (consecutive improvements or declines)
    let streak = 0;
    for (let i = scores.length - 1; i >= 1; i--) {
      const diff = scores[i] - scores[i - 1];
      if (i === scores.length - 1) {
        streak = diff > 0 ? 1 : diff < 0 ? -1 : 0;
      } else {
        if (diff > 0 && streak > 0) streak++;
        else if (diff < 0 && streak < 0) streak--;
        else break;
      }
    }

    // Trend direction from linear regression (simplified)
    let direction = 'stable';
    let message = '';

    if (scores.length >= 3) {
      const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
      const secondHalf = scores.slice(Math.floor(scores.length / 2));
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      const trendDiff = secondAvg - firstAvg;

      if (trendDiff > 5) {
        direction = 'improving';
        message = `📈 Your style is trending upward! Average improved by +${Math.round(trendDiff)} points.`;
      } else if (trendDiff < -5) {
        direction = 'declining';
        message = `📉 Scores trending downward. Your earlier outfits averaged ${Math.round(Math.abs(trendDiff))} points higher.`;
      } else {
        direction = 'stable';
        message = `➡️ Consistent scoring around ${avgScore}/100. Try experimenting with new color combinations.`;
      }
    }

    // Streak messages
    if (streak >= 3) {
      message += ` 🔥 ${streak}-outfit improvement streak!`;
    } else if (streak <= -3) {
      message += ` Consider revisiting your highest-scoring outfit for inspiration.`;
    }

    return {
      direction,
      message,
      recentScores: scores,
      averageScore: avgScore,
      streak,
      totalAnalyses: history.length + 1,
    };
  },

  // ────────────────────────────────────────────
  //  PERSONAL BEST
  // ────────────────────────────────────────────

  /**
   * Update personal best if current score is higher.
   */
  _updatePersonalBest(entry) {
    try {
      const current = this._getPersonalBest();
      if (!current || entry.score.total > current.score.total) {
        localStorage.setItem(this.BEST_KEY, JSON.stringify(entry));
      }
    } catch (error) {
      console.warn('Failed to update personal best:', error);
    }
  },

  /**
   * Get personal best outfit.
   * @returns {Object|null}
   */
  _getPersonalBest() {
    try {
      const data = localStorage.getItem(this.BEST_KEY);
      if (!data) return null;
      const parsed = JSON.parse(data);
      return this._validateStoredEntry(parsed) ? parsed : null;
    } catch {
      return null;
    }
  },

  /**
   * Get personal best (public API).
   */
  getPersonalBest() {
    return this._getPersonalBest();
  },

  // ────────────────────────────────────────────
  //  STATISTICS
  // ────────────────────────────────────────────

  /**
   * Get aggregate statistics across all history.
   * @returns {Object}
   */
  getStatistics() {
    const history = this._loadHistory();

    if (history.length === 0) {
      return {
        totalOutfits: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        averageConfidence: 0,
        mostCommonHarmony: null,
        mostCommonMood: null,
        scoreDistribution: {},
        improvementRate: 0,
      };
    }

    const scores = history.map(h => h.score?.total || 0);
    const confidences = history.map(h => h.confidence || 0);
    const harmonies = history.map(h => h.harmony?.type).filter(Boolean);
    const moods = history.map(h => h.mood?.mood).filter(Boolean);

    // Count improvements
    let improvements = 0;
    for (let i = 1; i < scores.length; i++) {
      if (scores[i] > scores[i - 1]) improvements++;
    }

    // Score distribution buckets
    const distribution = { 'S (95+)': 0, 'A (85-94)': 0, 'B (75-84)': 0, 'C (65-74)': 0, 'D (50-64)': 0, 'F (<50)': 0 };
    scores.forEach(s => {
      if (s >= 95) distribution['S (95+)']++;
      else if (s >= 85) distribution['A (85-94)']++;
      else if (s >= 75) distribution['B (75-84)']++;
      else if (s >= 65) distribution['C (65-74)']++;
      else if (s >= 50) distribution['D (50-64)']++;
      else distribution['F (<50)']++;
    });

    return {
      totalOutfits: history.length,
      averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      highestScore: Math.max(...scores),
      lowestScore: Math.min(...scores),
      averageConfidence: Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length),
      mostCommonHarmony: this._mostFrequent(harmonies),
      mostCommonMood: this._mostFrequent(moods),
      scoreDistribution: distribution,
      improvementRate: scores.length > 1
        ? Math.round((improvements / (scores.length - 1)) * 100)
        : 0,
      firstAnalysis: history[0]?.timestamp || null,
      lastAnalysis: history[history.length - 1]?.timestamp || null,
    };
  },

  // ────────────────────────────────────────────
  //  EXPORT / IMPORT
  // ────────────────────────────────────────────

  /**
   * Export all data as a JSON string.
   * @returns {string}
   */
  exportData() {
    const history = this._loadHistory();
    const best = this._getPersonalBest();

    return JSON.stringify({
      version: this.CURRENT_VERSION,
      exportedAt: new Date().toISOString(),
      history,
      personalBest: best,
    }, null, 2);
  },

  /**
   * Import data from a JSON string.
   * Merges with existing history (deduplicates by id).
   * @param {string} jsonString
   * @returns {{ success: boolean, imported: number, message: string }}
   */
  importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);

      if (!data || !Array.isArray(data.history)) {
        return { success: false, imported: 0, message: 'Invalid data format.' };
      }

      const existing = this._loadHistory();
      const existingIds = new Set(existing.map(e => e.id));

      // Merge — only add entries we don't already have
      let importedCount = 0;
      data.history.forEach(entry => {
        if (this._validateStoredEntry(entry) && !existingIds.has(entry.id)) {
          existing.push(entry);
          importedCount++;
        }
      });

      // Sort by timestamp
      existing.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // Trim
      if (existing.length > this.MAX_HISTORY) {
        existing.splice(0, existing.length - this.MAX_HISTORY);
      }

      this._saveHistory(existing);

      // Update personal best
      if (data.personalBest && this._validateStoredEntry(data.personalBest)) {
        const currentBest = this._getPersonalBest();
        if (!currentBest || data.personalBest.score.total > currentBest.score.total) {
          localStorage.setItem(this.BEST_KEY, JSON.stringify(data.personalBest));
        }
      }

      return {
        success: true,
        imported: importedCount,
        message: `Successfully imported ${importedCount} outfit${importedCount !== 1 ? 's' : ''}.`
      };
    } catch (error) {
      return { success: false, imported: 0, message: 'Failed to parse import data: ' + error.message };
    }
  },

  // ────────────────────────────────────────────
  //  CLEAR
  // ────────────────────────────────────────────

  /**
   * Clear all history.
   * @returns {boolean}
   */
  clearHistory() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(this.BEST_KEY);
      return true;
    } catch (error) {
      console.error('Failed to clear history:', error);
      return false;
    }
  },

  /**
   * Delete a specific entry by id.
   * @param {string} id
   * @returns {boolean}
   */
  deleteEntry(id) {
    try {
      const history = this._loadHistory();
      const filtered = history.filter(h => h.id !== id);

      if (filtered.length === history.length) return false; // Not found

      this._saveHistory(filtered);

      // Recalculate personal best if we deleted it
      const best = this._getPersonalBest();
      if (best && best.id === id) {
        this._recalculatePersonalBest();
      }

      return true;
    } catch (error) {
      console.error('Failed to delete entry:', error);
      return false;
    }
  },

  // ────────────────────────────────────────────
  //  TIMESTAMP FORMATTING
  // ────────────────────────────────────────────

  /**
   * Format a timestamp for human-readable display.
   * @param {string} isoString
   * @returns {string}
   */
  formatTimestamp(isoString) {
    if (!isoString) return 'Unknown';

    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Invalid date';

    const now = new Date();
    const diffMs = now - date;

    // Future date guard
    if (diffMs < 0) return date.toLocaleDateString();

    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60)  return 'Just now';

    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60)  return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7)   return `${diffDays} days ago`;
    if (diffDays < 30)  return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) !== 1 ? 's' : ''} ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) !== 1 ? 's' : ''} ago`;

    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },

  // ────────────────────────────────────────────
  //  INTERNAL HELPERS
  // ────────────────────────────────────────────

  /** Load history array from localStorage */
  _loadHistory() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return [];

      const parsed = JSON.parse(raw);

      // Handle legacy format (single object instead of array)
      if (!Array.isArray(parsed)) {
        // Migrate v1 (single entry) to v2 (array)
        if (parsed && typeof parsed === 'object' && parsed.score) {
          const migrated = { ...parsed, version: this.CURRENT_VERSION, id: this._generateId() };
          this._saveHistory([migrated]);
          return [migrated];
        }
        return [];
      }

      // Validate entries
      return parsed.filter(entry => this._validateStoredEntry(entry));
    } catch (error) {
      console.error('Failed to load history:', error);
      return [];
    }
  },

  /** Save history array to localStorage */
  _saveHistory(history) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
  },

  /** Validate that an analysis object has required fields */
  _validateAnalysisData(data) {
    if (!data || typeof data !== 'object') return false;
    if (!data.score || typeof data.score.total !== 'number') return false;
    if (!data.harmony || !data.harmony.type) return false;
    if (typeof data.confidence !== 'number') return false;
    if (!data.mood || !data.mood.mood) return false;
    return true;
  },

  /** Validate a stored history entry */
  _validateStoredEntry(entry) {
    if (!entry || typeof entry !== 'object') return false;
    if (!entry.score || typeof entry.score.total !== 'number') return false;
    if (!entry.timestamp) return false;
    return true;
  },

  /** Serialize colors for storage (strip unnecessary data) */
  _serializeColors(colors) {
    if (!colors) return null;

    const result = {};
    ['top', 'bottom', 'shoes'].forEach(key => {
      if (colors[key]) {
        result[key] = {
          hex: colors[key].hex,
          name: colors[key].name,
          hsl: colors[key].hsl,
        };
      }
    });
    return result;
  },

  /** Generate a unique-ish ID */
  _generateId() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 8);
  },

  /** Format a numeric diff with +/- sign */
  _formatDiff(diff) {
    if (diff > 0) return `+${diff}`;
    return String(diff);
  },

  /** Find most frequent item in an array */
  _mostFrequent(arr) {
    if (!arr || arr.length === 0) return null;

    const counts = {};
    arr.forEach(item => {
      counts[item] = (counts[item] || 0) + 1;
    });

    let maxItem = null;
    let maxCount = 0;
    for (const [item, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        maxItem = item;
      }
    }
    return maxItem;
  },

  /** Check if error is a localStorage quota error */
  _isQuotaError(error) {
    return (
      error.name === 'QuotaExceededError' ||
      error.code === 22 ||
      error.code === 1014 ||
      error.message?.includes('quota')
    );
  },

  /** Remove oldest half of history to free space */
  _pruneHistory() {
    try {
      const history = this._loadHistory();
      const pruned = history.slice(Math.floor(history.length / 2));
      this._saveHistory(pruned);
    } catch {
      // Last resort: clear everything
      try { localStorage.removeItem(this.STORAGE_KEY); } catch { /* give up */ }
    }
  },

  /** Recalculate personal best from history */
  _recalculatePersonalBest() {
    const history = this._loadHistory();
    if (history.length === 0) {
      localStorage.removeItem(this.BEST_KEY);
      return;
    }

    let best = history[0];
    history.forEach(entry => {
      if (entry.score.total > best.score.total) {
        best = entry;
      }
    });

    localStorage.setItem(this.BEST_KEY, JSON.stringify(best));
  },
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Comparison;
}