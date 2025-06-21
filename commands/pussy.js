// commands/pussy.js

const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MediaGalleryBuilder, TextDisplayBuilder, MessageFlags, ContainerBuilder } = require('discord.js');
const { NSFW } = require('nsfwhub'); // Import the NSFW library, just as you wanted.

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
const imagePreloader = new ImagePreloader("pussy");

// Cooldown tracking - Even the most delightful views require a moment of pause.
const cooldowns = new Map();

// Shared function to generate the response payload using Components V2
const generatePussyPayload = async () => {
    try {
        const imageUrl = await imagePreloader.getImage(); // Ultra-fast preloaded image

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
                    .setSpacing(2) // Large spacing
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
            .setStyle(ButtonStyle.Success); // A prominent button for a prominent action.

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
                    .setSpacing(2) // Large spacing
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
        const userId = interaction.user.id;
        const now = Date.now();
        const cooldownAmount = 2000; // 2 seconds of delightful anticipation.

        if (cooldowns.has(userId)) {
            const expirationTime = cooldowns.get(userId) + cooldownAmount;
            
            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                return await interaction.reply({
                    embeds: [{
                        color: 0xFF6B6B,
                        title: '⏰ Patience, lovely viewer.',
                        description: `You must wait **${timeLeft.toFixed(1)}s** before requesting another delightful view.`,
                        footer: { text: 'Beauty is worth the wait.' }
                    }],
                    ephemeral: true
                });
            }
        }

        cooldowns.set(userId, now);
        setTimeout(() => cooldowns.delete(userId), cooldownAmount);

        // Defer the reply as fetching the image might take a moment.
        await interaction.deferReply({ ephemeral: false }); // Make it visible to everyone.

        const payload = await generatePussyPayload();

        // Edit the deferred reply with the generated payload.
        await interaction.editReply(payload);
    },

    // Prefix Command Execution
    async prefixExecute(message, args) {
        const userId = message.author.id;
        const now = Date.now();
        const cooldownAmount = 2000; // 2 seconds of graceful waiting.

        if (cooldowns.has(userId)) {
            const expirationTime = cooldowns.get(userId) + cooldownAmount;
            
            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                return await message.reply({
                    embeds: [{
                        color: 0xFF6B6B,
                        title: '⏰ Patience, lovely viewer.',
                        description: `You must wait **${timeLeft.toFixed(1)}s** before requesting another delightful view.`,
                        footer: { text: 'Beauty is worth the wait.' }
                    }]
                });
            }
        }

        cooldowns.set(userId, now);
        setTimeout(() => cooldowns.delete(userId), cooldownAmount);

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
            const userId = interaction.user.id;
            const now = Date.now();
            const cooldownAmount = 2000; // 2 seconds of eager anticipation.

            if (cooldowns.has(userId)) {
                const expirationTime = cooldowns.get(userId) + cooldownAmount;
                
                if (now < expirationTime) {
                    const timeLeft = (expirationTime - now) / 1000;
                    return await interaction.reply({
                        embeds: [{
                            color: 0xFF6B6B,
                            title: '⏰ Patience, lovely viewer.',
                            description: `You must wait **${timeLeft.toFixed(1)}s** before requesting another delightful view.`,
                            footer: { text: 'Beauty is worth the wait.' }
                        }],
                        ephemeral: true
                    });
                }
            }

            cooldowns.set(userId, now);
            setTimeout(() => cooldowns.delete(userId), cooldownAmount);

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