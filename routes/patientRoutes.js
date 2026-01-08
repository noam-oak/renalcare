const express = require('express');
const { supabaseAdmin } = require('../services/supabaseClient');
const sql = require('../db');

const router = express.Router();

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

// Get all appointments for logged-in patient
router.get('/appointments/all', async (req, res) => {
  try {
    const userId = req.user?.id || req.query.user_id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Utilisateur non identifié' });
    }

    // Get patient's dossier_medical
    const dossierResult = await sql`
      SELECT id FROM dossier_medical WHERE id_utilisateur = ${userId}
    `;

    if (dossierResult.length === 0) {
      return res.json({ success: true, appointments: [], upcoming: [], past: [] });
    }

    const dossierId = dossierResult[0].id;

    // Get all appointments with doctor info
    const appointments = await sql`
      SELECT 
        r.id,
        r.date,
        r.statut,
        u.prenom,
        u.nom,
        u.email
      FROM rdv r
      JOIN utilisateur u ON r.id_utilisateur_medecin = u.id
      WHERE r.id_dossier_medical = ${dossierId}
      ORDER BY r.date DESC
    `;

    // Separate upcoming and past appointments
    const now = new Date();
    const upcoming = appointments.filter(apt => new Date(apt.date) > now);
    const past = appointments.filter(apt => new Date(apt.date) <= now);

    res.json({
      success: true,
      appointments,
      upcoming,
      past
    });
  } catch (err) {
    console.error('Erreur chargement rendez-vous:', err);
    res.status(500).json({ success: false, error: 'Erreur lors du chargement des rendez-vous' });
  }
});

// Get upcoming appointments
router.get('/appointments/upcoming', async (req, res) => {
  try {
    const userId = req.user?.id || req.query.user_id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Utilisateur non identifié' });
    }

    // Get patient's dossier_medical
    const dossierResult = await sql`
      SELECT id FROM dossier_medical WHERE id_utilisateur = ${userId}
    `;

    if (dossierResult.length === 0) {
      return res.json({ success: true, appointments: [] });
    }

    const dossierId = dossierResult[0].id;
    const now = new Date();

    // Get upcoming appointments
    const appointments = await sql`
      SELECT 
        r.id,
        r.date,
        r.statut,
        u.prenom,
        u.nom,
        u.email
      FROM rdv r
      JOIN utilisateur u ON r.id_utilisateur_medecin = u.id
      WHERE r.id_dossier_medical = ${dossierId}
      AND r.date > NOW()
      ORDER BY r.date ASC
    `;

    res.json({
      success: true,
      appointments
    });
  } catch (err) {
    console.error('Erreur chargement rendez-vous à venir:', err);
    res.status(500).json({ success: false, error: 'Erreur lors du chargement des rendez-vous' });
  }
});

// Get past appointments
router.get('/appointments/past', async (req, res) => {
  try {
    const userId = req.user?.id || req.query.user_id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Utilisateur non identifié' });
    }

    // Get patient's dossier_medical
    const dossierResult = await sql`
      SELECT id FROM dossier_medical WHERE id_utilisateur = ${userId}
    `;

    if (dossierResult.length === 0) {
      return res.json({ success: true, appointments: [] });
    }

    const dossierId = dossierResult[0].id;

    // Get past appointments
    const appointments = await sql`
      SELECT 
        r.id,
        r.date,
        r.statut,
        u.prenom,
        u.nom,
        u.email
      FROM rdv r
      JOIN utilisateur u ON r.id_utilisateur_medecin = u.id
      WHERE r.id_dossier_medical = ${dossierId}
      AND r.date <= NOW()
      ORDER BY r.date DESC
    `;

    res.json({
      success: true,
      appointments
    });
  } catch (err) {
    console.error('Erreur chargement rendez-vous passés:', err);
    res.status(500).json({ success: false, error: 'Erreur lors du chargement des rendez-vous' });
  }
});

// Get single appointment by ID
router.get('/appointments/:id', async (req, res) => {
  try {
    const userId = req.user?.id || req.query.user_id;
    const appointmentId = req.params.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Utilisateur non identifié' });
    }

    // Get patient's dossier_medical
    const dossierResult = await sql`
      SELECT id FROM dossier_medical WHERE id_utilisateur = ${userId}
    `;

    if (dossierResult.length === 0) {
      return res.status(404).json({ success: false, error: 'Dossier médical non trouvé' });
    }

    const dossierId = dossierResult[0].id;

    // Get appointment details
    const appointment = await sql`
      SELECT 
        r.id,
        r.date,
        r.statut,
        r.id_utilisateur_medecin,
        u.prenom,
        u.nom,
        u.email
      FROM rdv r
      JOIN utilisateur u ON r.id_utilisateur_medecin = u.id
      WHERE r.id = ${appointmentId}
      AND r.id_dossier_medical = ${dossierId}
    `;

    if (appointment.length === 0) {
      return res.status(404).json({ success: false, error: 'Rendez-vous non trouvé' });
    }

    res.json({
      success: true,
      appointment: appointment[0]
    });
  } catch (err) {
    console.error('Erreur chargement rendez-vous:', err);
    res.status(500).json({ success: false, error: 'Erreur lors du chargement du rendez-vous' });
  }
});

// Get all available doctors
router.get('/doctors/list', async (req, res) => {
  try {
    const doctors = await sql`
      SELECT id, prenom, nom, email 
      FROM utilisateur 
      WHERE role = 'Medecin'
      ORDER BY nom ASC
    `;

    console.log('Doctors retrieved:', doctors);
    res.json({
      success: true,
      doctors: doctors || []
    });
  } catch (err) {
    console.error('Erreur chargement médecins:', err);
    res.status(500).json({ success: false, error: 'Erreur lors du chargement des médecins', details: err.message });
  }
});

// Create new appointment
router.post('/appointments/create', async (req, res) => {
  try {
    const userId = req.user?.id || req.body.user_id;
    const { date, id_utilisateur_medecin, statut } = req.body;

    if (!userId || !date || !id_utilisateur_medecin) {
      return res.status(400).json({ success: false, error: 'Données manquantes' });
    }

    // Get patient's dossier_medical
    const dossierResult = await sql`
      SELECT id FROM dossier_medical WHERE id_utilisateur = ${userId}
    `;

    if (dossierResult.length === 0) {
      return res.status(404).json({ success: false, error: 'Dossier médical non trouvé' });
    }

    const dossierId = dossierResult[0].id;

    // Convert datetime-local to UTC timestamp
    // datetime-local format: "2025-01-15T09:00" is interpreted by JS as UTC time
    // To get the actual local time, we need to subtract the timezone offset
    const appointmentDate = new Date(date);
    const utcDate = new Date(appointmentDate.getTime() - appointmentDate.getTimezoneOffset() * 60000);

    // Create the appointment
    const result = await sql`
      INSERT INTO rdv (date, statut, id_dossier_medical, id_utilisateur_medecin)
      VALUES (${utcDate.toISOString()}, ${statut || 'En attente'}, ${dossierId}, ${id_utilisateur_medecin})
      RETURNING id, date, statut
    `;

    res.json({
      success: true,
      message: 'Rendez-vous créé avec succès',
      appointment: result[0]
    });
  } catch (err) {
    console.error('Erreur création rendez-vous:', err);
    res.status(500).json({ success: false, error: 'Erreur lors de la création du rendez-vous' });
  }
});

// Update appointment
router.put('/appointments/:id', async (req, res) => {
  try {
    const userId = req.user?.id || req.body.user_id;
    const appointmentId = req.params.id;
    const { date, statut } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Utilisateur non identifié' });
    }

    // Verify the appointment belongs to the user
    const dossierResult = await sql`
      SELECT id FROM dossier_medical WHERE id_utilisateur = ${userId}
    `;

    if (dossierResult.length === 0) {
      return res.status(404).json({ success: false, error: 'Dossier médical non trouvé' });
    }

    const dossierId = dossierResult[0].id;

    // Verify the appointment exists and belongs to this patient
    const appointmentCheck = await sql`
      SELECT id FROM rdv WHERE id = ${appointmentId} AND id_dossier_medical = ${dossierId}
    `;

    if (appointmentCheck.length === 0) {
      return res.status(404).json({ success: false, error: 'Rendez-vous non trouvé' });
    }

    // Update the appointment
    const updateData = {};
    if (date) {
      const appointmentDate = new Date(date);
      const utcDate = new Date(appointmentDate.getTime() - appointmentDate.getTimezoneOffset() * 60000);
      updateData.date = utcDate.toISOString();
    }
    if (statut) updateData.statut = statut;

    const result = await sql`
      UPDATE rdv 
      SET ${sql(updateData)}
      WHERE id = ${appointmentId}
      RETURNING id, date, statut
    `;

    res.json({
      success: true,
      message: 'Rendez-vous modifié avec succès',
      appointment: result[0]
    });
  } catch (err) {
    console.error('Erreur modification rendez-vous:', err);
    res.status(500).json({ success: false, error: 'Erreur lors de la modification du rendez-vous' });
  }
});

// Cancel/Delete appointment
router.delete('/appointments/:id', async (req, res) => {
  try {
    const userId = req.user?.id || req.query.user_id;
    const appointmentId = req.params.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Utilisateur non identifié' });
    }

    // Get patient's dossier_medical
    const dossierResult = await sql`
      SELECT id FROM dossier_medical WHERE id_utilisateur = ${userId}
    `;

    if (dossierResult.length === 0) {
      return res.status(404).json({ success: false, error: 'Dossier médical non trouvé' });
    }

    const dossierId = dossierResult[0].id;

    // Verify the appointment exists and belongs to this patient
    const appointmentCheck = await sql`
      SELECT id FROM rdv WHERE id = ${appointmentId} AND id_dossier_medical = ${dossierId}
    `;

    if (appointmentCheck.length === 0) {
      return res.status(404).json({ success: false, error: 'Rendez-vous non trouvé' });
    }

    // Delete the appointment
    await sql`
      DELETE FROM rdv WHERE id = ${appointmentId}
    `;

    res.json({
      success: true,
      message: 'Rendez-vous annulé avec succès'
    });
  } catch (err) {
    console.error('Erreur annulation rendez-vous:', err);
    res.status(500).json({ success: false, error: 'Erreur lors de l\'annulation du rendez-vous' });
  }
});

module.exports = router;
