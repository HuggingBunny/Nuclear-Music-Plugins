#!/usr/bin/env bash
set -euo pipefail

# Nuclear Dashboard Video Plugin - Installer
# Author: Chad Longanecker

PLUGIN_ID="nuclear-dashboard-video"
PLUGIN_VERSION="1.0.0"
INSTALL_DIR="${HOME}/.local/share/com.nuclearplayer/plugins/${PLUGIN_ID}/${PLUGIN_VERSION}"
BIN_DIR="${HOME}/.local/bin"
SYSTEMD_USER_DIR="${HOME}/.config/systemd/user"
PLUGINS_JSON="${HOME}/.local/share/com.nuclearplayer/plugins.json"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Installing Nuclear Dashboard Video Plugin v${PLUGIN_VERSION}..."

# 1. Ensure directories exist
mkdir -p "${INSTALL_DIR}" "${BIN_DIR}" "${SYSTEMD_USER_DIR}"

# 2. Copy plugin files
cp "${SCRIPT_DIR}/package.json" "${INSTALL_DIR}/package.json"
cp "${SCRIPT_DIR}/index.js" "${INSTALL_DIR}/index.js"

# 3. Copy & activate companion video resolver service
cp "${SCRIPT_DIR}/service/nuclear-video-service.py" "${BIN_DIR}/nuclear-video-service.py"
chmod +x "${BIN_DIR}/nuclear-video-service.py"
cp "${SCRIPT_DIR}/service/nuclear-video.service" "${SYSTEMD_USER_DIR}/nuclear-video.service"

echo "==> Enabling systemd user service..."
systemctl --user daemon-reload
systemctl --user enable --now nuclear-video.service

# 4. Register in plugins.json if not present
if [ -f "${PLUGINS_JSON}" ]; then
  python3 -c "
import json
p = '${PLUGINS_JSON}'
try:
    with open(p, 'r') as f:
        data = json.load(f)
except Exception:
    data = {'plugins': {}}

if 'plugins' not in data:
    data['plugins'] = {}

data['plugins']['${PLUGIN_ID}'] = {
    'version': '${PLUGIN_VERSION}',
    'enabled': True,
    'path': '${INSTALL_DIR}'
}

with open(p, 'w') as f:
    json.dump(data, f, indent=2)
"
fi

echo "==> Installation complete!"
echo "    Plugin installed to: ${INSTALL_DIR}"
echo "    Resolver daemon running on: 127.0.0.1:9199"
echo "    Restart Nuclear Music Player to activate the dashboard video companion."
