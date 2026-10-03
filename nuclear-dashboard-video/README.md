# Nuclear Dashboard Video Companion Plugin

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20WebKitGTK%20%7C%20Tauri-orange.svg)](https://github.com/nukeop/nuclear)
[![Author](https://img.shields.io/badge/Author-Chad%20Longanecker-green.svg)](https://github.com/HuggingBunny)

An ad-free, zero-control, auto-resizing YouTube music video companion for the **Nuclear Music Player** dashboard.

Plays the visual video stream corresponding to your currently playing song in sync with Nuclear's playback, with hardware-accelerated H.264 decoding, sub-second stream loading, and instant track transitions.

---

## Features

- **Clean Visual Presentation**: Zero playback controls, scrub bars, or YouTube overlays across the video canvas. Auto-scales dynamically to fit the dashboard workspace at full 16:9 aspect ratio.
- **Top-Right Fullscreen Toggle**: Subtle, frosted-blur toggle button in the top-right corner with auto-hiding cursor after 2.5s of mouse inactivity.
- **Sub-Second Stream Resolution**: Persistent in-process `yt-dlp` daemon on `127.0.0.1:9199` caches and serves video streams in under 0.8s on cold lookups.
- **Instant Track Transitions (0.01s)**: Delayed queue lookahead pre-resolves the next track 2.5s into playback without competing with active network bandwidth.
- **GPU-Accelerated Playback**: Strictly targets H.264 (`avc1` / `itag 136`) 720p streams to enable hardware VAAPI/NVDEC decode, keeping CPU utilization below 8%.
- **Zero Decoder Thrashing**: Respects WebKitGTK's media pipeline by only seeking on manual timeline scrubs (>6.0s), preventing frame drops and buffering stutters.
- **Sidebar & Route Isolated**: Mounts exclusively inside `main[data-testid="player-workspace-main"]` on the `/dashboard` route. Automatically suspends rendering when navigating to settings, search, or playlists.
<img width="1264" height="981" alt="image" src="https://github.com/user-attachments/assets/7f1b1de5-5708-476d-9cc3-8a57b0d5bbd4" />

---

## Architecture & Cross-Platform Support

This plugin is designed to run seamlessly on **Linux, macOS, and Windows** with zero mandatory external services:

1. **Universal Out-of-the-Box Mode (All Platforms)**:
   - When installed directly via Nuclear's in-app Plugin Store, the plugin automatically resolves direct MP4 video streams via public open-source extractors (Piped / Invidious) and embedded player fallback. No terminal commands, Python, or system daemons required.
2. **Optional High-Performance Local Daemon (Linux)**:
   - For users on Linux desiring sub-second cold stream resolution (under 0.8s) and instant 0.01s track prefetching, an optional lightweight background daemon (`service/nuclear-video-service.py`) can be enabled on `127.0.0.1:9199`.

```mermaid
flowchart LR
    A["Nuclear Player UI<br/>(Tauri / WebKit / WebView)"] -->|"Track Change"| B["nuclear-dashboard-video<br/>Plugin (index.js)"]
    B -->|"1. Local Daemon Probe<br/>(Optional 127.0.0.1:9199)"| C["Local Daemon<br/>(Linux yt-dlp)"]
    B -->|"2. Universal Fallback<br/>(Zero-Install)"| D["Public Stream Resolvers<br/>&amp; Embed Fallback"]
    C -->|"Direct H.264 Stream"| B
    D -->|"Direct Video Stream"| B
    B -->|"Native &lt;video&gt;"| E["Hardware Decoder"]
```

---

## Installation

### Method 1: Nuclear In-App Plugin Store (Recommended for All Platforms)

Search for **Dashboard Video** in Nuclear's Plugin Store (`Settings > Plugins`) and click **Install**. It works immediately on Linux, macOS, and Windows without any additional setup.

---

### Method 2: Local Installation (Linux with Optional Companion Daemon)

Clone the repository and run the automated installer:

```bash
git clone https://github.com/HuggingBunny/nuclear-dashboard-video.git
cd nuclear-dashboard-video
./install.sh
```

The script will:
1. Copy the plugin files to `~/.local/share/com.nuclearplayer/plugins/nuclear-dashboard-video/1.0.0/`.
2. Register the plugin in `~/.local/share/com.nuclearplayer/plugins.json`.
3. Optionally set up the local companion service on `127.0.0.1:9199` for ultra-fast local resolution.

1. **Install the Companion Resolver Service**:
   ```bash
   mkdir -p ~/.local/bin ~/.config/systemd/user
   cp service/nuclear-video-service.py ~/.local/bin/nuclear-video-service.py
   chmod +x ~/.local/bin/nuclear-video-service.py
   cp service/nuclear-video.service ~/.config/systemd/user/nuclear-video.service
   systemctl --user daemon-reload
   systemctl --user enable --now nuclear-video.service
   ```

2. **Install the Plugin Package**:
   ```bash
   mkdir -p ~/.local/share/com.nuclearplayer/plugins/nuclear-dashboard-video/1.0.0
   cp package.json index.js ~/.local/share/com.nuclearplayer/plugins/nuclear-dashboard-video/1.0.0/
   ```

3. **Register the Plugin**:
   Add the following block to `~/.local/share/com.nuclearplayer/plugins.json`:
   ```json
   "nuclear-dashboard-video": {
     "version": "1.0.0",
     "enabled": true,
     "path": "~/.local/share/com.nuclearplayer/plugins/nuclear-dashboard-video/1.0.0"
   }
   ```

---

## Packaging for Release

To package the plugin archive for GitHub Releases:

```bash
npm run package
# Generates plugin.zip
```

Attach `plugin.zip` to your GitHub Release tag (e.g., `v1.0.0`).

---

## Submitting to Nuclear Plugin Registry

To have this plugin featured in the official Nuclear in-app Plugin Store:

1. Fork the official [NuclearPlayer/plugin-registry](https://github.com/NuclearPlayer/plugin-registry) repository.
2. Add the entry from [`registry-entry.json`](registry-entry.json) into `plugins.json`:
   ```json
   {
     "id": "nuclear-dashboard-video",
     "name": "Dashboard Video Companion",
     "description": "Zero-control auto-resizing YouTube video companion on the Nuclear Dashboard for the currently playing track",
     "author": "Chad Longanecker",
     "repo": "HuggingBunny/nuclear-dashboard-video",
     "category": "dashboard",
     "categories": ["dashboard", "integration"],
     "tags": ["youtube", "video", "dashboard", "companion", "music-video"],
     "version": "1.0.0",
     "downloadUrl": "https://github.com/HuggingBunny/nuclear-dashboard-video/releases/download/v1.0.0/plugin.zip",
     "addedAt": "2026-09-30T00:00:00Z"
   }
   ```
3. Open a Pull Request against `NuclearPlayer/plugin-registry:master`.

---

## Author

**Chad Longanecker**  
Security Automation & DevSecOps Engineer  
[GitHub Profile](https://github.com/HuggingBunny)

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
