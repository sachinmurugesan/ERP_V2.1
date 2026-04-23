/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Transpile workspace packages so Next.js can process their ESM source.
   * Both packages ship ESM-only dist/; transpilePackages ensures Next.js
   * builds them correctly in all environments (RSC, edge, server actions).
   */
  transpilePackages: ["@harvesterp/lib", "@harvesterp/sdk"],
};

export default nextConfig;
