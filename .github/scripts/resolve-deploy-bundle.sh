#!/usr/bin/env bash

set -euo pipefail

if [ "$#" -ne 3 ]; then
  printf 'Usage: %s BUNDLE_FILE GITHUB_ENV_FILE SSH_KEY_FILE\n' "$0" >&2
  exit 2
fi

bundle_file=$1
github_env_file=$2
ssh_key_file=$3

if [ ! -r "$bundle_file" ]; then
  printf 'Deployment bundle is not readable.\n' >&2
  exit 1
fi

umask 077
env_fragment=$(mktemp "${TMPDIR:-/tmp}/hkba-deploy-env.XXXXXX")
key_candidate="${ssh_key_file}.tmp.$$"
completed=false

cleanup() {
  rm -f "$env_fragment" "$key_candidate"
  if [ "$completed" != true ]; then
    rm -f "$ssh_key_file"
  fi
}
trap cleanup EXIT

bundle_SSH_HOST=''
bundle_SSH_USER=''
bundle_SSH_PORT=''
bundle_DEPLOY_PATH=''
bundle_BACKEND_PORT=''
bundle_FRONTEND_PORT=''
bundle_NEXT_PUBLIC_API_URL=''
bundle_ALLOWED_ORIGINS=''
bundle_JWT_SECRET=''
bundle_ADMIN_INITIAL_PASSWORD=''
bundle_SEED_ON_FIRST_DEPLOY=''

mask_value() {
  if [ -n "$1" ] && [ "${GITHUB_ACTIONS:-}" = true ]; then
    printf '::add-mask::%s\n' "$1"
  fi
}

print_key_diagnostics() {
  awk '
    {
      raw = $0
      sub(/\r$/, "", raw)
      trimmed = raw
      sub(/^[[:space:]]+/, "", trimmed)
      sub(/[[:space:]]+$/, "", trimmed)
      if (raw == "-----BEGIN OPENSSH PRIVATE KEY-----") exact_begin++
      if (raw == "-----END OPENSSH PRIVATE KEY-----") exact_end++
      if (trimmed == "-----BEGIN OPENSSH PRIVATE KEY-----") trimmed_begin++
      if (trimmed == "-----END OPENSSH PRIVATE KEY-----") trimmed_end++
      if (index(raw, "-----BEGIN OPENSSH PRIVATE KEY-----") > 1) embedded_begin = 1
      if (index(raw, "\\n-----BEGIN OPENSSH PRIVATE KEY-----") > 0) literal_newlines = 1
    }
    END {
      printf "Private key diagnostics: exact_begin=%d exact_end=%d trimmed_begin=%d trimmed_end=%d embedded_begin=%d literal_newlines=%d\n", exact_begin, exact_end, trimmed_begin, trimmed_end, embedded_begin, literal_newlines
    }
  ' "$bundle_file" >&2
}

while IFS= read -r line; do
  line=${line%$'\r'}
  case "$line" in
    '-----BEGIN OPENSSH PRIVATE KEY-----'|'DEPLOY_SSH_KEY=-----BEGIN OPENSSH PRIVATE KEY-----') break ;;
  esac

  case "$line" in
    *=*)
      key=${line%%=*}
      value=${line#*=}
      ;;
    *)
      continue
      ;;
  esac

  case "$key" in
    DEPLOY_HOST) bundle_SSH_HOST=$value ;;
    DEPLOY_USER) bundle_SSH_USER=$value ;;
    DEPLOY_PORT) bundle_SSH_PORT=$value ;;
    DEPLOY_PATH) bundle_DEPLOY_PATH=$value ;;
    BACKEND_PORT) bundle_BACKEND_PORT=$value ;;
    FRONTEND_PORT) bundle_FRONTEND_PORT=$value ;;
    NEXT_PUBLIC_API_URL) bundle_NEXT_PUBLIC_API_URL=$value ;;
    ALLOWED_ORIGINS) bundle_ALLOWED_ORIGINS=$value ;;
    JWT_SECRET) bundle_JWT_SECRET=$value ;;
    ADMIN_INITIAL_PASSWORD) bundle_ADMIN_INITIAL_PASSWORD=$value ;;
    SEED_ON_FIRST_DEPLOY) bundle_SEED_ON_FIRST_DEPLOY=$value ;;
    *) continue ;;
  esac

  mask_value "$value"
done < "$bundle_file"

append_resolved() {
  target=$1
  bundle_value=$2
  default_value=$3
  current_value=$(printenv "$target" 2>/dev/null || true)

  if [ -n "$current_value" ]; then
    resolved_value=$current_value
  elif [ -n "$bundle_value" ]; then
    resolved_value=$bundle_value
  else
    resolved_value=$default_value
  fi

  if [ -n "$resolved_value" ]; then
    printf '%s=%s\n' "$target" "$resolved_value" >> "$env_fragment"
  fi
}

append_resolved SSH_HOST "$bundle_SSH_HOST" ''
append_resolved SSH_USER "$bundle_SSH_USER" ''
append_resolved SSH_PORT "$bundle_SSH_PORT" '22'
append_resolved DEPLOY_PATH "$bundle_DEPLOY_PATH" '/www/wwwroot/hkba'
append_resolved BACKEND_PORT "$bundle_BACKEND_PORT" '5002'
append_resolved FRONTEND_PORT "$bundle_FRONTEND_PORT" '5001'
append_resolved NEXT_PUBLIC_API_URL "$bundle_NEXT_PUBLIC_API_URL" ''
append_resolved ALLOWED_ORIGINS "$bundle_ALLOWED_ORIGINS" ''
append_resolved JWT_SECRET "$bundle_JWT_SECRET" ''
append_resolved ADMIN_INITIAL_PASSWORD "$bundle_ADMIN_INITIAL_PASSWORD" ''
append_resolved SEED_ON_FIRST_DEPLOY "$bundle_SEED_ON_FIRST_DEPLOY" 'false'

mkdir -p "$(dirname "$ssh_key_file")"
rm -f "$ssh_key_file" "$key_candidate"
awk '
  {
    sub(/\r$/, "", $0)
    if ($0 == "-----BEGIN OPENSSH PRIVATE KEY-----" || $0 == "DEPLOY_SSH_KEY=-----BEGIN OPENSSH PRIVATE KEY-----") {
      capture = 1
      print "-----BEGIN OPENSSH PRIVATE KEY-----"
      next
    }
    if (capture && $0 == "-----END OPENSSH PRIVATE KEY-----") {
      print
      exit
    }
    if (capture) print
  }
' "$bundle_file" > "$key_candidate"
chmod 600 "$key_candidate"

validation_error=''
if ! validation_error=$(ssh-keygen -y -f "$key_candidate" 2>&1 >/dev/null); then
  print_key_diagnostics
  if [ -n "$validation_error" ]; then
    printf 'OpenSSH validator: %s\n' "$validation_error" >&2
  fi
  printf 'DEPLOY_SSH_KEY does not contain a valid OpenSSH private key.\n' >&2
  exit 1
fi

mv "$key_candidate" "$ssh_key_file"
chmod 600 "$ssh_key_file"
cat "$env_fragment" >> "$github_env_file"
completed=true
