// commands/sixtynine.js

const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MediaGalleryBuilder, TextDisplayBuilder, MessageFlags, ContainerBuilder } = require('discord.js');
const { NSFW } = require('nsfwhub'); // Import the NSFW library.

const nsfw = new NSFW(); // Create an instance.

// Advanced Preloading Cache System
class ImagePreloader {
    constructor(category) {
        this.category = category;
        this.cache = [];
        this.isPreloading = false;
        this.targetCacheSize = 2;
        this.preloadOnInit();
    }

    async preloadOnInit() {
        if (this.isPreloading) return;
        this.isPreloading = true;
        
        try {
            const preloadPromises = Array(this.targetCacheSize).fill().map(() => this.fetchAndCache());
            await Promise.all(preloadPromises);
        } catch (error) {
            console.error(`Initial preload failed for ${this.category}:`, error);
        }
        
        this.isPreloading = false;
    }

    async fetchAndCache() {
        try {
            const data = await nsfw.fetch(this.category);
            if (data && data.image && data.image.url) {
                this.cache.push({
                    url: data.image.url,
                    timestamp: Date.now()
                });
            }
        } catch (error) {
            console.error(`Cache fetch failed for ${this.category}:`, error);
        }
    }

    async getImage() {
        // If cache is empty, fetch immediately
        if (this.cache.length === 0) {
            try {
                const data = await nsfw.fetch(this.category);
                this.triggerBackgroundPreload(); // Start preloading for next time
                return data.image.url;
            } catch (error) {
                throw error;
            }
        }

        // Get cached image
        const cachedImage = this.cache.shift();
        
        // Immediately trigger background preload to maintain cache
        this.triggerBackgroundPreload();
        
        return cachedImage.url;
    }

    triggerBackgroundPreload() {
        if (this.isPreloading) return;
        
        // Preload in background without blocking
        setImmediate(async () => {
            while (this.cache.length < this.targetCacheSize && !this.isPreloading) {
                this.isPreloading = true;
                await this.fetchAndCache();
                this.isPreloading = false;
                
                // Small delay to prevent API spam
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        });
    }
}

// Initialize preloader for this category
const imagePreloader = new ImagePreloader("sixtynine");

// Cooldown tracking - Even playful connections need moments of anticipation.
const cooldowns = new Map();

// Shared function to generate the response payload using Components V2
const generateSixtyninePayload = async () => {
    try {
        const imageUrl = await imagePreloader.getImage(); // Ultra-fast preloaded image

        // Wrapping it in a Container for that signature formal flair.
        const container = new ContainerBuilder()
            .setAccentColor(0xFF007F) // Keeping the lovely color.
            .addTextDisplayComponents( // Add a title
                textDisplay => textDisplay
                    .setContent('### Behold! A playful connection.') // Markdown for a nice heading
            )
             // Add a separator for spacing
            .addSeparatorComponents(
                separator => separator
                    .setSpacing(2) // Large spacing.
            )
            .addMediaGalleryComponents( // The main attraction!
                mediaGallery => mediaGallery
                    .addItems( // Add the image/media from the fetched URL
                        mediaGalleryItem => mediaGalleryItem
                            // Assuming nsfwhub provides a direct link that discord can handle
                            .setURL(imageUrl)
                            .setDescription('An intimate moment.') // Alt text.
                    )
            );

        // Add the Reload button.
        const reloadButton = new ButtonBuilder()
            .setCustomId('sixtynine_button_reload') // Unique ID for this command's reload button.
            .setLabel('🔃 Reload')
            .setStyle(ButtonStyle.Success);

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
        console.error('Error fetching sixtynine image:', error);
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
                    .setContent('Failed to fetch the requested image. The API seems shy about this one.')
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
        .setName('sixtynine')
        .setDescription('Presents a playful encounter.'), // Appropriate description.

    // Slash Command Execution
    async slashExecute(interaction) {
        const userId = interaction.user.id;
        const now = Date.now();
        const cooldownAmount = 2000; // 2 seconds of playful anticipation.

        if (cooldowns.has(userId)) {
            const expirationTime = cooldowns.get(userId) + cooldownAmount;
            
            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                return await interaction.reply({
                    embeds: [{
                        color: 0xFF6B6B,
                        title: '⏰ Patience, playful soul.',
                        description: `You must wait **${timeLeft.toFixed(1)}s** before witnessing another intimate moment.`,
                        footer: { text: 'Intimacy requires timing.' }
                    }],
                    ephemeral: true
                });
            }
        }

        cooldowns.set(userId, now);
        setTimeout(() => cooldowns.delete(userId), cooldownAmount);

        // Defer the reply.
        await interaction.deferReply({ ephemeral: false });

        const payload = await generateSixtyninePayload();

        // Edit the deferred reply.
        await interaction.editReply(payload);
    },

    // Prefix Command Execution
    async prefixExecute(message, args) {
        const userId = message.author.id;
        const now = Date.now();
        const cooldownAmount = 2000; // 2 seconds of intimate waiting.

        if (cooldowns.has(userId)) {
            const expirationTime = cooldowns.get(userId) + cooldownAmount;
            
            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                return await message.reply({
                    embeds: [{
                        color: 0xFF6B6B,
                        title: '⏰ Patience, playful soul.',
                        description: `You must wait **${timeLeft.toFixed(1)}s** before witnessing another intimate moment.`,
                        footer: { text: 'Intimacy requires timing.' }
                    }]
                });
            }
        }

        cooldowns.set(userId, now);
        setTimeout(() => cooldowns.delete(userId), cooldownAmount);

        // Send the message directly for prefix commands.
        const payload = await generateSixtyninePayload();
        await message.channel.send(payload);
    },

    // Component Handling (e.g., Button Clicks)
    async handleComponent(interaction, componentArgs) {
         // componentArgs will contain parts of the customId after the command name, e.g., ['button', 'reload']
        const componentType = componentArgs[0];
        const action = componentArgs[1];

        if (componentType === 'button' && action === 'reload') {
            const userId = interaction.user.id;
            const now = Date.now();
            const cooldownAmount = 2000; // 2 seconds of intimate patience.

            if (cooldowns.has(userId)) {
                const expirationTime = cooldowns.get(userId) + cooldownAmount;
                
                if (now < expirationTime) {
                    const timeLeft = (expirationTime - now) / 1000;
                    return await interaction.reply({
                        embeds: [{
                            color: 0xFF6B6B,
                            title: '⏰ Patience, playful soul.',
                            description: `You must wait **${timeLeft.toFixed(1)}s** before witnessing another intimate moment.`,
                            footer: { text: 'Intimacy requires timing.' }
                        }],
                        ephemeral: true
                    });
                }
            }

            cooldowns.set(userId, now);
            setTimeout(() => cooldowns.delete(userId), cooldownAmount);

            // Handle the reload button click
            try {
                // Defer the button interaction update.
                await interaction.deferUpdate();

                // Generate a new payload with a fresh image.
                const newPayload = await generateSixtyninePayload();

                // Edit the original message.
                await interaction.editReply(newPayload);

            } catch (error) {
                console.error('Error handling sixtynine reload button:', error);
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