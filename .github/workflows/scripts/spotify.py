```python
import json
import os
import sys
from datetime import datetime, timezone

import requests


CLIENT_ID = os.environ.get("SPOTIFY_CLIENT_ID")
CLIENT_SECRET = os.environ.get("SPOTIFY_CLIENT_SECRET")
REFRESH_TOKEN = os.environ.get("SPOTIFY_REFRESH_TOKEN")

OUTPUT_FILE = "spotify/data.json"

if not CLIENT_ID or not CLIENT_SECRET or not REFRESH_TOKEN:
    print("Erro: configure SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET e SPOTIFY_REFRESH_TOKEN.")
    sys.exit(1)


def get_access_token():
    response = requests.post(
        "https://accounts.spotify.com/api/token",
        data={
            "grant_type": "refresh_token",
            "refresh_token": REFRESH_TOKEN,
        },
        auth=(CLIENT_ID, CLIENT_SECRET),
        timeout=30,
    )

    if response.status_code != 200:
        print("Erro ao renovar o access token:")
        print(response.text)
        sys.exit(1)

    return response.json()["access_token"]


def spotify_get(endpoint, token, params=None):
    response = requests.get(
        f"https://api.spotify.com/v1/{endpoint}",
        headers={
            "Authorization": f"Bearer {token}"
        },
        params=params,
        timeout=30,
    )

    if response.status_code != 200:
        print(f"Erro ao acessar /{endpoint}:")
        print(response.text)
        return None

    return response.json()


def simplify_artist(artist):
    return {
        "id": artist.get("id"),
        "name": artist.get("name"),
        "url": artist.get("external_urls", {}).get("spotify"),
        "image": None,
    }


def simplify_track(track):
    artists = [
        {
            "id": artist.get("id"),
            "name": artist.get("name"),
            "url": artist.get("external_urls", {}).get("spotify"),
        }
        for artist in track.get("artists", [])
    ]

    images = track.get("album", {}).get("images", [])

    return {
        "id": track.get("id"),
        "name": track.get("name"),
        "url": track.get("external_urls", {}).get("spotify"),
        "artists": artists,
        "album": {
            "name": track.get("album", {}).get("name"),
            "image": images[0]["url"] if images else None,
        },
        "duration_ms": track.get("duration_ms"),
    }


def get_top_artists(token):
    data = spotify_get(
        "me/top/artists",
        token,
        {
            "limit": 20,
            "time_range": "medium_term",
        },
    )

    if not data:
        return []

    artists = []

    for artist in data.get("items", []):
        item = simplify_artist(artist)

        images = artist.get("images", [])
        item["image"] = images[0]["url"] if images else None

        artists.append(item)

    return artists


def get_top_tracks(token):
    data = spotify_get(
        "me/top/tracks",
        token,
        {
            "limit": 20,
            "time_range": "medium_term",
        },
    )

    if not data:
        return []

    return [
        simplify_track(track)
        for track in data.get("items", [])
    ]


def get_recently_played(token):
    data = spotify_get(
        "me/player/recently-played",
        token,
        {
            "limit": 50,
        },
    )

    if not data:
        return []

    history = []

    for item in data.get("items", []):
        track = simplify_track(item["track"])

        track["played_at"] = item.get("played_at")

        history.append(track)

    return history


def main():
    print("Obtendo access token...")
    access_token = get_access_token()

    print("Obtendo artistas favoritos...")
    top_artists = get_top_artists(access_token)

    print("Obtendo músicas favoritas...")
    top_tracks = get_top_tracks(access_token)

    print("Obtendo histórico...")
    recently_played = get_recently_played(access_token)

    data = {
        "updated_at": datetime.now(timezone.utc).isoformat(),

        "top_artists": top_artists,

        "top_tracks": top_tracks,

        "recently_played": recently_played,
    }

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as file:
        json.dump(
            data,
            file,
            ensure_ascii=False,
            indent=2,
        )

    print(f"Dados salvos em {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
```
