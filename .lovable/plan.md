# Plan — charte graphique custom style Duolingo/UberEats

## Objectif
Remplacer tous les emojis système Apple par des illustrations SVG dessinées à la main, style **sticker Duolingo** (volumes doux, contour blanc, ombre douce, 2-3 aplats de couleur). Rendu cohérent, léger, net à toute taille.

## 1. Bibliothèque d'icônes SVG (`src/components/icons/`)

Nouveau dossier avec un composant SVG par icône, taille pilotée par prop `size`, palette figée.

### Cuisines (11 icônes — remplace 🍝 🥖 🥟 🍣 🍛 🌮 🌶️ 🥘 🫒 🍔 🥗)
- `PastaIcon` (italien) — assiette de pâtes fumante
- `BaguetteIcon` (français) — baguette + béret stylisés
- `DumplingIcon` (chinois) — raviolis vapeur
- `SushiIcon` (japonais) — nigiri saumon
- `CurryIcon` (indien) — bol curry + naan
- `TacoIcon` (mexicain) — taco garni
- `ChiliIcon` (thaï) — piment souriant
- `PaellaIcon` (espagnol) — poêle paella
- `OliveIcon` (grec) — olive + feuille
- `BurgerIcon` (américain) — burger étagé
- `SaladIcon` (végé) — bol vert

### Discovery & états (remplace ✨ 🔥 ⭐ 📍 🍽️ ❤️ ✓)
- `SparkleIcon` (Nouveautés)
- `FlameIcon` (Hype)
- `StarIcon` (note)
- `PinIcon` (localisation)
- `PlateIcon` (Restaurants FAB)
- `HeartIcon` (Favoris FAB, plein/vide)
- `CheckIcon` (Faits FAB + badge marqueur)

### Style commun
- viewBox 24x24, contour blanc de 1.5px, ombre `drop-shadow`, 2 aplats + highlight
- Palette accordée aux couleurs Duo déjà en place (`--duo-green`, `--duo-yellow`, `--duo-coral`, `--duo-sky`)

## 2. Nouvelle mascotte : `ChefBuddy` (remplace `ChickSvg`)

Petit **renard orange pétant** (ou choix équivalent) avec **toque de chef blanche**, style sticker Duo :
- Corps orange vif (#FF7A1A), ventre crème, joues rosées
- Toque blanche gonflée avec bande
- Yeux ronds noirs + petit sourire
- Réutilise les animations existantes (`mascot-hop`, `mascot-blink`, `mascot-wing` renommée en `mascot-tail`)

Bulle de dialogue : fond **blanc semi-opaque** (`bg-white/85 backdrop-blur`), coin arrondi, petite queue vers la mascotte, texte foncé. Remplace l'actuelle bulle jaune.

## 3. Marqueurs de carte

Le SVG de marqueur (généré côté client pour Google Maps) intègre actuellement l'emoji système via `<text>`. Remplacement :
- Génère le marqueur en SVG avec l'icône cuisine correspondante **inline** (dessin vectoriel, pas de `<text>` emoji)
- Badge ✓ des restos faits → mini `CheckIcon` blanc sur pastille verte
- Badge ✨ Nouveau → mini `SparkleIcon`

## 4. Points d'intégration (`src/routes/index.tsx`)

- Bandeau chips cuisines : `<Icon />` centré à la place de l'emoji, label inchangé
- Onglets Nouveautés/Hype : `<SparkleIcon />` / `<FlameIcon />`
- FABs (Filtres/Favoris/Faits/Restaurants) : icônes SVG
- Fiche resto : icône cuisine dans la pastille ronde, `StarIcon` pour la note, `HeartIcon`/`CheckIcon` pour boutons état
- Badges "Nouveau" et "Hype" : icône SVG au lieu d'emoji
- Overlays (headers Filtres/Faits/Favoris/Restaurants) : icônes SVG

## 5. Nettoyage
- Suppression du composant `ChickSvg` inline
- Suppression des emojis restants dans les strings JSX (garder uniquement dans les données Google si présents dans les noms)
- Un mapping unique `CUISINE_ICON: Record<Cuisine, ComponentType>` remplace `CUISINE_EMOJI`

## Fichiers touchés
- **Nouveaux** : `src/components/icons/index.tsx` (barrel), un fichier par icône OU un seul fichier regroupé si concis
- **Nouveau** : `src/components/mascot/ChefBuddy.tsx`
- **Modifiés** : `src/routes/index.tsx` (imports, mapping, marqueurs, mascotte, bulle), `src/styles.css` (ajustements animations mascotte si besoin)

## Hors périmètre
- Pas de changement des données restaurants ni de la logique de filtres
- Pas de refonte des couleurs globales de l'app (on garde la palette Duo actuelle)
- Pas d'images PNG générées : 100% SVG inline
