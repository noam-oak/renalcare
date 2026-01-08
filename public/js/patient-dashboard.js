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

    // Load appointments
    await loadAppointments(userId, token);
    // Load questionnaire alerts
    await loadQuestionnaireAlerts(userId, token);
    // Placeholder for reminders - will be implemented when reminder system is ready
    renderNoReminders();
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

// Load Appointments dynamically
async function loadAppointments(userId, token) {
  const container = document.getElementById('appointmentsContainer');
  if (!container) return;

  try {
    // Use the correct endpoint without user ID in path
    const resp = await fetch(`/api/patients/appointments/upcoming?user_id=${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!resp.ok) throw new Error('Impossible de charger les rendez-vous');
    const data = await resp.json();

    if (data.success && data.appointments && data.appointments.length > 0) {
      const appointments = data.appointments.slice(0, 2); // Show top 2 appointments
      container.innerHTML = appointments.map(apt => {
        const date = new Date(apt.date);
        const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
        const doctorName = `Dr. ${apt.prenom} ${apt.nom}`;

        return `
          <div class="appointment-item">
            <div class="appointment-time">
              <div class="time">${dateStr}</div>
              <div class="duration">${timeStr}</div>
            </div>
            <div class="appointment-details">
              <h4>${doctorName}</h4>
              <p>Consultation de suivi</p>
            </div>
          </div>
        `;
      }).join('');
    } else {
      container.innerHTML = `
        <div class="appointment-item">
          <div class="appointment-time">
            <div class="time">—</div>
            <div class="duration">—</div>
          </div>
          <div class="appointment-details">
            <h4>Aucun rendez-vous prévu</h4>
            <p>Planifiez une consultation avec votre médecin</p>
          </div>
        </div>
      `;
    }
  } catch (err) {
    console.error('Erreur lors du chargement des rendez-vous:', err);
    container.innerHTML = `
      <div class="appointment-item">
        <div class="appointment-time">
          <div class="time">—</div>
          <div class="duration">—</div>
        </div>
        <div class="appointment-details">
          <h4>Aucun rendez-vous prévu</h4>
          <p>Planifiez une consultation avec votre médecin</p>
        </div>
      </div>
    `;
  }
}

// Load questionnaire reminders/alerts based on transplant protocol
async function loadQuestionnaireAlerts(userId, token) {
  const container = document.getElementById('alertsContainer');
  if (!container) return;

  try {
    const resp = await fetch(`/api/patients/${userId}/questionnaire-alerts`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!resp.ok) throw new Error('Impossible de charger les alertes');
    const data = await resp.json();

    if (data.success && data.alerts && data.alerts.length > 0) {
      container.innerHTML = data.alerts.map(alert => {
        const alertClass = getAlertClass(alert.severity || 'info');
        const alertIcon = getAlertIcon(alert.severity || 'info');

        return `
          <div class="alert ${alertClass}">
            <span class="alert-icon">${alertIcon}</span>
            <div class="alert-content">
              <h4>${alert.title || 'Alerte'}</h4>
              <p>${alert.message || 'Nouvelle notification'}</p>
            </div>
          </div>
        `;
      }).join('');
    } else {
      container.innerHTML = `
        <div class="alert alert-success">
          <span class="alert-icon">✅</span>
          <div class="alert-content">
            <h4>Tout va bien</h4>
            <p>Aucune alerte pour le moment</p>
          </div>
        </div>
      `;
    }
  } catch (err) {
    console.error('Erreur lors du chargement des alertes questionnaire:', err);
    container.innerHTML = `
      <div class="alert alert-success">
        <span class="alert-icon">✅</span>
        <div class="alert-content">
          <h4>Tout va bien</h4>
          <p>Aucune alerte pour le moment</p>
        </div>
      </div>
    `;
  }
}

// Helper function to get alert class based on severity
function getAlertClass(severity) {
  const severityMap = {
    'danger': 'alert-danger',
    'critical': 'alert-danger',
    'warning': 'alert-warning',
    'info': 'alert-info',
    'success': 'alert-success'
  };
  return severityMap[severity] || 'alert-info';
}

// Helper function to get alert icon based on severity
function getAlertIcon(severity) {
  const iconMap = {
    'danger': '🔴',
    'critical': '🚨',
    'warning': '⚠️',
    'info': 'ℹ️',
    'success': '✅'
  };
  return iconMap[severity] || 'ℹ️';
}

// Placeholder for reminders - will be implemented when reminder system is ready
function renderNoReminders() {
  const container = document.getElementById('remindersContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="appointment-item">
      <div class="appointment-time">
        <div class="time">—</div>
      </div>
      <div class="appointment-details">
        <h4>Aucun rappel pour aujourd'hui</h4>
        <p>Consultez votre médecin pour les rappels de traitement</p>
      </div>
    </div>
  `;
}
