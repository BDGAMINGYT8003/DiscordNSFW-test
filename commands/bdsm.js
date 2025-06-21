// commands/bdsm.js

const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MediaGalleryBuilder, TextDisplayBuilder, MessageFlags, ContainerBuilder, SeparatorSpacingSize } = require('discord.js');
const { NSFW } = require('nsfwhub'); // Import the NSFW library.

const nsfw = new NSFW(); // Create an instance.

// Ultra-Robust Advanced Preloading Cache System
class ImagePreloader {
    constructor(category) {
        this.category = category;
        this.cache = [];
        this.isPreloading = false;
        this.targetCacheSize = 3; // Increased cache size
        this.maxRetries = 5; // Maximum retry attempts
        this.retryDelay = 1000; // Base retry delay in ms
        this.preloadOnInit();
    }

    async preloadOnInit() {
        if (this.isPreloading) return;
        this.isPreloading = true;
        
        try {
            // Use sequential loading with retry for initial preload
            for (let i = 0; i < this.targetCacheSize; i++) {
                await this.fetchAndCacheWithRetry();
                await new Promise(resolve => setTimeout(resolve, 200)); // Prevent API spam
            }
        } catch (error) {
            console.error(`Initial preload failed for ${this.category}:`, error);
        }
        
        this.isPreloading = false;
    }

    async fetchAndCacheWithRetry(retryCount = 0) {
        try {
            const data = await this.fetchWithValidation();
            if (data && data.url) {
                this.cache.push({
                    url: data.url,
                    timestamp: Date.now()
                });
                return true;
            }
            throw new Error('Invalid data structure received');
        } catch (error) {
            if (retryCount < this.maxRetries) {
                console.warn(`Fetch attempt ${retryCount + 1} failed for ${this.category}, retrying...`);
                await new Promise(resolve => setTimeout(resolve, this.retryDelay * (retryCount + 1)));
                return this.fetchAndCacheWithRetry(retryCount + 1);
            }
            console.error(`All retry attempts failed for ${this.category}:`, error);
            return false;
        }
    }

    async fetchWithValidation() {
        const data = await nsfw.fetch(this.category);
        
        // Handle different possible API response structures
        if (data && data.image && data.image.url) {
            return { url: data.image.url };
        } else if (data && data.url) {
            return { url: data.url };
        } else if (typeof data === 'string') {
            return { url: data };
        } else if (data && Array.isArray(data) && data.length > 0) {
            const item = data[0];
            if (item.image && item.image.url) {
                return { url: item.image.url };
            } else if (item.url) {
                return { url: item.url };
            }
        }
        
        throw new Error(`Unexpected API response structure: ${JSON.stringify(data)}`);
    }

    async getImage() {
        // Try to get from cache first
        if (this.cache.length > 0) {
            const cachedImage = this.cache.shift();
            this.triggerBackgroundPreload();
            return cachedImage.url;
        }

        // If cache is empty, fetch with retry mechanism
        let retryCount = 0;
        while (retryCount < this.maxRetries) {
            try {
                const data = await this.fetchWithValidation();
                this.triggerBackgroundPreload(); // Start preloading for next time
                return data.url;
            } catch (error) {
                retryCount++;
                if (retryCount >= this.maxRetries) {
                    throw new Error(`Failed to fetch image after ${this.maxRetries} attempts: ${error.message}`);
                }
                console.warn(`Fetch attempt ${retryCount} failed for ${this.category}, retrying...`);
                await new Promise(resolve => setTimeout(resolve, this.retryDelay * retryCount));
            }
        }
    }

    triggerBackgroundPreload() {
        if (this.isPreloading) return;
        
        // Enhanced background preloading with better error handling
        setImmediate(async () => {
            this.isPreloading = true;
            
            try {
                while (this.cache.length < this.targetCacheSize) {
                    const success = await this.fetchAndCacheWithRetry();
                    if (!success) {
                        // If fetching fails, wait longer before trying again
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        break; // Exit the loop to prevent infinite retries
                    }
                    
                    // Small delay between successful fetches
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            } catch (error) {
                console.error(`Background preload error for ${this.category}:`, error);
            }
            
            this.isPreloading = false;
        });
    }
}

// Initialize preloader for this category
const imagePreloader = new ImagePreloader("bdsm");

// Shared function to generate the response payload using Components V2
const generateBdsmPayload = async () => {
    try {
        const imageUrl = await imagePreloader.getImage(); // Ultra-fast preloaded image

        // Wrapping it in a Container for that signature formal flair.
        const container = new ContainerBuilder()
            .setAccentColor(0xFF007F) // Keeping the lovely color.
            .addTextDisplayComponents( // Add a title
                textDisplay => textDisplay
                    .setContent('### Behold! An exploration of control.') // Markdown for a nice heading
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
                            .setDescription('Ties that bind.') // Alt text.
                    )
            );

        // Add the Reload button.
        const reloadButton = new ButtonBuilder()
            .setCustomId('bdsm_button_reload') // Unique ID for this command's reload button.
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
        console.error('Error fetching bdsm image:', error);
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
                    .setContent('Failed to fetch the requested image. The scene might be too intense for the API right now.')
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
        .setName('bdsm')
        .setDescription('Explores themes of power and pleasure.'), // A thematic description.

    // Slash Command Execution
    async slashExecute(interaction) {
        // Defer the reply.
        await interaction.deferReply({ ephemeral: false });

        const payload = await generateBdsmPayload();

        // Edit the deferred reply.
        await interaction.editReply(payload);
    },

    // Prefix Command Execution
    async prefixExecute(message, args) {
        // Send the message directly for prefix commands.
        const payload = await generateBdsmPayload();
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
                const newPayload = await generateBdsmPayload();

                // Edit the original message.
                await interaction.editReply(newPayload);

            } catch (error) {
                console.error('Error handling bdsm reload button:', error);
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