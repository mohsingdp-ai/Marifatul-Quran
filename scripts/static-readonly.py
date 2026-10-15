"""Read-only static server for showing the app over a tunnel.

GET/HEAD only (POSTs get 501), no hidden paths such as .git, no directory listings.
Usage: python3 static-readonly.py <root> <port>   (binds 127.0.0.1)
"""
import functools
import http.server
import sys


class Handler(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        path = self.path.split("?", 1)[0]
        if any(seg.startswith(".") for seg in path.split("/") if seg):
            self.send_error(404)
            return None
        return super().send_head()

    def list_directory(self, path):
        self.send_error(404)
        return None

    def log_message(self, fmt, *args):
        pass  # quiet: the tunnel's own log says who visited


root, port = sys.argv[1], int(sys.argv[2])
http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(Handler, directory=root)).serve_forever()
