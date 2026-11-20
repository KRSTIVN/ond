<div align="center">

<img src="public/icon.svg" alt="OND Logo" width="88" height="88" />

# OND

**A local-first, glassmorphic desktop workspace with custom wallpapers — combining Google Sheets & Excel Kanban, Temporal Calendar, Markdown Notes, and a Scientific & Profession-Formula Calculator.**

[![React 19](https://img.shields.io/badge/React-19-0f172a?style=for-the-badge&logo=react&logoColor=38bdf8)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-0f172a?style=for-the-badge&logo=typescript&logoColor=818cf8)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6-0f172a?style=for-the-badge&logo=vite&logoColor=fbbf24)](https://vite.dev)
[![Excel & Sheets](https://img.shields.io/badge/Sync-Sheets_%26_Excel-0f172a?style=for-the-badge&logo=googlesheets&logoColor=34d399)](#spreadsheet-sync)
[![License: MIT](https://img.shields.io/badge/License-MIT-0f172a?style=for-the-badge&logoColor=f8fafc)](LICENSE)

<br />

<img src="docs/demo.gif" alt="OND live demo — frosted glass Kanban columns, custom wallpapers, stage stepper, and Google Sheets / Excel connector" width="100%" />

</div>

---

## Why I Built This

> **Built for my own daily workflow — open to anyone who wants it.**

This project was shaped around how I actually use **Notion** every day, minus the bloat and rigid layout ceilings. Spreadsheets (**Google Sheets** & **Excel**) are unbeatable for capturing and owning raw data — especially when your AI agent is automatically researching, enriching, and filling your sheets in the background — while a great Kanban board keeps you in full control of human interaction and high-touch decisions where it matters most.

Because I build my own tools, I didn't have to settle for off-the-shelf UI: **OND** pushes past standard board templates with full-bleed atmospheric wallpapers, real-time glassmorphism optics, zero-latency drag-and-drop, and direct spreadsheet write-back — all running locally with **zero backend, zero accounts, and zero lock-in**.

---

## Highlights

| Capability | What It Does |
| :--- | :--- |
| **6-Stage Drag & Drop Kanban** | `Leads` → `Contacted` → `In Process` → `Waiting Approval` → `Done` → `Lost` with intra-column reordering, instant search, type/city filters, and live `$` pipeline rollups. |
| **Temporal Calendar** | Full month grid (`Temporal` API + `Mon`/`Sun` week start), category-coded events (`Focus`, `Meeting`, `Personal`, `Deadline`), day agenda panel, and live **Kanban Follow-up Dates** surfaced right on the calendar grid. |
| **Markdown Notes** | Live split / edit / preview Markdown workspace with safe AST rendering (zero `dangerouslySetInnerHTML`), clickable `- [ ]` checklists, formatting toolbar, pinning, `#tags`, instant search, and `.md` export. |
| **Calculator & Formula Box** | Standard & Scientific modes (`DEG`/`RAD`), safe recursive-descent math parser (zero `eval`), calculation history tape, and **24 one-click Profession Formulas** across 6 disciplines (*Finance & Accounting*, *Architecture & Construction*, *Engineering & Physics*, *Healthcare & Nursing*, *Data & Statistics*, *Software & Cloud*). |
| **Wallpaper Studio** | Curated 16:9 scenic & obsidian-glass backdrops, minimal gradients, **custom image upload** (stored in `IndexedDB` so high-res photos never hit `localStorage` limits), image URLs, plus live **Backdrop Dimming** and **Glass Blur** sliders. |
| **Interactive Excel (`.xlsx` / `.csv`)** | Connect a local `.xlsx` or `.csv` file via the File System Access API (Chrome/Edge) to edit cards visually and **save updates directly back to disk in 1 click**. Also supports standard `.xlsx`/`.csv` import/export and TSV (`A1`) copy-paste. |
| **Google Sheets Live Sync** | Pull from a Published-to-Web CSV link, paste cells directly, or drop in the built-in **Google Apps Script** bridge (with optional shared `API_TOKEN`) for 1-click **Pull & Push** with private Google Sheets. |
| **1-Click Desktop App & Updater** | Silent Windows launcher + Desktop/Start Menu shortcut opens a frameless standalone window (`--app` mode), with a built-in **1-click in-app GitHub updater** in the top bar. |
| **100% Local & Private** | No telemetry, no cloud middleman, no personal data in the repo. `.gitignore` hard-blocks `*.csv`, `*.xlsx`, `*.xls`, and `local-data/`. |

---

## Architecture

```mermaid
flowchart LR
  UI["OND Glassmorphic UI<br/>Kanban · Calendar · Notes · Calculator"] --> Domain["Pure Domain Engines<br/>Strict TS · Temporal · Markdown AST · Math Parser · XLSX/CSV"]
  Domain --> Local["Local Persistence<br/>localStorage + IndexedDB (Wallpapers)"]
  Domain --> Excel["Local Excel / CSV<br/>File System Access API (1-Click Write-Back)"]
  Domain --> Sheets["Google Sheets<br/>Published CSV / Token-Guarded Apps Script"]
```

---

## Quick Start

```bash
git clone https://github.com/KRSTIVN/ond.git
cd ond
npm install
npm run build
npm start
```

Open **`http://127.0.0.1:5173/`** and click **Sheets / Excel** to connect your spreadsheet (or click **Try Sample** to preview with fictional demo cards).

### Install as a 1-Click Windows Desktop App

After building (`npm run build`), run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-shortcut.ps1
```

This installs an **OND** icon on your **Desktop** and **Start Menu**:
- Double-click once → silently boots `server.mjs` (if not already running) with zero console flash → opens **OND** in a clean standalone desktop window.
- Right-click the shortcut → **Pin to taskbar** for single-click access.

---

## Spreadsheet Sync

**OND** auto-maps flexible column headers from any Google Sheet or Excel workbook and preserves your Kanban stages across re-imports:

| Spreadsheet Column | Recognized Header Aliases |
| :--- | :--- |
| **Card Title** *(required)* | `Business Name`, `Business`, `Company`, `Client`, `Title`, `Name` |
| **Stage** | `Status`, `Stage`, `Column`, `Phase` *(auto-maps to the 6 columns)* |
| **Category** | `Category`, `Industry`, `Niche`, `Service` |
| **Location** | `Address`, `Location`, `City` |
| **Contact** | `Phone Number` / `Phone`, `Email`, `Website URL` / `Website` |
| **Tag & Value** | `Lead Type` / `Type` / `Tag`, `Deal Value` / `Value` / `Budget`, `Follow-up Date` |
| **Notes** | `Notes`, `Note`, `Comments`, `Description` |

### Connecting a Private Google Sheet (2-Way Sync)
1. Click **Sheets / Excel** inside the app → expand **View Apps Script** → **Copy Code**.
2. In your Google Sheet, open **Extensions → Apps Script**, paste the snippet, and deploy as a **Web App** (*Execute as: Me*, *Who has access: Anyone*).
3. Paste the deployed `/exec` URL into **OND** for 1-click **Pull** and **Push**.

---

## Tech Stack

- **Frontend**: React 19, TypeScript (`strict: true`), Vite 6, Lucide Icons, native HTML `<dialog>` (`closedby="any"` + fallback), CSS `backdrop-filter` glassmorphism.
- **Workspace Engines**: `temporal-polyfill` (Temporal Calendar API), custom safe Markdown AST renderer (zero `dangerouslySetInnerHTML`), safe recursive-descent scientific & formula math parser (zero `eval`), `read-excel-file` + `write-excel-file` (browser-native `.xlsx`, 0 vulnerabilities).
- **Desktop Runtime**: Zero-dependency Node.js static server + localhost in-app updater (`server.mjs`) + silent WSH/PowerShell launcher (`scripts/`).

---

## License

[MIT](LICENSE) — fork it, customize the columns or wallpapers, and make it yours.
