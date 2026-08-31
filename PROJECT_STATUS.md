# État du projet — One Market V6

**Dernière base : V6 publique/client.**

## Fonctionnel dans cette V6

- Accueil marketplace RDC / USA.
- Catalogue produits.
- Recherche par nom.
- Filtre par catégorie.
- Filtre par pays : `CD` ou `US`.
- Annuaire des boutiques.
- Page boutique.
- Fiche produit.
- Variantes produit.
- Stock affiché / rupture de stock.
- Création de compte et connexion Supabase Auth.
- Profil client.
- Panier enregistré en base.
- Panier multi-boutiques.
- Adresses RDC et USA.
- Checkout via la fonction PostgreSQL/RPC `checkout_cart`.
- Commande principale + sous-commandes vendeurs.
- Historique des commandes.
- Détail par vendeur.
- Chat client-vendeur.
- Messages temps réel via Supabase Realtime.
- Mise à jour temps réel des `seller_orders`.
- Interface mobile avec navigation fixe.
- Intro animée et loaders One Market.

## Pas encore présent comme espace complet

- Dashboard Super Admin.
- Dashboard Admin RDC.
- Dashboard Admin USA.
- Dashboard Vendeur.
- Dashboard Livreur.
- Affectation des livreurs.
- Calcul automatique des commissions One Market.
- Paiements intégrés.
- Stripe Connect USA.
- Paiements/mobile money RDC.
- Versements automatiques aux vendeurs.
- Emails transactionnels EmailJS dans ce frontend.
- Backoffice d'upload médias dans cette V6.
- Traduction anglaise complète.
- Gestion automatique des taxes USA.
- Gestion litiges / remboursements / retours.

## Important

Le code contient déjà les bases de la séparation RDC / USA grâce à `country_code` sur les profils et boutiques. Cela ne suffit pas encore pour sécuriser un Admin USA : il faudra des rôles, un `market_code`/`country_code` d'administration et des politiques RLS dédiées.
