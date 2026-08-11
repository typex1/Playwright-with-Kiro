# DEMO 1 — "Add Todo" flow on TodoMVC

Walk through the same steps I ran, using `playwright-cli`. Copy-paste each
command in order.

Target page: https://demo.playwright.dev/todomvc

## Prerequisites

`playwright-cli` must be available on your PATH. Check with:

```bash
playwright-cli --version
```

If it's not installed, install it globally:

```bash
npm install -g @playwright/cli@latest
```

(Or, if a local Playwright is available in the project, use `npx playwright cli`
in place of `playwright-cli` in every command below.)

## Steps

### 1. Open a visible browser on the TodoMVC demo

The `--headed` flag makes the browser window visible. Without it, the browser
runs headless (nothing appears on screen).

```bash
playwright-cli open --headed https://demo.playwright.dev/todomvc
```

### 2. Take a snapshot to find element refs

The snapshot lists page elements with refs like `e8`. The "What needs to be
done?" textbox is the one you type into.

```bash
playwright-cli snapshot
```

Look for a line like:

```
- textbox "What needs to be done?" [active] [ref=e8]
```

Note the ref (e.g. `e8`). If it differs on your run, use your value in the
commands below.

### 3. Add the first todo

`--submit` presses Enter after filling, which adds the item.

```bash
playwright-cli fill e8 "Buy groceries" --submit
```

### 4. Add a second todo

```bash
playwright-cli fill e8 "Write report" --submit
```

### 5. Verify the result

```bash
playwright-cli snapshot
```

You should see both items in the list and a footer counter reading
"2 items left".

### 6. Close the browser

```bash
playwright-cli close
```

## Tip: target by role instead of ref

Refs can change between runs. To avoid re-snapshotting, you can target the
textbox by its accessible role/name instead:

```bash
playwright-cli fill "getByRole('textbox', { name: 'What needs to be done?' })" "Buy groceries" --submit
```
