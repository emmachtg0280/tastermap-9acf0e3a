# Plan : réparer et uniformiser le feedback haptique au tap

## Problème constaté
Seules les chips de cuisine déclenchent `navigator.vibrate(15)` au tap. Les autres icônes / boutons (Nouveautés, Hype, Filtres, Favoris, Faits, Restaurants, actions de fiche) n'ont aucune vibration. De plus, `navigator.vibrate` n'est pas supportée sur iOS Safari, donc le feedback est silencieux pour une grande partie des utilisateurs.

## Objectif
Donner un feedback haptique / visuel clair et cohérent sur **tous** les boutons/icônes tapables, avec une solution qui fonctionne aussi sur iOS.

## Étapes

1. **Créer un helper `haptic.ts`**
   - Tente `navigator.vibrate(pattern)` si disponible (Android).
   - Retourne un flag `supported` pour que l'interface puisse ajouter un fallback visuel sur les appareils non-haptiques.
   - Pattern court de 15 ms pour les petits boutons, 20 ms pour les grosses cibles.

2. **Ajouter un feedback visuel universel au tap**
   - Classe utilitaire `.tap-bounce` : `active:scale-95` + courte transition + micro-impulsion via keyframe `tap-pop` (scale 0.92 → 1.0) pour compenser l'absence de vibration sur iOS.
   - Appliquer cette classe aux boutons flottants, aux chips de cuisine et aux boutons d'action de fiche.

3. **Brancher le helper sur tous les boutons interactifs**
   - **Top bar** : Nouveautés, Hype, chaque chip cuisine.
   - **Floating action buttons** : Filtres, Favoris, Faits, Restaurants.
   - **Fiche restaurant** : Fait, Favori, fermeture, liens (téléphone, site, itinéraire), commentaire.
   - **Overlays** : boutons d'ouverture/fermeture des modales Filtres / Liste / Faits / Favoris.

4. **Vérifier la cohérence mobile**
   - S'assurer que les animations CSS ne bloquent pas le rendu (`will-change: transform` sur les cibles fréquemment tapées).
   - Empêcher le double-déclenclement si le navigateur supporte à la fois la vibration et le fallback visuel : le visuel s'applique toujours, la vibration en plus quand disponible.

5. **Validation**
   - Build (`bun run build`) sans erreur.
   - Test sur le preview mobile : vérifier que chaque icône donne un retour visuel au tap, et qu'Android vibre en plus.

## Fichiers concernés
- `src/lib/haptic.ts` (nouveau)
- `src/styles.css` (keyframes tap-pop + classe utilitaire)
- `src/routes/index.tsx` (ajout du helper sur tous les boutons interactifs)

## Non inclus
- Pas d'ajout de son au tap par défaut (demanderait une permission / politique utilisateur).
- Pas de remplacement de l'API Google Maps par AdvancedMarkerElement (hors sujet).