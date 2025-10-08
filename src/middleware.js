import { defineMiddleware } from 'astro:middleware';

const unsupportedLocales = ['it', 'ar', 'fr', 'de', 'es', 'hi', 'id', 'ru', 'pt', 'ko', 'tl', 'nl', 'ms', 'tr'];

export default defineMiddleware((context, next) => {
  const { pathname } = context.url;
  
  for (const locale of unsupportedLocales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      // Permanent redirect to homepage using standard Web Response API
      return new Response(null, {
        status: 301,
        headers: {
          Location: '/',
        },
      });
    }
  }
  
  // Proceed with the request
  return next();
});
