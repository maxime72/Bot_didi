require("dotenv").config();
const express = require("express");
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require("discord.js");

// ====================
// CONFIGURATION
// ====================
const PANEL_CHANNEL_ID = "ID_DU_SALON_PANNEAU"; // Remplace par ton salon panneau
const ALERT_CHANNEL_ID = "ID_DU_SALON_ALERTES";  // Remplace par ton salon d'alerte

// ====================
// SERVEUR EXPRESS (Render)
// ====================
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("Bot Didi is running!"));
app.listen(PORT, () => console.log(`✅ Web server running on port ${PORT}`));

// ====================
// BOT DISCORD
// ====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Cooldowns par utilisateur
const cooldowns = new Map();

// ====================
// Liste dynamique des guildes / boutons
// ====================
const guilds = [
  {
    name: "Tempest",
    emoji: "🌪️",
    pingType: "everyone",
    message: "annonce qu'on est attaqué Tempest! 🌪️"
  },
  {
    name: "Test de bot",
    emoji: "🛡️",
    pingType: "role",
    roleName: "Modérateur discord",
    message: "a testé le bot !"
  }
  // Ajoute facilement de nouvelles guildes ici
];

// ====================
// Création du panneau de boutons
// ====================
client.once(Events.ClientReady, async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);

  const panelChannel = await client.channels.fetch(PANEL_CHANNEL_ID);
  if (!panelChannel) return console.error("⚠️ Salon panneau introuvable !");

  // Vérifier si panneau déjà présent
  const messages = await panelChannel.messages.fetch({ limit: 20 });
  const panneauExiste = messages.some(msg => msg.content.includes("📢 **Alerte Guildes**"));

  if (panneauExiste) {
    console.log("ℹ️ Panneau déjà présent, aucun nouvel envoi.");
    return;
  }

  // Créer les boutons dynamiquement
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

  console.log("✅ Panneau envoyé !");
});

// ====================
// Gestion des clics
// ====================
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  const userId = interaction.user.id;
  const now = Date.now();

  // Cooldown 5 secondes par utilisateur
  if (cooldowns.has(userId)) {
    const expiration = cooldowns.get(userId);
    if (now < expiration) {
      return interaction.reply({ content: "⏳ Merci d'attendre 5 secondes avant de cliquer à nouveau.", ephemeral: true });
    }
  }
  cooldowns.set(userId, now + 5000);

  const alertChannel = await interaction.guild.channels.fetch(ALERT_CHANNEL_ID);
  if (!alertChannel) return interaction.reply({ content: "⚠️ Salon d'alerte introuvable !", ephemeral: true });

  // Identifier la guilde correspondant au bouton
  const guildName = interaction.customId.replace("alert_", "").replace(/_/g, " ");
  const guildConfig = guilds.find(g => g.name === guildName);
  if (!guildConfig) return interaction.reply({ content: "⚠️ Cette guilde n'est pas configurée.", ephemeral: true });

  // Préparer le message et les mentions
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

// ====================
// LOGIN
// ====================
client.login(process.env.DISCORD_TOKEN);