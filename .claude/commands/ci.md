Run CI checks across the monorepo. Argument: $ARGUMENTS (use "check" for report-only mode, default is auto-fix mode).

## Instructions

Determine the mode from the argument:
- If the argument is "check": run in **check mode** (no modifications, report issues only)
- Otherwise: run in **fix mode** (auto-fix formatting and lint issues)

Execute the following steps **in order**. For each step, report pass/fail. Continue even if a step fails.

### Step 1: Prettier (all projects)

**Fix mode:**
```bash
cd /Users/tianpan/projects/tianpan-v3 && npx prettier --write "projects/**/*.{ts,tsx,js,jsx,json}" "!**/node_modules/**" "!**/build/**" "!**/dist/**" "!**/.docusaurus/**" "!**/src/generated/**" "!**/src/gql/**"
```

**Check mode:**
```bash
cd /Users/tianpan/projects/tianpan-v3 && npx prettier --check "projects/**/*.{ts,tsx,js,jsx,json}" "!**/node_modules/**" "!**/build/**" "!**/dist/**" "!**/.docusaurus/**" "!**/src/generated/**" "!**/src/gql/**"
```

### Step 2: ESLint — tianpan-v3-web

**Fix mode:**
```bash
cd /Users/tianpan/projects/tianpan-v3/projects/tianpan-v3-web && npx eslint . --fix --max-warnings=500
```

**Check mode:**
```bash
cd /Users/tianpan/projects/tianpan-v3/projects/tianpan-v3-web && npx eslint . --max-warnings=500
```

### Step 3: ESLint — notehub

**Fix mode:**
```bash
cd /Users/tianpan/projects/tianpan-v3/projects/notehub && npx eslint . --fix --max-warnings=500
```

**Check mode:**
```bash
cd /Users/tianpan/projects/tianpan-v3/projects/notehub && npx eslint . --max-warnings=500
```

### Step 4: ESLint — tp-backend

**Fix mode:**
```bash
cd /Users/tianpan/projects/tianpan-v3/projects/tp-backend && npm run lint
```

**Check mode:**
```bash
cd /Users/tianpan/projects/tianpan-v3/projects/tp-backend && npm run lint
```

### Step 5: TypeScript — tianpan-v3-web

```bash
cd /Users/tianpan/projects/tianpan-v3/projects/tianpan-v3-web && yarn typecheck
```

### Step 6: TypeScript — notehub

```bash
cd /Users/tianpan/projects/tianpan-v3/projects/notehub && npx tsc --noEmit
```

### Step 7: Tests — tianpan-v3-web

```bash
cd /Users/tianpan/projects/tianpan-v3/projects/tianpan-v3-web && yarn test --passWithNoTests 2>&1 || true
```

### Summary

After all steps complete, print a summary table:

```
| Step                    | Status |
|-------------------------|--------|
| Prettier                | ✅/❌  |
| ESLint (web)            | ✅/❌  |
| ESLint (notehub)        | ✅/❌  |
| ESLint (backend)        | ✅/❌  |
| TypeScript (web)        | ✅/❌  |
| TypeScript (notehub)    | ✅/❌  |
| Tests (web)             | ✅/❌  |
```

If any step failed, list the key errors at the end.
