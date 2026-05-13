# Anchor Point Resource Portal - V1.2 Compact UI

Static GitHub Pages resource portal using the corrected Summary Tab JSON.

## Files

- `index.html` - compact command center home
- `resources.html` - searchable resource database
- `guide.html` - caller guide builder
- `data/resources.json` - corrected resource data
- `data/resources_metadata.json` - metadata
- `assets/css/styles.css` - compact Poly-inspired interface styling
- `assets/js/app.js` - client-side search, selection, guide and print logic

## GitHub Pages

Upload the contents of this folder to your repository root and enable GitHub Pages from the `main` branch, `/root` folder.

## Local testing

Do not open the HTML files with `file://` if testing JSON loading. From this folder run:

```powershell
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

## Privacy

No caller data is stored. Selected resources are saved only in the browser's local storage.
