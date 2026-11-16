# Brief: fix YouTube reconnect dropping the Google refresh token

Repo: `/home/sakkhor/FixAnyPhoto/postiz-fap` (our fork; image `ghcr.io/sakkhor909/postiz-fap`).
Reported by FAP Content Creator, 2026-11-07. Read `AGENTS.md` and the surrounding code first.

## The bug (already verified, do not re-litigate)
`apps/backend/src/api/routes/no.auth.integrations.controller.ts` ~line 131, the reconnect branch:

```
const newAuth = await integrationProvider.reConnect(auth.id, refresh, auth.accessToken);
return res({ ...newAuth, refreshToken: body.refresh });
```

- `auth` is the result of `integrationProvider.authenticate({ code, codeVerifier, refresh: body.refresh })`. For YouTube that call asks Google with `access_type=offline` + `prompt=consent`, so `auth.refreshToken` is Google's real refresh token and `auth.expiresIn` is the real lifetime.
- `newAuth` comes from `reConnect()`, whose return type is `Omit<AuthTokenDetails, 'refreshToken' | 'expiresIn'>`. So the real values are thrown away, and the response puts the **old** `body.refresh` into `refreshToken`.
- Observed result: DB `Integration` youtube row after reconnect has `refreshToken` length 0, `tokenExpiration` 2058 (default `expiresIn` 999999999), `refreshNeeded` false. Access token dies about an hour later: "Please re-authenticate your YouTube account".

## Required fix
1. The reconnect response must carry the **fresh** credentials from `authenticate()`: `refreshToken: auth.refreshToken` and `expiresIn: auth.expiresIn`. `body.refresh` / `refresh` is the old token that was exchanged; it is not the new refresh token.
2. Check what `refresh` is used for before this point and confirm `createOrUpdateIntegration` already receives it separately as `refresh`. Do not remove that.
3. `reConnect()` currently cannot return those two fields because of its declared `Omit` type. Extend the interface `libraries/nestjs-libraries/src/integrations/social/social.integrations.interface.ts` and the providers so a reconnect returns the real `refreshToken` and `expiresIn` when the provider has them.
4. Sweep the sibling providers that implement `reConnect` the same way: `youtube.provider.ts`, `linkedin.page.provider.ts`, `instagram.provider.ts`, `facebook.provider.ts`, `tumblr.provider.ts`, `gmb.provider.ts`. The same omission exists in all of them. Fix each so its reconnect keeps its own refresh token and expiry. If a provider genuinely has no refresh token (for example a short-lived page token), leave it absent and say so in the report.
5. Do not change the `Post` table, the scheduler, or re-send anything. FAP Content Creator requeues the stuck YouTube post.
6. Never print, log or commit a token value.

## Tests and gates
- Unit tests for the controller branch: given `auth.refreshToken = 'new-rt'` and `auth.expiresIn = 3599`, the response has those values, not `body.refresh` / a default.
- Tests for each provider reConnect return shape, where practical.
- Build the backend (whatever the repo's standard build is) and report the exact commands and their tails. TypeScript must be clean.
- Do not run a deploy. Do not push the image. Do not touch the running Postiz containers. The owner decides the deploy after seeing the build.
- Do not restart the gateway or any service.

## Report
Commit-ready file list; the exact diff for the controller branch; which providers you changed and which you left and why; test counts; build command and tail; whether a provider had no refresh token to keep. Do not include token values anywhere.
