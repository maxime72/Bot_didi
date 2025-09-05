// ====================
// Chargement des variables d'environnement
// ====================
require("dotenv").config();
const fs = require("fs");
const path = require("path");

// ====================
// SERVEUR EXPRESS (pour Render)
// ====================
const express = require("express");
const app = express();

// Fichier pour sauvegarder les stats
const STATS_FILE = path.join(__dirname, "stats.json");

// Charger les stats existantes si elles existent
let stats = {};
if (fs.existsSync(STATS_FILE)) {
  stats = JSON.parse(fs.readFileSync(STATS_FILE, "utf8"));
}

// Page HTML avec stats + top 5 + graphique
app.get("/", (req, res) => {
  const topUsers = Object.values(stats)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  let statsHtml = "";
  for (const id in stats) {
    statsHtml += `<li>${stats[id].username} ➝ ${stats[id].count} alertes envoyées</li>`;
  }

  let topHtml = "";
  topUsers.forEach((user, index) => {
    topHtml += `<li>🏅 ${index + 1}. ${user.username} ➝ ${user.count} alertes</li>`;
  });

  res.send(`
    <html>
      <head>
        <title>Stats Bot Didi</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      </head>
      <body>
        <h1>📊 Statistiques Bot Didi</h1>
        <h2>📌 Toutes les alertes</h2>
        <ul>${statsHtml}</ul>

        <h2>🏆 Top 5 des plus gros pingers</h2>
        <ol>${topHtml}</ol>

        <h2>📈 Graphique des alertes</h2>
        <canvas id="statsChart" width="400" height="200"></canvas>
        <script>
          const ctx = document.getElementById('statsChart').getContext('2d');
          new Chart(ctx, {
            type: 'bar',
            data: {
              labels: ${JSON.stringify(Object.values(stats).map(u => u.username))},
              datasets: [{
                label: 'Alertes envoyées',
                data: ${JSON.stringify(Object.values(stats).map(u => u.count))},
                backgroundColor: 'rgba(54, 162, 235, 0.6)'
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
const fetch = global.fetch || require("node-fetch");

setInterval(() => {
  fetch("https://bot-didi-h5gm.onrender.com")
    .catch(err => console.log("Ping failed", err));
}, 10 * 60 * 1000); // 10 minutes

// ====================
// BOT DISCORD
// ====================
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require("discord.js");

const PANEL_CHANNEL_ID = "1404539663322054718"; 
const ALERT_CHANNEL_ID = "1402339092385107999"; 

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

// Cooldowns par utilisateur + guilde
const cooldowns = new Map();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Fonction pour sauvegarder les stats dans le fichier JSON
function saveStats() {
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
}

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

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  const roleName = interaction.customId.replace("alert_", "").replace(/_/g, " ");
  const role = interaction.guild.roles.cache.find(r => r.name === roleName);

  if (!role) {
    return interaction.reply({ content: `⚠️ Rôle **${roleName}** introuvable.`, flags: 64 });
  }

  const cooldownKey = `${interaction.user.id}_${roleName}`;
  const now = Date.now();

  if (cooldowns.has(cooldownKey) && now < cooldowns.get(cooldownKey)) {
    const remaining = Math.ceil((cooldowns.get(cooldownKey) - now) / 1000);
    return interaction.reply({ content: `⏳ Attendez encore ${remaining}s avant de reping **${roleName}**.`, flags: 64 });
  }

  cooldowns.set(cooldownKey, now + 15000); // 15s de cooldown

  await interaction.deferReply({ ephemeral: true });

  const alertChannel = await interaction.guild.channels.fetch(ALERT_CHANNEL_ID);
  if (!alertChannel) {
    return interaction.editReply({ content: "⚠️ Salon d’alerte introuvable." });
  }

  // Stats
  if (!stats[interaction.user.id]) {
    stats[interaction.user.id] = { username: interaction.member.displayName, count: 0 };
  }
  stats[interaction.user.id].count++;

  // Sauvegarde des stats
  saveStats();

  await alertChannel.send({
    content: `🚨 ${role} vous êtes attaqués ! (Ping par **${interaction.member.displayName}**)`,
    allowedMentions: { roles: [role.id] }
  });

  await interaction.editReply({ content: `✅ Alerte envoyée dans ${alertChannel}` });
});

client.login(process.env.DISCORD_TOKEN);