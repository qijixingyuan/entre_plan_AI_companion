import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 构建并发限制为 1，降低内存峰值（沙盒环境内存有限）
  experimental: {
    cpus: 1,
  },
};

export default nextConfig;
