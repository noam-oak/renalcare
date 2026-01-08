const express = require('express');
const router = express.Router();
const sql = require('../db');
const bcrypt = require('bcrypt');

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

module.exports = router;
