# Asuka Pet Assistant

Windows desktop pet preview built with Electron.

## Current Version

`v0.3.0 Preview`

## Features

- Transparent frameless always-on-top desktop pet
- Click, double-click, drag, rapid-click, and right-click interactions
- Animated actions: idle, wave, jump, review, failed, walk, collar-drag, and recovery
- Custom compact right-click control menu
- System tray show/hide/exit controls
- Settings persistence with JSON storage
- Optional AI chat through user-configured API settings
- Speech bubbles, time-aware lines, and simple reminders
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
release/Asuka Pet Assistant v0.3.0 Preview/
```

The packaged executable is ignored by Git and should be uploaded as a GitHub Release asset instead of committed to the repository.

## Notes

This is a preview build. Animations, dialogue, settings, and AI behavior may continue to change.
