# Telesurveillance — Frontend (public)

Brief
- Frontend statique pour un projet de télésurveillance (HTML / CSS / JS).
- Contenu principal :
  - public/
    - html/
      - mot-de-passe-oublie.html
      - admin/
        - admin-dashboard-complet.html
        - admin-login.html
      - Medecin/
        - medecin-dashboard-complet.html
        - medecin-inscription.html
        - medecin-login.html
      - Patient/
        - document.html
        - messagerie.html
        - patient-dashboard.html
        - patient-inscription.html
        - patient-login.html
        - questionnaire.html
        - rendez-vous.html
        - resultat.html
        - treatment.html
    - style/
      - admin.css
      - medecin.css
      - patient.css

## Backend Express + Supabase

Le serveur Express (fichier `app.js`) expose les routes REST sous `/api`. Il délègue l'authentification, l'inscription et la persistance des questionnaires à Supabase.

1. Créez un projet Supabase et deux tables :
   - `patient_profiles` (colonnes recommandées : `auth_id uuid primary key`, `email text`, `full_name text`, `phone text`, `secu_number text`, `address text`, `birth_date date`, `height_cm numeric`).
   - `patient_questionnaires` (colonnes : `id uuid default gen_random_uuid()`, `patient_id uuid`, `completed_at timestamptz`, `answers jsonb`, `age int`, `height_cm numeric`, `weight_kg numeric`, `phone text`, `secu_number text`, `address text`, `metadata jsonb`).
2. Récupérez les clés dans l'onglet **Project Settings → API** :
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (nécessaire côté serveur pour `auth.admin` et les insertions sans RLS).
3. Copiez `.env.example` vers `.env` et renseignez les valeurs ci-dessus.
4. Installez les dépendances :
   ```bash
   npm install
   ```
5. Lancez le serveur :
   ```bash
   npm run dev
   ```

Routes principales :
- `POST /api/auth/patient/register` : crée l'utilisateur Supabase + le profil patient.
- `POST /api/auth/patient/login` : authentifie et renvoie la session Supabase + le profil.
- `POST /api/patients/:id/questionnaires` : stocke un questionnaire complet (réponses JSON + métadonnées).
- `GET /api/patients/:id/questionnaires` : liste chronologique des questionnaires.
- `GET /api/patients/:id/profile` : profil patient synchronisé avec Supabase.

> ⚠️ Les routes supposent que les tables ci-dessus existent et que la clé **service role** n'est jamais exposée côté frontend.

---

Installation rapide — récupérer le code (Windows / terminal VS Code)

### A. Si vous n'avez pas encore de copie locale
1. Ouvrez PowerShell ou le terminal intégré de VS Code dans le dossier où vous voulez cloner le projet.
2. Clonez le dépôt :
```bash
git clone https://github.com/Sautistos/Super-Projet.git
cd <REPO>
```

### B. Si le projet existe localement mais n'est pas initialisé avec git
Depuis la racine du projet (par exemple c:\Users\hp\Documents\Telesurveillance) :
```bash
git init
git remote add origin https://github.com/Sautistos/Super-Projet.git
git fetch origin
# si la branche distante principale est main :
git checkout -b main origin/main
# ou si la branche principale est master :
# git checkout -b master origin/master
```

Se synchroniser avant de travailler
```bash
git status
# si vous avez des modifications non committées, sauvegardez-les temporairement :
git stash push -m "WIP: sauvegarde avant pull"   # optionnel
git fetch origin
git pull --rebase origin main   # ou origin master selon la branche par défaut
# si vous avez stashé :
git stash pop
```

Travailler sur une branche et créer une Pull Request

1. Créer une branche de fonctionnalité :
```bash
git checkout -b feature/<courte-description>
```
2. Faire les modifications, préparer et committer :
```bash
git add .
git commit -m "feat: courte description de la modification"
```
3. Pousser la branche vers le remote :
```bash
git push -u origin feature/<courte-description>
```
4. Créer la Pull Request

- Via l'interface web GitHub :
  - Ouvrez le dépôt sur GitHub, cliquez sur "Compare & pull request".
  - Vérifiez que la base est `main` (ou `master`), ajoutez un titre et une description, puis assignez la PR à vous-même (Assignees) et créez la PR.

- Via GitHub CLI :
```bash
gh auth login               # si vous n'êtes pas connecté
git push -u origin feature/<courte-description>
gh pr create --base main --head feature/<courte-description> --title "Titre PR" --body "Description et étapes pour tester" --assignee <VOTRE_USERNAME>
```

Après la revue
- Appliquez les corrections localement, puis commit/push :
```bash
git add .
git commit -m "fix: corrections suite review"
git push
```
- Fusionnez la PR via l'interface GitHub ou avec la CLI :
```bash
gh pr merge <PR_NUM_OR_URL> --merge
```

Recommandations
- Ajoutez un fichier .gitignore avant le premier git add (ex. node_modules, .env, .vscode, fichiers build).
- Utilisez des messages de commit clairs (par ex. Conventional Commits).
- Préférez `git pull --rebase` pour un historique plus linéaire.
- Nommez les branches de façon explicite (feature/, fix/, chore/).
