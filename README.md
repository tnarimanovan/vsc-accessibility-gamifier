# Mole’s Burrow: A Gamified Accessibility Analyzer for VS Code

`Mole’s Burrow` is a VS Code extension designed to seamlessly integrate real-time web accessibility auditing into the developer workflow. By combining an isolated, multi-threaded evaluation architecture with dynamic gamification mechanics, it transforms WCAG compliance verification from a manual bottleneck into an engaging, educational, and high-performance IDE experience.

---

## 🎮 Game Design Mechanics

* **Evolutionary Progression:** The digital companion tracks user progression through 4 visual archetypes across continuous levels:
  * 🐣 **Stage 1: Mole Intern** (Levels 1–3)
  * 🛠️ **Stage 2: Junior Mole Dev** (Levels 4–7)
  * 💼 **Stage 3: Senior Mole Dev** (Levels 8–12)
  * 👑 **Stage 4: Accessibility Architect** (Levels 13+)
* **Metabolic Satiety Decay:** Satiety falls by 1% every 10 minutes of active development. Falling below a 30% threshold triggers a critical `MOLE_STARVING` state, prompting immediate accessibility resolutions.
* **Type-Based Rewards:** Specific Axe-Core rules map to explicit culinary tiers, granting targeted rewards upon resolution:
  * 🍏 **SNACK (5 XP):** Minor accessibility adjustments (e.g., resolving missing alternative image descriptions).
  * 🥪 **LUNCH (20 XP):** Moderate structural fixes (e.g., fixing element form labels or color contrast boundaries).
  * 🥩 **DELICACY (50 XP):** Critical accessibility corrections (e.g., sorting complex ARIA hierarchies or keyboard navigation mappings).
* **Delta-Based Combo Protection:** Successive fixes compound active multiplier gains (`1.0x -> 1.2x -> 1.5x -> 2.0x`). Multipliers break *only* on real regressions (new bugs) or active stagnation, forgiving legacy issues while the file is undergoing incremental optimization.

---

## 📥 Installation (VSIX)


https://github.com/user-attachments/assets/64c8b84f-1d02-467c-900f-1376eea2d4c8



To install and use the pre-built extension in your VS Code:

1. Download or get the `vsc-accessibility-gamifier-0.0.1.vsix` file.
2. Open **VS Code**.
3. Open the **Extensions** view (`Cmd+Shift+X` on Mac / `Ctrl+Shift+X` on Windows/Linux).
4. Click the **`...`** (Views and More Actions) menu in the top-right corner of the Extensions panel.
5. Select **Install from VSIX...**
6. Choose the `vsc-accessibility-gamifier-0.0.1.vsix` file and click **Install**.

---

## 🚀 How to Use



https://github.com/user-attachments/assets/75e28a50-47d6-40a6-b67e-540541a5face



1. After installation, open any project containing HTML, Vue files.
2. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`).
3. Type and run: **`Mole's Burrow: Open Burrow`**.
4. Start fixing accessibility errors in your active file and save changes — the mole will automatically track your progress, gain XP, and evolve!

---

## 💻 Local Development Setup

If you want to contribute, run tests, or build the extension from source:

### Prerequisites

* [Node.js](https://nodejs.org/) (v18 or higher)
* [VS Code](https://code.visualstudio.com/)
