# 05 — Supabase

Supabase est actuellement le backend principal de la V6.

## Services Supabase utilisés

### Auth
Utilisé pour :
- création de compte ;
- connexion email/mot de passe ;
- persistance de session ;
- rafraîchissement automatique du token ;
- déconnexion.

### PostgreSQL / REST
Le frontend lit et modifie les tables via `supabase.from(...)`.

### Realtime
Deux usages visibles :
- nouveaux `messages` dans un chat ;
- changements de statut dans `seller_orders`.

### RPC
`checkout_cart(p_address_id)` est appelé depuis `CheckoutPage`.

## Tables utilisées par le frontend

- `profiles`
- `categories`
- `stores`
- `products`
- `product_images`
- `product_variants`
- `carts`
- `cart_items`
- `addresses`
- `orders`
- `seller_orders`
- `order_items`
- `conversations`
- `messages`

Voir `11_DATABASE_REFERENCE.md`.

## RLS obligatoire

Exemples de règles attendues :
- un client lit/modifie uniquement son `profile` ;
- un client lit/modifie uniquement son panier ;
- un client lit uniquement ses commandes ;
- un client lit uniquement ses conversations ;
- un vendeur lit uniquement les `seller_orders` de sa boutique ;
- un futur `country_admin` USA lit uniquement les ressources `US` ;
- un Admin RDC lit uniquement les ressources `CD` ;
- le Super Admin bénéficie d'une politique globale contrôlée.

## Clés

Frontend : Publishable/anon key seulement.
Backend sécurisé / fonctions : secrets séparés.
Jamais de `service_role` dans `VITE_*`.

## Realtime

Si une table est activée dans Realtime, RLS doit toujours être correcte. Le fait de recevoir un événement en temps réel ne doit pas contourner les droits de lecture.
