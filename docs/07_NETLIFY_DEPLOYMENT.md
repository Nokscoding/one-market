# 07 — Déploiement Netlify

## Build

```bash
npm install
npm run build
```

Sortie : `dist/`.

## Configuration du site Netlify

- Build command : `npm run build`
- Publish directory : `dist`

Le fichier `netlify.toml` est déjà fourni.

## Variables d'environnement

Dans Netlify > Site configuration > Environment variables :

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Puis redéployer.

## Pourquoi le redirect `/* -> /index.html` ?

React Router gère `/product/...`, `/orders/...`, etc. côté navigateur. Sans fallback SPA, ouvrir directement une URL profonde peut retourner une 404 Netlify.

## Secrets

Une variable commençant par `VITE_` est injectée dans le bundle public. Elle ne doit donc jamais contenir un secret serveur.

Pour Stripe Secret Key, service_role, clés privées EmailJS, etc. utiliser une fonction serveur/Edge Function avec variables non exposées au navigateur.
