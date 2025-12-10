const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const crypto = require('crypto');

// Fonction pour hasher le mot de passe
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// LOGIN PATIENT
router.post('/patient/login', async (req, res) => {
    try {
        const { email, password, numSecu } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email et mot de passe requis' });
        }

        const query = `SELECT * FROM patients WHERE email = $1 AND num_secu = $2 LIMIT 1`;
        const result = await pool.query(query, [email, numSecu]);

        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Identifiants incorrects' });
        }

        const patient = result.rows[0];
        const hashedPassword = hashPassword(password);

        if (patient.password_hash !== hashedPassword) {
            return res.status(401).json({ success: false, message: 'Identifiants incorrects' });
        }

        res.json({
            success: true,
            message: 'Connexion réussie',
            patient: {
                id: patient.id,
                email: patient.email,
                nom: patient.nom,
                prenom: patient.prenom,
            }
        });
    } catch (error) {
        console.error('Erreur login patient:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// LOGOUT
router.post('/logout', (req, res) => {
    res.json({ success: true, message: 'Déconnexion réussie' });
});

module.exports = router;
