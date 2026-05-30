# B-Pillar 6th Order Bandpass Calculator

**Created by Anthony Albers**

Desktop Electron app and **GitHub Pages web build** for designing **6th-order bandpass** and **4th-order bandpass** subwoofer walls behind the B-pillar — focused on low-frequency automotive builds.

> **BETA:** Experimental acoustic calculator for extreme SPL applications. Use at your own risk. Report bugs: [boxcalculatorbugs@gmail.com](mailto:boxcalculatorbugs@gmail.com)

## Physics engine

Calculation logic lives in [`src/calc/`](src/calc/) — [`engine.js`](src/calc/engine.js) orchestrates Helmholtz, quarter-wave, MLTL, cabin gain, 4th-order Fcb, door tuning, packaging, and warnings. Public entry: [`src/calc/index.js`](src/calc/index.js) (`runAll`).

## State management

| Priority | Feature | How |
|----------|---------|-----|
| 1 | **Auto-save** | Debounced `localStorage` on every input change |
| 2 | **Defaults** | Startup preset when no auto-save |

**Save Design / Load Design** exports or imports a `.json` file (same schema as auto-save).

## Order types

| Mode | Rear port (Ch. 1) | Front port (Ch. 2) | End correction |
|------|-------------------|--------------------|----------------|
| **Parallel** | Vents to cabin | Vents to cabin | 0.732×r (flanged) both |
| **Series** | Vents into front chamber | Vents to cabin | 0.614×r internal, 0.732×r external |

**Default preset (Series):** dual **18"** wall — rear **10 cu ft @ 25 Hz** (internal slot into front), front **20 cu ft @ 60 Hz** (external slot to cabin). **2:1** volume ratio with low rear tuning.

## Features

- **Dual-chamber port calculator** — Helmholtz port length with end correction
- **Port input modes** — area, round diameter, or **slot (W × H)** with port wall thickness
- **Volume basis per chamber** — net, gross L×W×H (outer or internal), or gross volume
- **Build adjustments** — wall thickness (default **1.5 in / 2×3/4" MDF**), bracing %, extra displacement
- **Volume breakdown table** — gross → port → driver → bracing → effective net
- **Tuning sensitivity chart** — Fb drift and port length vs ±% volume measurement error
- **Driver array** — sub size/count with auto Sd and port:Sd ratio warnings
- **Cabin gain** — 12 dB/oct closed, 3 dB/oct open; dual curves on charts
- **B-pillar packaging**, T/S modeling, SVG diagram, passband estimates

## Input Guide

| Section | Purpose |
|---------|---------|
| **Vehicle / Cabin** | Longest interior dimension, cabin volume, doors open |
| **B-Pillar Space** | Max depth, height, width for the wall |
| **Build Adjustments** | Wall thickness, bracing toggle + %, tolerance sweep toggle + range |
| **Driver Array** | Sub size and count → auto cone area (Sd) |
| **Chamber 1 / 2** | Fb, volume basis, port mode (area / diameter / slot) |

### Volume basis

| Mode | You enter | App computes |
|------|-----------|--------------|
| **Net** | Target net volume | Gross = net + displacements |
| **Gross L×W×H** | Box dimensions | Net after wall loss, port, driver, bracing |
| **Gross volume** | Single gross cu ft | Net after all displacements |

Check **Measure from outer dims** to subtract wall thickness (default 1.5 in) from each axis.

### Units

Volume: **cu ft**, **cu in**, or **liters**. Length: inches or mm. Port area: sq in or cm².

### File / Edit / Help menu

| Menu | Action |
|------|--------|
| **File → Save Design** | Save all inputs to a `.json` file |
| **File → Load Design** | Restore a saved design |
| **Edit → Clear Design** | Zero all inputs and clear optional fields |
| **Help → Software Manual** | Full metrics reference |
| **Help → Show Beta Disclaimer** | Re-show the beta warning banner |

## Getting Started

```bash
npm install
npm run dev          # Electron development
npm run verify       # calc + persistence checks
npm run build:web    # static site → dist/web (GitHub Pages)
npm run dist         # Windows installer + portable exe
```

### GitHub Pages

1. Enable **GitHub Pages** → Source: **GitHub Actions**
2. Push to `main` — workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) builds and deploys `dist/web`
3. For local preview: `npm run build:web` then serve `dist/web`

On phones and narrow browsers, the app keeps the **same desktop layout** (inputs and results side by side). Pinch to zoom and scroll as needed — same as “Request desktop site” in mobile browsers. Touch targets are enlarged on touch devices.

Output (Electron): `release/B-Pillar 6th Order Calculator Setup 1.0.x.exe` and portable `.exe`.

## Port Formula

```
raw_length = (c² × A) / (4π² × f² × V)
physical_length = raw_length - k × √(A/π)
```

Series internal port: k = 0.614. External/flanged: k = 0.732.

## License

MIT
