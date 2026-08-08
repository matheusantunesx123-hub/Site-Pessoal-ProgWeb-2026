```python
import base64
import http.server
import urllib.parse
import webbrowser

import requests


CLIENT_ID = "COLE_SEU_CLIENT_ID_AQUI"
CLIENT_SECRET = "COLE_SEU_CLIENT_SECRET_AQUI"

REDIRECT_URI = "http://127.0.0.1:8888/callback"

SCOPES = "user-top-read user-read-recently-played"

authorization_code = None


class CallbackHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        global authorization_code

        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)

        if "code" in params:
            authorization_code = params["code"][0]

            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()

            self.wfile.write(
                """
                <html>
                    <body>
                        <h1>Spotify autorizado!</h1>
                        <p>Você pode fechar esta janela.</p>
                    </body>
                </html>
                """.encode("utf-8")
            )
        else:
            self.send_response(400)
            self.end_headers()

    def log_message(self, format, *args):
        pass


auth_url = (
    "https://accounts.spotify.com/authorize?"
    + urllib.parse.urlencode(
        {
            "client_id": CLIENT_ID,
            "response_type": "code",
            "redirect_uri": REDIRECT_URI,
            "scope": SCOPES,
        }
    )
)

print("Abrindo o Spotify...")
webbrowser.open(auth_url)

server = http.server.HTTPServer(
    ("127.0.0.1", 8888),
    CallbackHandler
)

print("Aguardando autorização...")
while authorization_code is None:
    server.handle_request()


credentials = f"{CLIENT_ID}:{CLIENT_SECRET}"
encoded_credentials = base64.b64encode(
    credentials.encode()
).decode()


response = requests.post(
    "https://accounts.spotify.com/api/token",
    headers={
        "Authorization": f"Basic {encoded_credentials}",
        "Content-Type": "application/x-www-form-urlencoded",
    },
    data={
        "grant_type": "authorization_code",
        "code": authorization_code,
        "redirect_uri": REDIRECT_URI,
    },
)

if response.status_code != 200:
    print("Erro ao obter o token:")
    print(response.text)
    raise SystemExit(1)


tokens = response.json()

print()
print("=" * 60)
print("REFRESH TOKEN:")
print()
print(tokens["refresh_token"])
print()
print("=" * 60)
print()
print("Guarde esse valor. Ele será colocado no GitHub Secret.")
```
