// commands/pussy.js

const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MediaGalleryBuilder, TextDisplayBuilder, MessageFlags, ContainerBuilder, SeparatorSpacingSize, ComponentType, ChannelType } = require('discord.js');
const { NSFW } = require('nsfwhub'); // Import the NSFW library.

const nsfw = new NSFW(); // Create an instance.

// Command Cooldowns Map: Keyed by userId
const commandCooldowns = new Map();
const COOLDOWN_SECONDS = 2; // 2 seconds cooldown

// Button Cooldown State: We don't need a map here, we'll rely on the button's disabled state and the countdown loop itself.

// Advanced Preloading Cache System
class ImagePreloader {
    constructor(category) {
        this.category = category;
        this.cache = [];
        this.isPreloading = false;
        this.targetCacheSize = 3; // Let's keep a slightly larger cache
        this.preloadOnInit();
    }

    async preloadOnInit() {
        if (this.isPreloading) return;
        this.isPreloading = true;

        try {
            // Fetch one by one initially to avoid hitting potential rate limits too hard on startup
            for(let i = 0; i < this.targetCacheSize; i++) {
                 await this.fetchAndCache();
                 await new Promise(resolve => setTimeout(resolve, 50)); // Small delay between initial fetches
            }
        } catch (error) {
            console.error(`Initial preload failed for ${this.category}:`, error);
        }

        this.isPreloading = false;
    }

    async fetchAndCache() {
        if (this.cache.length >= this.targetCacheSize) return; // Don't exceed target size
        try {
            const data = await nsfw.fetch(this.category);
            if (data && data.image && data.image.url) {
                this.cache.push({
                    url: data.image.url,
                    timestamp: Date.now()
                });
            } else {
                 console.warn(`Fetched no image data for ${this.category}`);
            }
        } catch (error) {
            console.error(`Cache fetch failed for ${this.category}:`, error.message);
        }
    }

    async getImage() {
        // If cache is empty or low, fetch immediately blocking
        if (this.cache.length < 1) {
            console.warn(`Cache empty or low for ${this.category}, fetching blocking.`);
            try {
                const data = await nsfw.fetch(this.category);
                 if (data && data.image && data.image.url) {
                    this.triggerBackgroundPreload(); // Start preloading for next time
                    return data.image.url;
                 } else {
                      console.error(`Blocking fetch failed for ${this.category}: No image data`);
                      throw new Error(`No image data found for ${this.category}`);
                 }
            } catch (error) {
                 console.error(`Blocking fetch failed for ${this.category}:`, error.message);
                throw error;
            }
        }

        // Get cached image
        const cachedImage = this.cache.shift();

        // Immediately trigger background preload to maintain cache size
        this.triggerBackgroundPreload();

        return cachedImage.url;
    }

    triggerBackgroundPreload() {
        if (this.isPreloading || this.cache.length >= this.targetCacheSize) return;
        this.isPreloading = true;

        // Preload in background without blocking
        setImmediate(async () => {
            while (this.cache.length < this.targetCacheSize) {
                console.log(`Preloading image for ${this.category}... Cache size: ${this.cache.length}`);
                await this.fetchAndCache();

                // Small delay to prevent API spam if fetching happens too fast
                if (this.cache.length < this.targetCacheSize) {
                     await new Promise(resolve => setTimeout(resolve, 200));
                }
            }
             console.log(`Preloading finished for ${this.category}. Cache size: ${this.cache.length}`);
            this.isPreloading = false;
        });
    }
}

// Initialize preloader for this category
const pussyImagePreloader = new ImagePreloader("pussy");

// Shared function to generate the response payload using Components V2
// This function now ONLY structures the payload, it does NOT fetch the image.
// The image URL and button state/label/style are passed in.
const generatePussyPayload = (imageUrl, buttonDisabled = false, buttonLabel = '🔃 Reload', buttonStyle = ButtonStyle.Primary) => {
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
                .setSpacing(SeparatorSpacingSize.Large) // Large spacing
        )
        .addMediaGalleryComponents( // The main attraction!
            mediaGallery => mediaGallery
                .addItems( // Add the image/media from the fetched URL
                    mediaGalleryItem => mediaGalleryItem
                        // Assuming nsfwhub provides a direct link that discord can handle
                        .setURL(imageUrl) // Use provided imageUrl
                        .setDescription('A delightful view.') // Alt text for accessibility, always good.
                )
        );

    const reloadButton = new ButtonBuilder()
        .setCustomId('pussy_button_reload') // Unique ID for handling this button
        .setLabel(buttonLabel) // Use provided label
        .setStyle(buttonStyle) // Use provided style
        .setDisabled(buttonDisabled); // Use provided disabled state

    const actionRow = new ActionRowBuilder().addComponents(reloadButton);
    container.addActionRowComponents(actionRow); // Add the action row to the container.

    const payload = {
        components: [container], // Send the container with its contents
        flags: MessageFlags.IsComponentsV2, // MANDATORY for CV2 components
        // Note: content and embeds fields are DISABLED when IsComponentsV2 is set.
        // All visual content must be within CV2 components.
    };

    return payload;
};

// Helper to find and update the button in a component structure
const findAndUpdateButton = (components, customId, updates) => {
    const container = components.find(c => c.type === ComponentType.Container);
    if (!container) return false;
    const actionRow = container.components.find(c => c.type === ComponentType.ActionRow);
    if (!actionRow) return false;
    const button = actionRow.components.find(b => b.customId === customId);
    if (button) {
        Object.assign(button, updates);
        return true; // Button found and updated
    }
    return false; // Button not found
};

// Helper to extract image URL from a component structure
const extractImageUrl = (components) => {
     const container = components.find(c => c.type === ComponentType.Container);
     if (!container) return null;
     const mediaGallery = container.components.find(c => c.type === ComponentType.MediaGallery);
     if (!mediaGallery || !mediaGallery.items || mediaGallery.items.length === 0) return null;
     return mediaGallery.items[0].url;
};


module.exports = {
    // Slash Command Definition
    data: new SlashCommandBuilder()
        .setName('pussy')
        .setDescription('Delivers a delightful image.'), // A simple, direct description.

    async slashExecute(interaction) {
        // Check command cooldown
        const userId = interaction.user.id; // Use user ID for cooldown
        const now = Date.now();
        const cooldownAmount = COOLDOWN_SECONDS * 1000;

        if (commandCooldowns.has(userId)) {
            const expirationTime = commandCooldowns.get(userId);
            const timeLeft = expirationTime - now;

            if (timeLeft > 0) {
                 // User is on cooldown
                 const cooldownMessageContainer = new ContainerBuilder()
                    .setAccentColor(0xFFFF00) // Yellow for caution
                    .addTextDisplayComponents(
                        textDisplay => textDisplay.setContent(`Not so fast, darling! This command is on cooldown for you. You can use it again in **${Math.ceil(timeLeft / 1000)}** seconds.`)
                    );
                const cooldownPayload = {
                    components: [cooldownMessageContainer],
                    flags: MessageFlags.IsComponentsV2,
                };
                await interaction.reply({ ...cooldownPayload, ephemeral: true }); // Ephemeral reply
                return; // Stop execution
            }
        }

        // Set cooldown BEFORE fetching or deferring to prevent double execution
        commandCooldowns.set(userId, now + cooldownAmount);
        setTimeout(() => {
            commandCooldowns.delete(userId);
            console.log(`Cooldown lifted for user ${userId} on command pussy`);
        }, cooldownAmount);

        // Defer the reply AFTER cooldown check
        await interaction.deferReply({ ephemeral: false });

        try {
            const imageUrl = await pussyImagePreloader.getImage(); // Get image AFTER cooldown check
            const payload = generatePussyPayload(imageUrl); // Generate payload with fetched image
            await interaction.editReply(payload);
        } catch (error) {
             console.error('Error executing pussy slash command:', error);
             const errorContainer = new ContainerBuilder()
                .setAccentColor(0xFF0000)
                .addTextDisplayComponents(
                    textDisplay => textDisplay.setContent('### Error')
                )
                 .addSeparatorComponents(
                    separator => separator.setSpacing(SeparatorSpacingSize.Large)
                )
                .addTextDisplayComponents(
                    textDisplay => textDisplay.setContent('There was an error trying to fetch the image. The API might be shy right now.')
                );

             const errorPayload = {
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2,
             };
            await interaction.editReply(errorPayload); // Edit deferred reply with error
        }
    },

    async prefixExecute(message, args) {
        // Check command cooldown
        const userId = message.author.id;
        const now = Date.now();
        const cooldownAmount = COOLDOWN_SECONDS * 1000;

        if (commandCooldowns.has(userId)) {
            const expirationTime = commandCooldowns.get(userId);
            const timeLeft = expirationTime - now;

            if (timeLeft > 0) {
                // User is on cooldown
                 const cooldownMessageContainer = new ContainerBuilder()
                    .setAccentColor(0xFFFF00)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay.setContent(`Hold on, sweetie! That command isn't ready yet. Try again in **${Math.ceil(timeLeft / 1000)}** seconds.`)
                    );
                const cooldownPayload = {
                    components: [cooldownMessageContainer],
                    flags: MessageFlags.IsComponentsV2,
                };
                // Send ephemeral message if possible (only in guild text channels)
                if (message.channel.type === ChannelType.GuildText) {
                     await message.reply({ ...cooldownPayload, ephemeral: true });
                } else {
                     // Can't send ephemeral in DMs, send non-ephemeral or just ignore the reply entirely
                     // Let's send a non-ephemeral text message as a fallback
                     await message.reply({ content: `Hold on, sweetie! That command isn't ready yet. Try again in **${Math.ceil(timeLeft / 1000)}** seconds.`, ephemeral: false });
                }
                return; // Stop execution
            }
        }

        // Set cooldown BEFORE fetching or sending
        commandCooldowns.set(userId, now + cooldownAmount);
         setTimeout(() => {
            commandCooldowns.delete(userId);
             console.log(`Cooldown lifted for user ${userId} on command pussy`);
        }, cooldownAmount);

        try {
            const imageUrl = await pussyImagePreloader.getImage(); // Get image AFTER cooldown check
            const payload = generatePussyPayload(imageUrl); // Generate payload
            await message.channel.send(payload); // Send message
        } catch (error) {
             console.error('Error executing pussy prefix command:', error);
              const errorContainer = new ContainerBuilder()
                .setAccentColor(0xFF0000)
                .addTextDisplayComponents(
                    textDisplay => textDisplay.setContent('### Error')
                )
                 .addSeparatorComponents(
                    separator => separator.setSpacing(SeparatorSpacingSize.Large)
                )
                .addTextDisplayComponents(
                    textDisplay => textDisplay.setContent('There was an error trying to fetch the image.')
                );

             const errorPayload = {
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2,
             };
            await message.channel.send(errorPayload);
        }
    },

    async handleComponent(interaction) { // No need for componentArgs here if only one button type
        const customId = interaction.customId;

        if (customId === 'pussy_button_reload') {
            // Check if the button is already disabled (cooldown active for THIS message)
            if (interaction.component.disabled) {
                 const cooldownMessageContainer = new ContainerBuilder()
                    .setAccentColor(0xFFFF00) // Yellow for caution
                    .addTextDisplayComponents(
                        textDisplay => textDisplay.setContent('Easy there, tiger! That button is still cooling down.')
                    );
                const cooldownPayload = {
                    components: [cooldownMessageContainer],
                    flags: MessageFlags.IsComponentsV2,
                };
                await interaction.reply({ ...cooldownPayload, ephemeral: true });
                return; // Stop execution
            }

            // Defer the interaction update immediately
            await interaction.deferUpdate();

            const originalMessage = interaction.message;

            try {
                 // Get the current components and image URL to reuse during countdown
                 const initialComponents = originalMessage.components; // Keep reference to original structure
                 const currentImageUrl = extractImageUrl(initialComponents);

                 if (!currentImageUrl) {
                      throw new Error('Could not extract current image URL from message components.');
                 }

                // Start the countdown visuals by editing the button
                for (let i = COOLDOWN_SECONDS; i > 0; i--) {
                    // Clone components for safe modification
                    const updatedComponents = JSON.parse(JSON.stringify(initialComponents));
                     // Find and update the button state and label
                     const buttonFound = findAndUpdateButton(updatedComponents, 'pussy_button_reload', {
                         disabled: true,
                         label: `🔃 Reload (${i}s)`,
                         style: ButtonStyle.Secondary // Gray while counting down
                     });

                     if (!buttonFound) {
                         console.error('Reload button not found in components during countdown edit.');
                         // Attempt to proceed or throw? Let's throw to indicate a structural issue.
                         throw new Error('Reload button structure invalid.');
                     }

                    await originalMessage.edit({ components: updatedComponents });
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                }

                // Countdown finished. Button is still disabled and gray.
                // Now fetch the *new* image.
                const newImageUrl = await pussyImagePreloader.getImage();

                // Generate the final payload with the new image and re-enabled button
                const finalPayload = generatePussyPayload(newImageUrl, false, '🔃 Reload', ButtonStyle.Primary); // Re-enable, default label/style

                // Edit the original message with the new image and enabled button
                 await originalMessage.edit(finalPayload); // Use originalMessage.edit after deferUpdate

            } catch (error) {
                console.error('Error handling pussy reload button:', error);
                // Inform the user about the error *in the same message*
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(0xFF0000)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay.setContent('### Error')
                    )
                     .addSeparatorComponents(
                        separator => separator.setSpacing(SeparatorSpacingSize.Large)
                    )
                    .addTextDisplayComponents(
                        textDisplay => textDisplay.setContent('Failed to reload the image.')
                    );

                 // Get the *original* components structure to preserve the button location
                 // Use interaction.message.components again in case the originalMessage variable was somehow stale (unlikely after deferUpdate but safer)
                 const componentsOnError = interaction.message.components;
                 const updatedComponentsOnError = JSON.parse(JSON.stringify(componentsOnError)); // Clone

                 // Find the button and re-enable it, change style/label for error state
                 const buttonFound = findAndUpdateButton(updatedComponentsOnError, 'pussy_button_reload', {
                     disabled: false, // Try to make it clickable again
                     label: '🔃 Reload (Error)',
                     style: ButtonStyle.Danger // Red for error
                 });

                 // Reconstruct the *entire* message components array: Error container + Original container (with potentially fixed button)
                 // Filter out any existing error containers first to prevent stacking
                 const originalContentComponents = updatedComponentsOnError.filter(c =>
                      !(c.type === ComponentType.Container && c.components.some(sub => sub.type === ComponentType.TextDisplay && sub.content.includes('### Error')))
                 );
                 const finalErrorComponents = [errorContainer, ...originalContentComponents];


                await originalMessage.edit({ components: finalErrorComponents }).catch(editError => {
                    console.error('Failed final error edit on pussy reload:', editError);
                     // Fallback: send a new ephemeral error message if editing fails
                    interaction.followUp({ content: 'An error occurred, and I couldn\'t update the message properly.', ephemeral: true }).catch(followupError => console.error('Failed fallback followup:', followupError));
                });
            }
        }
    },
};