# Security Policy

- Never commit secrets, passwords, Supabase `service_role` keys, private API keys, payment secrets or database passwords.
- Browser code may only receive public/publishable keys designed for frontend use.
- Supabase Row Level Security (RLS) is mandatory for user-facing tables.
- Regional admins must be scoped to their assigned market.
- Report suspected credential exposure immediately and rotate the affected secret before any other work.

See `docs/09_SECURITY.md`.
