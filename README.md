# Frappe Frontend Setup CLI (`frappe-frontend-cli`)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green.svg)](https://nodejs.org/)

**Automated, verified frontend setup for the Frappe Framework ecosystem.**

`frappe-frontend-cli` simplifies initializing, configuring, integrating, and diagnosing modern frontend stacks (Vue, React, Frappe UI, Tailwind CSS, Bootstrap) for Frappe applications.

---

## Quick Start

Run the environment doctor check without installing:

```bash
npx frappe-frontend-cli doctor
```

Display help and available commands:

```bash
npx frappe-frontend-cli --help
```

---

## Implemented Commands

| Command | Description | Status |
| :--- | :--- | :--- |
| `frappe-frontend-cli --help` | Display formatted usage instructions and commands | **Implemented** |
| `frappe-frontend-cli --version` | Display current package version | **Implemented** |
| `frappe-frontend-cli doctor` | Diagnose environment (Node, PMs, Git, Bench, Workspaces, OS) | **Implemented** |
| `frappe-frontend-cli doctor --json` | Output machine-readable diagnostic facts to stdout | **Implemented** |
| `frappe-frontend-cli create vue <name>` | Scaffold, install, and verify a Vue 3 + Vite project | **Implemented** |
| `frappe-frontend-cli create react <name>` | Scaffold, install, and verify a React + Vite project | **Implemented** |
| `frappe-frontend-cli create frappe-ui <name>` | Scaffold, install, and verify a Frappe UI + Tailwind v3 project | **Implemented** |
| `frappe-frontend-cli add tailwind` | Configure Tailwind CSS v4 or v3 in a Vite project | **Implemented** |
| `frappe-frontend-cli add bootstrap` | Configure Bootstrap 5 in a Vite project | **Implemented** |
| `frappe-frontend-cli add scss` | Configure SCSS (sass-embedded) in a Vite project | **Implemented** |
| `frappe-frontend-cli init` | Interactive setup wizard for standalone or in-tree apps | **Implemented** |
| `frappe-frontend-cli integrate frappe` | Connect frontend with custom app portal routing, hooks, and asset delivery | **Implemented** |
| `frappe-frontend-cli integrate desk` | Scaffolds Frappe Desk Page DocType and controller mounting SPA in Frappe Desk | **Implemented (Phase 6)** |
| `frappe-frontend-cli check` | Inspect project, monorepo workspaces, manifests, bundle sizes, & Frappe app | **Implemented (Phase 6)** |

---

## Interactive Setup Wizard (`init`)

Launch the interactive guided wizard:

```bash
npx frappe-frontend-cli init
```

The wizard guides developers through:
1. Choosing setup mode: Standalone Vite project or in-tree Frappe custom app.
2. Validating the custom app directory structure (detecting `hooks.py`, `pyproject.toml`, and bench location).
3. Selecting framework (Frappe UI, Vue 3, React, or Vanilla Vite).
4. Selecting compatible styling solutions (Tailwind CSS v4, Tailwind CSS v3, Bootstrap 5, SCSS).
5. Selecting an available package manager (npm, pnpm, yarn, bun).
6. Configuring the Frappe backend URL for Vite development proxy (`/api`, `/assets`, `/files`).
7. Reviewing configuration summary and confirming before modifying any files.

### Non-Interactive Automation

For CI/CD or scripting, pass `--non-interactive` (or `-y` / `--yes`):

```bash
# Standalone Frappe UI project
npx frappe-frontend-cli init --non-interactive --name my-app --framework frappe-ui --ts

# Configure frontend inside an existing Frappe custom app
npx frappe-frontend-cli init --non-interactive --mode frappe-app --app my_custom_app --framework frappe-ui --backend-url http://127.0.0.1:8000
```

---

## Project Creation (`create`)

```bash
# Create Frappe UI project (Vue 3 + Tailwind CSS v3)
npx frappe-frontend-cli create frappe-ui my-frappe-ui-app

# Create Frappe UI project with custom backend proxy target
npx frappe-frontend-cli create frappe-ui my-frappe-ui-app --backend-url http://my-frappe:8000

# Create Vue 3 + Vite project (TypeScript default)
npx frappe-frontend-cli create vue my-vue-app

# Create React + Vite project in JavaScript
npx frappe-frontend-cli create react my-react-app --js
```

**Options:**
- `--ts`: Use TypeScript template (sensible default).
- `--js`: Use JavaScript template.
- `--package-manager <npm|pnpm|yarn|bun>`: Package manager to use (defaults to detected preferred manager).
- `--backend-url <url>`: Frappe backend proxy URL (default: `http://127.0.0.1:8000`).
- `--skip-install`: Generate files without running package manager install.
- `--skip-build`: Install dependencies without running production verification build.

---

## Adding CSS Frameworks & Tooling (`add`)

Execute inside an existing Vue or React Vite project:

```bash
# Add modern Tailwind CSS v4 (@tailwindcss/vite)
npx frappe-frontend-cli add tailwind

# Add Tailwind CSS v3 (compatibility mode for Frappe UI)
npx frappe-frontend-cli add tailwind --v3

# Add Bootstrap 5
npx frappe-frontend-cli add bootstrap

# Add SCSS support (migrates style.css to style.scss)
npx frappe-frontend-cli add scss
```

**Options:**
- `--v4`: Configure Tailwind CSS v4 (default).
- `--v3`: Configure Tailwind CSS v3 compatibility mode (`postcss`, `autoprefixer`, `tailwind.config.js`).
- `--skip-install`: Update project configuration and stylesheets without running package manager install.
- `--skip-build`: Skip verification build.

---

## Multi-App Bench & Monorepo Support

### Multi-App Bench Environments
When a Frappe Bench contains multiple custom apps in `apps/`, `frappe-frontend-cli` detects and validates all candidate apps.
- If multiple custom apps are found, the CLI requires explicit specification via `--app <app-name>` to prevent accidental modifications to the wrong app.
- Independent frontend projects can be initialized for different custom apps without mixing configurations or assets.

### Monorepo Workspaces & Turborepo
The CLI automatically detects common monorepo workspaces:
- **npm / Yarn Workspaces**: Configured via `"workspaces"` in `package.json`.
- **pnpm Workspaces**: Configured via `pnpm-workspace.yaml`.
- **Turborepo**: Configured via `turbo.json`.

`doctor` and `check` identify workspace configuration, package counts, and report compatibility accurately.

### Preventing Asset Collisions
By default, assets build into `<app>/public/<outputDir>` and resolve at `/assets/<app>/<outputDir>/`.
Use `--output-dir <dir>` to scope asset bundles for different SPAs:

```bash
# Scope customer portal assets
npx frappe-frontend-cli integrate frappe --app my_custom_app --output-dir portal-assets

# Scope admin desk view assets
npx frappe-frontend-cli integrate desk --app my_custom_app --output-dir desk-assets --page admin-view
```

---

## Production Asset Delivery Improvements

1. **Vite Build Manifest**: `integrate` automatically injects `build.manifest: true` into `vite.config.ts`. This generates `.vite/manifest.json` (or `manifest.json`), mapping source files to hashed production bundles.
2. **Hashed Production Assets**: Hashed filenames (e.g. `main-C8j3A.js`, `main-x9Y2.css`) guarantee safe browser cache-busting on new deployments.
3. **Frappe Public Asset Path**: All assets are resolved through Frappe's standard `/assets/<app>/<output-dir>/` path, verified across Frappe v14, v15, and v16.
4. **Nginx Cache Headers Note**: HTTP cache headers (e.g. `Cache-Control: public, max-age=31536000, immutable`) must be configured in Nginx or Bench web-server proxy configs for `/assets/`, not in Vite itself.

---

## Frappe Custom App Integration (`integrate`)

### Mode 1: Public Website Portal (`integrate frappe`)

Connects your frontend SPA directly to Frappe for full-screen website portal delivery:

```bash
# Integrate frontend with custom app
npx frappe-frontend-cli integrate frappe --app my_custom_app

# Check integration status without modifying files
npx frappe-frontend-cli integrate frappe --app my_custom_app --check

# Dry-run proposed changes without writing files or building
npx frappe-frontend-cli integrate frappe --app my_custom_app --dry-run

# Custom portal route (default: /frontend)
npx frappe-frontend-cli integrate frappe --app my_custom_app --route dashboard
```

**What `integrate frappe` does:**
1. Validates the Bench root and Frappe custom app structure (`hooks.py`, `pyproject.toml`, `public/`, `www/`).
2. Configures Vite production `base` to `/assets/<app>/<outputDir>/`, `build.outDir` to `../<app>/public/<outputDir>`, and `build.manifest: true`.
3. Updates `hooks.py` `website_route_rules` with client-side SPA subrouting (`/<route>/<path:app_path>`), preserving existing hooks.
4. Generates portal controller `www/<route>.py` (returning CSRF token, session boot dictionary, and `no_cache = 1`).
5. Generates portal template `www/<route>.html` (rendering Jinja SPA container with `window.frappe` session context).
6. Executes production build (`npm run build`) and verifies assets in `<app>/public/<outputDir>`.

### Mode 2: Frappe Desk Page (`integrate desk` or `--mode desk`)

Integrates your frontend SPA as an official Frappe Desk Page rendered inside Frappe's administrative workspace at `/app/<page>`:

```bash
# Integrate as a Frappe Desk Page
npx frappe-frontend-cli integrate desk --app my_custom_app --page tickets-dashboard --page-title "Tickets Dashboard"

# Or using explicit flags
npx frappe-frontend-cli integrate frappe --app my_custom_app --mode desk --page tickets-dashboard
```

**What `integrate desk` does:**
1. Detects app module from `modules.txt` or accepts `--module <name>`.
2. Creates Desk Page DocType JSON: `<app>/<app>/<module>/page/<page>/<page>.json` with `standard: "Yes"` and page title.
3. Creates Desk Page JavaScript controller: `<app>/<app>/<module>/page/<page>/<page>.js` registering `frappe.pages['<page>'].on_page_load(wrapper)`, initializing Frappe page layout, mounting `<div id="<page>-app"></div>`, and loading the SPA bundle via `frappe.require()`.
4. Keeps Desk Page generation cleanly separated from website `www/` routes.
5. Accessible inside Frappe Desk at `http://<your-site>/app/<page>`.

---

## Project & Integration Diagnostics (`check`)

Diagnose an existing frontend project, monorepos, and Frappe custom app integration:

```bash
# Inspect current project directory
npx frappe-frontend-cli check

# Inspect specific project or custom app
npx frappe-frontend-cli check ./apps/my_custom_app/frontend

# Output machine-readable JSON report
npx frappe-frontend-cli check --json
```

**What `check` inspects:**
- Frontend project `package.json` and package manager locks.
- Monorepo workspace detection (npm, pnpm, Turborepo).
- Framework detection (Vue 3, React, Frappe UI, Vanilla Vite).
- Dependency health and missing `node_modules`.
- CSS tooling and compatibility checks (e.g., flags incompatible Tailwind v4 when using Frappe UI).
- Vite configuration (`base`, `build.outDir`, `build.manifest`, proxy settings).
- Frappe custom app integration (hooks routing rule, `www/<route>.*` portal templates, Desk Page files).
- Production asset delivery and Vite build manifest verification.
- **Bundle size analysis**: Warns if any JavaScript bundle chunk exceeds 500 KB and recommends code-splitting strategies.
- Actionable recommendations for detected issues.

---

## Environment Doctor

The `doctor` command inspects your developer workstation and verifies whether all prerequisites for Frappe frontend development are satisfied:

```bash
$ npx frappe-frontend-cli doctor

Frappe Frontend Setup CLI doctor — Environment Diagnostics

  Operating System:        linux (x64)
  Node.js Version:         v20.20.2  [OK]
  Package Managers:        npm 10.8.2 (preferred), yarn 1.22.22
  Git:                     git version 2.43.0  [OK]
  Frappe Bench Context:    Bench CLI on PATH (5.29.1)
  Monorepo Workspace:      pnpm (packages: packages/*, apps/*)

Checks:
  ✔ Operating System: Linux x64 supported.
  ✔ Node.js: v20.20.2 meets requirement (>=18.0.0).
  ✔ Package Manager: Preferred manager: npm 10.8.2.
  ✔ Version Control: git 2.43.0 ready.
  ✔ Monorepo Workspace: pnpm workspace detected (packages/*, apps/*).
  ℹ Frappe Bench: Bench CLI detected. (Standalone frontends can still be created).

All essential frontend prerequisites are satisfied.
```

When using `--json`, clean JSON is output to `stdout` for programmatic integration:

```bash
npx frappe-frontend-cli doctor --json
```

---

## Development & Testing

```bash
# Install dependencies
npm install

# Build TypeScript to dist/
npm run build

# Run linting check
npm run lint

# Run all 99 automated tests
npm test

# Run isolated npm pack and npx smoke test
npm run test:pack
```

---

## Documentation

- [Architecture](docs/architecture.md)
- [Compatibility Matrix](docs/compatibility-matrix.md)
- [Changelog](CHANGELOG.md)

## License

MIT © [Frappe Frontend Setup Contributors](LICENSE)
