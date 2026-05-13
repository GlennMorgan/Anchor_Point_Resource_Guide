# Anchor Point Resource Portal - Tech UI V1.1

Static GitHub Pages site for Anchor Point call center resource lookup and quick guide generation.

## Files

```text
anchor-point-resources/
├── index.html
├── resources.html
├── guide.html
├── data/
│   ├── resources.json
│   └── resources_metadata.json
├── assets/
│   ├── css/styles.css
│   └── js/app.js
└── README.md
```

## Features

- Polished command-center style UI
- Search and filter resource records
- Filter by category, urgency, population, and location
- Select resources for a caller guide
- Copy individual resources
- Copy caller-facing resource guide
- Copy internal call note
- Print guide
- Uses only static files, no backend required
- Stores selections only in the browser using local storage

## GitHub Pages

Upload the contents of this folder to the repository root, then enable GitHub Pages from the repository settings.

## Local testing

Do not open the HTML files directly with `file:///`. JavaScript fetches the JSON data file, which browsers often block from local files.

Use:

```powershell
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/resources.html
```

## Updating data

Replace `data/resources.json` and `data/resources_metadata.json` with the newest exported files. The website reads those files at load time.
