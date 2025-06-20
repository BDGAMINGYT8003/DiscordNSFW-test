// commands/pussy.js

const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MediaGalleryBuilder, TextDisplayBuilder, MessageFlags, ContainerBuilder } = require('discord.js');
const { NSFW } = require('nsfwhub'); // Import the NSFW library, just as you wanted.

const nsfw = new NSFW(); // Create an instance.

// Shared function to generate the response payload using Components V2
const generatePussyPayload = async () => {
    try {
        const data = await nsfw.fetch("pussy"); // Fetch the good stuff.
        const imageUrl = data.image.url;

        // Let's wrap everything in a Container for that formal, embedded look.
        const container = new ContainerBuilder()
            .setAccentColor(0xFF007F) // A lovely color, don't you think?
            .addTextDisplayComponents( // Add a title
                textDisplay => textDisplay
                    .setContent('### Behold! A gift from the depths.') // Markdown for a nice heading
            )
             // Add a separator for spacing
            .addSeparatorComponents(
                separator => separator
                    .setSpacing(20) // A little space to breathe
            )
            .addMediaGalleryComponents( // The main attraction!
                mediaGallery => mediaGallery
                    .addItems( // Add the image/media from the fetched URL
                        mediaGalleryItem => mediaGalleryItem
                            // Assuming nsfwhub provides a direct link that discord can handle
                            .setURL(imageUrl)
                            .setDescription('A delightful view.') // Alt text for accessibility, always good.
                    )
            );

        // Add the Reload button - You'll want to see more, trust me.
        const reloadButton = new ButtonBuilder()
            .setCustomId('pussy_button_reload') // Unique ID for handling this button
            .setLabel('🔃 Reload')
            .setStyle(ButtonStyle.Primary); // A prominent button for a prominent action.

        // Put the button in an Action Row.
        const actionRow = new ActionRowBuilder()
            .addComponents(reloadButton);

        // Now, add the action row to the container.
        container.addActionRowComponents(actionRow);


        // Construct the final message payload with Components V2 flag.
        const payload = {
            components: [container], // Send the container with its contents
            flags: MessageFlags.IsComponentsV2, // MANDATORY for CV2 components
            // Note: content and embeds fields are DISABLED when IsComponentsV2 is set.
            // All visual content must be within CV2 components.
        };

        return payload;

    } catch (error) {
        console.error('Error fetching pussy image:', error);
        // Return an error payload using CV2 components as well
        const errorContainer = new ContainerBuilder()
            .setAccentColor(0xFF0000)
            .addTextDisplayComponents(
                textDisplay => textDisplay
                    .setContent('### Error')
            )
             .addSeparatorComponents(
                separator => separator
                    .setSpacing(20)
            )
            .addTextDisplayComponents(
                textDisplay => textDisplay
                    .setContent('Failed to fetch the requested image. The API might be shy right now.')
            );

         const errorPayload = {
            components: [errorContainer],
            flags: MessageFlags.IsComponentsV2,
         };
         return errorPayload;
    }
};

module.exports = {
    // Slash Command Definition
    data: new SlashCommandBuilder()
        .setName('pussy')
        .setDescription('Delivers a delightful image.'), // A simple, direct description.

    // Slash Command Execution
    async slashExecute(interaction) {
        // Defer the reply as fetching the image might take a moment.
        await interaction.deferReply({ ephemeral: false }); // Make it visible to everyone.

        const payload = await generatePussyPayload();

        // Edit the deferred reply with the generated payload.
        await interaction.editReply(payload);
    },

    // Prefix Command Execution
    async prefixExecute(message, args) {
        // For prefix commands, we just send the message directly.
        // No deferral needed here unless we want a "Typing..." indicator.
        // Let's keep it simple and send directly.

        const payload = await generatePussyPayload();

        // Send the message to the channel.
        await message.channel.send(payload);
    },

    // Component Handling (e.g., Button Clicks)
    async handleComponent(interaction, componentArgs) {
         // componentArgs will contain parts of the customId after the command name,
         // e.g., ['button', 'reload'] for 'pussy_button_reload'

        const componentType = componentArgs[0];
        const action = componentArgs[1]; // e.g., 'reload'

        if (componentType === 'button' && action === 'reload') {
            // Handle the reload button click
            try {
                // Defer the button interaction update, this makes the button show a loading state.
                await interaction.deferUpdate();

                // Generate a new payload with a fresh image.
                const newPayload = await generatePussyPayload();

                // Edit the original message with the new payload.
                await interaction.editReply(newPayload); // Use editReply for interaction-based messages

            } catch (error) {
                console.error('Error handling reload button:', error);
                // Inform the user about the error, maybe ephemerally.
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'Failed to reload the image!', ephemeral: true });
                } else {
                    await interaction.followUp({ content: 'Failed to reload the image!', ephemeral: true });
                }
            }
        }
        // Add more component handling logic here if the command gains more interactive components.
    },
};