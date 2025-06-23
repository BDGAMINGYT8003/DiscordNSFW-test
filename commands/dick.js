// commands/dick.js

const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { NSFW } = require('nsfwhub'); // Import the NSFW library

const nsfw = new NSFW(); // Create an instance.
const CATEGORY = "dick"; // Define category for easy reuse

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
        .setTitle('⏰ Patience, Specimen Admirer')
        .setDescription(`You must wait **${timeLeft.toFixed(1)}s** before requesting another magnificent spécimen. Greatness takes time.`)
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
        this.category = category; // Should be CATEGORY constant
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
            // console.error(`Initial preload failed for ${this.category}:`, error.message);
        }
        this.isPreloading = false;
    }

    async fetchAndCache() {
        try {
            const data = await nsfw.fetch(this.category); // Uses this.category
            if (data && data.image && data.image.url) {
                this.cache.push({ url: data.image.url, timestamp: Date.now() });
            }
        } catch (error) {
            // console.error(`Cache fetch failed for ${this.category}:`, error.message);
        }
    }

    async getImage() {
        if (this.cache.length > 0) {
            const cachedImage = this.cache.shift();
            this.triggerBackgroundPreload();
            return cachedImage.url;
        }
        // Cache is empty, fetch directly
        try {
            const data = await nsfw.fetch(this.category); // Uses this.category
            if (!data || !data.image || !data.image.url) {
                throw new Error(`Invalid API response for ${this.category}.`);
            }
            this.triggerBackgroundPreload();
            return data.image.url;
        } catch (error) {
            // console.error(`Direct fetch failed for ${this.category}: ${error.message}`);
            throw error; // Re-throw for centralized handling
        }
    }

    triggerBackgroundPreload() {
        if (this.isPreloading || this.cache.length >= this.targetCacheSize) return;
        setImmediate(async () => {
            if (this.isPreloading) return;
            this.isPreloading = true;
            try {
                while (this.cache.length < this.targetCacheSize) {
                    await this.fetchAndCache();
                }
            } catch (error) {
                // console.error(`Background preload error for ${this.category}:`, error.message);
            } finally {
                this.isPreloading = false;
            }
        });
    }
}

const imagePreloader = new ImagePreloader(CATEGORY); // Use CATEGORY constant
const cooldowns = new Map(); // UserID -> timestamp

// Main function to generate the image payload (Embed + Components)
// This function will THROW an error if image fetching fails.
const generateImageEmbedAndComponents = async () => {
    const imageUrl = await imagePreloader.getImage(); // Can throw

    const embed = new EmbedBuilder()
        .setColor(0x006994) // A sturdy blue for dick
        .setTitle('Behold! A Magnificent Specimen! 🍆')
        .setImage(imageUrl)
        .setTimestamp()
        .setFooter({ text: `Category: ${CATEGORY}` });

    const reloadButton = new ButtonBuilder()
        .setCustomId(`${CATEGORY}_button_reload`) // e.g., dick_button_reload
        .setLabel('🍆 More Dicks!')
        .setStyle(ButtonStyle.Primary);

    const actionRow = new ActionRowBuilder().addComponents(reloadButton);

    return { embeds: [embed], components: [actionRow], ephemeral: false };
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName(CATEGORY)
        .setDescription('Delivers a delightful dick image. 🍆'),

    async slashExecute(interaction) {
        if (!interaction.channel || !interaction.channel.nsfw) {
            return interaction.reply({ embeds: [createNsfwOnlyEmbed()], ephemeral: true });
        }

        const userId = interaction.user.id;
        const now = Date.now();
        const cooldownAmount = 3000; // 3 seconds

        if (cooldowns.has(userId)) {
            const expirationTime = cooldowns.get(userId) + cooldownAmount;
            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                return interaction.reply({ embeds: [createCooldownEmbed(timeLeft)], ephemeral: true });
            }
        }
        cooldowns.set(userId, now);
        setTimeout(() => cooldowns.delete(userId), cooldownAmount);

        try {
            await interaction.deferReply({ ephemeral: false });
            const payload = await generateImageEmbedAndComponents();
            await interaction.editReply(payload);
        } catch (error) {
            console.error(`Error in ${CATEGORY} slashExecute (rethrowing for global handler): ${error.message}`);
            throw error; // Re-throw for global error handling in index.js
        }
    },

    async prefixExecute(message, args) {
        if (!message.channel || !message.channel.nsfw) {
            return message.reply({ embeds: [createNsfwOnlyEmbed()] }); // Not ephemeral
        }

        const userId = message.author.id;
        const now = Date.now();
        const cooldownAmount = 3000;

        if (cooldowns.has(userId)) {
            const expirationTime = cooldowns.get(userId) + cooldownAmount;
            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                return message.reply({ embeds: [createCooldownEmbed(timeLeft)] }); // Not ephemeral
            }
        }
        cooldowns.set(userId, now);
        setTimeout(() => cooldowns.delete(userId), cooldownAmount);

        try {
            const payload = await generateImageEmbedAndComponents();
            await message.channel.send(payload);
        } catch (error) {
            console.error(`Error in ${CATEGORY} prefixExecute (rethrowing for global handler): ${error.message}`);
            throw error; // Re-throw for global error handling in index.js
        }
    },

    async handleComponent(interaction, componentArgs) {
        // componentArgs: ['button', 'reload'] from customId like 'dick_button_reload'
        if (!interaction.channel || !interaction.channel.nsfw) {
            return interaction.reply({ embeds: [createNsfwOnlyEmbed()], ephemeral: true });
        }

        const userId = interaction.user.id;
        const now = Date.now();
        const cooldownAmount = 2000; // Shorter cooldown for reload

        if (cooldowns.has(userId)) {
            const expirationTime = cooldowns.get(userId) + cooldownAmount;
            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                return interaction.reply({ embeds: [createCooldownEmbed(timeLeft)], ephemeral: true });
            }
        }
        cooldowns.set(userId, now);
        setTimeout(() => cooldowns.delete(userId), cooldownAmount);

        try {
            // Defer update to acknowledge button click. Original message remains if error occurs.
            await interaction.deferUpdate();
            const newPayload = await generateImageEmbedAndComponents();
            await interaction.editReply(newPayload);
        } catch (error) {
            console.error(`Error in ${CATEGORY} handleComponent (rethrowing for global handler): ${error.message}`);
            throw error; // Re-throw for global error handling in index.js
        }
    },
};
