// commands/ass.js

const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MediaGalleryBuilder, TextDisplayBuilder, MessageFlags, ContainerBuilder } = require('discord.js');
const { NSFW } = require('nsfwhub'); // Import the NSFW library.

const nsfw = new NSFW(); // Create an instance.

// Shared function to generate the response payload using Components V2
const generateAssPayload = async () => {
    try {
        const data = await nsfw.fetch("ass"); // Fetch the delightful posterior.
        const imageUrl = data.image.url;

        // Wrapping it in a Container for that signature formal flair.
        const container = new ContainerBuilder()
            .setAccentColor(0xFF007F) // Keeping the lovely color.
            .addTextDisplayComponents( // Add a title
                textDisplay => textDisplay
                    .setContent('### Behold! A delightful view.') // Markdown for a nice heading
            )
             // Add a separator for spacing
            .addSeparatorComponents(
                separator => separator
                    .setSpacing(2) // Large spacing, as corrected.
            )
            .addMediaGalleryComponents( // The main attraction!
                mediaGallery => mediaGallery
                    .addItems( // Add the image/media from the fetched URL
                        mediaGalleryItem => mediaGalleryItem
                            // Assuming nsfwhub provides a direct link that discord can handle
                            .setURL(imageUrl)
                            .setDescription('A stunning display.') // Alt text.
                    )
            );

        // Add the Reload button.
        const reloadButton = new ButtonBuilder()
            .setCustomId('ass_button_reload') // Unique ID for this command's reload button.
            .setLabel('🔃 Reload')
            .setStyle(ButtonStyle.Primary);

        // Put the button in an Action Row.
        const actionRow = new ActionRowBuilder()
            .addComponents(reloadButton);

        // Add the action row to the container.
        container.addActionRowComponents(actionRow);

        // Construct the final message payload with Components V2 flag.
        const payload = {
            components: [container], // Send the container.
            flags: MessageFlags.IsComponentsV2, // MANDATORY for CV2 components
            // content and embeds are DISABLED here.
        };

        return payload;

    } catch (error) {
        console.error('Error fetching ass image:', error);
        // Return an error payload using CV2 components.
        const errorContainer = new ContainerBuilder()
            .setAccentColor(0xFF0000)
            .addTextDisplayComponents(
                textDisplay => textDisplay
                    .setContent('### Error')
            )
             .addSeparatorComponents(
                separator => separator
                    .setSpacing(2) // Large spacing
            )
            .addTextDisplayComponents(
                textDisplay => textDisplay
                    .setContent('Failed to fetch the requested image. The API seems camera-shy right now.')
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
        .setName('ass')
        .setDescription('Offers a glimpse of delightful anatomy.'), // Appropriate description.

    // Slash Command Execution
    async slashExecute(interaction) {
        // Defer the reply.
        await interaction.deferReply({ ephemeral: false });

        const payload = await generateAssPayload();

        // Edit the deferred reply.
        await interaction.editReply(payload);
    },

    // Prefix Command Execution
    async prefixExecute(message, args) {
        // Send the message directly for prefix commands.
        const payload = await generateAssPayload();
        await message.channel.send(payload);
    },

    // Component Handling (e.g., Button Clicks)
    async handleComponent(interaction, componentArgs) {
         // componentArgs will contain parts of the customId after the command name, e.g., ['button', 'reload']
        const componentType = componentArgs[0];
        const action = componentArgs[1];

        if (componentType === 'button' && action === 'reload') {
            // Handle the reload button click
            try {
                // Defer the button interaction update.
                await interaction.deferUpdate();

                // Generate a new payload with a fresh image.
                const newPayload = await generateAssPayload();

                // Edit the original message.
                await interaction.editReply(newPayload);

            } catch (error) {
                console.error('Error handling ass reload button:', error);
                // Inform the user about the error.
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'Failed to reload the image!', ephemeral: true });
                } else {
                    await interaction.followUp({ content: 'Failed to reload the image!', ephemeral: true });
                }
            }
        }
        // Add more component handling here if needed.
    },
};