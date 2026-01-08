const express = require('express');
const { supabaseAdmin } = require('../services/supabaseClient');
const sql = require('../db');

const router = express.Router();

// Middleware très léger : vérifie que le Bearer token correspond à l'id patient passé dans l'URL
const authenticatePatient = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Token manquant' });
  }

  const token = authHeader.substring(7);
  const tokenId = parseInt(token, 10);
  const patientId = parseInt(req.params.id, 10);

  if (!tokenId || !patientId || tokenId !== patientId) {
    return res.status(403).json({ success: false, error: 'Accès refusé' });
  }

  req.patientId = patientId;
  next();
};

router.get('/:id/profile', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('patient_profiles')
      .select('*')
      .eq('auth_id', req.params.id)
      .single();

    if (error) {
      return res.status(404).json({ error: error.message });
    }

    res.json({ success: true, profile: data });
  } catch (err) {
    res.status(500).json({ error: 'Impossible de récupérer le profil patient.' });
  }
});

// Données de tableau de bord patient
router.get('/:id/dashboard', authenticatePatient, async (req, res) => {
  try {
    const patientId = req.patientId;

    const users = await sql`
      SELECT id, prenom, nom, email, id_utilisateur_medecin, date_naissance
      FROM utilisateur
      WHERE id = ${patientId} AND LOWER(role) = 'patient'
      LIMIT 1
    `;

    if (!users.length) {
      return res.status(404).json({ success: false, error: 'Patient introuvable' });
    }

    const patient = users[0];

    const dossier = await sql`
      SELECT id, groupe_sanguin, date_creation
      FROM dossier_medical
      WHERE id_utilisateur = ${patientId}
      LIMIT 1
    `;

    const dossierId = dossier.length ? dossier[0].id : null;

    let medecin = null;
    if (patient.id_utilisateur_medecin) {
      const med = await sql`
        SELECT id, prenom, nom, email
        FROM utilisateur
        WHERE id = ${patient.id_utilisateur_medecin}
        LIMIT 1
      `;
      medecin = med.length ? med[0] : null;
    }

    let lastSuivi = null;
    let lastReponse = null;

    if (dossierId) {
      const suiviRows = await sql`
        SELECT id, date, date_greffe, prescription
        FROM suivi_patient
        WHERE id_dossier_medical = ${dossierId}
        ORDER BY date DESC, id DESC
        LIMIT 1
      `;
      lastSuivi = suiviRows.length ? suiviRows[0] : null;

      const reponseRows = await sql`
        SELECT id, date
        FROM reponse
        WHERE id_dossier_medical = ${dossierId}
        ORDER BY date DESC, id DESC
        LIMIT 1
      `;
      lastReponse = reponseRows.length ? reponseRows[0] : null;
    }

    const dateGreffe = lastSuivi?.date_greffe || dossier?.[0]?.date_creation || null;
    const monthsPostGreffe = dateGreffe
      ? Math.max(0, Math.floor((Date.now() - new Date(dateGreffe).getTime()) / (1000 * 60 * 60 * 24 * 30)))
      : null;

    return res.json({
      success: true,
      patient: {
        id: patient.id,
        prenom: patient.prenom,
        nom: patient.nom,
        email: patient.email,
      },
      info: {
        date_greffe: dateGreffe,
        groupe_sanguin: dossier?.[0]?.groupe_sanguin || null,
        medecin: medecin ? `${medecin.prenom || ''} ${medecin.nom || ''}`.trim() : null,
        medecin_id: medecin?.id || null,
        dernier_bilan: lastReponse?.date || null,
      },
      stats: {
        months_post_greffe: monthsPostGreffe,
        rdv_count: 0,
        questionnaires_en_attente: 0,
        messages_non_lus: 0,
      },
      last_prescription: lastSuivi?.prescription || null,
    });
  } catch (err) {
    console.error('Erreur dashboard patient:', err);
    res.status(500).json({ success: false, error: 'Impossible de charger le tableau de bord.' });
  }
});

// Derniers traitements (table suivi_patient) pour le patient connecté
router.get('/:id/traitements', authenticatePatient, async (req, res) => {
  try {
    const dossier = await supabaseAdmin
      .from('dossier_medical')
      .select('id')
      .eq('id_utilisateur', req.patientId)
      .limit(1)
      .single();

    if (dossier.error || !dossier.data) {
      return res.status(404).json({ success: false, error: 'Dossier introuvable' });
    }

    const { data, error } = await supabaseAdmin
      .from('suivi_patient')
      .select('id, date, prescription')
      .eq('id_dossier_medical', dossier.data.id)
      .order('date', { ascending: false })
      .limit(5);

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.json({ success: true, traitements: data || [] });
  } catch (err) {
    console.error('Erreur récupération traitements patient:', err);
    res.status(500).json({ success: false, error: 'Impossible de récupérer les traitements.' });
  }
});

router.post('/:id/questionnaires', async (req, res) => {
  const patientId = req.params.id;
  const {
    completed_at,
    answers,
    age,
    height_cm,
    weight_kg,
    phone,
    secu_number,
    address,
    metadata,
  } = req.body;

  try {
    const { data, error } = await supabaseAdmin.from('patient_questionnaires').insert({
      patient_id: patientId,
      completed_at: completed_at || new Date().toISOString(),
      answers,
      age,
      height_cm,
      weight_kg,
      phone,
      secu_number,
      address,
      metadata,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true, entry: data[0] });
  } catch (err) {
    res.status(500).json({ error: 'Impossible d’enregistrer le questionnaire.' });
  }
});

router.get('/:id/questionnaires', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('patient_questionnaires')
      .select('*')
      .eq('patient_id', req.params.id)
      .order('completed_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true, questionnaires: data });
  } catch (err) {
    res.status(500).json({ error: 'Impossible de récupérer les questionnaires.' });
  }
});

module.exports = router;
