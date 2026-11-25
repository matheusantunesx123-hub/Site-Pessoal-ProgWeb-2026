(function () {
  "use strict";

  const DATA_BASE = "../spotify/monthly";
  const HANDLE_STORAGE_KEY = "spotify_time_machine_handle_v1";

  const state = {
    index: null,
    monthCache: new Map(),
    currentMonthKey: null,
    currentReport: null,
    dataSource: "real",
    tracksExpanded: false,
    artistsExpanded: false,
    selectedDay: null,
    exportFormat: "story",
    carouselRatio: "feed",
    exportMode: "poster",
    exportTheme: "prensa",
    exportSource: "real",
    carouselSlideIdx: 0,
    handle: "@matheus",
    showMetrics: true,
    renderToken: 0
  };

  const els = {};

  function qs(id) {
    return document.getElementById(id);
  }

  function fmtNum(v) {
    return Number(v || 0).toLocaleString("pt-BR");
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function initialsOf(name) {
    return (name || "S")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0] || "")
      .join("")
      .toUpperCase() || "S";
  }

  function createCoverImage(url, altText, fallbackLabel) {
    const wrap = document.createElement("div");
    if (url) {
      const img = document.createElement("img");
      img.crossOrigin = "anonymous";
      img.loading = "lazy";
      img.decoding = "async";
      img.alt = altText || fallbackLabel || "Capa do Spotify";
      img.src = url;
      img.addEventListener("error", () => {
        wrap.innerHTML = "";
        const fb = document.createElement("div");
        fb.className = "cover-fallback";
        fb.textContent = initialsOf(fallbackLabel);
        wrap.appendChild(fb);
      });
      wrap.appendChild(img);
    } else {
      const fb = document.createElement("div");
      fb.className = "cover-fallback";
      fb.textContent = initialsOf(fallbackLabel);
      wrap.appendChild(fb);
    }
    return wrap;
  }

  function setStatusBanner(message) {
    if (!message) {
      els.statusBanner.innerHTML = "";
      return;
    }
    els.statusBanner.innerHTML = `<div class="status-alert">${escapeHtml(message)}</div>`;
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ao carregar ${url}`);
    }
    return res.json();
  }

  async function loadMonthReport(monthKey) {
    if (state.monthCache.has(monthKey)) {
      return state.monthCache.get(monthKey);
    }
    const report = await fetchJson(`${DATA_BASE}/${monthKey}.json`);
    state.monthCache.set(monthKey, report);
    return report;
  }

  function renderArchiveBar() {
    const index = state.index;
    if (!index || !index.all_time) return;
    const at = index.all_time;
    els.archiveStats.textContent =
      `${fmtNum(at.total_plays)} reproduções · ${fmtNum(at.total_minutes)} min (${at.total_hours} h) · ` +
      `${at.months_count} meses registrados`;

    els.monthPills.innerHTML = "";
    (index.months || []).forEach((m) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `month-pill${m.month === state.currentMonthKey ? " is-active" : ""}`;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", m.month === state.currentMonthKey ? "true" : "false");
      btn.dataset.month = m.month;

      const lbl = document.createElement("span");
      lbl.className = "month-pill-label";
      lbl.textContent = m.label;

      const meta = document.createElement("span");
      meta.className = "month-pill-meta";
      meta.textContent = `${fmtNum(m.total_plays)} plays`;

      btn.append(lbl, meta);
      btn.addEventListener("click", () => selectMonth(m.month));
      els.monthPills.appendChild(btn);
    });

    updateStepperButtons();
  }

  function updateStepperButtons() {
    const months = (state.index && state.index.months) || [];
    const idx = months.findIndex((m) => m.month === state.currentMonthKey);
    // months[] está em ordem decrescente (mais recente no índice 0)
    els.btnPrevMonth.disabled = idx < 0 || idx >= months.length - 1;
    els.btnNextMonth.disabled = idx <= 0;
  }

  function getActiveRankings(report) {
    if (state.dataSource === "short_term" && report.spotify_short_term) {
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

  function renderHero(report) {
    const s = report.summary;
    const cov = report.coverage || {};
    els.editionBadge.textContent = `EDIÇÃO ${String(report.month_number).padStart(2, "0")}/${report.year}`;
    els.personalityPill.textContent = s.personality_tag;
    els.coverageNote.textContent = `${cov.active_days || s.active_days} de ${cov.days_in_month || 30} dias ativos`;
    els.monthTitle.textContent = report.label;
    els.personalitySubtitle.textContent = s.personality_subtitle;

    const hasShort = Boolean(report.spotify_short_term);
    els.btnSourceShort.disabled = !hasShort;
    els.btnExportShort.disabled = !hasShort;
    if (!hasShort && state.dataSource === "short_term") {
      state.dataSource = "real";
    }
    if (!hasShort && state.exportSource === "short_term") {
      state.exportSource = "real";
    }
    els.btnSourceReal.classList.toggle("is-active", state.dataSource === "real");
    els.btnSourceShort.classList.toggle("is-active", state.dataSource === "short_term");

    const view = getActiveRankings(report);
    const a1 = view.artists[0];
    const t1 = view.tracks[0];

    renderSpotlightCard(
      els.spotlightArtist,
      view.isShortTerm ? "ARTISTA Nº 1 (TOP 4 SEMANAS)" : "ARTISTA Nº 1 DO MÊS",
      a1 ? a1.name : "—",
      a1
        ? view.isShortTerm
          ? ((a1.genres && a1.genres.slice(0, 2).join(" · ")) || "Ranking oficial Spotify")
          : `${fmtNum(a1.plays)} reproduções · ${fmtNum(a1.minutes)} min`
        : "Sem registros",
      a1 && a1.image,
      a1 && a1.url
    );

    renderSpotlightCard(
      els.spotlightTrack,
      view.isShortTerm ? "MÚSICA Nº 1 (TOP 4 SEMANAS)" : "MÚSICA Nº 1 DO MÊS",
      t1 ? t1.name : "—",
      t1
        ? view.isShortTerm
          ? t1.artist_names
          : `${t1.artist_names} · ${fmtNum(t1.plays)} plays`
        : "Sem registros",
      t1 && t1.album && t1.album.image,
      t1 && t1.url
    );

    // KPIs
    els.kpiMinutes.textContent = fmtNum(s.total_minutes);
    const d = s.delta_vs_prev;
    if (d && d.minutes_pct !== null) {
      const sign = d.minutes_pct >= 0 ? "+" : "";
      const cls = d.minutes_pct >= 0 ? "delta-pos" : "delta-neg";
      els.kpiMinutesSub.innerHTML = `${s.total_hours} h · <span class="${cls}">${sign}${d.minutes_pct}% vs. ${escapeHtml(d.prev_label)}</span>`;
    } else {
      els.kpiMinutesSub.textContent = `${s.total_hours} horas ouvidas no mês`;
    }

    els.kpiPlays.textContent = fmtNum(s.total_plays);
    if (d && d.plays_pct !== null) {
      const sign = d.plays_pct >= 0 ? "+" : "";
      const cls = d.plays_pct >= 0 ? "delta-pos" : "delta-neg";
      els.kpiPlaysSub.innerHTML = `${s.avg_minutes_per_active_day} min/dia ativo · <span class="${cls}">${sign}${d.plays_pct}%</span>`;
    } else {
      els.kpiPlaysSub.textContent = `Média de ${s.avg_minutes_per_active_day} min/dia ativo`;
    }

    els.kpiArtists.textContent = fmtNum(s.unique_artists);
    els.kpiArtistsSub.textContent = d
      ? `${fmtNum(d.new_artists_count)} inéditos neste mês · ${fmtNum(s.unique_tracks)} faixas`
      : `${fmtNum(s.unique_tracks)} faixas · ${fmtNum(s.unique_albums)} álbuns`;

    const pd = s.peak_day || {};
    els.kpiPeakDay.textContent = pd.day
      ? `${String(pd.day).padStart(2, "0")}/${String(report.month_number).padStart(2, "0")} (${pd.weekday_label})`
      : "—";
    els.kpiPeakDaySub.textContent = pd.plays
      ? `${fmtNum(pd.plays)} plays · ${fmtNum(pd.minutes)} min`
      : "—";
  }

  function renderSpotlightCard(cardEl, kicker, title, meta, imgUrl, spotifyUrl) {
    const mediaBox = cardEl.querySelector(".spotlight-media");
    const bodyBox = cardEl.querySelector(".spotlight-body");
    mediaBox.innerHTML = "";
    const wrapped = createCoverImage(imgUrl, title, title);
    while (wrapped.firstChild) mediaBox.appendChild(wrapped.firstChild);

    bodyBox.innerHTML = `
      <span class="spotlight-kicker">${escapeHtml(kicker)}</span>
      <h2 class="spotlight-name" title="${escapeHtml(title)}">${escapeHtml(title)}</h2>
      <p class="spotlight-meta" title="${escapeHtml(meta)}">${escapeHtml(meta)}</p>
      ${spotifyUrl ? `<a class="spotlight-link" href="${escapeHtml(spotifyUrl)}" target="_blank" rel="noopener noreferrer">Ouvir no Spotify</a>` : ""}
    `;
  }

  function formatDeltaBadge(rankDelta) {
    if (!rankDelta || rankDelta === "same") {
      return { text: "•", cls: "same" };
    }
    if (rankDelta === "new") {
      return { text: "NOVO", cls: "new" };
    }
    if (String(rankDelta).startsWith("+")) {
      return { text: `▲ ${rankDelta.slice(1)}`, cls: "up" };
    }
    return { text: `▼ ${String(rankDelta).replace("-", "")}`, cls: "down" };
  }

  function renderRankings(report) {
    const view = getActiveRankings(report);
    els.rankingsNote.textContent = view.isShortTerm
      ? "Ranking oficial Top 4 Semanas retornado pela API do Spotify."
      : "Ordenado por reproduções reais registradas no mês (fuso de Brasília).";

    const tracksLimit = state.tracksExpanded ? 20 : 5;
    const artistsLimit = state.artistsExpanded ? 20 : 5;

    els.btnToggleTracks.textContent = state.tracksExpanded ? "Recolher Top 5" : "Mostrar Top 20";
    els.btnToggleTracks.setAttribute("aria-expanded", String(state.tracksExpanded));
    els.btnToggleArtists.textContent = state.artistsExpanded ? "Recolher Top 5" : "Mostrar Top 20";
    els.btnToggleArtists.setAttribute("aria-expanded", String(state.artistsExpanded));

    renderRankList(els.topTracksList, view.tracks.slice(0, tracksLimit), "track", view.isShortTerm);
    renderRankList(els.topArtistsList, view.artists.slice(0, artistsLimit), "artist", view.isShortTerm);
  }

  function renderRankList(container, items, kind, isShortTerm) {
    container.innerHTML = "";
    if (!items.length) {
      container.innerHTML = `<li class="empty-note">Sem itens para exibir nesta visualização.</li>`;
      return;
    }
    const maxVal = Math.max(1, ...items.map((x) => (isShortTerm ? 21 - (x.rank || 1) : x.plays || 1)));

    items.forEach((item, idx) => {
      const li = document.createElement("li");
      li.className = `rank-row${idx === 0 ? " is-top1" : ""}`;

      const posDiv = document.createElement("div");
      posDiv.className = "rank-pos";
      const numSpan = document.createElement("span");
      numSpan.className = "rank-num";
      numSpan.textContent = `${item.rank || idx + 1}`;
      posDiv.appendChild(numSpan);

      if (!isShortTerm) {
        const d = formatDeltaBadge(item.rank_delta);
        const dSpan = document.createElement("span");
        dSpan.className = `rank-delta ${d.cls}`;
        dSpan.textContent = d.text;
        posDiv.appendChild(dSpan);
      }

      const imgUrl = kind === "track" ? item.album && item.album.image : item.image;
      const coverBox = document.createElement("div");
      coverBox.className = "rank-cover";
      const coverInner = createCoverImage(imgUrl, item.name, item.name);
      while (coverInner.firstChild) coverBox.appendChild(coverInner.firstChild);

      const info = document.createElement("div");
      info.className = "rank-info";

      const titleEl = document.createElement(item.url ? "a" : "span");
      titleEl.className = "rank-title";
      titleEl.textContent = item.name;
      titleEl.title = item.name;
      if (item.url) {
        titleEl.href = item.url;
        titleEl.target = "_blank";
        titleEl.rel = "noopener noreferrer";
      }

      const subEl = document.createElement("span");
      subEl.className = "rank-sub";
      subEl.textContent = kind === "track"
        ? item.artist_names || ""
        : (item.genres && item.genres.length ? item.genres.slice(0, 2).join(" · ") : (item.top_track_name ? `Hit: ${item.top_track_name}` : "Artista"));

      const barTrack = document.createElement("div");
      barTrack.className = "rank-bar-track";
      const barFill = document.createElement("div");
      barFill.className = "rank-bar-fill";
      const val = isShortTerm ? 21 - (item.rank || idx + 1) : item.plays || 0;
      barFill.style.width = `${Math.max(8, Math.round((val / maxVal) * 100))}%`;
      barTrack.appendChild(barFill);

      info.append(titleEl, subEl, barTrack);

      const metrics = document.createElement("div");
      metrics.className = "rank-metrics";
      if (isShortTerm) {
        metrics.innerHTML = `<strong>#${item.rank || idx + 1}</strong><span>Spotify</span>`;
      } else {
        metrics.innerHTML = `<strong>${fmtNum(item.plays)}x</strong><span>${fmtNum(item.minutes)} min</span>`;
      }

      li.append(posDiv, coverBox, info, metrics);
      container.appendChild(li);
    });
  }

  function renderCuradoria(report) {
    // Obsession
    const obs = report.obsession || {};
    els.obsessionBadge.textContent = obs.plays ? `${obs.plays} plays no mês` : "—";
    els.obsessionContent.innerHTML = "";
    const obsCover = document.createElement("div");
    obsCover.className = "obsession-cover";
    const ci = createCoverImage(obs.album_image, obs.name, obs.name);
    while (ci.firstChild) obsCover.appendChild(ci.firstChild);

    const obsInfo = document.createElement("div");
    obsInfo.className = "obsession-info";
    const peakDateBr = obs.max_day_date ? obs.max_day_date.split("-").reverse().join("/") : "—";
    obsInfo.innerHTML = `
      <h4>${escapeHtml(obs.name || "—")}</h4>
      <p>${escapeHtml(obs.artist_names || "—")} · ${escapeHtml(obs.album_name || "")}</p>
      <span class="obsession-stat">Recorde: ${fmtNum(obs.max_day_plays || 0)} plays em ${escapeHtml(peakDateBr)}</span>
    `;
    els.obsessionContent.append(obsCover, obsInfo);

    // Genres or profile fallback
    els.repeatBadge.textContent = `Repeat ${report.summary.repeat_ratio.toFixed(2)}x`;
    const genres = report.top_genres || [];
    els.genresBody.innerHTML = "";
    if (genres.length > 0) {
      const maxPct = Math.max(1, ...genres.map((g) => g.pct));
      genres.slice(0, 6).forEach((g) => {
        const row = document.createElement("div");
        row.className = "genre-row";
        row.innerHTML = `
          <span class="genre-name" title="${escapeHtml(g.label)}">${escapeHtml(g.label)}</span>
          <div class="genre-track"><div class="genre-fill" style="width:${Math.max(10, Math.round((g.pct / maxPct) * 100))}%"></div></div>
          <span class="genre-pct">${g.pct}%</span>
        `;
        els.genresBody.appendChild(row);
      });
    } else {
      const s = report.summary;
      els.genresBody.innerHTML = `
        <p class="empty-note">
          Os gêneros detalhados da Spotify API são acumulados nas execuções automáticas a partir de agora.
          Neste mês, você girou <strong>${fmtNum(s.unique_albums)} álbuns</strong>,
          <strong>${fmtNum(s.unique_tracks)} faixas</strong> e manteve índice de repetição de
          <strong>${s.repeat_ratio.toFixed(2)}x por música</strong>.
        </p>
      `;
    }

    // Top Albums
    const albums = (report.top_albums || []).slice(0, 6);
    els.albumsCountBadge.textContent = `${fmtNum(report.summary.unique_albums)} no total`;
    els.topAlbumsGrid.innerHTML = "";
    albums.forEach((al) => {
      const card = document.createElement("div");
      card.className = "album-card";
      const cov = document.createElement("div");
      cov.className = "album-cover";
      const ac = createCoverImage(al.image, al.name, al.name);
      while (ac.firstChild) cov.appendChild(ac.firstChild);

      const meta = document.createElement("div");
      meta.className = "album-meta";
      meta.innerHTML = `
        <p class="album-title" title="${escapeHtml(al.name)}">${escapeHtml(al.name)}</p>
        <p class="album-artist" title="${escapeHtml(al.artist_name)}">${escapeHtml(al.artist_name)}</p>
        <span class="album-plays">${fmtNum(al.plays)} plays · ${fmtNum(al.minutes)} min</span>
      `;
      card.append(cov, meta);
      els.topAlbumsGrid.appendChild(card);
    });

    // New Discoveries
    const discoveries = report.new_discoveries || [];
    els.discoveriesGrid.innerHTML = "";
    if (!discoveries.length) {
      els.discoveriesBadge.textContent = "Mês inicial do acervo";
      els.discoveriesGrid.innerHTML = `<p class="empty-note span-2">Agosto de 2026 é o marco inicial do seu arquivo; descobertas inéditas passam a ser comparadas a partir de setembro.</p>`;
    } else {
      els.discoveriesBadge.textContent = `${report.summary.delta_vs_prev ? report.summary.delta_vs_prev.new_artists_count : discoveries.length} inéditos`;
      discoveries.forEach((d) => {
        const card = document.createElement(d.url ? "a" : "div");
        card.className = "discovery-card";
        if (d.url) {
          card.href = d.url;
          card.target = "_blank";
          card.rel = "noopener noreferrer";
        }
        const av = document.createElement("div");
        av.className = "discovery-avatar";
        const ai = createCoverImage(d.image, d.name, d.name);
        while (ai.firstChild) av.appendChild(ai.firstChild);

        const info = document.createElement("div");
        info.className = "discovery-info";
        info.innerHTML = `
          <span class="discovery-name" title="${escapeHtml(d.name)}">${escapeHtml(d.name)}</span>
          <span class="discovery-plays">${fmtNum(d.plays)} plays · ${fmtNum(d.minutes)} min</span>
        `;
        card.append(av, info);
        els.discoveriesGrid.appendChild(card);
      });
    }
  }

  function renderRhythm(report) {
    // 24h SVG chart
    const hourly = report.hourly_distribution || new Array(24).fill(0);
    const maxH = Math.max(1, ...hourly);
    const peakHour = report.summary.peak_hour || { hour: 0, label: "00h", plays: 0 };
    els.peakHourBadge.textContent = `Pico ${peakHour.label} (${peakHour.plays} plays)`;

    const svgW = 640;
    const svgH = 210;
    const padL = 12;
    const padR = 12;
    const plotW = svgW - padL - padR;
    const slotW = plotW / 24;
    const barW = slotW - 5;
    const plotTop = 18;
    const plotH = 152;

    const barsSvg = hourly
      .map((val, h) => {
        const bh = Math.max(4, Math.round((val / maxH) * plotH));
        const x = (padL + h * slotW + 2.5).toFixed(1);
        const y = plotTop + plotH - bh;
        const fill = h === peakHour.hour ? "#E89B3C" : "#1ED760";
        const lbl = h % 3 === 0 || h === peakHour.hour
          ? `<text x="${(Number(x) + barW / 2).toFixed(1)}" y="${svgH - 12}" text-anchor="middle" fill="${h === peakHour.hour ? "#E89B3C" : "#A6ADA8"}" font-family="JetBrains Mono, monospace" font-size="11">${String(h).padStart(2, "0")}h</text>`
          : "";
        return `
          <g>
            <title>${String(h).padStart(2, "0")}h: ${val} reproduções</title>
            <rect x="${x}" y="${y}" width="${barW.toFixed(1)}" height="${bh}" rx="3" fill="${fill}" opacity="${val === 0 ? 0.22 : 0.92}"></rect>
            ${lbl}
          </g>
        `;
      })
      .join("");

    els.hourlyChartWrap.innerHTML = `<svg viewBox="0 0 ${svgW} ${svgH}" role="img" aria-label="Gráfico de reproduções por hora do dia">${barsSvg}</svg>`;

    // Periods
    els.periodsRow.innerHTML = "";
    ["madrugada", "manha", "tarde", "noite"].forEach((pk) => {
      const p = report.summary.periods[pk];
      const div = document.createElement("div");
      div.className = `period-chip${pk === report.summary.dominant_period ? " is-dominant" : ""}`;
      div.innerHTML = `<strong>${escapeHtml(p.label)}</strong><span>${p.pct}%</span>`;
      els.periodsRow.appendChild(div);
    });

    // Daily Calendar
    els.streakBadge.textContent = `Sequência ${report.summary.longest_streak_days}d`;
    const cal = report.daily_calendar || [];
    const maxDayPlays = Math.max(1, ...cal.map((c) => c.plays));
    els.calendarGrid.innerHTML = "";

    if (cal.length > 0) {
      const leadingEmpty = cal[0].weekday || 0;
      for (let i = 0; i < leadingEmpty; i++) {
        const empty = document.createElement("div");
        empty.className = "cal-empty";
        els.calendarGrid.appendChild(empty);
      }
    }

    const defaultDay = state.selectedDay || (report.summary.peak_day && report.summary.peak_day.day) || (cal[0] && cal[0].day);
    cal.forEach((dayObj) => {
      const ratio = dayObj.plays / maxDayPlays;
      let lvl = 0;
      if (dayObj.plays > 0) {
        if (ratio >= 0.78) lvl = 4;
        else if (ratio >= 0.52) lvl = 3;
        else if (ratio >= 0.26) lvl = 2;
        else lvl = 1;
      }

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `cal-day lvl-${lvl}${dayObj.day === defaultDay ? " is-selected" : ""}`;
      btn.title = `${dayObj.day}/${report.month_number}: ${dayObj.plays} plays`;
      btn.innerHTML = `<span class="cal-day-num">${dayObj.day}</span><span class="cal-day-plays">${dayObj.plays || "·"}</span>`;
      btn.addEventListener("click", () => {
        state.selectedDay = dayObj.day;
        els.calendarGrid.querySelectorAll(".cal-day").forEach((b) => b.classList.remove("is-selected"));
        btn.classList.add("is-selected");
        updateCalendarInspector(dayObj, report.month_number);
      });
      els.calendarGrid.appendChild(btn);
      if (dayObj.day === defaultDay) {
        updateCalendarInspector(dayObj, report.month_number);
      }
    });

    // Multi-month evolution
    renderEvolutionChart();
  }

  function updateCalendarInspector(dayObj, monthNum) {
    if (!dayObj || dayObj.plays === 0) {
      els.calendarInspector.textContent = `${String(dayObj.day).padStart(2, "0")}/${String(monthNum).padStart(2, "0")} (${dayObj.weekday_label}): sem reproduções registradas.`;
      return;
    }
    els.calendarInspector.innerHTML =
      `<strong>${String(dayObj.day).padStart(2, "0")}/${String(monthNum).padStart(2, "0")} (${escapeHtml(dayObj.weekday_label)})</strong> · ` +
      `${fmtNum(dayObj.plays)} plays (${fmtNum(dayObj.minutes)} min) · Mais tocada: <strong>${escapeHtml(dayObj.top_track || "—")}</strong>`;
  }

  function renderEvolutionChart() {
    const months = [...((state.index && state.index.months) || [])].reverse();
    if (!months.length) {
      els.evolutionChartWrap.innerHTML = "";
      return;
    }
    const maxMin = Math.max(1, ...months.map((m) => m.total_minutes || 1));
    const svgW = 920;
    const svgH = 210;
    const slotW = svgW / months.length;
    const barW = Math.min(110, slotW * 0.56);
    const plotTop = 30;
    const plotH = 128;

    const items = months
      .map((m, idx) => {
        const cx = idx * slotW + slotW / 2;
        const bh = Math.max(14, Math.round((m.total_minutes / maxMin) * plotH));
        const by = plotTop + plotH - bh;
        const isCurrent = m.month === state.currentMonthKey;
        const fill = isCurrent ? "#1ED760" : "#2D4235";
        return `
          <g class="evo-bar" data-month="${m.month}" style="cursor:pointer">
            <title>${m.label}: ${fmtNum(m.total_minutes)} min (${fmtNum(m.total_plays)} plays)</title>
            <rect x="${(cx - barW / 2).toFixed(1)}" y="${by}" width="${barW.toFixed(1)}" height="${bh}" rx="8" fill="${fill}"></rect>
            <text x="${cx.toFixed(1)}" y="${by - 8}" text-anchor="middle" fill="${isCurrent ? "#1ED760" : "#F4F1EA"}" font-family="JetBrains Mono, monospace" font-size="12" font-weight="600">${fmtNum(m.total_minutes)}m</text>
            <text x="${cx.toFixed(1)}" y="${svgH - 22}" text-anchor="middle" fill="${isCurrent ? "#F4F1EA" : "#A6ADA8"}" font-family="Plus Jakarta Sans, sans-serif" font-size="13" font-weight="${isCurrent ? "700" : "500"}">${escapeHtml(m.short_label)}</text>
            <text x="${cx.toFixed(1)}" y="${svgH - 6}" text-anchor="middle" fill="#A6ADA8" font-family="JetBrains Mono, monospace" font-size="10">${fmtNum(m.total_plays)} plays</text>
          </g>
        `;
      })
      .join("");

    els.evolutionChartWrap.innerHTML = `<svg viewBox="0 0 ${svgW} ${svgH}" role="img" aria-label="Evolução de minutos ouvidos por mês">${items}</svg>`;
    els.evolutionChartWrap.querySelectorAll(".evo-bar").forEach((g) => {
      g.addEventListener("click", () => selectMonth(g.dataset.month));
    });
  }

  function getExportOptions() {
    const isCarousel = state.exportFormat === "carousel";
    const slide = window.SpotifyExporter.CAROUSEL_SLIDES[state.carouselSlideIdx] || window.SpotifyExporter.CAROUSEL_SLIDES[0];
    return {
      format: isCarousel ? state.carouselRatio : state.exportFormat,
      mode: isCarousel ? slide.key : state.exportMode,
      theme: state.exportTheme,
      dataSource: state.exportSource,
      handle: state.handle,
      showMetrics: state.showMetrics,
      badgeRightText: isCarousel ? slide.title : null
    };
  }

  function syncExportControlsUI() {
    const isCarousel = state.exportFormat === "carousel";
    els.groupCarouselRatio.hidden = !isCarousel;
    els.groupCardMode.hidden = isCarousel;
    els.carouselStrip.hidden = !isCarousel;
    els.btnDownloadSlide.hidden = !isCarousel;

    const effFormat = isCarousel ? state.carouselRatio : state.exportFormat;
    const dims = effFormat === "feed" ? "1080 × 1350 px · Feed 4:5" : "1080 × 1920 px · Story 9:16";
    els.previewMeta.textContent = isCarousel ? `${dims} · Slide ${state.carouselSlideIdx + 1}/5` : dims;
    els.btnDownloadMain.textContent = isCarousel
      ? "Baixar Carrossel Completo (.zip)"
      : `Baixar PNG (${effFormat === "feed" ? "1080×1350" : "1080×1920"})`;
  }

  async function refreshPreview() {
    if (!state.currentReport || !window.SpotifyExporter) return;
    syncExportControlsUI();

    const token = ++state.renderToken;
    els.previewStatus.textContent = "Renderizando capas...";
    try {
      const opts = getExportOptions();
      await window.SpotifyExporter.renderInstagramCanvas(els.previewCanvas, state.currentReport, opts);
      if (token === state.renderToken) {
        els.previewStatus.textContent = "Pronto em 1080px";
      }
    } catch (err) {
      console.error(err);
      if (token === state.renderToken) {
        els.previewStatus.textContent = "Erro ao renderizar";
      }
    }
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function handleDownloadMain() {
    if (!state.currentReport) return;
    els.btnDownloadMain.disabled = true;
    els.exportFeedback.textContent = "";

    try {
      const report = state.currentReport;
      if (state.exportFormat === "carousel") {
        const slides = window.SpotifyExporter.CAROUSEL_SLIDES;
        const offscreen = document.createElement("canvas");
        const entries = [];
        for (let i = 0; i < slides.length; i++) {
          els.exportFeedback.textContent = `Gerando slide ${i + 1} de ${slides.length}...`;
          const slide = slides[i];
          await window.SpotifyExporter.renderInstagramCanvas(offscreen, report, {
            format: state.carouselRatio,
            mode: slide.key,
            theme: state.exportTheme,
            dataSource: state.exportSource,
            handle: state.handle,
            showMetrics: state.showMetrics,
            badgeRightText: slide.title
          });
          const blob = await window.SpotifyExporter.canvasToBlob(offscreen);
          entries.push({
            name: `spotify-${report.month}-${slide.label}-${state.carouselRatio}.png`,
            data: blob
          });
        }
        const zipBlob = await window.SpotifyExporter.buildZipBlob(entries);
        triggerDownload(zipBlob, `spotify-carrossel-${report.month}-${state.carouselRatio}.zip`);
        els.exportFeedback.textContent = "Carrossel (.zip com 5 PNGs em 1080px) baixado com sucesso.";
      } else {
        const opts = getExportOptions();
        await window.SpotifyExporter.renderInstagramCanvas(els.previewCanvas, report, opts);
        const blob = await window.SpotifyExporter.canvasToBlob(els.previewCanvas);
        triggerDownload(blob, `spotify-${report.month}-${opts.mode}-${opts.format}.png`);
        els.exportFeedback.textContent = `Imagem ${opts.format === "feed" ? "1080×1350" : "1080×1920"} baixada em PNG.`;
      }
    } catch (err) {
      console.error(err);
      els.exportFeedback.textContent = `Não foi possível exportar: ${err.message}`;
    } finally {
      els.btnDownloadMain.disabled = false;
    }
  }

  async function handleDownloadCurrentSlide() {
    if (!state.currentReport) return;
    try {
      const opts = getExportOptions();
      await window.SpotifyExporter.renderInstagramCanvas(els.previewCanvas, state.currentReport, opts);
      const blob = await window.SpotifyExporter.canvasToBlob(els.previewCanvas);
      const slide = window.SpotifyExporter.CAROUSEL_SLIDES[state.carouselSlideIdx];
      triggerDownload(blob, `spotify-${state.currentReport.month}-${slide.label}-${opts.format}.png`);
      els.exportFeedback.textContent = `Slide ${state.carouselSlideIdx + 1} baixado em PNG.`;
    } catch (err) {
      els.exportFeedback.textContent = `Erro ao baixar slide: ${err.message}`;
    }
  }

  async function handleShareImage() {
    if (!state.currentReport) return;
    try {
      const opts = getExportOptions();
      await window.SpotifyExporter.renderInstagramCanvas(els.previewCanvas, state.currentReport, opts);
      const blob = await window.SpotifyExporter.canvasToBlob(els.previewCanvas);
      const file = new File([blob], `spotify-${state.currentReport.month}-${opts.mode}.png`, {
        type: "image/png"
      });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Minha Máquina do Tempo · ${state.currentReport.label}`,
          text: `Retrospectiva Spotify de ${state.currentReport.label}`
        });
        els.exportFeedback.textContent = "Compartilhamento iniciado.";
      } else {
        triggerDownload(blob, `spotify-${state.currentReport.month}-${opts.mode}-${opts.format}.png`);
        els.exportFeedback.textContent =
          "Seu navegador atual não suporta envio direto de arquivo via Share API — baixamos o PNG para você postar no Instagram.";
      }
    } catch (err) {
      if (err && err.name !== "AbortError") {
        els.exportFeedback.textContent = `Falha ao compartilhar: ${err.message}`;
      }
    }
  }

  async function selectMonth(monthKey) {
    if (!monthKey) return;
    state.currentMonthKey = monthKey;
    state.selectedDay = null;
    state.tracksExpanded = false;
    state.artistsExpanded = false;

    const url = new URL(window.location.href);
    url.searchParams.set("mes", monthKey);
    window.history.replaceState({}, "", url.toString());

    renderArchiveBar();
    setStatusBanner("");

    try {
      const report = await loadMonthReport(monthKey);
      state.currentReport = report;
      renderHero(report);
      renderRankings(report);
      renderCuradoria(report);
      renderRhythm(report);
      await refreshPreview();
    } catch (err) {
      console.error(err);
      setStatusBanner(`Não foi possível carregar os dados de ${monthKey}: ${err.message}`);
    }
  }

  function bindEvents() {
    els.btnPrevMonth.addEventListener("click", () => {
      const months = (state.index && state.index.months) || [];
      const idx = months.findIndex((m) => m.month === state.currentMonthKey);
      if (idx >= 0 && idx < months.length - 1) {
        selectMonth(months[idx + 1].month);
      }
    });

    els.btnNextMonth.addEventListener("click", () => {
      const months = (state.index && state.index.months) || [];
      const idx = months.findIndex((m) => m.month === state.currentMonthKey);
      if (idx > 0) {
        selectMonth(months[idx - 1].month);
      }
    });

    document.addEventListener("keydown", (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowLeft") els.btnPrevMonth.click();
      if (e.key === "ArrowRight") els.btnNextMonth.click();
    });

    els.btnSourceReal.addEventListener("click", () => {
      state.dataSource = "real";
      if (state.currentReport) {
        renderHero(state.currentReport);
        renderRankings(state.currentReport);
      }
    });

    els.btnSourceShort.addEventListener("click", () => {
      if (els.btnSourceShort.disabled) return;
      state.dataSource = "short_term";
      if (state.currentReport) {
        renderHero(state.currentReport);
        renderRankings(state.currentReport);
      }
    });

    els.btnToggleTracks.addEventListener("click", () => {
      state.tracksExpanded = !state.tracksExpanded;
      if (state.currentReport) renderRankings(state.currentReport);
    });

    els.btnToggleArtists.addEventListener("click", () => {
      state.artistsExpanded = !state.artistsExpanded;
      if (state.currentReport) renderRankings(state.currentReport);
    });

    // Studio controls
    els.ctrlFormat.querySelectorAll("[data-format]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.exportFormat = btn.dataset.format;
        els.ctrlFormat.querySelectorAll("[data-format]").forEach((b) => b.classList.toggle("is-active", b === btn));
        refreshPreview();
      });
    });

    els.ctrlCarouselRatio.querySelectorAll("[data-ratio]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.carouselRatio = btn.dataset.ratio;
        els.ctrlCarouselRatio.querySelectorAll("[data-ratio]").forEach((b) => b.classList.toggle("is-active", b === btn));
        refreshPreview();
      });
    });

    els.ctrlMode.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.exportMode = btn.dataset.mode;
        els.ctrlMode.querySelectorAll("[data-mode]").forEach((b) => b.classList.toggle("is-active", b === btn));
        refreshPreview();
      });
    });

    els.ctrlTheme.querySelectorAll("[data-theme]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.exportTheme = btn.dataset.theme;
        els.ctrlTheme.querySelectorAll("[data-theme]").forEach((b) => b.classList.toggle("is-active", b === btn));
        refreshPreview();
      });
    });

    els.ctrlExportSource.querySelectorAll("[data-export-source]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        state.exportSource = btn.dataset.exportSource;
        els.ctrlExportSource.querySelectorAll("[data-export-source]").forEach((b) => b.classList.toggle("is-active", b === btn));
        refreshPreview();
      });
    });

    els.carouselStrip.querySelectorAll("[data-slide]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.carouselSlideIdx = Number(btn.dataset.slide) || 0;
        els.carouselStrip.querySelectorAll("[data-slide]").forEach((b) => b.classList.toggle("is-active", b === btn));
        refreshPreview();
      });
    });

    let handleTimer = null;
    els.inputHandle.addEventListener("input", () => {
      state.handle = els.inputHandle.value;
      try {
        localStorage.setItem(HANDLE_STORAGE_KEY, state.handle);
      } catch (_) {}
      clearTimeout(handleTimer);
      handleTimer = setTimeout(refreshPreview, 220);
    });

    els.chkShowMetrics.addEventListener("change", () => {
      state.showMetrics = els.chkShowMetrics.checked;
      refreshPreview();
    });

    els.btnDownloadMain.addEventListener("click", handleDownloadMain);
    els.btnDownloadSlide.addEventListener("click", handleDownloadCurrentSlide);
    els.btnShareImage.addEventListener("click", handleShareImage);
  }

  function cacheElements() {
    els.archiveStats = qs("archive-stats");
    els.monthPills = qs("month-pills");
    els.btnPrevMonth = qs("btn-prev-month");
    els.btnNextMonth = qs("btn-next-month");
    els.statusBanner = qs("status-banner");
    els.editionBadge = qs("edition-badge");
    els.personalityPill = qs("personality-pill");
    els.coverageNote = qs("coverage-note");
    els.monthTitle = qs("month-title");
    els.personalitySubtitle = qs("personality-subtitle");
    els.btnSourceReal = qs("btn-source-real");
    els.btnSourceShort = qs("btn-source-short");
    els.spotlightArtist = qs("spotlight-artist");
    els.spotlightTrack = qs("spotlight-track");
    els.kpiMinutes = qs("kpi-minutes");
    els.kpiMinutesSub = qs("kpi-minutes-sub");
    els.kpiPlays = qs("kpi-plays");
    els.kpiPlaysSub = qs("kpi-plays-sub");
    els.kpiArtists = qs("kpi-artists");
    els.kpiArtistsSub = qs("kpi-artists-sub");
    els.kpiPeakDay = qs("kpi-peak-day");
    els.kpiPeakDaySub = qs("kpi-peak-day-sub");
    els.rankingsNote = qs("rankings-note");
    els.topTracksList = qs("top-tracks-list");
    els.topArtistsList = qs("top-artists-list");
    els.btnToggleTracks = qs("btn-toggle-tracks");
    els.btnToggleArtists = qs("btn-toggle-artists");
    els.obsessionBadge = qs("obsession-badge");
    els.obsessionContent = qs("obsession-content");
    els.repeatBadge = qs("repeat-badge");
    els.genresBody = qs("genres-body");
    els.albumsCountBadge = qs("albums-count-badge");
    els.topAlbumsGrid = qs("top-albums-grid");
    els.discoveriesBadge = qs("discoveries-badge");
    els.discoveriesGrid = qs("discoveries-grid");
    els.peakHourBadge = qs("peak-hour-badge");
    els.hourlyChartWrap = qs("hourly-chart-wrap");
    els.periodsRow = qs("periods-row");
    els.streakBadge = qs("streak-badge");
    els.calendarGrid = qs("calendar-grid");
    els.calendarInspector = qs("calendar-inspector");
    els.evolutionChartWrap = qs("evolution-chart-wrap");
    els.ctrlFormat = qs("ctrl-format");
    els.groupCarouselRatio = qs("group-carousel-ratio");
    els.ctrlCarouselRatio = qs("ctrl-carousel-ratio");
    els.groupCardMode = qs("group-card-mode");
    els.ctrlMode = qs("ctrl-mode");
    els.ctrlTheme = qs("ctrl-theme");
    els.ctrlExportSource = qs("ctrl-export-source");
    els.btnExportShort = qs("btn-export-short");
    els.inputHandle = qs("input-handle");
    els.chkShowMetrics = qs("chk-show-metrics");
    els.btnDownloadMain = qs("btn-download-main");
    els.btnDownloadSlide = qs("btn-download-slide");
    els.btnShareImage = qs("btn-share-image");
    els.exportFeedback = qs("export-feedback");
    els.previewMeta = qs("preview-meta");
    els.previewStatus = qs("preview-status");
    els.carouselStrip = qs("carousel-strip");
    els.previewCanvas = qs("export-preview-canvas");
  }

  async function init() {
    cacheElements();
    try {
      const savedHandle = localStorage.getItem(HANDLE_STORAGE_KEY);
      if (savedHandle) {
        state.handle = savedHandle;
        els.inputHandle.value = savedHandle;
      }
    } catch (_) {}

    bindEvents();

    try {
      const index = await fetchJson(`${DATA_BASE}/index.json`);
      state.index = index;
      const params = new URLSearchParams(window.location.search);
      const requested = params.get("mes");
      const validSet = new Set((index.months || []).map((m) => m.month));
      const initialMonth = requested && validSet.has(requested) ? requested : index.default_month;
      if (!initialMonth) {
        setStatusBanner("Nenhum mês foi arquivado ainda em spotify/monthly/index.json.");
        return;
      }
      await selectMonth(initialMonth);
    } catch (err) {
      console.error(err);
      setStatusBanner(`Erro ao inicializar Máquina do Tempo: ${err.message}`);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
