/**
 * Nuclear Music Player - Dashboard Video Companion Plugin
 * Author: Chad Longanecker
 * License: MIT
 *
 * Provides a zero-control auto-resizing YouTube video companion
 * on the Nuclear dashboard for the currently playing track.
 */
'use strict';

let unsubscribers = [];
let routeObserver = null;
let syncTimer = null;
let containerEl = null;
let videoEl = null;
let loadingEl = null;
let fullscreenBtnEl = null;
let styleEl = null;
let currentVideoId = null;
let currentPlaybackState = null;
let activeFetchController = null;
let lastKnownSeek = 0;
let fsHideTimer = null;

function extractVideoId(item) {
  if (!item || !item.track) return null;
  const { track } = item;

  // 1. Check track source
  if (track.source?.id && isValidYoutubeId(track.source.id)) {
    return track.source.id;
  }

  // 2. Check stream candidates
  if (Array.isArray(track.streamCandidates)) {
    for (const c of track.streamCandidates) {
      if (c.source?.id && isValidYoutubeId(c.source.id)) return c.source.id;
      if (c.id && isValidYoutubeId(c.id)) return c.id;
    }
  }

  // 3. Fallback: thumbnail URL (e.g. https://i.ytimg.com/vi/<id>/...)
  if (track.artwork?.items) {
    for (const art of track.artwork.items) {
      if (art.url) {
        const match = art.url.match(/\/vi\/([a-zA-Z0-9_-]{11})\//);
        if (match && match[1]) return match[1];
      }
    }
  }

  return null;
}

function isValidYoutubeId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(id.trim());
}

function updateFullscreenButtonState() {
  if (!fullscreenBtnEl) return;
  const isFs = !!document.fullscreenElement;
  const iconExpand = fullscreenBtnEl.querySelector('.icon-expand');
  const iconRestore = fullscreenBtnEl.querySelector('.icon-restore');

  if (isFs) {
    if (iconExpand) iconExpand.style.display = 'none';
    if (iconRestore) iconRestore.style.display = 'block';
    fullscreenBtnEl.setAttribute('title', 'Exit Fullscreen (Esc)');
  } else {
    if (iconExpand) iconExpand.style.display = 'block';
    if (iconRestore) iconRestore.style.display = 'none';
    fullscreenBtnEl.setAttribute('title', 'Fullscreen');
  }
}

function handleMouseMove() {
  if (!containerEl) return;
  containerEl.classList.remove('hide-controls');
  clearTimeout(fsHideTimer);

  if (document.fullscreenElement) {
    fsHideTimer = setTimeout(() => {
      if (document.fullscreenElement && containerEl) {
        containerEl.classList.add('hide-controls');
      }
    }, 2500);
  }
}

function ensureVideoDom(wrapper) {
  if (videoEl && wrapper.contains(videoEl)) {
    return;
  }

  wrapper.innerHTML = `
    <div id="nuclear-video-loading" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: #000000; color: rgba(255,255,255,0.4); font-size: 13px; z-index: 2;">
      <span>Loading video stream...</span>
    </div>
    <video
      id="nuclear-dashboard-video"
      autoplay
      muted
      playsinline
      style="width: 100%; height: 100%; object-fit: contain; pointer-events: none; background: #000000;"
    ></video>
    <button
      id="nuclear-fullscreen-btn"
      type="button"
      aria-label="Toggle Fullscreen"
      title="Fullscreen"
    >
      <svg class="icon-expand" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>
      </svg>
      <svg class="icon-restore" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;">
        <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"></path>
      </svg>
    </button>
  `;

  videoEl = wrapper.querySelector('#nuclear-dashboard-video');
  loadingEl = wrapper.querySelector('#nuclear-video-loading');
  fullscreenBtnEl = wrapper.querySelector('#nuclear-fullscreen-btn');

  if (fullscreenBtnEl) {
    fullscreenBtnEl.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!document.fullscreenElement) {
        if (containerEl?.requestFullscreen) {
          containerEl.requestFullscreen().catch(() => {});
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
    };
  }

  updateFullscreenButtonState();
}

async function loadVideoStream(videoId) {
  if (!containerEl) return;

  const wrapper = containerEl.querySelector('#nuclear-video-wrapper');
  if (!wrapper) return;

  if (!videoId) {
    wrapper.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: rgba(255,255,255,0.4); font-family: system-ui, -apple-system, sans-serif;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 12px; opacity: 0.6;">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        <span style="font-size: 14px; letter-spacing: 0.5px;">Waiting for track playback...</span>
      </div>
    `;
    videoEl = null;
    loadingEl = null;
    fullscreenBtnEl = null;
    currentVideoId = null;
    return;
  }

  if (currentVideoId === videoId && videoEl?.src) {
    return;
  }

  currentVideoId = videoId;
  ensureVideoDom(wrapper);

  if (loadingEl) {
    loadingEl.style.display = 'flex';
    loadingEl.textContent = 'Loading video stream...';
  }

  if (activeFetchController) {
    activeFetchController.abort();
  }
  activeFetchController = new AbortController();

  try {
    const res = await fetch(`http://127.0.0.1:9199/url?v=${videoId}`, {
      signal: activeFetchController.signal
    });
    if (!res.ok) throw new Error(`Resolver returned status ${res.status}`);
    const data = await res.json();

    if (data.url && videoEl) {
      videoEl.src = data.url;
      videoEl.muted = true;

      videoEl.onloadedmetadata = () => {
        if (loadingEl) loadingEl.style.display = 'none';

        // Only seek if playback is already mid-track (> 4.0s). Never seek at track start to avoid extra buffer stalls.
        if (currentPlaybackState && typeof currentPlaybackState.seek === 'number' && currentPlaybackState.seek >= 4.0) {
          videoEl.currentTime = currentPlaybackState.seek;
          lastKnownSeek = currentPlaybackState.seek;
        } else {
          lastKnownSeek = 0;
        }

        if (currentPlaybackState?.status === 'playing') {
          videoEl.play().catch(() => {});
        }
      };

      videoEl.onerror = () => {
        if (loadingEl) {
          loadingEl.textContent = 'Failed to load video stream';
        }
      };
    }
  } catch (err) {
    if (err.name !== 'AbortError' && loadingEl) {
      loadingEl.textContent = 'Video resolver error';
    }
  }
}

function syncPlaybackWithVideo(state) {
  if (!state || !videoEl) return;
  currentPlaybackState = state;

  videoEl.muted = true;

  if (state.status === 'playing') {
    if (videoEl.paused && videoEl.readyState >= 2) {
      videoEl.play().catch(() => {});
    }
  } else if (state.status === 'paused' || state.status === 'stopped') {
    if (!videoEl.paused) {
      videoEl.pause();
    }
  }

  // Only intervene and re-seek if the user scrubbed (> 6.0s jump)
  if (typeof state.seek === 'number' && Number.isFinite(state.seek)) {
    const userScrubbed = Math.abs(state.seek - lastKnownSeek) > 6.0;
    lastKnownSeek = state.seek;

    if (userScrubbed) {
      videoEl.currentTime = Math.max(0, state.seek);
    }
  }
}

async function schedulePrefetchNext(api) {
  try {
    const queue = await api.Queue.getQueue();
    const current = await api.Queue.getCurrentItem();
    if (!Array.isArray(queue) || !current) return;

    const currentIndex = queue.findIndex((q) => q.uuid === current.uuid || (q.id && q.id === current.id));
    if (currentIndex >= 0 && currentIndex + 1 < queue.length) {
      const nextItem = queue[currentIndex + 1];
      const nextId = extractVideoId(nextItem);
      if (nextId && nextId !== currentVideoId) {
        fetch(`http://127.0.0.1:9199/prefetch?v=${nextId}`).catch(() => {});
      }
    }
  } catch (_) {}
}

function isDashboardRoute() {
  const main = document.querySelector('main[data-testid="player-workspace-main"]') || document.querySelector('main');
  if (!main) return false;

  if (main.querySelector('[data-testid^="dashboard-"]')) return true;

  const navLink = document.querySelector('a[href="/dashboard"], a[href="#/dashboard"]');
  if (navLink) {
    const isCurrent = navLink.getAttribute('aria-current') === 'page' ||
      navLink.classList.contains('active') ||
      navLink.dataset.status === 'active';
    if (isCurrent) return true;
  }

  const path = window.location.pathname;
  if (path === '/' || path === '/dashboard' || window.location.hash.includes('dashboard')) {
    return true;
  }

  return false;
}

function updateDomLayout() {
  const main = document.querySelector('main[data-testid="player-workspace-main"]') || document.querySelector('main');
  if (!main) return;

  const onDashboard = isDashboardRoute();

  if (!containerEl) {
    containerEl = document.createElement('div');
    containerEl.id = 'nuclear-dashboard-video-container';
    containerEl.innerHTML = '<div id="nuclear-video-wrapper"></div>';
    containerEl.addEventListener('mousemove', handleMouseMove);
  }

  if (onDashboard) {
    if (!main.contains(containerEl)) {
      main.appendChild(containerEl);
    }
    containerEl.style.display = 'flex';
    document.body.classList.add('has-dashboard-video');

    if (!videoEl && currentVideoId) {
      loadVideoStream(currentVideoId);
    }
  } else {
    if (containerEl) {
      containerEl.style.display = 'none';
    }
    document.body.classList.remove('has-dashboard-video');
    if (videoEl && !videoEl.paused) {
      videoEl.pause();
    }
  }
}

function injectStyles() {
  if (document.getElementById('nuclear-dashboard-video-styles')) return;

  styleEl = document.createElement('style');
  styleEl.id = 'nuclear-dashboard-video-styles';
  styleEl.textContent = `
    main[data-testid="player-workspace-main"] {
      position: relative !important;
    }
    #nuclear-dashboard-video-container {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000000;
      z-index: 1;
      overflow: hidden;
    }
    #nuclear-dashboard-video-container:fullscreen {
      width: 100vw !important;
      height: 100vh !important;
      max-width: 100vw !important;
      max-height: 100vh !important;
      background: #000000 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      z-index: 999999 !important;
      position: fixed !important;
      inset: 0 !important;
    }
    #nuclear-video-wrapper {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000000;
      overflow: hidden;
    }
    #nuclear-dashboard-video-container:fullscreen #nuclear-video-wrapper {
      width: 100% !important;
      height: 100% !important;
    }
    #nuclear-dashboard-video {
      width: 100%;
      height: 100%;
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      pointer-events: none;
      background: #000000;
    }
    #nuclear-dashboard-video-container:fullscreen #nuclear-dashboard-video {
      width: 100% !important;
      height: 100% !important;
      object-fit: contain !important;
    }
    #nuclear-fullscreen-btn {
      position: absolute;
      top: 14px;
      right: 14px;
      z-index: 50;
      width: 34px;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(18, 18, 18, 0.65);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 8px;
      color: rgba(255, 255, 255, 0.85);
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.25s ease, background 0.15s ease, transform 0.1s ease;
      pointer-events: auto;
      padding: 0;
    }
    #nuclear-dashboard-video-container:hover #nuclear-fullscreen-btn {
      opacity: 0.85;
    }
    #nuclear-fullscreen-btn:hover {
      opacity: 1 !important;
      background: rgba(30, 30, 30, 0.88);
      border-color: rgba(255, 255, 255, 0.35);
      color: #ffffff;
      transform: scale(1.06);
    }
    #nuclear-fullscreen-btn:active {
      transform: scale(0.94);
    }
    #nuclear-dashboard-video-container.hide-controls {
      cursor: none !important;
    }
    #nuclear-dashboard-video-container.hide-controls #nuclear-fullscreen-btn {
      opacity: 0 !important;
      pointer-events: none !important;
    }
    body.has-dashboard-video main[data-testid="player-workspace-main"] > [data-testid^="dashboard-"],
    body.has-dashboard-video main[data-testid="player-workspace-main"] > div:not(#nuclear-dashboard-video-container) {
      display: none !important;
    }
  `;
  document.head.appendChild(styleEl);
}

const plugin = {
  async onEnable(api) {
    api.Logger?.info('[DashboardVideo] Enabling Fast Native Video plugin');

    injectStyles();

    try {
      const initialItem = await api.Queue.getCurrentItem();
      if (initialItem) {
        currentVideoId = extractVideoId(initialItem);
      }
      currentPlaybackState = await api.Playback.getState();
      lastKnownSeek = currentPlaybackState?.seek || 0;
    } catch (e) {
      api.Logger?.warn?.('[DashboardVideo] Failed to get initial queue state: ' + e);
    }

    updateDomLayout();
    if (currentVideoId) {
      loadVideoStream(currentVideoId);
      schedulePrefetchNext(api);
    }

    unsubscribers.push(
      api.Queue.subscribeToCurrentItem((item) => {
        const videoId = extractVideoId(item);
        if (videoId && videoId !== currentVideoId) {
          api.Logger?.info?.(`[DashboardVideo] Switching video to ${videoId}`);
          loadVideoStream(videoId);
          schedulePrefetchNext(api);
        }
      })
    );

    unsubscribers.push(
      api.Playback.subscribe((state) => {
        syncPlaybackWithVideo(state);
      })
    );

    document.addEventListener('fullscreenchange', updateFullscreenButtonState);

    const mainEl = document.querySelector('main[data-testid="player-workspace-main"]') || document.body;
    routeObserver = new MutationObserver(() => {
      updateDomLayout();
    });
    routeObserver.observe(mainEl, { childList: true, subtree: false });

    syncTimer = setInterval(() => {
      updateDomLayout();
      if (currentPlaybackState && isDashboardRoute()) {
        syncPlaybackWithVideo(currentPlaybackState);
      }
    }, 1500);

    api.Logger?.info?.('[DashboardVideo] Fast Native Video plugin fully active');
  },

  async onDisable() {
    for (const off of unsubscribers) {
      try { off(); } catch (_) {}
    }
    unsubscribers = [];

    document.removeEventListener('fullscreenchange', updateFullscreenButtonState);

    if (activeFetchController) {
      activeFetchController.abort();
      activeFetchController = null;
    }

    if (routeObserver) {
      routeObserver.disconnect();
      routeObserver = null;
    }

    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
    }

    if (containerEl && containerEl.parentNode) {
      containerEl.parentNode.removeChild(containerEl);
    }
    containerEl = null;
    videoEl = null;
    loadingEl = null;
    fullscreenBtnEl = null;
    currentVideoId = null;
    currentPlaybackState = null;

    if (styleEl && styleEl.parentNode) {
      styleEl.parentNode.removeChild(styleEl);
    }
    styleEl = null;

    document.body.classList.remove('has-dashboard-video');
  }
};

module.exports = plugin;
