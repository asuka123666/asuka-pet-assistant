# Asuka Pet Assistant Project Notes

## Daily Commands

```powershell
npm.cmd start
npm.cmd run check
npm.cmd run build
```

## Core Runtime Files

Keep these files in the project root:

- `main.js`
- `renderer.js`
- `index.html`
- `style.css`
- `templates/bubbles.js`
- `templates/chat-bubble.js`
- `templates/control-menu.js`
- `templates/reminder.js`
- `templates/settings.js`
- `templates/widget.js`
- `package.json`
- `package-lock.json`
- `pet-spritesheet.png`
- `icon.ico`

Runtime responsibilities:

- `main.js` owns Electron windows, tray controls, settings persistence, reminders, speech/status/chat bubbles, AI API calls, single-instance protection, startup registration, and app lifecycle.
- `renderer.js` owns sprite timing, animation fallback, click/double-click/drag/head-pat/poke/proximity/edge interactions, emotion state, random idle/walk behavior, and local resource sampling.
- `index.html` should remain a small shell. Complex behavior belongs in `renderer.js` or later split modules.
- `style.css` should stay focused on the pet surface and resource dock styles.
- `templates/bubbles.js` owns the status and speech bubble HTML only.
- `templates/chat-bubble.js` owns the chat bubble HTML only; chat requests stay handled by `main.js`.
- `templates/control-menu.js` owns the right-click control menu HTML only; IPC action names stay handled by `main.js` and `renderer.js`.
- `templates/reminder.js` owns the reminder window HTML only; reminder scheduling stays in `main.js`.
- `templates/settings.js` owns the settings window HTML only; settings persistence and API testing stay in `main.js`.
- `templates/widget.js` owns the time and weather widget HTML only; widget lifecycle stays in `main.js`.

## Sprite Files

- `pet-spritesheet.png` is the active sprite sheet used by the app.
- `pet-spritesheet-original-9rows-backup.png` is the original 9-row backup.
- `pet-spritesheet-extension.png` is the 7-row extension used by `merge-spritesheet.js`.
- `pet-spritesheet-16rows.png` is the merged 16-row output.
- `pet-spritesheet-extension-rows16-22.png` is the 7-row interaction extension used by `merge-spritesheet.js`.

Current expected dimensions:

- Original backup: `1536x1872`
- Extension: `1536x1456`
- Interaction extension: `1536x1456`
- Active 23-row sheet: `1536x4784`
- Stable 16-row sheet: `1536x3328`
- Frame size: `192x208`

## Sprite Tools

- `merge-spritesheet.js` merges the original 9 rows, the collar-drag 7-row extension, and the interaction 7-row extension into the active 23-row sheet.
- `convert-equal-cells-extension.js` converts an 8x7 equal-cell source image into the required 7-row extension format.
- `process-new-action-rows.js` prepares generated interaction rows before they are merged into the active sheet.
- `check-project.js` checks JavaScript syntax, package/build settings, required files, and required PNG dimensions.

## Project Boundary

This folder currently also contains unrelated or generated material. Treat the following as non-runtime unless a task explicitly says otherwise:

- `dist/` and `release/` packaged app outputs.
- `marketing/` promotional videos, posts, and HyperFrames material.
- `figs/`, `office-inbox/`, `office-outbox/`, `output/`, `_review_sheets/`, Office files, and Gemini bookmarklet/userscript files.

The Electron build only packages the files listed in `package.json` under `build.files`.

## Minimal Change Order

Prefer this order for future changes:

1. Update docs/checks when the project boundary or workflow changes.
2. Fix focused bugs in `main.js` or `renderer.js` without changing unrelated interactions.
3. Split inline HTML templates out of `main.js` only after a smoke test baseline is clear.
4. Consider preload/context isolation after the current behavior is covered by manual or automated checks.

## Archive Folders

- `assets/archive/` contains old sprite experiments and backups.
- `assets/generated/` contains generated sprite previews or intermediate outputs.
- `tools/archive/` contains old helper scripts kept for reference.

These archive folders are ignored by Git.
