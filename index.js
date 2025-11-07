// index.js

const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const imagePreloader = require('./utils/image-preloader'); // Import the shared preloader

// Bot Configuration from Environment Variables
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || '988530196552511528';

// Bot Prefix
const PREFIX = '!';

// Client Initialization
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
    ],
});

// Collections for commands
client.commands = new Collection();
const slashCommands = [];
const commandCategories = []; // To store categories for preloading

// --- Command Loading ---
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if ('data' in command && 'execute' in command && 'handleComponent' in command) {
        client.commands.set(command.data.name, command);
        slashCommands.push(command.data.toJSON());
        commandCategories.push(command.data.name); // Assume command name is the category
        console.log(`[Loader] Loaded command: ${command.data.name}`);
    } else {
        console.warn(`[WARNING] The command at ${filePath} is missing required properties.`);
    }
}

// --- Slash Command Registration ---
(async () => {
    try {
        console.log(`[REST] Started refreshing ${slashCommands.length} application (/) commands.`);
        const rest = new REST({ version: '10' }).setToken(TOKEN);
        const data = await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: slashCommands },
        );
        console.log(`[REST] Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error('[REST] Error registering slash commands:', error);
    }
})();

// --- Event Handler for Interactions (Slash Commands & Components) ---
client.on('interactionCreate', async interaction => {
    const commandName = interaction.isChatInputCommand() ? interaction.commandName : interaction.customId.split(':')[0];
    const command = client.commands.get(commandName);

    if (!command) {
        console.error(`No command matching '${commandName}' was found.`);
        return;
    }

    try {
        if (interaction.isChatInputCommand()) {
            await command.execute(interaction);
        } else if (interaction.isButton()) {
            const action = interaction.customId.split(':')[1];
            await command.handleComponent(interaction, action);
        }
        // Add other interaction types (selects, modals) here if needed
    } catch (error) {
        console.error(`Error handling interaction for ${commandName}:`, error);
        const errorMessage = { content: 'An error occurred while processing your request.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
});

// --- Event Handler for Messages (Prefix Commands) ---
client.on('messageCreate', async message => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName);

    if (!command) return; // Silently ignore unknown commands

    try {
        // We can reuse the `execute` function for prefix commands by passing the message
        await command.execute(message, args);
    } catch (error) {
        console.error(`Error executing prefix command ${commandName}:`, error);
        await message.reply('There was an error trying to execute that command!');
    }
});

// --- Client Ready Event ---
client.once('ready', async () => {
    console.log(`[Client] Ready! Logged in as ${client.user.tag}`);
    client.user.setActivity('with V2 Components');

    // Start preloading images for all loaded command categories
    if (commandCategories.length > 0) {
        await imagePreloader.initialPreload(commandCategories);
    }
});

// --- Startup Validation & Login ---
if (!TOKEN) {
    console.error('DISCORD_BOT_TOKEN is not set in environment variables! Please set it in your .env file or system variables.');
    process.exit(1);
}

client.login(TOKEN);
