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

## Packaging & Releases

Packaging for production uses `electron-builder`:

```bash
# Package for current platform (generates .deb, .AppImage, and unpacked directory on Linux)
npm run package
```

Built release artifacts will be placed in `dist/`:
- `dist/CampusDeck-<version>.AppImage`: Standalone, portable Linux executable
- `dist/campusdesk_<version>_amd64.deb`: Debian/Ubuntu installer package
- `dist/linux-unpacked/`: Unpacked application binary folder for direct execution

> [!NOTE]
> Release packaging and automated test suites have been verified on Linux (Ubuntu/Mint, kernel 7.0.0-42-generic x86_64). Other operating systems have not been tested.

---

## Backup & Restore Architecture

CampusDeck provides manual full backup and safe atomic restore directly within **Settings**:

### Backup Export
- **Online SQLite Snapshot**: Uses `better-sqlite3`'s native `.backup()` API to ensure transactionally consistent SQLite snapshots without stopping the database.
- **Archive Contents**:
  - `campusdesk.db`: Complete SQLite database snapshot
  - `manifest.json`: Metadata with format version, schema version, creation timestamp, and SHA-256 hashes for every file
  - `library/`: All managed subject documents, assignment prompts, and solution variants
- **Portability**: Standard `.zip` format safe for external flash drives, NAS, or machine migration.

### Safe Atomic Restore Pipeline
1. **Archive Validation**: Verifies ZIP integrity, rejects malformed archives, enforces schema compatibility, and blocks any path traversal entries (`../`, absolute paths, null bytes).
2. **Staged Extraction & Checksum Verification**: Extracts all assets into an isolated staging directory (`<userData>/campusdesk_storage/staging_restore_*`) and computes SHA-256 checksums matching `manifest.json`.
3. **Rollback Protection & Atomic Swap**:
   - Closes active SQLite database handle.
   - Copies current database and library into a rollback directory (`<userData>/campusdesk_storage/rollback_*`).
   - Atomically replaces active database and library files.
   - Reopens SQLite database, runs pending migrations if necessary, and rebinds IPC proxies.
   - If any step fails during the swap, the previous database and library are restored automatically.

---

## Limitations

1. **Single Profile / Single Vault**: CampusDeck is tailored for a single student user per operating system user account.
2. **Local Storage Security**: Data and files are stored in the user's home directory (`~/.config/CampusDeck/campusdesk_storage/`) unencrypted at rest. Disk encryption (such as LUKS or FileVault) is recommended for hardware-level security.
3. **Strictly Offline**: The Content Security Policy (`connect-src 'none'`) enforces an air-gapped security model. No cloud synchronization or multi-device sync is built in.
4. **Platform Verification**: Release packaging and tests are verified on Linux x86_64.

---

## Data Recovery Guide

In the event of accidental file deletion, corrupted data, or system crashes, data can be recovered manually:

### Scenario A: Recovering from a Backup ZIP
1. Rename the backup file from `.zip` to a regular archive and extract it:
   ```bash
   unzip campusdesk_backup_<timestamp>.zip -d /tmp/recovered_campusdeck/
   ```
2. Locate the database `campusdesk.db` and the `library/` folder.
3. Stop CampusDeck and copy them to your application data directory:
   ```bash
   cp /tmp/recovered_campusdeck/campusdesk.db ~/.config/CampusDeck/campusdesk_storage/campusdesk.db
   cp -r /tmp/recovered_campusdeck/library/* ~/.config/CampusDeck/campusdesk_storage/library/
   ```

### Scenario B: Recovering from a Rollback Directory
If a restore operation was interrupted or aborted:
1. Check `<userData>/campusdesk_storage/` for directories named `rollback_*`.
2. The `rollback_*` folder contains the exact snapshot of your database and library taken immediately before the restore attempt.
3. Copy `campusdesk.db` and `library/` back to `<userData>/campusdesk_storage/`.

### Scenario C: Direct SQLite Inspection
Because CampusDeck uses standard, non-proprietary SQLite:
```bash
sqlite3 ~/.config/CampusDeck/campusdesk_storage/campusdesk.db
sqlite> SELECT id, title, type, status, due_date FROM tasks;
sqlite> SELECT id, name, code FROM subjects;
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
