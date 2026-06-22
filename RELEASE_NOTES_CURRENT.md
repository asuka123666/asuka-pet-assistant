# Asuka Pet Assistant - Current Preview Snapshot

Date: 2026-06-21
Version: 0.5.1 Preview

## Highlights

- Reworked the resource card into a tucked-away collapsible monitor instead of a permanent card under the pet.
- Shows CPU, memory, system disk, and GPU usage with live percentage bars.
- Added an animated liquid-style resource bubble with size, opacity, percent, GPU, and pressure reminder settings.
- Added resource bubble position controls and clearer settings sections.
- Added drag-to-place behavior for the collapsed resource bubble, with the custom position saved in Settings.
- Smoothed the liquid fill animation and added a subtle hover response while keeping the bubble transparent and shadowless.
- Tightened the expanded resource panel so click-to-expand feels less bulky.
- Improved the GPU row with GPU type labels, VRAM percentage when Windows exposes it, and a quiet fallback state when usage cannot be read.
- Added single-instance launch protection so the desktop shortcut focuses the existing pet instead of opening duplicates.
- Resource pressure can affect the emotion system and occasionally trigger pet dialogue.
- Added Settings and tray menu toggles for the resource card.
- Main pet window now resizes automatically when the resource card is enabled or disabled.
- Right-click menu toggles now show clear `开` / `关` state text for random walk and quiet mode.
- Activated the new interaction sprite rows for head pats, poke reactions, proximity looks, edge peeks, bottom sitting, sleep wakeups, and happy nods.
- Keeps the existing desktop pet interactions, AI chat entry, reminders, tray controls, and portable build flow.

## Build Command

```powershell
npm.cmd run build
```

Expected output:

`dist/Asuka Pet Assistant-0.5.1-portable.exe`

## Quick Smoke Test

- Launch the app and confirm only one instance stays running when the shortcut is opened twice.
- Confirm CPU, MEM, DSK, and GPU percentages update in the expanded resource panel.
- Toggle the resource bubble, GPU monitor, percent text, size, opacity, and position from Settings.
- Drag the collapsed resource bubble to a custom spot, restart, and confirm the spot is remembered.
- Confirm the GPU row shows utilization and VRAM when available, or stays in the quiet fallback state when unavailable.
- Single click, double click, drag, right-click menu, chat entry, and reminders still work.
- Check head-pat, poke, proximity, edge, bottom-sit, sleep-wake, and happy-nod moments for the new row animations.

## Notes

- This is still a preview build.
- AI chat requires user-configured API settings.
- The embedded resource card reads local system data only and does not require network access.
