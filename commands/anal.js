// commands/anal.js

const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MediaGalleryBuilder, TextDisplayBuilder, MessageFlags, ContainerBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');
const { NSFW } = require('nsfwhub'); // Import the NSFW library

const nsfw = new NSFW(); // Create an instance.

// --- Utility Functions for Payloads (Copied from pussy.js, ensure these are consistent or refactored if used across many files) ---
const createNsfwOnlyPayload = () => {
    const container = new ContainerBuilder()
        .setAccentColor(0xFFCC00)
        .addTextDisplayComponents(
            textDisplay => textDisplay.setContent('### 🔞 NSFW Channel Required'),
            textDisplay => textDisplay.setContent('This command can only be used in channels marked as NSFW. Please ensure you are in an appropriate channel.')
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    return { components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true };
};

const createCooldownPayload = (timeLeft) => {
    const container = new ContainerBuilder()
        .setAccentColor(0xFF6B6B)
        .addTextDisplayComponents(
            textDisplay => textDisplay.setContent('### ⏰ Patience, Dear Explorer'),
            textDisplay => textDisplay.setContent(`You must wait **${timeLeft.toFixed(1)}s** before venturing down this path again. Good things come to those who wait.`)
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    return { components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true };
};

const createApiErrorPayload = (category) => {
    const container = new ContainerBuilder()
        .setAccentColor(0xFF0000)
        .addTextDisplayComponents(
            textDisplay => textDisplay.setContent('### 📛 API Error'),
            textDisplay => textDisplay.setContent(`Failed to fetch an image for the **${category}** category. This particular tunnel seems blocked right now. Please try again later. The NSFWHub API we use to fetch images is very strictly rate-limited, so the most likely reason for the error is due to this limitation.`)
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    return { components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true };
};
// --- End Utility Functions ---


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
                this.cache.push({ url: data.image.url, timestamp: Date.now() });
            }
        } catch (error) {
            console.error(`Cache fetch failed for ${this.category}:`, error);
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
                throw error;
            }
        }
        const cachedImage = this.cache.shift();
        this.triggerBackgroundPreload();
        return cachedImage.url;
    }

    triggerBackgroundPreload() {
        if (this.isPreloading) return;
        setImmediate(async () => {
            this.isPreloading = true;
            try {
                while (this.cache.length < this.targetCacheSize) {
                    await this.fetchAndCache();
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            } catch (error) {
                console.error(`Background preload error for ${this.category}:`, error);
            } finally {
                this.isPreloading = false;
            }
        });
    }
}

const imagePreloader = new ImagePreloader("anal");
const cooldowns = new Map();

// Main function to generate the image payload
const generateAnalPayload = async (interactionOrMessage) => {
    try {
        const imageUrl = await imagePreloader.getImage();

        const container = new ContainerBuilder()
            .setAccentColor(0x6A4595) // A deep purple for anal
            .addTextDisplayComponents(
                textDisplay => textDisplay.setContent('### Behold! A Journey to the Rear... 🍑')
            )
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
            .addMediaGalleryComponents(
                mediaGallery => mediaGallery.addItems(
                    item => item.setURL(imageUrl).setDescription('A path well-trodden.')
                )
            );

        const reloadButton = new ButtonBuilder()
            .setCustomId('anal_button_reload')
            .setLabel('🔃 Explore Deeper!')
            .setStyle(ButtonStyle.Danger); // Danger for the daring!

        const actionRow = new ActionRowBuilder().addComponents(reloadButton);
        container.addActionRowComponents(actionRow);

        return { components: [container], flags: MessageFlags.IsComponentsV2 };
    } catch (error) {
        console.error('Error fetching anal image:', error);
        const errorPayload = createApiErrorPayload("anal");
        if (interactionOrMessage && interactionOrMessage.replied !== true && interactionOrMessage.deferred !== true) {
            await interactionOrMessage.reply(errorPayload).catch(e => console.error("Error sending API error reply:", e));
        } else if (interactionOrMessage) {
            await interactionOrMessage.followUp(errorPayload).catch(e => console.error("Error sending API error followUp:", e));
        }
        return errorPayload;
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('anal')
        .setDescription('Explores a different kind of entry. 🍑'),

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
        const payload = await generateAnalPayload(interaction);
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
                const cooldownPayload = createCooldownPayload(timeLeft);
                cooldownPayload.ephemeral = false;
                return message.reply(cooldownPayload);
            }
        }
        cooldowns.set(userId, now);
        setTimeout(() => cooldowns.delete(userId), cooldownAmount);

        const payload = await generateAnalPayload(message);
        await message.channel.send(payload);
    },

    async handleComponent(interaction, componentArgs) {
        if (!interaction.channel || !interaction.channel.nsfw) {
            if (!interaction.replied && !interaction.deferred) {
                return interaction.reply(createNsfwOnlyPayload());
            } else {
                return interaction.followUp(createNsfwOnlyPayload()).catch(e => console.error("Component NSFW check followUp error:", e));
            }
        }

        const componentType = componentArgs[0];
        const action = componentArgs[1];

        if (componentType === 'button' && action === 'reload') {
            const userId = interaction.user.id;
            const now = Date.now();
            const cooldownAmount = 2000;

            if (cooldowns.has(userId)) {
                const expirationTime = cooldowns.get(userId) + cooldownAmount;
                if (now < expirationTime) {
                    const timeLeft = (expirationTime - now) / 1000;
                    return interaction.reply(createCooldownPayload(timeLeft));
                }
            }
            cooldowns.set(userId, now);
            setTimeout(() => cooldowns.delete(userId), cooldownAmount);

            try {
                await interaction.deferUpdate();
                const newPayload = await generateAnalPayload(interaction);
                // Check if generateAnalPayload returned an error payload
                if (newPayload.components && newPayload.components[0] && newPayload.components[0].data && newPayload.components[0].data.content_blocks && newPayload.components[0].data.content_blocks.some(cb => cb.content === '### 📛 API Error')) {
                    // If it's an API error, send it as a followUp, don't edit the original message
                    await interaction.followUp(newPayload).catch(e => console.error("Error sending API error followUp after button:", e));
                } else {
                    // Otherwise, edit the reply with the new content
                    await interaction.editReply(newPayload);
                }
            } catch (error) {
                console.error('Error handling anal reload button:', error);
                // General error handling for other issues, send ephemeral error
                const errorPayload = createApiErrorPayload("anal"); // Use the updated error payload function
                 if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorPayload).catch(e => console.error("Component error followUp:", e));
                } else {
                    await interaction.reply(errorPayload).catch(e => console.error("Component error reply:", e));
                }
            }
        }
    },
};