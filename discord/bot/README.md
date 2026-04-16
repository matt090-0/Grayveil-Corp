# Grayveil Discord Bot

Slash command bot that integrates Discord with grayveil.net. Members can check stats, wallets, contracts, bounties, operations, and sign up for ops without leaving Discord.

## Commands

| Command | Description |
|---------|-------------|
| `/link <handle>` | Link your Discord to your Grayveil account (do this first) |
| `/stats [user]` | Org-wide stats, or personal stats if you tag someone |
| `/wallet` | Your balance and last 5 transactions |
| `/contracts [type]` | List open contracts, optionally filtered by type |
| `/bounties` | List active bounties |
| `/ops` | Upcoming operations with IDs |
| `/signup <op_id> [role]` | Sign up for an operation |
| `/roster [division]` | List active operatives |
| `/blacklist <handle>` | Check if someone is on the wanted list |
| `/treasury` | Org treasury balance and recent activity |
| `/leaderboard` | Top 10 operatives by reputation |

## Setup

### 1. Get your credentials

From **discord.com/developers/applications → Grayveil Bot**:
- **APP_ID** — General Information → Application ID
- **BOT_TOKEN** — Bot → Reset Token → Copy the new token

From **Supabase Dashboard → Settings → API**:
- **SUPABASE_URL** — Project URL
- **SUPABASE_SERVICE_ROLE_KEY** — service_role key (keep secret)

Your **GUILD_ID** is `1493915754997878856` (already set in `.env.example`).

### 2. Install & configure

```bash
cd discord/bot
cp .env.example .env
# Edit .env and paste your BOT_TOKEN and SUPABASE_SERVICE_ROLE_KEY
npm install
```

### 3. Register slash commands

```bash
npm run register
```

This publishes the 11 slash commands to your server. With `GUILD_ID` set, commands are instant; remove it to register globally (can take up to 1 hour to propagate).

### 4. Run the bot

**Locally (for testing):**
```bash
npm start
```

**On Railway (recommended for 24/7):**
1. Sign up at [railway.app](https://railway.app) (free tier works)
2. Create a new project from this `discord/bot` folder
3. Add the 5 env vars from your `.env` file in Railway's Variables tab
4. Deploy — it'll stay running

**On Fly.io (alternative):**
```bash
fly launch
fly secrets set BOT_TOKEN=... APP_ID=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... GUILD_ID=...
fly deploy
```

## Permissions needed in Discord

When inviting the bot to your server, it needs:
- `bot` scope
- `applications.commands` scope
- Permissions: **Send Messages**, **Use Slash Commands**, **Embed Links**

Invite URL template (replace APP_ID):
```
https://discord.com/oauth2/authorize?client_id=APP_ID&scope=bot+applications.commands&permissions=2048
```

## How member linking works

1. Member runs `/link handle:their-grayveil-name`
2. Bot finds their profile by handle and stores their Discord ID on `profiles.discord_id`
3. All subsequent commands (`/wallet`, `/signup`, etc.) look them up by Discord ID

A Discord account can only be linked to one Grayveil profile, and vice versa (UNIQUE constraint).

## Security

- The service role key has full database access — never commit `.env` to git
- Service role bypasses RLS by design; the bot validates auth by matching Discord IDs to profiles
- Public commands (like `/stats` with no user, `/leaderboard`) use the public RPC function that doesn't expose sensitive data

## Troubleshooting

**Commands don't appear?**
- Make sure the bot has `applications.commands` scope
- Run `npm run register` again
- If using global registration (no GUILD_ID), wait up to an hour

**"Application did not respond" error?**
- Check Railway/Fly logs for Supabase errors
- Verify your SUPABASE_SERVICE_ROLE_KEY is the `service_role` key, not the anon key

**Bot shows as offline?**
- Check the token is correct
- Check the process is actually running (Railway → Deployments → Logs)
