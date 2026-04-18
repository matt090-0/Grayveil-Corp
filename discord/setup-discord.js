// ═══════════════════════════════════════════════════════════
// GRAYVEIL CORPORATION — Discord Server Setup Script
// Run once to create all channels, roles, permissions, webhooks
// ═══════════════════════════════════════════════════════════
//
// SETUP:
//   1. npm init -y
//   2. npm install discord.js
//   3. Create .env with: DISCORD_TOKEN=your_bot_token_here
//   4. node setup-discord.js
//
// This script will:
//   - Create 9 roles matching your tier system
//   - Create all category channels with correct permissions
//   - Create text/voice channels under each category
//   - Create webhooks for auto-posting from grayveil.net
//   - Print all webhook URLs for you to paste into Admin → DISCORD
//
// ═══════════════════════════════════════════════════════════

import { Client, GatewayIntentBits, PermissionFlagsBits, ChannelType } from 'discord.js'
import { readFileSync } from 'fs'

// Load token from .env or hardcode it below
let TOKEN = process.env.DISCORD_TOKEN
try {
  const env = readFileSync('.env', 'utf8')
  const match = env.match(/DISCORD_TOKEN=(.+)/)
  if (match) TOKEN = match[1].trim()
} catch {}

if (!TOKEN) {
  console.error('❌ No DISCORD_TOKEN found. Create a .env file with DISCORD_TOKEN=your_token')
  process.exit(1)
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] })

// ═══════════════════════════════════════
// CONFIGURATION — Edit if you want
// ═══════════════════════════════════════

const ORG_NAME = 'Grayveil Corporation'

const ROLES = [
  { name: 'High Admiral',  color: '#d4af6e', hoist: true,  position: 9 },
  { name: 'Admiral',       color: '#9090a8', hoist: true,  position: 8 },
  { name: 'Vice Admiral',  color: '#9090a8', hoist: true,  position: 7 },
  { name: 'Commodore',     color: '#4a90d9', hoist: true,  position: 6 },
  { name: 'Captain',       color: '#4a90d9', hoist: false, position: 5 },
  { name: 'Commander',     color: '#8888a0', hoist: false, position: 4 },
  { name: 'Lieutenant',    color: '#8888a0', hoist: false, position: 3 },
  { name: 'Ensign',        color: '#44445a', hoist: false, position: 2 },
  { name: 'Recruit',       color: '#44445a', hoist: false, position: 1 },
]

// Officer roles (tier 1-4) for permission checks
const OFFICER_ROLES = ['High Admiral', 'Admiral', 'Vice Admiral', 'Commodore']

const CATEGORIES = [
  {
    name: '📌 COMMAND',
    channels: [
      { name: 'announcements', type: 'text', webhook: 'announcements', readonly: true },
      { name: 'operations-feed', type: 'text', webhook: 'operations', readonly: true },
      { name: 'rules', type: 'text', readonly: true },
    ],
  },
  {
    name: '⚔ COMBAT',
    channels: [
      { name: 'combat-general', type: 'text' },
      { name: 'kill-feed', type: 'text', webhook: 'kills' },
      { name: 'bounty-board', type: 'text' },
      { name: 'fleet-comms', type: 'text' },
    ],
  },
  {
    name: '💰 OPERATIONS',
    channels: [
      { name: 'contracts-feed', type: 'text', webhook: 'contracts' },
      { name: 'intel-reports', type: 'text' },
      { name: 'trade-routes', type: 'text' },
      { name: 'mining-ops', type: 'text' },
    ],
  },
  {
    name: '🏛 ORGANISATION',
    channels: [
      { name: 'general', type: 'text' },
      { name: 'recruitment', type: 'text', webhook: 'recruitment' },
      { name: 'promotions', type: 'text', webhook: 'promotions', readonly: true },
      { name: 'off-topic', type: 'text' },
    ],
  },
  {
    name: '🔊 VOICE',
    channels: [
      { name: 'Bridge', type: 'voice' },
      { name: 'Alpha Wing', type: 'voice' },
      { name: 'Bravo Wing', type: 'voice' },
      { name: 'Mining Crew', type: 'voice' },
      { name: 'AFK', type: 'voice' },
    ],
  },
  {
    name: '🔒 OFFICERS',
    officerOnly: true,
    channels: [
      { name: 'officer-chat', type: 'text' },
      { name: 'leadership-planning', type: 'text' },
      { name: 'audit-log', type: 'text' },
    ],
  },
]

// ═══════════════════════════════════════
// SETUP LOGIC
// ═══════════════════════════════════════

client.once('ready', async () => {
  console.log(`\n✅ Logged in as ${client.user.tag}`)

  const guild = client.guilds.cache.first()
  if (!guild) {
    console.error('❌ Bot is not in any server. Use the OAuth2 URL to add it first.')
    process.exit(1)
  }

  console.log(`📡 Setting up server: ${guild.name} (${guild.id})\n`)

  // ── CREATE ROLES ──
  console.log('═══ CREATING ROLES ═══')
  const roleMap = {}
  for (const r of ROLES) {
    const existing = guild.roles.cache.find(role => role.name === r.name)
    if (existing) {
      roleMap[r.name] = existing
      console.log(`  ⏭ Role "${r.name}" already exists`)
    } else {
      const role = await guild.roles.create({
        name: r.name,
        color: r.color,
        hoist: r.hoist,
        reason: 'Grayveil auto-setup',
      })
      roleMap[r.name] = role
      console.log(`  ✅ Created role: ${r.name} (${r.color})`)
    }
  }

  // Reorder roles
  const positions = ROLES.map(r => ({ role: roleMap[r.name].id, position: r.position }))
  try { await guild.roles.setPositions(positions) } catch {}
  console.log('')

  // ── CREATE CHANNELS ──
  console.log('═══ CREATING CHANNELS ═══')
  const webhookUrls = {}

  for (const cat of CATEGORIES) {
    // Create category
    let category = guild.channels.cache.find(c => c.name === cat.name && c.type === ChannelType.GuildCategory)
    if (!category) {
      const permOverwrites = []

      // Officer-only categories
      if (cat.officerOnly) {
        permOverwrites.push({
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
        })
        for (const officerName of OFFICER_ROLES) {
          if (roleMap[officerName]) {
            permOverwrites.push({
              id: roleMap[officerName].id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
            })
          }
        }
      }

      category = await guild.channels.create({
        name: cat.name,
        type: ChannelType.GuildCategory,
        permissionOverwrites: permOverwrites.length > 0 ? permOverwrites : undefined,
        reason: 'Grayveil auto-setup',
      })
      console.log(`  📁 Created category: ${cat.name}`)
    } else {
      console.log(`  ⏭ Category "${cat.name}" already exists`)
    }

    // Create channels in this category
    for (const ch of cat.channels) {
      const channelType = ch.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText
      let channel = guild.channels.cache.find(c => c.name === ch.name && c.parentId === category.id)

      if (!channel) {
        const permOverwrites = []

        // Read-only channels: everyone can view but not send, bot can send
        if (ch.readonly) {
          permOverwrites.push({
            id: guild.id,
            deny: [PermissionFlagsBits.SendMessages],
            allow: [PermissionFlagsBits.ViewChannel],
          })
          // Officers can post
          for (const officerName of OFFICER_ROLES) {
            if (roleMap[officerName]) {
              permOverwrites.push({
                id: roleMap[officerName].id,
                allow: [PermissionFlagsBits.SendMessages],
              })
            }
          }
        }

        channel = await guild.channels.create({
          name: ch.name,
          type: channelType,
          parent: category.id,
          permissionOverwrites: permOverwrites.length > 0 ? permOverwrites : undefined,
          reason: 'Grayveil auto-setup',
        })
        console.log(`    ✅ Created #${ch.name}`)
      } else {
        console.log(`    ⏭ #${ch.name} already exists`)
      }

      // Create webhook if specified
      if (ch.webhook && channelType === ChannelType.GuildText) {
        const existingWebhooks = await channel.fetchWebhooks()
        let webhook = existingWebhooks.find(w => w.name === ORG_NAME)
        if (!webhook) {
          webhook = await channel.createWebhook({ name: ORG_NAME, reason: 'Grayveil auto-posting' })
          console.log(`    🔗 Created webhook for #${ch.name}`)
        }
        webhookUrls[ch.webhook] = webhook.url
      }
    }
    console.log('')
  }

  // ── PRINT RESULTS ──
  console.log('═══════════════════════════════════════════════')
  console.log('  SETUP COMPLETE — GRAYVEIL CORPORATION')
  console.log('═══════════════════════════════════════════════\n')

  console.log('Roles created:', Object.keys(roleMap).length)
  console.log('Webhook URLs (paste these into Admin → DISCORD):\n')

  // Print webhook URLs for easy copying
  for (const [channel, url] of Object.entries(webhookUrls)) {
    console.log(`  ${channel.toUpperCase().padEnd(20)} ${url}`)
  }

  console.log('\n═══════════════════════════════════════════════')
  console.log('SQL to update your Supabase org_settings:')
  console.log('═══════════════════════════════════════════════\n')

  for (const [channel, url] of Object.entries(webhookUrls)) {
    console.log(`UPDATE org_settings SET value = '{"url": "${url}"}' WHERE key = 'discord_webhook_${channel}';`)
  }

  console.log('\n✅ Copy the SQL above and run it in your Supabase SQL Editor.')
  console.log('   Or paste the URLs manually in Admin → DISCORD tab.\n')

  client.destroy()
  process.exit(0)
})

client.login(TOKEN)
