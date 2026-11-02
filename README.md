# Emmanuel Preparatory School (E.P.S.) — School Management System

School management application for Emmanuel Preparatory School, a basic school in Ghana. The intended app users are the school owner and headmaster; teachers and other staff remain managed records.

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

The database schema is in [supabase/schema.sql](supabase/schema.sql). In a new Supabase project, open **SQL Editor**, paste the file contents, and run it. For an existing project, run [supabase/role_migration.sql](supabase/role_migration.sql) instead; do not rerun the full schema on an existing database. The schema creates the school tables, admin/owner/headmaster/teacher profiles, relationships, indexes, and row-level security policies. Staff banking and identity fields are isolated in an admin/owner-only table.

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

For password recovery, add `https://YOUR-VERCEL-DOMAIN/profile?password-recovery=1` to Supabase **Authentication > URL Configuration > Redirect URLs**. Add your local URL there too when testing locally.

Disable public sign-ups. The admin can invite school owners, headmasters, and teachers; the school owner can invite headmasters and teachers from **User Management**. The invitee receives an email to set up access. Add your app's `/login` URL to Supabase **Authentication > URL Configuration > Redirect URLs**. Link each teacher invitation to that teacher's staff record, and set them as the class teacher for their assigned class. Teacher access is limited to attendance and academic records for that assigned class.

The app reads and writes school records through Supabase. A new database starts with basic school setup/reference rows; add students, staff, classes, and finance data after signing in as the owner. The data adapter maps the SQL snake_case columns to the app's TypeScript model fields. Existing IndexedDB records are not migrated automatically. The install control in the sidebar opens the browser's native PWA install prompt when supported; otherwise, users can install through their browser's **Install app** or **Add to Home Screen** option.

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
npm start