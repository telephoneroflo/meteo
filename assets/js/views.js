/* =========================================================
   views.js — rendu
   ---------------------------------------------------------
   Règle de design : la température n'est jamais seulement
   écrite, elle est toujours dessinée. Une seule échelle
   chromatique (froid → chaud) porte toute la couleur du site.
   ========================================================= */
(function (global) {
  'use strict';

  /* ---------- échelle thermique ---------- */
  var STOPS = [
    [-18, [143, 168, 255]],
    [0,   [127, 178, 255]],
    [7,   [ 87, 199, 228]],
    [14,  [111, 217, 174]],
    [21,  [240, 198,  79]],
    [28,  [240, 139,  62]],
    [35,  [226,  84,  59]],
    [45,  [200,  54,  43]]
  ];
  function tc(t) {
    if (t === null || t === undefined || isNaN(t)) return '#8CA3AE';
    if (t <= STOPS[0][0]) return rgb(STOPS[0][1]);
    var last = STOPS[STOPS.length - 1];
    if (t >= last[0]) return rgb(last[1]);
    for (var i = 0; i < STOPS.length - 1; i++) {
      var a = STOPS[i], b = STOPS[i + 1];
      if (t >= a[0] && t <= b[0]) {
        var k = (t - a[0]) / (b[0] - a[0]);
        return rgb([
          Math.round(a[1][0] + (b[1][0] - a[1][0]) * k),
          Math.round(a[1][1] + (b[1][1] - a[1][1]) * k),
          Math.round(a[1][2] + (b[1][2] - a[1][2]) * k)
        ]);
      }
    }
    return '#8CA3AE';
  }
  function rgb(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }

  /* ---------- petits utilitaires ---------- */
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function deg(v) { return (v === null || v === undefined) ? '—' : Math.round(v) + '°'; }
  function mm(v) { return (v === null || v === undefined) ? '—' : v.toFixed(1) + ' mm'; }
  function pct(v) { return (v === null || v === undefined) ? '—' : Math.round(v) + ' %'; }
  function minutesOf(iso) {
    if (!iso) return null;
    return parseInt(iso.slice(11, 13), 10) * 60 + parseInt(iso.slice(14, 16), 10);
  }
  function el(id) { return document.getElementById(id); }

  /* =========================================================
     ACCUEIL
     ========================================================= */
  function renderHome() {
    var list = Store.all();
    var grid = el('places-grid');
    var empty = el('places-empty');

    empty.hidden = list.length > 0;
    grid.innerHTML = list.map(function (p) {
      return '<a class="place" href="#/lieu/' + esc(p.id) + '" data-link data-pid="' + esc(p.id) + '">' +
        '<p class="place__name">' + esc(p.name) + '</p>' +
        '<p class="place__addr">' + esc(p.address) + '</p>' +
        '<div class="place__foot">' +
          '<span class="place__temp" data-slot="temp"><span class="place__ph">relevé…</span></span>' +
          '<span class="place__ico" data-slot="ico"></span>' +
        '</div></a>';
    }).join('');

    list.forEach(function (p) {
      Weather.quick(p.lat, p.lon).then(function (q) {
        var card = grid.querySelector('[data-pid="' + p.id + '"]');
        if (!card || !q) return;
        var t = card.querySelector('[data-slot="temp"]');
        var ic = card.querySelector('[data-slot="ico"]');
        t.innerHTML = (q.temp === null ? '<span class="place__ph">indisponible</span>'
          : Math.round(q.temp) + '<small>°C</small>');
        t.style.color = tc(q.temp);
        ic.innerHTML = WXIcons.svg(q.code, q.isDay);
      });
    });
  }

  /* =========================================================
     PRÉVISIONS
     ========================================================= */
  var clockTimer = null;

  function stopClock() {
    if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
  }

  function renderForecast(place, data) {
    el('fc-name').textContent = place.name;
    el('fc-eyebrow').textContent = place.address;

    /* --- maintenant --- */
    var cur = data.current;
    var tEl = el('now-temp');
    tEl.textContent = (cur.temp === null) ? '--' : (Math.round(cur.temp * 10) / 10).toString().replace('.', ',');
    tEl.style.color = tc(cur.temp);
    el('now-icon').innerHTML = WXIcons.svg(cur.code, cur.isDay);
    el('now-cond').textContent = WXIcons.label(cur.code);
    el('now-model').textContent = cur.source;
    el('now-updated').textContent = data.updated
      ? 'maj ' + data.updated.slice(11, 16)
      : 'maj —';
    el('topbar-meta').textContent = 'Maille 1,5 km · altitude ' +
      (data.elevation === undefined ? '—' : Math.round(data.elevation) + ' m') + ' · ' + data.tz;

    /* horloge locale du lieu */
    stopClock();
    function tick() {
      el('now-clock').textContent = Weather.zoneStamp(data.tz).slice(11, 19);
    }
    tick();
    clockTimer = setInterval(tick, 1000);

    renderSun(data);
    renderDays(data.days);
    renderHours(data.hours);

    var srcs = {};
    data.days.forEach(function (d) { if (d.source) srcs[d.source] = (srcs[d.source] || 0) + 1; });
    var parts = Object.keys(srcs).map(function (k) { return k + ' ×' + srcs[k]; });
    document.querySelector('.card--days .tag--dim').textContent =
      parts.length ? parts.join(' · ') : 'min → max · risque · cumul';
  }

  /* --- arc solaire : position réelle du soleil entre lever et coucher --- */
  function renderSun(data) {
    var rise = data.sun.rise, set = data.sun.set;
    el('sun-rise').textContent = rise ? rise.slice(11, 16) : '--:--';
    el('sun-set').textContent = set ? set.slice(11, 16) : '--:--';

    var svg = el('sun-svg');
    var r = minutesOf(rise), s = minutesOf(set);
    var nowStamp = Weather.zoneStamp(data.tz);
    var n = parseInt(nowStamp.slice(11, 13), 10) * 60 + parseInt(nowStamp.slice(14, 16), 10);

    var f = (r !== null && s !== null && s > r) ? (n - r) / (s - r) : 0;
    var daylight = f >= 0 && f <= 1;
    f = Math.max(0, Math.min(1, f));

    /* courbe quadratique P0(10,68) P1(150,-16) P2(290,68) */
    function pt(t) {
      var u = 1 - t;
      return [
        u * u * 10 + 2 * u * t * 150 + t * t * 290,
        u * u * 68 + 2 * u * t * -16 + t * t * 68
      ];
    }
    var p = pt(f);
    var seg = '';
    for (var i = 0; i <= 40; i++) {
      var q = pt(i / 40);
      seg += (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1);
    }

    svg.innerHTML =
      '<defs><linearGradient id="sunGrad" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0%" stop-color="#57C7E4"/>' +
        '<stop offset="50%" stop-color="#F0C64F"/>' +
        '<stop offset="100%" stop-color="#F08B3E"/>' +
      '</linearGradient></defs>' +
      '<line x1="0" y1="68" x2="300" y2="68" stroke="rgba(160,200,215,.16)" stroke-width="1"/>' +
      '<path d="' + seg + '" fill="none" stroke="url(#sunGrad)" stroke-width="1.6" ' +
        'stroke-linecap="round" opacity="' + (daylight ? '.85' : '.28') + '" ' +
        'stroke-dasharray="' + (daylight ? '0' : '3 4') + '"/>' +
      (daylight
        ? '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="11" fill="#F0C64F" opacity=".16"/>' +
          '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="5.5" fill="#F0C64F"/>'
        : '<circle cx="150" cy="74" r="4.5" fill="#CBD9E2" opacity=".7"/>');
  }

  /* --- 5 jours : barre min→max sur une échelle commune --- */
  function renderDays(days) {
    var lo = Infinity, hi = -Infinity;
    days.forEach(function (d) {
      if (d.tmin !== null) lo = Math.min(lo, d.tmin);
      if (d.tmax !== null) hi = Math.max(hi, d.tmax);
    });
    if (!isFinite(lo) || !isFinite(hi) || hi === lo) { lo = 0; hi = 1; }
    var span = hi - lo;

    el('days').innerHTML = days.map(function (d) {
      var has = d.tmin !== null && d.tmax !== null;
      var left = has ? ((d.tmin - lo) / span) * 100 : 0;
      var wid = has ? Math.max(3, ((d.tmax - d.tmin) / span) * 100) : 0;
      var wet = d.mm !== null && d.mm >= 0.1;

      return '<div class="d" title="' + esc(WXIcons.label(d.code) + ' — source ' + (d.source || '—')) + '">' +
        '<span class="d-day">' + d.dow.slice(0, 3) + '</span>' +
        '<span class="d-date">' + d.label + '</span>' +
        '<span class="d-t d-t--min" style="color:' + tc(d.tmin) + '">' + deg(d.tmin) + '</span>' +
        '<span class="d-scale"><span class="d-track"></span>' +
          (has ? '<span class="d-bar" style="left:' + left.toFixed(1) + '%;width:' + wid.toFixed(1) +
                 '%;background:linear-gradient(90deg,' + tc(d.tmin) + ',' + tc(d.tmax) + ')"></span>' : '') +
        '</span>' +
        '<span class="d-t d-t--max" style="color:' + tc(d.tmax) + '">' + deg(d.tmax) + '</span>' +
        '<span class="d-prob">' + (d.prob === null ? '—' : '<b>' + Math.round(d.prob) + '</b> %') + '</span>' +
        '<span class="d-mm' + (wet ? ' is-wet' : '') + '">' + mm(d.mm) + '</span>' +
        '<span class="d-ico">' + WXIcons.svg(d.code, true) + '</span>' +
      '</div>';
    }).join('');
  }

  /* --- ruban horaire : la courbe des températures est l'ossature --- */
  function renderHours(hours) {
    var COL = 78, H = 104, TOP = 30, BOT = 84;
    var n = hours.length;
    var W = COL * n;

    var temps = hours.map(function (h) { return h.temp; });
    var known = temps.filter(function (t) { return t !== null; });
    var lo = known.length ? Math.min.apply(null, known) : 0;
    var hi = known.length ? Math.max.apply(null, known) : 1;
    if (hi === lo) hi = lo + 1;

    function y(t) { return BOT - ((t - lo) / (hi - lo)) * (BOT - TOP); }

    var pts = [];
    for (var i = 0; i < n; i++) {
      var t = temps[i];
      if (t === null) { pts.push(null); continue; }
      pts.push([COL * i + COL / 2, y(t)]);
    }
    var solid = pts.filter(Boolean);

    /* lissage Catmull-Rom → cubiques */
    var path = '';
    if (solid.length > 1) {
      path = 'M' + solid[0][0].toFixed(1) + ' ' + solid[0][1].toFixed(1);
      for (var k = 0; k < solid.length - 1; k++) {
        var p0 = solid[Math.max(0, k - 1)], p1 = solid[k],
            p2 = solid[k + 1], p3 = solid[Math.min(solid.length - 1, k + 2)];
        var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
        var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
        path += 'C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ',' +
                      c2x.toFixed(1) + ' ' + c2y.toFixed(1) + ',' +
                      p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
      }
    }

    var stops = '';
    for (var s = 0; s < n; s++) {
      if (temps[s] === null) continue;
      stops += '<stop offset="' + ((s / (n - 1)) * 100).toFixed(1) + '%" stop-color="' + tc(temps[s]) + '"/>';
    }

    var dots = '', labels = '';
    for (var d2 = 0; d2 < n; d2++) {
      if (!pts[d2]) continue;
      var col = tc(temps[d2]);
      dots += '<circle cx="' + pts[d2][0].toFixed(1) + '" cy="' + pts[d2][1].toFixed(1) +
              '" r="3.1" fill="' + col + '"/>';
      labels += '<text x="' + pts[d2][0].toFixed(1) + '" y="' + (pts[d2][1] - 12).toFixed(1) +
                '" text-anchor="middle" fill="' + col + '" font-size="13.5" font-weight="600" ' +
                'font-family="Archivo, sans-serif">' + Math.round(temps[d2]) + '°</text>';
    }

    var area = path
      ? '<path d="' + path + 'L' + solid[solid.length - 1][0].toFixed(1) + ' ' + (H + 2) +
        'L' + solid[0][0].toFixed(1) + ' ' + (H + 2) + 'Z" fill="url(#ribbon)" opacity=".12"/>'
      : '';

    var svg =
      '<svg class="hours__svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" ' +
      'xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<defs><linearGradient id="ribbon" x1="0" y1="0" x2="1" y2="0">' + stops + '</linearGradient></defs>' +
      area +
      (path ? '<path d="' + path + '" fill="none" stroke="url(#ribbon)" stroke-width="2.4" ' +
              'stroke-linecap="round" stroke-linejoin="round"/>' : '') +
      dots + labels +
      '</svg>';

    var cols = '<div class="hours__cols" style="grid-template-columns:repeat(' + n + ',' + COL + 'px)">' +
      hours.map(function (h) {
        var wet = h.mm !== null && h.mm >= 0.1;
        return '<div class="hcell' + (h.isNow ? ' is-now' : '') + '">' +
          '<div class="hcell__ico">' + WXIcons.svg(h.code, h.isDay) + '</div>' +
          '<span class="hcell__h">' + (h.isNow ? 'maint.' : h.hour) + '</span>' +
          '<span class="hcell__p' + (h.prob === null ? ' is-null' : '') + '">' + pct(h.prob) + '</span>' +
          '<span class="hcell__mm' + (wet ? ' is-wet' : '') + '">' +
            (h.mm === null ? '—' : h.mm.toFixed(1)) + '</span>' +
        '</div>';
      }).join('') + '</div>';

    var wrap = el('hours');
    wrap.style.width = W + 'px';
    wrap.innerHTML = svg + cols;
    el('hours-range').textContent = hours[0].hour + ' → ' + hours[n - 1].hour + ' (heure locale)';
  }

  global.Views = {
    home: renderHome,
    forecast: renderForecast,
    stopClock: stopClock,
    tc: tc,
    esc: esc
  };
})(window);
