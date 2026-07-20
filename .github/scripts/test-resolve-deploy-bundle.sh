#!/usr/bin/env bash

set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
resolver="$script_dir/resolve-deploy-bundle.sh"
tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

assert_line() {
  grep -Fqx -- "$1" "$2" || fail "missing expected environment entry"
}

assert_no_key() {
  grep -Eq -- "^$1=" "$2" && fail "unexpected environment entry: $1"
  return 0
}

private_key="$tmp_dir/source_key"
ssh-keygen -q -t ed25519 -N '' -f "$private_key"

bundle="$tmp_dir/bundle"
github_env="$tmp_dir/github_env"
output_key="$tmp_dir/output_key"

cat > "$bundle" <<'EOF'
DEPLOY_HOST=bundle.example.test
DEPLOY_USER=root
NEXT_PUBLIC_API_URL=https://api.example.test?token=a=b
ALLOWED_ORIGINS=https://www.example.test
JWT_SECRET=test-jwt-value
ADMIN_INITIAL_PASSWORD=bundled-password-123
EPLOY_USER=ignored-user
UNSUPPORTED=ignored-value
EOF
cat "$private_key" >> "$bundle"

: > "$github_env"
SSH_HOST=separate.example.test \
  bash "$resolver" "$bundle" "$github_env" "$output_key"

assert_line 'SSH_HOST=separate.example.test' "$github_env"
assert_line 'SSH_USER=root' "$github_env"
assert_line 'SSH_PORT=22' "$github_env"
assert_line 'DEPLOY_PATH=/www/wwwroot/hkba' "$github_env"
assert_line 'BACKEND_PORT=37900' "$github_env"
assert_line 'FRONTEND_PORT=3000' "$github_env"
assert_line 'NEXT_PUBLIC_API_URL=https://api.example.test?token=a=b' "$github_env"
assert_line 'ALLOWED_ORIGINS=https://www.example.test' "$github_env"
assert_line 'JWT_SECRET=test-jwt-value' "$github_env"
assert_line 'ADMIN_INITIAL_PASSWORD=bundled-password-123' "$github_env"
assert_line 'SEED_ON_FIRST_DEPLOY=false' "$github_env"
assert_no_key 'EPLOY_USER' "$github_env"
assert_no_key 'UNSUPPORTED' "$github_env"

ssh-keygen -y -f "$output_key" >/dev/null
head -n 1 "$output_key" | grep -Fqx -- '-----BEGIN OPENSSH PRIVATE KEY-----' \
  || fail 'private key header was not extracted cleanly'
test "$(stat -f '%Lp' "$output_key" 2>/dev/null || stat -c '%a' "$output_key")" = '600' \
  || fail 'private key permissions are not 600'

prefixed_bundle="$tmp_dir/prefixed-bundle"
prefixed_env="$tmp_dir/prefixed-env"
prefixed_key="$tmp_dir/prefixed-key"
{
  printf 'DEPLOY_USER=root\nDEPLOY_SSH_KEY='
  head -n 1 "$private_key"
  tail -n +2 "$private_key"
} > "$prefixed_bundle"
: > "$prefixed_env"
ADMIN_INITIAL_PASSWORD=separate-password-456 \
  bash "$resolver" "$prefixed_bundle" "$prefixed_env" "$prefixed_key"
assert_line 'SSH_USER=root' "$prefixed_env"
assert_line 'ADMIN_INITIAL_PASSWORD=separate-password-456' "$prefixed_env"
ssh-keygen -y -f "$prefixed_key" >/dev/null

missing_bundle="$tmp_dir/missing-key-bundle"
missing_env="$tmp_dir/missing-key-env"
printf 'DEPLOY_USER=root\n' > "$missing_bundle"
printf 'KEEP=this-line\n' > "$missing_env"
if bash "$resolver" "$missing_bundle" "$missing_env" "$tmp_dir/missing-key-output" 2>/dev/null; then
  fail 'bundle without a private key succeeded'
fi
assert_line 'KEEP=this-line' "$missing_env"
test "$(wc -l < "$missing_env" | tr -d ' ')" = '1' \
  || fail 'failed resolution changed the GitHub environment file'

malformed_bundle="$tmp_dir/malformed-key-bundle"
malformed_env="$tmp_dir/malformed-key-env"
malformed_error="$tmp_dir/malformed-key-error"
cat > "$malformed_bundle" <<'EOF'
DEPLOY_USER=root
-----BEGIN OPENSSH PRIVATE KEY-----
not-a-private-key
-----END OPENSSH PRIVATE KEY-----
EOF
: > "$malformed_env"
if bash "$resolver" "$malformed_bundle" "$malformed_env" "$tmp_dir/malformed-key-output" 2>"$malformed_error"; then
  fail 'bundle with a malformed private key succeeded'
fi
grep -Fq 'Private key diagnostics: exact_begin=1 exact_end=1 trimmed_begin=1 trimmed_end=1 embedded_begin=0 literal_newlines=0' "$malformed_error" \
  || fail 'malformed key diagnostics were not reported'
test ! -s "$malformed_env" || fail 'failed resolution exported environment values'
test ! -e "$tmp_dir/malformed-key-output" || fail 'failed resolution left a key file behind'

printf 'All bundled deploy secret tests passed.\n'
