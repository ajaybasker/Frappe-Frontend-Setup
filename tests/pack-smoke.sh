#!/usr/bin/env bash
# Pack and smoke test frappe-frontend-cli
# Tests real npm pack tarball, global install to isolated prefix, and npx invocation.

set -euo pipefail

REPO="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf -- "${WORK}"' EXIT

export HOME="${WORK}/home"
export npm_config_cache="${WORK}/npm-cache"
export npm_config_update_notifier=false
mkdir -p "${HOME}" "${WORK}/prefix" "${WORK}/sandbox"

step() { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31mFAIL:\033[0m %s\n' "$*" >&2; exit 1; }

step "Building project"
npm --prefix "${REPO}" run build

step "Creating npm pack tarball"
TARBALL="$(cd "${REPO}" && npm pack --pack-destination "${WORK}" --silent)"
TARBALL="${WORK}/${TARBALL}"
VERSION="$(cd "${REPO}" && node -p 'require("./package.json").version')"

step "Verifying tarball contents"
tar -tzf "${TARBALL}" | grep -Eq '(^|/)(tests|node_modules|\.git)/' && fail "tarball contains development files"

step "Installing globally into isolated sandbox prefix"
npm install --global --prefix "${WORK}/prefix" "${TARBALL}" --no-audit --no-fund --loglevel=error
BIN="${WORK}/prefix/bin/frappe-frontend-cli"
[[ -x "${BIN}" ]] || fail "frappe-frontend-cli binary not executable or missing in prefix"

cd "${WORK}/sandbox"

step "Testing installed binary: --version"
OUT="$("${BIN}" --version)"
echo "Version: ${OUT}"
[[ "${OUT}" == "${VERSION}" ]] || fail "Expected version ${VERSION}, got ${OUT}"

step "Testing installed binary: --help"
HELP="$("${BIN}" --help)"
[[ "${HELP}" == *"Usage: frappe-frontend-cli"* ]] || fail "Help output missing usage"
[[ "${HELP}" == *"doctor"* ]] || fail "Help output missing doctor command"
[[ "${HELP}" == *"init"* ]] || fail "Help output missing init command"
[[ "${HELP}" == *"create"* ]] || fail "Help output missing create command"

step "Testing installed binary: init --help"
INIT_HELP="$("${BIN}" init --help)"
[[ "${INIT_HELP}" == *"Interactive setup wizard"* ]] || fail "init --help missing description"

step "Testing installed binary: doctor (human output)"
"${BIN}" doctor

step "Testing installed binary: doctor --json (stdout parsing)"
"${BIN}" doctor --json 2>/dev/null | node -e '
  const data = JSON.parse(require("fs").readFileSync(0, "utf-8"));
  if (!data || typeof data.healthy !== "boolean" || !data.facts) process.exit(1);
  console.log("  Parsed doctor JSON facts: OS=" + data.facts.os.platform + ", Node=" + data.facts.node.version);
' || fail "Failed to parse doctor JSON output"

step "Testing execution via npx from tarball"
NPX_OUT="$(npx --yes --package "${TARBALL}" frappe-frontend-cli --version)"
echo "npx version: ${NPX_OUT}"
[[ "${NPX_OUT}" == "${VERSION}" ]] || fail "npx run output did not match version"

NPX_INIT="$(npx --yes --package "${TARBALL}" frappe-frontend-cli init --help)"
[[ "${NPX_INIT}" == *"Interactive setup wizard"* ]] || fail "npx init --help failed"

printf '\n\033[1;32mPASS:\033[0m npm tarball %s verified successfully via global install and npx!\n' "$(basename "${TARBALL}")"
