import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // 複数lockfile警告の抑制 & このディレクトリをトレースルートに固定
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
