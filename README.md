# CampusDesk

A local-first desktop application for students to manage academic tasks, coursework, subject documents, and files entirely on their own machine. No server, cloud account, telemetry, or network dependency is required.

---

## Fixed Technology Stack

- **Desktop Runtime**: Electron 33 (Chromium + Node.js)
- **Bundler & Dev Server**: electron-vite (Vite 5 + HMR)
- **UI Framework**: React 18 with TypeScript in strict mode
- **Styling & Icons**: Tailwind CSS 3.4 (dark mode via `class` strategy) + Lucide Icons
- **Embedded Database**: SQLite via `better-sqlite3` with versioned, ordered migrations
- **Local File Library**: App-managed local storage with unique UUID prefixes and relative path tracking
- **Security Boundary**: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, restrictive Content Security Policy, and narrow typed `contextBridge` IPC

---

## Persistent Storage Layout

Persistent application data is stored in a dedicated directory beneath Electron's `userData` directory (e.g. `~/.config/CampusDeck/campusdesk_storage/` on Linux):

```
<userData>/campusdesk_storage/
├── campusdesk.db         # Embedded SQLite database (WAL mode, foreign keys enabled)
├── library/              # App-managed local file library (imported PDFs with UUID prefixes)
└── backups/              # Scheduled SQLite snapshot backups
```

---

## Development Setup

### Prerequisites
- Node.js LTS (v22.x recommended)
- npm (v10.x+)

If Node.js is managed via `fnm`:
```bash
export FNM_DIR=~/.local/share/fnm
eval "$(~/.local/bin/fnm env --fnm-dir ~/.local/share/fnm)"
fnm use 22
```

### Installation
```bash
npm install
```

### Development Server
```bash
npm run dev
```

### Type Checking
```bash
npm run typecheck
```

### Automated Repository & Migration Tests
```bash
npm test
```

### Production Build
```bash
npm run build
```

---

## Documentation

Full architectural specifications and decision logs are located in the `docs/` directory:
- [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md): Core functional requirements and acceptance criteria
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): Multi-process isolation, IPC contracts, and security architecture
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md): Normalized relational SQLite schema and queries
- [`docs/DECISIONS.md`](docs/DECISIONS.md): Architectural decision records and stable invariants
- [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md): Current implementation state and stage milestones
- [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md): Multi-tier test strategy and verification plans
