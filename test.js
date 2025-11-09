require("dotenv").config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require("discord.js");

const PANEL_CHANNEL_ID = "ID_DU_SALON_PANNEAU";
const ALERT_CHANNEL_ID = "ID_DU_SALON_ALERTES";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Cooldowns
const cooldowns = new Map();

// ====================
// Liste dynamique des guildes / boutons
// ====================
const guilds = [
  {
    name: "Tempest",
    emoji: "🌪️",
    pingType: "everyone", // "everyone" pour @everyone
    message: "annonce qu'on est attaqué Tempest! 🌪️"
  },
  {
    name: "Test de bot",
    emoji: "🛡️",
    pingType: "role", // ping d’un rôle spécifique
    roleName: "Modérateur Discord",
    message: "a testé le bot !"
  }
  // => Ajouter de nouvelles guildes ici facilement
];

// ====================
// Création du panneau de boutons
// ====================
client.once(Events.ClientReady, async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);

  const panelChannel = await client.channels.fetch(PANEL_CHANNEL_ID);
  if (!panelChannel) return console.error("Salon panneau introuvable !");

  const row = new ActionRowBuilder();

  guilds.forEach(guild => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`alert_${guild.name.replace(/\s+/g, "_")}`)
        .setLabel(`${guild.emoji} ${guild.name}`)
        .setStyle(ButtonStyle.Primary)
    );
  });

  await panelChannel.send({
    content: "📢 **Alerte Guildes**\nCliquez sur le bouton pour envoyer une alerte !",
    components: [row]
  });
});

// ====================
// Gestion des clics
// ====================
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  const userId = interaction.user.id;
  const now = Date.now();

  // Cooldown 5 secondes
  if (cooldowns.has(userId)) {
    const expiration = cooldowns.get(userId);
    if (now < expiration) {
      return interaction.reply({ content: "⏳ Merci d'attendre 5 secondes avant de cliquer à nouveau.", ephemeral: true });
    }
  }
  cooldowns.set(userId, now + 5000);

  const alertChannel = await interaction.guild.channels.fetch(ALERT_CHANNEL_ID);
  if (!alertChannel) return interaction.reply({ content: "⚠️ Salon d'alerte introuvable !", ephemeral: true });

  // Trouver la guilde correspondante
  const guildName = interaction.customId.replace("alert_", "").replace(/_/g, " ");
  const guildConfig = guilds.find(g => g.name === guildName);
  if (!guildConfig) return interaction.reply({ content: "⚠️ Cette guilde n'est pas configurée.", ephemeral: true });

  // Préparer le ping
  let message;
  let allowedMentions = {};

  if (guildConfig.pingType === "everyone") {
    message = `@everyone <@${userId}> ${guildConfig.message}`;
    allowedMentions = { parse: ["everyone", "users"] };
  } else if (guildConfig.pingType === "role") {
    const role = interaction.guild.roles.cache.find(r => r.name === guildConfig.roleName);
    if (!role) return interaction.reply({ content: `⚠️ Le rôle ${guildConfig.roleName} n'existe pas.`, ephemeral: true });
    message = `${role} <@${userId}> ${guildConfig.message}`;
    allowedMentions = { roles: [role.id], users: [userId] };
  }

  await alertChannel.send({ content: message, allowedMentions });
  await interaction.reply({ content: `✅ Alerte envoyée pour **${guildName}** !`, ephemeral: true });
});

client.login(process.env.DISCORD_TOKEN);