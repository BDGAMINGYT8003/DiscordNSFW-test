
// commands/finger.js

const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MediaGalleryBuilder, TextDisplayBuilder, MessageFlags, ContainerBuilder, SeparatorSpacingSize, EmbedBuilder } = require('discord.js');
const { NSFW } = require('nsfwhub'); // Import the NSFW library.
const fs = require('fs');
const path = require('path');

const nsfw = new NSFW(); // Create an instance.

// Cooldown and cache management
const cooldownFile = path.join(__dirname, '..', 'storage', 'cooldown.json');
const cacheFile = path.join(__dirname, '..', 'storage', 'cache.json');

const loadCooldowns = () => {
    try {
        if (fs.existsSync(cooldownFile)) {
            return JSON.parse(fs.readFileSync(cooldownFile, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading cooldowns:', error);
    }
    return {};
};

const saveCooldowns = (cooldowns) => {
    try {
        fs.writeFileSync(cooldownFile, JSON.stringify(cooldowns, null, 2));
    } catch (error) {
        console.error('Error saving cooldowns:', error);
    }
};

const loadCache = () => {
    try {
        if (fs.existsSync(cacheFile)) {
            return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading cache:', error);
    }
    return {};
};

const saveCache = (cache) => {
    try {
        fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
    } catch (error) {
        console.error('Error saving cache:', error);
    }
};

const checkCooldown = (userId, commandName) => {
    const cooldowns = loadCooldowns();
    const userCooldowns = cooldowns[userId] || {};
    const lastUsed = userCooldowns[commandName] || 0;
    const now = Date.now();
    const cooldownTime = 2000; // 2 seconds
    
    if (now - lastUsed < cooldownTime) {
        const remaining = Math.ceil((cooldownTime - (now - lastUsed)) / 1000);
        return { onCooldown: true, remaining };
    }
    
    return { onCooldown: false };
};

const setCooldown = (userId, commandName) => {
    const cooldowns = loadCooldowns();
    if (!cooldowns[userId]) {
        cooldowns[userId] = {};
    }
    cooldowns[userId][commandName] = Date.now();
    saveCooldowns(cooldowns);
};

const createCooldownEmbed = (remaining) => {
    return new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('⏰ Slow down there, tiger!')
        .setDescription(`You're moving too fast! Please wait ${remaining} more second${remaining > 1 ? 's' : ''} before using this command again.`)
        .setTimestamp();
};

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
        let retries = 3;
        while (retries > 0) {
            try {
                const data = await nsfw.fetch(this.category);
                if (data && data.image && data.image.url) {
                    this.cache.push({
                        url: data.image.url,
                        timestamp: Date.now()
                    });
                    return; // Success, exit retry loop
                }
            } catch (error) {
                console.error(`Cache fetch failed for ${this.category} (${retries} retries left):`, error);
            }
            
            retries--;
            if (retries > 0) {
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, (4 - retries) * 1000));
            }
        }
    }

    async getImage() {
        // If cache is empty, try to fetch with retries
        if (this.cache.length === 0) {
            let retries = 3;
            while (retries > 0) {
                try {
                    const data = await nsfw.fetch(this.category);
                    if (data && data.image && data.image.url) {
                        this.triggerBackgroundPreload(); // Start preloading for next time
                        return data.image.url;
                    }
                } catch (error) {
                    console.error(`Direct fetch failed for ${this.category} (${retries} retries left):`, error);
                }
                
                retries--;
                if (retries > 0) {
                    // Wait before retrying (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, (4 - retries) * 1000));
                }
            }
            
            // If all retries failed, throw error
            throw new Error(`Failed to fetch image after multiple attempts`);
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
const imagePreloader = new ImagePreloader("finger");

// Shared function to generate the response payload using Components V2
const generateFingerPayload = async (cachedUrl = null) => {
    try {
        const imageUrl = cachedUrl || await imagePreloader.getImage(); // Ultra-fast preloaded image

        // Cache the URL for reuse during cooldown
        if (!cachedUrl) {
            const cache = loadCache();
            cache.lastFingerUrl = imageUrl;
            saveCache(cache);
        }

        // Wrapping it in a Container for that signature formal flair.
        const container = new ContainerBuilder()
            .setAccentColor(0xFF007F) // Keeping the lovely color.
            .addTextDisplayComponents( // Add a title
                textDisplay => textDisplay
                    .setContent('### Behold! The art of touch.') // Markdown for a nice heading
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
                            .setDescription('Delicate exploration.') // Alt text.
                    )
            );

        // Add the Reload button.
        const reloadButton = new ButtonBuilder()
            .setCustomId('finger_button_reload') // Unique ID for this command's reload button.
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
        console.error('Error fetching finger image:', error);
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
                    .setContent('Failed to fetch the requested image. The touch has slipped away.')
            );

         const errorPayload = {
            components: [errorContainer],
            flags: MessageFlags.IsComponentsV2,
         };
         return errorPayload;
    }
};

// Function to update button with countdown
const updateButtonCountdown = async (interaction, seconds, cachedUrl) => {
    const container = new ContainerBuilder()
        .setAccentColor(0xFF007F)
        .addTextDisplayComponents(
            textDisplay => textDisplay
                .setContent('### Behold! The art of touch.')
        )
        .addSeparatorComponents(
            separator => separator
                .setSpacing(SeparatorSpacingSize.Large)
        )
        .addMediaGalleryComponents(
            mediaGallery => mediaGallery
                .addItems(
                    mediaGalleryItem => mediaGalleryItem
                        .setURL(cachedUrl)
                        .setDescription('Delicate exploration.')
                )
        );

    const reloadButton = new ButtonBuilder()
        .setCustomId('finger_button_reload')
        .setLabel(`🔃 Reload (${seconds}s)`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);

    const actionRow = new ActionRowBuilder()
        .addComponents(reloadButton);

    container.addActionRowComponents(actionRow);

    const payload = {
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    };

    try {
        await interaction.editReply(payload);
    } catch (error) {
        console.error('Error updating button countdown:', error);
    }
};

module.exports = {
    // Slash Command Definition
    data: new SlashCommandBuilder()
        .setName('finger')
        .setDescription('Explores intimate contact.'), // A descriptive explanation.

    // Slash Command Execution
    async slashExecute(interaction) {
        const cooldownCheck = checkCooldown(interaction.user.id, 'finger');
        
        if (cooldownCheck.onCooldown) {
            return await interaction.reply({ 
                embeds: [createCooldownEmbed(cooldownCheck.remaining)], 
                ephemeral: true 
            });
        }

        // Defer the reply.
        await interaction.deferReply({ ephemeral: false });

        const payload = await generateFingerPayload();
        
        // Set cooldown after successful execution
        setCooldown(interaction.user.id, 'finger');

        // Edit the deferred reply.
        await interaction.editReply(payload);
    },

    // Prefix Command Execution
    async prefixExecute(message, args) {
        const cooldownCheck = checkCooldown(message.author.id, 'finger');
        
        if (cooldownCheck.onCooldown) {
            return await message.reply({ 
                embeds: [createCooldownEmbed(cooldownCheck.remaining)], 
                ephemeral: true 
            });
        }

        // Send the message directly for prefix commands.
        const payload = await generateFingerPayload();
        
        // Set cooldown after successful execution
        setCooldown(message.author.id, 'finger');
        
        await message.channel.send(payload);
    },

    // Component Handling (e.g., Button Clicks)
    async handleComponent(interaction, componentArgs) {
         // componentArgs will contain parts of the customId after the command name, e.g., ['button', 'reload']
        const componentType = componentArgs[0];
        const action = componentArgs[1];

        if (componentType === 'button' && action === 'reload') {
            const cooldownCheck = checkCooldown(interaction.user.id, 'finger');
            
            if (cooldownCheck.onCooldown) {
                return await interaction.reply({ 
                    embeds: [createCooldownEmbed(cooldownCheck.remaining)], 
                    ephemeral: true 
                });
            }

            // Handle the reload button click
            try {
                // Defer the button interaction update.
                await interaction.deferUpdate();

                // Get cached URL to reuse during countdown
                const cache = loadCache();
                const cachedUrl = cache.lastFingerUrl;

                // Set cooldown immediately
                setCooldown(interaction.user.id, 'finger');

                // Start countdown without fetching new image
                if (cachedUrl) {
                    for (let i = 2; i > 0; i--) {
                        await updateButtonCountdown(interaction, i, cachedUrl);
                        if (i > 1) await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }

                // Generate a new payload with a fresh image after countdown
                const newPayload = await generateFingerPayload();

                // Edit the original message.
                await interaction.editReply(newPayload);

            } catch (error) {
                console.error('Error handling finger reload button:', error);
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
