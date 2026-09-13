/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // @wagmi/connectors bundles a Coinbase Smart Wallet connector we never
    // use (Privy handles wallet creation for this app), which transitively
    // pulls in @coinbase/cdp-sdk's optional x402 payment client. Those
    // packages aren't installed (they're optional peer deps on the
    // Coinbase side) so webpack's static analysis fails to resolve them
    // even though the code path is never reached at runtime. Aliasing to
    // `false` tells webpack to treat the import as an empty module instead
    // of erroring the whole build.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@x402/evm/upto/client": false,
      "@x402/evm/exact/client": false,
      "@x402/core/client": false,
      "@x402/svm/exact/client": false,
      "@x402/evm": false,
    };
    return config;
  },
};

export default nextConfig;
