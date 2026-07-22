## Objectif

Rendre les icônes de nourriture (bandeau haut + marqueurs de carte) plus grosses, mieux dessinées et appétissantes, dans un style illustré cohérent inspiré des images fournies (rendu 3D soft, ombre douce, couleurs riches, fond transparent). Agrandir aussi la mascotte à l'ouverture avec un rendu plus détaillé et des yeux pétillants.

## Ce qui change

### 1. Icônes cuisines (PNG générés)

Générer 12 PNG carrés 512×512, fond transparent, style sticker 3D soft cohérent (photo-illustration appétissante, ombre douce sous le plat, sans texte, sans assiette systématique — le plat lui-même) :

- Français → croissant beurré doré
- Italien → assiette de pâtes fumantes (spaghetti tomate/basilic)
- Chinois → raviolis vapeur (dim sum)
- Japonais → duo de sushis (nigiri saumon + maki)
- Indien → bol de curry orangé avec naan
- Mexicain → taco garni (comme la référence)
- Thaï → piment rouge brillant sur feuille
- Espagnol → paella miniature dans poêle
- Grec → olives + feta
- Américain → burger juteux (comme la référence)
- Végétarien → bol de salade colorée
- Tous → assiette avec dôme (générique)

Fichiers stockés en assets CDN via `lovable-assets`, un `.asset.json` par cuisine dans `src/assets/cuisines/`.

### 2. Intégration

- `src/components/icons/CuisineIcons.tsx` : ajouter un mapping `CUISINE_IMAGE` (import des 12 `.asset.json`), et modifier `CuisineIcon` pour rendre un `<img>` PNG plutôt que le SVG. Les SVG existants sont conservés en fallback pour les marqueurs carte (car intégrés dans un `<svg>`).
- Marqueurs de carte : passer d'un SVG inline à un marqueur HTML (`AdvancedMarkerElement` avec `<img>`) affichant le PNG dans la pastille blanche — pastille légèrement agrandie (36 → 44 px) pour laisser respirer l'image.
- Bandeau haut : agrandir la zone icône (56 → 68 px de large, image 48 px au lieu de 28 px SVG), garder le libellé en dessous. Onglets Nouveautés/Hype restent en SVG (✨/🔥) mais aussi agrandis pour cohérence.

### 3. Mascotte

- `src/components/mascot/ChefBuddy.tsx` : redessiner le renard en plus détaillé (SVG main) — taille passe de ~120 px à ~180 px, ajout de reflets « yeux pétillants » (2 highlights blancs par œil), joues plus rondes rosées, toque plus haute, ombre douce sous les pattes. Animations existantes (hop, blink, wing-wave) conservées.

## Détails techniques

```
src/assets/cuisines/
  ├─ french.png.asset.json
  ├─ italian.png.asset.json
  ├─ ... (12 fichiers)
```

Génération via skill AI Gateway (`google/gemini-3-pro-image`) : un prompt par cuisine, style unifié — « soft 3D sticker illustration, appetizing, warm lighting, transparent background, no text, centered, subtle drop shadow ». Chaque PNG est ensuite uploadé via `lovable-assets create`.

`CuisineIcon` devient :
```tsx
<img src={CUISINE_IMAGE[pickCuisine(cuisines)].url} width={size} height={size} />
```

Pour les marqueurs carte : migration vers `AdvancedMarkerElement` avec contenu HTML custom (pastille + img). Impact perf neutre (déjà 1 marqueur par restau, ~60 max visibles).

## Hors périmètre

- Pas de changement de logique de filtres, favoris, hype, etc.
- Pas de changement de palette générale ni de typo.
- Génération des PNG faite maintenant (une seule fois) — pas de génération à la volée côté app.
