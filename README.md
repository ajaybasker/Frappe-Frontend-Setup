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

## Implemented Commands (Phases 1 through 5)

| Command | Description | Status |
| :--- | :--- | :--- |
| `frappe-frontend-cli --help` | Display formatted usage instructions and commands | **Implemented** |
| `frappe-frontend-cli --version` | Display current package version | **Implemented** |
| `frappe-frontend-cli doctor` | Diagnose environment (Node, PMs, Git, Bench, OS) | **Implemented** |
| `frappe-frontend-cli doctor --json` | Output machine-readable diagnostic facts to stdout | **Implemented** |
| `frappe-frontend-cli create vue <name>` | Scaffold, install, and verify a Vue 3 + Vite project | **Implemented** |
| `frappe-frontend-cli create react <name>` | Scaffold, install, and verify a React + Vite project | **Implemented** |
| `frappe-frontend-cli create frappe-ui <name>` | Scaffold, install, and verify a Frappe UI + Tailwind v3 project | **Implemented** |
| `frappe-frontend-cli add tailwind` | Configure Tailwind CSS v4 or v3 in a Vite project | **Implemented** |
| `frappe-frontend-cli add bootstrap` | Configure Bootstrap 5 in a Vite project | **Implemented** |
| `frappe-frontend-cli add scss` | Configure SCSS (sass-embedded) in a Vite project | **Implemented** |
| `frappe-frontend-cli init` | Interactive setup wizard for standalone or in-tree apps | **Implemented** |
| `frappe-frontend-cli integrate frappe` | Connect frontend with custom app routing, hooks, and asset delivery | **Implemented (Phase 5)** |
| `frappe-frontend-cli check` | Inspect project & Frappe app for compatibility, configuration, and health | **Implemented (Phase 5)** |

### Interactive Setup Wizard (`init`)

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

#### Non-Interactive Automation

For CI/CD or scripting, pass `--non-interactive` (or `-y` / `--yes`):

```bash
# Standalone Frappe UI project
npx frappe-frontend-cli init --non-interactive --name my-app --framework frappe-ui --ts

# Configure frontend inside an existing Frappe custom app
npx frappe-frontend-cli init --non-interactive --mode frappe-app --app my_custom_app --framework frappe-ui --backend-url http://127.0.0.1:8000
```

### Project Creation (`create`)

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

### Adding CSS Frameworks & Tooling (`add`)

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

### Frappe Custom App Integration (`integrate frappe`)

Connect your frontend SPA directly to a Frappe custom app for production asset delivery, CSRF protection, and server-side Jinja SPA loading:

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

**Options:**
- `--app <name>`: Target Frappe custom app name.
- `--bench-dir <path>`: Frappe bench directory path.
- `--frontend-dir <path>`: Frontend source directory (defaults to `frontend/` inside the app).
- `--route <route>`: Frappe portal SPA route (default: `frontend`).
- `--check`: Inspect integration health and diagnose missing items without modifying any files.
- `--dry-run`: Display proposed file modifications and actions without writing files or building.
- `--skip-build`: Configure Vite, hooks, and templates without triggering a production build.
- `-y, --yes`: Proceed automatically without interactive confirmation.

**What `integrate frappe` does:**
1. Validates the Bench root and Frappe custom app structure (`hooks.py`, `pyproject.toml`, `public/`, `www/`).
2. Configures Vite production `base` to `/assets/<app>/frontend/` and `build.outDir` to `../<app>/public/frontend` with `.bak` backup creation.
3. Updates `hooks.py` `website_route_rules` with client-side SPA subrouting (`/frontend/<path:app_path>`), preserving existing hooks and comments.
4. Generates portal controller `www/<route>.py` (returning CSRF token, session boot dictionary, and `no_cache = 1`).
5. Generates portal template `www/<route>.html` (rendering Jinja SPA container with `window.frappe` session context).
6. Executes production build (`npm run build`) and verifies assets in `<app>/public/frontend`.
7. Outputs full file change report with exact shell commands to revert changes if desired.

---

### Project & Integration Diagnostics (`check`)

Diagnose an existing frontend project and its Frappe custom app integration:

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
- Framework detection (Vue 3, React, Frappe UI, Vanilla Vite).
- Dependency health and missing `node_modules`.
- CSS tooling and compatibility checks (e.g., flags incompatible Tailwind v4 when using Frappe UI).
- Vite configuration (`base`, `build.outDir`, proxy settings).
- Frappe custom app integration (hooks routing rule, `www/<route>.*` portal templates, production build assets).
- Actionable recommendations for detected issues.

---

## Environment Doctor

The `doctor` command inspects your developer workstation and verifies whether all prerequisites for Frappe frontend development are satisfied:

```bash
$ npx frappe-frontend-cli doctor

Frappe Frontend Setup CLI doctor — Environment Diagnostics

  Operating System:      linux (x64)
  Node.js Version:       v20.20.2  [OK]
  Package Managers:      npm 10.8.2 (default), pnpm (not found), yarn (not found), bun (not found)
  Git:                   git version 2.43.0  [OK]
  Frappe Bench:          Not detected in current directory context

Checks:
  ✔ Operating System: Linux x64 supported.
  ✔ Node.js: v20.20.2 meets requirement (>=18.0.0).
  ✔ Package Manager: npm 10.8.2 ready.
  ✔ Version Control: git 2.43.0 ready.
  ℹ Frappe Bench: Not detected. (Standalone frontend projects can still be created).

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

# Run automated tests
npm test
```

---

## Documentation

- [Architecture](docs/architecture.md)
- [Compatibility Matrix](docs/compatibility-matrix.md)

## License

MIT © [Frappe Frontend Setup Contributors](LICENSE)
