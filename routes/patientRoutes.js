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

// Récupérer ou créer un dossier médical pour le patient connecté
router.get('/:id/dossier-id', authenticatePatient, async (req, res) => {
  try {
    const result = await resolveDossierForPatient(req.patientId, null);
    if (!result.dossierId) {
      return res.status(404).json({ success: false, error: 'Dossier introuvable' });
    }
    return res.json({ success: true, dossier_id: result.dossierId, created: result.created });
  } catch (err) {
    console.error('Erreur récupération dossier_id patient:', err);
    return res.status(500).json({ success: false, error: err.message || 'Impossible de récupérer le dossier' });
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

// Derniers résultats (réponses) du patient
router.get('/:id/resultats', authenticatePatient, async (req, res) => {
  try {
    const dossier = await sql`
      SELECT id
      FROM dossier_medical
      WHERE id_utilisateur = ${req.patientId}
      LIMIT 1
    `;

    if (!dossier.length) {
      return res.status(404).json({ success: false, error: 'Dossier introuvable' });
    }

    const responses = await sql`
      SELECT 
        id,
        date,
        poids,
        creatinine,
        glycemie,
        hemoglobine,
        tension_systolique,
        tension_diastolique,
        frequence_cardiaque,
        temperature,
        tacrolimus_ng,
        everolimus_ng
      FROM reponse
      WHERE id_dossier_medical = ${dossier[0].id}
      ORDER BY date DESC, id DESC
      LIMIT 10
    `;

    return res.json({ success: true, resultats: responses || [] });
  } catch (err) {
    console.error('Erreur récupération résultats patient:', err);
    res.status(500).json({ success: false, error: 'Impossible de récupérer les résultats.' });
  }
});

// Détail d'une réponse précise (vérifiée pour le patient courant)
router.get('/:id/reponses/:reponseId', authenticatePatient, async (req, res) => {
  try {
    const dossier = await sql`
      SELECT id
      FROM dossier_medical
      WHERE id_utilisateur = ${req.patientId}
      LIMIT 1
    `;

    if (!dossier.length) {
      return res.status(404).json({ success: false, error: 'Dossier introuvable' });
    }

    const row = await sql`
      SELECT *
      FROM reponse
      WHERE id = ${req.params.reponseId} AND id_dossier_medical = ${dossier[0].id}
      LIMIT 1
    `;

    if (!row.length) {
      return res.status(404).json({ success: false, error: 'Réponse introuvable' });
    }

    return res.json({ success: true, reponse: row[0] });
  } catch (err) {
    console.error('Erreur récupération réponse détaillée:', err);
    res.status(500).json({ success: false, error: 'Impossible de récupérer la réponse.' });
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

// Enregistrer les reponses du questionnaire dans la table reponse
router.post('/:id/reponses', async (req, res) => {
  const patientId = req.params.id;
  const requestedDossierId = req.body.id_dossier_medical;
  const {
    date_questionnaire,
    poids,
    envie_uriner,
    frequence,
    frequence_urinaire,
    douleur_miction,
    douleur_greffon,
    maux_ventre,
    diarrhee,
    intensite_diarrhee,
    frissonnement,
    creatinine,
    tension_systolique,
    tension_diastolique,
    frequence_cardiaque,
    temperature,
    glycemie,
    hemoglobine,
    cholesterol,
    tacrolimus_ng,
    everolimus_ng,
  } = req.body;

  if (!date_questionnaire) {
    return res
      .status(400)
      .json({ success: false, error: 'date_questionnaire est requis.' });
  }

  let dossierId;
  let dossierCreated = false;
  try {
    const dossierResolution = await resolveDossierForPatient(patientId, requestedDossierId);
    dossierId = dossierResolution.dossierId;
    dossierCreated = dossierResolution.created;
  } catch (resolveError) {
    return res.status(400).json({ success: false, error: resolveError.message });
  }

  if (!dossierId) {
    return res.status(400).json({
      success: false,
      error:
        'Aucun dossier medical trouve pour ce patient. Merci de fournir id_dossier_medical ou de creer un dossier.',
    });
  }

  try {
    const inserted = await sql`
      INSERT INTO reponse (
        date,
        id_dossier_medical,
        poids,
        envie_uriner,
        frequence,
        frequence_urinaire,
        douleur_miction,
        douleur_greffon,
        maux_ventre,
        diarrhee,
        intensite_diarrhee,
        frissonnement,
        creatinine,
        tension_systolique,
        tension_diastolique,
        frequence_cardiaque,
        temperature,
        glycemie,
        hemoglobine,
        cholesterol,
        tacrolimus_ng,
        everolimus_ng
      )
      VALUES (
        ${date_questionnaire},
        ${dossierId},
        ${poids ?? null},
        ${envie_uriner != null ? envie_uriner.toString() : null},
        ${frequence ?? null},
        ${frequence_urinaire != null ? frequence_urinaire.toString() : null},
        ${douleur_miction != null ? douleur_miction.toString() : null},
        ${douleur_greffon != null ? douleur_greffon.toString() : null},
        ${maux_ventre != null ? maux_ventre.toString() : null},
        ${diarrhee === undefined ? false : !!diarrhee},
        ${diarrhee ? (intensite_diarrhee != null ? intensite_diarrhee.toString() : null) : null},
        ${frissonnement ?? null},
        ${creatinine ?? null},
        ${tension_systolique ?? null},
        ${tension_diastolique ?? null},
        ${frequence_cardiaque ?? null},
        ${temperature ?? null},
        ${glycemie ?? null},
        ${hemoglobine ?? null},
        ${cholesterol ?? null},
        ${tacrolimus_ng ?? null},
        ${everolimus_ng ?? null}
      )
      RETURNING *
    `;

    return res.json({
      success: true,
      reponse: inserted[0],
      dossier_id: dossierId,
      dossier_created: dossierCreated,
    });
  } catch (err) {
    console.error("Erreur lors de l'enregistrement du questionnaire:", err);
    return res
      .status(500)
      .json({ success: false, error: "Impossible d'enregistrer la reponse", details: err.message });
  }
});

async function resolveDossierForPatient(patientId, requestedDossierId) {
  // 1) Si un id est fourni et existe, on l'utilise
  if (requestedDossierId) {
    const existing = await sql`select id from dossier_medical where id = ${requestedDossierId} limit 1`;
    if (existing.length > 0) {
      return { dossierId: existing[0].id, created: false };
    }
  }

  // 2) Vérifier la présence de colonnes usuelles pour lier le dossier au patient
  const columns = await sql`
    select column_name
    from information_schema.columns
    where table_name = 'dossier_medical'
  `;
  const hasCol = (name) => columns.some((c) => c.column_name === name);

  if (hasCol('id_utilisateur')) {
    const found = await sql`select id from dossier_medical where id_utilisateur = ${patientId} limit 1`;
    if (found.length > 0) {
      return { dossierId: found[0].id, created: false };
    }
  }

  if (hasCol('id_patient')) {
    const found = await sql`select id from dossier_medical where id_patient = ${patientId} limit 1`;
    if (found.length > 0) {
      return { dossierId: found[0].id, created: false };
    }
  }

  if (hasCol('patient_id')) {
    const found = await sql`select id from dossier_medical where patient_id = ${patientId} limit 1`;
    if (found.length > 0) {
      return { dossierId: found[0].id, created: false };
    }
  }

  if (hasCol('utilisateur_id')) {
    const found = await sql`select id from dossier_medical where utilisateur_id = ${patientId} limit 1`;
    if (found.length > 0) {
      return { dossierId: found[0].id, created: false };
    }
  }

  // 3) En dernier recours, tenter de créer un dossier minimal
  try {
    let createdRow;
    const today = new Date().toISOString().split('T')[0];
    const hasDateCreation = hasCol('date_creation');

    if (hasCol('id_utilisateur')) {
      createdRow = hasDateCreation
        ? await sql`
            insert into dossier_medical (id_utilisateur, date_creation)
            values (${patientId}, ${today})
            returning id
          `
        : await sql`
            insert into dossier_medical (id_utilisateur)
            values (${patientId})
            returning id
          `;
    } else if (hasCol('id_patient')) {
      createdRow = hasDateCreation
        ? await sql`
            insert into dossier_medical (id_patient, date_creation)
            values (${patientId}, ${today})
            returning id
          `
        : await sql`
            insert into dossier_medical (id_patient)
            values (${patientId})
            returning id
          `;
    } else if (hasCol('patient_id')) {
      createdRow = hasDateCreation
        ? await sql`
            insert into dossier_medical (patient_id, date_creation)
            values (${patientId}, ${today})
            returning id
          `
        : await sql`
            insert into dossier_medical (patient_id)
            values (${patientId})
            returning id
          `;
    } else if (hasCol('utilisateur_id')) {
      createdRow = hasDateCreation
        ? await sql`
            insert into dossier_medical (utilisateur_id, date_creation)
            values (${patientId}, ${today})
            returning id
          `
        : await sql`
            insert into dossier_medical (utilisateur_id)
            values (${patientId})
            returning id
          `;
    } else {
      createdRow = hasDateCreation
        ? await sql`
            insert into dossier_medical (date_creation)
            values (${today})
            returning id
          `
        : await sql`insert into dossier_medical default values returning id`;
    }

    return { dossierId: createdRow?.[0]?.id || null, created: true };
  } catch (err) {
    console.error('Creation de dossier_medical impossible:', err);
    throw new Error(
      "Aucun dossier medical trouve pour ce patient et creation impossible. Fournissez id_dossier_medical explicite."
    );
  }
}


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
