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
| **Vue.js** | `^3.5.0` | Vite 6 / 5 | Standalone API, Custom App SPA, Desk Page | Frappe v14, v15, v16, develop | Supported |
| **React** | `^18.3.0` / `^19.0.0` | Vite 6 / 5 | Standalone API, Custom App SPA | Frappe v14, v15, v16, develop | Supported |
| **Frappe UI** | `^0.1.x` | Vite 5 | Custom App SPA, Standalone with Proxy | Frappe v15, v16, develop | Supported (Vue 3 only) |

> **Critical Constraint**: Frappe UI is strictly a Vue 3 component library. React with Frappe UI is an **unsupported** configuration and will be rejected with an actionable explanation.

---

## 3. CSS Framework Compatibility

| CSS Framework | Version | Compatible Stacks | Integration Mechanism | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Tailwind CSS v4** | `^4.0.0` | Vue 3, React (Standalone/Custom App) | `@tailwindcss/vite` | Modern Vite plugin approach; zero PostCSS required. |
| **Tailwind CSS v3** | `^3.4.17` | Vue 3, React, **Frappe UI** | `postcss`, `autoprefixer` | **Required** for Frappe UI due to internal `@tailwindcss/forms` dependencies. |
| **Bootstrap** | `^5.3.3` | Vue 3, React | CSS / SCSS import + `@popperjs/core` | Can be used standalone or alongside custom themes. |
| **Sass / SCSS** | `latest` | Vue 3, React | `sass-embedded` (Vite built-in) | Zero-config in Vite once compiler is installed. |
| **Plain CSS** | Standard CSS3 | All | Native Vite CSS | Zero dependencies. |

---

## 4. Frappe Custom Application Integration Modes

### Mode 1: Standalone Frontend
- **Description**: Frontend SPA runs on its own development server (e.g. `http://localhost:5173`) and connects to Frappe via REST (`/api/method/`) or Token authentication.
- **Dev Server Proxy**: Configured via `vite.config.ts` to proxy requests to `http://127.0.0.1:8000` to prevent CORS issues.
- **Use Case**: Decoupled portals, customer-facing applications, mobile-first web apps.

### Mode 2: In-Tree Custom App SPA
- **Description**: Frontend code lives inside a Frappe custom app (`[bench]/apps/[app_name]/frontend/`) and builds directly into Frappe's public assets (`[bench]/apps/[app_name]/[app_name]/public/frontend/`).
- **Asset Delivery**: Served through a custom Frappe web page (`www/frontend.py` + `www/frontend.html`) or Frappe Desk Page.
- **Session & CSRF**: Automatically inherits Frappe session cookies and Jinja boot context.
