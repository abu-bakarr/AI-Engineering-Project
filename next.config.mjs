/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "@llamaindex/liteparse",
    "fast-png",
    "jpeg-js",
    "onnxruntime-node",
    "paddleocr",
    "chromadb",
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
