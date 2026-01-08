// Charger les informations de l'utilisateur connecté
document.addEventListener('DOMContentLoaded', () => {
  // Récupérer les données du localStorage
  const userName = localStorage.getItem('user_name');
  const userEmail = localStorage.getItem('user_email');
  const userRole = localStorage.getItem('user_role');
  const userProfile = localStorage.getItem('user_profile');

  // Vérifier que l'utilisateur est connecté
  if (!userName || userRole !== 'patient') {
    window.location.replace('/');
    return;
  }

  // Empêcher le retour arrière sur le dashboard après déconnexion
  preventBackNavigation('patient');

  // Extraire prénom et nom
  const nameParts = userName.split(' ');
  const prenom = nameParts[0] || '';
  const nom = nameParts.slice(1).join(' ') || '';
  const initials = (prenom.charAt(0) + (nom.charAt(0) || '')).toUpperCase();

  // Mettre à jour le titre de bienvenue
  const welcomeTitle = document.querySelector('.header-left h1');
  if (welcomeTitle) {
    welcomeTitle.textContent = `Bonjour, ${prenom} ${nom}`;
  }

  // Mettre à jour le profil utilisateur dans le header
  const userAvatar = document.querySelector('.user-avatar');
  if (userAvatar) {
    userAvatar.textContent = initials;
  }

  const userNameHeader = document.querySelector('.user-info h3');
  if (userNameHeader) {
    userNameHeader.textContent = `${prenom} ${nom}`;
  }

  const userStatusHeader = document.querySelector('.user-info p');
  if (userStatusHeader) {
    userStatusHeader.textContent = 'Patient';
  }

  // Parser le profil si disponible
  if (userProfile) {
    try {
      const profile = JSON.parse(userProfile);
      console.log('Profil utilisateur chargé:', profile);
    } catch (err) {
      console.error('Erreur parsing profil:', err);
    }
  }

  // Bouton de déconnexion
  setupLogoutButton();

  // Charger les données du dashboard patient
  loadPatientDashboard();
});

async function loadPatientDashboard() {
  const userId = localStorage.getItem('user_id');
  const token = localStorage.getItem('auth_token');
  if (!userId || !token) return;

  try {
    const resp = await fetch(`/api/patients/${userId}/dashboard`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!resp.ok) throw new Error('Impossible de charger le tableau de bord');
    const data = await resp.json();
    if (!data.success) throw new Error(data.error || 'Erreur');

    fillStats(data.stats);
    fillInfos(data.info);
    updateHeaderName(data.patient);
    updateNotifications(data.stats);
  } catch (err) {
    console.error('Dashboard patient:', err);
  }
}

function fillStats(stats = {}) {
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? '—';
  };

  setText('stat-months', stats.months_post_greffe ?? '—');
  setText('stat-rdv', stats.rdv_count ?? '0');
  setText('stat-questionnaires', stats.questionnaires_en_attente ?? '0');
  setText('stat-messages', stats.messages_non_lus ?? '0');
}

function fillInfos(info = {}) {
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? '—';
  };

  setText('info-greffe-date', fmtDate(info.date_greffe));
  setText('info-medecin', info.medecin || '—');
  setText('info-groupe', info.groupe_sanguin || '—');
  setText('info-bilan', fmtDate(info.dernier_bilan));
}

function updateHeaderName(patient) {
  if (!patient) return;
  const prenom = patient.prenom || '';
  const nom = patient.nom || '';
  const initials = (prenom.charAt(0) + (nom.charAt(0) || '')).toUpperCase();

  const welcomeTitle = document.querySelector('.header-left h1');
  if (welcomeTitle) {
    welcomeTitle.textContent = `Bonjour, ${prenom} ${nom}`.trim();
  }

  const subtitle = document.getElementById('dashboard-subtitle');
  if (subtitle) {
    subtitle.textContent = 'Voici votre suivi du jour';
  }

  const avatar = document.querySelector('.user-avatar');
  if (avatar) avatar.textContent = initials || '--';

  const headerName = document.querySelector('.user-info h3');
  if (headerName) headerName.textContent = `${prenom} ${nom}`.trim() || 'Patient';
}

function updateNotifications(stats = {}) {
  const badge = document.getElementById('notif-count');
  if (badge) {
    const total = (stats.messages_non_lus || 0) + (stats.questionnaires_en_attente || 0);
    badge.textContent = total;
  }
}

// Fonction pour la déconnexion
function setupLogoutButton() {
  document.addEventListener('click', (e) => {
    // Vérifier si c'est le lien de déconnexion dans la sidebar
    if (e.target.closest('[data-nav="logout"]')) {
      e.preventDefault();
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_id');
      localStorage.removeItem('user_email');
      localStorage.removeItem('user_role');
      localStorage.removeItem('user_name');
      localStorage.removeItem('user_profile');
      window.location.replace('/');
      return;
    }
    
    // Ou vérifier l'ancien format avec data-action
    if (e.target.matches('[data-action="logout"]')) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_id');
      localStorage.removeItem('user_email');
      localStorage.removeItem('user_role');
      localStorage.removeItem('user_name');
      localStorage.removeItem('user_profile');
      window.location.replace('/');
    }
  });
}

// Empêche de revenir au dashboard via le bouton retour si non authentifié
function preventBackNavigation(expectedRole) {
  history.replaceState(null, '', location.href);
  const guard = () => {
    const role = localStorage.getItem('user_role');
    if (role !== expectedRole) {
      window.location.replace('/');
    }
  };
  window.addEventListener('popstate', guard);
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      guard();
    }
  });
}
