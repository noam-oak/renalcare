// routes/registrationRoutes.js
const express = require('express');
const router = express.Router();
const sql = require('../db');
const bcrypt = require('bcrypt');

const { sendOtpEmail } = require('../services/mailService');

const otpStore = new Map();
// structure : email -> { code, expiresAt, role }

/**
 * POST /api/register/send-code
 * body: { email, role }  // role = 'patient' ou 'medecin'
 */
router.post('/send-code', async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, error: 'Email manquant.' });
    }

    const userRole = role === 'medecin' ? 'medecin' : 'patient';

    // code à 6 chiffres
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 min

    otpStore.set(email, { code, expiresAt, role: userRole });

    console.log(`[REGISTER] OTP ${code} généré pour ${email} (${userRole})`);

    await sendOtpEmail(email, code, userRole);

    return res.json({ success: true });
  } catch (err) {
    console.error('[REGISTER] Erreur send-code :', err);
    return res
      .status(500)
      .json({ success: false, error: "Erreur lors de l'envoi du code." });
  }
});

/**
 * POST /api/register/verify-code
 * body: { email, code }
 */
router.post('/verify-code', (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res
      .status(400)
      .json({ success: false, error: 'Email ou code manquant.' });
  }

  const entry = otpStore.get(email);
  if (!entry) {
    return res
      .status(400)
      .json({ success: false, error: 'Aucun code trouvé pour cet email.' });
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(email);
    return res
      .status(400)
      .json({ success: false, error: 'Code expiré, veuillez en demander un nouveau.' });
  }

  if (entry.code !== code) {
    return res
      .status(400)
      .json({ success: false, error: 'Code incorrect.' });
  }

  // OK : code bon
  console.log(`[REGISTER] OTP validé pour ${email}`);
  return res.json({ success: true, role: entry.role });
});

/**
 * POST /api/register/complete
 * Finalise l'inscription en mettant à jour l'utilisateur pré-créé
 */
router.post('/complete', async (req, res) => {
  const { 
    email, password, nom, prenom, telephone, adresse, role,
    specialite, numero_licence, grade, adresse_hopital,
    securite_sociale, date_greffe, maladie, groupe_sanguin, poids, taille, allergies, genre, date_naissance
  } = req.body;

  // Nettoyage du numéro de sécurité sociale (enlever les espaces)
  const cleanSecu = securite_sociale ? securite_sociale.replace(/\s/g, '') : null;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email et mot de passe requis.' });
  }

  try {
    // 1. Vérifier si l'utilisateur existe (pré-créé par l'admin)
    const existingUsers = await sql`SELECT * FROM utilisateur WHERE email = ${email}`;

    if (existingUsers.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: "Aucun compte pré-enregistré trouvé pour cet email. Veuillez contacter l'administrateur." 
      });
    }

    const user = existingUsers[0];
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Capitaliser le rôle
    const userRole = role ? (role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()) : user.role;

    // Conversion du genre en sexe (0=M, 1=F)
    let sexe = user.sexe;
    if (genre) {
        sexe = (genre === 'M' || genre === 'Masculin') ? 0 : 1;
    }

    // 2. Mettre à jour l'utilisateur
    let updatedUsers;
    
    if (userRole === 'Medecin') {
        // Pour un médecin
        updatedUsers = await sql`
          UPDATE utilisateur 
          SET mdp = ${hashedPassword},
              nom = ${nom || user.nom},
              prenom = ${prenom || user.prenom},
              telephone = ${telephone || user.telephone},
              adresse_postale = ${adresse_hopital || adresse || user.adresse_postale},
              date_naissance = ${date_naissance || user.date_naissance},
              sexe = ${sexe},
              role = 'Medecin'
          WHERE email = ${email}
          RETURNING id, email, role
        `;
    } else {
        // Patient
        updatedUsers = await sql`
          UPDATE utilisateur 
          SET mdp = ${hashedPassword},
              securite_sociale = ${cleanSecu || user.securite_sociale},
              nom = ${nom || user.nom},
              prenom = ${prenom || user.prenom},
              telephone = ${telephone || user.telephone},
              adresse_postale = ${adresse || user.adresse_postale},
              date_naissance = ${date_naissance || user.date_naissance},
              sexe = ${sexe},
              role = 'Patient'
          WHERE email = ${email}
          RETURNING id, email, role
        `;

        if (updatedUsers && updatedUsers.length > 0) {
            const userId = updatedUsers[0].id;
            
            try {
                // Gestion Dossier Médical
                let dossier = await sql`SELECT id FROM dossier_medical WHERE id_utilisateur = ${userId}`;
                
                if (dossier.length === 0) {
                    // Création du dossier médical si inexistant
                    dossier = await sql`
                        INSERT INTO dossier_medical (id_utilisateur, groupe_sanguin, date_creation) 
                        VALUES (${userId}, ${groupe_sanguin || null}, NOW()) 
                        RETURNING id
                    `;
                } else if (groupe_sanguin) {
                    // Mise à jour du groupe sanguin si fourni
                    await sql`UPDATE dossier_medical SET groupe_sanguin = ${groupe_sanguin} WHERE id = ${dossier[0].id}`;
                }
                
                const dossierId = dossier[0].id;

                // Insertion dans suivi_patient
                // Convertir poids et taille en nombres
                const poidsNum = poids ? parseFloat(poids) : null;
                const tailleNum = taille ? parseInt(taille) : null;
                const dateGreffeVal = date_greffe === "" ? null : date_greffe;
                
                await sql`
                    INSERT INTO suivi_patient (
                        date, 
                        poids, 
                        taille, 
                        date_greffe, 
                        allergies, 
                        maladie_renale, 
                        id_dossier_medical,
                        suivi_traitement,
                        prescription
                    ) VALUES (
                        NOW(),
                        ${poidsNum},
                        ${tailleNum},
                        ${dateGreffeVal || null},
                        ${allergies || null},
                        ${maladie || null},
                        ${dossierId},
                        false,
                        NULL
                    )
                `;
            } catch (secondaryErr) {
                console.error('[REGISTER] Erreur secondaire (dossier/suivi) ignorée pour ne pas bloquer l\'inscription:', secondaryErr);
            }
        }
    }

    if (!updatedUsers || updatedUsers.length === 0) {
      throw new Error("Échec de la mise à jour du compte.");
    }

    // Nettoyer le store OTP si nécessaire
    otpStore.delete(email);

    res.json({
      success: true,
      message: 'Inscription finalisée avec succès.',
      user: updatedUsers[0]
    });

  } catch (err) {
    console.error('[REGISTER] Erreur complete :', err);
    res.status(500).json({ success: false, error: "Erreur lors de la finalisation de l'inscription: " + err.message });
  }
});

module.exports = router;
