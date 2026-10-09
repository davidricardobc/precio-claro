"""Servidor de desarrollo local; solo expone archivos públicos de la demo."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
PUBLIC_FILES = {'/', '/index.html', '/styles.css', '/app.mjs', '/catalog.mjs',
                '/data/precios.csv', '/data/catalog-meta.json'}


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.mjs': 'text/javascript', '.csv': 'text/csv; charset=utf-8'}

    def send_head(self):
        if unquote(urlsplit(self.path).path) not in PUBLIC_FILES:
            self.send_error(404)
            return None
        return super().send_head()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()


if __name__ == '__main__':
    print('PrecioClaro: http://127.0.0.1:8765', flush=True)
    with ThreadingHTTPServer(('127.0.0.1', 8765), partial(Handler, directory=str(ROOT))) as server:
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
