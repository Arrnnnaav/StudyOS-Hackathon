# Organization Admin & Publisher Console — Execution Plan

## Authority

Implement the approved three-role model: Master Admin, Organization Admin,
and Student. A student has at most one active organization. Google OAuth
remains the sign-in mechanism and `MASTER_ADMIN_EMAILS` bootstraps platform
administrators. Organization administrators use shareable expiring invite
links or rotating join codes; no email delivery is introduced.

## Tasks

1. Add testable authorization/domain helpers for master-email matching,
   role permission checks, and deterministic Today priority.
2. Add DynamoDB tables, indexes, typed persistence methods, and conditional
   membership/invite/join-code operations. Add local-Dynamo E2E coverage.
3. Add server-enforced organization APIs for master administration, member
   onboarding/removal, publisher lifecycle, assignments, and scoped metrics.
4. Add Master Admin and Organization Admin dashboard surfaces plus an
   organization-aware student Today response.
5. Document operating configuration, validate all checks, and add a future
   roadmap for deliberately deferred enterprise features.

## Non-negotiable behavior

- Master access is an environment allowlist only; it cannot be self-created.
- Every scoped action verifies the caller's organization on the server.
- Removed students keep their personal data but lose organization access.
- Organization admins publish immediately; master admins may unpublish.
- Today priority is: due review, active assigned topic, next assigned topic,
  then the personal curriculum.
