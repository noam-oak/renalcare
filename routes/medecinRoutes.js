const express = require('express');
const router = express.Router();
const sql = require('../db');

// Middleware pour vérifier le token et extraire l'ID du médecin
const authenticateMedecin = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Token manquant' });
        }

        const token = authHeader.substring(7);

        // Décoder le token (pour simplifier, on suppose que le token contient l'ID utilisateur)
        // Dans une vraie application, utilisez jsonwebtoken pour décoder et vérifier
        const userId = parseInt(token);

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Token invalide' });
        }

        // Récupérer les infos du médecin depuis la table utilisateur
        const medecins = await sql`
            SELECT * FROM utilisateur 
            WHERE id = ${userId} AND LOWER(role) = 'medecin'
        `;

        if (!medecins || medecins.length === 0) {
            return res.status(403).json({ success: false, message: 'Accès refusé - Médecin non trouvé' });
        }

        req.userId = userId;
        req.medecin = medecins[0];
        next();
    } catch (error) {
        console.error('Erreur authentification:', error);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
};

// GET patients non affectés
router.get('/patients-non-affectes', authenticateMedecin, async (req, res) => {
    try {
        // Récupérer tous les patients qui n'ont pas de id_utilisateur_medecin
        const patients = await sql`
            SELECT id, prenom, nom, email, date_naissance, telephone, adresse_postale
            FROM utilisateur 
            WHERE role = 'Patient' 
            AND (id_utilisateur_medecin IS NULL OR id_utilisateur_medecin = 0)
            ORDER BY id DESC
        `;

        res.json({ success: true, patients: patients || [] });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// POST affecter un patient au médecin
router.post('/affecter-patient', authenticateMedecin, async (req, res) => {
    try {
        const { patient_id } = req.body;

        if (!patient_id) {
            return res.status(400).json({ success: false, message: 'ID patient manquant' });
        }

        // Vérifier que le patient existe et n'est pas déjà affecté
        const patients = await sql`
            SELECT id, prenom, nom, id_utilisateur_medecin
            FROM utilisateur 
            WHERE id = ${patient_id} AND role = 'Patient'
        `;

        if (!patients || patients.length === 0) {
            return res.status(404).json({ success: false, message: 'Patient non trouvé' });
        }

        const patient = patients[0];

        if (patient.id_utilisateur_medecin && patient.id_utilisateur_medecin !== 0) {
            return res.status(400).json({ success: false, message: 'Ce patient est déjà affecté à un médecin' });
        }

        // Affecter le patient au médecin
        const updatedPatients = await sql`
            UPDATE utilisateur 
            SET id_utilisateur_medecin = ${req.userId}
            WHERE id = ${patient_id}
            RETURNING id, prenom, nom, email
        `;

        if (!updatedPatients || updatedPatients.length === 0) {
            return res.status(500).json({ success: false, message: 'Erreur lors de l\'affectation' });
        }

        res.json({
            success: true,
            message: `Patient ${patient.prenom} ${patient.nom} affecté avec succès`,
            patient: updatedPatients[0]
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// GET médecin info
router.get('/me', (req, res) => res.json({ success: true, data: { name: 'Médecin Test' } }));

// GET mes patients (patients affectés au médecin connecté)
router.get('/mes-patients', authenticateMedecin, async (req, res) => {
    try {
        // Récupérer tous les patients affectés à ce médecin
        const patients = await sql`
            SELECT id, prenom, nom, email, date_naissance, telephone, adresse_postale
            FROM utilisateur 
            WHERE role = 'Patient' 
            AND id_utilisateur_medecin = ${req.userId}
            ORDER BY nom ASC, prenom ASC
        `;

        res.json({ success: true, patients: patients || [] });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// GET patients d'un médecin spécifique (sécurisé : uniquement pour le médecin connecté)
router.get('/patients', authenticateMedecin, async (req, res) => {
    try {
        const requestedId = req.query.medecinId ? parseInt(req.query.medecinId, 10) : req.userId;

        if (!requestedId || Number.isNaN(requestedId)) {
            return res.status(400).json({ success: false, message: 'ID médecin invalide' });
        }

        // Sécurité : un médecin ne peut voir que ses propres patients
        if (requestedId !== req.userId) {
            return res.status(403).json({ success: false, message: 'Accès refusé' });
        }

        const patients = await sql`
            SELECT id, prenom, nom, email, date_naissance, telephone, adresse_postale
            FROM utilisateur
            WHERE role = 'Patient'
            AND id_utilisateur_medecin = ${requestedId}
            ORDER BY nom ASC, prenom ASC
        `;

        res.json({ success: true, patients: patients || [] });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// Dernières réponses (constantes) pour un patient affecté au médecin connecté
router.get('/patients/:patientId/reponses', authenticateMedecin, async (req, res) => {
    try {
        const patientId = Number(req.params.patientId);
        if (!patientId || Number.isNaN(patientId)) {
            return res.status(400).json({ success: false, message: 'ID patient invalide' });
        }

        // Vérifier que le patient est bien affecté à ce médecin et récupérer le dossier
        const dossier = await sql`
            SELECT d.id
            FROM dossier_medical d
            JOIN utilisateur u ON u.id = d.id_utilisateur
            WHERE u.id = ${patientId} AND u.id_utilisateur_medecin = ${req.userId}
            LIMIT 1
        `;

        if (!dossier.length) {
            return res.status(404).json({ success: false, message: 'Dossier introuvable pour ce médecin' });
        }

        // Récupérer les deux dernières réponses (J et J-1)
        const responses = await sql`
            SELECT id, date, poids, creatinine, tension_systolique, tension_diastolique, temperature
            FROM reponse
            WHERE id_dossier_medical = ${dossier[0].id}
            ORDER BY date DESC, id DESC
            LIMIT 2
        `;

        return res.json({ success: true, responses });
    } catch (error) {
        console.error('Erreur lors de la récupération des réponses patient:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// Dernières prescriptions / traitements (table suivi_patient) pour un patient affecté au médecin connecté
router.get('/patients/:patientId/traitements', authenticateMedecin, async (req, res) => {
    try {
        const patientId = Number(req.params.patientId);
        if (!patientId || Number.isNaN(patientId)) {
            return res.status(400).json({ success: false, message: 'ID patient invalide' });
        }

        const dossier = await sql`
            SELECT d.id
            FROM dossier_medical d
            JOIN utilisateur u ON u.id = d.id_utilisateur
            WHERE u.id = ${patientId} AND u.id_utilisateur_medecin = ${req.userId}
            LIMIT 1
        `;

        if (!dossier.length) {
            return res.status(404).json({ success: false, message: 'Dossier introuvable pour ce médecin' });
        }

        const traitements = await sql`
            SELECT id, date, prescription
            FROM suivi_patient
            WHERE id_dossier_medical = ${dossier[0].id}
            ORDER BY date DESC, id DESC
            LIMIT 5
        `;

        return res.json({ success: true, traitements });
    } catch (error) {
        console.error('Erreur lors de la récupération des traitements patient:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// Création d'une ordonnance/traitement pour un patient affecté au médecin connecté
router.post('/patients/:patientId/traitements', authenticateMedecin, async (req, res) => {
    try {
        const patientId = Number(req.params.patientId);
        const { prescription, notes, duree } = req.body || {};

        if (!patientId || Number.isNaN(patientId)) {
            return res.status(400).json({ success: false, message: 'ID patient invalide' });
        }

        if (!prescription || !prescription.trim()) {
            return res.status(400).json({ success: false, message: 'Prescription requise' });
        }

        // Vérifier que le patient est bien affecté à ce médecin et récupérer le dossier
        const dossier = await sql`
            SELECT d.id
            FROM dossier_medical d
            JOIN utilisateur u ON u.id = d.id_utilisateur
            WHERE u.id = ${patientId} AND u.id_utilisateur_medecin = ${req.userId}
            LIMIT 1
        `;

        if (!dossier.length) {
            return res.status(404).json({ success: false, message: 'Dossier introuvable pour ce médecin' });
        }

        const noteBlock = notes ? `\nNotes: ${notes}` : '';
        const dureeBlock = duree ? `\nDurée: ${duree}` : '';
        const fullPrescription = `${prescription}${dureeBlock}${noteBlock}`.trim();

        const inserted = await sql`
            INSERT INTO suivi_patient (
                date,
                prescription,
                id_dossier_medical,
                suivi_traitement
            ) VALUES (
                NOW(),
                ${fullPrescription},
                ${dossier[0].id},
                false
            )
            RETURNING id, date, prescription
        `;

        return res.status(201).json({ success: true, traitement: inserted[0] });
    } catch (error) {
        console.error('Erreur lors de la création de l\'ordonnance:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// GET all appointments for doctor's patients
router.get('/appointments', authenticateMedecin, async (req, res) => {
    try {
        // Get all patients assigned to this doctor
        const patients = await sql`
            SELECT id FROM utilisateur
            WHERE role = 'Patient'
            AND id_utilisateur_medecin = ${req.userId}
        `;

        if (!patients.length) {
            return res.json({ success: true, appointments: [] });
        }

        const patientIds = patients.map(p => p.id);

        // Get all appointments for these patients
        const appointments = await sql`
            SELECT 
                r.id,
                r.date,
                r.statut,
                r.id_dossier_medical,
                u.id as patient_id,
                u.prenom as patient_prenom,
                u.nom as patient_nom,
                u.email as patient_email
            FROM rdv r
            JOIN dossier_medical d ON r.id_dossier_medical = d.id
            JOIN utilisateur u ON d.id_utilisateur = u.id
            WHERE u.id = ANY(${patientIds})
            ORDER BY r.date DESC
        `;

        res.json({ success: true, appointments });
    } catch (error) {
        console.error('Erreur chargement rendez-vous:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// GET single appointment for doctor
router.get('/appointments/:appointmentId', authenticateMedecin, async (req, res) => {
    try {
        const appointmentId = req.params.appointmentId;

        // Get appointment and verify it belongs to one of doctor's patients
        const appointment = await sql`
            SELECT 
                r.id,
                r.date,
                r.statut,
                r.id_dossier_medical,
                u.id as patient_id,
                u.prenom as patient_prenom,
                u.nom as patient_nom,
                u.email as patient_email,
                u.telephone as patient_telephone
            FROM rdv r
            JOIN dossier_medical d ON r.id_dossier_medical = d.id
            JOIN utilisateur u ON d.id_utilisateur = u.id
            WHERE r.id = ${appointmentId}
            AND u.id_utilisateur_medecin = ${req.userId}
        `;

        if (!appointment.length) {
            return res.status(404).json({ success: false, message: 'Rendez-vous non trouvé' });
        }

        res.json({ success: true, appointment: appointment[0] });
    } catch (error) {
        console.error('Erreur chargement rendez-vous:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// GET appointments for a specific patient (doctor's patient only)
router.get('/patients/:patientId/appointments', authenticateMedecin, async (req, res) => {
    try {
        const patientId = req.params.patientId;

        // Verify patient is assigned to this doctor
        const patient = await sql`
            SELECT id FROM utilisateur
            WHERE id = ${patientId}
            AND role = 'Patient'
            AND id_utilisateur_medecin = ${req.userId}
        `;

        if (!patient.length) {
            return res.status(403).json({ success: false, message: 'Accès refusé - Patient non assigné à ce médecin' });
        }

        // Get appointments for this patient
        const appointments = await sql`
            SELECT 
                r.id,
                r.date,
                r.statut,
                r.id_dossier_medical
            FROM rdv r
            JOIN dossier_medical d ON r.id_dossier_medical = d.id
            WHERE d.id_utilisateur = ${patientId}
            ORDER BY r.date DESC
        `;

        res.json({ success: true, appointments });
    } catch (error) {
        console.error('Erreur chargement rendez-vous patient:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// PUT update appointment status (Confirmé, Annulé)
router.put('/appointments/:appointmentId', authenticateMedecin, async (req, res) => {
    try {
        const appointmentId = req.params.appointmentId;
        const { statut } = req.body;

        if (!statut || !['En attente', 'Confirmé', 'Annulé'].includes(statut)) {
            return res.status(400).json({ success: false, message: 'Statut invalide' });
        }

        // Verify appointment belongs to one of doctor's patients
        const appointment = await sql`
            SELECT r.id
            FROM rdv r
            JOIN dossier_medical d ON r.id_dossier_medical = d.id
            JOIN utilisateur u ON d.id_utilisateur = u.id
            WHERE r.id = ${appointmentId}
            AND u.id_utilisateur_medecin = ${req.userId}
        `;

        if (!appointment.length) {
            return res.status(403).json({ success: false, message: 'Accès refusé' });
        }

        // Update appointment status
        const updated = await sql`
            UPDATE rdv
            SET statut = ${statut}
            WHERE id = ${appointmentId}
            RETURNING id, date, statut
        `;

        res.json({
            success: true,
            message: `Rendez-vous mis à jour avec succès - Statut: ${statut}`,
            appointment: updated[0]
        });
    } catch (error) {
        console.error('Erreur mise à jour rendez-vous:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

// GET stats, patients
router.get('/:id/stats', (req, res) => res.json({ success: true, stats: {} }));
router.get('/:id/patients', (req, res) => res.json({ success: true, patients: [] }));

// GET patient suivi, traitements, analyses, alertes
router.get('/patients/:id/suivi', (req, res) => res.json({ success: true, suivi: [] }));
router.get('/patients/:id/traitements', (req, res) => res.json({ success: true, traitements: [] }));
router.get('/patients/:id/analyses', (req, res) => res.json({ success: true, analyses: [] }));
router.get('/patients/:id/alertes', (req, res) => res.json({ success: true, alertes: [] }));

// POST routes
router.post('/activate', (req, res) => {
    console.log(req.body);
    res.json({ success: true, message: 'Médecin activé' });
});

router.post('/suivi/:id/note-medecin', (req, res) => {
    console.log(req.body);
    res.json({ success: true, message: `Note ajoutée pour patient ${req.params.id}` });
});

router.post('/patients/:id/traitements', (req, res) => {
    console.log(req.body);
    res.json({ success: true, message: `Traitement ajouté pour patient ${req.params.id}` });
});

// Alertes critiques liées aux questionnaires
router.get('/alerts', authenticateMedecin, async (req, res) => {
    try {
        const alerts = await sql`
            SELECT id, date, message
            FROM messagerie
            WHERE id_utilisateur = ${req.userId}
            AND message ILIKE 'ALERTE%'
            ORDER BY date DESC, id DESC
            LIMIT 20
        `;

        res.json({ success: true, alerts });
    } catch (error) {
        console.error('Erreur chargement alertes médecin:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

module.exports = router;
