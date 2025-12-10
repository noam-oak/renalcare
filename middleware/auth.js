const { supabase } = require('../services/supabaseClient');

// Middleware pour vérifier le token JWT
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token manquant' });
    }

    const token = authHeader.substring(7);

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ error: 'Token invalide ou expiré' });
    }

    req.user = data.user;
    next();
  } catch (err) {
    console.error('Erreur vérification token', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// Middleware pour vérifier le rôle de l'utilisateur
const verifyRole = (allowedRoles) => async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const userRole = req.user.user_metadata?.role;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    next();
  } catch (err) {
    console.error('Erreur vérification rôle', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

module.exports = {
  verifyToken,
  verifyRole,
};
