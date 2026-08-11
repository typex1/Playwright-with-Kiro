# playwright-cli — Notes & Findings

Practical findings from driving browsers with `playwright-cli` on macOS.

## Table of contents

- [Which browser does playwright-cli use?](#which-browser-does-playwright-cli-use)
  - [Conclusion](#conclusion)
  - [Evidence: process inspection is ground truth](#evidence-process-inspection-is-ground-truth)
  - [Why the first conclusion was wrong](#why-the-first-conclusion-was-wrong)
  - [Implications](#implications)
  - [Loading your real Chrome profile](#loading-your-real-chrome-profile)
  - [Verifying the browser yourself](#verifying-the-browser-yourself)
- [Other engines: Firefox and WebKit](#other-engines-firefox-and-webkit)
  - [The same flow, another engine](#the-same-flow-another-engine)
  - [Firefox runs a bundled build, not your installed Firefox](#firefox-runs-a-bundled-build-not-your-installed-firefox)
  - [Verifying which Firefox is running](#verifying-which-firefox-is-running)
- [Controlling an already-open Chrome tab](#controlling-an-already-open-chrome-tab)
  - [Why you can't attach to a normal tab directly](#why-you-cant-attach-to-a-normal-tab-directly)
  - [Option 1: Playwright browser extension](#option-1-playwright-browser-extension)
  - [Option 2: CDP via a debugging port](#option-2-cdp-via-a-debugging-port)
  - [Which option to choose](#which-option-to-choose)
- [Drag-and-drop with playwright-cli](#drag-and-drop-with-playwright-cli)
  - [Two levels of drag-and-drop](#two-levels-of-drag-and-drop)
  - [Suggested demo pages](#suggested-demo-pages)
  - [Verified live](#verified-live)

---

## Which browser does playwright-cli use?

Findings from inspecting the browser launched by `playwright-cli` on macOS.

> **Correction (2026-08-11):** An earlier version of this file concluded the
> browser was "Google Chrome for Testing." That was **wrong** — it relied on
> two unreliable signals (see [Why the first conclusion was
> wrong](#why-the-first-conclusion-was-wrong)). Verifying the actual OS process
> shows it is the **real installed Google Chrome**.

### Conclusion

`playwright-cli` drives your **real installed Google Chrome**
(`/Applications/Google Chrome.app`, e.g. v151.0.7922.109) — the actual Chrome
application binary, **not** a separate "Chrome for Testing" build. However, it
launches Chrome with a **fresh, isolated (in-memory) profile**, so none of your
bookmarks, extensions, logins, or history are present. That empty profile is
why it *looks* like a blank browser.

This was confirmed for both a plain `open --headed` session and an explicit
`--browser=chrome` session; both ran the real Chrome binary.

### Evidence: process inspection is ground truth

Inspect the actual running browser process rather than trusting Playwright's
APIs:

```bash
# Find the real binary behind the session's browser process
ps ax -o pid,ppid,command | grep "MacOS/Google Chrome" | grep -v Helper

# Confirm no "Chrome for Testing" is running
pgrep -fl "Google Chrome for Testing"   # -> NONE
```

Result: the session's browser process is
`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` (with Playwright
automation flags), and no Chrome-for-Testing process exists.

```bash
# Installed Chrome version
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --version
# -> Google Chrome 151.0.7922.109
```

### Why the first conclusion was wrong

Two signals *looked* definitive but are not:

- **`browserType().executablePath()`** returns Playwright's **bundled default**
  path (the `ms-playwright/chromium-1237/.../Google Chrome for Testing` path)
  **regardless of which browser actually launched**. So it points at the cache
  even when real Chrome is running. Not reliable for identifying the running
  binary.
- **User agent `Chrome/151.0.0.0`** — modern Chrome's *User-Agent Reduction*
  zeroes the build number (`.0.0.0`) for **both** real Chrome and
  Chrome-for-Testing, so the UA cannot distinguish them. (Installed Chrome
  151.0.7922.109 reduces to `151.0.0.0`.)

Only OS-level process inspection is trustworthy here.

### Implications

- It's your real Chrome **engine/binary**, but with an **isolated profile** —
  no bookmarks, extensions, logins, cookies, or history.
- Your own personal Chrome (your real profile) runs as a separate process and
  is untouched; the automated instance uses its own `--user-data-dir`.

### Loading your real Chrome profile

To also load your actual profile (bookmarks, extensions, logins), point at your
Chrome user-data directory — with your personal Chrome fully **quit** first,
since Chrome locks the profile directory:

```bash
playwright-cli open --headed --browser=chrome \
  --profile="$HOME/Library/Application Support/Google/Chrome"
```

Note: using your real profile means automation acts as logged-in you, so use it
deliberately.

### Verifying the browser yourself

```bash
# 1. Which binary is actually running (definitive)
ps ax -o pid,command | grep "MacOS/Google Chrome" | grep -v Helper
pgrep -fl "Google Chrome for Testing"

# 2. Installed Chrome version, to compare
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --version
```

Do **not** rely on `browserType().executablePath()` or `navigator.userAgent`
alone — as shown above, both can be misleading.

---

## Other engines: Firefox and WebKit

The same automation runs on other engines — just add `--browser`:

```bash
playwright-cli open --headed --browser=firefox http://localhost:5173/
playwright-cli open --headed --browser=webkit  http://localhost:5173/
```

### The same flow, another engine

A flow written for Chrome works unchanged on Firefox/WebKit. The only practical
note: element `refs` are per-session, so prefer engine-agnostic **role
locators** over refs when reusing steps across browsers:

```bash
playwright-cli -s=ff fill "getByRole('textbox', { name: 'Title' })" "Swim training"
playwright-cli -s=ff click "getByRole('button', { name: 'Create Task' })"
```

This was verified live: the exact "create a task" flow ran on Firefox (real
Gecko engine, `Firefox/153.0`) with no changes beyond `--browser=firefox`.

### Firefox runs a bundled build, not your installed Firefox

Important contrast with Chrome:

- **Chromium family** — Playwright can drive your **real installed Google
  Chrome** (via the `chrome` channel / default), because it only needs a
  compatible Chrome binary.
- **Firefox** — Playwright can **only** automate its **own patched Firefox
  build**. Mozilla's Firefox doesn't expose the automation protocol Playwright
  needs (Playwright patches Firefox with its "Juggler" protocol), so it bundles
  a custom build. That build carries **"Nightly"** branding, which is why the
  window says *Firefox Nightly* even though you never installed Nightly.

Consequences:

- There is **no `--browser` channel or `--profile` trick** to make Playwright
  drive your installed stable `/Applications/Firefox.app`, unlike
  `--browser=chrome` for Chrome. With Firefox you always get Playwright's
  bundled build.
- It is still the genuine Gecko engine (a real cross-engine test), just not the
  exact Firefox binary/version you have installed, and it runs on an isolated
  temporary profile.

### Verifying which Firefox is running

Process inspection is the ground truth here too:

```bash
ps ax -o pid,command | grep -i firefox | grep -v grep
```

Observed: the automated session's process was
`~/Library/Caches/ms-playwright/firefox-1539/firefox/Nightly.app/Contents/MacOS/firefox`
(Playwright's cached build, launched with a temporary `-profile`), while the
separately-installed `/Applications/Firefox.app` ran as an untouched, unrelated
process.

---

## Controlling an already-open Chrome tab

Can Playwright control a tab you **already opened yourself** in your normal
Chrome (e.g. you browsed to `http://localhost:5173/`)? Yes, but not by magic —
it depends on how that Chrome exposes itself for automation.

### Why you can't attach to a normal tab directly

Playwright attaches to an external browser either via a **CDP debugging
endpoint** or via the **Playwright browser extension**. A Chrome you just
opened normally exposes **neither** — there is no debugging endpoint listening,
so there is nothing for `playwright-cli attach` to connect to yet. You have to
enable one of the two bridges below.

### Option 1: Playwright browser extension

Connects through a Chrome extension bridge to your **live, already-open tab** —
no relaunch needed.

```bash
playwright-cli attach --extension=chrome
```

- Requirement: the Playwright browser extension must be **installed** in your
  Chrome, and you approve the connection. If it isn't installed, this fails
  until you add it.
- This is the intended way to drive the exact tab you are looking at, keeping
  your real profile and session.

### Option 2: CDP via a debugging port

A normal Chrome has no debug port open, so you must **relaunch** Chrome with
one:

```bash
# Quit Chrome first, then relaunch with a debugging port:
open -a "Google Chrome" --args --remote-debugging-port=9222

# Then attach:
playwright-cli attach --cdp=http://localhost:9222
```

- Chrome restores your tabs on relaunch (so `localhost:5173` comes back), and
  Playwright can then control it — including your real profile, since it's your
  actual Chrome.
- Caveat: technically this is a **relaunch**, not the originally-running
  process. `playwright-cli detach` disconnects and leaves Chrome running.

### Which option to choose

- Grab the current tab **without touching** your running Chrome → **Option 1**
  (extension).
- Extension not installed, and a relaunch is acceptable → **Option 2**
  (debugging port).

---

## Drag-and-drop with playwright-cli

`playwright-cli` can perform drag-and-drop.

### Two levels of drag-and-drop

- **High-level `drag`** — drags one element onto another. Best first choice,
  even for HTML5-native drag-and-drop:

  ```bash
  playwright-cli drag <source-ref> <target-ref>
  ```

- **Low-level mouse events** — for custom gestures / paths, or for
  pointer/sensor-based DnD libraries (e.g. dnd-kit) that ignore the high-level
  `drag`. Include a small initial move to cross the activation threshold, then
  several intermediate moves:

  ```bash
  playwright-cli mousemove 150 300
  playwright-cli mousedown
  playwright-cli mousemove 400 300
  playwright-cli mouseup
  ```

- **`drop`** — drag external data/files onto an element:

  ```bash
  playwright-cli drop <ref> --path=./image.png
  playwright-cli drop <ref> --data="text/plain=hello world"
  ```

Note: this drives the browser's synthetic input, not your physical hardware
mouse pointer. In headed mode you can watch it happen, but it does not take
over your real cursor or work outside the browser window.

### Suggested demo pages

- **jQuery UI Droppable** — https://jqueryui.com/droppable/
  "Drag me to my target" box onto a target zone. Draggable lives inside an
  `<iframe>` (refs are frame-scoped, e.g. `f2e2`).
- **jQuery UI Sortable** — https://jqueryui.com/sortable/
  Reorderable list (closest analog to reordering todos). Also iframe-based.
- **SortableJS** — https://sortablejs.github.io/Sortable/
  Multiple DnD list examples, no iframe. Modern, works cleanly with `drag`.
- **HTML5 Demos** — https://html5demos.com/drag/
  Native HTML5 DragEvent API — useful to test the HTML5-DnD case.
- **The Internet (Herokuapp)** — https://the-internet.herokuapp.com/drag_and_drop
  Two boxes A/B you swap. Well-known automation test page, HTML5-DnD based.

### Verified live

- **jQuery UI Droppable** (iframe): dragging `f2e2` onto `f2e4` changed the
  target text from "Drop here" to **"Dropped!"**.

  ```bash
  playwright-cli drag f2e2 f2e4
  ```

- **The Internet A/B swap** (HTML5-native DnD): the high-level `drag` worked on
  the first try — columns swapped from `A, B` to **`B, A`**.

  ```bash
  playwright-cli drag f1e10 f1e12
  ```

Takeaway: try the high-level `drag` first — it handled a plain target, an
iframe-scoped drag, and native HTML5 drag-and-drop. When `drag` runs cleanly
but nothing moves (common with pointer/sensor-based kanban boards), fall back to
the low-level mouse-event sequence. See `TASK_MANAGER-drag_and_drop.md` for a
worked example.
