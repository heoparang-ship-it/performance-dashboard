/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // INTERNAL_API_URL: Railway 내부 네트워킹 (서버사이드 전용)
    // NEXT_PUBLIC_API_URL: 폴백
    const backendUrl =
      process.env.INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  output: "standalone",
};

module.exports = nextConfig;
