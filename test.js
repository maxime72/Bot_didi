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
const fetch = require("node-fetch");
setInterval(() => {
  fetch("https://bot-didi-h5gm.onrender.com").catch(err =>
    console.log("Ping failed", err)
  );
}, 10 * 60 * 1000); // 10 minutes

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
    "Doux Poison",
    "Plus Ultra",
    "United cats",
    "Babgnoules",
    "New World",
    "Mur Rose",
    "Red Bull",
    "E Q U I N O X",
    "Les Chuchoteurs",
    "La Forge",
    "G H O S T-a",
    "Ambitions",
    "TESTAGE DE BOT" // Nouveau rôle test
];

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Cooldowns : { "userId_roleName": timestamp }
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
        try {
            await interaction.reply({ content: `⚠️ Rôle **${roleName}** introuvable.`, flags: 64 });
        } catch (err) {
            console.error("❌ Erreur interaction rôle introuvable :", err);
        }
        return;
    }

    const alertChannel = await interaction.guild.channels.fetch(ALERT_CHANNEL_ID);
    if (!alertChannel) {
        try {
            await interaction.reply({ content: "⚠️ Salon d’alerte introuvable.", flags: 64 });
        } catch (err) {
            console.error("❌ Erreur interaction salon introuvable :", err);
        }
        return;
    }

    // Vérification cooldown
    const cooldownKey = `${interaction.user.id}_${roleName}`;
    const now = Date.now();
    const cooldownTime = 15 * 1000; // 15 secondes

    if (cooldowns.has(cooldownKey) && now - cooldowns.get(cooldownKey) < cooldownTime) {
        const timeLeft = Math.ceil((cooldownTime - (now - cooldowns.get(cooldownKey))) / 1000);
        try {
            await interaction.reply({ content: `⏳ Merci d’attendre encore ${timeLeft}s avant de réutiliser le bouton **${roleName}**.`, flags: 64 });
        } catch (err) {
            console.error("❌ Erreur interaction cooldown :", err);
        }
        return;
    }

    // Enregistrer le nouveau cooldown
    cooldowns.set(cooldownKey, now);

    // Envoyer l’alerte dans le salon
    try {
        await alertChannel.send({
            content: `🚨 ${role} vous êtes attaqués ! (Appuyé par **${interaction.member.displayName}**)`,
            allowedMentions: { roles: [role.id] }
        });

        await interaction.reply({
            content: `✅ Alerte envoyée dans <#${ALERT_CHANNEL_ID}>`,
            flags: 64
        });
    } catch (err) {
        console.error("❌ Erreur lors de l’envoi d’alerte :", err);
    }
});

// Connexion avec le token depuis Render
client.login(process.env.DISCORD_TOKEN);