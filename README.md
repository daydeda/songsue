# 🏠 ActiveCAMT — Real-Time Activity & Digital House Points Management Platform

ActiveCAMT is a next-generation web and mobile application designed to modernize student activity registration, secure attendance tracking, and house-based gamification systems for universities. 

Built using a state-of-the-art technical stack (**Next.js 16 + React 19 + Tailwind v4 + Drizzle ORM + NextAuth v5**), it replaces manual paperwork with high-speed **Secure QR Code Check-ins** and dynamic **Server-Sent Events (SSE) Real-Time updates** while ensuring full compliance with personal data protection laws (**PDPA**).

---

## 📄 แผนงานเชิงกลยุทธ์และเอกสารเทคนิค (Strategic & Funding Documents)

To help you pitch this project to university deans, other faculties, or academic committees to request funding, we have provided two comprehensive, professionally formatted documents in Thai directly in the root of this repository:

* **[เอกสารข้อเสนอโครงการเพื่อขอทุนสนับสนุน (Project Funding Proposal) 📄](./project_proposal_th.md)**  
  *Detailed strategic pitch outlining deans' pain points, the gamification value proposition (House Points system), expected student engagement KPIs, and maximum infrastructure cost-efficiency (~500 - 1,000 Baht/month).*
* **[เอกสารข้อกำหนดความต้องการทางซอฟต์แวร์ (Software Requirements Specification - SRS) 🛡️](./srs_document_th.md)**  
  *Rigorous software engineering specification detailing database schemas, NextAuth session updates, strict validation rules (such as 10-digit phone filtering, 9-digit Student ID, and 5MB image upload checks), encrypted medical data handling, and immutable administrative audit trails.*

---

## ✨ คุณสมบัติเด่นของระบบ (Core Features)

* **🛡️ 5MB Profile Picture & Poster Guard:** Strict server-side (`/api/upload`) and client-side image size validations capped at **5MB** to protect local server SSD storage from abuse and ensure instant image loading.
* **📡 SSE Real-Time Leaderboards:** persistent Server-Sent Events (SSE) connections broadcast point allocations and event updates to students' dashboards in **sub-50ms latency** with strict PDPA data filters.
* **🔑 NextAuth Cookie Auto-Sync:** JWT session callback synchronization which dynamically updates browser cookies when onboarding or profiles are updated, letting students log in and proceed instantly without manual logouts.
* **📋 Dynamic Google-Forms-like Builder:** High-fidelity form designer for admins supporting long-text answers, 1-5 star ratings, radio buttons, and multiselect checkboxes. Intercepted by a **Warning Modal** preventing non-attended students from submitting feedback.
* **🔒 Immutable Audit Logs:** Append-only database logs tracking every admin access to sensitive student medical data, ensuring 100% university privacy compliance.

---

## 🛠️ สถาปัตยกรรมและเทคโนโลยีหลัก (Technical Stack)

* **Core Framework:** Next.js 16.2.4 (App Router) + React 19.2 + TypeScript 5
* **Styling (CSS):** Tailwind CSS v4 (CSS-first config in `globals.css` via `@tailwindcss/postcss`)
* **Authentication:** NextAuth v5 (Beta) with `@auth/drizzle-adapter` (Google Provider restricted to `@cmu.ac.th`)
* **Database & ORM:** PostgreSQL + Drizzle ORM v0.45 (`drizzle-kit` v0.31)
* **Form Logic:** `react-hook-form` + `zod` v4 + `@hookform/resolvers`
* **QR Engine:** `html5-qrcode` (Scanner) + `qrcode.react` (Generator)

---

## 🚀 เริ่มต้นใช้งานและพัฒนา (Quickstart & Development)

### 1. การติดตั้ง (Installation)
Clone the repository and install all dependencies:
```bash
npm install
```

### 2. การกำหนดค่าระบบ (Environment Configuration)
Create a `.env` file in the root directory. You can copy the production template and fill out the values:
```bash
cp .env.production.example .env
```

The core required keys in `.env` are:
```env
# Database Connection (Required for Drizzle ORM)
DATABASE_URL="postgresql://activecamt_admin:securepassword@localhost:5432/activecamt_prod?sslmode=require"

# NextAuth v5 Configuration
AUTH_SECRET="your-super-secure-nextauth-secret"
AUTH_URL="http://localhost:3000/api/auth"

# Google OAuth Credentials (Get these from Google Cloud Console)
AUTH_GOOGLE_ID="your-google-oauth-client-id"
AUTH_GOOGLE_SECRET="your-google-oauth-client-secret"

# Self-Hosted PostgreSQL Configuration (Docker-compose database container)
POSTGRES_USER="activecamt_admin"
POSTGRES_PASSWORD="securepassword"
POSTGRES_DB="activecamt_prod"
```

> [!NOTE]
> For a detailed step-by-step tutorial on **"How to Get Each Key"** (generating secure session secrets and setting up Google OAuth Client Credentials specifically for your university domain), please refer directly to the **[Production Environment Variables Template Guide (.env.production.example)](./.env.production.example)**.


### 3. การจัดการฐานข้อมูล (Database Migrations & Operations)
Drizzle commands are configured to manage PostgreSQL schemas seamlessly:
```bash
# Push schema changes directly to DB (Development)
npm run db:push

# Generate SQL migration files from src/db/schema.ts
npm run db:generate

# Execute migration scripts (Production deployment)
npm run db:migrate

# Seed initial database events, houses, and default roles
npm run db:seed

# Open interactive Drizzle Studio UI
npm run db:studio
```

### 4. รันเซิร์ฟเวอร์พัฒนา (Start Development Server)
```bash
npm run dev
# Server will start on http://localhost:3000
```

### 5. การรันบนโปรดักชัน (Production Build)
```bash
# Compile TypeScript and build optimized bundle
npm run build

# Start production server
npm run start
```

---

## 🐳 การใช้งานผ่าน Docker (Docker Containerization Blueprint)

To simplify server deployments and keep the codebase 100% unchanged, you can run the entire platform inside isolated Docker containers:

1. **Build and start containers in the background:**
   ```bash
   docker-compose up -d --build
   ```
2. **Access local server ports:**
   * Next.js web application is exposed on **`http://localhost:3000`**
   * Nginx reverse proxy handles dynamic request redirects and automated Let's Encrypt SSL certificates.

3. **Prune Docker build caches (Recommended monthly cron job):**
   ```bash
   docker system prune -a --volumes -f
   ```

---

## ⚖️ สัญญาอนุญาตและลิขสิทธิ์ (License)

This project is licensed under the **CMU CAMT Academic License** — developed for วิทยาลัยศิลปะ สื่อ และเทคโนโลยี มหาวิทยาลัยเชียงใหม่. All rights reserved.
