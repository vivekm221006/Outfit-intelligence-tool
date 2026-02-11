// Comparison Module
// Handles outfit comparison logic using localStorage

const Comparison = {
  STORAGE_KEY: 'outfit-intelligence-last-analysis',

  // Save current analysis result
  saveAnalysis(analysisData) {
    try {
      const dataToSave = {
        timestamp: new Date().toISOString(),
        colors: analysisData.colors,
        score: analysisData.score,
        harmony: analysisData.harmony,
        confidence: analysisData.confidence,
        mood: analysisData.mood
      };
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(dataToSave));
      return true;
    } catch (error) {
      console.error('Failed to save analysis:', error);
      return false;
    }
  },

  // Load last analysis result
  loadLastAnalysis() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error('Failed to load last analysis:', error);
      return null;
    }
  },

  // Compare current outfit with previous one
  compareOutfits(currentAnalysis) {
    const previousAnalysis = this.loadLastAnalysis();
    
    if (!previousAnalysis) {
      return {
        hasPrevious: false,
        message: 'This is your first outfit analysis. Future analyses will be compared to this one.'
      };
    }
    
    const scoreDiff = currentAnalysis.score.total - previousAnalysis.score.total;
    const confidenceDiff = currentAnalysis.confidence - previousAnalysis.confidence;
    
    let comparison = {
      hasPrevious: true,
      previous: previousAnalysis,
      scoreDiff: scoreDiff,
      confidenceDiff: confidenceDiff,
      isImprovement: scoreDiff > 0,
      message: '',
      details: []
    };
    
    // Generate comparison message
    if (scoreDiff > 10) {
      comparison.message = '🎉 This outfit is significantly better than your previous one!';
    } else if (scoreDiff > 0) {
      comparison.message = '✅ This outfit is slightly better than your previous one.';
    } else if (scoreDiff === 0) {
      comparison.message = '⚖️ This outfit scores the same as your previous one.';
    } else if (scoreDiff > -10) {
      comparison.message = '⚠️ This outfit is slightly weaker than your previous one.';
    } else {
      comparison.message = '📉 Your previous outfit scored notably higher.';
    }
    
    // Add detailed comparisons
    if (Math.abs(scoreDiff) > 0) {
      comparison.details.push(
        `Score: ${currentAnalysis.score.total}/100 (${scoreDiff > 0 ? '+' : ''}${scoreDiff})`
      );
    }
    
    if (Math.abs(confidenceDiff) > 5) {
      comparison.details.push(
        `Confidence: ${currentAnalysis.confidence}/100 (${confidenceDiff > 0 ? '+' : ''}${confidenceDiff})`
      );
    }
    
    if (currentAnalysis.harmony.type !== previousAnalysis.harmony.type) {
      comparison.details.push(
        `Harmony changed: ${previousAnalysis.harmony.type} → ${currentAnalysis.harmony.type}`
      );
    }
    
    if (currentAnalysis.mood.mood !== previousAnalysis.mood.mood) {
      comparison.details.push(
        `Mood shifted: ${previousAnalysis.mood.mood} → ${currentAnalysis.mood.mood}`
      );
    }
    
    return comparison;
  },

  // Clear stored analysis
  clearHistory() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      return true;
    } catch (error) {
      console.error('Failed to clear history:', error);
      return false;
    }
  },

  // Format timestamp for display
  formatTimestamp(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Comparison;
}
