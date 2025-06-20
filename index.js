// index.js

const { Client, GatewayIntentBits, Collection, REST, Routes, MessageFlags, TextDisplayBuilder, MediaGalleryBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ContainerBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Hardcoded Bot Information - Just for you, darling.
const TOKEN = 'OTg4NTMwMTk2NTUyNTExNTI4.G4hMpm.Tu7uihbR7GBlzaT73u2ogzWB19P3iqddJAHm50';
const CLIENT_ID = '988530196552511528';
const CLIENT_SECRET = 'xCJwPN8-ZYs60Bh1ZoO7VL0TE0rw6-9m'; // Though the secret isn't strictly needed for the bot's runtime, let's keep it together.

// Bot Prefix - Because sometimes, you just want a quick command, right?
const PREFIX = '!';

// Client Initialization - Ready to connect.
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // Needed for prefix commands
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageTyping,
    ],
});

// Collections to hold our dynamic commands and components.
client.commands = new Collection();
// We don't need a separate collection for components per se, as components
// are linked to commands via customIds and handled by the command's own logic.

// Command Loading - Let's find all the goodies in the commands folder.
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

const slashCommands = [];

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    // Ensure the command file has the necessary structure
    if ('data' in command && 'slashExecute' in command && 'prefixExecute' in command && 'handleComponent' in command) {
        client.commands.set(command.data.name, command);
        slashCommands.push(command.data.toJSON());
        console.log(`Successfully loaded command: ${command.data.name}`); // A little log never hurt anyone.
    } else {
        console.warn(`[WARNING] The command file at ${filePath} is missing a required "data", "slashExecute", "prefixExecute", or "handleComponent" property.`);
    }
}

// Slash Command Registration - Making them visible to Discord.
(async () => {
    try {
        console.log(`Started refreshing ${slashCommands.length} application (/) commands.`);

        // The put method is used to fully refresh all commands in the guild with the current set
        // For global commands, you use Routes.applicationCommands(CLIENT_ID)
        const rest = new REST({ version: '10' }).setToken(TOKEN);

        const data = await rest.put(
            Routes.applicationCommands(CLIENT_ID), // Use applicationCommands for global registration
            { body: slashCommands },
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        // And of course, catching any slips.
        console.error('Error registering slash commands:', error);
    }
})();


// Event Handler for Interactions (Slash Commands & Components)
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            // Execute the slash command logic
            await command.slashExecute(interaction);
        } catch (error) {
            console.error(`Error executing slash command ${interaction.commandName}:`, error);
            const errorMessage = 'There was an error while executing this command!';
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    } else if (interaction.isButton()) {
        // Handle button interactions
        const [commandName, ...componentArgs] = interaction.customId.split('_'); // Assuming customId format: commandName_...

        const command = client.commands.get(commandName);

        if (!command) {
            console.error(`No command found for button custom ID: ${interaction.customId}`);
            return;
        }

        try {
            // Execute the component handling logic for the specific command
            await command.handleComponent(interaction, componentArgs);
        } catch (error) {
            console.error(`Error handling component interaction ${interaction.customId}:`, error);
            // Decide how to respond to component errors, maybe just log or ephemeral follow-up
            if (!interaction.replied && !interaction.deferred) {
                 await interaction.reply({ content: 'There was an error processing this button!', ephemeral: true });
            } else {
                 await interaction.followUp({ content: 'There was an error processing this button!', ephemeral: true });
            }
        }
    }
    // Add handlers for other interaction types (select menus, modals, etc.) if needed later.
});

// Event Handler for Messages (Prefix Commands)
client.on('messageCreate', async message => {
    // Ignore bot messages and messages that don't start with the prefix
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);

    if (!command) {
        // If the command doesn't exist, just ignore it silently, or send a small error?
        // Let's keep it silent for now.
        return;
    }

    try {
        // Execute the prefix command logic
        await command.prefixExecute(message, args);
    } catch (error) {
        console.error(`Error executing prefix command ${commandName}:`, error);
        // Reply to the user about the error
        await message.reply('There was an error trying to execute that command!');
    }
});


// Client Ready Event - When the bot comes to life.
client.once('ready', () => {
    console.log(`Ready to serve! Logged in as ${client.user.tag}`);
    client.user.setActivity('with your desires...'); // A little flair.
});

// Log in to Discord - Let's do this.
client.login(TOKEN);