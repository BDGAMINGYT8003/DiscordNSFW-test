// commands/boobs.js

const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MediaGalleryBuilder, TextDisplayBuilder, MessageFlags, ContainerBuilder, SeparatorSpacingSize } = require('discord.js');
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
const imagePreloader = new ImagePreloader("boobs");

// Cooldown tracking - Even nature's bounty deserves moments of reverence.
const cooldowns = new Map();

// Shared function to generate the response payload using Components V2
const generateBoobsPayload = async () => {
    try {
        const imageUrl = await imagePreloader.getImage(); // Ultra-fast preloaded image

        // Wrapping it in a Container for that signature formal flair.
        const container = new ContainerBuilder()
            .setAccentColor(0xFF007F) // Keeping the lovely color.
            .addTextDisplayComponents( // Add a title
                textDisplay => textDisplay
                    .setContent('### Behold! A sight to behold.') // Markdown for a nice heading
            )
             // Add a separator for spacing
            .addSeparatorComponents(
                separator => separator
                    .setSpacing(SeparatorSpacingSize.Large) // Large spacing.
            )
            .addMediaGalleryComponents( // The main attraction!
                mediaGallery => mediaGallery
                    .addItems( // Add the image/media from the fetched URL
                        mediaGalleryItem => mediaGalleryItem
                            // Assuming nsfwhub provides a direct link that discord can handle
                            .setURL(imageUrl)
                            .setDescription('Nature\'s bounty.') // Alt text.
                    )
            );

        // Add the Reload button.
        const reloadButton = new ButtonBuilder()
            .setCustomId('boobs_button_reload') // Unique ID for this command's reload button.
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
        console.error('Error fetching boobs image:', error);
        // Return an error payload using CV2 components.
        const errorContainer = new ContainerBuilder()
            .setAccentColor(0xFF0000)
            .addTextDisplayComponents(
                textDisplay => textDisplay
                    .setContent('### Error')
            )
             .addSeparatorComponents(
                separator => separator
                    .setSpacing(SeparatorSpacingSize.Large) // Large spacing
            )
            .addTextDisplayComponents(
                textDisplay => textDisplay
                    .setContent('Failed to fetch the requested image. Looks like they\'re hiding right now.')
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
        .setName('boobs')
        .setDescription('Presents a pair of fine assets.'), // A direct description.

    // Slash Command Execution
    async slashExecute(interaction) {
        const userId = interaction.user.id;
        const now = Date.now();
        const cooldownAmount = 2000; // 2 seconds of reverent waiting.

        if (cooldowns.has(userId)) {
            const expirationTime = cooldowns.get(userId) + cooldownAmount;
            
            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                return await interaction.reply({
                    embeds: [{
                        color: 0xFF6B6B,
                        title: '⏰ Patience, devoted admirer.',
                        description: `You must wait **${timeLeft.toFixed(1)}s** before beholding another sight.`,
                        footer: { text: 'Beauty demands reverence.' }
                    }],
                    ephemeral: true
                });
            }
        }

        cooldowns.set(userId, now);
        setTimeout(() => cooldowns.delete(userId), cooldownAmount);

        // Defer the reply.
        await interaction.deferReply({ ephemeral: false });

        const payload = await generateBoobsPayload();

        // Edit the deferred reply.
        await interaction.editReply(payload);
    },

    // Prefix Command Execution
    async prefixExecute(message, args) {
        const userId = message.author.id;
        const now = Date.now();
        const cooldownAmount = 2000; // 2 seconds of appreciative pause.

        if (cooldowns.has(userId)) {
            const expirationTime = cooldowns.get(userId) + cooldownAmount;
            
            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                return await message.reply({
                    embeds: [{
                        color: 0xFF6B6B,
                        title: '⏰ Patience, devoted admirer.',
                        description: `You must wait **${timeLeft.toFixed(1)}s** before beholding another sight.`,
                        footer: { text: 'Beauty demands reverence.' }
                    }]
                });
            }
        }

        cooldowns.set(userId, now);
        setTimeout(() => cooldowns.delete(userId), cooldownAmount);

        // Send the message directly for prefix commands.
        const payload = await generateBoobsPayload();
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
            const cooldownAmount = 2000; // 2 seconds of devoted appreciation.

            if (cooldowns.has(userId)) {
                const expirationTime = cooldowns.get(userId) + cooldownAmount;
                
                if (now < expirationTime) {
                    const timeLeft = (expirationTime - now) / 1000;
                    return await interaction.reply({
                        embeds: [{
                            color: 0xFF6B6B,
                            title: '⏰ Patience, devoted admirer.',
                            description: `You must wait **${timeLeft.toFixed(1)}s** before beholding another sight.`,
                            footer: { text: 'Beauty demands reverence.' }
                        }],
                        ephemeral: true
                    });
                }
            }

            cooldowns.set(userId, now);

            // Handle the reload button click
            try {
                // Defer the button interaction update.
                await interaction.deferUpdate();

                // Generate a new payload with a fresh image and disabled button.
                const newPayload = await generateBoobsPayload();
                
                // Disable the button and start countdown
                const container = newPayload.components[0];
                const actionRow = container.components.find(c => c.components && c.components[0].custom_id === 'boobs_button_reload');
                if (actionRow) {
                    actionRow.components[0].disabled = true;
                    actionRow.components[0].style = ButtonStyle.Secondary;
                    actionRow.components[0].label = '🔃 Reload (2s)';
                }

                // Edit the original message.
                await interaction.editReply(newPayload);

                // Start countdown - reuse current payload to avoid unnecessary API calls
                let countdown = 2;
                const countdownInterval = setInterval(async () => {
                    countdown--;
                    if (countdown > 0) {
                        // Reuse the current payload, only update button
                        const container = newPayload.components[0];
                        const actionRow = container.components.find(c => c.components && c.components[0].custom_id === 'boobs_button_reload');
                        if (actionRow) {
                            actionRow.components[0].disabled = true;
                            actionRow.components[0].style = ButtonStyle.Secondary;
                            actionRow.components[0].label = `🔃 Reload (${countdown}s)`;
                        }
                        await interaction.editReply(newPayload);
                    } else {
                        clearInterval(countdownInterval);
                        cooldowns.delete(userId);
                        // Re-enable button with green style
                        const container = newPayload.components[0];
                        const actionRow = container.components.find(c => c.components && c.components[0].custom_id === 'boobs_button_reload');
                        if (actionRow) {
                            actionRow.components[0].disabled = false;
                            actionRow.components[0].style = ButtonStyle.Success;
                            actionRow.components[0].label = '🔃 Reload';
                        }
                        await interaction.editReply(newPayload);
                    }
                }, 1000);

            } catch (error) {
                console.error('Error handling boobs reload button:', error);
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