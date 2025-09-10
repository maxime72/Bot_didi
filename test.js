// ====================
// Chargement des variables d'environnement
// ====================
require("dotenv").config();
const fs = require("fs");

// ====================
// SERVEUR EXPRESS (pour Render)
// ====================
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot Didi is running!");
});

app.listen(3000, () => {
  console.log("✅ Web server is running on port 3000");
});

// ====================
// KEEP-ALIVE (Ping toutes les 10 min)
// ====================
const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));
setInterval(() => {
  fetch("https://bot-didi-h5gm.onrender.com").catch(err =>
    console.log("Ping failed", err)
  );
}, 10 * 60 * 1000);

// ====================
// BOT DISCORD
// ====================
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require("discord.js");

const PANEL_CHANNEL_ID = "1404539663322054718"; // 🐎║ping-perco
const ALERT_CHANNEL_ID = "1402339092385107999"; // 🐎║défense-perco

// ====================
// Guildes
// ====================
const guildRoles = [
  "Tempest",
  "YGGDRASIL",
  "Plus Ultra",
  "Red Bull",
  "E Q U I N O X",
  "Les Chuchoteurs",
  "Ambitions",
  "D E S T I N Y",
  "TESTAGE DE BOT"
];

// ====================
// Messages personnalisés par guilde
// ====================
const customMessages = {
  "Tempest": "🚨 @Tempest vous êtes attaqués 🌪️!",
  "YGGDRASIL": "🚨 @YGGDRASIL vous êtes attaqués !",
  "Plus Ultra": "🚨 @Plus Ultra vous êtes attaqués !",
  "Red Bull": "🚨 @Red Bull vous êtes attaqués !🪽",
  "E Q U I N O X": "🚨 @E Q U I N O X vous êtes attaqués☀️ !",
  "Les Chuchoteurs": "🚨 @Les Chuchoteurs vous êtes attaqués 🧟!",
  "Ambitions": "🚨 @Ambitions vous êtes attaqués !",
  "D E S T I N Y": "🚨 @D E S T I N Y vous êtes attaqués 🕊️!",
  "TESTAGE DE BOT": "🚨 @TESTAGE DE BOT ceci est qu'un test Bisous 😘"
};

// ====================
// Cooldowns
// ====================
const cooldowns = new Map();

// ====================
// Stats sauvegardées
// ====================
let stats = {};
const STATS_FILE = "stats.json";

// Charger stats si fichier existe
if (fs.existsSync(STATS_FILE)) {
  try {
    stats = JSON.parse(fs.readFileSync(STATS_FILE, "utf8"));
  } catch (err) {
    console.error("⚠️ Erreur de lecture stats.json :", err);
  }
}

// Sauvegarde régulière
function saveStats() {
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
}
setInterval(saveStats, 60 * 1000); // toutes les minutes

// ====================
// Client Discord
// ====================
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

  if (!panneauExiste) {
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
      content: "📢 **Alerte Guildes**\nCliquez sur le bouton de votre guilde pour envoyer une alerte dans 🐎║défense-perco.",
      components: rows
    });

    console.log("✅ Panneau envoyé !");
  } else {
    console.log("ℹ️ Panneau déjà présent, aucun nouvel envoi.");
  }
});

// ====================
// Gestion des boutons
// ====================
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  const roleName = interaction.customId.replace("alert_", "").replace(/_/g, " ");
  const role = interaction.guild.roles.cache.find(r => r.name === roleName);

  if (!role) {
    return interaction.reply({ content: `⚠️ Rôle **${roleName}** introuvable.`, flags: 64 });
  }

  // Cooldown par utilisateur et par guilde
  const cooldownKey = `${interaction.user.id}_${roleName}`;
  const now = Date.now();

  if (cooldowns.has(cooldownKey) && now < cooldowns.get(cooldownKey)) {
    const remaining = Math.ceil((cooldowns.get(cooldownKey) - now) / 1000);
    return interaction.reply({ content: `⏳ Attendez ${remaining}s avant de reping **${roleName}**.`, flags: 64 });
  }

  cooldowns.set(cooldownKey, now + 15000);

  await interaction.deferReply({ flags: 64 });

  const alertChannel = await interaction.guild.channels.fetch(ALERT_CHANNEL_ID);
  if (!alertChannel) {
    return interaction.editReply({ content: "⚠️ Salon d’alerte introuvable." });
  }

  // Mise à jour des stats
  if (!stats[interaction.user.id]) {
    stats[interaction.user.id] = { username: interaction.member.displayName, count: 0 };
  }
  stats[interaction.user.id].count++;
  saveStats();

  // Récupérer message personnalisé ou défaut
  const message = customMessages[roleName] || `🚨 ${role} vous êtes attaqués !`;

  await alertChannel.send({
    content: message,
    allowedMentions: { roles: [role.id] }
  });

  await interaction.editReply({ content: `✅ Alerte envoyée dans ${alertChannel}` });
});

// ====================
// Connexion
// ====================
client.login(process.env.DISCORD_TOKEN);