import { Client, GatewayIntentBits, PermissionFlagsBits, ChannelType } from 'discord.js'

const TOKEN = 'MTQ5MzkxMjkzMzUzMTY0ODA5MA.GvIKlk.wciied_-Al6xXFw15SvZ3qkqDpBHcNa77LzIHs'

const client = new Client({ intents: [GatewayIntentBits.Guilds] })

const ROLES = [
  { name: 'Architect', color: '#c8a55a', hoist: true },
  { name: 'Shadow Director', color: '#9060c8', hoist: true },
  { name: 'Executive Veil', color: '#4a7ad9', hoist: true },
  { name: 'Blackline Operator', color: '#4a90d9', hoist: true },
  { name: 'Strategos', color: '#5ab870', hoist: false },
  { name: 'Veil Agent', color: '#40b0a0', hoist: false },
  { name: 'Corporate Associate', color: '#8888a0', hoist: false },
  { name: 'Initiate', color: '#666680', hoist: false },
  { name: 'Grey Contract', color: '#555566', hoist: false },
]

const OFFICER_ROLES = ['Architect', 'Shadow Director', 'Executive Veil', 'Blackline Operator']

const CATEGORIES = [
  { name: '📌 COMMAND', channels: [
    { name: 'announcements', type: 'text', webhook: 'announcements', readonly: true },
    { name: 'operations-feed', type: 'text', webhook: 'operations', readonly: true },
    { name: 'rules', type: 'text', readonly: true },
  ]},
  { name: '⚔ COMBAT', channels: [
    { name: 'combat-general', type: 'text' },
    { name: 'kill-feed', type: 'text', webhook: 'kills' },
    { name: 'bounty-board', type: 'text' },
    { name: 'fleet-comms', type: 'text' },
  ]},
  { name: '💰 OPERATIONS', channels: [
    { name: 'contracts-feed', type: 'text', webhook: 'contracts' },
    { name: 'intel-reports', type: 'text' },
    { name: 'trade-routes', type: 'text' },
    { name: 'mining-ops', type: 'text' },
  ]},
  { name: '🏛 ORGANISATION', channels: [
    { name: 'general', type: 'text' },
    { name: 'recruitment', type: 'text', webhook: 'recruitment' },
    { name: 'promotions', type: 'text', webhook: 'promotions', readonly: true },
    { name: 'off-topic', type: 'text' },
  ]},
  { name: '🔊 VOICE', channels: [
    { name: 'Bridge', type: 'voice' },
    { name: 'Alpha Wing', type: 'voice' },
    { name: 'Bravo Wing', type: 'voice' },
    { name: 'Mining Crew', type: 'voice' },
    { name: 'AFK', type: 'voice' },
  ]},
  { name: '🔒 OFFICERS', officerOnly: true, channels: [
    { name: 'officer-chat', type: 'text' },
    { name: 'leadership-planning', type: 'text' },
    { name: 'audit-log', type: 'text' },
  ]},
]

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`)
  const guild = client.guilds.cache.first()
  if (!guild) { console.error('Bot not in any server'); process.exit(1) }
  console.log(`Setting up: ${guild.name}\n`)

  const roleMap = {}
  for (const r of ROLES) {
    const existing = guild.roles.cache.find(role => role.name === r.name)
    if (existing) { roleMap[r.name] = existing; console.log(`  Skip role: ${r.name}`) }
    else {
      roleMap[r.name] = await guild.roles.create({ name: r.name, color: r.color, hoist: r.hoist, reason: 'Grayveil setup' })
      console.log(`  Created role: ${r.name}`)
    }
  }

  console.log('')
  const webhookUrls = {}

  for (const cat of CATEGORIES) {
    let category = guild.channels.cache.find(c => c.name === cat.name && c.type === ChannelType.GuildCategory)
    if (!category) {
      const perms = []
      if (cat.officerOnly) {
        perms.push({ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] })
        for (const n of OFFICER_ROLES) { if (roleMap[n]) perms.push({ id: roleMap[n].id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }) }
      }
      category = await guild.channels.create({ name: cat.name, type: ChannelType.GuildCategory, permissionOverwrites: perms.length > 0 ? perms : undefined, reason: 'Grayveil setup' })
      console.log(`  Created category: ${cat.name}`)
    } else { console.log(`  Skip category: ${cat.name}`) }

    for (const ch of cat.channels) {
      const chType = ch.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText
      let channel = guild.channels.cache.find(c => c.name === ch.name && c.parentId === category.id)
      if (!channel) {
        const perms = []
        if (ch.readonly) {
          perms.push({ id: guild.id, deny: [PermissionFlagsBits.SendMessages], allow: [PermissionFlagsBits.ViewChannel] })
          for (const n of OFFICER_ROLES) { if (roleMap[n]) perms.push({ id: roleMap[n].id, allow: [PermissionFlagsBits.SendMessages] }) }
        }
        channel = await guild.channels.create({ name: ch.name, type: chType, parent: category.id, permissionOverwrites: perms.length > 0 ? perms : undefined, reason: 'Grayveil setup' })
        console.log(`    Created #${ch.name}`)
      } else { console.log(`    Skip #${ch.name}`) }

      if (ch.webhook && chType === ChannelType.GuildText) {
        const existing = await channel.fetchWebhooks()
        let wh = existing.find(w => w.name === 'Grayveil Corporation')
        if (!wh) { wh = await channel.createWebhook({ name: 'Grayveil Corporation', reason: 'Grayveil auto-post' }); console.log(`    Webhook created for #${ch.name}`) }
        webhookUrls[ch.webhook] = wh.url
      }
    }
    console.log('')
  }

  console.log('═══════════════════════════════════════')
  console.log('  SETUP COMPLETE')
  console.log('═══════════════════════════════════════\n')
  console.log('Webhook URLs — paste into Admin > DISCORD:\n')
  for (const [ch, url] of Object.entries(webhookUrls)) {
    console.log(`  ${ch.toUpperCase().padEnd(20)} ${url}`)
  }
  console.log('\n═══════════════════════════════════════')
  console.log('SQL for Supabase:\n')
  for (const [ch, url] of Object.entries(webhookUrls)) {
    console.log(`UPDATE org_settings SET value = '{"url": "${url}"}' WHERE key = 'discord_webhook_${ch}';`)
  }
  console.log('\nDone!')
  client.destroy()
  process.exit(0)
})

client.login(TOKEN)