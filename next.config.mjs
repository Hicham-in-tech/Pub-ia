/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["msw"],
  experimental: {
    optimizePackageImports: ["framer-motion"],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // MSW exports ./browser with { node: null }; mark it external so the
      // server build doesn't try to resolve it.
      config.externals = [...(config.externals ?? []), "msw/browser"];
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "microphone=(self), camera=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
