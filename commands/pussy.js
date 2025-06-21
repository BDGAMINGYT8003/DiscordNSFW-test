
// commands/pussy.js

const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MediaGalleryBuilder, TextDisplayBuilder, MessageFlags, ContainerBuilder, EmbedBuilder } = require('discord.js');
const { NSFW } = require('nsfwhub'); // Import the NSFW library, just as you wanted.
const fs = require('fs').promises;
const path = require('path');

const nsfw = new NSFW(); // Create an instance.

// Cooldown and cache management
const COOLDOWN_DURATION = 2000; // 2 seconds
const cooldownFile = path.join(__dirname, '..', 'storage', 'cooldown.json');
const cacheFile = path.join(__dirname, '..', 'storage', 'cache.json');

const readJsonFile = async (filePath) => {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch {
        return {};
    }
};

const writeJsonFile = async (filePath, data) => {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
};

const isOnCooldown = async (userId, commandName) => {
    const cooldowns = await readJsonFile(cooldownFile);
    const userCooldowns = cooldowns[userId] || {};
    const lastUsed = userCooldowns[commandName];
    
    if (!lastUsed) return false;
    
    return Date.now() - lastUsed < COOLDOWN_DURATION;
};

const setCooldown = async (userId, commandName) => {
    const cooldowns = await readJsonFile(cooldownFile);
    if (!cooldowns[userId]) cooldowns[userId] = {};
    cooldowns[userId][commandName] = Date.now();
    await writeJsonFile(cooldownFile, cooldowns);
};

const getCachedImage = async (commandName) => {
    const cache = await readJsonFile(cacheFile);
    return cache[commandName];
};

const setCachedImage = async (commandName, imageUrl) => {
    const cache = await readJsonFile(cacheFile);
    cache[commandName] = imageUrl;
    await writeJsonFile(cacheFile, cache);
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

// Shared function to generate the response payload using Components V2
const generatePussyPayload = async (useCache = false) => {
    try {
        let imageUrl;
        
        if (useCache) {
            imageUrl = await getCachedImage('pussy');
            if (!imageUrl) {
                imageUrl = await imagePreloader.getImage();
                await setCachedImage('pussy', imageUrl);
            }
        } else {
            imageUrl = await imagePreloader.getImage(); // Ultra-fast preloaded image
            await setCachedImage('pussy', imageUrl);
        }

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

const updateButtonWithCountdown = async (interaction, remainingTime) => {
    const cachedImageUrl = await getCachedImage('pussy');
    
    if (!cachedImageUrl) return;

    const container = new ContainerBuilder()
        .setAccentColor(0xFF007F)
        .addTextDisplayComponents(
            textDisplay => textDisplay
                .setContent('### Behold! A gift from the depths.')
        )
        .addSeparatorComponents(
            separator => separator
                .setSpacing(2)
        )
        .addMediaGalleryComponents(
            mediaGallery => mediaGallery
                .addItems(
                    mediaGalleryItem => mediaGalleryItem
                        .setURL(cachedImageUrl)
                        .setDescription('A delightful view.')
                )
        );

    const reloadButton = new ButtonBuilder()
        .setCustomId('pussy_button_reload')
        .setLabel(`🔃 Reload (${Math.ceil(remainingTime / 1000)}s)`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);

    const actionRow = new ActionRowBuilder()
        .addComponents(reloadButton);

    container.addActionRowComponents(actionRow);

    const payload = {
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    };

    await interaction.editReply(payload);
};

module.exports = {
    // Slash Command Definition
    data: new SlashCommandBuilder()
        .setName('pussy')
        .setDescription('Delivers a delightful image.'), // A simple, direct description.

    // Slash Command Execution
    async slashExecute(interaction) {
        const userId = interaction.user.id;
        
        if (await isOnCooldown(userId, 'pussy')) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('⏰ Slow down there, eager one!')
                .setDescription('The depths need a moment to prepare another gift. Please wait a moment before requesting again.')
                .setTimestamp();
            
            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        await setCooldown(userId, 'pussy');

        // Defer the reply as fetching the image might take a moment.
        await interaction.deferReply({ ephemeral: false }); // Make it visible to everyone.

        const payload = await generatePussyPayload();

        // Edit the deferred reply with the generated payload.
        await interaction.editReply(payload);
    },

    // Prefix Command Execution
    async prefixExecute(message, args) {
        const userId = message.author.id;
        
        if (await isOnCooldown(userId, 'pussy')) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('⏰ Slow down there, eager one!')
                .setDescription('The depths need a moment to prepare another gift. Please wait a moment before requesting again.')
                .setTimestamp();
            
            return await message.reply({ embeds: [embed] });
        }

        await setCooldown(userId, 'pussy');

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
            
            if (await isOnCooldown(userId, 'pussy')) {
                const embed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('⏰ Patience, dear admirer!')
                    .setDescription('The depths are still gathering another exquisite view. Please wait a moment before requesting a fresh perspective.')
                    .setTimestamp();
                
                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Handle the reload button click
            try {
                await setCooldown(userId, 'pussy');

                // Defer the button interaction update, this makes the button show a loading state.
                await interaction.deferUpdate();

                // Start countdown
                const countdownInterval = setInterval(async () => {
                    const cooldowns = await readJsonFile(cooldownFile);
                    const userCooldowns = cooldowns[userId] || {};
                    const lastUsed = userCooldowns['pussy'];
                    
                    if (!lastUsed) {
                        clearInterval(countdownInterval);
                        return;
                    }
                    
                    const elapsed = Date.now() - lastUsed;
                    const remaining = COOLDOWN_DURATION - elapsed;
                    
                    if (remaining <= 0) {
                        clearInterval(countdownInterval);
                        // Generate a new payload with a fresh image.
                        const newPayload = await generatePussyPayload();
                        await interaction.editReply(newPayload);
                    } else {
                        await updateButtonWithCountdown(interaction, remaining);
                    }
                }, 1000);

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
