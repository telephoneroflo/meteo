/* =========================================================
   store.js — persistance des lieux
   localStorage quand il est disponible, repli en mémoire sinon
   (mode privé strict, iframe sandboxée, file:// verrouillé…).
   ========================================================= */
(function (global) {
  'use strict';

  var KEY = 'arome.places.v1';
  var mem = null;              // repli mémoire
  var canLS = (function () {
    try {
      var t = '__arome_test__';
      global.localStorage.setItem(t, '1');
      global.localStorage.removeItem(t);
      return true;
    } catch (e) { return false; }
  })();

  function readRaw() {
    if (canLS) { try { return global.localStorage.getItem(KEY); } catch (e) { return null; } }
    return mem;
  }
  function writeRaw(str) {
    if (canLS) { try { global.localStorage.setItem(KEY, str); return; } catch (e) { /* quota */ } }
    mem = str;
  }

  function all() {
    var raw = readRaw();
    if (!raw) return [];
    try {
      var v = JSON.parse(raw);
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }

  function save(list) { writeRaw(JSON.stringify(list)); }

  function get(id) {
    var l = all();
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }

  function add(place) {
    var l = all();
    place.id = place.id || ('p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    place.createdAt = Date.now();
    l.push(place);
    save(l);
    return place;
  }

  function update(id, patch) {
    var l = all(), out = null;
    for (var i = 0; i < l.length; i++) {
      if (l[i].id === id) { Object.assign(l[i], patch); out = l[i]; }
    }
    save(l);
    return out;
  }

  function remove(id) {
    save(all().filter(function (p) { return p.id !== id; }));
  }

  global.Store = {
    all: all, get: get, add: add, update: update, remove: remove,
    persistent: canLS
  };
})(window);
