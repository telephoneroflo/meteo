/* =========================================================
   geo.js — recherche d'adresse et carte
   ---------------------------------------------------------
   Adresses : Base Adresse Nationale (api-adresse.data.gouv.fr),
   le référentiel officiel français — gratuit, sans clé, précis
   au numéro de rue. Repli sur le géocodeur Open-Meteo pour les
   communes hors France.
   Carte : Leaflet + fond CARTO sombre (fond de carte OSM).
   Aucune clé d'API n'apparaît dans le dépôt.
   ========================================================= */
(function (global) {
  'use strict';

  var BAN = 'https://api-adresse.data.gouv.fr';
  var OMGEO = 'https://geocoding-api.open-meteo.com/v1/search';

  function j(u) {
    return fetch(u).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function fromBan(fc) {
    return (fc.features || []).map(function (f) {
      var p = f.properties || {};
      return {
        label: p.label || '',
        sub: [p.postcode, p.city, p.context].filter(Boolean).join(' · '),
        city: p.city || '',
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
        origin: 'BAN'
      };
    });
  }

  function fromOm(r) {
    return (r.results || []).map(function (x) {
      return {
        label: x.name,
        sub: [x.admin2, x.admin1, x.country].filter(Boolean).join(' · '),
        city: x.name || '',
        lat: x.latitude,
        lon: x.longitude,
        origin: 'Open-Meteo'
      };
    });
  }

  function search(q) {
    q = (q || '').trim();
    if (q.length < 3) return Promise.reject(new Error('court'));
    return j(BAN + '/search/?limit=8&q=' + encodeURIComponent(q))
      .then(function (fc) {
        var list = fromBan(fc);
        if (list.length) return list;
        return j(OMGEO + '?count=8&language=fr&name=' + encodeURIComponent(q)).then(fromOm);
      })
      .catch(function () {
        return j(OMGEO + '?count=8&language=fr&name=' + encodeURIComponent(q)).then(fromOm);
      });
  }

  function reverse(lat, lon) {
    return j(BAN + '/reverse/?lat=' + lat + '&lon=' + lon)
      .then(function (fc) {
        var l = fromBan(fc);
        return l.length ? l[0] : null;
      })
      .catch(function () { return null; });
  }

  /* ---------- carte ---------- */
  var map = null, marker = null, moveCb = null;

  function ensure(elId) {
    if (map) { setTimeout(function () { map.invalidateSize(); }, 60); return map; }
    map = L.map(elId, { zoomControl: true, attributionControl: true, scrollWheelZoom: true })
           .setView([46.6, 2.4], 5);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);
    return map;
  }

  function setPoint(lat, lon, zoom) {
    if (!map) return;
    var icon = L.divIcon({ className: '', html: '<div class="pin"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
    if (!marker) {
      marker = L.marker([lat, lon], { draggable: true, icon: icon, keyboard: true }).addTo(map);
      marker.on('dragend', function () {
        var ll = marker.getLatLng();
        if (moveCb) moveCb(ll.lat, ll.lng);
      });
    } else {
      marker.setLatLng([lat, lon]);
    }
    map.setView([lat, lon], zoom || 16, { animate: true });
    setTimeout(function () { map.invalidateSize(); }, 60);
  }

  function onMove(cb) { moveCb = cb; }

  global.Geo = {
    search: search,
    reverse: reverse,
    ensureMap: ensure,
    setPoint: setPoint,
    onMove: onMove
  };
})(window);
