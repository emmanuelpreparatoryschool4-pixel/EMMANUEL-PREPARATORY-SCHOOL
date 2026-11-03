# Emmanuel Preparatory School (E.P.S.) — School Management System

School management application for Emmanuel Preparatory School, a basic school in Ghana. The app is managed by school owners and administrators; teacher accounts and teacher-specific workflows are disabled while existing staff and academic data are preserved.

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

The database schema is in [supabase/schema.sql](supabase/schema.sql). In a new Supabase project, open **SQL Editor**, paste the file contents, and run it. For an existing project, do not rerun the full schema. If the database predates the current profile roles, first apply [supabase/role_migration.sql](supabase/role_migration.sql), then run [supabase/upgrade.sql](supabase/upgrade.sql). The upgrade disables teacher-role accounts and teacher RLS policies without deleting staff, class, or assessment history; it also adds class subject assignments, school profile images, report-card review status, score validation, academic-year/term activation, promotion, and payment functions. Staff banking and identity fields are isolated in an admin/owner-only table.

Create the platform admin and school owner accounts in **Authentication > Users** after running the schema. New profiles are inactive (`pending`) until a privileged admin assigns an approved role. Promote each account in the SQL Editor:

```sql
update public.profiles
set role = 'admin'
where email = 'your-admin-email@example.com';

update public.profiles
set role = 'owner'
where email = 'school-owner@example.com';
```

The app uses Supabase Auth for sign-in and loads account profiles from Supabase. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to Vercel (the URL and public anon/publishable key are browser-visible by design). User invitations also require `SUPABASE_SERVICE_ROLE_KEY` as a server-only environment variable. Use [.env.example](.env.example) as a local template. Never add the service-role key to a `NEXT_PUBLIC_` variable.

For local development, create `.env.local` from `.env.example`, replace the URL and anon-key placeholders with the values from **Supabase > Project Settings > API**, then restart `npm run dev`. These two `NEXT_PUBLIC_` values are required for all app reads and writes; the service-role key is only needed for sending account invitations. Never commit `.env.local`.

For password recovery, add `https://YOUR-VERCEL-DOMAIN/profile?password-recovery=1` to Supabase **Authentication > URL Configuration > Redirect URLs**. Add your local URL there too when testing locally.

Disable public sign-ups. The platform admin can invite school owners and administrators; the school owner can invite administrators from **Settings > User Management**. The invitee receives an email to set up access. Add your app's `/login` URL to Supabase **Authentication > URL Configuration > Redirect URLs**.

The app reads and writes school records through Supabase. On first sign-in, the app creates the basic school settings and reference categories. Before registering students, configure an academic year and its terms in **Academics & Results > Academic Configuration**, then create classes and assign subjects. Add finance data after signing in as an owner or administrator. The data adapter maps SQL snake_case columns to the app's TypeScript model fields. Existing IndexedDB records are not migrated automatically. The install control in the sidebar opens the browser's native PWA install prompt when supported; otherwise, users can install through their browser's **Install app** or **Add to Home Screen** option.

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
npm start