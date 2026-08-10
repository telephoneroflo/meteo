/* =========================================================
   app.js — routeur et parcours de création
   Routes : #/            accueil
            #/nouveau     création d'un lieu
            #/lieu/<id>   prévisions
   Le routage par ancre fonctionne tel quel sur GitHub Pages :
   aucune règle de réécriture, aucune page 404 à prévoir.
   ========================================================= */
(function () {
  'use strict';

  var VIEWS = ['view-home', 'view-new', 'view-fc', 'view-load'];
  function show(id) {
    VIEWS.forEach(function (v) { document.getElementById(v).hidden = (v !== id); });
    if (id !== 'view-fc') Views.stopClock();
  }
  function el(id) { return document.getElementById(id); }
  function say(node, msg, isErr) {
    node.textContent = msg || '';
    node.classList.toggle('status--err', !!isErr);
  }

  /* =========================================================
     Création d'un lieu — état du parcours
     ========================================================= */
  var draft = { name: '', query: '', chosen: null, results: [] };

  function setStep(n) {
    [1, 2, 3].forEach(function (i) { el('step-' + i).hidden = (i !== n); });
    Array.prototype.forEach.call(document.querySelectorAll('.stepper__i'), function (li) {
      li.classList.toggle('is-on', +li.dataset.step === n);
    });
    if (n === 2) {
      Geo.ensureMap('map');
      if (draft.chosen) Geo.setPoint(draft.chosen.lat, draft.chosen.lon, 16);
    }
  }

  function resetNew() {
    draft = { name: '', query: '', chosen: null, results: [] };
    el('in-name').value = '';
    el('in-addr').value = '';
    el('results').innerHTML = '';
    say(el('status-1'), '');
    say(el('status-3'), '');
    setStep(1);
  }

  function paintResults() {
    el('results').innerHTML = draft.results.map(function (r, i) {
      var on = draft.chosen && draft.chosen.lat === r.lat && draft.chosen.lon === r.lon;
      return '<li><button type="button" class="result' + (on ? ' is-on' : '') + '" data-i="' + i + '">' +
        Views.esc(r.label) + '<small>' + Views.esc(r.sub || '') + ' · ' + r.origin + '</small>' +
        '</button></li>';
    }).join('');
  }

  function chooseResult(r, moveMap) {
    draft.chosen = r;
    paintResults();
    if (moveMap) Geo.setPoint(r.lat, r.lon, 16);
  }

  function runSearch() {
    var q = el('in-addr').value.trim();
    draft.name = el('in-name').value.trim();
    draft.query = q;
    if (q.length < 3) { say(el('status-1'), 'Saisissez au moins 3 caractères.', true); return; }

    el('btn-search').disabled = true;
    say(el('status-1'), 'Recherche dans la Base Adresse Nationale…');

    Geo.search(q).then(function (list) {
      el('btn-search').disabled = false;
      if (!list.length) {
        say(el('status-1'), 'Aucune adresse ne correspond. Essayez avec le code postal ou la commune seule.', true);
        return;
      }
      say(el('status-1'), '');
      draft.results = list;
      draft.chosen = list[0];
      setStep(2);
      paintResults();
      Geo.setPoint(list[0].lat, list[0].lon, 16);
    }).catch(function () {
      el('btn-search').disabled = false;
      say(el('status-1'), 'La recherche a échoué. Vérifiez la connexion, puis relancez.', true);
    });
  }

  function useGeoloc() {
    if (!navigator.geolocation) {
      say(el('status-1'), 'Ce navigateur ne donne pas accès à la position.', true);
      return;
    }
    say(el('status-1'), 'Localisation en cours…');
    navigator.geolocation.getCurrentPosition(function (pos) {
      var lat = pos.coords.latitude, lon = pos.coords.longitude;
      Geo.reverse(lat, lon).then(function (hit) {
        var r = hit || { label: lat.toFixed(4) + ', ' + lon.toFixed(4), sub: 'Point GPS', lat: lat, lon: lon, origin: 'GPS' };
        r.lat = lat; r.lon = lon;
        draft.name = el('in-name').value.trim();
        draft.results = [r];
        draft.chosen = r;
        say(el('status-1'), '');
        setStep(2);
        paintResults();
        Geo.setPoint(lat, lon, 16);
      });
    }, function () {
      say(el('status-1'), 'Position refusée ou indisponible. Saisissez l’adresse à la main.', true);
    }, { enableHighAccuracy: true, timeout: 12000 });
  }

  function toConfirm() {
    if (!draft.chosen) { return; }
    var c = draft.chosen;
    var nm = draft.name || c.city || c.label;
    el('confirm-card').innerHTML =
      '<dl>' +
      '<dt>Nom</dt><dd>' + Views.esc(nm) + '</dd>' +
      '<dt>Adresse</dt><dd>' + Views.esc(c.label) + (c.sub ? '<br><span style="color:var(--fg-3)">' + Views.esc(c.sub) + '</span>' : '') + '</dd>' +
      '<dt>Point</dt><dd>' + c.lat.toFixed(5) + ', ' + c.lon.toFixed(5) + '</dd>' +
      '<dt>Source</dt><dd>' + Views.esc(c.origin) + '</dd>' +
      '</dl>';
    draft.finalName = nm;
    setStep(3);
  }

  function savePlace() {
    var c = draft.chosen;
    if (!c) return;
    var p = Store.add({
      name: draft.finalName || c.label,
      address: c.label,
      sub: c.sub || '',
      lat: c.lat,
      lon: c.lon
    });
    if (!Store.persistent) {
      say(el('status-3'), 'Enregistré pour cette session seulement : le navigateur bloque le stockage local.', true);
    }
    location.hash = '#/lieu/' + p.id;
  }

  /* =========================================================
     Prévisions
     ========================================================= */
  var currentPlace = null;

  function openForecast(id) {
    var p = Store.get(id);
    if (!p) { location.hash = '#/'; return; }
    currentPlace = p;
    show('view-load');
    el('load-txt').textContent = 'Interrogation de la grille AROME pour ' + p.name + '…';

    Weather.load(p.lat, p.lon).then(function (data) {
      show('view-fc');
      Views.forecast(p, data);
      say(el('fc-status'), '');
      if (data.tz && data.tz !== p.tz) Store.update(p.id, { tz: data.tz });
    }).catch(function () {
      show('view-fc');
      el('fc-name').textContent = p.name;
      el('fc-eyebrow').textContent = p.address;
      say(el('fc-status'), 'Les prévisions n’ont pas pu être récupérées. Vérifiez la connexion, puis actualisez.', true);
    });
  }

  /* =========================================================
     Routeur
     ========================================================= */
  function route() {
    var h = location.hash || '#/';
    if (h.indexOf('#/lieu/') === 0) {
      openForecast(h.slice(7));
    } else if (h === '#/nouveau') {
      show('view-new');
      resetNew();
      setTimeout(function () { el('in-name').focus(); }, 80);
    } else {
      show('view-home');
      Views.home();
      el('topbar-meta').textContent = 'Modèle Météo-France · maille 1,5 km';
    }
    el('app').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  /* =========================================================
     Écoute des évènements
     ========================================================= */
  window.addEventListener('hashchange', route);

  document.addEventListener('DOMContentLoaded', function () {
    el('btn-search').addEventListener('click', runSearch);
    el('btn-geoloc').addEventListener('click', useGeoloc);
    el('in-addr').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); runSearch(); }
    });

    el('results').addEventListener('click', function (e) {
      var b = e.target.closest('.result');
      if (!b) return;
      chooseResult(draft.results[+b.dataset.i], true);
    });

    el('btn-back-1').addEventListener('click', function () { setStep(1); });
    el('btn-to-3').addEventListener('click', toConfirm);
    el('btn-back-2').addEventListener('click', function () { setStep(2); });
    el('btn-save').addEventListener('click', savePlace);

    Geo.onMove(function (lat, lon) {
      Geo.reverse(lat, lon).then(function (hit) {
        var r = hit || { label: lat.toFixed(5) + ', ' + lon.toFixed(5), sub: 'Coordonnées choisies sur la carte', city: '' };
        r.lat = lat; r.lon = lon;
        r.origin = 'repère déplacé';
        r._moved = true;
        draft.results = [r].concat(draft.results.filter(function (x) { return !x._moved; }));
        draft.chosen = r;
        paintResults();
      });
    });

    el('btn-refresh').addEventListener('click', function () {
      if (currentPlace) openForecast(currentPlace.id);
    });
    el('btn-del').addEventListener('click', function () {
      if (!currentPlace) return;
      if (window.confirm('Supprimer « ' + currentPlace.name + ' » ?')) {
        Store.remove(currentPlace.id);
        currentPlace = null;
        location.hash = '#/';
      }
    });

    route();
  });
})();
