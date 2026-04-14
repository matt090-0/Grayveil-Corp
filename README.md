# GRAYVEIL CORPORATION — Internal Operations Hub

> "Profit is neutral. Everything else is negotiable."

A full-stack React + Supabase org management application for Star Citizen.

---

## Features

- **SITREP** — Live dashboard with org stats, announcements, and active contracts
- **Roster** — Full member directory with rank management
- **Fleet** — Ship registry with status and assignment tracking
- **Contracts** — Post, claim, and complete operation contracts
- **Intelligence** — Clearance-gated intel filing system
- **Ledger** — Per-member aUEC credit tracking
- **Recruitment** — Prospect pipeline from contact to approval
- **Polls** — Org-wide votes with live results
- **Profile** — Personal operative record

---

## Setup

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com) → New project.  
Save your **Project URL** and **anon public key** from Project Settings → API.

### 2. Run the database schema

In your Supabase dashboard, go to **SQL Editor** and run the entire contents of `supabase/schema.sql`.

### 3. Configure environment variables

Copy `.env.example` to `.env`:

```
cp .env.example .env
```

Fill in your values:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Install dependencies and run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## First-time setup as Architect (SearthNox)

1. Click **Request Access** and sign up with your email
2. Confirm your email (check inbox)
3. Sign in and set your handle to `SearthNox`
4. Go back to your Supabase **SQL Editor** and run:

```sql
UPDATE public.profiles
SET rank = 'ARCHITECT', tier = 1, is_founder = true
WHERE handle = 'SearthNox';
```

5. Refresh the app — you now have full Architect access

---

## How members join

1. They go to your hosted URL (see Deployment below)
2. Click **Request Access**, sign up, confirm email
3. Set their handle
4. They start as **GREY CONTRACT** (Tier 9)
5. You promote them via the Roster page

---

## Deployment

Build for production:

```bash
npm run build
```

The `dist/` folder can be deployed to any static host:
- [Vercel](https://vercel.com) — `npm i -g vercel && vercel`
- [Netlify](https://netlify.com) — drag and drop `dist/`
- [Cloudflare Pages](https://pages.cloudflare.com) — connect your repo

Remember to set the environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in your hosting provider's dashboard.

---

## Rank & Permission System

| Tier | Rank               | Key Capabilities                                    |
|------|--------------------|-----------------------------------------------------|
| 1    | Architect          | Full access, all admin functions                    |
| 2    | Shadow Director    | Near-full access, manage all divisions              |
| 3    | Executive Veil     | Division oversight, promote up to Blackline         |
| 4    | Blackline Operator | Post contracts, manage fleet, add ledger entries    |
| 5    | Strategos          | File intel, lead operations                         |
| 6    | Veil Agent         | File open/restricted intel, recruit prospects       |
| 7    | Corporate Associate| Standard member access                              |
| 8    | Initiate           | Standard member access                              |
| 9    | Grey Contract      | Basic comms only                                    |

---

## Tech Stack

- **React 18** + **Vite**
- **Supabase** (Auth + PostgreSQL + Row Level Security)
- **React Router v6**
- Custom CSS design system (no Tailwind dependency)
