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

## Implemented Commands (Phase 1 & 2)

| Command | Description | Status |
| :--- | :--- | :--- |
| `frappe-frontend-cli --help` | Display formatted usage instructions and commands | **Implemented** |
| `frappe-frontend-cli --version` | Display current package version | **Implemented** |
| `frappe-frontend-cli doctor` | Diagnose environment (Node, PMs, Git, Bench, OS) | **Implemented** |
| `frappe-frontend-cli doctor --json` | Output machine-readable diagnostic facts to stdout | **Implemented** |
| `frappe-frontend-cli create vue <name>` | Scaffold, install, and verify a Vue 3 + Vite project | **Implemented** |
| `frappe-frontend-cli create react <name>` | Scaffold, install, and verify a React + Vite project | **Implemented** |
| `frappe-frontend-cli add tailwind` | Configure Tailwind CSS v4 or v3 in a Vite project | **Implemented** |
| `frappe-frontend-cli add bootstrap` | Configure Bootstrap 5 in a Vite project | **Implemented** |
| `frappe-frontend-cli add scss` | Configure SCSS (sass-embedded) in a Vite project | **Implemented** |

### Project Creation (`create`)

```bash
# Create Vue 3 + Vite project (TypeScript default)
npx frappe-frontend-cli create vue my-vue-app

# Create React + Vite project in JavaScript
npx frappe-frontend-cli create react my-react-app --js

# Specify package manager explicitly
npx frappe-frontend-cli create vue my-vue-app --package-manager pnpm
```

**Options:**
- `--ts`: Use TypeScript template (sensible default).
- `--js`: Use JavaScript template.
- `--package-manager <npm|pnpm|yarn|bun>`: Package manager to use (defaults to detected preferred manager).
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

### Planned Commands (Subsequent Phases)

| Command | Target Phase | Description |
| :--- | :--- | :--- |
| `frappe-frontend-cli init` | Phase 4 | Interactive stack selector and setup wizard |
| `frappe-frontend-cli create frappe-ui <name>` | Phase 4 | Scaffold a Vue 3 + Frappe UI + Tailwind project |
| `frappe-frontend-cli integrate frappe` | Phase 5 | Connect frontend to a Frappe custom app or proxy |
| `frappe-frontend-cli check` | Phase 5 | Inspect an existing project for compatibility |

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
