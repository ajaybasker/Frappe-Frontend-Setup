# Architecture — Frappe Frontend Setup CLI

## 1. Overview and Core Philosophy

`frappe-frontend-cli` is a TypeScript-based Node.js command-line interface designed to streamline frontend development across the Frappe ecosystem. It provides automated, verified project scaffolding, CSS framework integration, Frappe custom app asset delivery conventions, and Desk Page integration.

Following the design principles established in `frappe-setup-cli`:
1. **Simple Commands, Clear Intent**: Provide guided and predictable workflows (`doctor`, `init`, `create`, `add`, `integrate`, `check`).
2. **Deterministic Preflight**: Separate read-only environment fact-gathering from evaluation logic so that all diagnoses are testable as pure functions.
3. **Single Subprocess Gateway**: All child processes execute through a hardened `Runner` that validates arguments, rejects shell injections, sets timeouts, and manages process group lifecycles.
4. **Stream Discipline**: Machine-readable JSON output is sent strictly to `stdout`; diagnostic progress, warnings, and error messages are sent strictly to `stderr`.
5. **Non-Destructive Operations**: The CLI will never overwrite existing files or modify user projects without explicit confirmation and a pre-execution change plan, retaining timestamped `.bak` backups.

---

## 2. System Architecture

```
frappe-frontend-cli (bin/frappe-frontend-cli.js)
  │
  ├── cli/ (Command routing and flags)
  │    ├── index.ts              (CLI definition: --help, --version, command registry)
  │    ├── doctor.ts             (Doctor command execution & output formatting)
  │    ├── create.ts             (Scaffolding runner for Vue, React, Frappe UI, Vanilla)
  │    ├── add.ts                (CSS tooling runner for Tailwind v3/v4, Bootstrap, SCSS)
  │    ├── init.ts               (Interactive setup wizard and non-interactive runner)
  │    ├── integrate.ts          (Frappe custom app portal & Desk Page integration)
  │    └── check.ts              (Project, monorepo, manifest, and bundle diagnostics)
  │
  ├── core/ (Foundation and utilities)
  │    ├── runner.ts             (Hardened subprocess gateway with timeout and signal trapping)
  │    ├── facts.ts              (Read-only environment discovery: OS, Node, PMs, Git, Bench, Workspaces)
  │    ├── evaluator.ts          (Pure diagnostic evaluation logic: facts -> CheckItems)
  │    ├── workspaces.ts         (npm, pnpm, and Turborepo monorepo detection)
  │    ├── frappe-app.ts         (Bench multi-app detection, custom app inspection, hooks validation)
  │    ├── validation.ts         (Safe project naming and non-empty directory protection)
  │    ├── matrix.ts             (Declarative compatibility matrix)
  │    ├── ui.ts                 (Terminal formatting, key-value tables, ANSI styling)
  │    └── types.ts              (Core TypeScript interfaces)
  │
  └── adapters/ (Framework, CSS Tooling & Frappe Adapters)
       ├── frameworks/           (Vue 3, React, Frappe UI, Vanilla)
       ├── css/                  (Tailwind CSS v3/v4, Bootstrap 5, SCSS, Plain CSS)
       └── frappe/               (Inspector, hooks updater, Vite updater, portal & Desk Page generator)
```

---

## 3. Subprocess Gateway (`Runner`)

All external system tools (`node`, `npm`, `pnpm`, `yarn`, `bun`, `git`, `bench`, `vite`) are invoked exclusively through `Runner.run()` or `Runner.capture()`.

### Key Design Constraints:
- **No Shell Interpolation**: Commands are passed strictly as `(file: string, args: string[])` to prevent shell injection vulnerabilities.
- **Process Group Lifetime**: Subprocesses run in detached process groups (`detached: true` on POSIX) so timeouts or cancellation signals (`SIGINT`, `SIGTERM`) terminate the entire process tree rather than leaving orphaned background daemons.
- **Bounded Buffer & Timeouts**: Processes are bounded by default timeouts and capture output safely without unbounded memory growth.
- **Signal Forwarding**: Parent process handles `SIGINT` gracefully and forwards termination to active child processes.

---

## 4. Separation of Fact-Gathering and Evaluation

To guarantee testability and eliminate side-effects during environment analysis:
1. `gatherFacts()` probes the real system (OS, CPU, Node.js version, package managers, Git availability, Frappe bench markers, and monorepo workspace indicators). It returns a raw, serializable `EnvironmentFacts` object.
2. `evaluateEnvironment(facts)` is a **pure function**. It accepts `EnvironmentFacts` and returns a `DoctorReport` consisting of structured `CheckItem` objects (`status: 'ok' | 'warn' | 'fail' | 'missing'`, message, and remediation hint).
3. Tests can supply arbitrary mock `EnvironmentFacts` to verify every edge case (e.g. Node 16, missing Git, unsupported CPU architectures, conflicting package managers, multi-app benches, monorepo workspaces) without modifying the host machine.

---

## 5. Multi-App Bench & Monorepo Support

### Bench Multi-App Discovery
In enterprise or complex Frappe benches, `apps/` frequently contains multiple custom apps alongside standard apps like `frappe` and `erpnext`.
- `findBenchApps(benchDir)` scans `apps/*`, parses each app's `hooks.py`, and categorizes them into standard vs custom apps.
- When multiple custom apps exist, `validateFrappeApp()` requires explicit specification via `--app <name>`, preventing accidental changes to the wrong app.

### Monorepo Workspaces & Turborepo
Frontend projects may reside in monorepo structures (e.g., inside an `apps/` or `packages/` workspace).
- `detectWorkspace(startDir)` traverses ancestors to identify `pnpm-workspace.yaml`, npm `"workspaces"` in `package.json`, and `turbo.json`.
- The CLI detects workspace root paths and package globs without interfering with package manager resolution.

### Asset Collision Prevention
Different frontend SPAs or Desk views can exist in the same Bench or custom app.
- Vite's output path is configurable via `--output-dir <dir>` (defaulting to the route or page name).
- Vite `base` is configured to `/assets/<app>/<output-dir>/` and `build.outDir` is set to `../<app>/public/<output-dir>`, strictly isolating asset outputs and preventing overwriting between multiple SPAs.

---

## 6. Frappe Integration Architecture: Portal vs. Desk Page

Frappe supports two primary paradigms for frontend single-page applications:

### Paradigm A: Public Website Portal (`integrate frappe` / `--mode portal`)
- **Target Audience**: End-users, customers, suppliers (standalone website portal).
- **URL Route**: `http://<site>/<route>` (e.g. `/portal`, `/dashboard`).
- **Mechanism**:
  - `hooks.py`: Adds `website_route_rules` with wildcard subrouting: `{"from_route": "/<route>/<path:app_path>", "to_route": "<route>"}`.
  - Controller: `<app>/www/<route>.py` sets `no_cache = 1`, fetches session context and CSRF token via `frappe.sessions.get_csrf_token()`.
  - Jinja Template: `<app>/www/<route>.html` renders full-screen SPA container with `window.frappe` session data and loads Vite bundles.

### Paradigm B: Frappe Desk Page (`integrate desk` / `--mode desk`)
- **Target Audience**: Internal users, back-office staff, administrators.
- **URL Route**: `http://<site>/app/<page_name>` (e.g. `/app/tickets-dashboard`).
- **Mechanism**:
  - Page DocType JSON: `<app>/<app>/<module>/page/<page>/<page>.json` creates a standard Frappe Page DocType.
  - Page Controller: `<app>/<app>/<module>/page/<page>/<page>.js` hooks into Frappe Desk lifecycle via `frappe.pages['<page>'].on_page_load(wrapper)`.
  - Mount Container: Creates `<div id="<page>-app"></div>` inside `page.main`.
  - Bundle Loading: Invokes `frappe.require('/assets/<app>/<output-dir>/main.js')`.
- **Isolation**: Does not touch `www/` or `website_route_rules`. Desk pages live strictly inside Frappe's administrative SPA.

---

## 7. Production Asset Delivery & Build Manifests

- **Vite Build Manifest**: Injects `build.manifest: true` in `vite.config.ts`, generating `.vite/manifest.json`. This provides deterministic mapping from entry source files to content-hashed output files.
- **Hashed Assets**: Emits content-hashed filenames for JavaScript and CSS bundles, ensuring safe browser cache invalidation.
- **Bundle Diagnostics**: `check` inspects emitted bundle sizes and emits an advisory if any chunk exceeds 500 KB, recommending route-level code splitting via dynamic `import()`.
- **Caching Discipline**: HTTP caching headers (`Cache-Control: public, max-age=31536000, immutable`) must be configured at the reverse proxy (Nginx) level for `/assets/`, not inside Vite or the frontend bundler.
