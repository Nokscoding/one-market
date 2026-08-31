# 12 — Workflow développeur

## Installation

```bash
git clone <repo>
cd <repo>
npm install
cp .env.example .env.local
npm run dev
```

## Avant une modification

- lire `PROJECT_STATUS.md` ;
- identifier le rôle impacté ;
- identifier le marché impacté ;
- vérifier les tables/RLS ;
- vérifier mobile.

## Branches

```text
feature/...
fix/...
security/...
docs/...
```

## Avant PR

```bash
npm run build
```

Tester :
- navigation directe vers routes profondes ;
- connexion/déconnexion ;
- panier ;
- checkout ;
- commandes ;
- chat ;
- mobile ;
- filtres CD/US.

## PR

La description doit mentionner :
- objectif ;
- fichiers principaux ;
- tables Supabase ;
- RLS ;
- rôles ;
- pays ;
- tests ;
- captures si UI.

## Base de données

Une modification de schéma doit être versionnée comme migration SQL dès qu'un dossier `supabase/` est introduit. Ne pas modifier la production manuellement sans trace.
