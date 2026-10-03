# Nuclear Music Plugins

A curated suite of high-performance, open-source plugins for the [Nuclear Music Player](https://nuclearplayer.com/) desktop application, authored and maintained by **Chad Longanecker**.

---

## Included Plugins

| Plugin | Version | Category | Description | Source Directory |
| :--- | :---: | :---: | :--- | :--- |
| **Playlist Manual Sort** | `1.0.0` | `ui` / `playlists` | Adds a new "Manual" sort option with 60fps GPU-accelerated click-and-drag reordering and durable storage. | [`nuclear-playlist-manual-sort/`](./nuclear-playlist-manual-sort/) |
| **Playlist Tags & Filter** | `1.0.0` | `ui` / `playlists` | Tag categorization, quick-tag popovers on cards, and instant tag filtering on the playlists view. | [`nuclear-playlist-tags/`](./nuclear-playlist-tags/) |
| **Dashboard Video Companion** | `1.0.0` | `dashboard` | Embeds a zero-control auto-resizing YouTube video player directly on the Nuclear dashboard for the playing track. | [`nuclear-dashboard-video/`](./nuclear-dashboard-video/) |

---

## 1. Playlist Manual Sort (`nuclear-playlist-manual-sort`)

Provides manual, intuitive playlist reorganization directly in Nuclear's Playlists view (`/playlists`).

![Playlist Manual Sort in Nuclear Music Player](./docs/screenshot.png)

### Features
- **Manual Sort Option**: Seamlessly integrates into Nuclear's Headless UI sort dropdown alongside native sort options.
- **60fps Drag Engine**: Pointer Events drag controller using `requestAnimationFrame`, zero-reflow bounding calculations, and GPU-accelerated `translate3d` ghost rendering.
- **Durable Order Persistence**: Stores customized playlist order in both `api.Settings` and `localStorage`, persisting order across navigation, reloads, and application restarts.
- **Zero External Dependencies**: Self-contained single-bundle runtime.

### Quick Install
```bash
git clone https://github.com/HuggingBunny/Nuclear-Music-Plugins.git
cd Nuclear-Music-Plugins/nuclear-playlist-manual-sort
chmod +x install.sh
./install.sh
```

---

## 2. Playlist Tags & Filtering (`nuclear-playlist-tags`)

Enables rich playlist categorization with top-level filter chips, inline tag creation, and card-level quick-tagging.

### Features
- **Top Filter Chip Bar**: Placed directly above the playlist grid on `/playlists` with live playlist count badges (`All`, `LoFi`, `Punk`, `Rock`, etc.).
- **Card Quick-Tagging**: Displays mini tag badges on playlist cards with a dedicated `🏷️` popover editor to toggle tags on the fly without navigating away.
- **Playlist Detail Integration**: Tag badges and `+ Add Tag` editor injected into `/playlist/<id>` header.
- **Zero Schema Pollution**: Persists strictly to `api.Settings` and `localStorage`, never corrupting Nuclear's native playlist JSON files.

### Quick Install
```bash
cd Nuclear-Music-Plugins/nuclear-playlist-tags
chmod +x install.sh
./install.sh
```

---

## 3. Dashboard Video Companion (`nuclear-dashboard-video`)

Embeds synchronized music videos on the Nuclear main dashboard whenever a track is playing.

### Features
- **Zero-Control Clean UI**: Auto-resizing video viewport with clean ambient styling and fullscreen toggle.
- **Native Resolver Companion**: Local companion service (`nuclear-video-service.py`) running as a lightweight user systemd daemon on `127.0.0.1:9199`.
- **Automatic Queue Sync**: Syncs video playback and seeking automatically with Nuclear's track queue.

### Quick Install
```bash
cd Nuclear-Music-Plugins/nuclear-dashboard-video
chmod +x install.sh
./install.sh
```

---

## Development & Automated Testing

This repository includes automated in-webview test harnesses that verify plugins live inside a running Nuclear instance:

```bash
# Automated end-to-end verification of drag-and-drop sort engine
python3 test-manual-sort-automated.py
```

### Building Release Packages
Each plugin includes an npm packaging script:
```bash
cd nuclear-playlist-manual-sort
npm run package
# Outputs plugin.zip ready for release distribution
```

---

## Official Plugin Registry Compliance

Both plugins follow the official Nuclear Plugin specification:
- Compliant `package.json` with required `nuclear` metadata fields.
- Valid semver releases with root-level `plugin.zip` bundles.
- MIT Licensed and 100% open-source.

---

## Author

**Chad Longanecker**  
Security Automation & DevSecOps Engineer  
Krakow, Poland  
GitHub: [@HuggingBunny](https://github.com/HuggingBunny)

---

## License

This project is licensed under the [MIT License](./LICENSE).
