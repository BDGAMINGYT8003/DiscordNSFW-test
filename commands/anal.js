
// commands/anal.js

const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder, MediaGalleryBuilder, TextDisplayBuilder, MessageFlags, ContainerBuilder, SeparatorSpacingSize, EmbedBuilder } = require('discord.js');
const NSFW = require('@jcauman23/discordnsfw');
const fs = require('fs');
const path = require('path');

const nsfw = new NSFW();

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
    constructor() {
        this.animeCache = [];
        this.realCache = [];
        this.isPreloadingAnime = false;
        this.isPreloadingReal = false;
        this.targetCacheSize = 2;
        this.preloadOnInit();
    }

    async preloadOnInit() {
        if (this.isPreloadingAnime || this.isPreloadingReal) return;
        
        try {
            // Preload both categories
            const animePromises = Array(this.targetCacheSize).fill().map(() => this.fetchAndCache('anime'));
            const realPromises = Array(this.targetCacheSize).fill().map(() => this.fetchAndCache('real'));
            
            await Promise.all([...animePromises, ...realPromises]);
        } catch (error) {
            console.error('Initial preload failed:', error);
        }
    }

    async fetchAndCache(category) {
        let retries = 3;
        while (retries > 0) {
            try {
                let imageUrl;
                if (category === 'anime') {
                    imageUrl = await nsfw.anime.anal();
                } else {
                    imageUrl = await nsfw.real.anal();
                }
                
                if (imageUrl) {
                    const cacheObj = {
                        url: imageUrl,
                        timestamp: Date.now()
                    };
                    
                    if (category === 'anime') {
                        this.animeCache.push(cacheObj);
                    } else {
                        this.realCache.push(cacheObj);
                    }
                    return;
                }
            } catch (error) {
                console.error(`Cache fetch failed for anal (${category}, ${retries} retries left):`, error);
            }
            
            retries--;
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, (4 - retries) * 1000));
            }
        }
    }

    async getImage(category) {
        const cache = category === 'anime' ? this.animeCache : this.realCache;
        
        if (cache.length === 0) {
            let retries = 3;
            while (retries > 0) {
                try {
                    let imageUrl;
                    if (category === 'anime') {
                        imageUrl = await nsfw.anime.anal();
                    } else {
                        imageUrl = await nsfw.real.anal();
                    }
                    
                    if (imageUrl) {
                        this.triggerBackgroundPreload(category);
                        return imageUrl;
                    }
                } catch (error) {
                    console.error(`Direct fetch failed for anal (${category}, ${retries} retries left):`, error);
                }
                
                retries--;
                if (retries > 0) {
                    await new Promise(resolve => setTimeout(resolve, (4 - retries) * 1000));
                }
            }
            
            throw new Error(`Failed to fetch image after multiple attempts`);
        }

        const cachedImage = cache.shift();
        this.triggerBackgroundPreload(category);
        
        return cachedImage.url;
    }

    triggerBackgroundPreload(category) {
        const cache = category === 'anime' ? this.animeCache : this.realCache;
        const isPreloading = category === 'anime' ? this.isPreloadingAnime : this.isPreloadingReal;
        
        if (isPreloading) return;
        
        setImmediate(async () => {
            while (cache.length < this.targetCacheSize && !isPreloading) {
                if (category === 'anime') {
                    this.isPreloadingAnime = true;
                } else {
                    this.isPreloadingReal = true;
                }
                
                await this.fetchAndCache(category);
                
                if (category === 'anime') {
                    this.isPreloadingAnime = false;
                } else {
                    this.isPreloadingReal = false;
                }
                
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        });
    }
}

const imagePreloader = new ImagePreloader();

// Function to generate initial selection payload
const generateSelectionPayload = () => {
    const container = new ContainerBuilder()
        .setAccentColor(0xFF007F)
        .addTextDisplayComponents(
            textDisplay => textDisplay
                .setContent('### Behold! A journey to the rear.')
        )
        .addSeparatorComponents(
            separator => separator
                .setSpacing(SeparatorSpacingSize.Large)
        )
        .addTextDisplayComponents(
            textDisplay => textDisplay
                .setContent('Select a category to explore:')
        );

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('anal_select_category')
        .setPlaceholder('Choose your adventure...')
        .addOptions(
            {
                label: 'Anime',
                description: 'Animated delights',
                value: 'anime',
                emoji: '🎌'
            },
            {
                label: 'Real',
                description: 'Authentic experiences',
                value: 'real',
                emoji: '📸'
            }
        );

    const selectRow = new ActionRowBuilder()
        .addComponents(selectMenu);

    container.addActionRowComponents(selectRow);

    return {
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    };
};

// Function to generate image payload with category
const generateAnalPayload = async (category, cachedUrl = null) => {
    try {
        let imageUrl = cachedUrl;
        
        if (!imageUrl) {
            try {
                imageUrl = await imagePreloader.getImage(category);
            } catch (fetchError) {
                console.error('Failed to fetch new image, trying cached URL:', fetchError);
                const cache = loadCache();
                imageUrl = cache[`lastAnal${category.charAt(0).toUpperCase() + category.slice(1)}Url`];
                
                if (!imageUrl) {
                    throw new Error('No cached image available and API fetch failed');
                }
            }
        }

        if (!cachedUrl && imageUrl) {
            const cache = loadCache();
            cache[`lastAnal${category.charAt(0).toUpperCase() + category.slice(1)}Url`] = imageUrl;
            cache.lastAnalCategory = category;
            saveCache(cache);
        }

        const container = new ContainerBuilder()
            .setAccentColor(0xFF007F)
            .addTextDisplayComponents(
                textDisplay => textDisplay
                    .setContent('### Behold! A journey to the rear.')
            )
            .addSeparatorComponents(
                separator => separator
                    .setSpacing(SeparatorSpacingSize.Large)
            )
            .addMediaGalleryComponents(
                mediaGallery => mediaGallery
                    .addItems(
                        mediaGalleryItem => mediaGalleryItem
                            .setURL(imageUrl)
                            .setDescription(`A path well-trodden (${category}).`)
                    )
            );

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('anal_select_category')
            .setPlaceholder('Choose your adventure...')
            .addOptions(
                {
                    label: 'Anime',
                    description: 'Animated delights',
                    value: 'anime',
                    emoji: '🎌',
                    default: category === 'anime'
                },
                {
                    label: 'Real',
                    description: 'Authentic experiences',
                    value: 'real',
                    emoji: '📸',
                    default: category === 'real'
                }
            );

        const reloadButton = new ButtonBuilder()
            .setCustomId('anal_button_reload')
            .setLabel('🔃 Reload')
            .setStyle(ButtonStyle.Success);

        const selectRow = new ActionRowBuilder()
            .addComponents(selectMenu);

        const buttonRow = new ActionRowBuilder()
            .addComponents(reloadButton);

        container.addActionRowComponents(selectRow, buttonRow);

        return {
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        };

    } catch (error) {
        console.error('Error fetching anal image:', error);
        const errorContainer = new ContainerBuilder()
            .setAccentColor(0xFF0000)
            .addTextDisplayComponents(
                textDisplay => textDisplay
                    .setContent('### Error')
            )
            .addSeparatorComponents(
                separator => separator
                    .setSpacing(SeparatorSpacingSize.Large)
            )
            .addTextDisplayComponents(
                textDisplay => textDisplay
                    .setContent('Failed to fetch the requested image. This particular tunnel seems blocked right now.')
            );

        return {
            components: [errorContainer],
            flags: MessageFlags.IsComponentsV2,
        };
    }
};

// Function to update components with countdown
const updateCountdown = async (interaction, seconds, category, cachedUrl) => {
    const container = new ContainerBuilder()
        .setAccentColor(0xFF007F)
        .addTextDisplayComponents(
            textDisplay => textDisplay
                .setContent('### Behold! A journey to the rear.')
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
                        .setDescription(`A path well-trodden (${category}).`)
                )
        );

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('anal_select_category')
        .setPlaceholder('Choose your adventure...')
        .addOptions(
            {
                label: 'Anime',
                description: 'Animated delights',
                value: 'anime',
                emoji: '🎌',
                default: category === 'anime'
            },
            {
                label: 'Real',
                description: 'Authentic experiences',
                value: 'real',
                emoji: '📸',
                default: category === 'real'
            }
        )
        .setDisabled(true);

    const reloadButton = new ButtonBuilder()
        .setCustomId('anal_button_reload')
        .setLabel(`🔃 Reload (${seconds}s)`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);

    const selectRow = new ActionRowBuilder()
        .addComponents(selectMenu);

    const buttonRow = new ActionRowBuilder()
        .addComponents(reloadButton);

    container.addActionRowComponents(selectRow, buttonRow);

    const payload = {
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    };

    try {
        await interaction.editReply(payload);
    } catch (error) {
        console.error('Error updating countdown:', error);
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('anal')
        .setDescription('Explores a different kind of entry.'),

    async slashExecute(interaction) {
        const cooldownCheck = checkCooldown(interaction.user.id, 'anal');
        
        if (cooldownCheck.onCooldown) {
            return await interaction.reply({ 
                embeds: [createCooldownEmbed(cooldownCheck.remaining)], 
                ephemeral: true 
            });
        }

        await interaction.deferReply({ ephemeral: false });

        const payload = generateSelectionPayload();
        
        setCooldown(interaction.user.id, 'anal');

        await interaction.editReply(payload);
    },

    async prefixExecute(message, args) {
        const cooldownCheck = checkCooldown(message.author.id, 'anal');
        
        if (cooldownCheck.onCooldown) {
            return await message.reply({ 
                embeds: [createCooldownEmbed(cooldownCheck.remaining)], 
                ephemeral: true 
            });
        }

        const payload = generateSelectionPayload();
        
        setCooldown(message.author.id, 'anal');
        
        await message.channel.send(payload);
    },

    async handleComponent(interaction, componentArgs) {
        const componentType = componentArgs[0];
        const action = componentArgs[1];

        if (componentType === 'select' && action === 'category') {
            const cooldownCheck = checkCooldown(interaction.user.id, 'anal');
            
            if (cooldownCheck.onCooldown) {
                return await interaction.reply({ 
                    embeds: [createCooldownEmbed(cooldownCheck.remaining)], 
                    ephemeral: true 
                });
            }

            try {
                await interaction.deferUpdate();
                
                const selectedCategory = interaction.values[0];
                const payload = await generateAnalPayload(selectedCategory);
                
                setCooldown(interaction.user.id, 'anal');
                
                await interaction.editReply(payload);
            } catch (error) {
                console.error('Error handling category selection:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'Failed to load the image!', ephemeral: true });
                } else {
                    await interaction.followUp({ content: 'Failed to load the image!', ephemeral: true });
                }
            }
        }

        if (componentType === 'button' && action === 'reload') {
            const cooldownCheck = checkCooldown(interaction.user.id, 'anal');
            
            if (cooldownCheck.onCooldown) {
                return await interaction.reply({ 
                    embeds: [createCooldownEmbed(cooldownCheck.remaining)], 
                    ephemeral: true 
                });
            }

            try {
                await interaction.deferUpdate();

                const cache = loadCache();
                const lastCategory = cache.lastAnalCategory || 'anime';
                const cachedUrl = cache[`lastAnal${lastCategory.charAt(0).toUpperCase() + lastCategory.slice(1)}Url`];

                setCooldown(interaction.user.id, 'anal');

                if (cachedUrl) {
                    for (let i = 2; i > 0; i--) {
                        await updateCountdown(interaction, i, lastCategory, cachedUrl);
                        if (i > 1) await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }

                try {
                    const newPayload = await generateAnalPayload(lastCategory);
                    await interaction.editReply(newPayload);
                } catch (payloadError) {
                    console.error('Failed to generate new payload, keeping current image:', payloadError);
                    if (cachedUrl) {
                        const fallbackPayload = await generateAnalPayload(lastCategory, cachedUrl);
                        await interaction.editReply(fallbackPayload);
                    } else {
                        throw payloadError;
                    }
                }

            } catch (error) {
                console.error('Error handling anal reload button:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'Failed to reload the image!', ephemeral: true });
                } else {
                    await interaction.followUp({ content: 'Failed to reload the image!', ephemeral: true });
                }
            }
        }
    },
};
