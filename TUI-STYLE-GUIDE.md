# TUI Style Guide — wavetable-factory

A reference for building consistent terminal UIs in this style.
Stack: **Node.js · chalk@4 · figlet · ora@5 · readline (built-in)**

> **Note on ESM:** Use `chalk@4`, `ora@5` — later versions are ESM-only and incompatible with `require()`.

---

## Principles

- **Text-only input** — numbered menus and typed prompts; no mouse, no widget boxes.
- **0 to go back** — every menu offers `0` as the "back / return" option.
- **Inline validation** — errors print immediately below the prompt; the prompt re-displays until input is valid.
- **Minimal redraws** — use `\r` + overwrite for live single-line state (e.g. player). Use `console.log` for everything else.
- **Colour is accent, not decoration** — cyan for prompts, yellow for numbers/values, green for success, red for errors, dim for hints.

---

## Colour Palette

| Role | chalk call | Example |
|---|---|---|
| Prompt arrow | `chalk.cyan('▶ ')` | `▶ Enter number:` |
| Prompt text | `chalk.bold.white(label)` | **Select waveform** |
| Menu numbers | `chalk.yellow('1')` | `  1  Sine` |
| Menu items | `chalk.white(text)` | `  1  Sine` |
| Section header bar | `chalk.blueBright('─'.repeat(52))` | `────────────────` |
| Header title | `chalk.bold.white(title)` | **  Generator** |
| Success | `chalk.green('  ✔  ') + chalk.greenBright(msg)` | `  ✔  Saved!` |
| Error | `chalk.red('  ✖  ') + chalk.redBright(msg)` | `  ✖  Invalid` |
| Info | `chalk.white('  ' + msg)` | `  64 frames` |
| Hints / dim text | `chalk.dim(text)` | `[←→] pos` |
| Playing state | `chalk.green('▶  PLAYING')` | |
| Stopped state | `chalk.dim('■  STOPPED')` | |
| Value highlight | `chalk.yellow(value)` | `50%` |
| Secondary value | `chalk.cyan(value)` | `  1` |

---

## Layout Constants

```js
const BOX_W = 52; // header/hr line width
```

---

## Core UI Primitives (`src/cli/prompt.js`)

### `printBanner()`
Renders a figlet ASCII art title + tagline. Call once at startup.

```
  __ __ __              _        _    _
 \ V  V / __ ___   ___| |_ __ _| |__| |___
  \_/\_/ / _` \ \ / / _` / _` | '_ \ / -_)
         \__,_|\_/ \__,_\__,_|_.__/_\___|

  ♪  factory  ·  synthesise · browse · play
```

### `printHeader(title)`
Prints a full-width rule, bold title, rule. Use at the top of each screen.

```
────────────────────────────────────────────────────
  Generator
────────────────────────────────────────────────────
```

### `hr()`
Prints a dim full-width rule. Use to visually separate sections.

### `printSuccess(msg)` / `printError(msg)` / `printInfo(msg)`
Inline status messages. Always two leading spaces for indent.

```
  ✔  Wavetable saved to library
  ✖  Please enter a number between 1 and 10
  64 frames · 2048 samples/frame · 44100 Hz
```

---

## Prompts

### `ask(question)` → `Promise<string>`
Single text input. Displays `▶ Question ` and returns trimmed answer.

```
▶ Enter number: _
```

### `askValidated(label, validator, defaultVal?)` → `Promise<string>`
Re-prompts until `validator(value)` returns `null`. Shows default in dim brackets.

```
▶ Complexity (1–10) [5] _
  ✖  Must be between 1 and 10     ← shown on bad input, then re-prompts
```

### `choose(label, options[])` → `Promise<number>` (0-based index)
Numbered list; returns the **0-based index** of the selection.

```
Select export target

  1  Ableton Live
  2  Polyend Tracker
  3  Both

▶ Enter number: _
```

### `confirm(question)` → `Promise<boolean>`
y/N confirmation (default No).

```
▶ Delete fuzzy-drone-sine? [y/N] _
```

---

## Menu Pattern

Every screen is a `while (true)` loop. `0` breaks out; anything else dispatches.

```js
async function myMenu(config) {
  while (true) {
    printHeader('My Screen');

    const ITEMS = ['Do thing A', 'Do thing B'];
    ITEMS.forEach((item, i) => {
      console.log(`  ${chalk.yellow(i + 1)}  ${chalk.white(item)}`);
    });
    console.log(`  ${chalk.yellow(0)}  ${chalk.white('Back')}`);
    console.log('');

    const sel = await ask('Choose');
    const n = parseInt(sel, 10);

    if (n === 0) return;
    if (n === 1) { await doThingA(); continue; }
    if (n === 2) { await doThingB(); continue; }
    printError('Invalid selection.');
  }
}
```

---

## Spinners (`withSpinner`)

Wrap any async operation that takes >200 ms.

```js
await withSpinner('Generating wavetable…', async () => {
  frames = generateWavetable({ type, frameCount, samplesPerFrame, complexity });
});
```

- On success: spinner changes to ✔
- On error: spinner changes to ✖, then `throw` propagates

---

## Waveform Preview (`renderWaveform`)

Renders a `Float32Array` as a row of Unicode block characters (`▁▂▃▄▅▆▇█`).

```js
const preview = renderWaveform(frames[0], 48);
printInfo(chalk.cyan(preview));
// → ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▁▂▃▄▅▆▇█▇▆▅▄▃▂▁
```

Amplitude mapping: `-1 → ▁`, `0 → ▄`, `+1 → █`.

---

## Raw Keypress Mode (Player)

For real-time key handling (arrow keys, single keypress):

```js
// 1. Close readline BEFORE entering raw mode
closeRL();

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data', key => {
  // key values for special keys:
  // '\u001b[A' = up    '\u001b[B' = down
  // '\u001b[C' = right '\u001b[D' = left
  // '\u0003'   = Ctrl+C
  if (key === 'q' || key === '\u0003') {
    process.stdin.setRawMode(false);
    // DO NOT call process.stdin.pause() — it blocks next readline ask()
    process.stdin.removeListener('data', handler);
    resolve();
  }
});

// Redraw live state with \r (no newline):
process.stdout.write('\r' + renderState(state) + '  ');
```

**Critical rules:**
- Always call `closeRL()` before `setRawMode(true)`
- Never call `process.stdin.pause()` on exit — readline's next `ask()` resumes stdin automatically
- Use `\r` + trailing spaces to overwrite the current line cleanly

---

## Screen Structure

Each screen lives in `src/cli/screens/<name>.js` and exports an async `<name>Menu(config)` function. Screens are stateless — all state is passed via `config` or local variables within the menu function.

```
src/cli/
  prompt.js          ← all UI primitives
  menu.js            ← main menu, dispatches to screens
  screens/
    generator.js     ← wavetable generation flow
    browser.js       ← library browse / rename / delete
    settings.js      ← config (library path, etc.)
    player.js        ← raw-mode audio preview player
```

---

## Testing Conventions

- Mock `src/cli/prompt` entirely in screen tests — never touch real readline/stdin.
- `ask.mockResolvedValueOnce(value)` for each expected prompt in sequence.
- `choose.mockResolvedValueOnce(index)` — always 0-based.
- `'0'` as the final `ask` mock to exit the `while(true)` loop.
- Never test chalk colours directly — strip with `.replace(/\x1b\[[0-9;]*m/g, '')` or use `.toMatch(/plain text/)` since chalk@4 respects `NO_COLOR`.

```js
// Example: test a menu that asks once then exits
ask.mockResolvedValueOnce('1')   // selection
   .mockResolvedValueOnce('')    // sub-prompt default
   .mockResolvedValueOnce('0'); // back
choose.mockResolvedValueOnce(0); // first option in choose()

await myMenu(mockConfig);
expect(doThingA).toHaveBeenCalled();
```
