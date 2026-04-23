import { supabase } from '../supabaseClient'
import { captureException } from './sentry'

// Webhook sends go through the server-side post_discord_webhook RPC so the
// webhook URL never leaves the database. Per-channel batching collapses
// bursts (e.g. 10 kill-log rows → 10 medal triggers) into one HTTP call
// (Discord accepts up to 10 embeds per payload).
const BATCH_SIZE = 5
const BATCH_MS   = 1500
const queues = new Map()

async function flush(channel) {
  const entry = queues.get(channel)
  if (!entry || entry.embeds.length === 0) return
  if (entry.timer) { clearTimeout(entry.timer); entry.timer = null }
  const batch = entry.embeds.splice(0, BATCH_SIZE)
  try {
    const { error } = await supabase.rpc('post_discord_webhook', {
      p_channel: channel,
      p_payload: {
        username: 'Grayveil Corporation',
        avatar_url: 'https://grayveil.net/brand/icon.png',
        embeds: batch,
      },
    })
    if (error) captureException(new Error(`Discord webhook ${channel}: ${error.message}`), { channel, count: batch.length })
  } catch (e) {
    captureException(e, { channel, count: batch.length })
  }
  if (entry.embeds.length > 0) schedule(channel, entry)
}

function schedule(channel, entry) {
  if (entry.embeds.length >= BATCH_SIZE) { flush(channel); return }
  if (entry.timer) return
  entry.timer = setTimeout(() => { entry.timer = null; flush(channel) }, BATCH_MS)
}

async function send(channel, embed) {
  let entry = queues.get(channel)
  if (!entry) { entry = { embeds: [], timer: null }; queues.set(channel, entry) }
  entry.embeds.push(embed)
  schedule(channel, entry)
}

// Server-side test — founder-only RPC posts a canned test payload to the
// named channel. Returns the new net.http_request row id on success.
export async function testDiscordWebhook(channel) {
  const { data, error } = await supabase.rpc('test_discord_webhook', { p_channel: channel })
  if (error) throw error
  return data
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

export async function discordModeration(action, memberHandle, reason, actor, extra = {}) {
  const lines = [`Member: **${memberHandle}**`, `Reason: ${reason}`]
  if (extra.days) lines.push(`Duration: ${extra.days}d`)
  if (extra.suspended_until) lines.push(`Until: ${new Date(extra.suspended_until).toLocaleString()}`)
  if (extra.strike_count !== undefined) lines.push(`Strikes: ${extra.strike_count}`)
  await send('moderation', {
    title: `⚖ ${action}`,
    description: lines.join('\n'),
    color: action === 'BAN' ? 0xd64545 : action === 'SUSPEND' ? 0xd48b3a : 0x4aa3d4,
    footer: { text: `By ${actor}` },
    timestamp: new Date().toISOString(),
  })
}
