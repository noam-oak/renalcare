const postgres = require('postgres');

const connectionString = process.env.DATABASE_URL;

// Configuration avec options pour résoudre les problèmes de connexion
const sql = postgres(connectionString, {
  ssl: 'require',
  connect_timeout: 10,
  idle_timeout: 20,
  max_lifetime: 60 * 30,
  max: 10,
  onnotice: () => {}, // Supprime les warnings PostgreSQL
  // Force l'utilisation de la famille d'adresses IPv6
  connection: {
    application_name: 'renalcare_app'
  }
});

module.exports = sql;
