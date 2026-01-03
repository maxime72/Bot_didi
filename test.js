require("dotenv").config();
const express = require("express");
const fetch = require("node-fetch");
const { 
  Client, 
  GatewayIntentBits, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  Events 
} = require("discord.js");

// ============================
// CONFIG DES SERVEURS
// ============================
const serverConfig = {
  "1199715671534206986": {
    panelChannel: "1436997125178130462",
    alertChannel: "1377004443114934303",
    guildButtons: [
      {
        name: "Tempest",
        emoji: "🌪️",
        pingType: "everyone",
        message: "📢 annonce que Tempest est attaqué! 🌪️"
      }
    ]
  }
};

// ============================
// EXPRESS + KEEP ALIVE
// ============================
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("Bot Didi is running!"));
app.listen(PORT, () => console.log(`✅ Web server running on port ${PORT}`));

// Optionnel : ping automatique si tu n’utilises pas Uptime Robot
setInterval(() => {
  fetch(`http://localhost:${PORT}`)
    .then(() => console.log("Ping interne effectué"))
    .catch(() => console.log("Ping interne échoué"));
}, 5 * 60 * 1000); // toutes les 5 minutes

// ============================
// CLIENT DISCORD
// ============================
console.log("🚀 Script lancé");
console.log("TOKEN PRESENT ?", !!process.env.DISCORD_TOKEN);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ============================
// READY & PANNEL TEST
// ============================
client.once(Events.ClientReady, async () => {
  console.log("🟢 BOT CONNECTÉ :", client.user.tag);

  for (const guildId of Object.keys(serverConfig)) {
    const cfg = serverConfig[guildId];

    try {
      const guild = await client.guilds.fetch(guildId);
      const panelChannel = await guild.channels.fetch(cfg.panelChannel);

      if (!panelChannel) {
        console.log(`⚠️ Salon panneau introuvable pour ${guild.name}`);
        continue;
      }

      // Test envoi message
      await panelChannel.send("🧪 Test bot en ligne !");
      console.log(`✅ Message test envoyé sur ${guild.name}`);

      // Crée les boutons
      const row = new ActionRowBuilder();
      cfg.guildButtons.forEach(g => {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`alert_${g.name.replace(/\s+/g, "_")}_${guildId}`)
            .setLabel(`${g.emoji} ${g.name}`)
            .setStyle(ButtonStyle.Primary)
        );
      });

      await panelChannel.send({
        content: "📢 **Alerte Guildes**\nCliquez sur un bouton pour envoyer une alerte !",
        components: [row]
      });
      console.log(`✅ Panneau envoyé sur ${guild.name}`);

    } catch (err) {
      console.error(`❌ Erreur pour ${guildId} :`, err);
    }
  }
});

// ============================
// GESTION DES CLICS
// ============================
const cooldowns = new Map();

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  const guildId = interaction.guild.id;
  const cfg = serverConfig[guildId];
  if (!cfg) return interaction.reply({ content: "⚠️ Serveur non configuré.", ephemeral: true });

  const userId = interaction.user.id;
  const now = Date.now();

  if (cooldowns.has(userId) && now < cooldowns.get(userId)) {
    return interaction.reply({ content: "⏳ Attends 5 secondes avant de réutiliser le bouton.", ephemeral: true });
  }
  cooldowns.set(userId, now + 5000);

  const alertChannel = await interaction.guild.channels.fetch(cfg.alertChannel);
  if (!alertChannel) return interaction.reply({ content: "⚠️ Salon d'alerte introuvable.", ephemeral: true });

  const btnName = interaction.customId.replace(/alert_/, "").replace(/_[0-9]+$/, "").replace(/_/g, " ");
  const guildBtn = cfg.guildButtons.find(b => b.name === btnName);
  if (!guildBtn) return interaction.reply({ content: "⚠️ Bouton non configuré.", ephemeral: true });

  let message;
  let allowedMentions = {};

  if (guildBtn.pingType === "everyone") {
    message = `@everyone <@${userId}> ${guildBtn.message}`;
    allowedMentions = { parse: ["everyone", "users"] };
  } else {
    const role = interaction.guild.roles.cache.find(r => r.name === guildBtn.roleName);
    if (!role) return interaction.reply({ content: `⚠️ Rôle ${guildBtn.roleName} introuvable.`, ephemeral: true });

    message = `${role} <@${userId}> ${guildBtn.message}`;
    allowedMentions = { roles: [role.id], users: [userId] };
  }

  await alertChannel.send({ content: message, allowedMentions });
  await interaction.reply({ content: `✅ Alerte envoyée pour **${btnName}** !`, ephemeral: true });
});

// ============================
// LOGIN
// ============================
client.login(process.env.DISCORD_TOKEN);