```
███████╗ █████╗  ██████╗████████╗ ██████╗ ██████╗ ██╗   ██╗
██╔════╝██╔══██╗██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗╚██╗ ██╔╝
█████╗  ███████║██║        ██║   ██║   ██║██████╔╝ ╚████╔╝ 
██╔══╝  ██╔══██║██║        ██║   ██║   ██║██╔══██╗  ╚██╔╝  
██║     ██║  ██║╚██████╗   ██║   ╚██████╔╝██║  ██║   ██║   
╚═╝     ╚═╝  ╚═╝ ╚═════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝   ╚═╝  

██╗    ██╗ █████╗ ██╗   ██╗███████╗████████╗ █████╗ ██████╗ ██╗     ███████╗
██║    ██║██╔══██╗██║   ██║██╔════╝╚══██╔══╝██╔══██╗██╔══██╗██║     ██╔════╝
██║ █╗ ██║███████║██║   ██║█████╗     ██║   ███████║██████╔╝██║     █████╗  
██║███╗██║██╔══██║╚██╗ ██╔╝██╔══╝     ██║   ██╔══██║██╔══██╗██║     ██╔══╝  
╚███╔███╔╝██║  ██║ ╚████╔╝ ███████╗   ██║   ██║  ██║██████╔╝███████╗███████╗
 ╚══╝╚══╝ ╚═╝  ╚═╝  ╚═══╝  ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═════╝ ╚══════╝╚══════╝
```

> A Node.js terminal tool for generating, managing, and previewing wavetables for **Ableton Live** and the **Polyend Tracker**.

---

## Features

- 🎛️ **10 waveform types** — sine, sawtooth, square, triangle, pulse, additive, noise, wavefold, FM, supersaw
- 🎲 **Random wavetable generation** — morphing, high-complexity wavetables for sound design
- 📁 **Wavetable library browser** — browse, rename, delete, and preview your library
- 🔊 **Built-in wavetable player** — real-time playback with position and window controls
- 🎚️ **Dual export formats** — 32-bit float WAV for Ableton, 16-bit PCM WAV for Polyend Tracker
- ⚙️ **Persistent settings** — library path stored in `~/.config/wavetable-factory/settings.json`
- 💅 **Inquirer.js TUI** — clean arrow-key menus, no number punching required

---

## Requirements

- **Node.js** ≥ 18.0.0
- **ffplay** (part of [FFmpeg](https://ffmpeg.org/)) — required for wavetable audio preview

Install FFmpeg:
```bash
# macOS
brew install ffmpeg

# Ubuntu / Debian
sudo apt install ffmpeg

# Arch
sudo pacman -S ffmpeg
```

---

## Installation

```bash
git clone https://github.com/yourusername/wavetable-factory.git
cd wavetable-factory
npm install
```

To use as a global CLI command:
```bash
npm link
wavetable-factory
```

Or run directly:
```bash
npm start
```

---

## Usage

Launch the TUI:
```bash
npm start
```

You'll be dropped into the main menu:

```
──────────────────────────────────────────────────────
  Wavetable Factory
──────────────────────────────────────────────────────

? Select an option
❯ Generate Wavetable
  Browse Library
  Settings
  Quit
```

Use **↑ / ↓** to navigate, **Enter** to select.

---

## Wavetable Generation

Select **Generate Wavetable** from the main menu. You'll be prompted to:

1. **Choose a waveform type** (or Random for a fully randomised morph)
2. **Set complexity** (1–10) — higher values produce richer harmonic content
3. **Set frame count** (1–256) — number of frames in the wavetable
4. **Choose export target** — Ableton Live, Polyend Tracker, or Both

Generated wavetables are named `{adjective}-{noun}-table` (e.g. `solar-spiral-table.wav`) and saved to your library.

### Waveform Types

| Type | Description |
|------|-------------|
| **Sine** | Pure sinusoidal wave |
| **Sawtooth** | Rises linearly, rich harmonic series |
| **Square** | Hard-edged 50% duty cycle |
| **Triangle** | Softer version of square, odd harmonics only |
| **Pulse** | Variable duty-cycle square with morphing |
| **Additive** | Additive synthesis of random harmonic partials |
| **Noise** | Smoothed white noise, band-limited |
| **Wavefold** | Sine wave fed through a folder/saturator |
| **FM** | Frequency modulation with morphing modulation index |
| **Supersaw** | Multi-voice detuned sawtooth, thick and lush |

---

## Export Formats

| Target | Format | Sample Rate | Bit Depth | Frame Size | Max Frames |
|--------|--------|-------------|-----------|------------|------------|
| **Ableton Live** | 32-bit float WAV | 44,100 Hz | 32-bit | 2048 samples | 256 |
| **Polyend Tracker** | 16-bit PCM WAV | 44,100 Hz | 16-bit | 256 samples | 1 |

Files are saved into dedicated subfolders inside your library:
```
<library-path>/
  ableton/    ← 32-bit float WAVs for Ableton Live's Wavetable synth
  polyend/    ← 16-bit PCM WAVs for Polyend Tracker
```

---

## Wavetable Browser

Select **Browse Library** to see all `.wav` files in your library (recursively scanned). You can:

- **Play** — preview the wavetable in the built-in player
- **Rename** — rename the file (extension preserved)
- **Delete** — permanently delete the file (with confirmation)

---

## Wavetable Player

The player synthesises audio at **middle C (261.63 Hz)** and streams it through `ffplay` in a loop. Use the keyboard controls while the player is active:

| Key | Action |
|-----|--------|
| `←` / `→` | Shift wavetable **position** (5% steps) |
| `↑` / `↓` | Increase / decrease **window size** |
| `p` | Toggle **play / pause** |
| `q` | **Quit** player and return to browser |

The **position** controls which frame in the wavetable is at the centre of playback. The **window** controls how many frames are included in the playback loop.

---

## Settings

Select **Settings** from the main menu to:

- **Set your library path** — the root folder where wavetables are saved and browsed

Settings are stored at `~/.config/wavetable-factory/settings.json`.

---

## Project Structure

```
wavetable-factory/
├── bin/
│   └── wavetable-factory.js     # CLI entry point
├── src/
│   ├── constants.js             # DAW specs, waveform types, config defaults
│   ├── config.js                # Settings persistence (read/write JSON)
│   ├── audio/
│   │   └── player.js            # Synthesis engine + ffplay integration
│   ├── cli/
│   │   ├── menu.js              # Main menu loop
│   │   ├── prompt.js            # Inquirer.js UI primitives
│   │   └── screens/
│   │       ├── generator.js     # Wavetable generation screen
│   │       ├── browser.js       # Library browser screen
│   │       ├── player.js        # Player screen (raw keypress mode)
│   │       └── settings.js      # Settings screen
│   ├── engine/
│   │   ├── generator.js         # Wavetable frame generator
│   │   ├── randomizer.js        # Random wavetable generation
│   │   ├── exporter.js          # WAV file writer (Ableton + Polyend)
│   │   └── waveforms.js         # Individual waveform generators
│   └── library/
│       ├── scanner.js           # Recursive library scanner
│       └── fileOps.js           # File rename / delete helpers
├── tests/                       # Jest test suite (362 tests)
├── TUI-STYLE-GUIDE.md           # TUI conventions for contributing agents
└── package.json
```

---

## Development

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Lint
npm run lint
```

All 362 tests use Jest. The engine and CLI layers are fully unit-tested with mocked I/O; the player screen uses raw-keypress tests via a pure key-handler function.

---

## Technical Notes

### Ableton Live Wavetable format
Ableton's Wavetable synth loads standard **32-bit float mono WAV** files. Frame count × 2048 samples = total file length. Up to 256 frames supported.

### Polyend Tracker wavetable format
Polyend Tracker loads **16-bit PCM mono WAV** files with 256 samples per frame (single-frame only). The exporter converts from 32-bit float internally.

### Audio preview
The player writes 10 seconds of synthesised audio to a temp file (`/tmp/wavetable-factory-preview.wav`) and plays it back via `ffplay -loop 0`. Changing the position or window kills and restarts ffplay with a freshly rendered buffer.

---

## License

ISC
