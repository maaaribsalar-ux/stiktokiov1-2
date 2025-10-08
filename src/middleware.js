import { defineMiddleware } from 'astro:middleware';

const unsupportedLocales = ['it', 'ar', 'fr', 'de', 'es', 'hi', 'id', 'ru', 'pt', 'ko', 'tl', 'nl', 'ms', 'tr'];  // Remove as you add languages

export default defineMiddleware((context, next) => {
  const { pathname } = context.url;
  
  // Check for unsupported locale prefixes (e.g., /it or /it/about)
  for (const locale of unsupportedLocales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      // Permanent redirect to homepage
      return Response.redirect('/', 301);
    }
  }
  
  // Allow the request to proceed (e.g., English routes)
  return next();
});
