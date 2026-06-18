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
- `package.json`
- `package-lock.json`
- `pet-spritesheet.png`

## Sprite Files

- `pet-spritesheet.png` is the active sprite sheet used by the app.
- `pet-spritesheet-original-9rows-backup.png` is the original 9-row backup.
- `pet-spritesheet-extension.png` is the 7-row extension used by `merge-spritesheet.js`.
- `pet-spritesheet-16rows.png` is the merged 16-row output.

Current expected dimensions:

- Original backup: `1536x1872`
- Extension: `1536x1456`
- Active 16-row sheet: `1536x3328`
- Frame size: `192x208`

## Sprite Tools

- `merge-spritesheet.js` merges the original 9 rows and the 7-row extension.
- `convert-equal-cells-extension.js` converts an 8x7 equal-cell source image into the required 7-row extension format.
- `check-project.js` checks JavaScript syntax and required PNG dimensions.

## Archive Folders

- `assets/archive/` contains old sprite experiments and backups.
- `assets/generated/` contains generated sprite previews or intermediate outputs.
- `tools/archive/` contains old helper scripts kept for reference.

These archive folders are ignored by Git.
