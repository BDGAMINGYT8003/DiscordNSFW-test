// utils/image-preloader.js

const { NSFW } = require('nsfwhub');

class ImagePreloader {
    constructor() {
        this.nsfw = new NSFW();
        this.caches = new Map(); // category -> { cache: [], isPreloading: false }
        this.failedCategories = new Set(); // Tracks categories that fail to fetch
        this.targetCacheSize = 3; // Keep a buffer of 3 images per category
        this.preloadDelay = 250; // ms between fetches during background preloading
    }

    /**
     * Initializes the cache for a specific category if it doesn't exist.
     * @param {string} category - The NSFW category.
     */
    _initializeCategory(category) {
        if (!this.caches.has(category)) {
            this.caches.set(category, {
                cache: [],
                isPreloading: false,
            });
        }
    }

    /**
     * Fetches a single image and adds it to the specified category's cache.
     * @param {string} category - The NSFW category.
     * @returns {Promise<void>}
     */
    async _fetchAndCache(category) {
        this._initializeCategory(category);
        try {
            const data = await this.nsfw.fetch(category);
            if (data && data.image && data.image.url) {
                // If a fetch succeeds, assume the category is valid again
                if (this.failedCategories.has(category)) {
                    this.failedCategories.delete(category);
                    console.log(`[Preloader] Category '${category}' is now preloading successfully.`);
                }
                this.caches.get(category).cache.push({ url: data.image.url, timestamp: Date.now() });
            } else {
                 throw new Error('API returned invalid or empty data.');
            }
        } catch (error) {
            // If fetching fails, log it once and add to the failed set to prevent spam.
            if (!this.failedCategories.has(category)) {
                console.warn(`[Preloader] Disabling background preloading for category '${category}' due to a fetch error. It will be re-enabled automatically if a future fetch succeeds.`);
                this.failedCategories.add(category);
            }
        }
    }

    /**
     * Triggers a background preloading process for a category.
     * @param {string} category - The NSFW category.
     */
    _triggerBackgroundPreload(category) {
        // Do not attempt to preload for a category that is currently failing.
        if (this.failedCategories.has(category)) {
            return;
        }

        this._initializeCategory(category);
        const categoryCache = this.caches.get(category);

        if (categoryCache.isPreloading) return;

        // Use setImmediate to avoid blocking the event loop
        setImmediate(async () => {
            categoryCache.isPreloading = true;
            try {
                while (categoryCache.cache.length < this.targetCacheSize) {
                    await this._fetchAndCache(category);
                    if (this.failedCategories.has(category)) break; // Stop if fetch failed
                    await new Promise(resolve => setTimeout(resolve, this.preloadDelay));
                }
            } catch (error) {
                console.error(`[Preloader] An unexpected error occurred during background preload for ${category}:`, error.message);
            } finally {
                categoryCache.isPreloading = false;
            }
        });
    }

    /**
     * Gets an image URL for a given category, using the cache if available.
     * @param {string} category - The NSFW category.
     * @returns {Promise<string>} - The image URL.
     * @throws {Error} - If the API fails to provide a valid image.
     */
    async getImage(category) {
        this._initializeCategory(category);
        const categoryCache = this.caches.get(category);

        // Always trigger a preload check to keep the cache full
        this._triggerBackgroundPreload(category);

        if (categoryCache.cache.length > 0) {
            const cachedImage = categoryCache.cache.shift();
            return cachedImage.url;
        }

        console.log(`[Preloader] Cache miss for '${category}'. Performing direct fetch.`);
        try {
            const data = await this.nsfw.fetch(category);
            if (!data || !data.image || !data.image.url) {
                throw new Error('Invalid or empty API response.');
            }
            return data.image.url;
        } catch (error) {
            console.error(`[Preloader] Direct fetch failed for '${category}':`, error.message);
            throw new Error(`Failed to fetch an image for the ${category} category.`);
        }
    }

    /**
     * Preloads images for a list of categories upon bot startup.
     * @param {string[]} categories - An array of categories to preload.
     */
    async initialPreload(categories) {
        console.log(`[Preloader] Starting initial preload for ${categories.length} categories...`);
        // Dispatch all preloading tasks to run in the background without blocking startup.
        for (const category of categories) {
            this._triggerBackgroundPreload(category);
        }
        console.log('[Preloader] Initial preload tasks have been dispatched.');
    }
}

// Export a single, shared instance of the preloader
module.exports = new ImagePreloader();
