# 03 — Onglets, fenêtres et routes

## Header / navigation globale

Desktop :
- logo One Market ;
- indicateur `RDC ↔ USA` ;
- recherche ;
- accès Compte ;
- accès Commandes ;
- Panier ;
- sous-navigation : Nouveautés, RDC, États-Unis, Boutiques, Catégories.

Mobile :
- logo ;
- barre de recherche ;
- accès pays ;
- navigation fixe en bas : **Accueil / Compte / Panier / Commandes / Menu** ;
- menu en bottom sheet.

## `/` — Accueil

Fichier : `src/pages/Home.jsx`.

Affiche :
- hero One Market ;
- nouveautés ;
- catégories ;
- sélection RDC ;
- sélection USA ;
- avantages marketplace ;
- derniers produits ;
- boutiques à découvrir.

## `/catalog` — Catalogue

Fichier : `src/pages/Catalog.jsx`.

Filtres :
- texte `q` ;
- catégorie `category` ;
- pays `country=CD|US`.

## `/stores` — Boutiques

Fichier : `src/pages/Stores.jsx`.

Liste uniquement les boutiques `status = active`.

## `/store/:slug` — Une boutique

Fichier : `src/pages/StorePage.jsx`.

Affiche bannière, logo, description, localisation et produits actifs.

## `/product/:id` — Produit

Fichier : `src/pages/ProductPage.jsx`.

Affiche :
- galerie ;
- vendeur ;
- prix ;
- description ;
- variantes ;
- stock ;
- quantité ;
- ajout au panier.

## `/auth` — Connexion / inscription

Fichier : `src/pages/AuthPage.jsx`.

Connexion : email + mot de passe.
Inscription : nom + pays + email + mot de passe.

## `/cart` — Panier

Fichier : `src/pages/CartPage.jsx`.
Accès : client connecté.

Particularité : groupe automatiquement les articles par boutique.

## `/checkout` — Finalisation

Fichier : `src/pages/CheckoutPage.jsx`.
Accès : client connecté.

Permet de choisir/créer une adresse RDC ou USA puis appelle `checkout_cart`.

## `/orders` — Mes commandes

Fichier : `src/pages/OrdersPage.jsx`.

Liste des commandes globales et nombre de boutiques associées.

## `/orders/:id` — Détail commande

Fichier : `src/pages/OrderPage.jsx`.

Une commande globale est présentée avec plusieurs cartes vendeur (`seller_orders`). Chaque carte peut avoir son propre statut.

## `/chat/:id` — Chat

Fichier : `src/pages/ChatPage.jsx`.

Conversation liée à une sous-commande vendeur. Le client peut aussi lier un message à un article précis. Nouveaux messages reçus via Supabase Realtime.

## `/account` — Compte

Fichier : `src/pages/AccountPage.jsx`.

Modification : nom, téléphone, pays, langue. Accès commandes et déconnexion.

## Écrans futurs

Non présents dans V6 :
- `/admin` Super Admin ;
- `/admin/market/:country` Admin Pays ;
- `/seller` Vendeur ;
- `/delivery` Livreur.

Ces noms de routes sont des recommandations, pas encore des routes actives.
