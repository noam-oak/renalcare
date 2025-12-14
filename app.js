// running the server with this command: npm run dev
require('dotenv').config();

const path = require('path');
const express = require('express');
const sql = require('./db');
const app = express();
const port = process.env.PORT || 3000;

// 🔹 Import des routes API AVANT de les utiliser
const patientRoutes = require('./routes/patientRoutes');
const authRoutes = require('./routes/authRoutes_improved');
const adminRoutes = require('./routes/adminRoutes');
const contactRoutes = require('./routes/contactRoutes');
const registrationRoutes = require('./routes/registrationRoutes');
const medecinRoutes = require('./routes/medecinRoutes');


// Dossier public (HTML, CSS, JS statiques)
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes HTML
const htmlRoot = path.join(publicDir, 'html');
const serveHtml = (relativePath) => (req, res) =>
  res.sendFile(path.join(htmlRoot, relativePath));

const htmlRoutes = [
  { paths: ['/'], file: 'index.html' },
  { paths: ['/login'], file: 'login.html' },
  { paths: ['/admin'], file: 'admin/admin-dashboard-complet.html' },
  { paths: ['/admin/login'], file: 'admin/admin-login.html' },
  { paths: ['/medecin/dashboard'], file: 'Medecin/medecin-dashboard-complet.html' },
  { paths: ['/medecin/login'], file: 'Medecin/medecin-login.html' },
  { paths: ['/medecin/register'], file: 'Medecin/medecin-inscription.html' },
  { paths: ['/patient/dashboard'], file: 'Patient/patient-dashboard.html' },
  { paths: ['/patient/login'], file: 'Patient/patient-login.html' },
  { paths: ['/patient/register'], file: 'Patient/patient-inscription.html' },
  {
    paths: ['/contact', '/patient/contact', '/medecin/contact'],
    file: 'contact-infirmier.html',
  },
  {
    paths: ['/medecin/mdp_oubli', '/patient/mdp_oubli'],
    file: 'mot-de-passe-oublie.html',
  },
  { paths: ['/patient/treatment'], file: 'Patient/treatment.html' },
  { paths: ['/patient/document'], file: 'Patient/document.html' },
  { paths: ['/patient/messagerie'], file: 'Patient/messagerie.html' },
  { paths: ['/patient/questionnaire'], file: 'Patient/questionnaire.html' },
  { paths: ['/patient/rendez-vous'], file: 'Patient/rendez-vous.html' },
  { paths: ['/patient/resultat'], file: 'Patient/resultat.html' },
];

htmlRoutes.forEach(({ paths, file }) => {
  paths.forEach((routePath) => app.get(routePath, serveHtml(file)));
});

// 🔹 Routes API
app.use('/api/patients', patientRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/register', registrationRoutes);
app.use('/api/medecin', medecinRoutes);


// Route de test de connexion à la base de données
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await sql`SELECT NOW() as current_time, version() as pg_version`;
    res.json({
      success: true,
      message: 'Connexion à la base de données réussie!',
      data: result[0]
    });
  } catch (error) {
    console.error('Erreur de connexion à la base de données:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur de connexion à la base de données',
      details: error.message
    });
  }
});

// 404 fallback
app.use((req, res) => {
  if (req.accepts('html')) {
    return res.status(404).sendFile(path.join(publicDir, '/html/error404.html'));
  }
  res.status(404).json({ error: 'Not found' });
});

// 🔹 Démarrage du serveur APRÈS la déclaration des routes
app.listen(port, async () => {
  console.log(`Serveur démarré sur http://localhost:${port}`);
  console.log(`DATABASE_URL configurée: ${process.env.DATABASE_URL ? '✅' : '❌'}`);

  // Test de connexion à la base de données au démarrage
  try {
    const result = await sql`SELECT 1 as test, current_database() as db_name`;
    console.log('✅ Connexion à Supabase PostgreSQL établie avec succès!');
    console.log(`   Base de données: ${result[0].db_name}`);
  } catch (error) {
    console.error('❌ Erreur de connexion à Supabase:', error.message);
    console.error('   Vérifiez votre DATABASE_URL dans le fichier .env');
  }
});
