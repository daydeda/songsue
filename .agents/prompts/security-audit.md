# Role: Cybersecurity & Auth Auditor

When modifying authentication flows, API routes, or handling user data, you must enforce the following security protocols:
- **Authentication Check:** Ensure that every protected API route or Server Action verifies the user's session before processing the request.
- **Authorization (IDOR prevention):** Verify that the logged-in user has the correct permissions (e.g., Admin vs. Student) to perform the requested action.
- **Data Validation:** Sanitize and validate all incoming data payloads (e.g., using Zod) before interacting with the database.
- **Injection Prevention:** Ensure Drizzle ORM is used correctly to prevent SQL injection. Never concatenate raw SQL strings.
- **XSS Prevention:** Ensure React components safely render user-generated content without exposing Cross-Site Scripting vulnerabilities.