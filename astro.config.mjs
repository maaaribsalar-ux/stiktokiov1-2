import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { autolinkConfig } from "./plugins/rehype-autolink-config";
import rehypeSlug from "rehype-slug";
// Remove astroI18next import - not needed anymore
import alpinejs from "@astrojs/alpinejs";
import solidJs from "@astrojs/solid-js"; // Added SolidJS integration
import AstroPWA from "@vite-pwa/astro";
import icon from "astro-icon";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  output: "server",
  site: "https://tiktokio.cam",
  adapter: vercel(),
  // Add Astro's built-in i18n configuration
  i18n: {
    defaultLocale: "en",
    locales: ["en", "it", "ar", "fr", "de", "es", "hi", "id", "ru", "pt", "ko", "tl", "nl", "ms", "tr"],
    routing: {
      prefixDefaultLocale: false, // /about for English, /it/about for Italian
    },
  },
  vite: {
    plugins: [tailwindcss()],
    define: {
      __DATE__: `'${new Date().toISOString()}'`, // Fixed: corrected to double underscores
    },
  },
  integrations: [
    sitemap({
      filter(page) {
        const url = new URL(page, 'https://tiktokio.cam');
        
        // All non-English language codes
        const nonEnglishLangs = ['ar', 'it', 'de', 'es', 'fr', 'hi', 'id', 'ko', 'ms', 'nl', 'pt', 'ru', 'tl', 'tr'];
        
        // Should exclude if:
        const shouldExclude = 
          // Non-English blog posts (but keeps /{lang}/blog/ index pages)
          nonEnglishLangs.some(lang => 
            url.pathname.startsWith(`/${lang}/blog/`) && 
            url.pathname !== `/${lang}/blog/`
          ) ||
          // Pagination, tags, categories
          /\/blog\/\d+\//.test(url.pathname) ||
          url.pathname.includes('/tag/') || 
          url.pathname.includes('/category/');
        return !shouldExclude;
      }
    }), // <- ADDED MISSING COMMA HERE
    // Remove astroI18next() - not needed anymore
    alpinejs(),
    solidJs(), // Added SolidJS integration
    AstroPWA({
      mode: "production",
      base: "/",
      scope: "/",
      includeAssets: ["favicon.svg"],
      registerType: "autoUpdate",
      manifest: {
        name: "Tiktokio - TikTok Downloader - Download TikTok Videos Without Watermark",
        short_name: "Astros",
        theme_color: "#ffffff",
        icons: [
          {
            src: "pwa-192x192.webp",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.webp",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-512x512.webp",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/404",
        globPatterns: ["*.js"],
      },
      devOptions: {
        enabled: false,
        navigateFallbackAllowlist: [/^\/404$/],
        suppressWarnings: true,
      },
    }),
    icon(),
  ],
  markdown: {
    rehypePlugins: [
      rehypeSlug,
      // This adds links to headings
      [rehypeAutolinkHeadings, autolinkConfig],
    ],
  },
});
