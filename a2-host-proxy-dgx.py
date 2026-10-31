#!/usr/bin/env python3
"""DGX A2 host proxy (scheme B): Basic inject + Origin rewrite + Bearer→X-Butterfly-Session.
Listens loopback; Tailscale Serve :8443 points here → A2 :18887 (stamp 1.4-p0-23c).
"""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import http.client, base64, os, sys

UP_HOST = os.environ.get("A2_UP_HOST", "127.0.0.1")
UP_PORT = int(os.environ.get("A2_UP_PORT", "18887"))
LISTEN_HOST = os.environ.get("A2_PROXY_HOST", "127.0.0.1")
LISTEN_PORT = int(os.environ.get("A2_PROXY_PORT", "18888"))
UP_ORIGIN = f"http://{UP_HOST}:{UP_PORT}"
PW_FILE = os.environ.get(
    "A2_PW_FILE",
    os.path.expanduser("~/apps/butterfly-effect-a2/.runtime/dgx-app-password"),
)
_PW = open(PW_FILE).read().strip()
if len(_PW) < 16:
    sys.stderr.write("password too short in %s\n" % PW_FILE)
    sys.exit(1)
BASIC = "Basic " + base64.b64encode(("owner:" + _PW).encode()).decode()


class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args), flush=True)

    def _proxy(self):
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        conn = http.client.HTTPConnection(UP_HOST, UP_PORT, timeout=600)
        skip = {"host", "content-length", "connection", "transfer-encoding"}
        headers = {k: v for k, v in self.headers.items() if k.lower() not in skip}
        client_auth = headers.get("Authorization") or headers.get("authorization") or ""
        bearer = ""
        if client_auth.lower().startswith("bearer "):
            bearer = client_auth[7:].strip()
        client_session = ""
        for k in list(headers):
            lk = k.lower()
            if lk == "origin":
                headers[k] = UP_ORIGIN
            elif lk == "referer":
                headers[k] = UP_ORIGIN + "/"
            elif lk == "authorization":
                del headers[k]
            elif lk == "x-butterfly-session":
                client_session = (headers.pop(k) or "").strip() or client_session
        headers["Host"] = f"{UP_HOST}:{UP_PORT}"
        headers["Authorization"] = BASIC
        session = bearer or client_session
        if session:
            headers["x-butterfly-session"] = session
        headers["Connection"] = "close"
        try:
            conn.request(self.command, self.path, body=body, headers=headers)
            resp = conn.getresponse()
            data = resp.read()
            self.send_response(resp.status, resp.reason)
            for k, v in resp.getheaders():
                lk = k.lower()
                if lk in ("transfer-encoding", "connection", "content-length", "www-authenticate"):
                    continue
                self.send_header(k, v)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Connection", "close")
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(data)
        finally:
            conn.close()

    def do_GET(self):
        self._proxy()

    def do_POST(self):
        self._proxy()

    def do_PUT(self):
        self._proxy()

    def do_DELETE(self):
        self._proxy()

    def do_PATCH(self):
        self._proxy()

    def do_OPTIONS(self):
        self._proxy()

    def do_HEAD(self):
        self._proxy()


if __name__ == "__main__":
    httpd = ThreadingHTTPServer((LISTEN_HOST, LISTEN_PORT), H)
    print(
        "a2-host-proxy listening on %s:%s → %s (pid %s)"
        % (LISTEN_HOST, LISTEN_PORT, UP_ORIGIN, os.getpid()),
        flush=True,
    )
    httpd.serve_forever()
