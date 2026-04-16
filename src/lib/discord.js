import { supabase } from '../supabaseClient'

// Cache webhook URLs so we don't query on every action
let webhookCache = {}
let cacheTime = 0

async function getWebhookUrl(key) {
  // Refresh cache every 5 minutes
  if (Date.now() - cacheTime > 300000) {
    const { data } = await supabase.from('org_settings').select('key, value').ilike('key', 'discord_webhook_%')
    webhookCache = {}
    ;(data || []).forEach(s => { webhookCache[s.key] = s.value?.url || '' })
    cacheTime = Date.now()
  }
  return webhookCache[`discord_webhook_${key}`] || ''
}

async function send(channel, embed) {
  const url = await getWebhookUrl(channel)
  if (!url) return // No webhook configured for this channel
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Grayveil Corporation',
        avatar_url: 'https://grayveil.net/brand/icon.png',
        embeds: [embed],
      }),
    })
  } catch (e) {
    console.warn('Discord webhook failed:', e.message)
  }
}

// ═══════════════════════════════════════
// FORMATTED MESSAGES
// ═══════════════════════════════════════

export async function discordAnnouncement(title, content, author) {
  await send('announcements', {
    title: `📢 ${title}`,
    description: content.slice(0, 300) + (content.length > 300 ? '...' : ''),
    color: 0xc8a55a,
    footer: { text: `Posted by ${author} · grayveil.net` },
    timestamp: new Date().toISOString(),
  })
}

export async function discordNewOp(title, type, location, time, author) {
  await send('operations', {
    title: `⚔ New Operation: ${title}`,
    fields: [
      { name: 'Type', value: type, inline: true },
      { name: 'Location', value: location || 'TBD', inline: true },
      { name: 'Starts', value: time || 'TBD', inline: true },
    ],
    color: 0x4a7ad9,
    footer: { text: `Scheduled by ${author} · grayveil.net/events` },
    timestamp: new Date().toISOString(),
  })
}

export async function discordKill(killer, target, targetOrg, ship, location, outcome) {
  const color = outcome === 'KILL' ? 0x5ab870 : outcome === 'DEATH' ? 0xc83030 : 0xc8a55a
  await send('kills', {
    title: `${outcome === 'KILL' ? '💀' : outcome === 'DEATH' ? '☠' : '🤝'} ${outcome}`,
    description: `**${killer}** ${outcome === 'KILL' ? 'eliminated' : outcome === 'DEATH' ? 'was killed by' : 'assisted on'} **${target}**${targetOrg ? ` [${targetOrg}]` : ''}`,
    fields: [
      ...(ship ? [{ name: 'Ship', value: ship, inline: true }] : []),
      ...(location ? [{ name: 'Location', value: location, inline: true }] : []),
    ],
    color,
    timestamp: new Date().toISOString(),
  })
}

export async function discordBounty(targetName, reward, poster) {
  await send('kills', {
    title: `🎯 New Bounty: ${targetName}`,
    description: `Reward: **${reward}** aUEC\nPosted by ${poster}`,
    color: 0xe04040,
    footer: { text: 'grayveil.net/bounties' },
    timestamp: new Date().toISOString(),
  })
}

export async function discordContract(title, type, reward, status, author) {
  const isComplete = status === 'COMPLETE'
  await send('contracts', {
    title: `${isComplete ? '✅' : '📋'} Contract ${isComplete ? 'Completed' : 'Posted'}: ${title}`,
    fields: [
      { name: 'Type', value: type, inline: true },
      { name: 'Reward', value: `${reward?.toLocaleString() || 0} aUEC`, inline: true },
    ],
    color: isComplete ? 0x5ab870 : 0xc8a55a,
    footer: { text: `${isComplete ? 'Completed' : 'Posted'} by ${author} · grayveil.net/contracts` },
    timestamp: new Date().toISOString(),
  })
}

export async function discordApplication(handle, message) {
  await send('recruitment', {
    title: `📥 New Application: ${handle}`,
    description: message ? message.slice(0, 200) : 'No message provided.',
    color: 0x4ad9d9,
    footer: { text: 'grayveil.net/recruitment' },
    timestamp: new Date().toISOString(),
  })
}

export async function discordPromotion(handle, newRank, promotedBy) {
  await send('promotions', {
    title: `⬆ Promotion: ${handle}`,
    description: `Promoted to **${newRank}** by ${promotedBy}`,
    color: 0xc8a55a,
    footer: { text: 'grayveil.net/roster' },
    timestamp: new Date().toISOString(),
  })
}

export async function discordMedal(handle, medalName, rarity, awardedBy) {
  const color = rarity === 'LEGENDARY' ? 0xd4af6e : rarity === 'RARE' ? 0x4a7ad9 : rarity === 'UNCOMMON' ? 0x4a9060 : 0x555566
  await send('promotions', {
    title: `🏅 Medal Awarded: ${medalName}`,
    description: `**${handle}** received **${medalName}** [${rarity}]\nAwarded by ${awardedBy}`,
    color,
    footer: { text: 'grayveil.net/medals' },
    timestamp: new Date().toISOString(),
  })
}

export async function discordBountyClaimed(targetName, reward, claimedBy) {
  await send('kills', {
    title: `💰 Bounty Claimed: ${targetName}`,
    description: `**${claimedBy}** claimed the bounty for **${reward}** aUEC`,
    color: 0x5ab870,
    footer: { text: 'grayveil.net/bounties' },
    timestamp: new Date().toISOString(),
  })
}
