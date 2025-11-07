// utils/message-components.js

const {
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MediaGalleryBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
} = require('discord.js');

/**
 * Creates a payload for NSFW-only channel warnings.
 * @returns {import('discord.js').InteractionReplyOptions}
 */
const createNsfwOnlyPayload = () => {
    const container = new ContainerBuilder()
        .setAccentColor(0xFFCC00) // Warning yellow
        .addTextDisplayComponents(
            textDisplay => textDisplay.setContent('### 🔞 NSFW Channel Required'),
            textDisplay => textDisplay.setContent('This command can only be used in channels marked as NSFW. Please switch to an appropriate channel.')
        );
    return { components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral, ephemeral: true };
};

/**
 * Creates a payload for cooldown messages.
 * @param {number} timeLeft - The remaining time in seconds.
 * @returns {import('discord.js').InteractionReplyOptions}
 */
const createCooldownPayload = (timeLeft) => {
    const container = new ContainerBuilder()
        .setAccentColor(0xFF6B6B) // Soft red
        .addTextDisplayComponents(
            textDisplay => textDisplay.setContent('### ⏰ A Moment of Patience'),
            textDisplay => textDisplay.setContent(`Please wait **${timeLeft.toFixed(1)}s** before requesting another image. Anticipation makes it better.`)
        );
    return { components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral, ephemeral: true };
};

/**
 * Creates a payload for API error messages.
 * @param {string} category - The category that failed to fetch.
 * @returns {import('discord.js').InteractionReplyOptions}
 */
const createApiErrorPayload = (category) => {
    const container = new ContainerBuilder()
        .setAccentColor(0xFF0000) // Error red
        .addTextDisplayComponents(
            textDisplay => textDisplay.setContent('### 📛 API Error'),
            textDisplay => textDisplay.setContent(`Oops! We couldn't fetch an image for the **${category}** category. The service might be down or unavailable. Please try again later.`)
        );
    return { components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral, ephemeral: true };
};

/**
 * Creates the main content payload with the image and action buttons.
 * @param {string} category - The content category (e.g., 'hentai').
 * @param {string} imageUrl - The URL of the image to display.
 * @param {string} [title='A Beautiful View'] - The title to display.
 * @returns {import('discord.js').InteractionReplyOptions}
 */
const createContentPayload = (category, imageUrl, title = 'A Beautiful View') => {
    // Capitalize the first letter of the category for the button label
    const buttonLabel = category.charAt(0).toUpperCase() + category.slice(1);

    const container = new ContainerBuilder()
        .setAccentColor(0xFF69B4) // Signature hot pink
        .addMediaGalleryComponents(
            mediaGallery => mediaGallery.addItems(
                item => item.setURL(imageUrl).setDescription(`An image from the ${category} category.`)
            )
        );

    const reloadButton = new ButtonBuilder()
        .setCustomId(`${category}:reload`) // Format: commandName:action
        .setLabel(`More ${buttonLabel}!`)
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎨');

    const actionRow = new ActionRowBuilder().addComponents(reloadButton);

    const components = [
        new TextDisplayBuilder().setContent(`### ${title}`),
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
        container,
        actionRow,
    ];

    return { components, flags: MessageFlags.IsComponentsV2 };
};


module.exports = {
    createNsfwOnlyPayload,
    createCooldownPayload,
    createApiErrorPayload,
    createContentPayload,
};
