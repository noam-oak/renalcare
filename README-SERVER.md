Serveur Express pour le projet Super-Projet

Ce fichier explique comment lancer le serveur localement.

Prérequis
- Node.js (version recommandée >= 14)

Installation
1. Ouvrir un terminal à la racine du projet (le dossier qui contient `app.js` et `package.json`).
2. Installer les dépendances :

   npm install

Lancer le serveur
- Démarrer le serveur :

   npm run dev 
   ou
   npm run

Le serveur écoute par défaut sur le port 3000. Points d'accès utiles :
- Pages statiques (servies depuis `Pages site web`)
  - /admin -> `admin-dashboard-complet.html`
  - /medecin -> `medecin-dashboard-complet.html`
  - /patient -> `patient-dashboard.html`
  - /mot-de-passe-oublie -> `mot-de-passe-oublie.html`

- API (exemples)
  - GET /api/health  -> { status: 'ok' }
  - POST /api/medecin/login  -> données JSON { email, password } (placeholder)
  - POST /api/patient/login  -> données JSON { email, password } (placeholder)

Notes
- Les endpoints API sont des placeholders. Remplacez la logique par une vraie authentification / persistance (base de données) selon vos besoins.
- Si vous voulez un rechargement automatique en développement, installez `nodemon` et lancez `npx nodemon server.js`.
