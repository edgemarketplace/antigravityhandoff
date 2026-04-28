import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.printify.com" },
      { protocol: "https", hostname: "pfy-prod-image-storage.s3.us-east-2.amazonaws.com" },
    ],
  },
  serverExternalPackages: ["firebase-admin", "firebase-admin/firestore"],
};

export default nextConfig;
