# 🧠 Outfit Intelligence Tool

A production-ready, client-side web application that analyzes outfits using **real color theory**, providing professional styling feedback through advanced color harmony analysis, confidence scoring, mood detection, trend tracking, and actionable styling suggestions.

> **100% client-side** · No server required · No data collection · Works offline

![Version](https://img.shields.io/badge/version-2.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![JavaScript](https://img.shields.io/badge/vanilla-JavaScript-yellow)

---

## ✨ Features

### 🎯 Core Functionality

- **Triple Input System** — Manual color pickers, live camera capture, or image upload
- **Multi-Garment Analysis** — Analyzes three clothing regions (Top, Bottom, Shoes)
- **Smart Zone Detection** — Body-column detection with center-weighted sampling
- **Manual Crop Override** — Drag-to-select with resize handles, visual feedback, and size indicator
- **Real Pixel Analysis** — Trimmed-mean color extraction with outlier rejection

### 🎨 Color Intelligence

- **13 Harmony Types** — Monochromatic, Analogous, Complementary, Split-Complementary, Triadic, Achromatic, Neutral-Anchored Pop, Warm/Cool Harmony, Color Clash, and more
- **Neutral-Aware Analysis** — Black, white, gray, navy, khaki, olive, and brown are recognized as fashion neutrals and excluded from hue-wheel comparison
- **Skin Pixel Rejection** — Automatically filters out skin-tone pixels from garment color extraction
- **WCAG Contrast Ratios** — Proper relative-luminance-based contrast measurement between garment pairs
- **Temperature Coherence** — Detects warm/cool mixing and scores temperature consistency
- **Pattern Detection** — Identifies multi-color zones (stripes, plaid, prints) via dominant-color bucketing
- **40+ Color Names** — Fashion-aware descriptions (Navy, Burgundy, Coral, Olive, Teal, Sage, Mauve, etc.)
- **Actionable Suggestions** — Specific styling tips generated from detected issues

### 📊 Scoring Engine

- **6-Category Breakdown** — Color Harmony (30), Contrast Balance (18), Color Intensity (15), Warm/Cool Coherence (12), Neutral Anchoring (10), Professional Polish (15)
- **Bell-Curve Scoring** — Smooth, natural falloff instead of hard thresholds
- **11 Mood Categories** — Energetic/Bold, Calm/Professional, Minimal/Elegant, Dark/Edgy, Romantic/Soft, Earthy/Natural, Playful/Creative, Fresh/Sporty, Monochrome Minimal, Neutral/Classic, Balanced
- **S-to-F Grades** — 11-tier grading with S-tier for runway-ready outfits (95+)
- **Confidence Projection** — 6-factor psychological confidence model (contrast, saturation, balance, neutral anchoring, intentionality, darkness)

### 📈 History & Trends

- **Full Outfit History** — Stores up to 50 analyses with unique IDs
- **Trend Analysis** — Tracks improvement direction, streaks, and average score over time
- **Personal Bests** — Automatically tracks and celebrates new high scores
- **Rich Comparisons** — Per-category diffs with sentiment color coding (positive/negative/neutral)
- **Statistics Dashboard** — Total outfits, averages, grade distribution, most common harmony/mood
- **Export / Import** — JSON export of all history, merge-import with deduplication
- **Legacy Migration** — Automatically upgrades v1 single-entry storage to v2 array format

### 📷 Camera System

- **Progressive Fallback** — Tries 1080p → 720p → 480p → any camera
- **Permission Timeout** — 15-second timeout with clear error messages
- **High-Res Capture** — Uses ImageCapture API for stills above video resolution
- **Front Camera Mirroring** — Selfie view is CSS-mirrored; capture matches what you see
- **Torch / Flash** — Detects and controls device flashlight
- **Zoom Control** — Reads zoom range and applies zoom level
- **Tab Visibility** — Pauses camera when tab is hidden, resumes when visible
- **Auto-Cleanup** — Stops camera on page unload

### ✂️ Crop Tool

- **Scaled Coordinates** — Pixel-accurate even when canvas is CSS-responsive
- **Dimmed Overlay** — Area outside selection is darkened for focus
- **Dashed Animated Border** — Yellow while dragging, indigo when finalized
- **Corner Resize Handles** — NW/NE/SW/SE handles with appropriate cursors
- **Size Label** — Shows `width × height` in a floating pill below selection
- **Clean Destruction** — Removes only its own listeners, never clones the canvas

### 🎨 UI / UX

- **Glassmorphism Dark Theme** — Deep navy surfaces with indigo-tinted borders and glow effects
- **Animated Background** — Floating indigo/purple/cyan orbs with drift animations
- **Rainbow Edge Lines** — Animated gradient lines on card top edges, header, and footer
- **Button Glow Effects** — Color-matched glow halos on hover for every action button
- **Shimmer Sweep** — Light sweep animation on primary CTA and mode buttons
- **Animated Score Counter** — Numbers count up from 0 with ease-out cubic easing
- **Staggered Fade-In** — Sections and score rows animate in with cascading delays
- **Toast Notifications** — Slide-in/out toasts for info, success, warning, and error states
- **Keyboard Shortcuts** — `Enter` to analyze, `Escape` to cancel crop, `Ctrl+Z` to undo
- **Drag & Drop Upload** — Drop images directly on the upload zone
- **Responsive Design** — Works on mobile phones, tablets, and desktop
- **Reduced Motion** — Respects `prefers-reduced-motion` for accessibility

---

## 🚀 Quick Start

### Local Development

1. **Clone the repository:**

```bash
git clone https://github.com/vivekm221006/Outfit-intelligence-tool.git
cd Outfit-intelligence-tool
```

2. **Serve locally** (required for camera access — HTTPS or localhost):

```bash
# Python
python3 -m http.server 8000

# Node.js
npx http-server -p 8000

# Or open directly (camera may not work without HTTPS)
open index.html
```

3. **Navigate to** `http://localhost:8000`

### Deployment

#### GitHub Pages

1. Push to GitHub
2. Go to **Settings → Pages**
3. Select branch (e.g., `main`)
4. Live at `https://vivekm221006.github.io/Outfit-intelligence-tool/`

#### Netlify

Drag & drop at [app.netlify.com/drop](https://app.netlify.com/drop) or connect your repo.

#### Vercel

```bash
npx vercel
```

---

## 📖 Usage Guide

### Method 1: Manual Color Selection

1. Click **"Manual Colors"**
2. Use the three color pickers (live preview while dragging)
3. Click **"Analyze Outfit"**

### Method 2: Live Camera

1. Click **"Live Camera"**
2. Click **"Start Camera"** → grant permissions
3. Position outfit in frame → click **"Capture Frame"**
4. Auto-detection runs with smart body-column detection
5. Review confidence levels — low-confidence zones trigger a warning
6. Optionally crop specific regions
7. Click **"Analyze Outfit"**

### Method 3: Image Upload

1. Click **"Upload Image"**
2. Click to browse or **drag & drop** an image
3. Supports JPG, PNG, WebP (max 15MB, auto-downscaled to 1920px)
4. Auto-detection runs → review → analyze

### Manual Crop Override

1. Click **"Select Top/Bottom/Shoes Region"**
2. Drag to select — see the dimmed overlay and size indicator
3. Resize using corner handles if needed
4. Release to confirm — color updates immediately
5. Press **Escape** to cancel

### Keyboard Shortcuts

| Key            | Action                      |
| -------------- | --------------------------- |
| `Enter`        | Analyze outfit (when ready) |
| `Escape`       | Cancel active crop          |
| `Ctrl/Cmd + Z` | Undo last analysis          |

---

## 🧪 How It Works

### Color Extraction Pipeline

```
Image/Video Frame
       ↓
Canvas getImageData()
       ↓
Pixel Sampling (every 4th pixel)
       ↓
Transparent Pixel Skip (alpha < 128)
       ↓
Skin Color Rejection (HSL range filtering)
       ↓
Trimmed Mean (discard top/bottom 10% outliers)
       ↓
Dominant Color Bucketing (top 3 colors)
       ↓
RGB → HSL Conversion
       ↓
Fashion-Aware Color Naming (40+ names)
```

### Smart Zone Detection

```
Full Image
       ↓
Proportional Split (8-42% top, 42-78% bottom, 78-97% shoes)
       ↓
Body Column Detection (horizontal edge density analysis)
       ↓
Center-Weighted Sampling (skip 20% on each side)
       ↓
Vertical Inset (skip 10% top/bottom within each zone)
       ↓
Skin Pixel Rejection
       ↓
Confidence Scoring (survival rate × color consistency × sample size)
```

### Harmony Analysis (Neutral-Aware)

```
Input Colors
       ↓
Separate Neutrals from Chromatics
       ↓
  ├── All Neutral → Achromatic / Achromatic Contrast
  ├── 1 Chromatic + Neutrals → Neutral-Anchored Pop / Neutral-Anchored
  └── 2+ Chromatics → Hue-Wheel Analysis:
         ├── < 25° → Monochromatic / Monochromatic Flat
         ├── 25-60° → Analogous
         ├── 130-170° → Split-Complementary
         ├── 150-180° → Complementary / Complementary Bold
         ├── 3 colors ~120° apart → Triadic
         ├── 60-130° + high saturation → Color Clash / Tension (Neutral-Rescued)
         ├── Same temperature family → Warm Harmony / Cool Harmony
         └── Default → Mixed
```

### Scoring Algorithm (6 Categories, 100 Points)

| Category               | Points | Method                                                                              |
| ---------------------- | ------ | ----------------------------------------------------------------------------------- |
| 🎨 Color Harmony       | /30    | Harmony type score × 0.30                                                           |
| 🔲 Contrast Balance    | /18    | Bell curve centered at 38% lightness diff                                           |
| 💡 Color Intensity     | /15    | Bell curve on saturation variance + average                                         |
| 🌡️ Warm/Cool Coherence | /12    | Temperature dominance ratio                                                         |
| ⚓ Neutral Anchoring   | /10    | 1 neutral + chromatics = max score                                                  |
| 👔 Professional Polish | /15    | Penalties (clash, temp mix, extreme lightness) + bonuses (analogous, complementary) |

### Confidence Model (6 Factors)

| Factor         | Weight | What it measures                                |
| -------------- | ------ | ----------------------------------------------- |
| Contrast       | 25%    | Lightness difference (bell curve at 40)         |
| Saturation     | 20%    | Average saturation (bell curve at 55)           |
| Visual Balance | 15%    | Lightness standard deviation (bell curve at 15) |
| Neutral Anchor | 15%    | 1 neutral among chromatics = best               |
| Intentionality | 15%    | Warm/cool coherence within chromatics           |
| Darkness       | 10%    | Dark palettes project inherent confidence       |

### Grade Scale

| Score | Grade | Description                              |
| ----- | ----- | ---------------------------------------- |
| 95+   | S     | Perfection! 💎 Runway-ready              |
| 90-94 | A+    | Outstanding! A masterclass in color      |
| 85-89 | A     | Excellent — polished and intentional     |
| 80-84 | B+    | Very Good — minor tweaks away from great |
| 75-79 | B     | Good — solid color choices               |
| 70-74 | C+    | Above Average — room to improve          |
| 65-69 | C     | Average — safe but unremarkable          |
| 58-64 | D+    | Below Average — some clashing            |
| 50-57 | D     | Weak — needs rethinking                  |
| 40-49 | E     | Poor — significant color issues          |
| < 40  | F     | Fail — complete color mismatch           |

---

## 🏗️ Architecture

### File Structure

```
Outfit-intelligence-tool/
├── index.html                # Main HTML structure
├── css/
│   └── style.css             # Glassmorphism dark theme with utilities
├── js/
│   ├── app.js                # Main orchestrator — UI flow, toasts, animations
│   ├── camera.js             # Camera access, ImageCapture, torch, zoom
│   ├── colorAnalysis.js      # Color extraction, harmony, temperature, suggestions
│   ├── scoring.js            # Confidence, mood, outfit scoring, grades
│   ├── comparison.js         # History, trends, personal bests, export/import
│   ├── cropTool.js           # Drag-to-crop with handles and visual feedback
│   └── garmentDetection.js   # Smart zone detection, body column, skin rejection
└── README.md                 # This file
```

### Module Dependency Graph

```
app.js (orchestrator)
  ├── camera.js         (independent)
  ├── cropTool.js       → colorAnalysis.js
  ├── garmentDetection.js → colorAnalysis.js
  ├── colorAnalysis.js  (independent)
  ├── scoring.js        (independent)
  └── comparison.js     (independent)
```

### Technology Stack

| Layer            | Technology                                               |
| ---------------- | -------------------------------------------------------- |
| Structure        | HTML5 (semantic)                                         |
| Styling          | Custom CSS (Tailwind-inspired utilities + glassmorphism) |
| Logic            | Vanilla JavaScript ES6+ (no frameworks)                  |
| Image Processing | Canvas API (`getImageData`, `putImageData`)              |
| Camera           | MediaDevices API + ImageCapture API                      |
| Storage          | localStorage (up to 50 outfit history)                   |
| Fonts            | Google Fonts (Inter)                                     |

### Browser Compatibility

| Browser       | Minimum Version | Notes                                  |
| ------------- | --------------- | -------------------------------------- |
| Chrome / Edge | 99+             | Full support including ImageCapture    |
| Firefox       | 112+            | ImageCapture fallback to frame capture |
| Safari        | 16+             | `roundRect` support required           |
| iOS Safari    | 16+             | Camera requires HTTPS                  |
| Chrome Mobile | 99+             | Full support                           |

**Requirements:**

- **HTTPS or localhost** for camera access
- **JavaScript enabled**
- **localStorage** for history (gracefully handles quota exceeded)

---

## 🎯 Use Cases

| Scenario                    | How to use                                                |
| --------------------------- | --------------------------------------------------------- |
| 🌅 **Morning outfit check** | Camera mode → quick capture → instant feedback            |
| 🛍️ **Shopping decisions**   | Upload photos of potential purchases → compare scores     |
| 👔 **Interview prep**       | Aim for "Calm/Professional" mood + B+ or higher grade     |
| 🎨 **Learn color theory**   | Experiment with manual pickers → see harmony types change |
| 📈 **Track improvement**    | Analyze outfits daily → watch your trend line rise        |
| 🏆 **Beat your best**       | Chase your personal best score → get the S-tier grade     |

---

## 🔒 Privacy & Security

- ✅ **100% Client-Side** — all processing in your browser
- ✅ **No Server Calls** — zero network requests for analysis
- ✅ **No Tracking** — no analytics, cookies, or third-party scripts
- ✅ **No Image Storage** — images are never saved or transmitted
- ✅ **Camera On-Demand** — only activated when you click "Start Camera"
- ✅ **Auto-Cleanup** — camera stops on tab close or page navigation
- ✅ **Local Storage Only** — outfit history stored locally, exportable as JSON
- ✅ **Data Portability** — export all your data anytime, import on another device

---

## 🛠️ Customization

### Adjust Zone Proportions

```javascript
// In garmentDetection.js → _config.zones
top:    { yStart: 0.08, yEnd: 0.42 },  // Torso region
bottom: { yStart: 0.42, yEnd: 0.78 },  // Legs region
shoes:  { yStart: 0.78, yEnd: 0.97 },  // Feet region

// Or use dynamic proportions:
GarmentDetection.detectZonesWithProportions(canvas, {
  topStart: 0.05, topEnd: 0.45, bottomEnd: 0.80, shoesEnd: 0.98
});
```

### Add Custom Harmony Rules

```javascript
// In colorAnalysis.js → analyzeHarmony()
// Add after split-complementary check:
if (chromatics.length === 4 && differences.every((d) => d >= 80 && d <= 100)) {
  return {
    type: "Tetradic",
    score: 78,
    explanation: "Four colors forming a rectangle on the color wheel.",
    details: { differences },
  };
}
```

### Customize Mood Categories

```javascript
// In scoring.js → detectMood()
// Add before the default return:
if (avgLight > 80 && avgSat < 15) {
  return {
    mood: "Ethereal / Angelic",
    emoji: "👼",
    explanation:
      "Very light, desaturated palette creates an ethereal, dreamlike quality.",
  };
}
```

### Adjust Skin Rejection Ranges

```javascript
// In garmentDetection.js → _config.skinRanges
skinRanges: [
  { hMin: 5, hMax: 45, sMin: 15, sMax: 70, lMin: 20, lMax: 80 },
  { hMin: 15, hMax: 40, sMin: 20, sMax: 60, lMin: 10, lMax: 50 },
  // Add more ranges for specific skin tones:
  { hMin: 0, hMax: 50, sMin: 10, sMax: 80, lMin: 15, lMax: 85 },
],
```

### Change History Limit

```javascript
// In comparison.js
MAX_HISTORY: 100,  // Store up to 100 outfits (default: 50)
```

---

## 📊 Data Export Format

Export your history via `Comparison.exportData()`:

```json
{
  "version": 2,
  "exportedAt": "2026-02-15T10:30:00.000Z",
  "history": [
    {
      "id": "m1abc-xyz123",
      "timestamp": "2026-02-15T10:00:00.000Z",
      "colors": {
        "top": { "hex": "#1e3a5f", "name": "Navy", "hsl": { "h": 213, "s": 52, "l": 25 } },
        "bottom": { "hex": "#2d2d2d", "name": "Charcoal", "hsl": { "h": 0, "s": 0, "l": 18 } },
        "shoes": { "hex": "#ffffff", "name": "White", "hsl": { "h": 0, "s": 0, "l": 100 } }
      },
      "score": { "total": 88, "breakdown": [...] },
      "harmony": { "type": "Neutral-Anchored Pop", "score": 88 },
      "confidence": 82,
      "mood": { "mood": "Calm / Professional", "emoji": "💼" },
      "grade": { "letter": "A", "description": "Excellent" }
    }
  ],
  "personalBest": { ... }
}
```

---

## 🤝 Contributing

Contributions are welcome! To contribute:

1. **Fork** the repository
2. **Create** a feature branch:
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit** your changes:
   ```bash
   git commit -m 'Add amazing feature'
   ```
4. **Push** to the branch:
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open** a Pull Request

### Development Guidelines

- No build tools or frameworks — keep it vanilla JS
- All processing must remain client-side
- Test on both mobile and desktop browsers
- Maintain accessibility (`prefers-reduced-motion`, `focus-visible`, semantic HTML)
- Add JSDoc comments for new public methods

---

## 📝 Changelog

### v2.0 — Major Enhancement

- **Color Analysis**: Trimmed-mean extraction, skin rejection, 40+ color names, temperature analysis, WCAG contrast, suggestions engine
- **Scoring**: 6-category bell-curve scoring, 11 moods, S-to-F grades, neutral anchoring, warm/cool coherence
- **Garment Detection**: Smart body-column detection, center-weighted sampling, skin pixel rejection, pattern detection, confidence scoring
- **Camera**: Progressive fallback, ImageCapture high-res stills, torch/flash, zoom, tab visibility, mirroring, timeout handling
- **Crop Tool**: Coordinate scaling, resize handles, dimmed overlay, size label, clean destruction
- **Comparison**: Full history (50 entries), trends, personal bests, statistics, export/import, legacy migration
- **App**: Toast notifications, animated counters, staggered animations, keyboard shortcuts, drag-drop upload, suggestions panel, trend chart, undo
- **UI**: Glassmorphism theme, animated orbs, rainbow edge lines, glow effects, shimmer sweep

### v1.0 — Initial Release

- Basic color extraction and harmony analysis
- Camera, upload, and manual modes
- Simple scoring and comparison

---

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

---

## 🙏 Acknowledgments

- Built with **real color theory** principles (Itten's color wheel, WCAG luminance)
- Inspired by professional styling consultations
- **No AI/ML required** — pure algorithmic analysis
- Uses only native browser APIs — zero dependencies

---

<p align="center">
  <strong>Built with ❤️ using vanilla JavaScript and real color theory</strong>
  <br>
  <sub>No frameworks · No dependencies · No servers · No tracking</sub>
</p>
