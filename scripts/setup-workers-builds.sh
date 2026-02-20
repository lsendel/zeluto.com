#!/usr/bin/env bash
# Configure Cloudflare Workers Builds for each worker in the monorepo.
# Requires: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID env vars.
#
# Usage: ./scripts/setup-workers-builds.sh
#
# This script outputs the Cloudflare dashboard URLs for manual verification
# and any watch paths that need to be configured per project.

set -euo pipefail

SHARED_PACKAGES="packages/worker-lib packages/domain-kernel packages/contracts packages/db"
GATEWAY_EXTRA="packages/ui-kit"

echo "=== Cloudflare Workers Builds Setup ==="
echo ""
echo "Each worker needs a Cloudflare Deployments project configured in the dashboard:"
echo "https://dash.cloudflare.com → Workers & Pages → Create → Connect to Git"
echo ""
echo "Per-worker build configuration:"
echo ""

for wrangler_file in workers/*/wrangler.toml; do
  worker_dir=$(dirname "$wrangler_file")
  worker_name=$(grep '^name = ' "$wrangler_file" | head -1 | sed 's/name = "\(.*\)"/\1/')

  echo "--- $worker_name ---"
  echo "  Directory: $worker_dir"
  echo "  Build command: npm i -g pnpm@10 && pnpm install --frozen-lockfile && pnpm turbo build --filter=./$worker_dir..."
  echo "  Environment variable: SKIP_DEPENDENCY_INSTALL=true"

  # Determine watch paths
  watch_paths="$worker_dir/"
  for pkg in $SHARED_PACKAGES; do
    watch_paths="$watch_paths, $pkg/"
  done

  # Gateway needs ui-kit too
  if [[ "$worker_name" == "mauntic-gateway" ]]; then
    watch_paths="$watch_paths, $GATEWAY_EXTRA/"
  fi

  # Queue workers share source with their parent
  if [[ "$worker_dir" == *-queue ]]; then
    parent_dir="${worker_dir%-queue}"
    watch_paths="$watch_paths, $parent_dir/src/"
  fi

  echo "  Watch paths: $watch_paths"
  echo ""
done

echo "=== Done ==="
echo "Configure each project at: https://dash.cloudflare.com"
echo "Set SKIP_DEPENDENCY_INSTALL=true in each project's environment variables"
