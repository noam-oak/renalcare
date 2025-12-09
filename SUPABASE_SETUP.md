# Configuration de Supabase

## Étape 1 : Créer un compte Supabase

1. Allez sur [https://supabase.com](https://supabase.com)
2. Inscrivez-vous avec votre compte GitHub
3. Créez une nouvelle organisation et un nouveau projet

## Étape 2 : Récupérer vos clés API

Dans le panneau Supabase (Project Settings > API):
1. Copiez `Project URL` → `SUPABASE_URL` dans `.env`
2. Copiez `anon public` key → `SUPABASE_ANON_KEY` dans `.env`
3. Copiez `service_role` secret → `SUPABASE_SERVICE_ROLE_KEY` dans `.env`

## Étape 3 : Configurer votre fichier `.env`

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=3000
NODE_ENV=development
```

## Étape 4 : Créer les tables de base de données

Allez dans l'onglet SQL Editor de Supabase et exécutez ce script:

### Authentification Supabase
L'authentification est gérée automatiquement par Supabase Auth.

### Tables de données

```sql
-- Table des patients
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    email VARCHAR(255) NOT NULL,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    date_naissance DATE,
    telephone VARCHAR(20),
    adresse TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des médecins
CREATE TABLE medecins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    email VARCHAR(255) NOT NULL,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    specialite VARCHAR(100) NOT NULL,
    numero_licence VARCHAR(50),
    telephone VARCHAR(20),
    adresse_cabinet TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des admins
CREATE TABLE admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    email VARCHAR(255) NOT NULL,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des rendez-vous
CREATE TABLE rendez_vous (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
    medecin_id UUID REFERENCES medecins(id) ON DELETE CASCADE NOT NULL,
    date_heure TIMESTAMP WITH TIME ZONE NOT NULL,
    motif TEXT NOT NULL,
    statut VARCHAR(50) DEFAULT 'planifié', -- 'planifié', 'complété', 'annulé'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
    medecin_id UUID REFERENCES medecins(id) ON DELETE CASCADE NOT NULL,
    contenu TEXT NOT NULL,
    expediteur_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    lu BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des documents
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
    medecin_id UUID REFERENCES medecins(id) ON DELETE CASCADE,
    nom VARCHAR(255) NOT NULL,
    type VARCHAR(50), -- 'ordonnance', 'résultat', 'image', etc.
    url VARCHAR(500),
    date_upload TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des questionnaires
CREATE TABLE questionnaires (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
    medecin_id UUID REFERENCES medecins(id) ON DELETE CASCADE NOT NULL,
    titre VARCHAR(255) NOT NULL,
    contenu JSONB,
    reponses JSONB,
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    date_reponse TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activer RLS (Row Level Security)
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE medecins ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE rendez_vous ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaires ENABLE ROW LEVEL SECURITY;

-- Politiques de sécurité pour les patients
CREATE POLICY "Patients can view their own data" ON patients
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Patients can update their own data" ON patients
    FOR UPDATE USING (auth.uid() = user_id);

-- Politiques de sécurité pour les médecins
CREATE POLICY "Medecins can view their own data" ON medecins
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Patients can view their medecin" ON medecins
    FOR SELECT USING (true);
```

## Étape 5 : Utiliser les routes d'authentification

### Inscription Patient
```bash
POST /api/auth/patient/signup
Content-Type: application/json

{
    "email": "patient@example.com",
    "password": "password123",
    "nom": "Dupont",
    "prenom": "Marie"
}
```

### Connexion Patient
```bash
POST /api/auth/patient/login
Content-Type: application/json

{
    "email": "patient@example.com",
    "password": "password123"
}
```

### Inscription Médecin
```bash
POST /api/auth/medecin/signup
Content-Type: application/json

{
    "email": "medecin@example.com",
    "password": "password123",
    "nom": "Martin",
    "prenom": "Jean",
    "specialite": "Cardiologie"
}
```

### Connexion Médecin
```bash
POST /api/auth/medecin/login
Content-Type: application/json

{
    "email": "medecin@example.com",
    "password": "password123"
}
```

### Déconnexion
```bash
POST /api/auth/logout
```

### Vérifier l'utilisateur actuel
```bash
GET /api/auth/current-user
```

## Étape 6 : Frontend avec Supabase

Chargez le client Supabase dans vos fichiers HTML:

```html
<!-- À ajouter avant votre script -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="/js/supabaseClient.js"></script>
```

Utilisez les fonctions d'authentification:

```javascript
// Connexion
const result = await signIn('patient@example.com', 'password123');
if (result.success) {
    console.log('Connecté:', result.data.user);
} else {
    console.error('Erreur:', result.error);
}

// Récupérer l'utilisateur actuel
const user = await getCurrentUser();

// Déconnexion
await signOut();
```

## Utiliser databaseOperations.js

Exemple dans une route:

```javascript
const { patientOperations, medecinOperations } = require('../utils/databaseOperations');

// Récupérer tous les patients
const { data: patients, error } = await patientOperations.getAll();

// Mettre à jour un patient
await patientOperations.update(patientId, { telephone: '0123456789' });
```
