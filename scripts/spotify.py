import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from monthly_engine import (  # noqa: E402
    build_all_monthly_reports,
    load_json_safe,
    merge_plays_into_months,
    update_artist_cache,
)

CLIENT_ID = os.environ.get("SPOTIFY_CLIENT_ID")
CLIENT_SECRET = os.environ.get("SPOTIFY_CLIENT_SECRET")
REFRESH_TOKEN = os.environ.get("SPOTIFY_REFRESH_TOKEN")

OUTPUT_FILE = REPO_ROOT / "spotify" / "data.json"
PLAYS_DIR = REPO_ROOT / "spotify" / "plays"
MONTHLY_DIR = REPO_ROOT / "spotify" / "monthly"
ARTIST_CACHE_PATH = REPO_ROOT / "spotify" / "artist_cache.json"

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


def spotify_get(endpoint, token, params=None, silent=False):
    try:
        response = requests.get(
            f"https://api.spotify.com/v1/{endpoint}",
            headers={"Authorization": f"Bearer {token}"},
            params=params,
            timeout=30,
        )
    except Exception as exc:
        if not silent:
            print(f"Falha de rede ao acessar /{endpoint}: {exc}")
        return None

    if response.status_code != 200:
        if not silent:
            print(f"Aviso ao acessar /{endpoint} ({response.status_code}):")
            print(response.text[:300])
        return None

    return response.json()


def simplify_artist(artist, include_meta=False):
    images = artist.get("images") or []
    base = {
        "id": artist.get("id"),
        "name": artist.get("name"),
        "url": (artist.get("external_urls") or {}).get("spotify"),
        "image": images[0]["url"] if images else None,
    }
    if include_meta:
        base["genres"] = artist.get("genres") or []
        base["popularity"] = artist.get("popularity")
    return base


def simplify_track(track):
    artists = [
        {
            "id": artist.get("id"),
            "name": artist.get("name"),
            "url": (artist.get("external_urls") or {}).get("spotify"),
        }
        for artist in track.get("artists", [])
    ]

    images = (track.get("album") or {}).get("images", [])

    return {
        "id": track.get("id"),
        "name": track.get("name"),
        "url": (track.get("external_urls") or {}).get("spotify"),
        "artists": artists,
        "album": {
            "name": (track.get("album") or {}).get("name"),
            "image": images[0]["url"] if images else None,
        },
        "duration_ms": track.get("duration_ms"),
    }


def get_top_artists(token, time_range="medium_term", limit=20, include_meta=False):
    data = spotify_get(
        "me/top/artists",
        token,
        {"limit": limit, "time_range": time_range},
        silent=(time_range != "medium_term"),
    )
    if not data:
        return []
    return [
        simplify_artist(artist, include_meta=include_meta)
        for artist in data.get("items", [])
    ]


def get_top_tracks(token, time_range="medium_term", limit=20):
    data = spotify_get(
        "me/top/tracks",
        token,
        {"limit": limit, "time_range": time_range},
        silent=(time_range != "medium_term"),
    )
    if not data:
        return []
    return [simplify_track(track) for track in data.get("items", [])]


def get_recently_played(token):
    data = spotify_get("me/player/recently-played", token, {"limit": 50})
    if not data:
        return []

    history = []
    for item in data.get("items", []):
        if not item.get("track"):
            continue
        track = simplify_track(item["track"])
        track["played_at"] = item.get("played_at")
        history.append(track)
    return history


def collect_missing_artist_ids(artist_cache):
    priority_ids = []
    seen = set()

    for mfile in sorted(MONTHLY_DIR.glob("????-??.json"), reverse=True):
        report = load_json_safe(mfile, {})
        for art in report.get("top_artists", [])[:20]:
            aid = art.get("id")
            if not aid or str(aid).startswith("name:") or aid in seen:
                continue
            cached = artist_cache.get(aid, {})
            if not cached.get("image") or not cached.get("genres"):
                seen.add(aid)
                priority_ids.append(aid)

    for aid, cached in artist_cache.items():
        if not aid or str(aid).startswith("name:") or aid in seen:
            continue
        if not cached.get("image") or not cached.get("genres"):
            seen.add(aid)
            priority_ids.append(aid)

    return priority_ids


def enrich_artists_from_api(token, artist_cache):
    missing_ids = collect_missing_artist_ids(artist_cache)
    if not missing_ids:
        return []

    enriched = []
    batch_failed = False
    for i in range(0, min(len(missing_ids), 100), 50):
        chunk = missing_ids[i : i + 50]
        try:
            data = spotify_get("artists", token, {"ids": ",".join(chunk)}, silent=True)
            if data and isinstance(data.get("artists"), list):
                for art in data["artists"]:
                    if art and art.get("id"):
                        enriched.append(simplify_artist(art, include_meta=True))
            else:
                batch_failed = True
                break
        except Exception:
            batch_failed = True
            break

    if batch_failed:
        for aid in missing_ids[:20]:
            try:
                art = spotify_get(f"artists/{aid}", token, silent=True)
                if art and art.get("id"):
                    enriched.append(simplify_artist(art, include_meta=True))
            except Exception:
                continue

    return enriched


def main():
    print("Obtendo access token...")
    access_token = get_access_token()
    now_iso = datetime.now(timezone.utc).isoformat()

    print("Obtendo artistas favoritos (short/medium/long term)...")
    top_artists_medium_meta = get_top_artists(
        access_token, time_range="medium_term", limit=50, include_meta=True
    )
    top_artists_short_meta = get_top_artists(
        access_token, time_range="short_term", limit=50, include_meta=True
    )
    top_artists_long_meta = get_top_artists(
        access_token, time_range="long_term", limit=50, include_meta=True
    )

    # Mantém retrocompatibilidade exata do spotify/data.json (20 artistas medium_term sem campos extras)
    top_artists = [
        {
            "id": a.get("id"),
            "name": a.get("name"),
            "url": a.get("url"),
            "image": a.get("image"),
        }
        for a in top_artists_medium_meta[:20]
    ]

    print("Obtendo músicas favoritas (medium e short term)...")
    top_tracks = get_top_tracks(access_token, time_range="medium_term", limit=20)
    top_tracks_short = get_top_tracks(access_token, time_range="short_term", limit=50)

    print("Obtendo histórico recente...")
    recently_played = get_recently_played(access_token)

    data = {
        "updated_at": now_iso,
        "top_artists": top_artists,
        "top_tracks": top_tracks,
        "recently_played": recently_played,
    }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
    print(f"Dados salvos em {OUTPUT_FILE}")

    # Atualiza cache de artistas e arquivo mensal da Máquina do Tempo
    all_artists_meta = top_artists_medium_meta + top_artists_short_meta + top_artists_long_meta
    artist_cache = update_artist_cache(ARTIST_CACHE_PATH, all_artists_meta)

    try:
        extra_artists = enrich_artists_from_api(access_token, artist_cache)
        if extra_artists:
            artist_cache = update_artist_cache(ARTIST_CACHE_PATH, extra_artists)
            print(f"Cache enriquecido com {len(extra_artists)} artista(s).")
    except Exception as exc:
        print(f"Aviso ao enriquecer artistas extras: {exc}")

    updated_months = merge_plays_into_months(PLAYS_DIR, recently_played)
    print(f"Meses atualizados em plays/: {', '.join(updated_months) or 'nenhum'}")

    short_term_payload = None
    if top_artists_short_meta or top_tracks_short:
        short_term_payload = {
            "captured_at": now_iso,
            "top_artists": [
                {
                    "rank": idx + 1,
                    "id": a.get("id"),
                    "name": a.get("name"),
                    "url": a.get("url"),
                    "image": a.get("image"),
                    "genres": a.get("genres") or [],
                }
                for idx, a in enumerate(top_artists_short_meta[:20])
            ],
            "top_tracks": [
                {
                    "rank": idx + 1,
                    "id": t.get("id"),
                    "name": t.get("name"),
                    "url": t.get("url"),
                    "artists": t.get("artists") or [],
                    "artist_names": ", ".join(
                        ar.get("name", "") for ar in (t.get("artists") or [])
                    ),
                    "album": t.get("album") or {},
                    "duration_ms": t.get("duration_ms") or 0,
                }
                for idx, t in enumerate(top_tracks_short[:20])
            ],
        }

    index_payload = build_all_monthly_reports(
        PLAYS_DIR,
        MONTHLY_DIR,
        artist_cache,
        current_short_term=short_term_payload,
    )
    print(
        f"Relatórios mensais gerados: {len(index_payload.get('months', []))} meses "
        f"(padrão: {index_payload.get('default_month')})"
    )


if __name__ == "__main__":
    main()
