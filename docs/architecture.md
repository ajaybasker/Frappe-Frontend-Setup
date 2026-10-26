# Architecture — Frappe Frontend Setup CLI

## 1. Overview and Core Philosophy

`frappe-frontend-cli` is a TypeScript-based Node.js command-line interface designed to streamline frontend development across the Frappe ecosystem. It provides automated, verified project scaffolding, CSS framework integration, and Frappe custom app asset delivery conventions.

Following the design principles established in `frappe-setup-cli`:
1. **Simple Commands, Clear Intent**: Provide guided and predictable workflows (`doctor`, `init`, `create`, `add`, `integrate`, `check`).
2. **Deterministic Preflight**: Separate read-only environment fact-gathering from evaluation logic so that all diagnoses are testable as pure functions.
3. **Single Subprocess Gateway**: All child processes execute through a hardened `Runner` that validates arguments, rejects shell injections, sets timeouts, and manages process group lifecycles.
4. **Stream Discipline**: Machine-readable JSON output is sent strictly to `stdout`; diagnostic progress, warnings, and error messages are sent strictly to `stderr`.
5. **Non-Destructive Operations**: The CLI will never overwrite existing files or modify user projects without explicit confirmation and a pre-execution change plan.

---

## 2. System Architecture

```
frappe-frontend-cli (bin/frappe-frontend-cli.js)
  │
  ├── cli/ (Command routing and flags)
  │    ├── index.ts        (CLI definition: --help, --version, command registry)
  │    ├── doctor.ts       (Doctor command execution & output formatting)
  │    ├── create.ts       (Scaffolding runner for Vue, React, Frappe UI, Vanilla)
  │    ├── add.ts          (CSS tooling runner for Tailwind v3/v4, Bootstrap, SCSS)
  │    └── init.ts         (Interactive setup wizard and non-interactive runner)
  │
  ├── core/ (Foundation and utilities)
  │    ├── runner.ts       (Hardened subprocess gateway with timeout and signal trapping)
  │    ├── facts.ts        (Read-only environment discovery: OS, Node, PMs, Git, Bench)
  │    ├── evaluator.ts    (Pure diagnostic evaluation logic: facts -> CheckItems)
  │    ├── frappe-app.ts   (Bench detection, custom app inspection, hooks.py validation)
  │    ├── validation.ts   (Safe project naming and non-empty directory protection)
  │    ├── matrix.ts       (Declarative compatibility matrix)
  │    ├── ui.ts           (Terminal formatting, key-value tables, ANSI styling)
  │    └── types.ts        (Core TypeScript interfaces)
  │
  ├── adapters/ (Framework and CSS Tooling Adapters)
  │    ├── frameworks/     (Vue 3, React, Frappe UI, Vanilla)
  │    └── css/            (Tailwind CSS v3/v4, Bootstrap 5, SCSS, Plain CSS)
  │
  └── (Phase 5 Target)
       └── frappe/         (Hooks.py integration and production asset bundling)
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
1. `gatherFacts()` probes the real system (OS, CPU, Node.js version, package managers, Git availability, and Frappe bench markers). It returns a raw, serializable `EnvironmentFacts` object.
2. `evaluateEnvironment(facts)` is a **pure function**. It accepts `EnvironmentFacts` and returns a `DoctorReport` consisting of structured `CheckItem` objects (`status: 'ok' | 'warn' | 'fail' | 'missing'`, message, and remediation hint).
3. Tests can supply arbitrary mock `EnvironmentFacts` to verify every edge case (e.g. Node 16, missing Git, unsupported CPU architectures, conflicting package managers) without modifying the host machine.

---

## 5. Frappe Bench Environment Detection

A directory or environment is recognized as an active Frappe context if:
1. A Frappe bench directory structure is detected (contains `apps/frappe`, `sites/`, and `config/`).
2. Or a custom Frappe app directory is detected (contains `hooks.py`, `[app_name]/`, and an ancestor bench directory).
3. The `bench` CLI binary is available on `$PATH`.

The CLI distinguishes between *presence of the `bench` binary* and an *actual bench workspace*, avoiding false positives.

---

## 6. Implementation Language and Packaging Strategy

- **Runtime**: Native Node.js (`>=18.0.0`).
- **Language**: TypeScript (`strict: true`).
- **Distribution**: Zero runtime transpilation overhead; built via `tsc` to standard CommonJS/ESM in `dist/`.
- **Packaging**: Self-contained npm package with an explicit `bin` mapping to `./dist/bin/cli.js`. Development files, source maps, and tests are excluded from the published package via the `files` field in `package.json`.
