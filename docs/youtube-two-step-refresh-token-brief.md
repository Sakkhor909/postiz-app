# Brief: re-adding an already-connected two-step channel drops the fresh refresh token

Repo: `/home/sakkhor/FixAnyPhoto/postiz-fap`, branch `fap/comments-inbox` (already synced; do NOT pull again mid-run).
Owner: fap-dev. Ticket: Oggy `01M7QDE49ZKKNA2QDSAK1B65TY`.
Previous related fix: `51fad3f0` (the `reConnect()` path). This is the **two-step page select** path.

## What happened (verified by the reporter, do not re-litigate)

`POST /api/integrations/provider/:id/connect` (frontend calls it after the OAuth callback for a
two-step provider, e.g. YouTube) -> `IntegrationService.saveProviderPage` ->
`IntegrationRepository.updateIntegration`.

1. `POST /api/integrations/social-connect/youtube` creates a fresh `Integration` row keyed by
   `authenticate().id` (the Google user id) with the **fresh** `refreshToken` + `tokenExpiration`.
   For YouTube that row is `inBetweenSteps: true` and `internalId` = Google user id.
2. The user picks a channel in the two-step dialog; `fetchPageInformation` returns the **channel** id.
3. `updateIntegration(id, { internalId: channelId, ... })` finds a pre-existing row with
   `organizationId_internalId = (org, channelId)` (the already-connected channel), renames the fresh
   row to `deleted_<channelId>_<rand>` + soft-deletes it, then updates the **surviving** row with
   only `token` / `picture` / `name` / `internalId` / `profile` / `inBetweenSteps`.
   -> the fresh `refreshToken` and `tokenExpiration` on the renamed row are thrown away.
4. The refresh workflow was started on the **new** row id at step 1, so it exits immediately
   (`deletedAt` is set) and never refreshes the surviving channel.

Measured DB result: surviving channel row has `refreshToken` len 0 and `tokenExpiration` = default
`expiresIn` 999999999 -> year 2058. YouTube publishing dies about an hour later with
"Please re-authenticate your account".

## Required fix

All in `libraries/nestjs-libraries/src/database/prisma/integrations/integration.repository.ts`,
`.../integrations/integration.service.ts` and the two controllers that reach
`saveProviderPage` (`apps/backend/src/api/routes/integrations.controller.ts`,
`apps/backend/src/api/routes/no.auth.integrations.controller.ts`). Read all three first.

### F1. The merge must carry the fresh credentials onto the surviving row

`IntegrationRepository.updateIntegration(id, params)` (around line 151) does the rename + merge.
When it merges into `existing`, merge the credential fields it is about to discard:

- `params.refreshToken` **if it is not null/undefined** (a provider without a refresh token, e.g.
  facebook/instagram page tokens, passes none -> keep the survivor's value, do not blank it);
- `params.tokenExpiration` if `params.expiresIn` is defined.

Do not read or log the value. Never print a token.

Rationale: the fresh row is the OAuth result of this very connect; its refresh token is the one
Google/YouTube just issued. The survivor's own value is by definition older.

### F2. The refresh workflow must end up on the surviving integration

`saveProviderPage` currently returns `{ success: true }` and nobody starts a workflow. After the
merge, start the refresh workflow on the **surviving** row id when the provider has a refresh cron.

- `RefreshIntegrationService.startRefreshWorkflow(orgId, id, provider)` already exists
  (`libraries/nestjs-libraries/src/integrations/refresh.integration.service.ts`). `IntegrationService`
  already injects `RefreshIntegrationService` (forwardRef) and `IntegrationManager`.
- Use `provider.refreshCron` exactly as `startRefreshWorkflow` does. YouTube/GMB/LinkedIn-page/Tumblr
  leave `refreshCron` unset (they are refreshed by the `refreshTokens` command /
  `needsToBeRefreshed`, which filters `deletedAt: null`); threads/instagram.standalone set it `true`.
  A no-op for the unset case is the correct behaviour, not a bug to "fix".
- Use `workflowIdConflictPolicy: 'TERMINATE_EXISTING'` is already in `startRefreshWorkflow`, so a
  second start on the survivor id terminates the stale one -> safe to call on every page select.
- Fire-and-forget with a `.catch()` + a one-line `console.log` of the error only (same pattern as the
  controller's existing call). Do not await it inside the request if that risks the request timing
  out; match the existing pattern.

### F3. Consider upserting instead of duplicating (evaluate, then do the minimal correct thing)

`createOrUpdateIntegration` already upserts on `organizationId_internalId`. The duplicate exists only
because step 1 stores the Google **user** id as `internalId` and step 2 replaces it with the
**channel** id. Changing the add flow to upsert directly on the channel id would require the channel
id at step 1, which a two-step provider does not have yet (that is the whole point of step 2).

So: do NOT restructure the two-step flow. If you find a cheap, obviously-correct way to avoid the
temporary duplicate row, you may do it, but F1+F2 are the required outcome. If you skip F3, say so
in one line.

### F4. Regression test (required)

New vitest spec, e.g.
`libraries/nestjs-libraries/src/database/prisma/integrations/integration.merge.spec.ts`.
The repo runs specs with `npx vitest run <spec>` from the repo root (see `vitest.config.ts`).

Test the real `updateIntegration` merge path with an in-memory fake Prisma model that reproduces the
repository's two writes:

- `findUnique({ where: { organizationId_internalId } })` returns a surviving row
  (`id: 'survivor'`, `refreshToken: 'old-rt'`, `tokenExpiration: <old>`);
- the rename write (`integration.update` where `id === 'fresh'`) records its `data`;
- the merge write (`integration.update` where `id === 'survivor'`) records its `data`.

Assertions:
1. the merge write targets `id === 'survivor'`, not the fresh id;
2. the merge `data` carries `refreshToken === 'fresh-rt'` and a `tokenExpiration` derived from the
   fresh `expiresIn` (assert it is ~now + expiresIn, not the default 999999999);
3. when the caller passes no `refreshToken`/`expiresIn`, the survivor's own values are preserved
   (not blanked, not set to `''` / default);
4. `saveProviderPage` starts the refresh workflow with the **surviving** id (mock
   `IntegrationManager` / `RefreshIntegrationService`; the service is the unit under test).

Keep the existing two specs (`no.auth.integrations.controller.spec.ts`,
`integrations/social/providers.reconnect.spec.ts`) passing unchanged.

## Constraints

- Do NOT deploy, do NOT push the image, do NOT restart any container or service. The owner decides.
- Do NOT run `pnpm build` (frontend) or any build that is known to OOM this host. Backend build only.
- Do NOT touch the `Post` table, the scheduler, or re-send anything.
- Do NOT print, log or commit any token value (not even a fake one in a comment/console.log).
- Keep the diff minimal and inside the files named above. No unrelated refactors, no config edits.
- Commit with explicit paths (`git commit -- <paths>`), never `git add -A`.

## Gates (you own them — run and report)

1. `npx vitest run libraries/nestjs-libraries/src/database/prisma/integrations/integration.merge.spec.ts`
2. `npx vitest run apps/backend/src/api/routes/no.auth.integrations.controller.spec.ts`
3. `npx vitest run libraries/nestjs-libraries/src/integrations/social/providers.reconnect.spec.ts`
4. `pnpm run build:backend` — must exit 0. Report the real tail.

TypeScript must be clean (the build is the typecheck). If a gate fails, fix and re-run.

## Report

Files changed; the exact diff of the merge path (`updateIntegration`) and of `saveProviderPage`; how
F3 was handled; the three test commands with pass counts; the build command and its tail; the
commit id. No token values anywhere.
