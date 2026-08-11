# Task Manager — drag-and-drop findings

Testing drag-and-drop on the local **Task Manager** kanban board
(`http://localhost:5173/`) with `playwright-cli`.

---

## Setup: install playwright-cli and dependencies

You already have the Task Manager app running (at `http://localhost:5173/`).
The steps below add the `playwright-cli` tool used to drive the browser. They
were verified with Node v26.5.0 / npm 11.17.0 / playwright-cli 0.1.18.

### 1. Prerequisite: Node.js (includes npm)

`playwright-cli` is installed via npm, so you need Node.js (LTS or newer).

- **macOS**
  - With Homebrew: `brew install node`
  - Or download the installer from https://nodejs.org/
- **Windows**
  - With winget: `winget install OpenJS.NodeJS.LTS`
  - Or download the installer from https://nodejs.org/

Verify (same on both platforms):

```bash
node --version
npm --version
```

### 2. Install playwright-cli

Install it globally (same command on macOS and Windows):

```bash
npm install -g @playwright/cli@latest
```

Verify:

```bash
playwright-cli --version
```

> No global install? You can run it without installing globally using
> `npx playwright cli ...` in place of `playwright-cli ...` in every command.
> Check availability with: `npx --no-install playwright --version`

### 3. Install the browser (first run only)

`playwright-cli` uses its own managed browser build ("Google Chrome for
Testing"), not your normal Chrome. If the first `open` command reports a
missing browser, install it:

```bash
npx playwright install chromium
```

### 4. Platform note: URLs containing `&`

On **Windows**, `cmd.exe` and PowerShell treat `&` as a command separator, so
URLs with multiple query parameters get truncated. The Task Manager URL
(`http://localhost:5173/`) has no `&`, so this doesn't affect this demo — but
if you use such URLs, escape `&` as `^&` in `cmd.exe`, or prefix the command
with `--%` in PowerShell. On **macOS**, quote the URL as usual.

### 5. Quick smoke test

```bash
playwright-cli open --headed http://localhost:5173/
playwright-cli snapshot
```

The `--headed` flag makes the browser window visible so you can watch the
drag-and-drop happen. When finished, close it with `playwright-cli close`.

---

## Task attempted

Move the task **"Buy groceries"** from the **To Do** column to the
**In Progress** column.

## Result

Succeeded — but only with the **low-level mouse-event** approach. The
high-level `drag` command did **not** work on this board.

Verification: after the move, "Buy groceries" appears in the In Progress
column, its status dropdown shows "In Progress" selected, the In Progress
count went from 2 → **3**, and To Do dropped from 2 → **1**.

## What worked and what didn't

### High-level `drag` — did NOT work

```bash
playwright-cli drag f1e64 f1e82
```

The command ran without error, but nothing moved (counts unchanged, card
stayed in To Do). This board uses a **pointer-based DnD library** with an
activation distance/threshold. The high-level `drag` issues essentially a
single press → move → release, which the drag sensor ignored.

### Low-level mouse events — WORKED

The key is sending **multiple incremental `mousemove` events** between
`mousedown` and `mouseup`. The first small nudge crosses the library's
activation threshold and starts the drag; the intermediate moves let the
board track the card over to the target column.

```bash
playwright-cli mousemove 392 495   # center of the "Buy groceries" card
playwright-cli mousedown
playwright-cli mousemove 420 490   # small nudge -> crosses activation threshold
playwright-cli mousemove 550 460
playwright-cli mousemove 750 420
playwright-cli mousemove 900 390
playwright-cli mousemove 989 381   # over the In Progress column
playwright-cli mouseup
```

## How the coordinates were obtained

Bounding boxes were read from the elements, then centers computed:

```bash
playwright-cli --raw eval "el => JSON.stringify(el.getBoundingClientRect())" f1e64   # card
playwright-cli --raw eval "el => JSON.stringify(el.getBoundingClientRect())" f1e82   # In Progress column
```

- Card `f1e64`: x=117, y=416.5, w=550.7, h=156.8  → center ≈ (392, 495)
- Column `f1e82`: x=700.7, y=176.5, w=576.7, h=409.7 → center ≈ (989, 381)

(`playwright-cli snapshot --boxes` also emits `[box=x,y,width,height]` for
each element if you prefer that over `eval`.)

## Takeaways

- Try the high-level `drag` first — it's cheap and works for many pages
  (plain targets, iframes, some HTML5-native DnD).
- When `drag` runs cleanly but nothing moves, the page likely uses a
  pointer/sensor-based DnD library (e.g. dnd-kit / react-dnd). Fall back to
  low-level `mousedown` + several `mousemove` steps + `mouseup`.
- Include a small initial move after `mousedown` to cross the activation
  distance, and enough intermediate steps for the board to follow the drag.
- Non-DnD shortcut: each card also has a status dropdown, so
  `playwright-cli select <combobox-ref> "In Progress"` changes status without
  dragging — useful when you only care about the state change, not the gesture.
