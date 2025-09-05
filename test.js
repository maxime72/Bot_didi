// ====================
// Chargement des variables d'environnement
// ====================
require("dotenv").config();

// ====================
// Dépendances
// ====================
const express = require("express");
const fetch = require("node-fetch"); // obligatoire sur Render
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require("discord.js");

// ====================
// Variables
// ====================
const PANEL_CHANNEL_ID = "1404539663322054718"; // 🐎║ping-perco
const ALERT_CHANNEL_ID = "1402339092385107999"; // 🐎║défense-perco

// Liste des guildes
const guildRoles = [
  "Tempest",
  "YGGDRASIL",
  "Plus Ultra",
  "United cats",
  "Mur Rose",
  "Red Bull",
  "E Q U I N O X",
  "Les Chuchoteurs",
  "Ambitions",
  "D E S T I N Y",
  "TESTAGE DE BOT"
];

// Pour garder un historique des pings
const pingStats = {}; // { pseudo: { roleName: count } }

// ====================
// Serveur Express
// ====================
const app = express();

app.get("/", (req, res) => {
  let html = "<h1>Bot Didi Stats</h1><ul>";
  for (const user in pingStats) {
    html += `<li><b>${user}</b><ul>`;
    for (const role in pingStats[user]) {
      html += `<li>${role}: ${pingStats[user][role]} pings</li>`;
    }
    html += "</ul></li>";
  }
  html += "</ul>";
  res.send(html);
});

app.listen(3000, () => {
  console.log("✅ Web server is running on port 3000");
});

// Keep-alive toutes les 10 min
setInterval(() => {
  fetch("https://bot-didi-h5gm.onrender.com")
    .then(() => console.log("✅ Keep-alive ping envoyé"))
    .catch(err => console.log("❌ Ping failed", err));
}, 10 * 60 * 1000);

// ====================
// Bot Discord
// ====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Pour gérer cooldown par utilisateur et bouton (15s)
const cooldowns = {}; // { customId: { userId: timestamp } }
const COOLDOWN = 15 * 1000;

client.once(Events.ClientReady, async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);

  const channel = await client.channels.fetch(PANEL_CHANNEL_ID);
  if (!channel) return console.error("⚠️ Salon du panneau introuvable !");

  // Vérifier si panneau existe déjà
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

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  const roleName = interaction.customId.replace("alert_", "").replace(/_/g, " ");
  const role = interaction.guild.roles.cache.find(r => r.name === roleName);
  if (!role) return interaction.reply({ content: `⚠️ Rôle **${roleName}** introuvable.`, ephemeral: true });

  // Check cooldown
  const now = Date.now();
  if (!cooldowns[interaction.customId]) cooldowns[interaction.customId] = {};
  if (cooldowns[interaction.customId][interaction.user.id] && now - cooldowns[interaction.customId][interaction.user.id] < COOLDOWN) {
    const remaining = Math.ceil((COOLDOWN - (now - cooldowns[interaction.customId][interaction.user.id])) / 1000);
    return interaction.reply({ content: `⏱️ Vous devez attendre encore ${remaining}s pour alerter ${roleName}.`, ephemeral: true });
  }
  cooldowns[interaction.customId][interaction.user.id] = now;

  // Envoyer alerte
  const alertChannel = await interaction.guild.channels.fetch(ALERT_CHANNEL_ID);
  if (!alertChannel) return interaction.reply({ content: "⚠️ Salon d’alerte introuvable.", ephemeral: true });

  await alertChannel.send({
    content: `🚨 ${role} vous êtes attaqués !`,
    allowedMentions: { roles: [role.id] }
  });

  // Stocker les stats
  const userPseudo = interaction.member.nickname || interaction.user.username;
  if (!pingStats[userPseudo]) pingStats[userPseudo] = {};
  if (!pingStats[userPseudo][roleName]) pingStats[userPseudo][roleName] = 0;
  pingStats[userPseudo][roleName]++;

  await interaction.reply({ content: `✅ Alerte envoyée dans <#${ALERT_CHANNEL_ID}>`, ephemeral: true });
});

// Connexion
client.login(process.env.DISCORD_TOKEN);