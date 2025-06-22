// commands/pussy.js

const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MediaGalleryBuilder, TextDisplayBuilder, MessageFlags, ContainerBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');
const { NSFW } = require('nsfwhub'); // Import the NSFW library

const nsfw = new NSFW(); // Create an instance.

// --- Utility Functions for Payloads ---

// Payload for NSFW channel restriction
const createNsfwOnlyPayload = () => {
    const container = new ContainerBuilder()
        .setAccentColor(0xFFCC00) // Warning yellow
        .addTextDisplayComponents(
            textDisplay => textDisplay.setContent('### 🔞 NSFW Channel Required'),
            textDisplay => textDisplay.setContent('This command can only be used in channels marked as NSFW. Please ensure you are in an appropriate channel.')
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    return { components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true };
};

// Payload for cooldown message
const createCooldownPayload = (timeLeft) => {
    const container = new ContainerBuilder()
        .setAccentColor(0xFF6B6B) // Soft red
        .addTextDisplayComponents(
            textDisplay => textDisplay.setContent('### ⏰ Patience, Lovely Viewer'),
            textDisplay => textDisplay.setContent(`You must wait **${timeLeft.toFixed(1)}s** before requesting another delightful view. Beauty is worth the wait.`)
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    return { components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true };
};

// Payload for API error
const createApiErrorPayload = (category) => {
    const container = new ContainerBuilder()
        .setAccentColor(0xFF0000) // Error red
        .addTextDisplayComponents(
            textDisplay => textDisplay.setContent('### 📛 API Error'),
            textDisplay => textDisplay.setContent(`Failed to fetch an image for the **${category}** category. The API might be temporarily unavailable or shy. Please try again later. The NSFWHub API we use to fetch images is very strictly rate-limited, so the most likely reason for the error is due to this limitation.`)
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    return { components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true }; // Ephemeral for general errors
};


// Advanced Preloading Cache System
class ImagePreloader {
    constructor(category) {
        this.category = category;
        this.cache = [];
        this.isPreloading = false;
        this.targetCacheSize = 2; // Preload 2 images
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
                this.cache.push({ url: data.image.url, timestamp: Date.now() });
            }
        } catch (error) {
            console.error(`Cache fetch failed for ${this.category}:`, error);
            // Do not let a single failed fetch stop preloading entirely for other attempts
        }
    }

    async getImage() {
        if (this.cache.length === 0) {
            try {
                const data = await nsfw.fetch(this.category);
                 if (!data || !data.image || !data.image.url) {
                    console.error(`API returned invalid data for ${this.category}:`, data);
                    throw new Error('Invalid API response');
                }
                this.triggerBackgroundPreload();
                return data.image.url;
            } catch (error) {
                console.error(`Direct fetch failed for ${this.category}:`, error);
                throw error; // Re-throw to be handled by the caller
            }
        }
        const cachedImage = this.cache.shift();
        this.triggerBackgroundPreload();
        return cachedImage.url;
    }

    triggerBackgroundPreload() {
        if (this.isPreloading) return;
        setImmediate(async () => {
            this.isPreloading = true; // Set flag before starting async operations
            try {
                while (this.cache.length < this.targetCacheSize) {
                    await this.fetchAndCache();
                    await new Promise(resolve => setTimeout(resolve, 200)); // Small delay
                }
            } catch (error) {
                console.error(`Background preload error for ${this.category}:`, error);
            } finally {
                this.isPreloading = false; // Clear flag after operations
            }
        });
    }
}

const imagePreloader = new ImagePreloader("pussy");
const cooldowns = new Map(); // UserID -> timestamp

// Main function to generate the image payload
const generatePussyPayload = async (interactionOrMessage) => {
    try {
        const imageUrl = await imagePreloader.getImage();

        const container = new ContainerBuilder()
            .setAccentColor(0xFF007F) // Pussy pink
            .addTextDisplayComponents(
                textDisplay => textDisplay.setContent('### Behold! A Gift of Pussy! 😽')
            )
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
            .addMediaGalleryComponents(
                mediaGallery => mediaGallery.addItems(
                    item => item.setURL(imageUrl).setDescription('A delightful pussy view.')
                )
            );

        const reloadButton = new ButtonBuilder()
            .setCustomId('pussy_button_reload')
            .setLabel('🔃 More Pussy!')
            .setStyle(ButtonStyle.Success);

        const actionRow = new ActionRowBuilder().addComponents(reloadButton);
        container.addActionRowComponents(actionRow);

        return { components: [container], flags: MessageFlags.IsComponentsV2 };
    } catch (error) {
        console.error('Error fetching pussy image:', error);
        // If interactionOrMessage is provided, use it to send an ephemeral error, otherwise return error payload
        const errorPayload = createApiErrorPayload("pussy");
        if (interactionOrMessage && interactionOrMessage.replied !== true && interactionOrMessage.deferred !== true) {
            await interactionOrMessage.reply(errorPayload).catch(e => console.error("Error sending API error reply:", e));
        } else if (interactionOrMessage) {
            await interactionOrMessage.followUp(errorPayload).catch(e => console.error("Error sending API error followUp:", e));
        }
        return errorPayload; // Return it for cases where we can't send directly
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pussy')
        .setDescription('Delivers a delightful pussy image. 😽'),

    async slashExecute(interaction) {
        if (!interaction.channel || !interaction.channel.nsfw) {
            return interaction.reply(createNsfwOnlyPayload());
        }

        const userId = interaction.user.id;
        const now = Date.now();
        const cooldownAmount = 3000; // 3 seconds

        if (cooldowns.has(userId)) {
            const expirationTime = cooldowns.get(userId) + cooldownAmount;
            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                return interaction.reply(createCooldownPayload(timeLeft));
            }
        }
        cooldowns.set(userId, now);
        setTimeout(() => cooldowns.delete(userId), cooldownAmount);

        await interaction.deferReply({ ephemeral: false });
        const payload = await generatePussyPayload(interaction); // Pass interaction for error handling
        await interaction.editReply(payload);
    },

    async prefixExecute(message, args) {
        if (!message.channel || !message.channel.nsfw) {
            return message.reply(createNsfwOnlyPayload());
        }

        const userId = message.author.id;
        const now = Date.now();
        const cooldownAmount = 3000; // 3 seconds

        if (cooldowns.has(userId)) {
            const expirationTime = cooldowns.get(userId) + cooldownAmount;
            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                // For prefix commands, message.reply sends a new message.
                // We want the cooldown message to be ephemeral-like if possible,
                // but prefix commands don't have true ephemeral. We just send it.
                const cooldownPayload = createCooldownPayload(timeLeft);
                cooldownPayload.ephemeral = false; // Not possible with message.reply
                return message.reply(cooldownPayload);
            }
        }
        cooldowns.set(userId, now);
        setTimeout(() => cooldowns.delete(userId), cooldownAmount);

        const payload = await generatePussyPayload(message); // Pass message for error handling
        await message.channel.send(payload);
    },

    async handleComponent(interaction, componentArgs) {
        // NSFW check for component interactions is implicitly handled if the original message was in an NSFW channel.
        // However, if the bot restarts and the message persists, or if permissions change, an explicit check is safer.
        if (!interaction.channel || !interaction.channel.nsfw) {
             // Try to update the interaction with the NSFW message, or follow up if needed.
            if (!interaction.replied && !interaction.deferred) {
                return interaction.reply(createNsfwOnlyPayload());
            } else {
                // If we can't reply directly, we can't really stop the component interaction gracefully with a visible message
                // without potentially cluttering. DeferUpdate and doing nothing might be an option, or a silent log.
                // For now, let's try to inform the user if possible.
                return interaction.followUp(createNsfwOnlyPayload()).catch(e => console.error("Component NSFW check followUp error:", e));
            }
        }

        const componentType = componentArgs[0]; // e.g., 'button'
        const action = componentArgs[1];      // e.g., 'reload'

        if (componentType === 'button' && action === 'reload') {
            const userId = interaction.user.id;
            const now = Date.now();
            const cooldownAmount = 2000; // Shorter cooldown for reload

            if (cooldowns.has(userId)) {
                const expirationTime = cooldowns.get(userId) + cooldownAmount;
                if (now < expirationTime) {
                    const timeLeft = (expirationTime - now) / 1000;
                    // For component interactions, reply is usually ephemeral for things like cooldowns.
                    return interaction.reply(createCooldownPayload(timeLeft));
                }
            }
            cooldowns.set(userId, now);
            setTimeout(() => cooldowns.delete(userId), cooldownAmount);

            try {await interaction.deferUpdate();
                const newPayload = await generatePussyPayload(interaction);
                // Check if generatePussyPayload returned an error payload
                if (newPayload.components && newPayload.components[0] && newPayload.components[0].data && newPayload.components[0].data.content_blocks && newPayload.components[0].data.content_blocks.some(cb => cb.content === '### 📛 API Error')) {
                    // If it's an API error, send it as a followUp, don't edit the original message
                    await interaction.followUp(newPayload).catch(e => console.error("Error sending API error followUp after button:", e));
                } else {
                    // Otherwise, edit the reply with the new content
                    await interaction.editReply(newPayload);

            }
            }  catch (error) {console.error('Error handling pussy reload button:', error);
                // General error handling for other issues, send ephemeral error
                const errorPayload = createApiErrorPayload("pussy"); // Use the updated error payload function
                 if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorPayload).catch(e => console.error("Component error followUp:", e));
                } else {
                    await interaction.reply(errorPayload).catch(e => console.error("Component error reply:", e));
                }
            }
        }
    },
};