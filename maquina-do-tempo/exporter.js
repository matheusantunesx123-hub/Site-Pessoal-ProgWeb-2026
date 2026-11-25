(function (global) {
  "use strict";

  const THEMES = {
    prensa: {
      id: "prensa",
      name: "Prensa Noturna",
      bg: "#0D0F0E",
      bgGlow: "rgba(30, 215, 96, 0.14)",
      bgGlow2: "rgba(232, 155, 60, 0.10)",
      surface: "#151917",
      surface2: "#1D2320",
      ink: "#F4F1EA",
      muted: "#A6ADA8",
      accent: "#1ED760",
      accent2: "#E89B3C",
      accentInk: "#071A0E",
      border: "rgba(244, 241, 234, 0.14)"
    },
    vinil: {
      id: "vinil",
      name: "Vinil Quente",
      bg: "#1B120E",
      bgGlow: "rgba(231, 111, 81, 0.16)",
      bgGlow2: "rgba(244, 162, 97, 0.12)",
      surface: "#261914",
      surface2: "#32221B",
      ink: "#FAF3E8",
      muted: "#D4B9A6",
      accent: "#E76F51",
      accent2: "#F4A261",
      accentInk: "#1B0D08",
      border: "rgba(250, 243, 232, 0.16)"
    },
    cartaz: {
      id: "cartaz",
      name: "Cartaz Editorial",
      bg: "#F4EFE4",
      bgGlow: "rgba(21, 128, 61, 0.08)",
      bgGlow2: "rgba(180, 83, 9, 0.07)",
      surface: "#EAE2D0",
      surface2: "#DFD5BD",
      ink: "#141916",
      muted: "#545F58",
      accent: "#15803D",
      accent2: "#B45309",
      accentInk: "#FAF8F3",
      border: "rgba(20, 25, 22, 0.15)"
    }
  };

  const imageCache = new Map();

  function formatNumber(n) {
    return Number(n || 0).toLocaleString("pt-BR");
  }

  function loadImageSafe(url) {
    if (!url) return Promise.resolve(null);
    if (imageCache.has(url)) {
      return imageCache.get(url);
    }

    const promise = new Promise((resolve) => {
      const img = new Image();
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(null);
        }
      }, 6500);

      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(img);
        }
      };
      img.onerror = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(null);
        }
      };
      img.src = url;
    });

    imageCache.set(url, promise);
    return promise;
  }

  async function ensureFontsReady() {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function fillRoundRect(ctx, x, y, w, h, r, fillStyle, strokeStyle) {
    roundRectPath(ctx, x, y, w, h, r);
    if (fillStyle) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
    if (strokeStyle) {
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function drawCoverOrMonogram(ctx, img, x, y, w, h, radius, label, theme, isCircle) {
    ctx.save();
    if (isCircle) {
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
      ctx.closePath();
    } else {
      roundRectPath(ctx, x, y, w, h, radius);
    }
    ctx.clip();

    if (img && img.width > 0 && img.height > 0) {
      const scale = Math.max(w / img.width, h / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      const dx = x + (w - dw) / 2;
      const dy = y + (h - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = theme.surface2;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) * 0.34, 0, Math.PI * 2);
      ctx.stroke();

      const initials = (label || "S")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0] || "")
        .join("")
        .toUpperCase();
      ctx.fillStyle = theme.ink;
      ctx.font = `700 ${Math.max(18, Math.round(Math.min(w, h) * 0.32))}px "Fraunces", Georgia, serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(initials || "S", x + w / 2, y + h / 2);
    }
    ctx.restore();

    ctx.save();
    if (isCircle) {
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
      ctx.closePath();
    } else {
      roundRectPath(ctx, x, y, w, h, radius);
    }
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  function truncateText(ctx, text, maxWidth) {
    const raw = String(text || "");
    if (ctx.measureText(raw).width <= maxWidth) return raw;
    let out = raw;
    while (out.length > 1 && ctx.measureText(out + "…").width > maxWidth) {
      out = out.slice(0, -1);
    }
    return out + "…";
  }

  function drawTruncatedText(ctx, text, x, y, maxWidth, align) {
    ctx.save();
    ctx.textAlign = align || "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(truncateText(ctx, text, maxWidth), x, y);
    ctx.restore();
  }

  function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = String(text || "").split(/\s+/);
    const lines = [];
    let current = "";
    for (const w of words) {
      const test = current ? `${current} ${w}` : w;
      if (ctx.measureText(test).width <= maxWidth) {
        current = test;
      } else {
        if (current) lines.push(current);
        current = w;
        if (lines.length >= maxLines) break;
      }
    }
    if (current && lines.length < maxLines) lines.push(current);
    if (lines.length === maxLines && words.length > 0) {
      lines[maxLines - 1] = truncateText(ctx, lines[maxLines - 1], maxWidth);
    }
    lines.forEach((line, idx) => {
      ctx.fillText(line, x, y + idx * lineHeight);
    });
    return lines.length * lineHeight;
  }

  function drawPill(ctx, text, x, y, bgColor, textColor, borderColor, fontSpec) {
    ctx.save();
    ctx.font = fontSpec || '600 20px "JetBrains Mono", monospace';
    const textW = ctx.measureText(text).width;
    const h = 40;
    const w = textW + 32;
    fillRoundRect(ctx, x, y, w, h, 999, bgColor, borderColor);
    ctx.fillStyle = textColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + w / 2, y + h / 2 + 1);
    ctx.restore();
    return w;
  }

  function drawBackground(ctx, W, H, theme) {
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, W, H);

    const g1 = ctx.createRadialGradient(W * 0.85, H * 0.12, 20, W * 0.85, H * 0.12, W * 0.8);
    g1.addColorStop(0, theme.bgGlow);
    g1.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, H);

    const g2 = ctx.createRadialGradient(W * 0.15, H * 0.82, 20, W * 0.15, H * 0.82, W * 0.75);
    g2.addColorStop(0, theme.bgGlow2);
    g2.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);

    // Subtle editorial frame
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, 30, 30, W - 60, H - 60, 22);
    ctx.stroke();
  }

  function drawHeaderAndFooter(ctx, W, H, report, options, theme, badgeRightText) {
    const isStory = H > 1600;
    const padX = 68;
    const topY = isStory ? 112 : 68;
    const bottomY = H - (isStory ? 132 : 76);

    // Top bar
    ctx.fillStyle = theme.muted;
    ctx.font = '600 19px "JetBrains Mono", monospace';
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("MÁQUINA DO TEMPO · SPOTIFY", padX, topY + 18);

    const rightLabel = badgeRightText || `EDIÇÃO ${String(report.month_number).padStart(2, "0")}/${report.year}`;
    ctx.font = '600 19px "JetBrains Mono", monospace';
    const rw = ctx.measureText(rightLabel).width + 28;
    fillRoundRect(ctx, W - padX - rw, topY, rw, 36, 999, theme.surface, theme.border);
    ctx.fillStyle = theme.accent;
    ctx.textAlign = "center";
    ctx.fillText(rightLabel, W - padX - rw / 2, topY + 19);

    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padX, topY + 52);
    ctx.lineTo(W - padX, topY + 52);
    ctx.stroke();

    // Footer bar
    ctx.beginPath();
    ctx.moveTo(padX, bottomY - 34);
    ctx.lineTo(W - padX, bottomY - 34);
    ctx.stroke();

    const handle = (options.handle || "@matheus").trim() || "@matheus";
    ctx.fillStyle = theme.ink;
    ctx.font = '700 22px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(handle, padX, bottomY);

    const srcTag = options.dataSource === "short_term" && report.spotify_short_term
      ? "TOP 4 SEMANAS · SPOTIFY API"
      : `${report.summary.personality_tag.toUpperCase()} · BRT`;
    ctx.fillStyle = theme.muted;
    ctx.font = '500 18px "JetBrains Mono", monospace';
    ctx.textAlign = "right";
    ctx.fillText(srcTag, W - padX, bottomY);

    return {
      padX,
      innerW: W - padX * 2,
      contentTop: topY + 78,
      contentBottom: bottomY - 56,
      isStory
    };
  }

  function resolveSourceView(report, options) {
    const useShort = options.dataSource === "short_term" && report.spotify_short_term;
    if (useShort) {
      return {
        artists: report.spotify_short_term.top_artists || [],
        tracks: report.spotify_short_term.top_tracks || [],
        isShortTerm: true
      };
    }
    return {
      artists: report.top_artists || [],
      tracks: report.top_tracks || [],
      isShortTerm: false
    };
  }

  function collectUrlsForSlide(report, mode, options) {
    const view = resolveSourceView(report, options);
    const urls = [];
    const pushUrl = (u) => {
      if (u && !urls.includes(u)) urls.push(u);
    };

    if (mode === "poster" || mode === "capa") {
      view.artists.slice(0, 5).forEach((a) => pushUrl(a.image));
      view.tracks.slice(0, 5).forEach((t) => pushUrl(t.album && t.album.image));
    } else if (mode === "artistas") {
      view.artists.slice(0, 5).forEach((a) => pushUrl(a.image));
      (report.new_discoveries || []).slice(0, 4).forEach((d) => pushUrl(d.image));
    } else if (mode === "musicas") {
      view.tracks.slice(0, 5).forEach((t) => pushUrl(t.album && t.album.image));
      if (report.obsession) pushUrl(report.obsession.album_image);
    } else if (mode === "resumo") {
      (report.top_albums || []).slice(0, 4).forEach((al) => pushUrl(al.image));
      (report.new_discoveries || []).slice(0, 4).forEach((d) => pushUrl(d.image));
    }
    return urls;
  }

  async function preloadImages(urls) {
    const pairs = await Promise.all(
      urls.map(async (u) => [u, await loadImageSafe(u)])
    );
    return new Map(pairs);
  }

  function drawPosterSlide(ctx, W, H, report, options, theme, imgs, box) {
    const view = resolveSourceView(report, options);
    const { padX, innerW, contentTop, contentBottom, isStory } = box;
    let y = contentTop;

    // Month Title
    ctx.fillStyle = theme.ink;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = `700 ${isStory ? 84 : 66}px "Fraunces", Georgia, serif`;
    drawTruncatedText(ctx, report.label, padX, y + (isStory ? 64 : 52), innerW, "left");
    y += isStory ? 90 : 72;

    drawPill(
      ctx,
      report.summary.personality_tag.toUpperCase(),
      padX,
      y,
      theme.surface2,
      theme.accent2,
      theme.border,
      '600 18px "JetBrains Mono", monospace'
    );
    y += isStory ? 64 : 56;

    // KPI Row
    const showMetrics = options.showMetrics !== false;
    const kpis = showMetrics
      ? [
          { label: "MINUTOS", val: formatNumber(report.summary.total_minutes) },
          { label: "PLAYS REAIS", val: formatNumber(report.summary.total_plays) },
          { label: "ARTISTAS", val: formatNumber(report.summary.unique_artists) },
          { label: "HORA PICO", val: report.summary.peak_hour ? report.summary.peak_hour.label : "—" }
        ]
      : [
          { label: "DIAS ATIVOS", val: `${report.summary.active_days}d` },
          { label: "FAIXAS ÚNICAS", val: formatNumber(report.summary.unique_tracks) },
          { label: "ARTISTAS", val: formatNumber(report.summary.unique_artists) },
          { label: "HORA PICO", val: report.summary.peak_hour ? report.summary.peak_hour.label : "—" }
        ];

    const kpiGap = 14;
    const kpiW = (innerW - kpiGap * 3) / 4;
    const kpiH = isStory ? 116 : 94;
    kpis.forEach((k, i) => {
      const kx = padX + i * (kpiW + kpiGap);
      fillRoundRect(ctx, kx, y, kpiW, kpiH, 16, theme.surface, theme.border);
      ctx.fillStyle = theme.muted;
      ctx.font = '600 16px "JetBrains Mono", monospace';
      ctx.textAlign = "left";
      ctx.fillText(k.label, kx + 18, y + 32);
      ctx.fillStyle = i === 0 ? theme.accent : theme.ink;
      ctx.font = `700 ${isStory ? 38 : 32}px "Fraunces", Georgia, serif`;
      drawTruncatedText(ctx, k.val, kx + 18, y + (isStory ? 86 : 72), kpiW - 36, "left");
    });
    y += kpiH + (isStory ? 26 : 18);

    // Spotlight #1 Artist + #1 Track
    const spotGap = 18;
    const spotW = (innerW - spotGap) / 2;
    const spotH = isStory ? 210 : 172;
    const imgSize = isStory ? 162 : 132;
    const topArt1 = view.artists[0] || {};
    const topTrk1 = view.tracks[0] || {};

    [
      {
        kicker: "ARTISTA Nº 1",
        title: topArt1.name || "—",
        sub: view.isShortTerm
          ? (topArt1.genres && topArt1.genres[0] ? topArt1.genres[0] : "Top 4 semanas")
          : (showMetrics ? `${topArt1.plays || 0} plays · ${topArt1.minutes || 0} min` : (topArt1.top_track_name || "Destaque")),
        imgUrl: topArt1.image,
        circle: true
      },
      {
        kicker: "MÚSICA Nº 1",
        title: topTrk1.name || "—",
        sub: topTrk1.artist_names || "—",
        imgUrl: topTrk1.album && topTrk1.album.image,
        circle: false
      }
    ].forEach((sp, idx) => {
      const sx = padX + idx * (spotW + spotGap);
      fillRoundRect(ctx, sx, y, spotW, spotH, 18, theme.surface, theme.border);
      drawCoverOrMonogram(
        ctx,
        imgs.get(sp.imgUrl),
        sx + 20,
        y + (spotH - imgSize) / 2,
        imgSize,
        imgSize,
        14,
        sp.title,
        theme,
        sp.circle
      );
      const tx = sx + 20 + imgSize + 18;
      const tw = spotW - (20 + imgSize + 36);
      ctx.fillStyle = theme.accent;
      ctx.font = '600 16px "JetBrains Mono", monospace';
      ctx.fillText(sp.kicker, tx, y + (isStory ? 54 : 44));
      ctx.fillStyle = theme.ink;
      ctx.font = `700 ${isStory ? 30 : 25}px "Fraunces", Georgia, serif`;
      drawTruncatedText(ctx, sp.title, tx, y + (isStory ? 102 : 84), tw, "left");
      ctx.fillStyle = theme.muted;
      ctx.font = '500 20px "Plus Jakarta Sans", sans-serif';
      drawTruncatedText(ctx, sp.sub, tx, y + (isStory ? 140 : 118), tw, "left");
    });

    y += spotH + (isStory ? 28 : 20);

    // Bottom 2 columns: Top 5 Artists | Top 5 Tracks
    const rhythmReserve = isStory ? 136 : 0;
    const colsH = contentBottom - y - rhythmReserve;
    const colGap = 18;
    const colW = (innerW - colGap) / 2;

    const cols = [
      {
        title: "TOP 5 ARTISTAS",
        items: view.artists.slice(0, 5).map((a, idx) => ({
          rank: idx + 1,
          name: a.name,
          sub: view.isShortTerm ? (a.genres && a.genres[0] ? a.genres[0] : "Spotify") : (showMetrics ? `${a.plays} plays` : a.top_track_name || ""),
          imgUrl: a.image,
          circle: true
        }))
      },
      {
        title: "TOP 5 MÚSICAS",
        items: view.tracks.slice(0, 5).map((t, idx) => ({
          rank: idx + 1,
          name: t.name,
          sub: showMetrics && !view.isShortTerm ? `${t.plays} plays · ${t.artist_names}` : t.artist_names,
          imgUrl: t.album && t.album.image,
          circle: false
        }))
      }
    ];

    cols.forEach((col, cIdx) => {
      const cx = padX + cIdx * (colW + colGap);
      fillRoundRect(ctx, cx, y, colW, colsH, 18, theme.surface, theme.border);
      ctx.fillStyle = theme.accent2;
      ctx.font = '700 18px "JetBrains Mono", monospace';
      ctx.fillText(col.title, cx + 24, y + 38);

      const listTop = y + 58;
      const rowH = Math.floor((colsH - 72) / 5);
      const thumb = Math.min(54, Math.max(38, rowH - 18));

      col.items.forEach((item, rIdx) => {
        const ry = listTop + rIdx * rowH;
        const midY = ry + rowH / 2;

        ctx.fillStyle = rIdx === 0 ? theme.accent : theme.muted;
        ctx.font = '700 22px "JetBrains Mono", monospace';
        ctx.textBaseline = "middle";
        ctx.fillText(`${item.rank}`, cx + 24, midY);

        drawCoverOrMonogram(
          ctx,
          imgs.get(item.imgUrl),
          cx + 58,
          midY - thumb / 2,
          thumb,
          thumb,
          10,
          item.name,
          theme,
          item.circle
        );

        const textX = cx + 58 + thumb + 14;
        const textMaxW = colW - (58 + thumb + 34);
        ctx.fillStyle = theme.ink;
        ctx.font = `600 ${isStory ? 22 : 19}px "Plus Jakarta Sans", sans-serif`;
        ctx.textBaseline = "alphabetic";
        drawTruncatedText(ctx, item.name, textX, midY - 4, textMaxW, "left");

        ctx.fillStyle = theme.muted;
        ctx.font = `500 ${isStory ? 17 : 15}px "Plus Jakarta Sans", sans-serif`;
        drawTruncatedText(ctx, item.sub, textX, midY + 20, textMaxW, "left");
      });
    });

    if (isStory) {
      const ry = contentBottom - 110;
      fillRoundRect(ctx, padX, ry, innerW, 102, 18, theme.surface2, theme.border);
      const peak = report.summary.peak_hour;
      const dom = report.summary.periods[report.summary.dominant_period];
      const pday = report.summary.peak_day;

      ctx.fillStyle = theme.accent2;
      ctx.font = '700 17px "JetBrains Mono", monospace';
      ctx.fillText("ASSINATURA DO MÊS", padX + 26, ry + 36);

      ctx.fillStyle = theme.ink;
      ctx.font = '600 24px "Plus Jakarta Sans", sans-serif';
      const line = `${dom.label} (${dom.pct}%) · Pico às ${peak.label} · Dia recorde ${pday.day}/${String(report.month_number).padStart(2, "0")} (${pday.plays} plays)`;
      drawTruncatedText(ctx, line, padX + 26, ry + 76, innerW - 52, "left");
    }
  }

  function drawCapaSlide(ctx, W, H, report, options, theme, imgs, box) {
    const view = resolveSourceView(report, options);
    const { padX, innerW, contentTop, contentBottom, isStory } = box;
    let y = contentTop;

    // 2x2 Mosaic of Top 4 visual covers/photos
    const mosaicSize = isStory ? 680 : 480;
    const mosaicX = (W - mosaicSize) / 2;
    const cellGap = 16;
    const cellSize = (mosaicSize - cellGap) / 2;

    const mosaicCovers = [
      view.tracks[0] && view.tracks[0].album && view.tracks[0].album.image,
      view.artists[0] && view.artists[0].image,
      view.tracks[1] && view.tracks[1].album && view.tracks[1].album.image,
      view.artists[1] && view.artists[1].image
    ];
    const mosaicLabels = [
      view.tracks[0] && view.tracks[0].name,
      view.artists[0] && view.artists[0].name,
      view.tracks[1] && view.tracks[1].name,
      view.artists[1] && view.artists[1].name
    ];

    mosaicCovers.forEach((url, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const cx = mosaicX + col * (cellSize + cellGap);
      const cy = y + row * (cellSize + cellGap);
      drawCoverOrMonogram(ctx, imgs.get(url), cx, cy, cellSize, cellSize, 22, mosaicLabels[idx], theme, false);
    });

    y += mosaicSize + (isStory ? 56 : 36);

    ctx.textAlign = "center";
    ctx.fillStyle = theme.accent;
    ctx.font = '600 20px "JetBrains Mono", monospace';
    ctx.fillText(report.summary.personality_tag.toUpperCase(), W / 2, y);
    y += isStory ? 96 : 74;

    ctx.fillStyle = theme.ink;
    ctx.font = `700 ${isStory ? 104 : 82}px "Fraunces", Georgia, serif`;
    drawTruncatedText(ctx, report.label, W / 2, y, innerW, "center");
    y += isStory ? 54 : 42;

    ctx.fillStyle = theme.muted;
    ctx.font = `500 ${isStory ? 26 : 22}px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = "center";
    const subH = drawWrappedText(ctx, report.summary.personality_subtitle, W / 2, y, innerW - 60, isStory ? 36 : 30, 2);
    y += subH + (isStory ? 44 : 26);

    const cardH = Math.min(170, contentBottom - y);
    const gap = 16;
    const cw = (innerW - gap * 2) / 3;
    const showMetrics = options.showMetrics !== false;
    const stats = showMetrics
      ? [
          { k: "MINUTOS", v: formatNumber(report.summary.total_minutes) },
          { k: "REPRODUÇÕES", v: formatNumber(report.summary.total_plays) },
          { k: "ARTISTAS", v: formatNumber(report.summary.unique_artists) }
        ]
      : [
          { k: "DIAS ATIVOS", v: `${report.summary.active_days}d` },
          { k: "FAIXAS ÚNICAS", v: formatNumber(report.summary.unique_tracks) },
          { k: "ARTISTAS", v: formatNumber(report.summary.unique_artists) }
        ];

    stats.forEach((s, i) => {
      const sx = padX + i * (cw + gap);
      fillRoundRect(ctx, sx, y, cw, cardH, 18, theme.surface, theme.border);
      ctx.textAlign = "center";
      ctx.fillStyle = theme.muted;
      ctx.font = '600 17px "JetBrains Mono", monospace';
      ctx.fillText(s.k, sx + cw / 2, y + cardH * 0.34);
      ctx.fillStyle = i === 0 ? theme.accent : theme.ink;
      ctx.font = `700 ${isStory ? 52 : 44}px "Fraunces", Georgia, serif`;
      ctx.fillText(s.v, sx + cw / 2, y + cardH * 0.72);
    });
  }

  function drawMusicasSlide(ctx, W, H, report, options, theme, imgs, box) {
    const view = resolveSourceView(report, options);
    const { padX, innerW, contentTop, contentBottom, isStory } = box;
    const showMetrics = options.showMetrics !== false;
    let y = contentTop;

    ctx.textAlign = "left";
    ctx.fillStyle = theme.accent;
    ctx.font = '600 18px "JetBrains Mono", monospace';
    ctx.fillText(view.isShortTerm ? "SPOTIFY · TOP 4 SEMANAS" : `PARADA DE ${report.short_label}`, padX, y + 14);
    y += 30;

    ctx.fillStyle = theme.ink;
    ctx.font = `700 ${isStory ? 72 : 58}px "Fraunces", Georgia, serif`;
    ctx.fillText("Top 5 Músicas", padX, y + (isStory ? 56 : 46));
    y += isStory ? 88 : 70;

    const obsReserve = isStory ? 190 : 126;
    const listH = contentBottom - y - obsReserve;
    const rowGap = isStory ? 18 : 12;
    const rowH = Math.floor((listH - rowGap * 4) / 5);
    const thumb = Math.min(130, Math.max(76, rowH - 28));
    const tracks = view.tracks.slice(0, 5);
    const maxPlays = Math.max(1, ...tracks.map((t) => t.plays || 1));

    tracks.forEach((tr, idx) => {
      const ry = y + idx * (rowH + rowGap);
      fillRoundRect(ctx, padX, ry, innerW, rowH, 18, idx === 0 ? theme.surface2 : theme.surface, theme.border);

      ctx.fillStyle = idx === 0 ? theme.accent : theme.accent2;
      ctx.font = `700 ${isStory ? 44 : 36}px "Fraunces", Georgia, serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`0${idx + 1}`, padX + 52, ry + rowH / 2);

      const imgX = padX + 98;
      const imgY = ry + (rowH - thumb) / 2;
      drawCoverOrMonogram(ctx, imgs.get(tr.album && tr.album.image), imgX, imgY, thumb, thumb, 14, tr.name, theme, false);

      const tx = imgX + thumb + 22;
      const rightPad = 24;
      const tw = innerW - (tx - padX) - rightPad;

      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = theme.ink;
      ctx.font = `700 ${isStory ? 30 : 25}px "Plus Jakarta Sans", sans-serif`;
      drawTruncatedText(ctx, tr.name, tx, ry + rowH * 0.36, tw, "left");

      ctx.fillStyle = theme.muted;
      ctx.font = `500 ${isStory ? 22 : 19}px "Plus Jakarta Sans", sans-serif`;
      drawTruncatedText(ctx, tr.artist_names, tx, ry + rowH * 0.60, tw, "left");

      if (!view.isShortTerm && showMetrics) {
        const barW = Math.min(340, tw * 0.56);
        const barY = ry + rowH * 0.75;
        fillRoundRect(ctx, tx, barY, barW, 8, 999, theme.bg, null);
        fillRoundRect(ctx, tx, barY, Math.max(16, (tr.plays / maxPlays) * barW), 8, 999, idx === 0 ? theme.accent : theme.accent2, null);

        ctx.fillStyle = theme.ink;
        ctx.font = '600 18px "JetBrains Mono", monospace';
        ctx.fillText(`${tr.plays} plays · ${tr.minutes} min`, tx + barW + 16, barY + 8);
      }
    });

    // Obsession footer card
    const obsY = contentBottom - obsReserve + 18;
    const obsH = obsReserve - 18;
    fillRoundRect(ctx, padX, obsY, innerW, obsH, 18, theme.surface2, theme.border);
    const obs = report.obsession || {};
    ctx.fillStyle = theme.accent2;
    ctx.font = '700 17px "JetBrains Mono", monospace';
    ctx.textAlign = "left";
    ctx.fillText("OBSESSÃO NO REPEAT", padX + 24, obsY + 38);

    ctx.fillStyle = theme.ink;
    ctx.font = `600 ${isStory ? 26 : 22}px "Plus Jakarta Sans", sans-serif`;
    const obsText = obs.max_day_date
      ? `"${obs.name}" bateu ${obs.max_day_plays} reproduções em um único dia (${obs.max_day_date.split("-").reverse().join("/")}).`
      : `"${obs.name || "—"}" liderou sua rotação durante ${report.label}.`;
    drawTruncatedText(ctx, obsText, padX + 24, obsY + (isStory ? 86 : 74), innerW - 48, "left");
  }

  function drawArtistasSlide(ctx, W, H, report, options, theme, imgs, box) {
    const view = resolveSourceView(report, options);
    const { padX, innerW, contentTop, contentBottom, isStory } = box;
    const showMetrics = options.showMetrics !== false;
    let y = contentTop;

    ctx.textAlign = "left";
    ctx.fillStyle = theme.accent;
    ctx.font = '600 18px "JetBrains Mono", monospace';
    ctx.fillText(view.isShortTerm ? "SPOTIFY · TOP 4 SEMANAS" : `ELENCO DE ${report.short_label}`, padX, y + 14);
    y += 30;

    ctx.fillStyle = theme.ink;
    ctx.font = `700 ${isStory ? 72 : 58}px "Fraunces", Georgia, serif`;
    ctx.fillText("Top 5 Artistas", padX, y + (isStory ? 56 : 46));
    y += isStory ? 88 : 70;

    // Hero #1 Artist card
    const art1 = view.artists[0] || {};
    const heroH = isStory ? 270 : 210;
    const heroImg = isStory ? 200 : 154;
    fillRoundRect(ctx, padX, y, innerW, heroH, 22, theme.surface2, theme.border);
    drawCoverOrMonogram(ctx, imgs.get(art1.image), padX + 26, y + (heroH - heroImg) / 2, heroImg, heroImg, 24, art1.name, theme, true);

    const htx = padX + 26 + heroImg + 28;
    const htw = innerW - (htx - padX) - 24;
    ctx.fillStyle = theme.accent;
    ctx.font = '700 19px "JetBrains Mono", monospace';
    ctx.fillText("Nº 1 DO MÊS", htx, y + (isStory ? 64 : 50));

    ctx.fillStyle = theme.ink;
    ctx.font = `700 ${isStory ? 54 : 42}px "Fraunces", Georgia, serif`;
    drawTruncatedText(ctx, art1.name || "—", htx, y + (isStory ? 128 : 102), htw, "left");

    ctx.fillStyle = theme.muted;
    ctx.font = `500 ${isStory ? 23 : 20}px "Plus Jakarta Sans", sans-serif`;
    const art1Sub = view.isShortTerm
      ? (art1.genres && art1.genres.length ? art1.genres.slice(0, 3).join(" · ") : "Mais ouvido nas últimas 4 semanas")
      : (showMetrics ? `${art1.plays || 0} plays · ${art1.minutes || 0} min ouvidos` : `Faixa destaque: ${art1.top_track_name || "—"}`);
    drawTruncatedText(ctx, art1Sub, htx, y + (isStory ? 174 : 142), htw, "left");

    if (art1.top_track_name && showMetrics && !view.isShortTerm) {
      ctx.fillStyle = theme.accent2;
      ctx.font = '500 20px "JetBrains Mono", monospace';
      drawTruncatedText(ctx, `Mais tocada: ${art1.top_track_name}`, htx, y + (isStory ? 216 : 176), htw, "left");
    }

    y += heroH + (isStory ? 24 : 16);

    // Ranks #2 to #5
    const discReserve = isStory && (report.new_discoveries || []).length > 0 ? 150 : 0;
    const restH = contentBottom - y - discReserve;
    const gap = isStory ? 16 : 12;
    const rowH = Math.floor((restH - gap * 3) / 4);
    const thumb = Math.min(112, Math.max(70, rowH - 26));
    const maxPlays = Math.max(1, art1.plays || 1);

    view.artists.slice(1, 5).forEach((art, idx) => {
      const ry = y + idx * (rowH + gap);
      fillRoundRect(ctx, padX, ry, innerW, rowH, 18, theme.surface, theme.border);

      ctx.fillStyle = theme.muted;
      ctx.font = `700 ${isStory ? 38 : 32}px "Fraunces", Georgia, serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`0${idx + 2}`, padX + 52, ry + rowH / 2);

      const ix = padX + 96;
      drawCoverOrMonogram(ctx, imgs.get(art.image), ix, ry + (rowH - thumb) / 2, thumb, thumb, 14, art.name, theme, true);

      const tx = ix + thumb + 22;
      const tw = innerW - (tx - padX) - 24;
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = theme.ink;
      ctx.font = `700 ${isStory ? 30 : 25}px "Plus Jakarta Sans", sans-serif`;
      drawTruncatedText(ctx, art.name, tx, ry + rowH * 0.42, tw, "left");

      if (!view.isShortTerm && showMetrics) {
        const barW = Math.min(340, tw * 0.56);
        const barY = ry + rowH * 0.64;
        fillRoundRect(ctx, tx, barY, barW, 8, 999, theme.bg, null);
        fillRoundRect(ctx, tx, barY, Math.max(16, (art.plays / maxPlays) * barW), 8, 999, theme.accent, null);

        ctx.fillStyle = theme.muted;
        ctx.font = '600 18px "JetBrains Mono", monospace';
        ctx.fillText(`${art.plays} plays · ${art.minutes} min`, tx + barW + 16, barY + 8);
      } else {
        ctx.fillStyle = theme.muted;
        ctx.font = '500 20px "Plus Jakarta Sans", sans-serif';
        drawTruncatedText(ctx, (art.genres && art.genres[0]) || art.top_track_name || "Spotify", tx, ry + rowH * 0.72, tw, "left");
      }
    });

    if (discReserve > 0) {
      const dy = contentBottom - discReserve + 18;
      fillRoundRect(ctx, padX, dy, innerW, discReserve - 18, 18, theme.surface2, theme.border);
      ctx.fillStyle = theme.accent2;
      ctx.font = '700 17px "JetBrains Mono", monospace';
      ctx.fillText("DESCOBERTAS INÉDITAS DO MÊS", padX + 24, dy + 38);
      const names = report.new_discoveries.slice(0, 4).map((d) => d.name).join("  ·  ");
      ctx.fillStyle = theme.ink;
      ctx.font = '600 24px "Plus Jakarta Sans", sans-serif';
      drawTruncatedText(ctx, names, padX + 24, dy + 86, innerW - 48, "left");
    }
  }

  function drawRitmoSlide(ctx, W, H, report, options, theme, _imgs, box) {
    const { padX, innerW, contentTop, contentBottom, isStory } = box;
    let y = contentTop;

    ctx.textAlign = "left";
    ctx.fillStyle = theme.accent2;
    ctx.font = '600 18px "JetBrains Mono", monospace';
    ctx.fillText(`HORÁRIO DE BRASÍLIA · ${report.short_label}`, padX, y + 14);
    y += 30;

    ctx.fillStyle = theme.ink;
    ctx.font = `700 ${isStory ? 72 : 58}px "Fraunces", Georgia, serif`;
    ctx.fillText("Ritmo & Horários", padX, y + (isStory ? 56 : 46));
    y += isStory ? 92 : 72;

    // 24h Bar Chart Card
    const chartH = isStory ? 440 : 320;
    fillRoundRect(ctx, padX, y, innerW, chartH, 20, theme.surface, theme.border);

    const hourly = report.hourly_distribution || new Array(24).fill(0);
    const maxH = Math.max(1, ...hourly);
    const peakHourIdx = report.summary.peak_hour ? report.summary.peak_hour.hour : 0;

    ctx.fillStyle = theme.muted;
    ctx.font = '600 18px "JetBrains Mono", monospace';
    ctx.fillText("DISTRIBUIÇÃO POR HORA (00H–23H)", padX + 26, y + 38);

    ctx.fillStyle = theme.accent2;
    ctx.textAlign = "right";
    ctx.fillText(`PICO: ${String(peakHourIdx).padStart(2, "0")}H (${hourly[peakHourIdx] || 0} PLAYS)`, padX + innerW - 26, y + 38);

    const plotX = padX + 26;
    const plotW = innerW - 52;
    const plotTop = y + 72;
    const plotH = chartH - 122;
    const barSlot = plotW / 24;
    const barW = barSlot - 8;

    hourly.forEach((val, h) => {
      const bh = Math.max(8, (val / maxH) * plotH);
      const bx = plotX + h * barSlot + 4;
      const by = plotTop + plotH - bh;
      const isPeak = h === peakHourIdx;
      fillRoundRect(ctx, bx, by, barW, bh, 6, isPeak ? theme.accent2 : theme.accent, null);

      if (h % 3 === 0 || isPeak) {
        ctx.fillStyle = isPeak ? theme.accent2 : theme.muted;
        ctx.font = '600 15px "JetBrains Mono", monospace';
        ctx.textAlign = "center";
        ctx.fillText(`${String(h).padStart(2, "0")}`, bx + barW / 2, plotTop + plotH + 26);
      }
    });

    y += chartH + (isStory ? 26 : 18);

    // 4 Day Periods Card
    const periodsH = isStory ? 290 : 210;
    fillRoundRect(ctx, padX, y, innerW, periodsH, 20, theme.surface, theme.border);
    ctx.textAlign = "left";
    ctx.fillStyle = theme.muted;
    ctx.font = '600 18px "JetBrains Mono", monospace';
    ctx.fillText("TURNOS DO DIA", padX + 26, y + 38);

    const pKeys = ["madrugada", "manha", "tarde", "noite"];
    const pRowTop = y + 66;
    const pRowStep = (periodsH - 84) / 4;
    pKeys.forEach((pk, i) => {
      const p = report.summary.periods[pk];
      const py = pRowTop + i * pRowStep;
      const isDom = pk === report.summary.dominant_period;

      ctx.fillStyle = isDom ? theme.ink : theme.muted;
      ctx.font = `600 ${isStory ? 22 : 19}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillText(p.label, padX + 26, py + 24);

      const barX = padX + 195;
      const barMaxW = innerW - 355;
      fillRoundRect(ctx, barX, py + 8, barMaxW, 18, 999, theme.bg, null);
      fillRoundRect(ctx, barX, py + 8, Math.max(14, (p.pct / 100) * barMaxW), 18, 999, isDom ? theme.accent2 : theme.accent, null);

      ctx.textAlign = "right";
      ctx.fillStyle = isDom ? theme.accent2 : theme.ink;
      ctx.font = '700 20px "JetBrains Mono", monospace';
      ctx.fillText(`${p.pct}%`, padX + innerW - 26, py + 24);
      ctx.textAlign = "left";
    });

    y += periodsH + (isStory ? 26 : 18);

    // Bottom 2 highlight cards
    const footH = contentBottom - y;
    const gap = 18;
    const cw = (innerW - gap) / 2;
    const pday = report.summary.peak_day;

    fillRoundRect(ctx, padX, y, cw, footH, 20, theme.surface2, theme.border);
    ctx.fillStyle = theme.accent;
    ctx.font = '600 17px "JetBrains Mono", monospace';
    ctx.fillText("DIA MAIS MUSICAL", padX + 24, y + 40);
    ctx.fillStyle = theme.ink;
    ctx.font = `700 ${isStory ? 44 : 36}px "Fraunces", Georgia, serif`;
    ctx.fillText(`${String(pday.day).padStart(2, "0")}/${String(report.month_number).padStart(2, "0")} (${pday.weekday_label})`, padX + 24, y + (isStory ? 104 : 88));
    ctx.fillStyle = theme.muted;
    ctx.font = '500 20px "Plus Jakarta Sans", sans-serif';
    drawTruncatedText(ctx, `${pday.plays} plays · ${pday.minutes} min`, padX + 24, y + (isStory ? 148 : 124), cw - 48, "left");
    if (pday.top_track && isStory) {
      ctx.fillStyle = theme.accent2;
      ctx.font = '500 19px "JetBrains Mono", monospace';
      drawTruncatedText(ctx, `Hit: ${pday.top_track}`, padX + 24, y + 188, cw - 48, "left");
    }

    const rx = padX + cw + gap;
    fillRoundRect(ctx, rx, y, cw, footH, 20, theme.surface2, theme.border);
    ctx.fillStyle = theme.accent2;
    ctx.font = '600 17px "JetBrains Mono", monospace';
    ctx.fillText("CONSTÂNCIA & REPEAT", rx + 24, y + 40);
    ctx.fillStyle = theme.ink;
    ctx.font = `700 ${isStory ? 44 : 36}px "Fraunces", Georgia, serif`;
    ctx.fillText(`${report.summary.longest_streak_days} dias seguidos`, rx + 24, y + (isStory ? 104 : 88));
    ctx.fillStyle = theme.muted;
    ctx.font = '500 20px "Plus Jakarta Sans", sans-serif';
    drawTruncatedText(ctx, `${report.summary.active_days} dias ativos · ${report.summary.repeat_ratio.toFixed(2)}x/faixa`, rx + 24, y + (isStory ? 148 : 124), cw - 48, "left");
  }

  function drawResumoSlide(ctx, W, H, report, options, theme, imgs, box) {
    const { padX, innerW, contentTop, contentBottom, isStory } = box;
    let y = contentTop;

    ctx.textAlign = "left";
    ctx.fillStyle = theme.accent;
    ctx.font = '600 18px "JetBrains Mono", monospace';
    ctx.fillText(`CURADORIA · ${report.short_label}`, padX, y + 14);
    y += 30;

    ctx.fillStyle = theme.ink;
    ctx.font = `700 ${isStory ? 70 : 54}px "Fraunces", Georgia, serif`;
    ctx.fillText("Álbuns & Descobertas", padX, y + (isStory ? 54 : 44));
    y += isStory ? 86 : 68;

    // Top 3 Albums
    const albums = (report.top_albums || []).slice(0, 3);
    const albTitleH = 32;
    ctx.fillStyle = theme.muted;
    ctx.font = '600 18px "JetBrains Mono", monospace';
    ctx.fillText("ÁLBUNS MAIS GIRADOS", padX, y + 14);
    y += albTitleH;

    const albGap = 16;
    const albW = (innerW - albGap * 2) / 3;
    const albCoverSize = Math.floor(albW - 28);
    const albCardH = albCoverSize + 96;

    albums.forEach((al, idx) => {
      const ax = padX + idx * (albW + albGap);
      fillRoundRect(ctx, ax, y, albW, albCardH, 18, theme.surface, theme.border);
      drawCoverOrMonogram(ctx, imgs.get(al.image), ax + 14, y + 14, albCoverSize, albCoverSize, 12, al.name, theme, false);
      ctx.fillStyle = theme.ink;
      ctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
      drawTruncatedText(ctx, al.name, ax + 14, y + albCoverSize + 44, albW - 28, "left");
      ctx.fillStyle = theme.muted;
      ctx.font = '500 17px "Plus Jakarta Sans", sans-serif';
      drawTruncatedText(ctx, `${al.artist_name} · ${al.plays}x`, ax + 14, y + albCoverSize + 74, albW - 28, "left");
    });

    y += albCardH + (isStory ? 28 : 20);

    // Delta vs previous month or Genres
    const midH = isStory ? 190 : 146;
    fillRoundRect(ctx, padX, y, innerW, midH, 18, theme.surface2, theme.border);
    const delta = report.summary.delta_vs_prev;
    if (delta) {
      ctx.fillStyle = theme.accent2;
      ctx.font = '600 17px "JetBrains Mono", monospace';
      ctx.fillText(`COMPARADO COM ${delta.prev_label.toUpperCase()}`, padX + 24, y + 38);

      const signMin = delta.minutes_diff >= 0 ? "+" : "";
      const signPl = delta.plays_diff >= 0 ? "+" : "";
      ctx.fillStyle = theme.ink;
      ctx.font = `700 ${isStory ? 38 : 30}px "Fraunces", Georgia, serif`;
      ctx.fillText(
        `${signMin}${formatNumber(delta.minutes_diff)} min (${signMin}${delta.minutes_pct}%)`,
        padX + 24,
        y + (isStory ? 96 : 82)
      );
      ctx.fillStyle = theme.muted;
      ctx.font = '500 21px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(
        `${signPl}${formatNumber(delta.plays_diff)} reproduções · ${delta.new_artists_count} novos artistas no radar`,
        padX + 24,
        y + (isStory ? 142 : 120)
      );
    } else {
      ctx.fillStyle = theme.accent;
      ctx.font = '600 17px "JetBrains Mono", monospace';
      ctx.fillText("MARCO INICIAL DO ACERVO", padX + 24, y + 38);
      ctx.fillStyle = theme.ink;
      ctx.font = `700 ${isStory ? 36 : 30}px "Fraunces", Georgia, serif`;
      ctx.fillText("Primeiro capítulo da Máquina do Tempo", padX + 24, y + (isStory ? 96 : 82));
      ctx.fillStyle = theme.muted;
      ctx.font = '500 20px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`${formatNumber(report.summary.unique_albums)} álbuns diferentes explorados`, padX + 24, y + (isStory ? 142 : 120));
    }

    y += midH + (isStory ? 26 : 18);

    // Bottom: New discoveries or Top Genres
    const remH = contentBottom - y;
    fillRoundRect(ctx, padX, y, innerW, remH, 18, theme.surface, theme.border);
    const discoveries = report.new_discoveries || [];
    if (discoveries.length > 0) {
      ctx.fillStyle = theme.accent;
      ctx.font = '600 17px "JetBrains Mono", monospace';
      ctx.fillText("ARTISTAS INÉDITOS NESTE MÊS", padX + 24, y + 38);

      const items = discoveries.slice(0, isStory ? 4 : 3);
      const dGap = 14;
      const dW = (innerW - 48 - dGap * (items.length - 1)) / items.length;
      const dImg = Math.min(110, Math.max(72, remH - 130));
      items.forEach((d, idx) => {
        const dx = padX + 24 + idx * (dW + dGap);
        const cx = dx + dW / 2 - dImg / 2;
        drawCoverOrMonogram(ctx, imgs.get(d.image), cx, y + 60, dImg, dImg, 16, d.name, theme, true);
        ctx.textAlign = "center";
        ctx.fillStyle = theme.ink;
        ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
        drawTruncatedText(ctx, d.name, dx + dW / 2, y + 60 + dImg + 32, dW - 8, "center");
        ctx.fillStyle = theme.muted;
        ctx.font = '500 16px "JetBrains Mono", monospace';
        drawTruncatedText(ctx, `${d.plays} plays`, dx + dW / 2, y + 60 + dImg + 56, dW - 8, "center");
      });
      ctx.textAlign = "left";
    } else {
      ctx.fillStyle = theme.accent;
      ctx.font = '600 17px "JetBrains Mono", monospace';
      ctx.fillText("FECHAMENTO DO MÊS", padX + 24, y + 38);
      ctx.fillStyle = theme.ink;
      ctx.font = `700 ${isStory ? 34 : 28}px "Fraunces", Georgia, serif`;
      ctx.fillText(`${report.summary.total_hours} horas de música em ${report.summary.active_days} dias`, padX + 24, y + 96);
      ctx.fillStyle = theme.muted;
      ctx.font = '500 20px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`Média de ${report.summary.avg_minutes_per_active_day} minutos por dia ativo`, padX + 24, y + 140);
    }
  }

  async function renderInstagramCanvas(canvas, report, options) {
    await ensureFontsReady();

    const format = options.format === "feed" ? "feed" : "story";
    const mode = options.mode || "poster";
    const theme = THEMES[options.theme] || THEMES.prensa;
    const W = 1080;
    const H = format === "feed" ? 1350 : 1920;

    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;

    const urls = collectUrlsForSlide(report, mode, options);
    const imgs = await preloadImages(urls);

    const ctx = canvas.getContext("2d");
    drawBackground(ctx, W, H, theme);
    const box = drawHeaderAndFooter(ctx, W, H, report, options, theme, options.badgeRightText);

    if (mode === "capa") {
      drawCapaSlide(ctx, W, H, report, options, theme, imgs, box);
    } else if (mode === "artistas") {
      drawArtistasSlide(ctx, W, H, report, options, theme, imgs, box);
    } else if (mode === "musicas") {
      drawMusicasSlide(ctx, W, H, report, options, theme, imgs, box);
    } else if (mode === "ritmo") {
      drawRitmoSlide(ctx, W, H, report, options, theme, imgs, box);
    } else if (mode === "resumo") {
      drawResumoSlide(ctx, W, H, report, options, theme, imgs, box);
    } else {
      drawPosterSlide(ctx, W, H, report, options, theme, imgs, box);
    }

    return canvas;
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Falha ao gerar PNG a partir do canvas."));
        }, "image/png");
      } catch (err) {
        reject(err);
      }
    });
  }

  // CRC32 + Uncompressed ZIP builder (100% browser native, zero external CDN)
  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  async function buildZipBlob(entries) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    for (const entry of entries) {
      const nameBytes = encoder.encode(entry.name);
      const dataBytes = entry.data instanceof Uint8Array
        ? entry.data
        : new Uint8Array(await entry.data.arrayBuffer());
      const crc = crc32(dataBytes);

      const localHeader = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(localHeader.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true);
      lv.setUint16(8, 0, true);
      lv.setUint16(10, 0, true);
      lv.setUint16(12, 0, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, dataBytes.length, true);
      lv.setUint32(22, dataBytes.length, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      localHeader.set(nameBytes, 30);

      localParts.push(localHeader, dataBytes);

      const centralHeader = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(centralHeader.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, 0, true);
      cv.setUint16(14, 0, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, dataBytes.length, true);
      cv.setUint32(24, dataBytes.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      centralHeader.set(nameBytes, 46);

      centralParts.push(centralHeader);
      offset += localHeader.length + dataBytes.length;
    }

    let centralSize = 0;
    centralParts.forEach((p) => { centralSize += p.length; });

    const endRecord = new Uint8Array(22);
    const ev = new DataView(endRecord.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, entries.length, true);
    ev.setUint16(10, entries.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);

    return new Blob([...localParts, ...centralParts, endRecord], { type: "application/zip" });
  }

  const CAROUSEL_SLIDES = [
    { key: "capa", label: "01_capa", title: "SLIDE 01/05" },
    { key: "artistas", label: "02_artistas", title: "SLIDE 02/05" },
    { key: "musicas", label: "03_musicas", title: "SLIDE 03/05" },
    { key: "ritmo", label: "04_ritmo", title: "SLIDE 04/05" },
    { key: "resumo", label: "05_resumo", title: "SLIDE 05/05" }
  ];

  global.SpotifyExporter = {
    THEMES,
    CAROUSEL_SLIDES,
    renderInstagramCanvas,
    canvasToBlob,
    buildZipBlob
  };
})(window);
