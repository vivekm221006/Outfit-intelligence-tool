// Garment Detection Module
// Handles automatic garment zone detection from images

const GarmentDetection = {
  // Auto-detect three garment zones (top, bottom, shoes)
  detectZones(canvas) {
    const height = canvas.height;
    const width = canvas.width;
    
    // Divide image into three vertical zones
    const zones = {
      top: {
        x: 0,
        y: 0,
        width: width,
        height: Math.floor(height * 0.33),
        label: 'Top'
      },
      bottom: {
        x: 0,
        y: Math.floor(height * 0.33),
        width: width,
        height: Math.floor(height * 0.33),
        label: 'Bottom'
      },
      shoes: {
        x: 0,
        y: Math.floor(height * 0.66),
        width: width,
        height: height - Math.floor(height * 0.66),
        label: 'Shoes'
      }
    };
    
    return zones;
  },

  // Draw zones on canvas with labels
  drawZones(canvas, zones) {
    const ctx = canvas.getContext('2d');
    
    // Draw semi-transparent overlays
    const colors = {
      top: 'rgba(239, 68, 68, 0.2)',      // Red
      bottom: 'rgba(59, 130, 246, 0.2)',  // Blue
      shoes: 'rgba(34, 197, 94, 0.2)'     // Green
    };
    
    const borderColors = {
      top: 'rgba(239, 68, 68, 0.8)',
      bottom: 'rgba(59, 130, 246, 0.8)',
      shoes: 'rgba(34, 197, 94, 0.8)'
    };
    
    Object.keys(zones).forEach(key => {
      const zone = zones[key];
      
      // Draw filled rectangle
      ctx.fillStyle = colors[key];
      ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
      
      // Draw border
      ctx.strokeStyle = borderColors[key];
      ctx.lineWidth = 3;
      ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
      
      // Draw label
      ctx.fillStyle = 'white';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'black';
      ctx.shadowBlur = 4;
      ctx.fillText(zone.label, zone.x + zone.width / 2, zone.y + zone.height / 2);
      ctx.shadowBlur = 0;
    });
  },

  // Extract colors from detected zones
  extractZoneColors(canvas, zones) {
    const colors = {};
    
    Object.keys(zones).forEach(key => {
      const zone = zones[key];
      const rgb = ColorAnalysis.extractAverageColor(
        canvas,
        zone.x,
        zone.y,
        zone.width,
        zone.height
      );
      
      colors[key] = {
        rgb: rgb,
        hsl: ColorAnalysis.rgbToHsl(rgb.r, rgb.g, rgb.b),
        hex: ColorAnalysis.rgbToHex(rgb.r, rgb.g, rgb.b),
        name: ColorAnalysis.getColorDescription({
          hsl: ColorAnalysis.rgbToHsl(rgb.r, rgb.g, rgb.b)
        })
      };
    });
    
    return colors;
  },

  // Clear zone overlays
  clearZones(canvas, originalImageData) {
    const ctx = canvas.getContext('2d');
    if (originalImageData) {
      ctx.putImageData(originalImageData, 0, 0);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GarmentDetection;
}
