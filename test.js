// ====================
// Chargement des variables d'environnement
// ====================
require("dotenv").config();

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
setInterval(() => {
  fetch("https://bot-didi-h5gm.onrender.com").catch(err =>
    console.log("Ping failed", err)
  );
}, 10 * 60 * 1000); // 10 minutes

// ====================
// BOT DISCORD
// ====================
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events
} = require("discord.js");

const PANEL_CHANNEL_ID = "1404539663322054718"; // 🐎║ping-perco
const ALERT_CHANNEL_ID = "1402339092385107999"; // 🐎║défense-perco

// Liste des guildes (noms EXACTS des rôles dans Discord)
const guildRoles = [
  "Tempest",
  "YGGDRASIL",
  "Doux Poison",
  "Plus Ultra",
  "United cats",
  "New World",
  "Mur Rose",
  "Red Bull",
  "E Q U I N O X",
  "Les Chuchoteurs",
  "La Forge",
  "G H O S T-a",
  "Ambitions",
  "TESTAGE DE BOT"
];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Cooldowns par utilisateur et par bouton
const cooldowns = new Map();

client.once(Events.ClientReady, async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);

  const channel = await client.channels.fetch(PANEL_CHANNEL_ID);
  if (!channel) {
    console.error("⚠️ Salon du panneau introuvable !");
    return;
  }

  // Vérifier si le panneau existe déjà (éviter les doublons)
  const messages = await channel.messages.fetch({ limit: 10 });
  const panneauExiste = messages.some(msg =>
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

    // 5 boutons max par ligne
    if ((index + 1) % 5 === 0 || index === guildRoles.length - 1) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder();
    }
  });

  await channel.send({
    content:
      "📢 **Alerte Guildes**\nCliquez sur le bouton correspondant à la guilde attaquée pour envoyer une alerte dans 🐎║défense-perco.",
    components: rows
  });

  console.log("✅ Panneau envoyé !");
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  const userId = interaction.user.id;
  const roleName = interaction.customId
    .replace("alert_", "")
    .replace(/_/g, " ");

  const now = Date.now();
  const cooldownKey = `${userId}_${roleName}`;
  const cooldownTime = 15 * 1000; // 15s

  if (cooldowns.has(cooldownKey)) {
    const expires = cooldowns.get(cooldownKey);
    if (now < expires) {
      const remaining = Math.ceil((expires - now) / 1000);
      return interaction.reply({
        content: `⏳ Tu dois attendre **${remaining}s** avant de réutiliser le bouton **${roleName}**.`,
        flags: 64 // équivalent à "ephemeral"
      });
    }
  }

  cooldowns.set(cooldownKey, now + cooldownTime);

  const role = interaction.guild.roles.cache.find(r => r.name === roleName);
  if (!role) {
    return interaction.reply({
      content: `⚠️ Rôle **${roleName}** introuvable.`,
      flags: 64
    });
  }

  const alertChannel = await interaction.guild.channels.fetch(ALERT_CHANNEL_ID);
  if (!alertChannel) {
    return interaction.reply({
      content: "⚠️ Salon d’alerte introuvable.",
      flags: 64
    });
  }

  // Utilisation du nickname du serveur (si dispo) sinon username
  const pseudo =
    interaction.member?.nickname || interaction.user.username;

  await alertChannel.send({
    content: `🚨 ${role} vous êtes attaqués ! (Alerte déclenchée par **${pseudo}**)`,
    allowedMentions: { roles: [role.id] }
  });

  await interaction.reply({
    content: `✅ Alerte envoyée dans <#${ALERT_CHANNEL_ID}>`,
    flags: 64
  });
});

// Connexion avec le token depuis Render
client.login(process.env.DISCORD_TOKEN);