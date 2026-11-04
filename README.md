# Emmanuel Preparatory School (E.P.S.) — School Management System

School management application for Emmanuel Preparatory School, a basic school in Ghana. The app is managed by school owners, headmasters, and assistant headmasters; teacher accounts and teacher-specific workflows are disabled while existing staff and academic data are preserved.

## Tech Stack

- **Next.js 16** (App Router)
- **TypeScript** (strict mode)
- **Tailwind CSS**
- **React Hook Form** + **Zod** for forms and validation
- **Lucide React** for icons
- **Recharts** for charts and analytics
- **Supabase Auth + PostgreSQL** for authentication and shared school data
- **next-pwa** for Progressive Web App support

## Supabase Setup

The database schema is in [supabase/schema.sql](supabase/schema.sql). In a new Supabase project, open **SQL Editor**, paste the file contents, and run it. For an existing project, do not rerun the full schema. If the database predates the current profile roles, first apply [supabase/role_migration.sql](supabase/role_migration.sql), then run [supabase/upgrade.sql](supabase/upgrade.sql). The upgrade disables teacher-role accounts and teacher RLS policies without deleting staff, class, or assessment history; converts previous admin accounts to Owner; adds the Assistant Headmaster role; and updates permissions, class subject assignments, school profile images, report-card review status, score validation, academic-year/term activation, promotion, and payment functions. Staff banking and identity fields are owner-only.

Create the school owner account in **Authentication > Users** after running the schema. New profiles are inactive (`pending`) until the owner role is assigned. Promote the account in the SQL Editor:

```sql
update public.profiles
set role = 'owner'
where email = 'school-owner@example.com';
```

The app uses Supabase Auth for sign-in and loads account profiles from Supabase. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_APP_URL` (the canonical deployed application URL, with no trailing slash) to Vercel. User invitations also require `SUPABASE_SERVICE_ROLE_KEY` as a server-only environment variable. Use [.env.example](.env.example) as a local template. Never add the service-role key to a `NEXT_PUBLIC_` variable.

For local development, create `.env.local` from `.env.example`, replace the URL and anon-key placeholders with the values from **Supabase > Project Settings > API**, then restart `npm run dev`. These two `NEXT_PUBLIC_` values are required for all app reads and writes; the service-role key is only needed for sending account invitations. Never commit `.env.local`.

For invitation and password recovery links, set `NEXT_PUBLIC_APP_URL` to the production app URL and set Supabase **Authentication > URL Configuration > Site URL** to that same deployed app. Add `https://YOUR-VERCEL-DOMAIN/**` to **Redirect URLs** (and `http://localhost:3000/**` only for local testing). The app sends both password recovery and invitations to `/profile?password-recovery=1` so invitees can set their password; Supabase must allow that destination.

Disable public sign-ups. The school owner can invite Owner, Headmaster, and Assistant Headmaster accounts from **Settings > User Management**. The invitee receives an email to set up access. In Vercel, add `SUPABASE_SERVICE_ROLE_KEY` as an environment variable for the deployment and redeploy after changing it.

The app reads and writes school records through Supabase. On first sign-in, the app creates the basic school settings and reference categories. Before registering students, configure an academic year and its terms in **Academics & Results > Academic Configuration**, then create classes and assign subjects. Add finance data after signing in as an Owner or Headmaster. The data adapter maps SQL snake_case columns to the app's TypeScript model fields. Existing IndexedDB records are not migrated automatically. The install control in the sidebar opens the browser's native PWA install prompt when supported; otherwise, users can install through their browser's **Install app** or **Add to Home Screen** option.

The Owner can use **Settings > School Information > Danger Zone** to permanently reset operational school records. The reset requires typing `RESET` and confirming twice. It removes student, staff, academic, attendance, fee, inventory, and activity records, while preserving school user accounts and school settings. Apply the latest `supabase/upgrade.sql` before using this feature on an existing project.

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
npm start