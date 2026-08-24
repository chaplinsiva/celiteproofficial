#!/usr/bin/env bash
# agent-notes: { ctx: "TaskCompleted hook enforcing automatable done-gate items", deps: [docs/process/done-gate.md], state: active, last: "sato@2026-03-28" }
#
# TaskCompleted hook — enforces done-gate items 1, 3, 4:
#   1. Tests pass
#   3. Formatted (no diffs)
#   4. Linted (zero warnings)
#
# Exit codes:
#   0 = all checks pass (or no tooling detected — graceful degradation)
#   2 = check failed — blocks task completion
#
# Receives TaskCompleted JSON on stdin (has task_id, task_subject, etc.)
# We don't need to parse it for these checks — they're project-wide.

set -euo pipefail

PROJECT_DIR="${ANTIGRAVITY_PROJECT_DIR:-.}"
cd "$PROJECT_DIR"

failures=()

# --- Detect and run test runner (Done Gate item 1) ---
run_tests() {
  if [ -f "package.json" ]; then
    if grep -q '"test"' package.json 2>/dev/null; then
      echo "[done-gate] Running: npm test"
      if ! npm test --if-present 2>&1; then
        failures+=("Tests failed (npm test)")
      fi
    fi
  elif [ -f "pyproject.toml" ] || [ -f "setup.py" ] || [ -f "setup.cfg" ]; then
    if command -v pytest &>/dev/null; then
      echo "[done-gate] Running: pytest"
      if ! pytest --tb=short -q 2>&1; then
        failures+=("Tests failed (pytest)")
      fi
    fi
  elif [ -f "Cargo.toml" ]; then
    echo "[done-gate] Running: cargo test"
    if ! cargo test 2>&1; then
      failures+=("Tests failed (cargo test)")
    fi
  else
    echo "[done-gate] No test runner detected — skipping test check"
  fi
}

# --- Detect and check formatter (Done Gate item 3) ---
check_format() {
  if [ -f "package.json" ]; then
    if grep -q '"prettier"' package.json 2>/dev/null || [ -f ".prettierrc" ] || [ -f ".prettierrc.json" ] || [ -f "prettier.config.js" ] || [ -f "prettier.config.mjs" ]; then
      echo "[done-gate] Running: npx prettier --check ."
      if ! npx prettier --check . 2>&1; then
        failures+=("Formatting check failed (prettier)")
      fi
    fi
  elif [ -f "pyproject.toml" ] || [ -f "setup.py" ] || [ -f "setup.cfg" ]; then
    if command -v ruff &>/dev/null; then
      echo "[done-gate] Running: ruff format --check ."
      if ! ruff format --check . 2>&1; then
        failures+=("Formatting check failed (ruff format)")
      fi
    fi
  elif [ -f "Cargo.toml" ]; then
    echo "[done-gate] Running: cargo fmt --check"
    if ! cargo fmt --check 2>&1; then
      failures+=("Formatting check failed (cargo fmt)")
    fi
  else
    echo "[done-gate] No formatter detected — skipping format check"
  fi
}

# --- Detect and check linter (Done Gate item 4) ---
check_lint() {
  if [ -f "package.json" ]; then
    if grep -q '"eslint"' package.json 2>/dev/null || [ -f ".eslintrc" ] || [ -f ".eslintrc.json" ] || [ -f ".eslintrc.js" ] || [ -f "eslint.config.js" ] || [ -f "eslint.config.mjs" ]; then
      echo "[done-gate] Running: npx eslint ."
      if ! npx eslint . 2>&1; then
        failures+=("Lint check failed (eslint)")
      fi
    fi
  elif [ -f "pyproject.toml" ] || [ -f "setup.py" ] || [ -f "setup.cfg" ]; then
    if command -v ruff &>/dev/null; then
      echo "[done-gate] Running: ruff check ."
      if ! ruff check . 2>&1; then
        failures+=("Lint check failed (ruff check)")
      fi
    fi
  elif [ -f "Cargo.toml" ]; then
    echo "[done-gate] Running: cargo clippy"
    if ! cargo clippy -- -D warnings 2>&1; then
      failures+=("Lint check failed (clippy)")
    fi
  else
    echo "[done-gate] No linter detected — skipping lint check"
  fi
}

# --- Run all checks ---
run_tests
check_format
check_lint

# --- Report results ---
if [ ${#failures[@]} -gt 0 ]; then
  reason="[done-gate] BLOCKED — ${#failures[@]} check(s) failed:\n"
  for f in "${failures[@]}"; do
    reason+="  - $f\n"
  done
  reason+="Fix the above issues before completing this task."
  
  # output JSON using jq to properly escape the string
  jq -n --arg decision "continue" --arg reason "$reason" '{decision: $decision, reason: $reason}'
  exit 0
fi

cat << 'EOF'
{
  "decision": "allow"
}
EOF
exit 0
