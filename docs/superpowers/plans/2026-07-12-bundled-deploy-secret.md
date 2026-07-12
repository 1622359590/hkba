# Bundled Deploy Secret Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Baota deployment workflow accept configuration lines and an OpenSSH private key from the existing `DEPLOY_SSH_KEY` secret without breaking separately configured Secrets.

**Architecture:** Add a focused Bash resolver that reads a temporary bundle file, resolves only approved variables, applies defaults after resolution, masks exported values, extracts and validates one OpenSSH key, and writes resolved variables to `GITHUB_ENV`. Update the workflow to invoke that resolver before validation, while leaving the existing SSH, rsync, build, and PM2 deployment flow unchanged.

**Tech Stack:** GitHub Actions YAML, Bash 4+, OpenSSH `ssh-keygen`, shell-based integration tests

## Global Constraints

- Separately configured GitHub Secrets take precedence over values in `DEPLOY_SSH_KEY`.
- Accept only `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PORT`, `DEPLOY_PATH`, `BACKEND_PORT`, `FRONTEND_PORT`, `NEXT_PUBLIC_API_URL`, `ALLOWED_ORIGINS`, `JWT_SECRET`, and `SEED_ON_FIRST_DEPLOY`.
- Parse configuration only before the first `-----BEGIN OPENSSH PRIVATE KEY-----` line.
- Never evaluate bundle content as shell code and never print configuration values or private key material.
- Preserve defaults: port `22`, deploy path `/www/wwwroot/hkba`, backend port `37900`, frontend port `3000`, and first-deploy seeding `false`.
- Preserve the current deployment directory handling, rsync exclusions, build commands, and PM2 process names.

---

### Task 1: Add a Testable Bundle Resolver

**Files:**
- Create: `.github/scripts/resolve-deploy-bundle.sh`
- Create: `.github/scripts/test-resolve-deploy-bundle.sh`

**Interfaces:**
- Consumes: `resolve-deploy-bundle.sh BUNDLE_FILE GITHUB_ENV_FILE SSH_KEY_FILE` plus any separately configured workflow variables in the process environment.
- Produces: approved `NAME=value` entries in `GITHUB_ENV_FILE` and one validated private key at `SSH_KEY_FILE` with mode `600`.

- [ ] **Step 1: Write the integration test**

Create a shell test that generates a disposable Ed25519 key with `ssh-keygen`, builds a synthetic bundle, invokes the resolver, and asserts all of the following:

```bash
# Bundle-only values map to workflow names.
grep -Fx 'SSH_USER=root' "$github_env"
grep -Fx 'NEXT_PUBLIC_API_URL=https://api.example.test' "$github_env"

# A separately supplied value wins over the bundle.
grep -Fx 'SSH_HOST=separate.example.test' "$github_env"

# Defaults are applied only when both sources are empty.
grep -Fx 'SSH_PORT=22' "$github_env"
grep -Fx 'DEPLOY_PATH=/www/wwwroot/hkba' "$github_env"

# Unknown and misspelled keys are not exported.
! grep -q '^EPLOY_USER=' "$github_env"
! grep -q '^UNSUPPORTED=' "$github_env"

# The extracted key is valid and contains no configuration lines.
ssh-keygen -y -f "$output_key" >/dev/null
head -n 1 "$output_key" | grep -Fx -- '-----BEGIN OPENSSH PRIVATE KEY-----'
```

Add negative cases that assert a missing key block and a malformed key both return nonzero without appending resolved values.

- [ ] **Step 2: Run the test and verify it fails**

Run: `bash .github/scripts/test-resolve-deploy-bundle.sh`

Expected: FAIL because `.github/scripts/resolve-deploy-bundle.sh` does not exist.

- [ ] **Step 3: Implement the resolver**

Implement the script with `set -euo pipefail`, exactly three required path arguments, an associative-array whitelist/mapping, and these operations in order:

```bash
declare -A target_for=(
  [DEPLOY_HOST]=SSH_HOST
  [DEPLOY_USER]=SSH_USER
  [DEPLOY_PORT]=SSH_PORT
  [DEPLOY_PATH]=DEPLOY_PATH
  [BACKEND_PORT]=BACKEND_PORT
  [FRONTEND_PORT]=FRONTEND_PORT
  [NEXT_PUBLIC_API_URL]=NEXT_PUBLIC_API_URL
  [ALLOWED_ORIGINS]=ALLOWED_ORIGINS
  [JWT_SECRET]=JWT_SECRET
  [SEED_ON_FIRST_DEPLOY]=SEED_ON_FIRST_DEPLOY
)

declare -A defaults=(
  [SSH_PORT]=22
  [DEPLOY_PATH]=/www/wwwroot/hkba
  [BACKEND_PORT]=37900
  [FRONTEND_PORT]=3000
  [SEED_ON_FIRST_DEPLOY]=false
)
```

Read configuration lines without `eval`; split each accepted line at its first `=` using `${line%%=*}` and `${line#*=}`. Keep existing nonempty environment values, otherwise use the bundle value, otherwise use the listed default. Emit `::add-mask::<value>` before appending each resolved value to the GitHub environment file.

Extract only the first complete OpenSSH private key block with `awk`, set mode `600`, and run:

```bash
ssh-keygen -y -f "$ssh_key_file" >/dev/null
```

If extraction or validation fails, remove the key and environment output created by this invocation, print a value-free error message to stderr, and exit nonzero.

- [ ] **Step 4: Run the resolver integration test**

Run: `bash .github/scripts/test-resolve-deploy-bundle.sh`

Expected: `All bundled deploy secret tests passed.` and exit status `0`.

- [ ] **Step 5: Run shell syntax checks**

Run: `bash -n .github/scripts/resolve-deploy-bundle.sh .github/scripts/test-resolve-deploy-bundle.sh`

Expected: no output and exit status `0`.

- [ ] **Step 6: Commit the resolver and tests**

```bash
git add .github/scripts/resolve-deploy-bundle.sh .github/scripts/test-resolve-deploy-bundle.sh
git commit -m "ci: parse bundled deployment secret"
```

### Task 2: Integrate Resolution Into GitHub Actions

**Files:**
- Modify: `.github/workflows/deploy-baota.yml`

**Interfaces:**
- Consumes: the resolver from Task 1, `DEPLOY_SSH_KEY`, and existing separate repository Secrets.
- Produces: resolved job environment variables and `$RUNNER_TEMP/hkba_deploy_key` for all existing deployment steps.

- [ ] **Step 1: Remove early optional defaults from the job environment**

Keep all existing Secret mappings but change optional mappings so they can be empty before bundle resolution:

```yaml
SSH_PORT: ${{ secrets.DEPLOY_PORT }}
DEPLOY_PATH: ${{ secrets.DEPLOY_PATH }}
BACKEND_PORT: ${{ secrets.BACKEND_PORT }}
FRONTEND_PORT: ${{ secrets.FRONTEND_PORT }}
SEED_ON_FIRST_DEPLOY: ${{ secrets.SEED_ON_FIRST_DEPLOY }}
```

This allows a bundle value to win over a default while a separate Secret still wins over the bundle.

- [ ] **Step 2: Add the resolution step before validation**

Add a Bash step that writes the complete secret to a mode-`600` temporary file, invokes the resolver, and always removes the bundle file:

```yaml
- name: Resolve deployment configuration
  shell: bash
  run: |
    set -euo pipefail
    bundle_file="$RUNNER_TEMP/hkba_deploy_bundle"
    trap 'rm -f "$bundle_file"' EXIT
    umask 077
    printf '%s\n' "$DEPLOY_SSH_KEY" > "$bundle_file"
    bash .github/scripts/resolve-deploy-bundle.sh \
      "$bundle_file" \
      "$GITHUB_ENV" \
      "$RUNNER_TEMP/hkba_deploy_key"
```

- [ ] **Step 3: Tighten validation and SSH setup**

Keep the required variable loop, but report `Missing required deployment variables` because values may now come from either source. Replace the raw-secret write in `Configure SSH` with key existence and validity checks against `$RUNNER_TEMP/hkba_deploy_key`, then use that path for `ssh-keyscan`, `ssh`, and `rsync`:

```bash
test -s "$RUNNER_TEMP/hkba_deploy_key"
ssh-keygen -y -f "$RUNNER_TEMP/hkba_deploy_key" >/dev/null
```

Do not change rsync exclusions, remote environment construction, npm commands, or PM2 commands.

- [ ] **Step 4: Validate workflow syntax and references**

Run:

```bash
ruby -e "require 'yaml'; YAML.load_file('.github/workflows/deploy-baota.yml', aliases: true); puts 'workflow yaml ok'"
rg -n 'hkba_deploy_key|DEPLOY_SSH_KEY|Resolve deployment configuration' .github/workflows/deploy-baota.yml
```

Expected: `workflow yaml ok`; every SSH and rsync command references `$RUNNER_TEMP/hkba_deploy_key`; the complete secret is used only by the resolution step.

- [ ] **Step 5: Run all local deployment checks**

Run:

```bash
bash .github/scripts/test-resolve-deploy-bundle.sh
bash -n .github/scripts/resolve-deploy-bundle.sh .github/scripts/test-resolve-deploy-bundle.sh
git diff --check
```

Expected: all tests pass, shell syntax passes, and `git diff --check` prints nothing.

- [ ] **Step 6: Commit workflow integration**

```bash
git add .github/workflows/deploy-baota.yml
git commit -m "ci: support bundled Baota deploy settings"
```

### Task 3: Push and Verify the Real Workflow

**Files:**
- Verify only: `.github/workflows/deploy-baota.yml`

**Interfaces:**
- Consumes: committed resolver and workflow on `main`, plus repository Secrets already managed by `btcsam`.
- Produces: a GitHub Actions run that reaches server deployment or reports one concise, non-secret validation error.

- [ ] **Step 1: Confirm the outgoing commit range**

Run:

```bash
git status --short
git log --oneline btcsam/main..HEAD
```

Expected: clean worktree and only the design, resolver, and workflow commits intended for this change.

- [ ] **Step 2: Push `main` to the authorized repository**

Run: `git push btcsam main`

Expected: push succeeds and updates `btcsam/hkba` without force.

- [ ] **Step 3: Inspect the push-triggered workflow run**

Run:

```bash
gh run list --repo btcsam/hkba --workflow 'Deploy to Baota Server' --limit 1
gh run watch RUN_ID --repo btcsam/hkba --exit-status
```

Expected: bundle resolution and secret validation pass. If a later server step fails, inspect only that step's metadata/logs and do not print or reconstruct Secret values.

- [ ] **Step 4: Report deployment state**

Summarize the run URL, the last successful step, and any remaining server-side action. If `DEPLOY_USER` is misspelled inside the bundle, report that exact field-name correction without exposing its value.
