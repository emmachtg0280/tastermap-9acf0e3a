Proposition de fonctionnalités à ajouter à Tastemap

## Contexte actuel
L'application est un explorateur de restaurants sur 6 villes françaises avec : carte Google Maps, filtres ville/cuisine/note minimum, marquage fait/à faire + commentaire, photos, horaires d'ouverture, pull-to-refresh, mode sombre minimaliste.

## Pistes de fonctionnalités, par thème

### 1. Enrichissement des données restaurant
- Afficher le niveau de prix (€/€€/€€€) avec un filtre correspondant.
- Indiquer "Ouvert maintenant" / "Ferme bientôt" en temps réel.
- Afficher le nombre d'avis Google et un lien vers les avis détaillés.
- Afficher les accessibilités (terrasse, livraison, parking, option végétarienne…).
- Lien de réservation direct (TheFork, site officiel, téléphone).

### 2. Navigation et découverte
- Bouton "Itinéraire" qui ouvre Google Maps / Apple Maps / Waze vers le restaurant.
- Géolocalisation de l'utilisateur et tri des restaurants par distance.
- Recherche textuelle libre (nom, rue, quartier, spécialité).
- Filtre "Ouvert maintenant".
- Tri des résultats : note, nombre d'avis, prix, distance.

### 3. Carnet personnel avancé
- Système de favoris / wishlist indépendant du statut "fait".
- Notes personnelles en étoiles (1-5) en plus du commentaire texte.
- Date de visite et historique chronologique.
- Statistiques personnelles : restaurants faits, cuisines préférées, ville la plus explorée, note moyenne.
- Export du carnet en CSV ou PDF.

### 4. Social et partage
- Partage d'un restaurant par lien (URL avec id du restaurant).
- Partage d'une carte de restaurants filtrée ("Mes restaurants italiens à Toulouse").
- Système de listes publiques : "Top ramen à Paris", etc.

### 5. Synchronisation et compte
- Sauvegarde cloud du carnet via Lovable Cloud (authentification).
- Sync multi-appareils (même compte = même carnet).
- Mode hors ligne avec cache des 100 restaurants affichés.

### 6. UX / Performance
- Skeleton de chargement plus léger.
- Cluster de marqueurs sur la carte quand beaucoup de restaurants sont proches.
- Mode "carte plein écran" / "liste plein écran" sur mobile.
- Animation de transition entre la liste et la fiche détail.
- Pagination ou scroll infini dans la liste au-delà de 100 restaurants.

### 7. Gamification
- Badges : "10 restaurants faits", "Gourmet asiatique", "Explorateur de Bordeaux".
- Objectifs mensuels : "Essayer 3 nouveaux restaurants ce mois-ci".
- Défis thématiques : "Manger dans 5 cuisines différentes".

## Recommandation de priorisation

Phase 1 (impact immédiat, faible complexité) :
- Filtre "Ouvert maintenant" + indicateur live.
- Tri des résultats (note, avis, prix, distance).
- Bouton "Itinéraire".
- Recherche textuelle libre.
- Niveau de prix et filtre prix.

Phase 2 (engagement utilisateur) :
- Favoris / wishlist.
- Notes personnelles en étoiles.
- Date de visite + historique.
- Statistiques personnelles.

Phase 3 (cloud / social) :
- Authentification Lovable Cloud + sync carnet.
- Partage de liens et de listes.
- Badges / défis.

## Questions de priorisation
Quelles sont les 3 fonctionnalités que tu veux implémenter en premier ?
- Est-ce que tu veux activer Lovable Cloud pour synchroniser le carnet (compte utilisateur) ?
- Est-ce que tu veux que l'on conserve le scope sur les 6 villes actuelles ou l'étendre à toute la France / l'Europe ?
- As-tu une préférence entre "fonctionnalités de découverte" (filtres, tri, itinéraire) et "fonctionnalités de carnet" (favoris, notes, stats) ?