# 🧠 Outfit Intelligence Tool

A production-ready, client-side web application that analyzes outfits using real color theory, providing professional styling feedback through advanced color harmony analysis, confidence scoring, and mood detection.

## ✨ Features

### 🎯 Core Functionality
- **Triple Input System**: Choose between manual color selection, live camera capture, or image upload
- **Multi-Garment Analysis**: Analyzes three separate clothing regions (Top, Bottom, Shoes)
- **Auto Zone Detection**: Automatically splits images into three vertical zones for garment detection
- **Manual Crop Override**: Drag to select specific regions and override auto-detection
- **Real Pixel Analysis**: Uses HTML5 Canvas API to extract actual RGB colors from images

### 🎨 Color Intelligence
- **Strict Color Harmony**: Detects monochromatic, analogous, complementary, triadic, and clashing color schemes
- **Professional Scoring**: Intentionally strict scoring engine (0-100) with detailed breakdown
- **Confidence Projection**: Psychological confidence score based on contrast, saturation, and balance
- **Mood Detection**: Categorizes outfits (Energetic, Calm, Minimal, Neutral, Playful) with emoji labels
- **Color Naming**: Human-readable color descriptions (e.g., "Dark Blue", "Vibrant Red")

### 📊 Advanced Features
- **Outfit Comparison**: Compares current analysis with previous outfit stored in localStorage
- **Score Breakdown**: Detailed point allocation showing how the score was calculated
- **Grade System**: Letter grades (A+ to F) with descriptions
- **Real-Time Preview**: Live video preview for camera capture mode
- **Responsive Design**: Works flawlessly on mobile phones and desktop PCs

### 🎨 UI/UX
- **Dark Theme**: Professional dark mode using Tailwind CSS
- **Smooth Animations**: Fade-ins, transitions, and hover effects
- **Guided Flow**: Step-by-step process with disabled states until ready
- **Color Previews**: Visual feedback showing detected colors with labels
- **Mobile-Optimized**: Touch-friendly controls and responsive layout

## 🚀 Quick Start

### Local Development
1. Clone the repository:
```bash
git clone https://github.com/vivekm221006/Outfit-intelligence-tool.git
cd Outfit-intelligence-tool
```

2. Open `index.html` in your browser:
```bash
# Using Python's built-in server
python3 -m http.server 8000

# Or using Node.js http-server
npx http-server -p 8000

# Or simply open the file
open index.html  # macOS
start index.html # Windows
xdg-open index.html # Linux
```

3. Navigate to `http://localhost:8000` in your browser

### Deployment

#### GitHub Pages
1. Push your code to GitHub
2. Go to Settings → Pages
3. Select your branch (e.g., `main`)
4. Your site will be live at `https://yourusername.github.io/Outfit-intelligence-tool/`

#### Netlify
1. Drag and drop the project folder to [Netlify Drop](https://app.netlify.com/drop)
2. Or connect your GitHub repository to Netlify for automatic deployments

#### Vercel
```bash
npm i -g vercel
vercel
```

## 📖 Usage Guide

### Method 1: Manual Color Selection
1. Click **"Manual Colors"** button
2. Use the three color pickers to select colors for Top, Bottom, and Shoes
3. Click **"Analyze Outfit"** when ready

### Method 2: Live Camera
1. Click **"Live Camera"** button
2. Click **"Start Camera"** and grant camera permissions
3. Position yourself or the outfit in frame
4. Click **"Capture Frame"** to freeze the image
5. The system auto-detects three garment zones
6. Optionally, use manual crop to refine selections
7. Click **"Analyze Outfit"**

### Method 3: Image Upload
1. Click **"Upload Image"** button
2. Choose an outfit photo from your device
3. The system auto-detects three garment zones
4. Optionally, use manual crop to refine selections
5. Click **"Analyze Outfit"**

### Manual Crop Override
After camera capture or image upload:
1. Click **"Select Top/Bottom/Shoes Region"**
2. Drag on the canvas to select the desired area
3. Release to confirm selection
4. The selected color overrides the auto-detected zone

## 🧪 How It Works

### Color Extraction
1. **Canvas API**: Images/video frames are drawn to an HTML5 canvas
2. **Pixel Sampling**: The `getImageData()` method reads actual RGB pixel values
3. **Averaging**: RGB values are averaged across the selected region (sampling every 4th pixel for performance)
4. **RGB to HSL**: Colors are converted to HSL (Hue, Saturation, Lightness) for analysis

### Color Harmony Analysis
- **Monochromatic**: Hue difference < 30° (similar colors, varied saturation)
- **Analogous**: Hue difference 30-60° (neighboring colors on wheel)
- **Complementary**: Hue difference 150-210° (opposite colors)
- **Triadic**: Three colors evenly spaced on color wheel
- **Clash Detection**: Awkward angles (60-150°) with high saturation

### Scoring Algorithm
The final score (0-100) is calculated from:
1. **Color Harmony (40%)**: Based on harmony type and quality
2. **Contrast Balance (20%)**: Ideal contrast is 30-50% lightness difference
3. **Color Intensity (20%)**: Saturation variance and balance
4. **Professional Style (20%)**: Penalties for common mistakes, bonuses for good design

### Confidence Score
Psychological confidence projection based on:
- Color contrast between garments (higher = more confident)
- Saturation strength (bold colors = confident)
- Visual balance (similar lightness = balanced confidence)
- Neutral vs. bold color choices

### Mood Detection
Categorizes outfit mood using:
- Hue analysis (warm vs. cool colors)
- Average saturation levels
- Contrast ratios
- Color diversity

## 🏗️ Architecture

### File Structure
```
Outfit-intelligence-tool/
├── index.html              # Main HTML structure
├── css/
│   └── style.css           # Custom CSS (supplements Tailwind)
├── js/
│   ├── app.js              # Main application logic & UI flow
│   ├── camera.js           # Camera access & video capture
│   ├── colorAnalysis.js    # Color extraction & harmony analysis
│   ├── scoring.js          # Confidence, mood, and outfit scoring
│   ├── comparison.js       # Outfit comparison & localStorage
│   ├── cropTool.js         # Manual crop selection
│   └── garmentDetection.js # Auto zone detection
└── README.md               # Documentation
```

### Technology Stack
- **HTML5**: Semantic structure
- **Tailwind CSS**: Utility-first styling
- **Vanilla JavaScript**: No frameworks or libraries
- **Canvas API**: Image processing and color extraction
- **MediaDevices API**: Camera access
- **localStorage API**: Outfit comparison history

### Browser Compatibility
- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

**Requirements**:
- Camera access for live capture feature
- localStorage for comparison feature
- JavaScript enabled

## 🎯 Use Cases

1. **Morning Outfit Selection**: Quickly analyze outfit combinations before leaving
2. **Shopping Decisions**: Upload photos of potential purchases to see how they match
3. **Wardrobe Planning**: Compare different outfit combinations systematically
4. **Fashion Learning**: Understand color theory through real-time feedback
5. **Professional Styling**: Get objective feedback on color harmony and mood

## 🔒 Privacy & Security

- **100% Client-Side**: All processing happens in your browser
- **No Data Collection**: No images or data are sent to any server
- **No Tracking**: No analytics or third-party scripts
- **localStorage Only**: Only stores your last outfit analysis locally
- **Camera Privacy**: Camera access only when explicitly requested

## 🛠️ Customization

### Adjusting Scoring Strictness
Edit `js/scoring.js`:
```javascript
// Make scoring more lenient
const harmonyScore = harmonyResult.score * 0.5; // Increase weight
```

### Changing Zone Detection
Edit `js/garmentDetection.js`:
```javascript
// Adjust vertical split ratios
height: Math.floor(height * 0.4), // Change from 0.33
```

### Custom Color Harmony Rules
Edit `js/colorAnalysis.js`:
```javascript
// Add new harmony type
if (maxDiff >= 120 && maxDiff <= 140) {
  return { type: 'Split-Complementary', score: 85, ... };
}
```

## 🤝 Contributing

Contributions are welcome! To contribute:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Built with real color theory principles
- Inspired by professional styling consultations
- No AI/ML required - pure algorithmic analysis

## 📧 Support

For issues, questions, or feedback:
- Open an issue on GitHub
- Contributions and suggestions are welcome!

---

**Built with ❤️ using vanilla JavaScript and real color theory**