# AROME — prévisions maille fine

Site statique de prévisions météo pour lieux enregistrés, adossé au modèle
**AROME de Météo-France** (maille 1,5 km). Aucun serveur, aucune clé d'API,
aucune dépendance à installer : le dépôt se publie tel quel sur GitHub Pages.

---

## Publier sur GitHub Pages

1. Créez un dépôt (par exemple `meteo`) et poussez le contenu de ce dossier
   à la racine :

   ```bash
   cd meteo-arome
   git init
   git add .
   git commit -m "Prévisions AROME"
   git branch -M main
   git remote add origin https://github.com/VOTRE-COMPTE/meteo.git
   git push -u origin main
   ```

2. Dépôt → **Settings** → **Pages** → *Source* : `Deploy from a branch`,
   branche `main`, dossier `/ (root)` → **Save**.

3. Une minute plus tard le site répond sur
   `https://VOTRE-COMPTE.github.io/meteo/`.

Le routage se fait par ancre (`#/`, `#/nouveau`, `#/lieu/xxx`) : aucune règle
de réécriture n'est nécessaire, et un rafraîchissement en pleine page ne
produit jamais de 404.

Pour essayer sans rien publier, ouvrez simplement `index.html` dans un
navigateur — les scripts sont chargés en balises classiques, pas en modules,
donc le protocole `file://` fonctionne aussi.

---

## D'où viennent les données

| Bloc | Source | Détail |
|---|---|---|
| Heure par heure (H → H+12) | **AROME France HD** | maille 1,5 km, 0-48 h, run toutes les 3 h |
| Jours J+1 à J+3 | **AROME + ARPEGE** (`meteofrance_seamless`) | ARPEGE Europe 0,1° prend le relais après 48 h |
| Jours J+4 et J+5 | **multi-modèle** | AROME et ARPEGE s'arrêtent à 4 jours |
| Risque de précipitation | **multi-modèle** | Météo-France ne publie pas de probabilité ; elle est dérivée d'ensembles |
| Adresses | **Base Adresse Nationale** | référentiel officiel, précis au numéro de rue |
| Fond de carte | OpenStreetMap via CARTO | tuiles sombres, sans clé |

Les trois requêtes météo partent en parallèle et sont fusionnées champ par
champ, avec la priorité `AROME HD > AROME/ARPEGE > multi-modèle`. Si une
source manque, les autres prennent le relais sans casser l'affichage. Le
modèle réellement retenu est affiché : sur la carte « maintenant » et,
pour les 5 jours, en résumé sous le titre du bloc.

Passerelle utilisée : [Open-Meteo](https://open-meteo.com/), libre d'usage
non commercial sans inscription (≈ 10 000 appels/jour). Chaque ouverture de
prévision consomme 3 appels, chaque vignette d'accueil 1 appel.

---

## Où vivent les lieux

Un site statique ne peut rien écrire sur le serveur. La liste des lieux se
construit donc à partir de **`places.json`**, versionné à la racine du dépôt
et relu à chaque ouverture du site. Ses lieux s'affichent sur tous les
navigateurs et tous les appareils, sans compte ni installation.

**Ajouter un lieu visible partout**

Ouvrez `places.json` sur GitHub, cliquez sur l'icône crayon, complétez le
tableau `places`, puis **Commit changes**. Une minute plus tard le lieu est
partout.

```json
{
  "places": [
    { "id": "maison", "name": "Maison",
      "address": "Montbrison, 42600", "lat": 45.60833, "lon": 4.06639 },
    { "id": "bourboule", "name": "La Bourboule",
      "address": "123 Rue de Serbie, 63150", "lat": 45.5896, "lon": 2.7386 }
  ]
}
```

`name`, `lat` et `lon` sont obligatoires. L'`id` doit rester stable dans le
temps : c'est lui qui identifie le lieu. Attention aux virgules entre les
entrées, et pas de virgule après la dernière.

**Trouver les coordonnées sans les chercher**

Le parcours « Ajouter un lieu » du site sert exactement à ça : saisissez
l'adresse, ajustez le repère sur la carte, et l'écran de confirmation
affiche la latitude et la longitude à cinq décimales, prêtes à recopier
dans `places.json`. Le lieu ainsi créé est aussi enregistré dans le
navigateur courant, mais il n'y suivra pas d'un appareil à l'autre :
`places.json` reste le seul endroit qui vaut pour tous.

En dehors des appels de prévision et de géocodage, rien ne part vers un
serveur tiers.

## Arborescence

```
index.html                  les trois vues + le squelette
places.json                 socle de lieux partagé par tous les appareils
assets/css/style.css        identité visuelle, échelle thermique, mise en page
assets/js/icons.js          jeu d'icônes SVG, mappé sur les codes WMO
assets/js/store.js          socle partagé + stockage local, import/export
assets/js/weather.js        appels Open-Meteo et fusion des modèles
assets/js/geo.js            géocodage BAN + carte Leaflet
assets/js/views.js          rendu des blocs
assets/js/app.js            routeur et parcours de création
```

---

## Réglages rapides

| Envie | Où | Quoi |
|---|---|---|
| Plus ou moins d'heures | `views.js` → `renderHours` | `COL` (largeur de colonne) ; `weather.js` → boucle `h <= 12` |
| Plus de jours | `weather.js` → boucle `k <= 5` | au-delà de J+5, seul le multi-modèle répond |
| Palette de température | `views.js` → tableau `STOPS` | couples `[°C, [r,g,b]]`, interpolation linéaire |
| Couleurs de l'interface | `style.css` → bloc `:root` | `--ink-*`, `--fg-*`, `--t-*` |
| Fond de carte clair | `geo.js` → `L.tileLayer` | remplacer `dark_all` par `light_all` |

---

## Pourquoi pas Google Maps

Le géocodage Google impose une clé d'API. Sur un dépôt public elle serait
lisible par tout le monde et rattachée à un compte de facturation. La Base
Adresse Nationale rend le même service pour les adresses françaises, sans
clé, avec une meilleure couverture du numéro de rue — et le bouton
« Utiliser ma position » couvre le cas où l'on ne connaît pas l'adresse
exacte. Le repère reste déplaçable à la main sur la carte : le point retenu
suit le repère.
