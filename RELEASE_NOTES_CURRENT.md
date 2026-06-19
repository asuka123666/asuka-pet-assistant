# Asuka Pet Assistant - Current Stable Snapshot

Date: 2026-06-19
Version: 0.2.0

## Stable Sprite Snapshot

Current accepted sprite snapshot:

`assets/final/sprite-current-20260619-144217`

Active runtime sprite:

`pet-spritesheet.png`

The active runtime sprite matches:

`assets/final/sprite-current-20260619-144217/pet-spritesheet-final-16rows.png`

## Current Behavior

- Transparent frameless always-on-top desktop pet window.
- Tray menu supports show, hide, random walk toggle, quiet mode toggle, startup toggle, and exit.
- Settings persist through `pet-settings.json` under Electron `userData`.
- Click plays waving.
- Double-click plays jumping.
- Rapid clicks trigger failed.
- Hold or drag starts collar-drag behavior.
- Collar drag uses A/B random variants.
- Drag release returns through bounce/recovery.
- Review action uses revised 5-frame row with the abrupt waist-twist frame removed.
- Failed action holds the folded-arms pose for about 1 second.
- Idle and waving are visually scaled to 0.97 for smoother transitions.

## Build Command

```powershell
npm.cmd run build
```

Expected output:

`dist/Asuka Pet Assistant-0.2.0-portable.exe`

Current build output:

- File: `dist/Asuka Pet Assistant-0.2.0-portable.exe`
- Size: `274854730` bytes
- SHA-256: `D247CB99804BF18B1232DBDAD4D8F1E870A24B5809CA7DA98CD2BC12664B5B49`
- Built at: 2026-06-19 15:11

## Quick Smoke Test

- Launch portable exe.
- Single click: waving.
- Double click: jumping.
- Rapid click: failed.
- Hold or drag: collar drag animation.
- Right-click menu: review, failed, walk, hide to tray, exit.
- Tray menu: show, hide, toggles, exit.

## Notes

- Current waving row is restored to the original artwork, with playback repeating the middle raised-hand frames.
- Experimental sprite files are archived under `assets/archive/sprite-experiments`.
- No AI chat UI redesign or packaging configuration changes are part of this snapshot.
