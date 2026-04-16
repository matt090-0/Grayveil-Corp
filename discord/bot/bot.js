import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

// ═══════════════════════════════════════════
// GRAYVEIL DISCORD BOT
// Integrates Discord with the Grayveil site
// ═══════════════════════════════════════════

const CHROME = 0xd4d8e0
const GREEN = 0x4db870
const RED = 0xc45a5a
const AMBER = 0xd4943a
const BLUE = 0x4a90d9

// Supabase client with service role (full access)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const client = new Client({ intents: [GatewayIntentBits.Guilds] })

// Helper: find profile by Discord ID
async function findProfileByDiscord(discordId) {
  const { data } = await supabase.from('profiles').select('*').eq('discord_id', discordId).maybeSingle()
  return data
}

// Helper: format credits
function fmtCredits(n) {
  if (!n) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

// Helper: format date
function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// Helper: base embed
function brandedEmbed() {
  return new EmbedBuilder()
    .setColor(CHROME)
    .setFooter({ text: 'GRAYVEIL CORPORATION', iconURL: 'https://grayveil.net/brand/icon.png' })
    .setTimestamp()
}

// ═══════════════════════════════════════════
// COMMAND HANDLERS
// ═══════════════════════════════════════════

const handlers = {
  // ─── /link ─── Connect Discord account to Grayveil profile
  async link(interaction) {
    const handle = interaction.options.getString('handle')
    const discordId = interaction.user.id

    // Find profile by handle
    const { data: profile } = await supabase.from('profiles').select('*').ilike('handle', handle).maybeSingle()
    if (!profile) {
      return interaction.reply({
        embeds: [brandedEmbed().setTitle('❌ PROFILE NOT FOUND').setDescription(`No Grayveil operative with handle **${handle}**.\nCheck spelling and try again.`).setColor(RED)],
        ephemeral: true,
      })
    }

    // Check if already linked to someone else
    if (profile.discord_id && profile.discord_id !== discordId) {
      return interaction.reply({
        embeds: [brandedEmbed().setTitle('❌ ALREADY LINKED').setDescription('This handle is linked to a different Discord account. Contact an officer.').setColor(RED)],
        ephemeral: true,
      })
    }

    // Update link
    await supabase.from('profiles').update({ discord_id: discordId }).eq('id', profile.id)

    return interaction.reply({
      embeds: [brandedEmbed()
        .setTitle('✓ ACCOUNT LINKED')
        .setDescription(`Successfully linked **${profile.handle}** to your Discord.\nYou can now use all Grayveil commands.`)
        .addFields(
          { name: 'TIER', value: `T${profile.tier} · ${profile.rank || 'Operative'}`, inline: true },
          { name: 'DIVISION', value: profile.division || '—', inline: true },
          { name: 'REP', value: String(profile.rep_score || 0), inline: true },
        )
        .setColor(GREEN)],
      ephemeral: true,
    })
  },

  // ─── /stats ─── View org or operative stats
  async stats(interaction) {
    const user = interaction.options.getUser('user')

    if (user) {
      const profile = await findProfileByDiscord(user.id)
      if (!profile) {
        return interaction.reply({
          embeds: [brandedEmbed().setTitle('❌ NOT LINKED').setDescription(`${user.username} has not linked their Grayveil account.`).setColor(RED)],
          ephemeral: true,
        })
      }
      // Count their stats
      const [{ count: kills }, { count: medals }, { count: contracts }] = await Promise.all([
        supabase.from('kill_log').select('*', { count: 'exact', head: true }).eq('reporter_id', profile.id).eq('outcome', 'KILL'),
        supabase.from('member_medals').select('*', { count: 'exact', head: true }).eq('member_id', profile.id),
        supabase.from('contract_claims').select('*', { count: 'exact', head: true }).eq('member_id', profile.id),
      ])
      return interaction.reply({
        embeds: [brandedEmbed()
          .setTitle(`📊 ${profile.handle}`)
          .setDescription(profile.motto ? `*"${profile.motto}"*` : null)
          .addFields(
            { name: 'RANK', value: `T${profile.tier} · ${profile.rank || '—'}`, inline: true },
            { name: 'DIVISION', value: profile.division || '—', inline: true },
            { name: 'REPUTATION', value: String(profile.rep_score || 0), inline: true },
            { name: 'KILLS', value: String(kills || 0), inline: true },
            { name: 'MEDALS', value: String(medals || 0), inline: true },
            { name: 'CONTRACTS', value: String(contracts || 0), inline: true },
            { name: 'WALLET', value: `${fmtCredits(profile.wallet_balance)} aUEC`, inline: true },
          )],
      })
    }

    // Org stats
    const { data: stats } = await supabase.rpc('get_public_org_stats')
    return interaction.reply({
      embeds: [brandedEmbed()
        .setTitle('📊 GRAYVEIL CORPORATION')
        .setDescription('*Profit is neutral. Everything else is negotiable.*')
        .addFields(
          { name: 'OPERATIVES', value: String(stats?.members || 0), inline: true },
          { name: 'VESSELS', value: String(stats?.ships || 0), inline: true },
          { name: 'CONTRACTS', value: String(stats?.contracts_completed || 0), inline: true },
          { name: 'KILLS', value: String(stats?.kills || 0), inline: true },
          { name: 'BOUNTIES', value: String(stats?.bounties_claimed || 0), inline: true },
          { name: 'OPERATIONS', value: String(stats?.operations_run || 0), inline: true },
          { name: 'MEDALS AWARDED', value: String(stats?.medals_awarded || 0), inline: true },
          { name: 'TREASURY', value: `${fmtCredits(stats?.treasury)} aUEC`, inline: true },
        )
        .setURL('https://grayveil.net/org')],
    })
  },

  // ─── /wallet ─── Check personal wallet
  async wallet(interaction) {
    const profile = await findProfileByDiscord(interaction.user.id)
    if (!profile) {
      return interaction.reply({
        embeds: [brandedEmbed().setTitle('❌ NOT LINKED').setDescription('Use `/link <handle>` to connect your account first.').setColor(RED)],
        ephemeral: true,
      })
    }
    const { data: txs } = await supabase.from('transactions')
      .select('*').or(`performed_by.eq.${profile.id},recipient_id.eq.${profile.id}`)
      .order('created_at', { ascending: false }).limit(5)
    const txLines = (txs || []).map(t => {
      const isIncoming = t.recipient_id === profile.id
      const prefix = isIncoming ? '+' : '-'
      return `\`${prefix}${fmtCredits(t.amount)}\` ${t.description?.slice(0, 40) || t.type}`
    }).join('\n') || '*No recent transactions*'

    return interaction.reply({
      embeds: [brandedEmbed()
        .setTitle(`💰 ${profile.handle}'s WALLET`)
        .addFields(
          { name: 'BALANCE', value: `**${fmtCredits(profile.wallet_balance)} aUEC**`, inline: true },
          { name: 'TIER', value: `T${profile.tier}`, inline: true },
          { name: 'RECENT TRANSACTIONS', value: txLines },
        )],
      ephemeral: true,
    })
  },

  // ─── /contracts ─── List open contracts
  async contracts(interaction) {
    const type = interaction.options.getString('type')
    let query = supabase.from('contracts').select('*').eq('status', 'OPEN').order('created_at', { ascending: false }).limit(10)
    if (type) query = query.eq('contract_type', type)
    const { data: contracts } = await query

    if (!contracts || contracts.length === 0) {
      return interaction.reply({
        embeds: [brandedEmbed().setTitle('📋 CONTRACTS').setDescription(`No open ${type ? type.toLowerCase() + ' ' : ''}contracts at this time.`)],
      })
    }

    const list = contracts.map(c =>
      `**${c.title}** · \`${c.contract_type}\`\n└ 💰 ${fmtCredits(c.reward)} aUEC · 📍 ${c.location || '—'} · Min T${c.min_tier}`
    ).join('\n\n')

    return interaction.reply({
      embeds: [brandedEmbed()
        .setTitle(`📋 OPEN CONTRACTS ${type ? `· ${type}` : ''}`)
        .setDescription(list)
        .setURL('https://grayveil.net/contracts')],
    })
  },

  // ─── /bounties ─── List active bounties
  async bounties(interaction) {
    const { data: bounties } = await supabase.from('bounties').select('*').eq('status', 'ACTIVE').order('reward', { ascending: false }).limit(10)
    if (!bounties || bounties.length === 0) {
      return interaction.reply({ embeds: [brandedEmbed().setTitle('🎯 BOUNTIES').setDescription('No active bounties.')] })
    }
    const list = bounties.map(b =>
      `**${b.target_name}** ${b.target_org ? `@ ${b.target_org}` : ''}\n└ 💰 ${fmtCredits(b.reward)} aUEC · ${b.threat_level || 'UNKNOWN'}`
    ).join('\n\n')
    return interaction.reply({
      embeds: [brandedEmbed().setTitle('🎯 ACTIVE BOUNTIES').setDescription(list).setURL('https://grayveil.net/bounties')],
    })
  },

  // ─── /ops ─── List upcoming operations
  async ops(interaction) {
    const { data: events } = await supabase.from('events')
      .select('*, organizer:profiles(handle)')
      .gte('starts_at', new Date().toISOString())
      .eq('status', 'SCHEDULED')
      .order('starts_at').limit(10)

    if (!events || events.length === 0) {
      return interaction.reply({ embeds: [brandedEmbed().setTitle('📅 OPERATIONS').setDescription('No scheduled operations.')] })
    }

    const list = events.map(e =>
      `**${e.title}** · \`${e.event_type}\`\n└ 🕐 ${fmtDate(e.starts_at)} · 📍 ${e.location || 'TBD'}\n└ ID: \`${e.id.slice(0, 8)}\` · By ${e.organizer?.handle || '—'}`
    ).join('\n\n')

    return interaction.reply({
      embeds: [brandedEmbed()
        .setTitle('📅 UPCOMING OPERATIONS')
        .setDescription(list + '\n\n*Use `/signup op_id:<ID>` to register*')
        .setURL('https://grayveil.net/events')],
    })
  },

  // ─── /signup ─── Sign up for an operation
  async signup(interaction) {
    const profile = await findProfileByDiscord(interaction.user.id)
    if (!profile) {
      return interaction.reply({
        embeds: [brandedEmbed().setTitle('❌ NOT LINKED').setDescription('Use `/link <handle>` first.').setColor(RED)],
        ephemeral: true,
      })
    }

    const opId = interaction.options.getString('op_id')
    const role = interaction.options.getString('role')

    // Match short ID or full
    const { data: events } = await supabase.from('events').select('*').like('id', `${opId}%`).limit(1)
    const event = events?.[0]
    if (!event) {
      return interaction.reply({ embeds: [brandedEmbed().setTitle('❌ OP NOT FOUND').setDescription('Check the ID from `/ops`.').setColor(RED)], ephemeral: true })
    }

    // Check if already signed up
    const { data: existing } = await supabase.from('event_signups').select('*').eq('event_id', event.id).eq('member_id', profile.id).maybeSingle()
    if (existing) {
      return interaction.reply({ embeds: [brandedEmbed().setTitle('⚠ ALREADY SIGNED UP').setDescription(`You're already registered for **${event.title}**.`).setColor(AMBER)], ephemeral: true })
    }

    // Register
    await supabase.from('event_signups').insert({ event_id: event.id, member_id: profile.id, role: role || null })

    return interaction.reply({
      embeds: [brandedEmbed()
        .setTitle('✓ SIGNED UP')
        .setDescription(`You're registered for **${event.title}**.`)
        .addFields(
          { name: 'START', value: fmtDate(event.starts_at), inline: true },
          { name: 'LOCATION', value: event.location || 'TBD', inline: true },
          ...(role ? [{ name: 'ROLE', value: role, inline: true }] : []),
        )
        .setColor(GREEN)],
    })
  },

  // ─── /roster ─── List active members
  async roster(interaction) {
    const division = interaction.options.getString('division')
    let query = supabase.from('profiles').select('handle, rank, tier, division, rep_score').eq('status', 'ACTIVE').order('tier').order('rep_score', { ascending: false }).limit(20)
    if (division) query = query.ilike('division', `%${division}%`)
    const { data: members } = await query

    if (!members || members.length === 0) {
      return interaction.reply({ embeds: [brandedEmbed().setTitle('👥 ROSTER').setDescription('No operatives match.')] })
    }

    const list = members.map(m => `**${m.handle}** · T${m.tier} ${m.rank || ''}${m.division ? ` · ${m.division}` : ''} · ${m.rep_score || 0} rep`).join('\n')

    return interaction.reply({
      embeds: [brandedEmbed()
        .setTitle(`👥 ROSTER ${division ? `· ${division.toUpperCase()}` : ''}`)
        .setDescription(list)
        .setURL('https://grayveil.net/roster')],
    })
  },

  // ─── /blacklist ─── Check blacklist
  async blacklist(interaction) {
    const handle = interaction.options.getString('handle')
    const { data: entries } = await supabase.from('blacklist').select('*').ilike('target_handle', `%${handle}%`).eq('status', 'ACTIVE').limit(5)

    if (!entries || entries.length === 0) {
      return interaction.reply({
        embeds: [brandedEmbed().setTitle('✓ CLEAR').setDescription(`**${handle}** is not on the blacklist.`).setColor(GREEN)],
      })
    }

    const threatColors = { LOW: '⚪', MODERATE: '🟡', HIGH: '🟠', CRITICAL: '🔴' }
    const list = entries.map(e =>
      `${threatColors[e.threat_level] || '⚫'} **${e.target_handle}**${e.target_org ? ` @ ${e.target_org}` : ''}\n└ ${e.category} · ${e.threat_level}${e.bounty_offered > 0 ? ` · 💰 ${fmtCredits(e.bounty_offered)} aUEC` : ''}\n└ ${e.reason.slice(0, 120)}${e.reason.length > 120 ? '...' : ''}`
    ).join('\n\n')

    return interaction.reply({
      embeds: [brandedEmbed().setTitle('⚠ BLACKLIST MATCH').setDescription(list).setColor(RED).setURL('https://grayveil.net/blacklist')],
    })
  },

  // ─── /treasury ─── Org treasury status
  async treasury(interaction) {
    const { data: t } = await supabase.from('treasury').select('*').limit(1).single()
    const { data: recent } = await supabase.from('transactions').select('*, performer:profiles(handle)').order('created_at', { ascending: false }).limit(5)
    const txList = (recent || []).map(tx =>
      `\`${tx.type === 'DEPOSIT' ? '+' : '-'}${fmtCredits(tx.amount)}\` ${tx.description?.slice(0, 50) || tx.type}`
    ).join('\n') || '*No transactions*'

    return interaction.reply({
      embeds: [brandedEmbed()
        .setTitle('🏦 ORG TREASURY')
        .addFields(
          { name: 'BALANCE', value: `**${fmtCredits(t?.balance)} aUEC**`, inline: true },
          { name: 'TAX RATE', value: `${t?.tax_rate || 0}%`, inline: true },
          { name: 'RECENT ACTIVITY', value: txList },
        )
        .setURL('https://grayveil.net/bank')],
    })
  },

  // ─── /leaderboard ─── Top reputation
  async leaderboard(interaction) {
    const { data: top } = await supabase.from('profiles').select('handle, rep_score, tier, division').eq('status', 'ACTIVE').order('rep_score', { ascending: false }).limit(10)
    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']
    const list = (top || []).map((m, i) =>
      `${medals[i]} **${m.handle}** · ${m.rep_score} rep · T${m.tier}${m.division ? ` · ${m.division}` : ''}`
    ).join('\n')

    return interaction.reply({
      embeds: [brandedEmbed().setTitle('🏆 REPUTATION LEADERBOARD').setDescription(list || '*No data*').setURL('https://grayveil.net/reputation')],
    })
  },
}

// ═══════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════

client.once('ready', () => {
  console.log(`✓ Grayveil Bot online as ${client.user.tag}`)
  console.log(`  Serving ${client.guilds.cache.size} server(s)`)
  client.user.setPresence({ activities: [{ name: 'Stanton system', type: 3 }], status: 'online' })
})

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return
  const handler = handlers[interaction.commandName]
  if (!handler) return
  try {
    await handler(interaction)
  } catch (err) {
    console.error(`Error in /${interaction.commandName}:`, err)
    const errEmbed = brandedEmbed().setTitle('❌ ERROR').setDescription('Something went wrong. Officers have been notified.').setColor(RED)
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ embeds: [errEmbed], ephemeral: true })
    } else {
      await interaction.reply({ embeds: [errEmbed], ephemeral: true })
    }
  }
})

client.login(process.env.BOT_TOKEN)
