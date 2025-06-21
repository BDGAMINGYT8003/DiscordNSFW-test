// commands/anal.js

const {
    SlashCommandBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    MediaGalleryBuilder,
    TextDisplayBuilder,
    MessageFlags,
    ContainerBuilder,
    SeparatorSpacingSize,
    EmbedBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} = require('discord.js');

// Use the new NSFW library
const { NSFW } = require('@jcauman23/discordnsfw');
const fs = require('fs');
const path = require('path');

const nsfw = new NSFW(); // Create an instance of the new API.

// Cooldown and cache management (using a dedicated storage directory)
const storageDir = path.join(__dirname, '..', 'storage');
const cooldownFile = path.join(storageDir, 'cooldown.json');
const cacheFile = path.join(storageDir, 'cache.json');

// Ensure storage directory exists
if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir);
}

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

const checkCooldown = (userId, commandKey) => { // commandKey now includes category (e.g., 'anal_real')
    const cooldowns = loadCooldowns();
    const userCooldowns = cooldowns[userId] || {};
    const lastUsed = userCooldowns[commandKey] || 0;
    const now = Date.now();
    const cooldownTime = 2000; // 2 seconds

    if (now - lastUsed < cooldownTime) {
        const remaining = Math.ceil((cooldownTime - (now - lastUsed)) / 1000);
        return { onCooldown: true, remaining };
    }

    return { onCooldown: false };
};

const setCooldown = (userId, commandKey) => { // commandKey now includes category
    const cooldowns = loadCooldowns();
    if (!cooldowns[userId]) {
        cooldowns[userId] = {};
    }
    cooldowns[userId][commandKey] = Date.now();
    saveCooldowns(cooldowns);
};

const createCooldownEmbed = (remaining) => {
    return new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('⏰ Slow down there, tiger!')
        .setDescription(`You're moving too fast! Please wait ${remaining} more second${remaining > 1 ? 's' : ''} before using this again.`) // Slightly generalized message
        .setTimestamp();
};

// Advanced Preloading Cache System (adapted for categories)
class ImagePreloader {
    constructor() {
        this.cache = { anime: [], real: [] };
        this.isPreloading = { anime: false, real: false };
        this.targetCacheSize = 2; // Keep 2 images of each type ready
        this.preloadOnInit('anime');
        this.preloadOnInit('real');
    }

    async preloadOnInit(type) {
        if (this.isPreloading[type]) return;
        this.isPreloading[type] = true;

        try {
            const preloadPromises = Array(this.targetCacheSize).fill().map(() => this.fetchAndCache(type));
            await Promise.all(preloadPromises);
        } catch (error) {
            console.error(`Initial preload failed for anal (${type}):`, error);
        }

        this.isPreloading[type] = false;
    }

    async fetchAndCache(type) {
        let retries = 3;
        while (retries > 0) {
            try {
                let data;
                if (type === 'anime') {
                    data = await nsfw.anime.anal(); // Use anime method
                } else if (type === 'real') {
                    data = await nsfw.real.anal(); // Use real method
                } else {
                    throw new Error(`Invalid type for fetchAndCache: ${type}`);
                }

                if (data) { // The new API seems to return the URL directly
                    this.cache[type].push({
                        url: data, // New API returns URL directly
                        timestamp: Date.now()
                    });
                    return; // Success, exit retry loop
                }
            } catch (error) {
                console.error(`Cache fetch failed for anal (${type}, ${retries} retries left):`, error);
            }

            retries--;
            if (retries > 0) {
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, (4 - retries) * 1000));
            }
        }
    }

    async getImage(type) {
         // If cache is empty or low, try to fetch with retries
        if (this.cache[type].length === 0) {
             console.warn(`Cache empty for anal (${type}), attempting direct fetch.`);
            let retries = 3;
            while (retries > 0) {
                try {
                    let data;
                    if (type === 'anime') {
                        data = await nsfw.anime.anal();
                    } else if (type === 'real') {
                        data = await nsfw.real.anal();
                    } else {
                         throw new Error(`Invalid type for getImage: ${type}`);
                    }
                    if (data) { // New API returns URL directly
                         this.triggerBackgroundPreload(type); // Start preloading for next time
                         return data;
                    }
                } catch (error) {
                    console.error(`Direct fetch failed for anal (${type}, ${retries} retries left):`, error);
                }

                retries--;
                if (retries > 0) {
                    // Wait before retrying
                    await new Promise(resolve => setTimeout(resolve, (4 - retries) * 1000));
                }
            }

            // If all retries failed, throw error
            throw new Error(`Failed to fetch image for anal (${type}) after multiple attempts`);
        }

        // Get cached image
        const cachedImage = this.cache[type].shift();

        // Immediately trigger background preload to maintain cache size
        this.triggerBackgroundPreload(type);

        return cachedImage.url;
    }

    triggerBackgroundPreload(type) {
        if (this.isPreloading[type]) return;

        // Preload in background without blocking
        setImmediate(async () => {
            while (this.cache[type].length < this.targetCacheSize && !this.isPreloading[type]) {
                this.isPreloading[type] = true;
                await this.fetchAndCache(type);
                this.isPreloading[type] = false;

                // Small delay to prevent API spam
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        });
    }
}

// Initialize preloader for this command
const imagePreloader = new ImagePreloader();

// Function to create the initial selection menu payload
const createSelectionPayload = () => {
    const container = new ContainerBuilder()
        .setAccentColor(0x0099FF) // A neutral color for selection
        .addTextDisplayComponents(
            textDisplay => textDisplay
                .setContent('### Choose your flavor:') // Instructions
        )
        .addSeparatorComponents(
            separator => separator
                .setSpacing(SeparatorSpacingSize.Large)
        );

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('anal_select_category') // Unique ID for this select menu
        .setPlaceholder('Select a category...')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Anime')
                .setValue('anime')
                .setDescription('Explore animated delights.'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Real')
                .setValue('real')
                .setDescription('Experience the genuine article.'),
        );

    const actionRow = new ActionRowBuilder()
        .addComponents(selectMenu);

    container.addActionRowComponents(actionRow);

    const payload = {
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    };

    return payload;
};


// Function to generate the response payload *after* category is selected
const generateAnalPayload = async (type, cachedUrl = null) => {
    try {
        let imageUrl = cachedUrl;

        // Only try to fetch new image if no cached URL provided
        if (!imageUrl) {
            try {
                imageUrl = await imagePreloader.getImage(type);
            } catch (fetchError) {
                console.error(`Failed to fetch new anal (${type}) image, trying cached URL:`, fetchError);
                // Try to use last cached URL as fallback
                const cache = loadCache();
                const lastCachedUrl = type === 'anime' ? cache.lastAnalAnimeUrl : cache.lastAnalRealUrl;

                if (!lastCachedUrl) {
                    throw new Error(`No cached anal (${type}) image available and API fetch failed`);
                }
                imageUrl = lastCachedUrl; // Use fallback URL
            }
        }

        // Cache the URL for reuse during cooldown and as fallback
        if (!cachedUrl && imageUrl) {
            const cache = loadCache();
            if (type === 'anime') {
                cache.lastAnalAnimeUrl = imageUrl;
            } else { // type === 'real'
                cache.lastAnalRealUrl = imageUrl;
            }
            saveCache(cache);
        }

        // Wrapping it in a Container for that signature formal flair.
        const container = new ContainerBuilder()
            .setAccentColor(0xFF007F) // Keeping the lovely color for the image display
            .addTextDisplayComponents( // Add a title indicating category
                textDisplay => textDisplay
                    .setContent(`### Behold! A ${type} journey to the rear.`) // Markdown for a nice heading
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
                            // The new API returns URLs directly, no attachment needed unless it's a local file
                            .setURL(imageUrl)
                            .setDescription(`A ${type} path well-trodden.`) // Alt text includes type.
                    )
            );

        // Add the Reload button. Custom ID includes the type.
        const reloadButton = new ButtonBuilder()
            .setCustomId(`anal_button_reload_${type}`) // Unique ID includes category type
            .setLabel('🔃 Reload')
            .setStyle(ButtonStyle.Success); // Green reload button

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
        console.error(`Error generating anal (${type}) payload:`, error);
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
                    .setContent(`Failed to fetch the requested anal (${type}) image. The API might be shy right now or encountered an issue.`)
            );

         const errorPayload = {
            components: [errorContainer],
            flags: MessageFlags.IsComponentsV2,
         };
         return errorPayload;
    }
};

// Function to update button with countdown
const updateButtonCountdown = async (interaction, seconds, type, cachedUrl) => {
     // Recreate the container with the *current* image and updated button
    const container = new ContainerBuilder()
        .setAccentColor(0xFF007F)
        .addTextDisplayComponents(
            textDisplay => textDisplay
                .setContent(`### Behold! A ${type} journey to the rear.`) // Title based on type
        )
        .addSeparatorComponents(
            separator => separator
                .setSpacing(SeparatorSpacingSize.Large)
        )
        .addMediaGalleryComponents(
            mediaGallery => mediaGallery
                .addItems(
                    mediaGalleryItem => mediaGalleryItem
                        .setURL(cachedUrl) // Use the cached URL for the countdown display
                        .setDescription(`A ${type} path well-trodden.`)
                )
        );

    const reloadButton = new ButtonBuilder()
        .setCustomId(`anal_button_reload_${type}`) // Maintain the custom ID with type
        .setLabel(`🔃 Reload (${seconds}s)`)
        .setStyle(ButtonStyle.Secondary) // Gray button during cooldown
        .setDisabled(true); // Disabled during cooldown

    const actionRow = new ActionRowBuilder()
        .addComponents(reloadButton);

     // Add the original selection menu back, disabled, so the structure is consistent (optional, could just have button)
     // User asked for them to always stay, let's add them back disabled
     const disabledSelectMenu = new StringSelectMenuBuilder()
        .setCustomId('anal_select_category') // Keep the original ID
        .setPlaceholder(`Category: ${type.charAt(0).toUpperCase() + type.slice(1)}`) // Show selected category
        .setDisabled(true) // Disabled after selection
        .addOptions( // Still include options, but disabled
            new StringSelectMenuOptionBuilder()
                .setLabel('Anime')
                .setValue('anime'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Real')
                .setValue('real'),
        );

    const disabledSelectRow = new ActionRowBuilder().addComponents(disabledSelectMenu);
    container.addActionRowComponents(disabledSelectRow); // Add disabled select menu row

    container.addActionRowComponents(actionRow); // Add the button row


    const payload = {
        components: [container], // Send the updated container
        flags: MessageFlags.IsComponentsV2,
    };

    try {
        await interaction.editReply(payload);
    } catch (error) {
        console.error('Error updating anal button countdown:', error);
    }
};


module.exports = {
    // Slash Command Definition
    data: new SlashCommandBuilder()
        .setName('anal')
        .setDescription('Explores different kinds of entry - Anime or Real.'), // Updated description.

    // Slash Command Execution (shows the selection menu first)
    async slashExecute(interaction) {
        // No cooldown check here, cooldown applies after category selection and image fetch
        await interaction.reply(createSelectionPayload());
    },

    // Prefix Command Execution (shows the selection menu first)
    async prefixExecute(message, args) {
         // No cooldown check here
        await message.channel.send(createSelectionPayload());
    },

    // Component Handling (Handles both select menu and button clicks)
    async handleComponent(interaction, componentArgs) {
         // componentArgs will be like ['select', 'category'] or ['button', 'reload', 'anime'] / ['button', 'reload', 'real']
        const componentType = componentArgs[0]; // 'select' or 'button'
        const action = componentArgs[1]; // 'category' or 'reload'
        const type = componentArgs[2]; // 'anime' or 'real' (only for reload button)

        if (interaction.isStringSelectMenu() && action === 'category') {
             const selectedType = interaction.values[0]; // 'anime' or 'real'

             // Defer the update to the select menu interaction
             await interaction.deferUpdate();

             // Now, check cooldown based on the *selected category*
             const commandKey = `anal_${selectedType}`;
             const cooldownCheck = checkCooldown(interaction.user.id, commandKey);

             if (cooldownCheck.onCooldown) {
                  // Reply ephemerally with cooldown message
                 return await interaction.followUp({
                     embeds: [createCooldownEmbed(cooldownCheck.remaining)],
                     ephemeral: true
                 });
             }

            // Fetch and display the image for the selected category
            try {
                const payload = await generateAnalPayload(selectedType);

                // Set cooldown after successful fetch
                setCooldown(interaction.user.id, commandKey);

                // Edit the original message to show the image and reload button
                await interaction.editReply(payload);

            } catch (error) {
                console.error(`Error handling anal select menu (${selectedType}):`, error);
                 // Reply ephemerally with error message
                await interaction.followUp({ content: 'Failed to fetch the image for the selected category!', ephemeral: true });

                // Re-send the selection menu payload so user can try again or select different category
                 try {
                    await interaction.editReply(createSelectionPayload());
                 } catch (editError) {
                     console.error('Failed to revert to selection menu after error:', editError);
                     // If even sending the selection menu fails, just reply ephemerally
                     await interaction.followUp({ content: 'An error occurred and I could not refresh the selection menu.', ephemeral: true });
                 }
            }

        } else if (interaction.isButton() && action === 'reload' && (type === 'anime' || type === 'real')) {
             // Handle the reload button click for a specific type
             const commandKey = `anal_${type}`;
             const cooldownCheck = checkCooldown(interaction.user.id, commandKey);

             if (cooldownCheck.onCooldown) {
                  // Reply ephemerally with cooldown message
                  return await interaction.followUp({
                      embeds: [createCooldownEmbed(cooldownCheck.remaining)],
                      ephemeral: true
                  });
              }

            // Handle the reload button click
            try {
                // Defer the button interaction update.
                await interaction.deferUpdate();

                // Get cached URL for the *current* type to reuse during countdown
                const cache = loadCache();
                const cachedUrl = type === 'anime' ? cache.lastAnalAnimeUrl : cache.lastAnalRealUrl;


                // Set cooldown immediately for the specific type
                setCooldown(interaction.user.id, commandKey);

                // Start countdown without fetching new image, using the cached URL and type
                if (cachedUrl) {
                    for (let i = 2; i > 0; i--) { // Cooldown is 2 seconds
                        await updateButtonCountdown(interaction, i, type, cachedUrl);
                        if (i > 1) await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                } else {
                    // If no cached URL for countdown, maybe show a generic loading state?
                    // For now, just proceed to fetch after the delay
                    console.warn(`No cached URL for anal (${type}) countdown. Waiting before fetching.`);
                     await new Promise(resolve => setTimeout(resolve, 2000)); // Wait full cooldown duration
                }


                // Generate a new payload with a fresh image after cooldown
                try {
                    const newPayload = await generateAnalPayload(type); // Fetch new image of the SAME type
                    await interaction.editReply(newPayload); // Edit the original message

                } catch (payloadError) {
                    console.error(`Failed to generate new anal (${type}) payload after reload cooldown:`, payloadError);
                    // If we can't get a new image, try to restore the message with the last cached image and working button
                    if (cachedUrl) {
                         console.log('Restoring message with last cached URL and enabled button.');
                        const fallbackPayload = await generateAnalPayload(type, cachedUrl); // Regenerate payload using old URL
                        // Need to re-enable button manually if generatePayload didn't
                        fallbackPayload.components[0].components.forEach(comp => {
                            if (comp.type === 1) { // Action Row
                                comp.components.forEach(innerComp => {
                                    if (innerComp.type === 2 && innerComp.custom_id === `anal_button_reload_${type}`) { // Button
                                        innerComp.disabled = false;
                                        innerComp.style = ButtonStyle.Success; // Green button
                                        innerComp.label = '🔃 Reload'; // Remove countdown label
                                    } else if (innerComp.type === 8) { // Select Menu
                                         innerComp.disabled = true; // Ensure select is still disabled
                                    }
                                });
                            }
                        });
                        await interaction.editReply(fallbackPayload);

                    } else {
                        console.error('No cached URL available for fallback after reload failure.');
                         // Inform the user ephemerally as we can't edit the main message robustly
                         await interaction.followUp({ content: `Failed to reload the anal (${type}) image and no cached fallback is available.`, ephemeral: true });
                         // Attempt to restore the original selection menu state if all else fails?
                         try {
                            await interaction.editReply(createSelectionPayload());
                         } catch (editError) {
                             console.error('Failed to revert to selection menu after critical reload error:', editError);
                              await interaction.followUp({ content: 'A critical error occurred and I could not restore the message state.', ephemeral: true });
                         }
                    }
                }

            } catch (error) {
                console.error(`Error handling anal (${type}) reload button:`, error);
                // Inform the user about the error, maybe ephemerally.
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: `Failed to reload the anal (${type}) image!`, ephemeral: true });
                } else {
                    await interaction.followUp({ content: `Failed to reload the anal (${type}) image!`, ephemeral: true });
                }
                // If the initial deferUpdate failed or subsequent edit failed completely, maybe try to show the selection menu again?
                try {
                     // Attempt to restore the original selection menu state
                     await interaction.editReply(createSelectionPayload());
                 } catch (editError) {
                     console.error('Failed to revert to selection menu after reload button error:', editError);
                     // Give up and just send an ephemeral error if edit fails
                     await interaction.followUp({ content: 'An error occurred and I could not restore the message state.', ephemeral: true });
                 }
            }
        }
        // Add more component handling logic here if the command gains more interactive components.
    },
};