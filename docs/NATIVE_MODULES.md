# Native Module ABI Architecture (`better-sqlite3`)

CampusDeck uses SQLite via `better-sqlite3`, a high-performance native C++ Node module.

Because CampusDeck runs in two distinct JavaScript runtimes during development, native modules must be compiled against the ABI of the target environment:

| Environment | Runtime | Runtime Version | Native Module Version (ABI) | Target Command |
|---|---|---|---|---|
| **Automated Tests** | Node.js | v22.23.4 | **127** | `npm run rebuild-node` |
| **Desktop Application** | Electron | v33.4.11 | **130** | `npm run rebuild-electron` |

---

## 1. Quick Workflow

### Running the Electron App (Development / Preview)

Before starting the desktop application with `npm run dev`:

```bash
npm run rebuild-electron
npm run dev
```

`rebuild-electron` executes `electron-rebuild -f -w better-sqlite3`, targeting Electron ABI 130.

---

### Running Automated Tests (Vitest)

Before running tests with `npm test`:

```bash
npm run rebuild-node
npm test
```

`rebuild-node` executes `npm rebuild better-sqlite3 --runtime=node`, targeting host Node ABI 127.

---

## 2. Understanding the ABI Mismatch Error

If `better-sqlite3` is built for one runtime and invoked in the other, you will see an error similar to:

### Case A: Running `npm run dev` after running tests
```text
UnhandledPromiseRejectionWarning: Error: The module '.../better_sqlite3.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 127. This version of Node.js requires
NODE_MODULE_VERSION 130.
```
**Fix**:
```bash
npm run rebuild-electron
npm run dev
```

### Case B: Running `npm test` after running `npm run dev`
```text
Error: The module '.../better_sqlite3.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 130. This version of Node.js requires
NODE_MODULE_VERSION 127.
```
**Fix**:
```bash
npm run rebuild-node
npm test
```

---

## 3. Production Packaging Pipeline

During production packaging (`npm run package`), the build script automatically rebuilds `better-sqlite3` for Electron before running `electron-builder`:

```json
"package": "npm run build && npm run rebuild-electron && electron-builder"
```

This guarantees that distributable packages (AppImage, `.deb`) always bundle the correct Electron ABI 130 native binary.

---

## 4. Architectural Invariant (D-016)

Do **not** attempt to bypass ABI mismatches by changing application code, importing dynamic mocks in production, or running Vitest under custom loaders. 

Keeping Vitest running in native Node (ABI 127) gives lightning-fast unit and repository test execution (~8 seconds for 138 tests), while Electron maintains the full desktop runtime (ABI 130). Switching between them takes only a single rebuild command.
