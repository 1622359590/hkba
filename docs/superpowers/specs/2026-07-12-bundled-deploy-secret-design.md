# Bundled Deployment Secret Compatibility Design

Date: 2026-07-12
Project: `/Users/mahao/hkba-club`
Status: Approved for implementation planning

## Goal

Allow `.github/workflows/deploy-baota.yml` to read deployment settings and an OpenSSH private key from the existing multiline `DEPLOY_SSH_KEY` repository secret while preserving compatibility with separately configured repository secrets.

## Supported Bundle Format

The secret may contain zero or more `KEY=VALUE` lines followed by one OpenSSH private key block:

```text
DEPLOY_USER=root
NEXT_PUBLIC_API_URL=http://example.test:37900
ALLOWED_ORIGINS=http://example.test:3000
JWT_SECRET=replace-with-a-random-value
-----BEGIN OPENSSH PRIVATE KEY-----
private-key-data
-----END OPENSSH PRIVATE KEY-----
```

The parser accepts only these configuration keys:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_PORT`
- `DEPLOY_PATH`
- `BACKEND_PORT`
- `FRONTEND_PORT`
- `NEXT_PUBLIC_API_URL`
- `ALLOWED_ORIGINS`
- `JWT_SECRET`
- `SEED_ON_FIRST_DEPLOY`

Unknown keys and blank lines are ignored. `DEPLOY_USER` must be spelled exactly; `EPLOY_USER` is not accepted.

## Resolution Rules

Separately configured GitHub Secrets take precedence. A bundle value is used only when the corresponding job environment variable is empty.

The mapping is:

| Bundle key | Workflow variable |
| --- | --- |
| `DEPLOY_HOST` | `SSH_HOST` |
| `DEPLOY_USER` | `SSH_USER` |
| `DEPLOY_PORT` | `SSH_PORT` |
| `DEPLOY_PATH` | `DEPLOY_PATH` |
| `BACKEND_PORT` | `BACKEND_PORT` |
| `FRONTEND_PORT` | `FRONTEND_PORT` |
| `NEXT_PUBLIC_API_URL` | `NEXT_PUBLIC_API_URL` |
| `ALLOWED_ORIGINS` | `ALLOWED_ORIGINS` |
| `JWT_SECRET` | `JWT_SECRET` |
| `SEED_ON_FIRST_DEPLOY` | `SEED_ON_FIRST_DEPLOY` |

Defaults remain unchanged for optional values when neither a separate Secret nor a bundle value is present.

## Secret Handling

- Write the complete bundle to a temporary runner file with mode `600`.
- Parse only lines before `-----BEGIN OPENSSH PRIVATE KEY-----` as configuration.
- Add every parsed value to GitHub's log masking before exporting it through `GITHUB_ENV`.
- Extract only the first complete OpenSSH private key block into `~/.ssh/hkba_deploy_key`.
- Validate the extracted key with `ssh-keygen -y -f` before running `ssh-keyscan`, `ssh`, or `rsync`.
- Delete the temporary bundle file after SSH configuration.
- Never print configuration values or private key contents.

## Validation And Failure Behavior

After bundle resolution, the workflow still requires:

- `SSH_HOST`
- `SSH_USER`
- `NEXT_PUBLIC_API_URL`
- `ALLOWED_ORIGINS`
- `JWT_SECRET`
- A valid extracted OpenSSH private key

Missing fields produce a concise list of missing workflow variable names. An absent or malformed key fails before the workflow contacts the server.

## Non-goals

- Do not support JSON or YAML bundles.
- Do not parse arbitrary shell syntax or execute bundle content.
- Do not weaken SSH host-key setup or TLS verification.
- Do not change the deployment directory, ports, rsync exclusions, PM2 process names, or build commands.

## Verification

- Validate YAML syntax and shell blocks locally where possible.
- Test the parser with a synthetic bundle containing placeholder values and a disposable test key.
- Confirm separate values override bundle values.
- Confirm unknown and misspelled keys are ignored.
- Confirm the deployment workflow remains active after push.
- Trigger the workflow manually and inspect the first failing or successful step without exposing Secret values.
