// index.js

const { Client, GatewayIntentBits, Collection, REST, Routes, MessageFlags, EmbedBuilder } = require('discord.js'); // Updated EmbedBuilder
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Ensure environment variables are loaded

// Bot Configuration from Environment Variables
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || '988530196552511528'; // Default CLIENT_ID if not set

// Bot Prefix
const PREFIX = '!';

// Client Initialization
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // Needed for prefix commands
        GatewayIntentBits.DirectMessages, // Not strictly necessary for current features but good for future expansion
    ],
});

// Collections to hold commands.
client.commands = new Collection();

// --- Utility Function for Error Replies ---
const sendErrorReply = async (interaction, customMessage = 'An unexpected error occurred.') => {
    const errorMessage = `${customMessage}\nThe NSFWHub API we use to fetch images is very strictly rate-limited, so this is the most likely reason for the error. Please try again later.`;
    const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000) // Red for errors
        .setTitle('📛 Error')
        .setDescription(errorMessage)
        .setTimestamp();

    try {
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    } catch (e) {
        console.error('Failed to send error reply:', e);
    }
};


// Command Loading
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
const slashCommands = [];

console.log('Attempting to load commands...');
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
        const command = require(filePath);
        if (command.data && typeof command.slashExecute === 'function' && typeof command.prefixExecute === 'function') {
            client.commands.set(command.data.name, command);
            slashCommands.push(command.data.toJSON());
            console.log(`Successfully loaded command: ${command.data.name}`);
        } else {
            console.warn(`[WARNING] The command file at ${filePath} is missing a required "data", "slashExecute", or "prefixExecute" property.`);
        }
    } catch (error) {
        console.error(`Error loading command file ${filePath}:`, error);
    }
}
console.log(`Loaded ${client.commands.size} commands.`);

// Slash Command Registration
(async () => {
    if (!TOKEN) {
        console.error('DISCORD_BOT_TOKEN is not set. Skipping slash command registration.');
        return;
    }
    if (slashCommands.length === 0) {
        console.log('No slash commands found to register.');
        return;
    }
    try {
        console.log(`Started refreshing ${slashCommands.length} application (/) commands.`);
        const rest = new REST({ version: '10' }).setToken(TOKEN);

        // For global commands, use Routes.applicationCommands(CLIENT_ID)
        const data = await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: slashCommands },
        );
        console.log(`Successfully reloaded ${data.length} application (/) commands globally.`);
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }
})();

// Event Handler for Interactions (Slash Commands & Components)
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            await sendErrorReply(interaction, `The command "${interaction.commandName}" was not found.`);
            return;
        }

        try {
            await command.slashExecute(interaction);
        } catch (error) {
            console.error(`Error executing slash command ${interaction.commandName}:`, error);
            await sendErrorReply(interaction, `There was an error while executing the command "${interaction.commandName}".`);
        }

    } else if (interaction.isButton()) {
        // Button custom IDs are expected to be in the format: commandName_action_...args
        // e.g., "anal_button_reload" or "pussy_button_nextPage_2"
        const parts = interaction.customId.split('_');
        const commandName = parts[0];
        // The rest of the parts are arguments for the component handler
        const componentArgs = parts.slice(1);


        const command = client.commands.get(commandName);
        if (!command || typeof command.handleComponent !== 'function') {
            console.error(`No command or component handler found for button custom ID: ${interaction.customId}`);
            // For button errors, we only send an ephemeral message and do not touch the original message.
            await sendErrorReply(interaction, 'This button seems to be malfunctioning or outdated.');
            return;
        }

        try {
            // The handleComponent function is now responsible for deferring/replying appropriately.
            // It should only send ephemeral messages on error, leaving the original message intact.
            await command.handleComponent(interaction, componentArgs);
        } catch (error) {
            console.error(`Error handling component interaction ${interaction.customId}:`, error);
            // Ensure error reply is ephemeral and doesn't affect the original message.
            // The command's handleComponent should ideally handle its own errors,
            // but this is a fallback.
            await sendErrorReply(interaction, 'There was an error processing this button action.');
        }
    }
    // Add handlers for other interaction types (select menus, modals, etc.) if needed later.
});

// Event Handler for Messages (Prefix Commands)
client.on('messageCreate', async message => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);

    if (!command) {
        // Silently ignore if command not found for prefix commands
        return;
    }

    try {
        await command.prefixExecute(message, args);
    } catch (error) {
        console.error(`Error executing prefix command ${commandName}:`, error);
        // For prefix commands, a direct reply is conventional.
        // We will use the new error embed style for consistency, but not ephemeral.
        const errorMessage = `There was an error trying to execute the \`${commandName}\` command.\nThe NSFWHub API we use is very strictly rate-limited, so this is the most likely reason for the error. Please try again later.`;
        const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('📛 Command Error')
            .setDescription(errorMessage)
            .setTimestamp();
        try {
            await message.reply({ embeds: [errorEmbed] });
        } catch (e) {
            console.error('Failed to send prefix command error reply:', e);
        }
    }
});

// Client Ready Event
client.once('ready', () => {
    if (!client.user) {
        console.error('Client user is not available on ready event.');
        return;
    }
    console.log(`Ready to serve! Logged in as ${client.user.tag}`);
    client.user.setActivity('with NSFWHub API'); // Updated activity
});

// Validate token exists before login attempt
if (!TOKEN) {
    console.error('DISCORD_BOT_TOKEN is not set in environment variables! The bot cannot start.');
    process.exit(1); // Exit if token is missing
}

// Log in to Discord
client.login(TOKEN).catch(error => {
    console.error('Failed to log in:', error);
    process.exit(1);
});