# Asuka Pet Assistant - Current Preview Snapshot

Date: 2026-06-20
Version: 0.4.0 Preview

## Highlights

- Embedded a compact resource card directly under the desktop pet.
- Shows CPU, memory, and system disk usage with live percentage bars.
- Resource pressure can affect the emotion system and occasionally trigger pet dialogue.
- Added Settings and tray menu toggles for the resource card.
- Main pet window now resizes automatically when the resource card is enabled or disabled.
- Keeps the existing desktop pet interactions, AI chat entry, reminders, tray controls, and portable build flow.

## Build Command

```powershell
npm.cmd run build
```

Expected output:

`dist/Asuka Pet Assistant-0.4.0-portable.exe`

## Quick Smoke Test

- Launch the app and confirm the resource card appears below the pet.
- Confirm CPU, MEM, and DSK percentages update every few seconds.
- Toggle the resource card from Settings and from the tray menu.
- Single click, double click, drag, right-click menu, chat entry, and reminders still work.

## Notes

- This is still a preview build.
- AI chat requires user-configured API settings.
- The embedded resource card reads local system data only and does not require network access.
