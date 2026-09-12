# Security policy

## Supported versions

Only the latest release on npm receives fixes. There are no maintenance
branches for older versions.

## Reporting a vulnerability

Report privately through GitHub Security Advisories:

https://github.com/temich/pupumber/security/advisories/new

Please do not open a public issue for a vulnerability. Expect an acknowledgement
within a week; if a report is confirmed, the fix ships in the next release and
the advisory is published once it is available on npm.

## Release integrity

Releases are published from the `release` branch by GitHub Actions, which
authenticates to npm over OIDC (npm trusted publishing) rather than a
long-lived token. Every published version carries a provenance attestation
linking it to the workflow run and commit that built it:

```sh
npm audit signatures
```
