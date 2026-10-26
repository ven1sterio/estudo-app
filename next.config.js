const withPWAInit = require("@ducanh2912/next-pwa");
const withPWA = (withPWAInit.default || withPWAInit)({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  workboxOptions: {
    disableDevLogs: true,
    // Não guardar no precache arquivos de verificação TWA nem os próprios
    // arquivos do Service Worker (que mudam a cada build).
    exclude: [/\.well-known\//, /sw\.js$/, /workbox-.*\.js$/],
    runtimeCaching: [
      // Arquivos de verificação (assetlinks, security.txt): NUNCA cacheados,
      // porque o Chrome/Play Store checa a versão mais recente.
      {
        urlPattern: /\/\.well-known\/.*/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "well-known",
          networkTimeoutSeconds: 3,
          expiration: { maxEntries: 10, maxAgeSeconds: 3600 },
        },
      },
      // Manifest deve ser sempre fresco (evita servir ícones/metadados antigos).
      {
        urlPattern: /\/manifest\.json$/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "manifest",
          networkTimeoutSeconds: 3,
          expiration: { maxEntries: 4, maxAgeSeconds: 3600 },
        },
      },
      // Auth do Supabase: precisa checar rede primeiro
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "supabase-auth",
          networkTimeoutSeconds: 10,
          expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
        },
      },
      // REST do Supabase: NetworkFirst com fallback para cache
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "supabase-rest",
          networkTimeoutSeconds: 10,
          expiration: { maxEntries: 200, maxAgeSeconds: 86400 },
        },
      },
      // Storage (PDFs, imagens de materiais): CacheFirst
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "supabase-storage",
          expiration: { maxEntries: 300, maxAgeSeconds: 604800 },
        },
      },
      // Assets estáticos do Next: CacheFirst
      {
        urlPattern: /\/_next\/static\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "next-static",
          expiration: { maxEntries: 400, maxAgeSeconds: 31536000 },
        },
      },
      // Fontes, ícones e imagens públicas: CacheFirst
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif|ico|woff|woff2)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "static-assets",
          expiration: { maxEntries: 150, maxAgeSeconds: 2592000 },
        },
      },
      // Documentos HTML: NetworkFirst (SPA fallback quando offline)
      {
        urlPattern: ({ request }) => request.destination === "document",
        handler: "NetworkFirst",
        options: {
          cacheName: "pages",
          networkTimeoutSeconds: 10,
        },
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // pdf.js tenta carregar o módulo opcional "canvas" (só existe no Node).
    // No navegador não é usado.
    config.resolve.alias.canvas = false;
    return config;
  },
};

module.exports = withPWA(nextConfig);
