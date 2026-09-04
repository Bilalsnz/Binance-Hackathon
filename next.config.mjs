/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep the audit/demo experience snappy on low-end Android devices.
  poweredByHeader: false,
};

export default nextConfig;
