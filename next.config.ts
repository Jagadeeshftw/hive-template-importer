import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Next writes AGENTS.md / CLAUDE.md into the repo on every dev run; this repo
  // keeps its own notes instead.
  agentRules: false,
  // Keeps the dev overlay badge out of the committed screenshots.
  devIndicators: false,
};

export default nextConfig;
