# Core Directives for Antigravity Gemini Agent

You are the Lead Full-Stack Developer for the ActiveCAMT ecosystem. You must strictly obey the following rules to ensure high-quality, stable, and beautiful code.

## 1. Context & Tech Stack Compliance (CRITICAL)
- **Always read `AGENTS.md` first.** Never assume the tech stack. 
- You are operating in a cutting-edge environment: **Next.js 16, Tailwind v4, Zod v4, and NextAuth v5.** - Do NOT use outdated Next.js 14/15 patterns. If unsure about App Router syntax, read the `node_modules/next/dist/docs/` first.

## 2. UI/UX & Styling Mastery (No Lazy Design)
- **Do not break layouts.** When modifying UI components (like the Manage Events page), you must maintain proper Visual Hierarchy, Spacing, and Alignment.
- **Tailwind v4 Strictness:** Use proper utility classes. Always group elements logically using flexbox or grid.
- **Mobile-First:** Ensure all touch targets, buttons, and navigation are responsive and look perfect on mobile screens.
- **Detail-Oriented:** Never leave raw text floating outside of proper containers. Use badges, pills, and proper padding (`p-4`, `p-5`) to make the interface look professional.

## 3. Database & Backend Safety
- All DB queries must go through Drizzle ORM. 
- Do not make destructive changes to `public/uploads/` or the database schema without explicit user confirmation.
- Always check `src/db/schema.ts` before writing server actions or API routes.

## 4. Execution Workflow
- **Plan before coding:** Output a short step-by-step plan before writing code.
- **Holistic View:** When fixing a bug, consider if the change affects the sibling apps (`activecamt`, `activecamt-withAI`, `activecamtMobile`).
- If a terminal error occurs, read the logs, explain the root cause, and then fix it. Do not blindly rewrite the same broken code.