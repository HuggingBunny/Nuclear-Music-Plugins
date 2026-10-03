#!/usr/bin/env python3
"""
Nuclear Video Service Daemon
Resolves direct YouTube H.264 video streams via in-process yt-dlp on localhost:9199.
Optimized for instant sub-second resolution, memory caching, and delayed background prefetching.
"""

import sys
import json
import time
import queue
import threading
from urllib.parse import urlparse, parse_qs
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import yt_dlp

PORT = 9199
CACHE = {}  # video_id -> (url, timestamp)
CACHE_TTL = 14400  # 4 hours
RESOLVE_LOCK = threading.Lock()
PREFETCH_QUEUE = queue.Queue()

YDL_OPTS = {
    "format": "bestvideo[vcodec^=avc1][height<=720]/bestvideo[ext=mp4][height<=720]/best[height<=720]",
    "quiet": True,
    "no_warnings": True,
    "skip_download": True,
    "noplaylist": True,
    "extract_flat": False,
}

YDL_INSTANCE = yt_dlp.YoutubeDL(YDL_OPTS)


def resolve_video_stream(video_id: str) -> str:
    now = time.time()
    with RESOLVE_LOCK:
        if video_id in CACHE:
            url, ts = CACHE[video_id]
            if now - ts < CACHE_TTL:
                return url

        try:
            info = YDL_INSTANCE.extract_info(
                f"https://www.youtube.com/watch?v={video_id}",
                download=False
            )
            raw_url = info.get("url")
            if not raw_url and "formats" in info:
                # Fallback to last suitable format
                for f in reversed(info["formats"]):
                    if f.get("vcodec", "").startswith("avc1") or f.get("ext") == "mp4":
                        raw_url = f.get("url")
                        if raw_url:
                            break

            if raw_url:
                stream_url = raw_url if "&range=" in raw_url else f"{raw_url}&range=0-99999999999"
                CACHE[video_id] = (stream_url, now)
                return stream_url
        except Exception as e:
            sys.stderr.write(f"Error resolving {video_id}: {e}\n")

    return ""


def prefetch_worker():
    while True:
        try:
            video_id, target_time = PREFETCH_QUEUE.get()
            now = time.time()
            if target_time > now:
                time.sleep(target_time - now)

            if video_id not in CACHE:
                resolve_video_stream(video_id)
        except Exception as e:
            sys.stderr.write(f"Prefetch error: {e}\n")
        finally:
            PREFETCH_QUEUE.task_done()


class VideoHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS, HEAD")
        self.send_header("Access-Control-Allow-Headers", "*")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)

        if parsed.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
            return

        video_id = qs.get("v", [""])[0].strip()
        if not video_id:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"error":"Missing video id parameter (?v=...)"}')
            return

        if parsed.path == "/prefetch":
            # Schedule prefetch after 2.5s to avoid network contention with current track
            PREFETCH_QUEUE.put((video_id, time.time() + 2.5))
            self.send_response(202)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"queued"}')
            return

        stream_url = resolve_video_stream(video_id)
        if not stream_url:
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"error":"Failed to resolve stream URL"}')
            return

        if parsed.path == "/url":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            response = json.dumps({"id": video_id, "url": stream_url})
            try:
                self.wfile.write(response.encode("utf-8"))
            except BrokenPipeError:
                pass
            return

        if parsed.path == "/video":
            self.send_response(302)
            self.send_header("Location", stream_url)
            self.end_headers()
            return

        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        pass


def main():
    worker_thread = threading.Thread(target=prefetch_worker, daemon=True)
    worker_thread.start()

    server = ThreadingHTTPServer(("127.0.0.1", PORT), VideoHandler)
    sys.stdout.write(f"Nuclear Video Service listening on 127.0.0.1:{PORT}\n")
    sys.stdout.flush()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
