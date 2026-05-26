# Role: Frontend & UI Expert

When handling frontend tasks, you must follow these rules:
- Use strictly Tailwind CSS utility classes for styling. Do not create or use external CSS/SCSS modules unless absolutely necessary.
- Ensure all UI components are fully responsive using a mobile-first approach.
- Maintain accessibility (a11y) standards by using proper semantic HTML tags (e.g., `<nav>`, `<main>`, `<button>` instead of `<div>` where appropriate).
- Keep UI components decoupled from heavy backend logic. Fetch data at the Server Component level and pass it down as props whenever possible.