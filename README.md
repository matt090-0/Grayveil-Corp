<p align="center">
  <img src="public/favicon.svg" width="80" alt="Grayveil Logo" />
</p>

<h1 align="center">GRAYVEIL CORPORATION</h1>

<p align="center">
  <strong>Private Military & Commercial Enterprise — Star Citizen Org Management Platform</strong>
</p>

<p align="center">
  <em>"Profit is neutral. Everything else is negotiable."</em>
</p>

<p align="center">
  <a href="https://grayveil.net">grayveil.net</a> · React + Supabase · 22 Pages · 28 Database Tables · Full RLS Security
</p>

---

## Overview

Grayveil is a full-stack org management platform built for Star Citizen. It handles everything from daily operations to long-term endgame planning — roster management, fleet tracking, financial systems, internal comms, intelligence filing, contract workflows, and two major endgame projects (a player-built space station and a Bengal carrier).

This isn't a template. It's a live operational system used by a real org.

---

## Features

### Command
- **SITREP Dashboard** — Live org stats, announcements, recent activity, quick action buttons for officers
- **Ops Board** — Schedule operations with type/location/time/slots, RSVP with role + ship, GO LIVE / COMPLETE / CANCEL lifecycle
- **Contracts** — Post, claim, and complete contracts with auto-payout and configurable tax to treasury
- **Kill Board** — PvP engagement feed + K/D/A leaderboard with ship/location/type tracking

### Organisation
- **Roster** — Full member directory with rank badges, click any member to open their operative dossier with stats, medals, certs, and ships. Officers can award medals and grant certs directly from the dossier
- **Fleet** — Ship registry with 160+ Star Citizen vessels, status tracking, assignment, and request system
- **Ship Loadouts** — Component breakdown builds (weapons, shields, QD, powerplant, coolers) with SC ship search
- **Commendations** — 17 medals with custom SVG military-style patches on hex bases, rarity tiers (Common → Legendary), 12 certifications across 7 categories
- **Diplomacy** — Track other orgs as ALLIED / FRIENDLY / NEUTRAL / UNFRIENDLY / HOSTILE / KOS with contacts and notes

### Operations
- **Intelligence** — Clearance-gated intel filing system with classification levels
- **Bank** — Full financial system: treasury, individual wallets, transfers, loans (request/approve/deny/repay), ship crowdfunding, division budgets, configurable tax rate. All financial operations run through server-side PostgreSQL functions
- **Ledger** — Per-member aUEC credit tracking and transaction history
- **Recruitment** — Prospect pipeline from initial contact through vetting to approval, with public application form

### Resources
- **Knowledge Base** — 18 wiki articles across 7 categories (Rules, SOP, Combat, Trade, Mining, Fitting, General) with tier-gated access and pinning
- **Comms** — Internal DM system with conversation list, real-time delivery, unread badges
- **Polls** — Org-wide votes with live results and tier-gated visibility
- **Command Console** — Founder-only admin panel: org vitals, wealth distribution, member management, treasury controls, loan management, full audit log, and 11 danger zone purge operations with double-confirm

### Platform
- **Public Landing Page** — Cinematic dark page with logo, tagline, live member/vessel/contract counts, and Apply CTA
- **Global Search** — Press `/` to search across members, contracts, intel, wiki articles, and kill board entries
- **Mobile Responsive** — Collapsible hamburger sidebar, reflowing grids, touch-friendly on phones
- **Toast Notifications** — Global slide-in toasts for success, error, info, and warning events
- **Real-time** — Supabase subscriptions on activity log, notifications, announcements, contract comments, messages, and transactions
- **Custom SVG Icons** — 18 geometric nav icons, org logo, 17 medal patches, rank badges — no emoji, no icon libraries

---

## Security

This project has been through a full security audit. All critical vulnerabilities have been patched.

- **Row Level Security** on all 28 tables — zero exceptions
- **Self-promotion blocked** — members cannot modify their own tier, rank, wallet balance, founder status, or account status via the client
- **Server-side financial operations** — 6 `SECURITY DEFINER` PostgreSQL functions handle all money movement with atomic balance validation:
  - `transfer_funds` — wallet-to-wallet with balance check
  - `treasury_deposit` — wallet to treasury
  - `treasury_payout` — treasury to wallet (officer-only)
  - `contribute_to_fund` — wallet to ship fund with auto-complete
  - `repay_loan` — wallet to treasury with auto-close
  - `complete_contract` — payout + tax calculation + activity logging
- **DELETE policies** on every table with appropriate tier restrictions
- **Notification spam prevention** — INSERT restricted to tier ≤ 6
- **Transaction integrity** — INSERT restricted, all records created by server functions

---

## Rank & Permission System

| Tier | Rank | Access |
|------|------|--------|
| 1 | **Architect** | Full access. Admin console. Founder-only features. |
| 2 | **Shadow Director** | Near-full access. Manage all divisions and finances. |
| 3 | **Executive Veil** | Division leadership. Contracts, fleet, recruitment, medals. |
| 4 | **Blackline Operator** | Senior operative. Post contracts, manage fleet, lead ops. |
| 5 | **Strategos** | Experienced member. File intel, lead operations. |
| 6 | **Veil Agent** | Full member. Recruitment, intel, diplomacy access. |
| 7 | **Corporate Associate** | Standard access. Contracts, fleet, bank, loadouts. |
| 8 | **Initiate** | Probationary. Limited while being evaluated. |
| 9 | **Grey Contract** | New join. Basic access only. |

---

## Endgame Projects

### PROJECT CITADEL — Player Space Station
Build a modular space station using the Pioneer construction ship. The station serves as Grayveil's permanent HQ, industrial hub, and shipyard. Includes fabrication bays, refinery, hangars, repair facilities, refueling depot, defense grid, and command center.

**Fund target: 25,000,000 aUEC**

### PROJECT SOVEREIGN — Bengal Carrier
Fabricate a Bengal-class carrier (990m, 90+ turrets, full fighter wings) at our space station. The Bengal is built using the crafting pipeline — blueprints, refined materials, and top-tier fabrication modules at the Citadel shipyard.

**Fund target: 50,000,000 aUEC**

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, React Router v6 |
| Backend | Supabase (PostgreSQL, Auth, Realtime, RLS) |
| Styling | Custom CSS design system — no Tailwind, no UI library |
| Icons | Hand-built SVG components (nav, medals, logo, rank badges) |
| Hosting | Vercel |
| Domain | grayveil.net |

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/matt090-0/Grayveil-Corp.git
cd Grayveil-Corp
npm install
```

### 2. Supabase

Create a project at [supabase.com](https://supabase.com). Run `supabase/schema.sql` in the SQL Editor.

### 3. Environment

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run

```bash
npm run dev
```

### 5. First-time Architect setup

Sign up, set your handle, then in Supabase SQL Editor:

```sql
UPDATE public.profiles
SET rank = 'ARCHITECT', tier = 1, is_founder = true
WHERE handle = 'YourHandle';
```

---

## Deployment

```bash
npm run build
```

Deploy `dist/` to Vercel, Netlify, or Cloudflare Pages. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your hosting provider's environment variables.

---

## Database

28 tables with full RLS. Key tables:

`profiles` · `announcements` · `fleet` · `contracts` · `contract_claims` · `contract_comments` · `intelligence` · `ledger` · `recruitment` · `polls` · `poll_votes` · `activity_log` · `notifications` · `fleet_requests` · `invite_links` · `applications` · `org_settings` · `treasury` · `transactions` · `loans` · `ship_funds` · `ship_fund_contributions` · `division_budgets` · `events` · `event_signups` · `medals` · `member_medals` · `certifications` · `member_certifications` · `diplomacy` · `kill_log` · `wiki_articles` · `ship_loadouts` · `messages`

6 server-side RPC functions. Realtime enabled on 6 tables. 9-tier permission system enforced at the database level.

---

<p align="center">
  <strong>GRAYVEIL CORPORATION</strong><br/>
  <em>Stanton System · Est. 2026</em>
</p>
