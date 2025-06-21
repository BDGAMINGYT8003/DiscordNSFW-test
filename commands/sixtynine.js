
// commands/sixtynine.js

const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MediaGalleryBuilder, TextDisplayBuilder, MessageFlags, ContainerBuilder, EmbedBuilder } = require('discord.js');
const { NSFW } = require('nsfwhub'); // Import the NSFW library.
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
const imagePreloader = new ImagePreloader("sixtynine");

// Shared function to generate the response payload using Components V2
const generateSixtyninePayload = async (useCache = false) => {
    try {
        let imageUrl;
        
        if (useCache) {
            imageUrl = await getCachedImage('sixtynine');
            if (!imageUrl) {
                imageUrl = await imagePreloader.getImage();
                await setCachedImage('sixtynine', imageUrl);
            }
        } else {
            imageUrl = await imagePreloader.getImage(); // Ultra-fast preloaded image
            await setCachedImage('sixtynine', imageUrl);
        }

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

const updateButtonWithCountdown = async (interaction, remainingTime) => {
    const cachedImageUrl = await getCachedImage('sixtynine');
    
    if (!cachedImageUrl) return;

    const container = new ContainerBuilder()
        .setAccentColor(0xFF007F)
        .addTextDisplayComponents(
            textDisplay => textDisplay
                .setContent('### Behold! A playful connection.')
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
                        .setDescription('An intimate moment.')
                )
        );

    const reloadButton = new ButtonBuilder()
        .setCustomId('sixtynine_button_reload')
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
        .setName('sixtynine')
        .setDescription('Presents a playful encounter.'), // Appropriate description.

    // Slash Command Execution
    async slashExecute(interaction) {
        const userId = interaction.user.id;
        
        if (await isOnCooldown(userId, 'sixtynine')) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('⏰ Take it easy, playful one!')
                .setDescription('The intimate connection requires time to choreograph another beautiful moment. Please wait before requesting another enchanting encounter.')
                .setTimestamp();
            
            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        await setCooldown(userId, 'sixtynine');

        // Defer the reply.
        await interaction.deferReply({ ephemeral: false });

        const payload = await generateSixtyninePayload();

        // Edit the deferred reply.
        await interaction.editReply(payload);
    },

    // Prefix Command Execution
    async prefixExecute(message, args) {
        const userId = message.author.id;
        
        if (await isOnCooldown(userId, 'sixtynine')) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('⏰ Take it easy, playful one!')
                .setDescription('The intimate connection requires time to choreograph another beautiful moment. Please wait before requesting another enchanting encounter.')
                .setTimestamp();
            
            return await message.reply({ embeds: [embed] });
        }

        await setCooldown(userId, 'sixtynine');

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
            
            if (await isOnCooldown(userId, 'sixtynine')) {
                const embed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('⏰ Patience, romantic observer!')
                    .setDescription('The dancers need time to perfect their next intimate performance. Wait a moment before requesting another graceful display of connection.')
                    .setTimestamp();
                
                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Handle the reload button click
            try {
                await setCooldown(userId, 'sixtynine');

                // Defer the button interaction update.
                await interaction.deferUpdate();

                // Start countdown
                const countdownInterval = setInterval(async () => {
                    const cooldowns = await readJsonFile(cooldownFile);
                    const userCooldowns = cooldowns[userId] || {};
                    const lastUsed = userCooldowns['sixtynine'];
                    
                    if (!lastUsed) {
                        clearInterval(countdownInterval);
                        return;
                    }
                    
                    const elapsed = Date.now() - lastUsed;
                    const remaining = COOLDOWN_DURATION - elapsed;
                    
                    if (remaining <= 0) {
                        clearInterval(countdownInterval);
                        // Generate a new payload with a fresh image.
                        const newPayload = await generateSixtyninePayload();
                        await interaction.editReply(newPayload);
                    } else {
                        await updateButtonWithCountdown(interaction, remaining);
                    }
                }, 1000);

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
