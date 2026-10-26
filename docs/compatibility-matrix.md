# Compatibility Matrix — Frappe Frontend Setup CLI

This document specifies the supported, experimental, and unsupported configurations across the Frappe frontend ecosystem. This data is represented declaratively in `src/core/matrix.ts` and evaluated during preflight checks.

---

## 1. System and Runtime Environments

| Component | Minimum Supported | Recommended | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Node.js** | `>=18.0.0` | `20.x` LTS or `22.x` LTS | Supported | Vite 5/6 and modern frontend frameworks require Node.js 18+. |
| **Operating System** | Linux, macOS, WSL2 | Linux (Ubuntu 24.04/26.04) | Supported | Native Windows (cmd/PowerShell) is experimental. |
| **CPU Architecture** | x86_64, aarch64 (ARM64) | x86_64 / arm64 | Supported | Pre-compiled dependencies (e.g. esbuild/rollup) are verified on both. |
| **Package Managers** | `npm >= 9.0.0` | `npm`, `pnpm >= 8.0.0` | Supported | `yarn` (classic & modern) and `bun` are supported with advisory notes. |
| **Git** | `>= 2.25.0` | `>= 2.40.0` | Supported | Required for repository cloning and template scaffolding. |

---

## 2. Frontend Frameworks and Frappe Integration Targets

| Framework | Framework Version | Build Tool | Frappe Integration Modes | Frappe Framework Target | Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Vue.js** | `^3.5.13` | Vite 6 | Standalone API, Custom App SPA, Desk Page | Frappe v14, v15, v16, develop | **Verified (Phase 2)** |
| **React** | `^18.3.1` | Vite 6 | Standalone API, Custom App SPA | Frappe v14, v15, v16, develop | **Verified (Phase 2)** |
| **Frappe UI** | `^1.0.2` | Vite 6 / 5 | Custom App SPA, Standalone with Proxy | Frappe v14, v15, v16, develop | **Verified (Phase 4)** |

> **Critical Constraint**: Frappe UI is strictly a Vue 3 component library. React with Frappe UI is an **unsupported** configuration and will be rejected with an actionable explanation. Frappe UI pins Tailwind CSS to v3.x compatibility mode via PostCSS.

---

## 3. CSS Framework Compatibility

| CSS Framework | Version | Compatible Stacks | Integration Mechanism | Status | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Tailwind CSS v4** | `^4.0.0` | Vue 3, React (Standalone/Custom App) | `@tailwindcss/vite` | **Verified (Phase 3)** | Modern Vite plugin approach; zero PostCSS required. |
| **Tailwind CSS v3** | `^3.4.17` | Vue 3, React, **Frappe UI** | `postcss`, `autoprefixer` | **Verified (Phase 3)** | Compatibility mode for Frappe UI (`postcss`, `tailwind.config.js`). |
| **Bootstrap** | `^5.3.3` | Vue 3, React | CSS / SCSS import + `@popperjs/core` | **Verified (Phase 3)** | Runtime CSS + Popper.js; imported in main script. |
| **Sass / SCSS** | `^1.83.0` | Vue 3, React | `sass-embedded` (Vite native) | **Verified (Phase 3)** | Compiles SCSS variables & nesting natively in Vite. |
| **Plain CSS** | Standard CSS3 | All | Native Vite CSS | **Verified (Phase 1)** | Zero dependencies. |

---

## 4. Frappe Custom Application Integration Modes

### Mode 1: Standalone Frontend
- **Description**: Frontend SPA runs on its own development server (e.g. `http://localhost:5173`) and connects to Frappe via REST (`/api/method/`) or Token authentication.
- **Dev Server Proxy**: Configured via `vite.config.ts` to proxy requests to `http://127.0.0.1:8000` to prevent CORS issues.
- **Use Case**: Decoupled portals, customer-facing applications, mobile-first web apps.

### Mode 2: In-Tree Custom App SPA (**Verified in Phase 5**)
- **Description**: Frontend code lives inside a Frappe custom app (`[bench]/apps/[app_name]/frontend/`) and builds directly into Frappe's public assets (`[bench]/apps/[app_name]/[app_name]/public/frontend/`).
- **Asset Delivery Path**: In Frappe v14, v15, and v16, files in `[app_dir]/[app_name]/public/frontend/` are mapped by Nginx/Bench to `/assets/[app_name]/frontend/`.
- **Vite Configuration**:
  - `base: process.env.NODE_ENV === 'production' ? '/assets/[app_name]/frontend/' : '/'`
  - `build.outDir: '../[app_name]/public/frontend'`
  - `build.emptyOutDir: true`
- **Frappe Routing Hooks**:
  - Appended to `hooks.py`: `website_route_rules = [{"from_route": "/[route]/<path:app_path>", "to_route": "[route]"}]`
  - Preserves all existing custom hooks, comments, and configurations without wholesale file replacement.
- **Portal Page Controller & Template**:
  - `www/[route].py`: Sets `no_cache = 1`, retrieves CSRF token via `frappe.sessions.get_csrf_token()`, and injects `boot` context.
  - `www/[route].html`: Jinja template rendering `window.frappe = { csrf_token, boot }` and loading the Vite production bundle.
- **Verification Status**:
  - Bench detection, app structure validation, Vite config updates, `hooks.py` safe merging, portal templates, and production build verification are fully automated and verified via `npx frappe-frontend-cli integrate frappe` and `npx frappe-frontend-cli check`.
