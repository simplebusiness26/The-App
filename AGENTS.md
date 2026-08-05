# Xplorer Agent Rules

GitHub is the source of truth. Replit is used to run and preview the active development branch.

## Development branch

`main2.0-Dev` is the only active development branch for Xplorer.

The ordinary `main` branch is outdated and must not be used for development.

All agents must develop, commit and push directly on `main2.0-Dev`.

Do not create feature, fix, UI, database, test or setup branches unless the user explicitly asks for one.

Do not open pull requests unless the user explicitly asks for one.

## Mandatory workflow

1. Fetch the latest remote state.
2. Switch to `main2.0-Dev`.
3. Confirm the repository is using the latest `origin/main2.0-Dev`.
4. Confirm the working tree is clean before starting.
5. Work on one clearly defined task only.
6. Read the relevant code and project instructions before editing.
7. Make changes directly on `main2.0-Dev`.
8. Run all required tests and verification checks.
9. Review the complete diff and confirm no unrelated files changed.
10. Commit the completed work directly to `main2.0-Dev`.
11. Push directly to `origin/main2.0-Dev`.
12. Preview the updated `main2.0-Dev` branch in Replit.

Before editing, report:

- repository
- remote URL
- current branch
- current commit SHA
- origin/main2.0-Dev commit SHA
- working-tree status
- whether local main2.0-Dev is ahead, behind or diverged

If local and remote main2.0-Dev have diverged, do not reset, force-push or discard commits. Inspect the commits and merge them safely.

## Safety rules

- Never commit passwords, private keys, service-role keys or access tokens.
- Never place a Supabase service-role key in the Expo app.
- Do not remove existing functionality unless the task explicitly requires it.
- Do not change database structure without a versioned SQL migration.
- UI-only work must not alter authentication or RLS unless explicitly approved.
- Do not apply migrations to live Supabase without explicit approval.
- Testing work must report `PASS`, `PASS WITH WARNINGS`, or `FAIL` with evidence.

## User feedback rules

- Every successful create, update, approval, rejection, removal or deletion must show a clear confirmation banner.
- Every failed data-changing action must show a clear error banner.
- Confirmation feedback must remain visible after navigation when an action redirects.
- Destructive actions must show a confirmation dialog before the change and a result banner afterwards.
- Use the shared `FeedbackContext`.
- Validation messages may use local alerts when no data change occurred.

## Required review areas

- Build and dependency checks
- Authentication and account permissions
- Listing ownership checks
- Supabase query safety
- RLS and privacy when relevant
- Navigation and loading/error states
- Visible success/error feedback
- Mobile and web preview behaviour
- Backwards compatibility
- No unrelated file changes

## Retained from the previous rules

One rule from the branch-and-pull-request workflow this file replaced still
applies, on the rare occasion the user asks for a pull request:

- Developer agents must not merge their own pull requests.

`RULES.md` is unchanged and still governs how the work itself is done —
vocabulary, privacy gates, scope discipline and commit style. This file is
about where the work lands.
