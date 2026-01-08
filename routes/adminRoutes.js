// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const sql = require('../db');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const pendingRequestsStore = require('../services/pendingRequestsStore');
const {
  sendValidationEmail,
  sendRefusalEmail,
} = require('../services/mailService');

/**
 * GET /api/admin/pending-requests
 * Renvoie toutes les demandes en attente (pour le tableau "Comptes en attente")
 */
router.get('/pending-requests', (req, res) => {
  try {
    const requests = pendingRequestsStore.getAll();
    res.json(requests);
  } catch (err) {
    console.error('Erreur /pending-requests:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * POST /api/admin/validate-account
 * Valide une demande :
 *  - récupère la demande par id
 *  - envoie un email d’acceptation avec lien d’inscription
 *  - supprime la demande du store
 */
router.post('/validate-account', async (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res
      .status(400)
      .json({ success: false, error: 'ID de demande manquant.' });
  }

  const request = pendingRequestsStore.getById(Number(id));
  if (!request) {
    return res
      .status(404)
      .json({ success: false, error: 'Demande introuvable.' });
  }

  try {
    // Stopper proprement si l'email existe déjà en base
    const existing = await sql`SELECT id, role FROM utilisateur WHERE email = ${request.email}`;
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: `Un compte existe déjà pour ${request.email}. Supprimez/traitez la demande en double ou réinitialisez le mot de passe de ce compte.`,
      });
    }

    // 1. Générer les identifiants
    const password = Math.random().toString(36).slice(-8); // Mot de passe aléatoire de 8 caractères
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    const securite_sociale = BigInt(Array.from({ length: 15 }, () => Math.floor(Math.random() * 10)).join(''));
    
    // 2. Préparer les données
    // Capitaliser le rôle (patient -> Patient, medecin -> Medecin)
    const roleRaw = request.type === 'medecin' ? 'medecin' : 'patient';
    const role = roleRaw.charAt(0).toUpperCase() + roleRaw.slice(1);
    
    const id_utilisateur_medecin = null;
    
    // Générer des valeurs par défaut pour les champs obligatoires manquants
    const sexes = [0, 1];
    const sexe = sexes[Math.floor(Math.random() * sexes.length)];
    const adresse_postale = 'Adresse à compléter';
    
    // Date de naissance par défaut (adulte)
    const today = new Date();
    const birthDate = new Date(today.getFullYear() - 30, 0, 1);
    const date_naissance = birthDate.toISOString().split('T')[0];

    // 3. Insérer dans la base de données
    const newUsers = await sql`
      INSERT INTO utilisateur (email, mdp, securite_sociale, id_utilisateur_medecin, role, prenom, nom, date_naissance, sexe, telephone, adresse_postale)
      VALUES (${request.email}, ${hashedPassword}, ${securite_sociale.toString()}, ${id_utilisateur_medecin}, ${role}, ${request.prenom}, ${request.nom}, ${date_naissance}, ${sexe}, ${request.telephone || '0000000000'}, ${adresse_postale})
      RETURNING id
    `;

    if (!newUsers || newUsers.length === 0) {
        throw new Error("Erreur lors de l'insertion en base de données");
    }

    // 4. Envoyer l'email avec le lien d'inscription
    await sendValidationEmail(request);
    
    // 5. Supprimer de la liste d'attente
    pendingRequestsStore.remove(request.id);

    return res.json({ success: true });
  } catch (err) {
    console.error('Erreur validate-account:', err);
    return res
      .status(500)
      .json({ success: false, error: 'Erreur lors de la validation: ' + err.message });
  }
});

/**
 * POST /api/admin/refuse-account
 * Refuse une demande :
 *  - récupère la demande par id
 *  - envoie un email de refus
 *  - supprime la demande du store
 */
router.post('/refuse-account', async (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res
      .status(400)
      .json({ success: false, error: 'ID de demande manquant.' });
  }

  const request = pendingRequestsStore.getById(Number(id));
  if (!request) {
    return res
      .status(404)
      .json({ success: false, error: 'Demande introuvable.' });
  }

  try {
    await sendRefusalEmail(request);
    pendingRequestsStore.remove(request.id);

    return res.json({ success: true });
  } catch (err) {
    console.error('Erreur refuse-account:', err);
    return res
      .status(500)
      .json({ success: false, error: 'Erreur lors du refus.' });
  }
});

// Lecture des logs applicatifs (console/app.log)
router.get('/logs', async (req, res) => {
  try {
    const logPath = process.env.APP_LOG_PATH || path.join(__dirname, '..', 'app.log');
    if (!fs.existsSync(logPath)) {
      return res.json({ success: true, logs: [] });
    }

    const raw = await fs.promises.readFile(logPath, 'utf8');
    const maxLines = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 10), 1000);
    const maxLen = 500;

    const lines = raw.split(/\r?\n/).filter(Boolean);
    const tail = lines
      .slice(-maxLines)
      .map((line, idx) => {
        const truncated = line.length > maxLen ? `${line.slice(0, maxLen)}…` : line;
        return { id: idx, line: truncated };
      });

    res.json({ success: true, logs: tail, total: lines.length, returned: tail.length });
  } catch (err) {
    console.error('Erreur lecture logs:', err);
    res.status(500).json({ success: false, error: 'Impossible de lire les logs.' });
  }
});

// Notifications / alertes administrateur (données issues des demandes en attente)
router.get('/notifications', (req, res) => {
  try {
    const pending = pendingRequestsStore.getAll() || [];
    const items = pending.slice(-5).reverse().map((p, idx) => ({
      id: p.id || idx,
      title: 'Nouvelle demande en attente',
      detail: `${p.type === 'medecin' ? 'Médecin' : 'Patient'}: ${p.prenom} ${p.nom}`,
      time: p.createdAt || 'Récemment',
      icon: '⏳',
      unread: true,
    }));

    res.json({
      success: true,
      notifications: items,
      unread: items.length,
    });
  } catch (err) {
    console.error('Erreur notifications admin:', err);
    res.status(500).json({ success: false, error: 'Impossible de charger les notifications.' });
  }
});

// Télécharger le fichier brut de logs
router.get('/logs/download', async (_req, res) => {
  try {
    const logPath = process.env.APP_LOG_PATH || path.join(__dirname, '..', 'app.log');
    if (!fs.existsSync(logPath)) {
      return res.status(404).json({ success: false, error: 'Fichier de logs introuvable.' });
    }

    res.download(logPath, 'app.log');
  } catch (err) {
    console.error('Erreur téléchargement logs:', err);
    res.status(500).json({ success: false, error: 'Impossible de télécharger les logs.' });
  }
});

// ==========================================
// GESTION DES UTILISATEURS (CRUD)
// ==========================================

/**
 * GET /api/admin/users
 * Récupère tous les utilisateurs (patients et médecins)
 */
router.get('/users', async (req, res) => {
  try {
    const users = await sql`
      SELECT id, nom, prenom, email, role, telephone, securite_sociale 
      FROM utilisateur 
      WHERE role != 'Admin'
      ORDER BY id DESC
    `;
    res.json(users);
  } catch (err) {
    console.error('Erreur GET /users:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * GET /api/admin/users/:id
 * Récupère un utilisateur spécifique avec ses détails
 */
router.get('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const users = await sql`SELECT * FROM utilisateur WHERE id = ${id}`;
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'Utilisateur introuvable' });
    }
    
    const user = users[0];
    
    // Récupérer des infos supplémentaires selon le rôle si nécessaire
    // (ex: dossier médical pour patient)
    let details = {};
    if (user.role === 'Patient') {
       const dossier = await sql`SELECT * FROM dossier_medical WHERE id_utilisateur = ${id}`;
       if (dossier.length > 0) details.dossier = dossier[0];
    }

    res.json({ success: true, user, details });
  } catch (err) {
    console.error('Erreur GET /users/:id:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * PUT /api/admin/users/:id
 * Met à jour un utilisateur
 */
router.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { nom, prenom, email, telephone, role, securite_sociale } = req.body;

  try {
    const updatedUsers = await sql`
      UPDATE utilisateur 
      SET nom = ${nom}, prenom = ${prenom}, email = ${email}, 
          telephone = ${telephone}, role = ${role}, securite_sociale = ${securite_sociale}
      WHERE id = ${id}
      RETURNING *
    `;

    if (updatedUsers.length === 0) {
      return res.status(404).json({ success: false, error: 'Utilisateur introuvable' });
    }

    res.json({ success: true, user: updatedUsers[0] });
  } catch (err) {
    console.error('Erreur PUT /users/:id:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Supprime un utilisateur et ses données liées
 */
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Suppression en cascade manuelle (si pas de ON DELETE CASCADE en BDD)
    // 1. Supprimer les messages
    await sql`DELETE FROM messagerie WHERE id_utilisateur = ${id}`;
    
    // 2. Supprimer les RDV (si patient ou médecin)
    // Besoin de vérifier le rôle ou essayer de supprimer dans les deux cas si les colonnes existent
    // On suppose que l'ID est unique globalement
    await sql`DELETE FROM rdv WHERE id_utilisateur_medecin = ${id}`;
    
    // 3. Supprimer le dossier médical et ses dépendances (si patient)
    const dossier = await sql`SELECT id FROM dossier_medical WHERE id_utilisateur = ${id}`;
    if (dossier.length > 0) {
        const dossierId = dossier[0].id;
        await sql`DELETE FROM reponse WHERE id_dossier_medical = ${dossierId}`;
        await sql`DELETE FROM suivi_patient WHERE id_dossier_medical = ${dossierId}`;
        await sql`DELETE FROM rdv WHERE id_dossier_medical = ${dossierId}`; // RDV liés au dossier
        await sql`DELETE FROM dossier_medical WHERE id = ${dossierId}`;
    }

    // 4. Supprimer l'utilisateur
    const result = await sql`DELETE FROM utilisateur WHERE id = ${id} RETURNING id`;

    if (result.length === 0) {
      return res.status(404).json({ success: false, error: 'Utilisateur introuvable' });
    }

    res.json({ success: true, message: 'Utilisateur supprimé avec succès' });
  } catch (err) {
    console.error('Erreur DELETE /users/:id:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ==========================================
// STATISTIQUES
// ==========================================

/**
 * GET /api/admin/stats
 * Récupère les statistiques globales
 */
router.get('/stats', async (req, res) => {
  try {
    // Compter les utilisateurs par rôle (hors admin)
    const usersCount = await sql`
      SELECT role, COUNT(*) as count 
      FROM utilisateur 
      WHERE role != 'Admin' 
      GROUP BY role
    `;

    let totalPatients = 0;
    let totalMedecins = 0;

    usersCount.forEach(row => {
      if (row.role === 'Patient') totalPatients = parseInt(row.count);
      if (row.role === 'Medecin') totalMedecins = parseInt(row.count);
    });

    // Récupérer le nombre de demandes en attente
    const pendingRequests = pendingRequestsStore.getAll();
    const pendingCount = pendingRequests.length;

    // Récupérer les 3 dernières demandes pour l'activité récente
    // On suppose que les dernières ajoutées sont à la fin, donc on inverse
    const recentPending = [...pendingRequests].reverse().slice(0, 3);

    res.json({
      success: true,
      stats: {
        total: totalPatients + totalMedecins,
        patients: totalPatients,
        medecins: totalMedecins,
        pending: pendingCount,
        notifications: pendingCount,
        recentActivity: recentPending
      }
    });
  } catch (err) {
    console.error('Erreur GET /stats:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

module.exports = router;
