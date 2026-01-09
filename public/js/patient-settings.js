// patient-settings.js - Page paramètres patient

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  initPreferences();
});

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value || 'Non renseigné';
  }
}

function formatDate(value) {
  if (!value) return 'Non renseignée';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Non renseignée';
  return date.toLocaleDateString('fr-FR');
}

async function loadSettings() {
  const statusEl = document.getElementById('settingsStatus');
  const userId = localStorage.getItem('user_id');
  const token = localStorage.getItem('auth_token');

  if (!userId) {
    if (statusEl) statusEl.textContent = 'Utilisateur non connecté';
    return;
  }

  try {
    const [dashboardRes, profileRes] = await Promise.all([
      fetch(`/api/patients/${userId}/dashboard`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }),
      fetch(`/api/patients/${userId}/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }),
    ]);

    const dashboardData = dashboardRes.ok ? await dashboardRes.json() : null;
    const profileData = profileRes.ok ? await profileRes.json() : null;

    if (!dashboardData?.success) {
      throw new Error('Impossible de charger le tableau de bord');
    }

    const patient = dashboardData.patient || {};
    const info = dashboardData.info || {};

    setText('personalName', `${patient.prenom || ''} ${patient.nom || ''}`.trim() || 'Non renseigné');
    setText('personalEmail', patient.email || 'Non renseigné');
    setText('personalRole', 'Patient');
    setText('personalId', patient.id || '-');

    setText('doctorName', info.medecin ? `Dr. ${info.medecin}` : 'Aucun médecin assigné');
    setText('doctorEmail', info.medecin_email || '-');
    setText('lastBilan', formatDate(info.dernier_bilan));

    setText('bloodGroup', info.groupe_sanguin || 'Non renseigné');
    setText('greffeDate', formatDate(info.date_greffe));
    setText('dossierId', dashboardData.dossier_id || 'Non disponible');

    if (profileData?.success && profileData.profile) {
      const profile = profileData.profile;
      setText('birthDate', formatDate(profile.date_naissance));
      setText('phone', profile.telephone || 'Non renseigné');
      setText('address', profile.adresse || 'Non renseignée');
      setText('secu', profile.numero_securite_sociale || 'Non renseignée');
    }

    if (statusEl) statusEl.textContent = 'Synchronisé';
  } catch (error) {
    console.error('Erreur chargement paramètres:', error);
    if (statusEl) statusEl.textContent = 'Erreur de chargement';
  }
}

function initPreferences() {
  const prefsKey = 'patient_settings_prefs';
  const defaults = { alerts: true, email: true, sms: false };
  let prefs = defaults;

  try {
    const saved = localStorage.getItem(prefsKey);
    if (saved) {
      prefs = { ...defaults, ...JSON.parse(saved) };
    }
  } catch (e) {
    prefs = defaults;
  }

  const alerts = document.getElementById('prefAlerts');
  const email = document.getElementById('prefEmail');
  const sms = document.getElementById('prefSms');

  if (alerts) alerts.checked = !!prefs.alerts;
  if (email) email.checked = !!prefs.email;
  if (sms) sms.checked = !!prefs.sms;

  const savePrefs = () => {
    const next = {
      alerts: alerts ? alerts.checked : defaults.alerts,
      email: email ? email.checked : defaults.email,
      sms: sms ? sms.checked : defaults.sms,
    };
    localStorage.setItem(prefsKey, JSON.stringify(next));
  };

  [alerts, email, sms].forEach((el) => {
    if (el) {
      el.addEventListener('change', savePrefs);
    }
  });
}
