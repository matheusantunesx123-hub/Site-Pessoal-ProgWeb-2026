import calendar
import json
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

BRT = timezone(timedelta(hours=-3))

MONTH_NAMES_PT = {
    1: "Janeiro",
    2: "Fevereiro",
    3: "Março",
    4: "Abril",
    5: "Maio",
    6: "Junho",
    7: "Julho",
    8: "Agosto",
    9: "Setembro",
    10: "Outubro",
    11: "Novembro",
    12: "Dezembro",
}

MONTH_SHORT_PT = {
    1: "JAN",
    2: "FEV",
    3: "MAR",
    4: "ABR",
    5: "MAI",
    6: "JUN",
    7: "JUL",
    8: "AGO",
    9: "SET",
    10: "OUT",
    11: "NOV",
    12: "DEZ",
}

WEEKDAY_KEYS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"]
WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]

PERIOD_META = {
    "madrugada": ("Madrugada", range(0, 6)),
    "manha": ("Manhã", range(6, 12)),
    "tarde": ("Tarde", range(12, 18)),
    "noite": ("Noite", range(18, 24)),
}


def parse_iso(ts):
    if not ts or not isinstance(ts, str):
        return None
    try:
        cleaned = ts.strip()
        if cleaned.endswith("Z"):
            cleaned = cleaned[:-1] + "+00:00"
        dt = datetime.fromisoformat(cleaned)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return None


def hour_to_period(hour):
    for key, (_, hours) in PERIOD_META.items():
        if hour in hours:
            return key
    return "noite"


def load_json_safe(path, default):
    p = Path(path)
    if not p.exists():
        return default
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return default


def save_json(path, data, indent=2):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=indent), encoding="utf-8")


def normalize_play_item(item):
    if not isinstance(item, dict):
        return None
    track_id = item.get("id")
    played_at = item.get("played_at")
    dt = parse_iso(played_at)
    if not track_id or not dt:
        return None

    artists_raw = item.get("artists") or []
    artists = []
    for a in artists_raw:
        if isinstance(a, dict) and a.get("name"):
            artists.append(
                {
                    "id": a.get("id"),
                    "name": a.get("name"),
                    "url": a.get("url"),
                }
            )

    album_raw = item.get("album") or {}
    album = {
        "name": album_raw.get("name") or "Álbum desconhecido",
        "image": album_raw.get("image"),
    }

    try:
        duration_ms = max(0, int(item.get("duration_ms") or 0))
    except (TypeError, ValueError):
        duration_ms = 0

    return {
        "id": track_id,
        "name": item.get("name") or "Faixa sem nome",
        "url": item.get("url"),
        "artists": artists,
        "album": album,
        "duration_ms": duration_ms,
        "played_at": played_at,
    }


def merge_plays_into_months(plays_dir, new_plays):
    plays_dir = Path(plays_dir)
    plays_dir.mkdir(parents=True, exist_ok=True)

    by_month = defaultdict(list)
    for raw in new_plays or []:
        norm = normalize_play_item(raw)
        if not norm:
            continue
        dt_brt = parse_iso(norm["played_at"]).astimezone(BRT)
        month_key = dt_brt.strftime("%Y-%m")
        by_month[month_key].append(norm)

    updated_months = []
    for month_key, items in sorted(by_month.items()):
        month_file = plays_dir / f"{month_key}.json"
        existing = load_json_safe(month_file, [])
        if not isinstance(existing, list):
            existing = []

        dedup = {}
        for entry in existing + items:
            norm = normalize_play_item(entry)
            if not norm:
                continue
            dedup[(norm["played_at"], norm["id"])] = norm

        merged = sorted(
            dedup.values(),
            key=lambda x: (parse_iso(x["played_at"]), x["id"]),
        )
        save_json(month_file, merged, indent=2)
        updated_months.append(month_key)

    return updated_months


def update_artist_cache(cache_path, artists_list):
    cache_path = Path(cache_path)
    cache = load_json_safe(cache_path, {})
    if not isinstance(cache, dict):
        cache = {}

    for artist in artists_list or []:
        if not isinstance(artist, dict):
            continue
        aid = artist.get("id")
        if not aid:
            continue

        prev = cache.get(aid, {})
        image = artist.get("image") or prev.get("image")
        genres = artist.get("genres")
        if not genres:
            genres = prev.get("genres") or []
        popularity = artist.get("popularity")
        if popularity is None:
            popularity = prev.get("popularity")

        cache[aid] = {
            "id": aid,
            "name": artist.get("name") or prev.get("name") or "Artista",
            "url": artist.get("url") or prev.get("url"),
            "image": image,
            "genres": list(dict.fromkeys(genres)),
            "popularity": popularity,
        }

    save_json(cache_path, cache, indent=2)
    return cache


def compute_rank_delta(current_rank, prev_rank):
    if prev_rank is None:
        return "new"
    diff = prev_rank - current_rank
    if diff == 0:
        return "same"
    return f"+{diff}" if diff > 0 else str(diff)


def build_personality(dominant_period, peak_hour, repeat_ratio, unique_artists, total_plays):
    period_label = PERIOD_META.get(dominant_period, ("Noite",))[0]
    if repeat_ratio >= 2.2:
        tag = "Viciado no Repeat"
        subtitle = (
            f"Média de {repeat_ratio:.2f} reproduções por faixa — quando uma música pega, "
            f"ela domina sua rotação, especialmente no período da {period_label.lower()}."
        )
    elif dominant_period == "madrugada":
        tag = "Trilha da Madrugada"
        subtitle = (
            f"Pico às {peak_hour:02d}h no horário de Brasília, embalado por {unique_artists} "
            f"artistas distintos ao longo de {total_plays} reproduções."
        )
    elif dominant_period == "noite":
        tag = "Coruja Noturna"
        subtitle = (
            f"Suas sessões ganham força à noite (pico às {peak_hour:02d}h), equilibrando "
            f"{unique_artists} artistas em {total_plays} execuções."
        )
    elif dominant_period == "manha":
        tag = "Ritmo Matinal"
        subtitle = (
            f"A trilha sonora começa cedo, com pico às {peak_hour:02d}h e presença de "
            f"{unique_artists} artistas no mês."
        )
    elif repeat_ratio <= 1.25 and unique_artists >= 25:
        tag = "Explorador Sonoro"
        subtitle = (
            f"Alta variedade: {unique_artists} artistas diferentes em {total_plays} plays, "
            f"com média de {repeat_ratio:.2f}x por faixa."
        )
    else:
        tag = "Sintonia da Tarde"
        subtitle = (
            f"Maior volume de audição à tarde (pico às {peak_hour:02d}h), somando "
            f"{total_plays} reproduções de {unique_artists} artistas."
        )
    return tag, subtitle


def longest_consecutive_streak(days_set):
    if not days_set:
        return 0
    sorted_days = sorted(days_set)
    best = 1
    current = 1
    for i in range(1, len(sorted_days)):
        if sorted_days[i] == sorted_days[i - 1] + 1:
            current += 1
            if current > best:
                best = current
        else:
            current = 1
    return best


def pct_diff(curr, prev):
    if not prev:
        return None
    return round(((curr - prev) / prev) * 100.0, 1)


def format_genre_label(genre):
    words = str(genre).strip().split()
    if not words:
        return ""
    small = {"de", "da", "do", "e", "and", "of"}
    out = []
    for idx, w in enumerate(words):
        lw = w.lower()
        if lw in {"mpb", "edm", "r&b", "uk"}:
            out.append(lw.upper())
        elif idx > 0 and lw in small:
            out.append(lw)
        else:
            out.append(w.capitalize())
    return " ".join(out)


def build_all_monthly_reports(
    plays_dir,
    monthly_dir,
    artist_cache,
    current_short_term=None,
    historical_top_snapshots=None,
):
    plays_dir = Path(plays_dir)
    monthly_dir = Path(monthly_dir)
    monthly_dir.mkdir(parents=True, exist_ok=True)
    artist_cache = artist_cache or {}
    historical_top_snapshots = historical_top_snapshots or {}

    month_files = sorted(
        [p for p in plays_dir.glob("????-??.json") if p.is_file()],
        key=lambda p: p.stem,
    )

    if not month_files:
        index_payload = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "default_month": None,
            "all_time": {
                "total_plays": 0,
                "total_minutes": 0,
                "total_hours": 0.0,
                "unique_artists": 0,
                "unique_tracks": 0,
                "months_count": 0,
                "first_month": None,
                "last_month": None,
            },
            "months": [],
        }
        save_json(monthly_dir / "index.json", index_payload, indent=2)
        return index_payload

    latest_month_key = month_files[-1].stem
    seen_artists_before = set()
    prev_summary = None
    prev_month_info = None
    prev_track_ranks = {}
    prev_artist_ranks = {}

    all_time_plays = 0
    all_time_ms = 0
    all_time_artists = set()
    all_time_tracks = set()
    index_months = []

    for month_idx, month_file in enumerate(month_files):
        month_key = month_file.stem
        plays_raw = load_json_safe(month_file, [])
        plays = [p for p in (normalize_play_item(x) for x in plays_raw) if p]
        if not plays:
            continue

        year, month_num = map(int, month_key.split("-"))
        days_in_month = calendar.monthrange(year, month_num)[1]
        label = f"{MONTH_NAMES_PT.get(month_num, str(month_num))} {year}"
        short_label = f"{MONTH_SHORT_PT.get(month_num, str(month_num))} {year}"

        existing_report = load_json_safe(monthly_dir / f"{month_key}.json", {})
        if not isinstance(existing_report, dict):
            existing_report = {}

        total_plays = len(plays)
        total_ms = 0
        hourly = [0] * 24
        weekday_counts = [0] * 7
        weekday_ms = [0] * 7
        period_counts = Counter()
        daily_data = {
            d: {"plays": 0, "ms": 0, "tracks": Counter()}
            for d in range(1, days_in_month + 1)
        }

        track_agg = {}
        artist_agg = {}
        album_agg = {}
        artist_album_fallback_img = defaultdict(Counter)
        month_artist_ids = set()

        first_play_brt = None
        last_play_brt = None

        for p in plays:
            dt_brt = parse_iso(p["played_at"]).astimezone(BRT)
            if first_play_brt is None or dt_brt < first_play_brt:
                first_play_brt = dt_brt
            if last_play_brt is None or dt_brt > last_play_brt:
                last_play_brt = dt_brt

            dur = p["duration_ms"]
            total_ms += dur
            hour = dt_brt.hour
            wday = dt_brt.weekday()
            day = dt_brt.day
            date_str = dt_brt.strftime("%Y-%m-%d")

            hourly[hour] += 1
            weekday_counts[wday] += 1
            weekday_ms[wday] += dur
            period_counts[hour_to_period(hour)] += 1

            d_slot = daily_data[day]
            d_slot["plays"] += 1
            d_slot["ms"] += dur
            d_slot["tracks"][p["name"]] += 1

            tid = p["id"]
            all_time_tracks.add(tid)
            if tid not in track_agg:
                track_agg[tid] = {
                    "id": tid,
                    "name": p["name"],
                    "url": p.get("url"),
                    "artists": p["artists"],
                    "album": p["album"],
                    "duration_ms": dur,
                    "plays": 0,
                    "total_ms": 0,
                    "day_counts": Counter(),
                }
            t_rec = track_agg[tid]
            t_rec["plays"] += 1
            t_rec["total_ms"] += dur
            t_rec["day_counts"][date_str] += 1
            if not t_rec["album"].get("image") and p["album"].get("image"):
                t_rec["album"]["image"] = p["album"]["image"]

            album_img = p["album"].get("image")
            primary_artist = p["artists"][0]["name"] if p["artists"] else "Artista desconhecido"
            album_key = (p["album"]["name"], primary_artist)
            if album_key not in album_agg:
                album_agg[album_key] = {
                    "name": p["album"]["name"],
                    "artist_name": primary_artist,
                    "image": album_img,
                    "plays": 0,
                    "total_ms": 0,
                    "tracks": set(),
                }
            al_rec = album_agg[album_key]
            al_rec["plays"] += 1
            al_rec["total_ms"] += dur
            al_rec["tracks"].add(tid)
            if not al_rec["image"] and album_img:
                al_rec["image"] = album_img

            for art in p["artists"]:
                aid = art.get("id") or f"name:{art['name']}"
                month_artist_ids.add(aid)
                all_time_artists.add(aid)
                if aid not in artist_agg:
                    artist_agg[aid] = {
                        "id": art.get("id") or aid,
                        "key": aid,
                        "name": art["name"],
                        "url": art.get("url"),
                        "plays": 0,
                        "total_ms": 0,
                        "tracks": set(),
                        "track_counts": Counter(),
                    }
                ar_rec = artist_agg[aid]
                ar_rec["plays"] += 1
                ar_rec["total_ms"] += dur
                ar_rec["tracks"].add(tid)
                ar_rec["track_counts"][p["name"]] += 1
                if album_img:
                    artist_album_fallback_img[aid][album_img] += 1

        all_time_plays += total_plays
        all_time_ms += total_ms

        total_minutes = round(total_ms / 60000)
        total_hours = round(total_ms / 3600000, 1)
        unique_tracks = len(track_agg)
        unique_artists = len(artist_agg)
        unique_albums = len(album_agg)

        active_day_nums = {d for d, info in daily_data.items() if info["plays"] > 0}
        active_days = len(active_day_nums)
        streak_days = longest_consecutive_streak(active_day_nums)
        avg_min_active = round((total_ms / 60000) / active_days, 1) if active_days else 0.0

        # Peak day
        peak_day_num = max(
            active_day_nums,
            key=lambda d: (daily_data[d]["plays"], daily_data[d]["ms"]),
        )
        peak_dt = datetime(year, month_num, peak_day_num)
        peak_top_track = (
            daily_data[peak_day_num]["tracks"].most_common(1)[0][0]
            if daily_data[peak_day_num]["tracks"]
            else None
        )
        peak_day = {
            "date": peak_dt.strftime("%Y-%m-%d"),
            "day": peak_day_num,
            "weekday_label": WEEKDAY_LABELS[peak_dt.weekday()],
            "plays": daily_data[peak_day_num]["plays"],
            "minutes": round(daily_data[peak_day_num]["ms"] / 60000),
            "top_track": peak_top_track,
        }

        # Peak hour & periods
        peak_hour_idx = max(range(24), key=lambda h: hourly[h])
        peak_hour_period_key = hour_to_period(peak_hour_idx)
        peak_hour = {
            "hour": peak_hour_idx,
            "label": f"{peak_hour_idx:02d}h",
            "period": PERIOD_META[peak_hour_period_key][0],
            "plays": hourly[peak_hour_idx],
        }

        periods = {}
        for pkey, (plabel, _) in PERIOD_META.items():
            cnt = period_counts.get(pkey, 0)
            periods[pkey] = {
                "label": plabel,
                "plays": cnt,
                "pct": round((cnt / total_plays) * 100, 1) if total_plays else 0.0,
            }
        dominant_period = max(PERIOD_META.keys(), key=lambda k: period_counts.get(k, 0))

        repeat_ratio = round(total_plays / max(unique_tracks, 1), 2)
        personality_tag, personality_subtitle = build_personality(
            dominant_period, peak_hour_idx, repeat_ratio, unique_artists, total_plays
        )

        # Top Tracks (top 20)
        sorted_tracks = sorted(
            track_agg.values(),
            key=lambda x: (-x["plays"], -x["total_ms"], x["name"].lower()),
        )
        curr_track_ranks = {t["id"]: i + 1 for i, t in enumerate(sorted_tracks)}
        top_tracks = []
        for idx, t in enumerate(sorted_tracks[:20]):
            rank = idx + 1
            prev_r = prev_track_ranks.get(t["id"])
            artist_names = ", ".join(a["name"] for a in t["artists"]) or "Artista desconhecido"
            top_tracks.append(
                {
                    "rank": rank,
                    "prev_rank": prev_r,
                    "rank_delta": compute_rank_delta(rank, prev_r),
                    "id": t["id"],
                    "name": t["name"],
                    "url": t["url"],
                    "artists": t["artists"],
                    "artist_names": artist_names,
                    "album": t["album"],
                    "duration_ms": t["duration_ms"],
                    "plays": t["plays"],
                    "minutes": round(t["total_ms"] / 60000),
                    "share_pct": round((t["plays"] / total_plays) * 100, 1) if total_plays else 0.0,
                }
            )

        # Top Artists (top 20)
        sorted_artists = sorted(
            artist_agg.values(),
            key=lambda x: (-x["plays"], -x["total_ms"], x["name"].lower()),
        )
        curr_artist_ranks = {a["key"]: i + 1 for i, a in enumerate(sorted_artists)}
        top_artists = []
        for idx, a in enumerate(sorted_artists[:20]):
            rank = idx + 1
            prev_r = prev_artist_ranks.get(a["key"])
            cached = artist_cache.get(a["id"], {})
            image = cached.get("image")
            if not image and artist_album_fallback_img.get(a["key"]):
                image = artist_album_fallback_img[a["key"]].most_common(1)[0][0]
            genres = cached.get("genres") or []
            top_track_name = (
                a["track_counts"].most_common(1)[0][0] if a["track_counts"] else None
            )
            top_artists.append(
                {
                    "rank": rank,
                    "prev_rank": prev_r,
                    "rank_delta": compute_rank_delta(rank, prev_r),
                    "id": a["id"],
                    "name": a["name"],
                    "url": a["url"],
                    "image": image,
                    "genres": genres,
                    "plays": a["plays"],
                    "minutes": round(a["total_ms"] / 60000),
                    "unique_tracks": len(a["tracks"]),
                    "share_pct": round((a["plays"] / total_plays) * 100, 1) if total_plays else 0.0,
                    "top_track_name": top_track_name,
                }
            )

        # Top Albums (top 10)
        sorted_albums = sorted(
            album_agg.values(),
            key=lambda x: (-x["plays"], -x["total_ms"], x["name"].lower()),
        )
        top_albums = [
            {
                "rank": idx + 1,
                "name": al["name"],
                "artist_name": al["artist_name"],
                "image": al["image"],
                "plays": al["plays"],
                "minutes": round(al["total_ms"] / 60000),
                "unique_tracks": len(al["tracks"]),
            }
            for idx, al in enumerate(sorted_albums[:10])
        ]

        # Obsession (#1 track)
        top1 = sorted_tracks[0]
        max_day_date, max_day_plays = top1["day_counts"].most_common(1)[0]
        obsession = {
            "id": top1["id"],
            "name": top1["name"],
            "artist_names": ", ".join(a["name"] for a in top1["artists"]) or "Artista",
            "album_name": top1["album"].get("name"),
            "album_image": top1["album"].get("image"),
            "url": top1.get("url"),
            "plays": top1["plays"],
            "minutes": round(top1["total_ms"] / 60000),
            "max_day_date": max_day_date,
            "max_day_plays": max_day_plays,
        }

        # New discoveries (artists not seen in previous months)
        new_discoveries = []
        if month_idx > 0:
            for a in sorted_artists:
                if a["key"] not in seen_artists_before:
                    cached = artist_cache.get(a["id"], {})
                    image = cached.get("image")
                    if not image and artist_album_fallback_img.get(a["key"]):
                        image = artist_album_fallback_img[a["key"]].most_common(1)[0][0]
                    new_discoveries.append(
                        {
                            "id": a["id"],
                            "name": a["name"],
                            "image": image,
                            "plays": a["plays"],
                            "minutes": round(a["total_ms"] / 60000),
                            "url": a["url"],
                        }
                    )
                    if len(new_discoveries) >= 8:
                        break
            new_artists_count = sum(1 for k in month_artist_ids if k not in seen_artists_before)
        else:
            new_artists_count = unique_artists

        # Top Genres weighted by plays
        genre_weights = Counter()
        for a in sorted_artists:
            cached = artist_cache.get(a["id"], {})
            for g in cached.get("genres") or []:
                g_norm = str(g).strip().lower()
                if g_norm:
                    genre_weights[g_norm] += a["plays"]

        total_genre_weight = sum(genre_weights.values())
        top_genres = [
            {
                "genre": g,
                "label": format_genre_label(g),
                "weight": w,
                "pct": round((w / total_genre_weight) * 100, 1) if total_genre_weight else 0.0,
            }
            for g, w in genre_weights.most_common(8)
        ]

        # Weekday distribution
        weekday_distribution = [
            {
                "key": WEEKDAY_KEYS[i],
                "label": WEEKDAY_LABELS[i],
                "plays": weekday_counts[i],
                "minutes": round(weekday_ms[i] / 60000),
            }
            for i in range(7)
        ]

        # Daily calendar 1..days_in_month
        daily_calendar = []
        for day_num in range(1, days_in_month + 1):
            dt_day = datetime(year, month_num, day_num)
            slot = daily_data[day_num]
            top_tr = slot["tracks"].most_common(1)[0][0] if slot["tracks"] else None
            daily_calendar.append(
                {
                    "date": dt_day.strftime("%Y-%m-%d"),
                    "day": day_num,
                    "weekday": dt_day.weekday(),
                    "weekday_label": WEEKDAY_LABELS[dt_day.weekday()],
                    "plays": slot["plays"],
                    "minutes": round(slot["ms"] / 60000),
                    "top_track": top_tr,
                }
            )

        # Delta vs prev month
        delta_vs_prev = None
        if prev_summary and prev_month_info:
            delta_vs_prev = {
                "prev_month": prev_month_info["month"],
                "prev_label": prev_month_info["label"],
                "plays_diff": total_plays - prev_summary["total_plays"],
                "plays_pct": pct_diff(total_plays, prev_summary["total_plays"]),
                "minutes_diff": total_minutes - prev_summary["total_minutes"],
                "minutes_pct": pct_diff(total_minutes, prev_summary["total_minutes"]),
                "new_artists_count": new_artists_count,
            }

        # Preserve or attach spotify_short_term and medium_term snapshot
        short_term_block = None
        if month_key == latest_month_key and current_short_term:
            short_term_block = current_short_term
        elif existing_report.get("spotify_short_term"):
            short_term_block = existing_report["spotify_short_term"]

        medium_snap = historical_top_snapshots.get(month_key) or existing_report.get(
            "spotify_medium_term_snapshot"
        )

        summary_obj = {
            "total_plays": total_plays,
            "total_ms": total_ms,
            "total_minutes": total_minutes,
            "total_hours": total_hours,
            "unique_tracks": unique_tracks,
            "unique_artists": unique_artists,
            "unique_albums": unique_albums,
            "active_days": active_days,
            "longest_streak_days": streak_days,
            "avg_minutes_per_active_day": avg_min_active,
            "peak_day": peak_day,
            "peak_hour": peak_hour,
            "periods": periods,
            "dominant_period": dominant_period,
            "repeat_ratio": repeat_ratio,
            "personality_tag": personality_tag,
            "personality_subtitle": personality_subtitle,
            "delta_vs_prev": delta_vs_prev,
        }

        report = {
            "month": month_key,
            "year": year,
            "month_number": month_num,
            "label": label,
            "short_label": short_label,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "is_current_month": month_key == latest_month_key,
            "coverage": {
                "first_play_brt": first_play_brt.isoformat() if first_play_brt else None,
                "last_play_brt": last_play_brt.isoformat() if last_play_brt else None,
                "days_in_month": days_in_month,
                "active_days": active_days,
            },
            "summary": summary_obj,
            "top_tracks": top_tracks,
            "top_artists": top_artists,
            "top_albums": top_albums,
            "obsession": obsession,
            "new_discoveries": new_discoveries,
            "top_genres": top_genres,
            "hourly_distribution": hourly,
            "weekday_distribution": weekday_distribution,
            "daily_calendar": daily_calendar,
            "spotify_short_term": short_term_block,
            "spotify_medium_term_snapshot": medium_snap,
        }

        save_json(monthly_dir / f"{month_key}.json", report, indent=2)

        top_artist_head = top_artists[0] if top_artists else {}
        top_track_head = top_tracks[0] if top_tracks else {}
        index_months.append(
            {
                "month": month_key,
                "label": label,
                "short_label": short_label,
                "is_current_month": month_key == latest_month_key,
                "total_plays": total_plays,
                "total_minutes": total_minutes,
                "total_hours": total_hours,
                "unique_artists": unique_artists,
                "unique_tracks": unique_tracks,
                "active_days": active_days,
                "dominant_period": dominant_period,
                "personality_tag": personality_tag,
                "top_artist": {
                    "name": top_artist_head.get("name"),
                    "image": top_artist_head.get("image"),
                    "plays": top_artist_head.get("plays", 0),
                },
                "top_track": {
                    "name": top_track_head.get("name"),
                    "artist_names": top_track_head.get("artist_names"),
                    "album_image": (top_track_head.get("album") or {}).get("image"),
                    "plays": top_track_head.get("plays", 0),
                },
                "has_short_term": bool(short_term_block),
            }
        )

        seen_artists_before.update(month_artist_ids)
        prev_summary = summary_obj
        prev_month_info = {"month": month_key, "label": label}
        prev_track_ranks = curr_track_ranks
        prev_artist_ranks = curr_artist_ranks

    index_months_desc = list(reversed(index_months))
    index_payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "default_month": index_months_desc[0]["month"] if index_months_desc else None,
        "all_time": {
            "total_plays": all_time_plays,
            "total_minutes": round(all_time_ms / 60000),
            "total_hours": round(all_time_ms / 3600000, 1),
            "unique_artists": len(all_time_artists),
            "unique_tracks": len(all_time_tracks),
            "months_count": len(index_months_desc),
            "first_month": index_months[0]["month"] if index_months else None,
            "last_month": index_months[-1]["month"] if index_months else None,
        },
        "months": index_months_desc,
    }
    save_json(monthly_dir / "index.json", index_payload, indent=2)
    return index_payload
