# Emmanuel Preparatory School (E.P.S.) — School Management System

School management application for Emmanuel Preparatory School, a basic school in Ghana. The intended app users are the school owner and headmaster; teachers and other staff remain managed records.

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript** (strict mode)
- **Tailwind CSS**
- **React Hook Form** + **Zod** for forms and validation
- **Lucide React** for icons
- **Recharts** for charts and analytics
- **Dexie.js** (IndexedDB) for offline-first local data
- **next-pwa** for Progressive Web App support

## Supabase Setup

The database schema is in [supabase/schema.sql](supabase/schema.sql). In a new Supabase project, open **SQL Editor**, paste the file contents, and run it. The schema creates the school tables, owner/headmaster profiles, relationships, indexes, and row-level security policies. Staff banking and identity fields are isolated in an owner-only table.

Create the owner and headmaster accounts in **Authentication > Users** after running the schema. New profiles default to `headmaster`; promote the owner's profile by running:

```sql
update public.profiles
set role = 'owner'
where email = 'owner@your-school-domain.com';
```

The app uses Supabase Auth for sign-in and loads account profiles from Supabase. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to Vercel (the URL and public anon/publishable key are browser-visible by design). Use [.env.example](.env.example) as a local template. Never add the service-role key to a `NEXT_PUBLIC_` variable.

Create the owner account in Supabase Auth, then promote its profile with the SQL above. Disable public sign-ups once the owner account exists. Headmaster account creation can be done later by the owner.

School records are still stored in browser IndexedDB; only authentication and account profiles use Supabase at this stage. Do not enter real school data until the rest of the data layer has been migrated and tested. The SQL uses snake_case columns, so that integration must map those names to the app's TypeScript model fields.

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
npm start