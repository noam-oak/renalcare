const express = require('express');
const { supabase, supabaseAdmin } = require('../services/supabaseClient');
const { verifyToken, verifyRole } = require('../middleware/auth');
const sql = require('../db');
const bcrypt = require('bcrypt');

const router = express.Router();

// ===== CONNEXION UNIFIÉE (Auto-détection du rôle) =====

// Connexion unifiée
// ===== INSCRIPTION UNIFIÉE =====
router.post('/register', async (req, res) => {
  const { email, password, securite_sociale, role, telephone } = req.body;

  // Validation
  if (!email || !password || !securite_sociale || !role) {
    return res.status(400).json({ 
      success: false,
      error: 'Email, mot de passe, numéro de sécurité sociale et rôle sont requis.' 
    });
  }

  if (password.length < 6) {
    return res.status(400).json({ 
      success: false,
      error: 'Le mot de passe doit contenir au moins 6 caractères.' 
    });
  }

  if (!['patient', 'medecin', 'admin'].includes(role)) {
    return res.status(400).json({ 
      success: false,
      error: 'Rôle invalide.' 
    });
  }

  try {
    // Vérifier si l'email existe déjà
    const existingUsers = await sql`SELECT * FROM utilisateur WHERE email = ${email}`;

    if (existingUsers.length > 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Cet email est déjà utilisé.' 
      });
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // id_utilisateur_medecin est NULL par défaut (sera assigné plus tard pour les patients)
    const id_utilisateur_medecin = null;

    // Générer des valeurs aléatoires pour les champs manquants
    const sexes = [0, 1];
    const sexe = sexes[Math.floor(Math.random() * sexes.length)];
    
    const adresses = [
      '123 Rue de la Paix, 75001 Paris',
      '456 Avenue des Champs, 75008 Paris',
      '789 Boulevard Saint-Germain, 75005 Paris',
      '321 Rue du Faubourg, 75009 Paris',
      '654 Avenue Montaigne, 75008 Paris'
    ];
    const adresse_postale = adresses[Math.floor(Math.random() * adresses.length)];

    // Générer une date de naissance aléatoire (entre 18 et 80 ans)
    const today = new Date();
    const birthDate = new Date(
      today.getFullYear() - Math.floor(Math.random() * 62) - 18,
      Math.floor(Math.random() * 12),
      Math.floor(Math.random() * 28) + 1
    );
    const date_naissance = birthDate.toISOString().split('T')[0];

    // Utiliser le téléphone passé ou une valeur par défaut
    const phone = telephone || '0123456789';

    // Insérer le nouvel utilisateur
    // Capitaliser le rôle pour la base de données (Patient, Medecin, Admin)
    const roleCapitalized = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();

    const newUsers = await sql`
      INSERT INTO utilisateur (email, mdp, securite_sociale, id_utilisateur_medecin, role, prenom, nom, date_naissance, sexe, telephone, adresse_postale)
      VALUES (${email}, ${hashedPassword}, ${securite_sociale}, ${id_utilisateur_medecin}, ${roleCapitalized}, 'À', 'compléter', ${date_naissance}, ${sexe}, ${phone}, ${adresse_postale})
      RETURNING id, email, prenom, nom, role
    `;

    if (!newUsers || newUsers.length === 0) {
      return res.status(500).json({ 
        success: false,
        error: 'Erreur lors de la création du compte.' 
      });
    }

    const user = newUsers[0];

    // TODO: Envoyer un email de confirmation
    console.log(`Email de confirmation devrait être envoyé à ${email}`);

    res.status(201).json({
      success: true,
      message: 'Inscription réussie ! Un email de confirmation a été envoyé.',
      user: {
        id: user.id,
        email: user.email,
        prenom: user.prenom,
        nom: user.nom,
        role: role
      }
    });

  } catch (err) {
    console.error('Erreur inscription:', err);
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de l\'inscription. Veuillez réessayer plus tard.' 
    });
  }
});

// ===== INSCRIPTION PATIENT (formulaire d'auto-inscription) =====
router.post('/patient/register', async (req, res) => {
  const { email, password, securite_sociale, nom, prenom, telephone, adresse } = req.body;

  // Validation
  if (!email || !password || !securite_sociale) {
    return res.status(400).json({ 
      success: false,
      error: 'Email, mot de passe et numéro de sécurité sociale sont requis.' 
    });
  }

  if (password.length < 6) {
    return res.status(400).json({ 
      success: false,
      error: 'Le mot de passe doit contenir au moins 6 caractères.' 
    });
  }

  try {
    // Vérifier si l'email existe déjà
    const existingUsers = await sql`SELECT * FROM utilisateur WHERE email = ${email}`;

    if (existingUsers.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Cet email n\'existe pas. Veuillez vérifier votre email ou contacter l\'administrateur.' 
      });
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // UPDATE l'utilisateur existant avec le nouveau mot de passe, numéro de sécurité sociale et infos complètes
    const updatedUsers = await sql`
      UPDATE utilisateur 
      SET mdp = ${hashedPassword}, 
          securite_sociale = ${securite_sociale},
          nom = ${nom || 'À compléter'},
          prenom = ${prenom || 'À compléter'},
          telephone = ${telephone || '0123456789'},
          adresse_postale = ${adresse || 'À compléter'},
          role = 'Patient'
      WHERE email = ${email}
      RETURNING id, email, prenom, nom, id_utilisateur_medecin
    `;

    if (!updatedUsers || updatedUsers.length === 0) {
      return res.status(500).json({ 
        success: false,
        error: 'Erreur lors de la mise à jour du compte.' 
      });
    }

    const user = updatedUsers[0];

    res.status(200).json({
      success: true,
      message: 'Inscription réussie ! Vous pouvez maintenant vous connecter.',
      user: {
        id: user.id,
        email: user.email,
        prenom: user.prenom,
        nom: user.nom,
        role: 'patient'
      }
    });

  } catch (err) {
    console.error('Erreur inscription patient:', err);
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de l\'inscription. Veuillez réessayer plus tard.' 
    });
  }
});

// ===== LOGIN ROUTES =====
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  try {
    // Chercher l'utilisateur dans la table
    const users = await sql`SELECT * FROM utilisateur WHERE email = ${email}`;
    const dbUser = users[0];

    if (!dbUser) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Vérifier le mot de passe (hash)
    const match = await bcrypt.compare(password, dbUser.mdp);
    if (!match) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Déterminer le rôle
    let role = dbUser.role;

    // Fallback pour la rétrocompatibilité
    if (!role) {
      if (dbUser.id_utilisateur_medecin === 1) {
        role = 'Medecin';
      } else if (dbUser.id_utilisateur_medecin === 3) {
        role = 'Admin';
      } else {
        role = 'Patient';
      }
    }

    // Normaliser le rôle en minuscule pour le frontend
    const normalizedRole = role.toLowerCase();

    // Connexion réussie
    return res.status(200).json({
      success: true,
      message: 'Connexion réussie',
      user: {
        id: dbUser.id,
        email: dbUser.email,
        nom: dbUser.nom,
        prenom: dbUser.prenom,
        role: normalizedRole, // 'patient', 'medecin', 'admin'
        profile: dbUser,
      },
    });
  } catch (err) {
    console.error('Erreur login', err);
    res.status(500).json({ error: 'Connexion impossible pour le moment.' });
  }
});

// Route spécifique pour le login patient (même logique que /login)
router.post('/patient/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  try {
    const users = await sql`SELECT * FROM utilisateur WHERE email = ${email}`;
    const dbUser = users[0];

    if (!dbUser) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Vérifier le mot de passe (hash)
    const match = await bcrypt.compare(password, dbUser.mdp);
    if (!match) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Vérifier que c'est bien un patient
    if (dbUser.role && dbUser.role.toLowerCase() !== 'patient') {
       return res.status(403).json({ error: 'Accès réservé aux patients.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Connexion réussie',
      user: {
        id: dbUser.id,
        email: dbUser.email,
        nom: dbUser.nom,
        prenom: dbUser.prenom,
        role: 'patient',
        profile: dbUser,
      },
    });
  } catch (err) {
    console.error('Erreur login patient', err);
    res.status(500).json({ error: 'Connexion impossible pour le moment.' });
  }
});

// ===== MEDECIN =====

// Inscription Médecin
router.post('/medecin/register', async (req, res) => {
  const {
    email,
    password,
    full_name,
    specialite,
    phone,
    adresse,
    numero_licence,
  } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' });
  }

  try {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        role: 'Medecin',
      },
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    await supabase
      .from('medecin_profiles')
      .upsert(
        {
          auth_id: data.user.id,
          email,
          full_name,
          specialite,
          phone,
          adresse,
          numero_licence,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'auth_id' }
      );

    res.status(201).json({
      success: true,
      message: 'Médecin créé avec succès',
      userId: data.user.id,
    });
  } catch (err) {
    console.error('Erreur inscription médecin', err);
    res.status(500).json({ error: 'Inscription impossible pour le moment.' });
  }
});

// ===== ROUTES PROTÉGÉES =====

// Renouveler le token
router.post('/refresh-token', async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: 'Refresh token requis' });
  }

  try {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token,
    });

    if (error) {
      return res.status(401).json({ error: 'Token invalide' });
    }

    res.json({
      success: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
      },
    });
  } catch (err) {
    console.error('Erreur renouvellement token', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer l'utilisateur connecté
router.get('/me', verifyToken, async (req, res) => {
  try {
    const userRole = req.user.user_metadata?.role;
    let profile = null;

    if (userRole === 'patient') {
      const { data } = await supabase
        .from('patient_profiles')
        .select('*')
        .eq('auth_id', req.user.id)
        .single();
      profile = data;
    } else if (userRole === 'medecin') {
      const { data } = await supabase
        .from('medecin_profiles')
        .select('*')
        .eq('auth_id', req.user.id)
        .single();
      profile = data;
    }

    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        role: userRole,
        profile,
      },
    });
  } catch (err) {
    console.error('Erreur récupération utilisateur', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Déconnexion
router.post('/logout', verifyToken, async (req, res) => {
  try {
    await supabase.auth.signOut();
    res.json({ success: true, message: 'Déconnexion réussie' });
  } catch (err) {
    console.error('Erreur déconnexion', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ===== ROUTE POUR AFFICHER LES UTILISATEURS =====

// Récupérer tous les utilisateurs
router.get('/utilisateurs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('utilisateur')
      .select('*');

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      success: true,
      count: data.length,
      utilisateurs: data,
    });
  } catch (err) {
    console.error('Erreur récupération utilisateurs', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
