# Changelog

## v1.0.0 — 2026-02-28

### 🎉 First Release

Wavetable Factory is a Node.js terminal tool for generating, managing, and previewing wavetables for **Ableton Live** and the **Polyend Tracker**. Built entirely in the terminal with a clean Inquirer.js arrow-key TUI.

---

### ✨ Features

#### Wavetable Generation
- **10 waveform types** — sine, sawtooth, square, triangle, pulse, additive, noise, wavefold, FM, and supersaw
- **Complexity control** (1–10) — scales harmonic richness and morphing density across frames
- **Frame count** — 1 to 256 frames per wavetable (Ableton limit)
- **Random wavetable mode** — fully randomised high-complexity morphing wavetable with a single selection
- **Inter-frame morphing** — smooth linear interpolation between wavetable frames for evolving, animated textures
- **Additive synthesis** — complexity-scaled harmonic partials for rich, controllable timbres
- **Noise types** — smoothed white noise, wavefold saturation, FM modulation, and multi-voice supersaw

#### Export Formats
- **Ableton Live** — 32-bit float mono WAV, 2048 samples/frame, up to 256 frames, 44.1 kHz
- **Polyend Tracker** — 16-bit PCM mono WAV, 256 samples/frame, single frame, 44.1 kHz
- **Dual export** — generate for both targets in one step (default)
- **Organised library** — files saved into `ableton/` and `polyend/` subfolders automatically

#### Wavetable Names
- Auto-generated descriptive names in the format `{adjective}-{noun}-table` (e.g. `solar-spiral-table.wav`) drawn from curated word lists

#### Library Browser
- **Recursive scan** — discovers all `.wav` files in your library with relative path display
- **Play** — preview any wavetable in the built-in player
- **Rename** — rename files in-place (extension preserved)
- **Delete** — remove files with confirmation prompt

#### Wavetable Player
- **Middle C playback** — synthesises audio at 261.63 Hz via `ffplay` in a loop
- **Position control** — `←` / `→` to shift the playback start position (5% steps)
- **Window control** — `↑` / `↓` to increase or decrease the playback window size
- **Toggle play/pause** — `p` key
- **Live re-render** — changing position or window kills and restarts ffplay with a freshly rendered buffer

#### TUI
- **Inquirer.js menus** — native arrow-key list selection, no number punching
- **Screen clear on navigation** — every menu transition clears the terminal for a clean UI
- **Persistent settings** — library path stored in `~/.config/wavetable-factory/settings.json`

---

### 🏗️ Architecture

| Layer | Description |
|-------|-------------|
| `src/engine/` | DSP core — waveform generators, additive synthesis, frame morphing, WAV exporter |
| `src/cli/` | Inquirer.js TUI — menus, screens (generator, browser, player, settings) |
| `src/audio/` | Playback engine — phase accumulator synthesis, ffplay integration |
| `src/library/` | Library management — recursive scanner, file rename/delete |
| `src/config.js` | Settings persistence |

---

### 🧪 Test Coverage

- **362 tests** across 21 test suites, all passing
- Full unit coverage of the DSP engine, exporter, randomizer, library scanner, and all TUI screens
- Player screen tested via a pure key-handler function (raw stdin is never opened in tests)

---

### ⚙️ Requirements

- **Node.js** ≥ 18.0.0
- **ffplay** (FFmpeg) for audio preview

---

### 📦 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `inquirer` | ^8.2.7 | TUI menus (CJS-compatible) |
| `chalk` | ^4.1.2 | Terminal colours |
| `ora` | ^5.4.1 | Spinner |
| `figlet` | ^1.10.0 | ASCII banner |
| `fs-extra` | ^11.3.3 | File system helpers |
| `wav` | ^1.0.2 | WAV file writing |
| `blessed` | ^0.1.81 | (retained, unused in v1) |
