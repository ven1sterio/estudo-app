/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  webpack: (config) => {
    // pdf.js tenta carregar o módulo opcional "canvas" (só existe no Node). No navegador não é usado.
    config.resolve.alias.canvas = false;
    return config;
  },
};
