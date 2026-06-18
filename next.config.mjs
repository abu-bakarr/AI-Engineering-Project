/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    "@llamaindex/liteparse",
    "fast-png",
    "jpeg-js",
    "onnxruntime-node",
    "paddleocr",
  ],
  webpack: (config) => {
    config.module.rules.push({
      test: /\.md$/,
      type: "asset/source",
    });
    return config;
  },
};

export default nextConfig;
