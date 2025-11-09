// ====================
// Chargement des variables d'environnement
// ====================
require("dotenv").config();

// ====================
// SERVEUR EXPRESS (pour Render)
// ====================
const express = require("express");
const app = express();
app.get("/", (req, res) => res.send("Bot Didi is running!"));
app.listen(3000, () => console.log("✅ Web server is running on port 3000"));

// ====================
// BOT DISCORD
// ====================
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require("discord.js");

const PANEL_CHANNEL_ID = "1404539663322054718"; // 🐎║ping-perco
const ALERT_CHANNEL_ID = "1402339092385107999"; // 🐎║défense-perco

// Liste des guildes
const guildRoles = [
  "Tempest",
  "TESTAGE DE BOT"
];

// Messages personnalisés pour chaque guilde
const guildMessages = {
    "Tempest": "🚨  nous sommes attaquées 🌪️!",
  "TESTAGE DE BOT": "🚨 ceci n' est qu'un test Bisous 😘"
};

// Cooldowns
const cooldowns = new Map();

// Stats mémoire (par guilde)
const stats = {};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once(Events.ClientReady, async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);

  const channel = await client.channels.fetch(PANEL_CHANNEL_ID);
  if (!channel) {
    console.error("⚠️ Salon du panneau introuvable !");
    return;
  }

  // Vérifier si panneau déjà présent
  const messages = await channel.messages.fetch({ limit: 10 });
  const panneauExiste = messages.some(msg => msg.content.includes("📢 **Alerte Guildes**"));
  if (panneauExiste) {
    console.log("ℹ️ Panneau déjà présent, aucun nouvel envoi.");
    return;
  }

  // Créer les boutons
  const rows = [];
  let currentRow = new ActionRowBuilder();

  guildRoles.forEach((roleName, index) => {
    const button = new ButtonBuilder()
      .setCustomId(`alert_${roleName.replace(/\s+/g, "_")}`)
      .setLabel(roleName)
      .setStyle(ButtonStyle.Primary);

    currentRow.addComponents(button);

    if ((index + 1) % 5 === 0 || index === guildRoles.length - 1) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder();
    }
  });

  await channel.send({
    content: "📢 **Alerte Guildes**\nCliquez sur le bouton correspondant à la guilde attaquée pour envoyer une alerte dans 🐎║défense-perco.",
    components: rows
  });

  console.log("✅ Panneau envoyé !");
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  const guildName = interaction.customId.replace("alert_", "").replace(/_/g, " ");
  const userId = interaction.user.id;
  const now = Date.now();

  

  // Stats
  if (!stats[guildName]) stats[guildName] = { total: 0 };
  stats[guildName].total++;

  const alertChannel = await interaction.guild.channels.fetch(ALERT_CHANNEL_ID);
  if (!alertChannel) return;

  // Mention du rôle et message personnalisé
  const role = alertChannel.guild.roles.cache.find(r => r.name === guildName);
  const mention = role ? `<@&${role.id}>` : guildName;
  const message = guildMessages[guildName] ? `${mention} ${guildMessages[guildName]}` : `${mention} Alerte !`;

  await alertChannel.send(message);
  await interaction.reply({ content: `✅ Alerte envoyée pour **${guildName}** !`, flags: 64 });
});

client.login(process.env.DISCORD_TOKEN);