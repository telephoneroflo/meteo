/* =========================================================
   weather.js — récupération et fusion des prévisions
   ---------------------------------------------------------
   Trois sources Open-Meteo interrogées en parallèle :
     A · meteofrance_arome_france_hd  → maille 1,5 km, 0-48 h  (le plus fin)
     B · meteofrance_seamless         → AROME + ARPEGE, 0-4 j
     C · multi-modèle par défaut      → 0-7 j, seule source du
                                        risque de précipitation
   Priorité A > B > C, champ par champ, heure par heure.
   Météo-France ne publie pas de probabilité de précipitation :
   elle vient donc toujours de C (ensembles multi-modèles).
   ========================================================= */
(function (global) {
  'use strict';

  var BASE = 'https://api.open-meteo.com/v1/forecast';
  var HOURLY = 'temperature_2m,weather_code,precipitation,is_day';
  var DAILY  = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset';
  var CURRENT = 'temperature_2m,weather_code,is_day';

  /* ---------- helpers temps ---------- */

  /* "2026-08-10T09:02:14" dans le fuseau demandé (le format sv-SE est déjà ISO) */
  function zoneStamp(tz, d) {
    d = d || new Date();
    try {
      var f = new Intl.DateTimeFormat('sv-SE', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      });
      return f.format(d).replace(' ', 'T');
    } catch (e) {
      return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 19);
    }
  }
  function addDaysISO(dateISO, n) {
    var p = dateISO.split('-');
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  var DOW = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  function dowOf(dateISO) {
    var p = dateISO.split('-');
    return DOW[new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay()];
  }

  /* ---------- requêtes ---------- */

  function url(lat, lon, opts) {
    var q = '?latitude=' + lat.toFixed(5) + '&longitude=' + lon.toFixed(5) +
      '&timezone=auto&hourly=' + opts.hourly + '&daily=' + opts.daily +
      '&forecast_days=' + opts.days;
    if (opts.current) q += '&current=' + CURRENT;
    if (opts.models) q += '&models=' + opts.models;
    return BASE + q;
  }

  function grab(u) {
    return fetch(u, { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (j) {
        if (j && j.error) throw new Error(j.reason || 'Réponse en erreur');
        return j;
      })
      .catch(function () { return null; });   // une source absente ne bloque pas
    }

  /* index { "2026-08-10T09:00": position } */
  function indexOf(times) {
    var m = {};
    if (!times) return m;
    for (var i = 0; i < times.length; i++) m[times[i].slice(0, 16)] = i;
    return m;
  }
  function val(src, block, field, key) {
    if (!src || !src[block] || !src[block][field]) return null;
    var i = src['_ix_' + block][key];
    if (i === undefined) return null;
    var v = src[block][field][i];
    return (v === null || v === undefined) ? null : v;
  }
  /* premier non-null parmi les sources, avec l'étiquette du modèle */
  function pick(list, block, field, key) {
    for (var i = 0; i < list.length; i++) {
      var v = val(list[i].data, block, field, key);
      if (v !== null) return { v: v, src: list[i].name };
    }
    return { v: null, src: null };
  }

  /* ---------- API publique ---------- */

  function load(lat, lon) {
    var reqA = grab(url(lat, lon, { hourly: HOURLY, daily: DAILY, days: 2, current: true, models: 'meteofrance_arome_france_hd' }));
    var reqB = grab(url(lat, lon, { hourly: HOURLY, daily: DAILY, days: 4, current: true, models: 'meteofrance_seamless' }));
    var reqC = grab(url(lat, lon, {
      hourly: HOURLY + ',precipitation_probability',
      daily: DAILY + ',precipitation_probability_max',
      days: 7, current: true
    }));

    return Promise.all([reqA, reqB, reqC]).then(function (res) {
      var A = res[0], B = res[1], C = res[2];
      if (!A && !B && !C) throw new Error('reseau');

      [A, B, C].forEach(function (s) {
        if (!s) return;
        s._ix_hourly = indexOf(s.hourly && s.hourly.time);
        s._ix_daily = indexOf(s.daily && s.daily.time);
      });

      var ref = A || B || C;
      var tz = ref.timezone || 'Europe/Paris';
      var chain = [];
      if (A) chain.push({ name: 'AROME HD', data: A });
      if (B) chain.push({ name: 'AROME/ARPEGE', data: B });
      if (C) chain.push({ name: 'multi-modèle', data: C });

      var stamp = zoneStamp(tz);             // "2026-08-10T09:02:14"
      var today = stamp.slice(0, 10);

      /* ----- heure par heure : H → H+12 ----- */
      var hours = [];
      var cursorDate = today;
      var cursorHour = parseInt(stamp.slice(11, 13), 10);
      for (var h = 0; h <= 12; h++) {
        var hh = cursorHour + h;
        var dayShift = Math.floor(hh / 24);
        var key = addDaysISO(cursorDate, dayShift) + 'T' + String(hh % 24).padStart(2, '0') + ':00';

        var t = pick(chain, 'hourly', 'temperature_2m', key);
        var c = pick(chain, 'hourly', 'weather_code', key);
        var p = pick(chain, 'hourly', 'precipitation', key);
        var d = pick(chain, 'hourly', 'is_day', key);
        var pr = val(C, 'hourly', 'precipitation_probability', key);

        hours.push({
          key: key,
          hour: String(hh % 24).padStart(2, '0') + ':00',
          isNow: h === 0,
          temp: t.v,
          code: c.v,
          isDay: d.v === null ? true : !!d.v,
          mm: p.v,
          prob: pr,
          source: t.src
        });
      }

      /* ----- 5 jours, de demain à J+5 ----- */
      var days = [];
      for (var k = 1; k <= 5; k++) {
        var dk = addDaysISO(today, k);
        var mx = pick(chain, 'daily', 'temperature_2m_max', dk);
        var mn = pick(chain, 'daily', 'temperature_2m_min', dk);
        var cd = pick(chain, 'daily', 'weather_code', dk);
        var sm = pick(chain, 'daily', 'precipitation_sum', dk);
        var pb = val(C, 'daily', 'precipitation_probability_max', dk);

        days.push({
          date: dk,
          dow: dowOf(dk),
          label: dk.slice(8, 10) + '/' + dk.slice(5, 7),
          tmax: mx.v, tmin: mn.v, code: cd.v, mm: sm.v, prob: pb,
          source: mx.src
        });
      }

      /* ----- conditions actuelles ----- */
      function cur(field) {
        for (var i = 0; i < chain.length; i++) {
          var s = chain[i].data;
          if (s && s.current && s.current[field] !== null && s.current[field] !== undefined) {
            return { v: s.current[field], src: chain[i].name };
          }
        }
        return { v: null, src: null };
      }
      var ct = cur('temperature_2m'), cc = cur('weather_code'), cdd = cur('is_day');
      if (ct.v === null && hours[0]) { ct = { v: hours[0].temp, src: hours[0].source }; }
      if (cc.v === null && hours[0]) { cc = { v: hours[0].code, src: hours[0].source }; }

      /* ----- lever / coucher du jour ----- */
      var rise = pick(chain, 'daily', 'sunrise', today).v;
      var set = pick(chain, 'daily', 'sunset', today).v;

      /* ----- horodatage du dernier run disponible ----- */
      var updated = null;
      for (var q = 0; q < chain.length; q++) {
        var s2 = chain[q].data;
        if (s2 && s2.current && s2.current.time) { updated = s2.current.time; break; }
      }

      return {
        tz: tz,
        elevation: ref.elevation,
        today: today,
        current: {
          temp: ct.v, code: cc.v,
          isDay: cdd.v === null ? true : !!cdd.v,
          source: ct.src || 'multi-modèle'
        },
        sun: { rise: rise, set: set },
        hours: hours,
        days: days,
        updated: updated,
        fetchedAt: Date.now()
      };
    });
  }

  /* aperçu léger pour les vignettes de l'accueil */
  function quick(lat, lon) {
    var u = BASE + '?latitude=' + lat.toFixed(5) + '&longitude=' + lon.toFixed(5) +
            '&timezone=auto&forecast_days=1&current=' + CURRENT + '&models=meteofrance_seamless';
    return grab(u).then(function (j) {
      if (!j || !j.current) return null;
      return {
        temp: j.current.temperature_2m,
        code: j.current.weather_code,
        isDay: j.current.is_day === undefined ? true : !!j.current.is_day,
        tz: j.timezone
      };
    });
  }

  global.Weather = { load: load, quick: quick, zoneStamp: zoneStamp };
})(window);
