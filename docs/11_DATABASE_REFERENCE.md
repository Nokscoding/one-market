# 11 — Référence base utilisée par V6

Cette référence est déduite des requêtes du frontend. Elle décrit l'usage, pas le schéma SQL complet.

| Table | Utilisation dans V6 |
|---|---|
| `profiles` | profil client, pays, langue, téléphone |
| `categories` | catégories actives du catalogue |
| `stores` | boutiques, pays, logo, bannière, slug |
| `products` | catalogue et stock de base |
| `product_images` | images produit via `secure_url` |
| `product_variants` | options/variantes + prix/stock |
| `carts` | panier attaché au client |
| `cart_items` | lignes panier |
| `addresses` | adresses de livraison |
| `orders` | commande globale client |
| `seller_orders` | sous-commande par boutique |
| `order_items` | snapshot des lignes commandées |
| `conversations` | chat attaché à une sous-commande |
| `messages` | messages chat |

## Champs visibles dans le code

### `stores`
`id`, `name`, `slug`, `country_code`, `currency`, `status`, `city`, `description`, `logo_url`, `banner_url`.

### `products`
`id`, `store_id`, `category_id`, `name`, `description`, `price`, `currency`, `stock_qty`, `has_variants`, `is_active`, `created_at`.

### `product_variants`
`id`, `product_id`, `attributes`, `price`, `stock_qty`, `is_active`.

### `addresses`
`customer_id`, `label`, `full_name`, `phone`, `country_code`, `address_line1`, `address_line2`, `district`, `city`, `state_region`, `postal_code`, `instructions`, `is_default`.

### `seller_orders`
Le frontend lit notamment : `id`, `order_id`, `store_id`, `seller_order_number`, `status`, `is_cross_border`, `subtotal`, `delivery_fee`, `currency`, `refusal_reason`.

### `messages`
Le frontend utilise : `id`, `conversation_id`, `order_item_id`, `sender_id`, `content`, `created_at`.

## À documenter côté Supabase

Le dépôt ne contient pas encore le SQL complet. Ajouter ultérieurement un dossier `supabase/` avec :
- migrations ;
- fonctions ;
- triggers ;
- policies RLS ;
- seeds de développement.
