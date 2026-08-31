# 13 — Emails et EmailJS

## État actuel

La V6 publique **n'envoie pas encore d'emails via EmailJS**. EmailJS est documenté comme service prévu pour les notifications simples.

## Événements à notifier

| Événement | Client | Vendeur | Admin pays |
|---|---:|---:|---:|
| Compte créé | ✅ | — | — |
| Nouvelle commande | ✅ confirmation | ✅ nouvelle commande | optionnel |
| Commande vendeur confirmée | ✅ | ✅ | — |
| Commande refusée | ✅ raison | ✅ | optionnel |
| Paiement confirmé | ✅ | ✅ | optionnel |
| Préparation | ✅ optionnel | ✅ | — |
| Mise en livraison | ✅ | ✅ | optionnel |
| Livraison terminée | ✅ | ✅ | optionnel |
| Nouveau litige | ✅ | ✅ | ✅ |
| Vendeur approuvé | — | ✅ | ✅ |

## Architecture recommandée

Pour un email purement informatif et non sensible, EmailJS peut être appelé depuis le frontend avec ses identifiants publics.

Pour une action critique, préférer :

```text
événement en base / paiement
        │
        ▼
Edge Function / Netlify Function
        │
        ├── validation serveur
        └── envoi email
```

Pourquoi : un client ne doit pas pouvoir déclencher lui-même un faux email "paiement confirmé".

## Variables

Ne jamais exposer une clé privée dans `VITE_*`.

Les variables publiques éventuelles sont préparées dans `.env.example`, mais commentées tant que l'intégration n'est pas active.
