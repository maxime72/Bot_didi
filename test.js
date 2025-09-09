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
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
setInterval(() => {
  fetch("https://bot-didi-h5gm.onrender.com").catch((err) =>
    console.log("Ping failed", err)
  );
}, 10 * 60 * 1000);

// ====================
// BOT DISCORD
// ====================
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
} = require("discord.js");

const PANEL_CHANNEL_ID = "1404539663322054718"; // 🐎║ping-perco
const ALERT_CHANNEL_ID = "1402339092385107999"; // 🐎║défense-perco

// Liste des guildes
const guildRoles = [
  "Tempest",
  "YGGDRASIL",
  "Plus Ultra",
  "Red Bull",
  "E Q U I N O X",
  "Les Chuchoteurs",
  "Ambitions",
  "D E S T I N Y",
  "TESTAGE DE BOT",
];

// Cooldowns
const cooldowns = new Map();

// Stats sauvegardées dans un fichier
const statsFile = "stats.json";
let stats = {};
if (fs.existsSync(statsFile)) {
  stats = JSON.parse(fs.readFileSync(statsFile, "utf8"));
}

// Sauvegarde automatique des stats
function saveStats() {
  fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
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
  const panneauExiste = messages.some((msg) =>
    msg.content.includes("📢 **Alerte Guildes**")
  );

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
    content:
      "📢 **Alerte Guildes**\nCliquez sur le bouton correspondant à la guilde attaquée pour envoyer une alerte dans 🐎║défense-perco.",
    components: rows,
  });

  console.log("✅ Panneau envoyé !");
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  const roleName = interaction.customId
    .replace("alert_", "")
    .replace(/_/g, " ");
  const role = interaction.guild.roles.cache.find((r) => r.name === roleName);

  if (!role) {
    return interaction.reply({
      content: `⚠️ Rôle **${roleName}** introuvable.`,
      flags: 64,
    });
  }

  const cooldownKey = `${interaction.user.id}_${roleName}`;
  const now = Date.now();

  if (cooldowns.has(cooldownKey) && now < cooldowns.get(cooldownKey)) {
    const remaining = Math.ceil(
      (cooldowns.get(cooldownKey) - now) / 1000
    );
    return interaction.reply({
      content: `⏳ Attendez encore ${remaining}s avant de reping **${roleName}**.`,
      flags: 64,
    });
  }

  cooldowns.set(cooldownKey, now + 15000);

  await interaction.deferReply({ ephemeral: true });

  const alertChannel = await interaction.guild.channels.fetch(ALERT_CHANNEL_ID);
  if (!alertChannel) {
    return interaction.editReply({
      content: "⚠️ Salon d’alerte introuvable.",
    });
  }

  // Stats
  if (!stats[interaction.user.id]) {
    stats[interaction.user.id] = { username: interaction.user.username, count: 0 };
  }
  stats[interaction.user.id].count++;
  saveStats();

  // Message personnalisé pour TESTAGE DE BOT
  let alertMessage;
  if (roleName === "TESTAGE DE BOT") {
    alertMessage = `🚨 ${role} est attaqué ! Bisous 😘`;
  } else {
    alertMessage = `🚨 ${role} vous êtes attaqués !`;
  }

  await alertChannel.send({
    content: alertMessage,
    allowedMentions: { roles: [role.id] },
  });

  await interaction.editReply({
    content: `✅ Alerte envoyée dans ${alertChannel}`,
  });
});

client.login(process.env.DISCORD_TOKEN);