
# Refonte visuelle "carte ludique" style Duolingo

Objectif : transformer l'app en une **carte interactive joyeuse et ludique** (esprit Duolingo / jeu mobile), tout en gardant les onglets et filtres **discrets** pour ne pas casser l'ambiance.

## Direction visuelle

**Palette ludique** (remplace le dark actuel) :
- Fond app : crème doux `#FFF9F0` (mode clair chaleureux type Duolingo)
- Vert primaire vif `#58CC02` (accent principal, boutons, "faits")
- Jaune miel `#FFC800` (favoris, étoiles, récompenses)
- Corail `#FF6B6B` (cœurs favoris, alertes)
- Bleu ciel `#1CB0F6` (liens, info)
- Bordures marquées 2px + ombres portées "plates" décalées (style neo-brutalist doux)

**Typo** : `Nunito` (arrondie, ludique) pour titres + `DM Sans` corps.

## Carte interactive ludique

- Style Google Maps custom : **fond crème**, eau bleu pastel, parcs vert vif, routes blanches contour gris clair (style "board game"). Sortie du dark.
- **Marqueurs restaurants transformés en pastilles rondes** colorées type "niveaux Duolingo" :
  - Rond blanc avec icône emoji cuisine (🍕 🍜 🥐 🍔…) selon le type
  - Bordure épaisse colorée (vert si fait, jaune si favori, gris sinon)
  - Ombre portée décalée
  - Petit rebond au hover / au clic (animation `scale` + `translateY`)
- **Marqueur "fait"** : coche verte en badge sur la pastille (comme une leçon complétée)
- **Cluster léger** au dézoom : gros rond avec nombre, même style

## Onglets et filtres — restent minimalistes

Contrainte forte : ne PAS envahir l'écran avec du ludique.

- **Header** : hauteur réduite, fond crème translucide `backdrop-blur`, titre app en Nunito bold + petit compteur discret.
- **Onglets Tous / À faire / Faits / Favoris** : pilules fines, texte gris, l'onglet actif prend un fond vert pâle avec texte vert foncé (pas de gros bouton bombé). Badges compteurs en petit chiffre à côté.
- **Filtres cuisine** : chips discrètes avec emoji + label court, actives = fond crème foncé + bordure fine, pas de couleurs criardes.
- **Slider note et tri** : gardent leur style actuel épuré, juste re-teinté crème/vert.

## Fiche restaurant

- Coins plus arrondis (`rounded-3xl`), ombre douce décalée.
- Badge cuisine en haut avec emoji + label sur fond pastel.
- Boutons "Fait" / "Favori" : boutons pilules avec micro-animation (bounce léger au clic, confetti discret optionnel au "Fait").
- Étoiles de note dessinées en jaune miel remplies, plus expressives.

## Micro-animations

- Transitions douces (`transition-all duration-200`) sur hover pastilles, chips, onglets.
- Bounce léger au tap sur mobile.
- Petit "pop" quand on marque un resto comme fait (scale 1 → 1.15 → 1 sur la coche).
- Pas d'animations lourdes qui ralentissent la carte.

## Fichiers modifiés

- `src/routes/__root.tsx` : retire le `dark` forcé, ajoute la classe crème claire globale + import fonts Nunito/DM Sans.
- `src/styles.css` : nouveaux tokens couleur (crème, vert Duo, jaune, corail, bleu ciel), radius plus généreux, ombres décalées, familles de fonts.
- `src/routes/index.tsx` :
  - Nouveau `minimalMapStyle` clair "board game".
  - Marqueurs custom (SVG data URL ou `OverlayView`) en pastilles avec emoji cuisine.
  - Restyle header, onglets, chips filtres, fiche resto avec les nouveaux tokens.
  - Ajout des micro-animations (Tailwind + `transition`).
- Mapping `cuisine → emoji` (italien 🍕, japonais 🍣, français 🥖, chinois 🥟, etc.).

## Ce qui NE change pas

- Toute la logique (fetch Places, cache, favoris cloud, auth, tri, pull-to-refresh, itinéraire) reste identique.
- La sélection de ville, le zoom, les 100 restos de Toulouse : inchangés.
- Uniquement du travail frontend / présentation.

Après ton feu vert, j'implémente tout d'un coup.
