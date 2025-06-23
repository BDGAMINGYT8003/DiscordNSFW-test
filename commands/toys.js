// commands/toys.js

const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { NSFW } = require('nsfwhub'); // Import the NSFW library

const nsfw = new NSFW(); // Create an instance.
const CATEGORY = "toys"; // Define category for easy reuse

// --- Utility Functions for Payloads (Using EmbedBuilder) ---

// Payload for NSFW channel restriction
const createNsfwOnlyEmbed = () => { // Renamed and uses EmbedBuilder
    return new EmbedBuilder()
        .setColor(0xFFCC00) // Warning yellow
        .setTitle('🔞 NSFW Channel Required')
        .setDescription('This command can only be used in channels marked as NSFW. Please ensure you are in an appropriate channel.')
        .setTimestamp();
};

// Payload for cooldown message
const createCooldownEmbed = (timeLeft) => { // Renamed and uses EmbedBuilder
    return new EmbedBuilder()
        .setColor(0xFF6B6B) // Soft red
        .setTitle('⏰ Playtime Paused!')
        .setDescription(`You must wait **${timeLeft.toFixed(1)}s** before grabbing another toy. Even playtime has its limits!`)
        .setTimestamp();
};

// Payload for API error
const createApiErrorEmbed = (category) => { // Renamed and uses EmbedBuilder
    return new EmbedBuilder()
        .setColor(0xFF0000) // Error red
        .setTitle('📛 API Error')
        .setDescription(`Failed to fetch an image for the **${category}** category. The NSFWHub API we use is very strictly rate-limited, so this is the most likely reason for the error. Please try again later.`)
        .setTimestamp();
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

const imagePreloader = new ImagePreloader("toys");
const cooldowns = new Map(); // UserID -> timestamp

// Main function to generate the image payload
const generateToysPayload = async (interactionOrMessage) => {
    try {
        const imageUrl = await imagePreloader.getImage();

        const container = new ContainerBuilder()
            .setAccentColor(0xEE82EE) // Violet for toys
            .addTextDisplayComponents(
                textDisplay => textDisplay.setContent('### Time to Play! 🧸🍆')
            )
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
            .addMediaGalleryComponents(
                mediaGallery => mediaGallery.addItems(
                    item => item.setURL(imageUrl).setDescription('Fun with toys!')
                )
            );

        const reloadButton = new ButtonBuilder()
            .setCustomId('toys_button_reload')
            .setLabel('🧸 More Toys!')
            .setStyle(ButtonStyle.Primary);

        const actionRow = new ActionRowBuilder().addComponents(reloadButton);
        container.addActionRowComponents(actionRow);

        return { components: [container], flags: MessageFlags.IsComponentsV2 };
    } catch (error) {
        console.error('Error fetching toys image:', error);
        const errorPayload = createApiErrorPayload("toys");
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
        .setName('toys')
        .setDescription('Delivers images of fun with toys. 🧸🍆'),

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
        const payload = await generateToysPayload(interaction);
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

        const payload = await generateToysPayload(message);
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
            const cooldownAmount = 2000; // Shorter cooldown for reload

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
                const newPayload = await generateToysPayload(interaction);
                await interaction.editReply(newPayload);
            } catch (error) {
                console.error('Error handling toys reload button:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.followUp({ components: [new ContainerBuilder().setAccentColor(0xFF0000).addTextDisplayComponents(td => td.setContent('Failed to reload image.'))], flags: MessageFlags.IsComponentsV2, ephemeral: true }).catch(e => console.error("Component error followUp:", e));
                }
            }
        }
    },
};
