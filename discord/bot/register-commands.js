import { REST, Routes, SlashCommandBuilder } from 'discord.js'
import dotenv from 'dotenv'
dotenv.config()

const commands = [
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View org stats or a specific operative')
    .addUserOption(o => o.setName('user').setDescription('Operative to look up (optional)').setRequired(false))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('wallet')
    .setDescription('Check your wallet balance and transaction history')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('contracts')
    .setDescription('List open contracts')
    .addStringOption(o =>
      o.setName('type').setDescription('Filter by type').setRequired(false)
        .addChoices(
          { name: 'Combat', value: 'COMBAT' },
          { name: 'Mining', value: 'MINING' },
          { name: 'Trade', value: 'TRADE' },
          { name: 'Escort', value: 'ESCORT' },
          { name: 'Salvage', value: 'SALVAGE' },
          { name: 'Recon', value: 'RECON' },
        ))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('bounties')
    .setDescription('List active bounties')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('ops')
    .setDescription('List upcoming operations')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('signup')
    .setDescription('Sign up for an operation')
    .addStringOption(o => o.setName('op_id').setDescription('Operation ID (get from /ops)').setRequired(true))
    .addStringOption(o => o.setName('role').setDescription('Role you want to fill').setRequired(false))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Discord account to your Grayveil profile')
    .addStringOption(o => o.setName('handle').setDescription('Your Grayveil handle on the site').setRequired(true))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('roster')
    .setDescription('List active operatives')
    .addStringOption(o => o.setName('division').setDescription('Filter by division').setRequired(false))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Check if someone is on the blacklist')
    .addStringOption(o => o.setName('handle').setDescription('Handle to check').setRequired(true))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('treasury')
    .setDescription('Check org treasury balance')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View rep leaderboard')
    .toJSON(),
]

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN)

try {
  console.log(`Registering ${commands.length} slash commands...`)
  const route = process.env.GUILD_ID
    ? Routes.applicationGuildCommands(process.env.APP_ID, process.env.GUILD_ID)
    : Routes.applicationCommands(process.env.APP_ID)
  const data = await rest.put(route, { body: commands })
  console.log(`✓ Registered ${data.length} commands to ${process.env.GUILD_ID ? 'guild' : 'global'}`)
  console.log(data.map(c => `  /${c.name}`).join('\n'))
} catch (err) {
  console.error('Registration failed:', err)
  process.exit(1)
}
