# Changelog

All notable changes to `frappe-frontend-cli` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-10-26

Initial production-ready release of `frappe-frontend-cli` for the Frappe Framework developer ecosystem.

### Added

#### Phase 1: Foundation & Diagnostics
- **Subprocess Runner**: Hardened `Runner` subprocess gateway with argument validation, NUL-byte rejection, process-group detachment, timeout enforcement, buffer limiting, and clean signal (`SIGINT`, `SIGTERM`) propagation.
- **Environment Diagnostics (`doctor`)**: Fact-gathering and pure functional evaluation reporting OS, CPU architecture, Node.js version, package managers (npm, pnpm, yarn, bun), Git version, and Frappe bench presence.
- **Machine-Readable Output**: Strict stream discipline with `--json` flag emitting clean JSON on `stdout`.
- **Validation Library**: Robust project naming and target directory checks preventing accidental overwrites.

#### Phase 2: Vue & React Framework Adapters
- **Vue 3 Adapter**: Scaffolds Vue 3 (`^3.5.13`) + Vite 6 projects with TypeScript (`--ts`) or JavaScript (`--js`).
- **React Adapter**: Scaffolds React (`^18.3.1`) + Vite 6 projects with TypeScript or JavaScript.
- **Development Proxy**: Built-in Vite proxy configuration for Frappe backend endpoints (`/api`, `/assets`, `/files`).

#### Phase 3: CSS Tooling Adapters
- **Tailwind CSS v4**: Scaffolds standard Vite projects with `@tailwindcss/vite` plugin and modern CSS import syntax without requiring PostCSS or `tailwind.config.js`.
- **Tailwind CSS v3**: Dedicated compatibility path using `postcss`, `autoprefixer`, and `tailwind.config.js` for Frappe UI integration.
- **Bootstrap 5**: Integrates Bootstrap (`^5.3.3`) and `@popperjs/core` into Vite projects.
- **Sass / SCSS**: Configures `sass-embedded` with native Vite integration and stylesheet migration.
- **Conflict Prevention**: Hard refusal to mix Tailwind v3 and v4 in the same project.

#### Phase 4: Frappe UI Adapter & Setup Wizard
- **Frappe UI Adapter**: Scaffolds production-tested Vue 3 + Frappe UI (`frappe-ui`) projects with Tailwind CSS v3 compatibility, Lucide Vue Next, and Feather icons.
- **Interactive Setup Wizard (`init`)**: Terminal wizard for step-by-step framework, styling, and Frappe backend configuration. Supports `--non-interactive` (`-y`) mode for automated CI/CD pipelines.

#### Phase 5: Frappe Custom App Integration & Diagnostics
- **Custom App Integration (`integrate frappe`)**: Connects frontend SPAs to Frappe custom apps, updating `hooks.py` `website_route_rules` with client-side SPA routing, generating `www/<route>.py` portal controller with session boot and CSRF tokens, and `www/<route>.html` Jinja SPA template.
- **Health Diagnostics (`check`)**: Project-level and custom app inspection diagnosing frameworks, CSS setups, missing `node_modules`, proxy rules, hooks configuration, and missing assets.
- **Backup & Rollback Safeguards**: Automatic timestamped `.bak` backup generation and printed shell commands for exact reversal.

#### Phase 6: Production Hardening, Multi-App Support & Desk Pages
- **Multi-App Bench Support**:
  - `findBenchApps()` discovers all apps and custom apps inside a Bench root.
  - `validateFrappeApp()` validates target custom apps and requires explicit `--app <name>` when multiple custom apps are available in Bench, preventing accidental integration into the wrong app.
- **Monorepo Workspace Detection**:
  - Detects npm workspaces, pnpm workspaces (`pnpm-workspace.yaml`), and Turborepo (`turbo.json`).
  - Reports workspace package counts and root configurations in `doctor` and `check`.
- **Asset Collision Prevention**:
  - Added `--output-dir <dir>` option to scope Vite build output (`public/<outputDir>`) and base path (`/assets/<app>/<outputDir>/`), ensuring multiple frontend SPAs in the same Bench or app do not collide.
- **Vite Build Manifest Support**:
  - Automatically enables `build.manifest: true` in Vite configuration.
  - Verifies presence of `.vite/manifest.json` or `manifest.json` for cache-busting-safe asset resolution.
  - `check` diagnostic reports manifest status and missing manifest warnings.
- **Bundle Size Diagnostics**:
  - Analyzes production chunk sizes in output directories.
  - Emits advisory warnings in `check` when any JavaScript chunk exceeds 500 KB, with actionable recommendations for dynamic `import()` route splitting and `manualChunks`.
- **Frappe Desk Page Integration (`integrate desk` / `--mode desk`)**:
  - Scaffolds Frappe Desk Page DocType JSON (`<page>.json`) with `standard: "Yes"`, `module`, and `title`.
  - Scaffolds Frappe Desk Page JavaScript controller (`<page>.js`) using `frappe.pages['<page>'].on_page_load(wrapper)` and `frappe.ui.make_app_page()`.
  - Mounts frontend SPA cleanly inside Desk wrapper (`<div id="<page>-app"></div>`) and loads production bundle via `frappe.require()`.
  - Keeps Desk Page routes (`/app/<page>`) completely separated from public website portal routes (`www/`).
- **Release Verification**:
  - Isolated tarball packaging and global installation test (`npm run test:pack`) verified via `npx` and global sandbox execution.
