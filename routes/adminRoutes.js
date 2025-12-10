// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const sql = require('../db');
const bcrypt = require('bcrypt');

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
    // 1. Générer les identifiants
    const password = Math.random().toString(36).slice(-8); // Mot de passe aléatoire de 8 caractères
    const hashedPassword = await bcrypt.hash(password, 10);
    const securite_sociale = Array.from({ length: 15 }, () => Math.floor(Math.random() * 10)).join('');
    
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
      VALUES (${request.email}, ${hashedPassword}, ${securite_sociale}, ${id_utilisateur_medecin}, ${role}, ${request.prenom}, ${request.nom}, ${date_naissance}, ${sexe}, ${request.telephone || '0000000000'}, ${adresse_postale})
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

module.exports = router;
