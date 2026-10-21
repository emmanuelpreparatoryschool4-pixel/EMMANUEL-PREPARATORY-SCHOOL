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

The app is not connected to Supabase yet: sign-in is currently demo authentication and records are stored in browser IndexedDB. Do not enter real school data until Supabase Auth and the app's data layer have been connected. The SQL uses snake_case columns, so the integration must map those names to the app's TypeScript model fields.

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
npm start