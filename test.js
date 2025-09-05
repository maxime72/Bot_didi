// ====================
// Chargement des variables d'environnement
// ====================
require("dotenv").config();

// ====================
// SERVEUR EXPRESS (pour Render)
// ====================
const express = require("express");
const app = express();

// Stockage des stats en mémoire
const stats = {}; // { userId: { username: "nom", count: X } }

// Page principale : affiche stats + graphique
app.get("/", (req, res) => {
  const labels = Object.values(stats).map(s => s.username);
  const data = Object.values(stats).map(s => s.count);

  res.send(`
    <html>
      <head>
        <title>📊 Stats Bot Didi</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      </head>
      <body style="font-family: Arial; text-align: center; margin-top: 50px;">
        <h1>📊 Statistiques des Pings</h1>
        <canvas id="statsChart" width="600" height="400"></canvas>
        <script>
          const ctx = document.getElementById('statsChart');
          new Chart(ctx, {
            type: 'bar',
            data: {
              labels: ${JSON.stringify(labels)},
              datasets: [{
                label: 'Nombre de pings',
                data: ${JSON.stringify(data)},
                backgroundColor: 'rgba(54, 162, 235, 0.7)'
              }]
            }
          });
        </script>
      </body>
    </html>
  `);
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

// Liste des guildes (noms EXACTS des rôles dans Discord)
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

// Cooldowns (par utilisateur et par bouton)
const cooldowns = new Map();

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

  // Vérifier si le panneau existe déjà (éviter les doublons)
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

    // 5 boutons max par ligne
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

  if (!role) {
    return interaction.reply({ content: `⚠️ Rôle **${roleName}** introuvable.`, flags: 64 });
  }

  // Cooldown (15s par bouton et utilisateur)
  const cooldownKey = `${interaction.user.id}_${roleName}`;
  const now = Date.now();

  if (cooldowns.has(cooldownKey)) {
    const expiration = cooldowns.get(cooldownKey);
    if (now < expiration) {
      const remaining = Math.ceil((expiration - now) / 1000);
      return interaction.reply({ content: `⏳ Attendez encore ${remaining}s avant de reping **${roleName}**.`, flags: 64 });
    }
  }

  cooldowns.set(cooldownKey, now + 15000);

  const alertChannel = await interaction.guild.channels.fetch(ALERT_CHANNEL_ID);
  if (!alertChannel) {
    return interaction.reply({ content: "⚠️ Salon d’alerte introuvable.", flags: 64 });
  }

  // Ajouter aux stats
  if (!stats[interaction.user.id]) {
    stats[interaction.user.id] = { username: interaction.member.displayName, count: 0 };
  }
  stats[interaction.user.id].count++;

  await alertChannel.send({
    content: `🚨 ${role} vous êtes attaqués ! (Ping par **${interaction.member.displayName}**)`,
    allowedMentions: { roles: [role.id] }
  });

  await interaction.reply({ content: `✅ Alerte envoyée dans ${alertChannel}`, flags: 64 });
});

// Connexion avec le token depuis Render
client.login(process.env.DISCORD_TOKEN);