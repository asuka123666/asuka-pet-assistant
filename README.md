# Asuka Pet Assistant

Windows desktop pet preview built with Electron.

## Current Version

`v0.5.1 Preview`

## Features

- Transparent frameless always-on-top desktop pet
- Click, double-click, drag, rapid-click, and right-click interactions
- Animated actions: idle, wave, jump, review, failed, walk, collar-drag, recovery, head-pat, poke, proximity, edge, sit, wake, and happy nod
- Custom compact right-click control menu
- System tray show/hide/exit controls
- Settings persistence with JSON storage
- Optional AI chat through user-configured API settings
- Speech bubbles, time-aware lines, and simple reminders
- Collapsible CPU, memory, disk, and GPU usage monitor tucked into the desktop pet
- Animated liquid resource bubble with position, size, opacity, GPU, percentage, and pressure reminder controls
- Resource bubble can be dragged to a custom spot, with smoother liquid fill and compact hover/click behavior
- GPU row now shows a quieter unavailable state plus GPU type and VRAM usage when Windows exposes it
- Single-instance launch protection so shortcuts do not open duplicate pets
- Resource pressure can affect the pet mood and trigger occasional reminders
- Resource card can be toggled from Settings or the tray menu
- Windows portable executable build

## Development

Install dependencies:

```bash
npm install
```

Run in development:

```bash
npm start
```

Check project:

```bash
npm run check
```

Build Windows portable exe:

```bash
npm run build
```

## Project Map

Runtime files kept in the project root:

- `main.js` - Electron main process: windows, tray, menus, settings, reminders, chat, and app lifecycle.
- `renderer.js` - desktop pet runtime: sprite animation, pointer interactions, mood, random actions, and resource monitor updates.
- `index.html` - minimal DOM shell for the pet and resource dock.
- `style.css` - pet sprite sizing plus resource dock and bubble styling.
- `templates/bubbles.js` - status and speech bubble HTML templates.
- `templates/chat-bubble.js` - AI chat bubble HTML template.
- `templates/control-menu.js` - right-click control menu HTML template.
- `templates/reminder.js` - reminder window HTML template.
- `templates/settings.js` - settings window HTML template.
- `templates/widget.js` - time and weather widget HTML template.
- `pet-spritesheet.png` - active 23-row sprite sheet used by the renderer.
- `icon.ico` - Windows app and tray icon.

Sprite and build helpers:

- `merge-spritesheet.js` - merges the original sheet and extension sheets into `pet-spritesheet.png`.
- `convert-equal-cells-extension.js` - converts an equal-cell source image into a 7-row extension sheet.
- `process-new-action-rows.js` - prepares the newer interaction rows before merging.
- `check-project.js` - validates required files, JavaScript syntax, package settings, and sprite dimensions.

Generated or non-runtime folders:

- `dist/` and `release/` contain packaged output.
- `assets/archive/`, `assets/generated/`, `tools/archive/`, and `qa/` contain experiments, generated assets, or review artifacts.
- `marketing/` contains promo material and is not part of the Electron runtime.
- Office/report files in this folder are unrelated to the pet and should stay out of app packaging.

## Quick Smoke Test

After changes, run:

```bash
npm run check
npm start
```

Manual checks:

- Open the pet twice and confirm only one instance remains active.
- Try right-click menu actions, Settings, reminder, chat entry, and tray show/hide.
- Drag the pet and drag the collapsed resource bubble, then restart and confirm saved positions.
- Expand the resource monitor and confirm CPU, memory, disk, and GPU rows stay readable.

## Release

The current preview package is organized under:

```text
release/Asuka Pet Assistant v0.5.1 Preview/
```

The packaged executable is ignored by Git and should be uploaded as a GitHub Release asset instead of committed to the repository.

## Notes

This is a preview build. Animations, dialogue, settings, and AI behavior may continue to change.
