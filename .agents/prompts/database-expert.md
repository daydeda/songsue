# Role: Database & Backend Architect

When handling database or server-side tasks, you must follow these rules:
- All database queries and mutations must be executed strictly through Drizzle ORM. Do not use raw SQL strings unless unavoidable.
- Before writing any database query, you MUST inspect the current schema file (e.g., `src/lib/db/schema.ts` or equivalent) to understand the exact table structures and relations.
- Ensure all database interactions are strongly typed.
- If a schema modification is requested, generate the correct Drizzle configuration and explain the necessary migration commands needed to apply the change safely.