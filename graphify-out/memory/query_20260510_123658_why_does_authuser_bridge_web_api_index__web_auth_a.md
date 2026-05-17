---
type: "query"
date: "2026-05-10T12:36:58.010170+00:00"
question: "Why does AuthUser bridge Web API Index, Web Auth API, School Auth Context, Web API Client, and Web Auth Contexts?"
contributor: "graphify"
source_nodes: ["AuthUser", "User", "AuthContext", "OrganizerContext", "SchoolContext"]
---

# Q: Why does AuthUser bridge Web API Index, Web Auth API, School Auth Context, Web API Client, and Web Auth Contexts?

## Answer

AuthUser at web/types/index.ts:33 is a 5-field interface (id, email, full_name, role, school_id?) imported by 5 distinct community modules: lib/auth/context.tsx (admin, c10), lib/auth/organizer-context.tsx (c7), lib/auth/school-context.tsx (c1), lib/api/index.ts (c22), and _src-vite-legacy/context/AuthContext.tsx (c32). It's the structural fingerprint of the Sprint 14 cookie-auth migration: all three portal contexts hydrate from /api/auth/me and type the response as AuthUser. This single shared contract is why the three portals share one cookie session. The User type at line 61 is a strict superset (adds is_active, city, created_at) but no auth context uses it - so the codebase has two near-identical user shapes.

## Source Nodes

- AuthUser
- User
- AuthContext
- OrganizerContext
- SchoolContext