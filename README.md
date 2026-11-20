# SheetKanban

A glassmorphic, Trello-style Kanban pipeline app with full-bleed custom wallpapers — built to work interactively with **Google Sheets** and **Excel (`.xlsx` / `.csv`)** while keeping all your data 100% private in your browser and your own spreadsheets.

## Features

- **6-Stage Drag-and-Drop Pipeline**: `Leads`, `Contacted`, `In Process`, `Waiting Approval`, `Done`, and `Lost` with intra-column card reordering, search, type filters, city filters, and live deal-value (`$`) rollups.
- **Interactive Excel (`.xlsx` / `.csv`) File Sync**:
  - Connect a local `.xlsx` or `.csv` file via the browser File System Access API (Chrome / Edge) to edit cards on the board and write updates directly back to disk in 1 click.
  - Full `.xlsx` & `.csv` import/export and copy-paste TSV (`A1`) support on all browsers.
- **Google Sheets Integration**:
  - Pull live rows from any Published-to-Web CSV link.
  - Built-in copyable 20-line **Google Apps Script** bridge for 2-way Pull & Push with private Google Sheets.
- **Wallpaper Studio**:
  - Built-in high-resolution scenic & dark-glass wallpapers plus minimal gradients.
  - Upload your own high-res wallpaper (persisted in `IndexedDB`) or paste an image URL.
  - Live **Backdrop Dimming** and **Column Glass Blur** sliders.
- **One-Click Desktop App Mode (Windows)**:
  - Launches silently in Chrome/Edge standalone app window (`--app=...`) with zero terminal flicker and its own Desktop & Start Menu icon.

## Quick Start

```bash
npm install
npm run build
npm start
```

Open `http://127.0.0.1:5173/` and click **Sheets / Excel** to connect your Google Sheet or Excel workbook.

## One-Click Windows App Shortcut

After running `npm install && npm run build`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-shortcut.ps1
```

This creates a **SheetKanban** icon on your Desktop and Start Menu. Double-clicking it starts the local server silently in the background (if not already running) and opens SheetKanban in a standalone desktop window. You can also right-click the shortcut and choose **Pin to taskbar**.

## Privacy

This repository contains **only the application code** — zero personal data, zero hardcoded spreadsheet IDs, and `.gitignore` blocks all `.csv`, `.xlsx`, `.xls`, and `local-data/` files. All board state stays locally in your browser (`localStorage` / `IndexedDB`) and the spreadsheet files you explicitly connect.

## License

MIT
