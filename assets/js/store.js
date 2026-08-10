/* =========================================================
   store.js — persistance des lieux
   ---------------------------------------------------------
   Deux niveaux qui se superposent :

   1. SOCLE PARTAGÉ — places.json, versionné dans le dépôt.
      Lu au démarrage, il apparaît sur tous les navigateurs
      et tous les appareils. C'est la place des lieux durables.

   2. AJOUTS LOCAUX — localStorage du navigateur courant.
      Tout lieu créé depuis l'interface atterrit ici, car un
      site statique ne peut rien écrire sur le serveur.

   Un lieu du socle supprimé à la main ne réapparaît pas :
   son identifiant est mémorisé dans une liste de suppressions
   propre à l'appareil. Un lieu local portant le même
   identifiant qu'un lieu du socle le remplace.
   ========================================================= */
(function (global) {
  'use strict';

  var LKEY = 'arome.places.v1';
  var DKEY = 'arome.deleted.v1';
  var SHARED_URL = 'places.json';

  var shared = [];      // socle du dépôt
  var local = [];       // ajouts de cet appareil
  var deleted = [];     // identifiants du socle masqués ici
  var readyP = null;
  var sharedOk = false;

  /* ---------- accès bas niveau ---------- */
  var canLS = (function () {
    try {
      global.localStorage.setItem('__arome__', '1');
      global.localStorage.removeItem('__arome__');
      return true;
    } catch (e) { return false; }
  })();

  var mem = {};
  function readJSON(k) {
    var raw;
    if (canLS) { try { raw = global.localStorage.getItem(k); } catch (e) { raw = null; } }
    else raw = mem[k];
    if (!raw) return null;
    try { var v = JSON.parse(raw); return Array.isArray(v) ? v : null; } catch (e) { return null; }
  }
  function writeJSON(k, v) {
    var raw = JSON.stringify(v);
    if (canLS) { try { global.localStorage.setItem(k, raw); return; } catch (e) { /* quota */ } }
    mem[k] = raw;
  }

  /* ---------- normalisation d'une entrée ---------- */
  function slug(s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'lieu';
  }
  function clean(p, fallbackId) {
    if (!p) return null;
    var lat = parseFloat(p.lat), lon = parseFloat(p.lon);
    if (isNaN(lat) || isNaN(lon)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return {
      id: String(p.id || fallbackId || slug(p.name)),
      name: String(p.name || 'Sans nom').slice(0, 60),
      address: String(p.address || '').slice(0, 160),
      sub: String(p.sub || '').slice(0, 160),
      lat: lat,
      lon: lon
    };
  }

  /* ---------- chargement du socle ---------- */
  function ready() {
    if (readyP) return readyP;
    local = readJSON(LKEY) || [];
    deleted = readJSON(DKEY) || [];

    readyP = fetch(SHARED_URL, { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var list = !j ? [] : (Array.isArray(j) ? j : (j.places || []));
        shared = list.map(function (p, i) { return clean(p, 'shared-' + i); })
                     .filter(Boolean);
        sharedOk = true;
      })
      .catch(function () { shared = []; sharedOk = false; })
      .then(function () { return true; });

    return readyP;
  }

  /* ---------- lecture ---------- */
  function all() {
    var out = [];
    shared.forEach(function (p) {
      if (deleted.indexOf(p.id) !== -1) return;
      if (local.some(function (l) { return l.id === p.id; })) return;
      var c = Object.assign({}, p);
      c.origin = 'shared';
      out.push(c);
    });
    local.forEach(function (p) {
      var c = Object.assign({}, p);
      c.origin = 'local';
      out.push(c);
    });
    return out;
  }

  function get(id) {
    var l = all();
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }

  /* ---------- écriture ---------- */
  function add(place) {
    var p = clean(place, 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5));
    if (!p) return null;
    while (local.some(function (x) { return x.id === p.id; })) p.id += 'x';
    p.createdAt = Date.now();
    local.push(p);
    writeJSON(LKEY, local);
    return p;
  }

  function update(id, patch) {
    var hit = null;
    local.forEach(function (p) { if (p.id === id) { Object.assign(p, patch); hit = p; } });
    if (hit) writeJSON(LKEY, local);
    return hit;
  }

  function remove(id) {
    var before = local.length;
    local = local.filter(function (p) { return p.id !== id; });
    if (local.length !== before) writeJSON(LKEY, local);

    if (shared.some(function (p) { return p.id === id; }) && deleted.indexOf(id) === -1) {
      deleted.push(id);
      writeJSON(DKEY, deleted);
    }
  }

  global.Store = {
    ready: ready,
    all: all, get: get, add: add, update: update, remove: remove,
    persistent: canLS,
    sharedLoaded: function () { return sharedOk; }
  };
})(window);
