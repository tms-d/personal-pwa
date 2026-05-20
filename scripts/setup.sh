#!/usr/bin/env bash
# Container setup script for Claude Code on the web sessions.
#
# Hooked into the environment's "Setup script" field; runs once when the
# container is provisioned. Keep it small and idempotent — if you add
# anything here, it must be safe to re-run.

set -euo pipefail

# Install cloudflared so Claude can stand up an ad-hoc tunnel from the
# dev server to a public URL. Used for showing in-progress branches
# without going through GitHub Pages or any hosted preview service.
if ! command -v cloudflared >/dev/null; then
	curl -fsSL -o /usr/local/bin/cloudflared \
		https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
	chmod +x /usr/local/bin/cloudflared
fi
