# 04 — Carte du code

```text
src/
├── App.jsx                 Routes et shell global
├── main.jsx                Point d'entrée React
├── styles.css              Styles globaux et responsive
├── components/
│   ├── EmptyState.jsx      État vide réutilisable
│   ├── Footer.jsx          Footer public
│   ├── Header.jsx          Navigation desktop/mobile
│   ├── Loader.jsx          Loader One Market
│   ├── Logo.jsx            Logo cliquable
│   ├── ProductCard.jsx     Carte produit
│   ├── ProtectedRoute.jsx  Bloque les routes privées sans session
│   └── SiteIntro.jsx       Intro motion au lancement
├── context/
│   ├── AuthContext.jsx     Session + profil + restauration Auth
│   └── CartContext.jsx     Panier en base et opérations panier
├── lib/
│   ├── format.js           Prix, dates et libellés de statuts
│   └── supabase.js         Client Supabase navigateur
└── pages/                  Une page principale par route
```

## Fichiers critiques

### `src/App.jsx`
Déclare les routes. Les routes client privées passent par `ProtectedRoute`.

### `src/context/AuthContext.jsx`
Restaure la session Supabase, écoute les changements d'authentification et charge `profiles`. Contient un failsafe de 6 secondes pour éviter un loader infini.

### `src/context/CartContext.jsx`
Charge le panier utilisateur depuis `carts` et `cart_items`, enrichit les lignes avec produits, variantes, images et boutiques, puis fournit `addItem`, `updateQuantity`, `removeItem`, `refreshCart`.

### `src/lib/supabase.js`
Ne doit contenir aucune clé privée. Les valeurs viennent de `.env.local`.

### `src/pages/CheckoutPage.jsx`
Appelle le RPC `checkout_cart`. Toute modification du checkout doit être coordonnée avec la fonction SQL côté Supabase.

### `src/pages/ChatPage.jsx`
Utilise Realtime sur la table `messages`.

### `src/pages/OrderPage.jsx`
Utilise Realtime pour rafraîchir les `seller_orders`.

## Règle de modification

Avant de modifier une page, identifier :
1. la route ;
2. le rôle utilisateur ;
3. les tables touchées ;
4. les politiques RLS ;
5. l'impact RDC/USA ;
6. le comportement mobile.
