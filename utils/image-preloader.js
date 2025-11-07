// utils/image-preloader.js

const { NSFW } = require('nsfwhub');

class ImagePreloader {
    constructor() {
        this.nsfw = new NSFW();
        this.caches = new Map(); // category -> { cache: [], isPreloading: false }
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
                this.caches.get(category).cache.push({ url: data.image.url, timestamp: Date.now() });
            } else {
                 console.warn(`[Preloader] Received invalid data from API for category: ${category}`);
            }
        } catch (error) {
            console.error(`[Preloader] Cache fetch failed for ${category}:`, error.message);
        }
    }

    /**
     * Triggers a background preloading process for a category.
     * @param {string} category - The NSFW category.
     */
    _triggerBackgroundPreload(category) {
        this._initializeCategory(category);
        const categoryCache = this.caches.get(category);

        if (categoryCache.isPreloading) return;

        // Use setImmediate to avoid blocking the event loop
        setImmediate(async () => {
            categoryCache.isPreloading = true;
            try {
                while (categoryCache.cache.length < this.targetCacheSize) {
                    await this._fetchAndCache(category);
                    // Add a small delay to avoid spamming the API
                    await new Promise(resolve => setTimeout(resolve, this.preloadDelay));
                }
            } catch (error) {
                console.error(`[Preloader] Background preload error for ${category}:`, error.message);
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

        // If cache is empty, fetch a new image directly for a faster response
        console.log(`[Preloader] Cache miss for ${category}. Performing direct fetch.`);
        try {
            const data = await this.nsfw.fetch(category);
            if (!data || !data.image || !data.image.url) {
                throw new Error('Invalid or empty API response.');
            }
            return data.image.url;
        } catch (error) {
            console.error(`[Preloader] Direct fetch failed for ${category}:`, error.message);
            throw new Error(`Failed to fetch an image for the ${category} category.`);
        }
    }

    /**
     * Preloads images for a list of categories upon bot startup.
     * @param {string[]} categories - An array of categories to preload.
     */
    async initialPreload(categories) {
        console.log(`[Preloader] Starting initial preload for ${categories.length} categories...`);
        const preloadPromises = categories.map(category => {
            this._initializeCategory(category);
            // Fire off the preloading process for each category
            this._triggerBackgroundPreload(category);
            return Promise.resolve(); // Don't block startup
        });
        await Promise.all(preloadPromises);
        console.log('[Preloader] Initial preload tasks have been dispatched.');
    }
}

// Export a single, shared instance of the preloader
module.exports = new ImagePreloader();
