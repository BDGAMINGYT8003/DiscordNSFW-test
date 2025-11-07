// commands/anal.js

const { SlashCommandBuilder } = require('discord.js');
const { createNsfwOnlyPayload, createCooldownPayload, createApiErrorPayload, createContentPayload } = require('../utils/message-components');
const imagePreloader = require('../utils/image-preloader');

const CATEGORY = 'anal';
const COMMAND_TITLE = 'Anal';
const COOLDOWN = 3000; // 3 seconds in milliseconds
const cooldowns = new Map();

/**
 * A unified handler for both slash and prefix commands.
 * @param {import('discord.js').Interaction | import('discord.js').Message} context - The interaction or message object.
 * @param {boolean} isInteraction - Whether the context is an interaction.
 */
async function handleCommand(context, isInteraction) {
    // 1. Check for NSFW channel
    if (!context.channel || !context.channel.nsfw) {
        return context.reply(createNsfwOnlyPayload());
    }

    // 2. Handle Cooldown
    const userId = isInteraction ? context.user.id : context.author.id;
    const now = Date.now();
    if (cooldowns.has(userId)) {
        const expirationTime = cooldowns.get(userId) + COOLDOWN;
        if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            return context.reply(createCooldownPayload(timeLeft));
        }
    }

    // 3. Defer reply for interactions to give us time
    if (isInteraction) {
        await context.deferReply({ ephemeral: false });
    }

    // 4. Fetch image and build payload
    try {
        const imageUrl = await imagePreloader.getImage(CATEGORY);
        const payload = createContentPayload(CATEGORY, imageUrl, COMMAND_TITLE);

        const replyMethod = isInteraction ? 'editReply' : 'channel.send';
        await context[replyMethod](payload);

        // 5. Set cooldown after a successful command
        cooldowns.set(userId, now);
        setTimeout(() => cooldowns.delete(userId), COOLDOWN);
    } catch (error) {
        console.error(`[Command: ${CATEGORY}] Error fetching image:`, error);
        const errorPayload = createApiErrorPayload(CATEGORY);
        const errorMethod = isInteraction ? 'editReply' : 'reply';
        await context[errorMethod](errorPayload);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName(CATEGORY)
        .setDescription(`Delivers ${COMMAND_TITLE}. (NSFW channels only)`),

    async execute(interactionOrMessage) {
        // Determine if it's an interaction or a message and call the handler
        const isInteraction = interactionOrMessage.isChatInputCommand?.() || false;
        await handleCommand(interactionOrMessage, isInteraction);
    },

    async handleComponent(interaction, action) {
        if (action === 'reload') {
            // Acknowledge the button press immediately
            await interaction.deferUpdate();

            // Re-fetch and edit the original message
            try {
                const imageUrl = await imagePreloader.getImage(CATEGORY);
                const payload = createContentPayload(CATEGORY, imageUrl, COMMAND_TITLE);
                await interaction.editReply(payload);
            } catch (error) {
                 console.error(`[Component: ${CATEGORY}] Error reloading image:`, error);
                 // We can't send a full error payload here, so we follow up
                 await interaction.followUp(createApiErrorPayload(CATEGORY));
            }
        }
    },
};
