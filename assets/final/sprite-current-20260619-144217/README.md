# Sprite Final Snapshot - 2026-06-19 14:42

This folder is a non-destructive snapshot of the current accepted desktop pet sprite state.

## Final Files

- `pet-spritesheet-final-16rows.png`
  - Current finalized active sprite sheet.
  - Size: 1536x3328
  - Layout: 8 columns x 16 rows
  - Frame size: 192x208
  - Alpha: yes

- `pet-spritesheet-generated-16rows.png`
  - Copy of the generated 16-row sheet at snapshot time.
  - SHA-256 matches `pet-spritesheet-final-16rows.png`.

- `pet-spritesheet-extension-final-7rows.png`
  - Current 7-row extension used for rows 9-15.
  - Size: 1536x1456
  - Layout: 8 columns x 7 rows
  - Alpha: yes

- `pet-spritesheet-original-9rows-backup.png`
  - Current 9-row baseline backup.
  - Size: 1536x1872
  - Layout: 8 columns x 9 rows
  - Alpha: yes

- `sprite-final-key-rows-black-preview.png`
  - Black-background preview of key rows for quick visual checking.

- `sprite-final-manifest.json`
  - Machine-readable file list with dimensions, alpha status, file sizes, and SHA-256 hashes.

## Current Runtime Notes

- The active runtime file in the project root is still `pet-spritesheet.png`.
- `pet-spritesheet.png` currently matches this final 16-row sprite state.
- The original root files were not overwritten by this snapshot; they were copied here.

## Current Tuned Behaviors

- Idle and waving visual scale are slightly reduced to smooth action transitions.
- Original waving row is restored, with playback repeating the middle raised-hand frames.
- Failed animation holds the folded-arms pose for about 1 second.
- Review animation uses the revised row with the abrupt waist-twist frame removed.
- Drag collar animations use A/B random variants.
