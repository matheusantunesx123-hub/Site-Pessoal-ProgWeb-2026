import json
import subprocess
import sys
from pathlib import Path

from monthly_engine import (
    BRT,
    build_all_monthly_reports,
    merge_plays_into_months,
    parse_iso,
    update_artist_cache,
)

REPO_ROOT = Path(__file__).resolve().parent.parent
PLAYS_DIR = REPO_ROOT / "spotify" / "plays"
MONTHLY_DIR = REPO_ROOT / "spotify" / "monthly"
ARTIST_CACHE_PATH = REPO_ROOT / "spotify" / "artist_cache.json"


def run_git(args):
    result = subprocess.run(
        ["git", "-C", str(REPO_ROOT)] + args,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=True,
    )
    return result.stdout


def main():
    commits_out = run_git(["rev-list", "--reverse", "HEAD", "--", "spotify/data.json"])
    shas = [line.strip() for line in commits_out.splitlines() if line.strip()]
    print(f"Commits encontrados para spotify/data.json: {len(shas)}")

    all_plays = []
    all_artists = []
    historical_snapshots = {}
    valid_commits = 0

    for sha in shas:
        try:
            raw = run_git(["show", f"{sha}:spotify/data.json"])
            data = json.loads(raw)
            if not isinstance(data, dict):
                continue
        except Exception:
            continue

        valid_commits += 1
        top_artists = data.get("top_artists") or []
        top_tracks = data.get("top_tracks") or []
        recent = data.get("recently_played") or []

        if isinstance(top_artists, list):
            all_artists.extend(top_artists)
        if isinstance(recent, list):
            all_plays.extend(recent)

        dt = parse_iso(data.get("updated_at"))
        if dt:
            month_key = dt.astimezone(BRT).strftime("%Y-%m")
            historical_snapshots[month_key] = {
                "captured_at": data.get("updated_at"),
                "top_artists": [
                    {
                        "name": a.get("name"),
                        "image": a.get("image"),
                        "url": a.get("url"),
                    }
                    for a in (top_artists[:5] if isinstance(top_artists, list) else [])
                ],
                "top_tracks": [
                    {
                        "name": t.get("name"),
                        "artist_names": ", ".join(
                            ar.get("name", "") for ar in (t.get("artists") or [])
                        ),
                        "album_image": (t.get("album") or {}).get("image"),
                        "url": t.get("url"),
                    }
                    for t in (top_tracks[:5] if isinstance(top_tracks, list) else [])
                ],
            }

    print(f"Commits válidos processados: {valid_commits}/{len(shas)}")
    artist_cache = update_artist_cache(ARTIST_CACHE_PATH, all_artists)
    print(f"Artistas no cache histórico: {len(artist_cache)}")

    updated_months = merge_plays_into_months(PLAYS_DIR, all_plays)
    print(f"Meses reconstruídos em plays/: {', '.join(updated_months)}")

    index_payload = build_all_monthly_reports(
        PLAYS_DIR,
        MONTHLY_DIR,
        artist_cache,
        historical_top_snapshots=historical_snapshots,
    )

    print("\n=== RESUMO DA MÁQUINA DO TEMPO MENSAL ===")
    for m in reversed(index_payload.get("months", [])):
        print(
            f"{m['month']} ({m['label']}): "
            f"{m['total_plays']} plays | {m['total_minutes']} min | "
            f"{m['unique_artists']} artistas | {m['unique_tracks']} faixas | "
            f"{m['active_days']} dias ativos | Top #1: {m['top_artist']['name']} / {m['top_track']['name']}"
        )

    all_time = index_payload.get("all_time", {})
    print(
        f"\nTOTAL ACUMULADO: {all_time.get('total_plays', 0)} plays | "
        f"{all_time.get('total_minutes', 0)} min ({all_time.get('total_hours', 0)} h) | "
        f"{all_time.get('months_count', 0)} meses"
    )


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as exc:
        print(f"Erro ao rodar git: {exc}", file=sys.stderr)
        sys.exit(1)
