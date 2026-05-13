# Anchor Point Resource Portal - V1.3 Anchor UI

Static GitHub Pages resource portal using the corrected Summary Tab JSON and Anchor Point visual system.

## What changed in V1.3

- Rebuilt the UI as a true command-center app shell.
- Added Anchor Point themed imagery to `assets/img/`.
- Added cache-busting query strings for CSS and JS.
- Made search, filters, selected guide tray, and guide builder more compact.
- Reworked print output into a dense table layout for multi-resource handouts.
- Kept all logic client-side. No caller data is stored.

## Files

- `index.html` - command center home
- `resources.html` - searchable resource browser
- `guide.html` - caller guide builder
- `data/resources.json` - corrected resource data
- `data/resources_metadata.json` - metadata
- `assets/css/styles.css` - Anchor UI styling
- `assets/js/app.js` - client-side search, filters, selection, guide and print logic
- `assets/img/` - Anchor Point themed visual assets

## GitHub Pages

Upload the contents of this folder to the repository root and publish GitHub Pages from `main` and `/root`.

After pushing updates, hard refresh the live site with `Ctrl + F5`.
