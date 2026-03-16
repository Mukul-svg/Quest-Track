# Tracker Web v2

Notion-like tracker for your Go roadmap.

## What it includes

- React UI with inline editable task table
- Select dropdowns for status/type/difficulty/phase
- Click task title to open the linked tracker page
- Checklist toggling on task page (`- [ ]` and `- [x]`) with SQLite persistence
- SQLite-backed API that imports CSV + markdown pages from your existing tracker files

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Production run

```bash
npm install
npm run build
npm start
```

Open http://localhost:3000
