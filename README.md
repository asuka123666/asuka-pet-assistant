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

## Release

The current preview package is organized under:

```text
release/Asuka Pet Assistant v0.5.1 Preview/
```

The packaged executable is ignored by Git and should be uploaded as a GitHub Release asset instead of committed to the repository.

## Notes

This is a preview build. Animations, dialogue, settings, and AI behavior may continue to change.
