import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse Node ortamına özel bir pakettir; bundle edilmeden dışarıdan require edilir.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
