# 14 — Paiements RDC / USA

## État V6

Le paiement n'est pas intégré. La commande est créée, puis le client et chaque vendeur organisent le paiement et la livraison dans le chat.

## Modèle cible USA

Service recommandé à évaluer : Stripe Connect.

Flux conceptuel :

```text
Client US
   │
   ▼
One Market checkout
   │
   ▼
Backend sécurisé
   │
   ▼
Stripe / Stripe Connect
   │
   ├── statut paiement → One Market
   ├── commission plateforme
   └── payout vendeur selon modèle retenu
```

Le frontend ne doit jamais posséder la Secret Key Stripe.

Les webhooks doivent être vérifiés côté serveur avant de changer un statut de paiement.

## Modèle cible RDC

Intégrer un prestataire de paiement compatible avec le marché et la réglementation applicables : Mobile Money, carte ou autre PSP contracté par NKS/One Market.

Le code doit isoler la méthode de paiement par marché, par exemple :

```text
market = US -> payment_adapter = stripe_connect
market = CD -> payment_adapter = local_psp
```

## Tables futures recommandées

- `payments`
- `payment_attempts`
- `refunds`
- `payouts`
- `commissions`
- `payment_events`

Les commandes ne doivent pas utiliser uniquement un champ texte de paiement sans historique auditable.
