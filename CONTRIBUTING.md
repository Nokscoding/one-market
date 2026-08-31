# Contribution workflow

1. Do not develop large changes directly on `main`.
2. Create a branch, for example `feature/usa-admin-dashboard`.
3. Keep commits small and explicit.
4. Run `npm run build` before opening a Pull Request.
5. In the PR, explain: what changed, which user role is affected, which Supabase tables/policies are touched, and how the change was tested.
6. Do not merge a database/security change without reviewing RLS impact.

Detailed workflow: `docs/12_DEVELOPER_WORKFLOW.md`.
