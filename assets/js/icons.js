/* =========================================================
   icons.js — jeu d'icônes SVG maison, mappé sur les codes WMO
   renvoyés par Open-Meteo (weather_code).
   Aucune dépendance, aucun emoji : tout est vectoriel.
   ========================================================= */
(function (global) {
  'use strict';

  var C = {
    sun:   '#F0C64F',
    moon:  '#CBD9E2',
    cloud: '#9FB6C2',
    cloud2:'#6E8894',
    rain:  '#57C7E4',
    snow:  '#DCEBF2',
    bolt:  '#F0C64F',
    fog:   '#8CA3AE'
  };

  function sun(cx, cy, r, cls) {
    var rays = '';
    for (var i = 0; i < 8; i++) {
      var a = (i * Math.PI) / 4;
      var x1 = cx + Math.cos(a) * (r + 3.2), y1 = cy + Math.sin(a) * (r + 3.2);
      var x2 = cx + Math.cos(a) * (r + 7.4), y2 = cy + Math.sin(a) * (r + 7.4);
      rays += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) +
              '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '"/>';
    }
    return '<g class="' + (cls || 'wx-sun') + '" stroke="' + C.sun + '" stroke-width="2" ' +
           'stroke-linecap="round" style="transform-origin:' + cx + 'px ' + cy + 'px">' + rays + '</g>' +
           '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + C.sun + '"/>';
  }

  function moon(cx, cy, r) {
    return '<path d="M' + (cx + r * 0.55) + ' ' + (cy - r) +
           ' a' + r + ' ' + r + ' 0 1 0 ' + (r * 0.72) + ' ' + (r * 1.5) +
           ' a' + r * 0.94 + ' ' + r * 0.94 + ' 0 1 1 -' + (r * 0.72) + ' -' + (r * 1.5) + 'z" fill="' + C.moon + '"/>';
  }

  /* nuage : cercles + base arrondie, groupés puis translatés/mis à l'échelle */
  function cloud(x, y, s, fill) {
    var f = fill || C.cloud;
    return '<g transform="translate(' + x + ',' + y + ') scale(' + s + ')" fill="' + f + '">' +
             '<rect x="1" y="12" width="30" height="9.5" rx="4.75"/>' +
             '<circle cx="12" cy="11" r="8"/>' +
             '<circle cx="22.5" cy="13.5" r="6.2"/>' +
             '<circle cx="5.5" cy="14.5" r="5.4"/>' +
           '</g>';
  }

  function drops(xs, y, color, cls) {
    var out = '<g class="' + (cls || 'wx-rain') + '" stroke="' + color + '" stroke-width="2.4" stroke-linecap="round">';
    xs.forEach(function (x, i) {
      out += '<line x1="' + x + '" y1="' + y + '" x2="' + (x - 2.2) + '" y2="' + (y + 7) +
             '" style="animation-delay:' + (i * 0.22).toFixed(2) + 's"/>';
    });
    return out + '</g>';
  }

  function flakes(xs, y) {
    var out = '<g class="wx-snow" fill="' + C.snow + '">';
    xs.forEach(function (x, i) {
      out += '<circle cx="' + x + '" cy="' + y + '" r="2" style="animation-delay:' + (i * 0.3).toFixed(2) + 's"/>';
    });
    return out + '</g>';
  }

  function wrap(inner) {
    return '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" fill="none" role="img">' + inner + '</svg>';
  }

  var build = {
    clear_day:    function () { return wrap(sun(24, 24, 8.5)); },
    clear_night:  function () { return wrap(moon(24, 24, 8.5)); },
    few_day:      function () { return wrap(sun(20, 18, 7.4) + cloud(17, 25, 0.74)); },
    few_night:    function () { return wrap(moon(19, 18, 7.4) + cloud(17, 25, 0.74)); },
    part_day:     function () { return wrap(sun(30, 15, 6) + cloud(6, 18, 1.15)); },
    part_night:   function () { return wrap(moon(30, 15, 6) + cloud(6, 18, 1.15)); },
    overcast:     function () { return wrap(cloud(4, 12, 1.05, C.cloud2) + cloud(11, 18, 1.1, C.cloud)); },
    fog:          function () {
      return wrap(cloud(9, 11, 1.05, C.cloud) +
        '<g stroke="' + C.fog + '" stroke-width="2.3" stroke-linecap="round" class="wx-fog">' +
        '<line x1="11" y1="35" x2="37" y2="35"/>' +
        '<line x1="15" y1="40" x2="33" y2="40" style="animation-delay:.4s"/></g>');
    },
    drizzle:      function () { return wrap(cloud(8, 7, 1.08) + drops([18, 24, 30], 33, C.rain)); },
    rain:         function () { return wrap(cloud(8, 6, 1.08) + drops([15, 21, 27, 33], 32, C.rain)); },
    rain_heavy:   function () {
      return wrap(cloud(8, 3, 1.08, C.cloud2) +
        drops([15, 21, 27, 33], 29, C.rain) + drops([18, 24, 30], 37, C.rain, 'wx-rain wx-rain--b'));
    },
    showers_day:  function () { return wrap(sun(33, 11, 5) + cloud(5, 7, 1.02) + drops([15, 21, 27], 33, C.rain)); },
    showers_night:function () { return wrap(moon(33, 11, 5) + cloud(5, 7, 1.02) + drops([15, 21, 27], 33, C.rain)); },
    snow:         function () { return wrap(cloud(8, 6, 1.08) + flakes([16, 24, 32], 34)); },
    sleet:        function () { return wrap(cloud(8, 6, 1.08) + drops([16, 30], 32, C.rain) + flakes([24], 35)); },
    thunder:      function () {
      return wrap(cloud(8, 4, 1.08, C.cloud2) +
        '<path class="wx-bolt" d="M25 28l-7 10h5.6l-2.2 8 9.6-11.6h-6l3-6.4z" fill="' + C.bolt + '"/>');
    },
    thunder_hail: function () {
      return wrap(cloud(8, 3, 1.08, C.cloud2) +
        '<path class="wx-bolt" d="M25 27l-6 9h5l-2 7.4 8.8-10.8h-5.4l2.6-5.6z" fill="' + C.bolt + '"/>' +
        flakes([14, 35], 35));
    }
  };

  /* ---- codes WMO -> clé d'icône ---- */
  function keyFor(code, isDay) {
    var d = isDay === false ? '_night' : '_day';
    switch (true) {
      case code === 0:  return 'clear' + d;
      case code === 1:  return 'few' + d;
      case code === 2:  return 'part' + d;
      case code === 3:  return 'overcast';
      case code === 45 || code === 48: return 'fog';
      case code >= 51 && code <= 57: return code >= 56 ? 'sleet' : 'drizzle';
      case code === 61 || code === 63: return 'rain';
      case code === 65: return 'rain_heavy';
      case code === 66 || code === 67: return 'sleet';
      case code >= 71 && code <= 77: return 'snow';
      case code === 80 || code === 81: return 'showers' + d;
      case code === 82: return 'rain_heavy';
      case code === 85 || code === 86: return 'snow';
      case code === 95: return 'thunder';
      case code === 96 || code === 99: return 'thunder_hail';
      default: return 'overcast';
    }
  }

  var LABELS = {
    0: 'Ciel dégagé', 1: 'Peu nuageux', 2: 'Partiellement nuageux', 3: 'Ciel couvert',
    45: 'Brouillard', 48: 'Brouillard givrant',
    51: 'Bruine faible', 53: 'Bruine', 55: 'Bruine dense',
    56: 'Bruine verglaçante', 57: 'Bruine verglaçante dense',
    61: 'Pluie faible', 63: 'Pluie', 65: 'Pluie forte',
    66: 'Pluie verglaçante', 67: 'Pluie verglaçante forte',
    71: 'Neige faible', 73: 'Neige', 75: 'Neige forte', 77: 'Grains de neige',
    80: 'Averses faibles', 81: 'Averses', 82: 'Averses violentes',
    85: 'Averses de neige', 86: 'Fortes averses de neige',
    95: 'Orage', 96: 'Orage et grêle', 99: 'Orage et forte grêle'
  };

  global.WXIcons = {
    svg: function (code, isDay) {
      var k = keyFor(typeof code === 'number' ? code : 3, isDay);
      return (build[k] || build.overcast)();
    },
    label: function (code) {
      return LABELS[code] || 'Conditions indisponibles';
    }
  };
})(window);
