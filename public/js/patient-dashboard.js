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
    loadTreatments(userId, token);
    loadUpcomingAppointments(token);
  } catch (err) {
    console.error('Dashboard patient:', err);
  }
}

async function loadUpcomingAppointments(token) {
  const container = document.getElementById('upcomingAppointments');
  if (!container) return;

  container.innerHTML = `
    <div class="appointment-item">
      <div class="appointment-time">
        <div class="time">⏳</div>
        <div class="duration">--:--</div>
      </div>
      <div class="appointment-details">
        <h4>Chargement des rendez-vous...</h4>
        <p>Merci de patienter</p>
      </div>
    </div>`;

  try {
    const resp = await fetch('/api/patients/appointments/upcoming', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await resp.json();
    if (!resp.ok || !data.success) {
      throw new Error(data.error || 'Erreur de chargement des rendez-vous');
    }

    const rdvs = data.appointments || [];
    if (!rdvs.length) {
      container.innerHTML = `
        <div class="appointment-item">
          <div class="appointment-time">
            <div class="time">—</div>
          </div>
          <div class="appointment-details">
            <h4>Aucun rendez-vous prévu</h4>
            <p>Planifiez un contrôle auprès de votre médecin</p>
          </div>
        </div>`;
      return;
    }

    container.innerHTML = rdvs.slice(0, 3).map((rdv) => {
      const date = rdv.date ? new Date(rdv.date) : null;
      const day = date ? date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : 'Date';
      const time = date ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
      const doctor = rdv.prenom || rdv.nom ? `Dr. ${rdv.nom || ''}`.trim() : 'Équipe médicale';
      const status = rdv.statut ? rdv.statut : '';

      return `
        <div class="appointment-item">
          <div class="appointment-time">
            <div class="time">${day}</div>
            <div class="duration">${time}</div>
          </div>
          <div class="appointment-details">
            <h4>${doctor}</h4>
            <p>${status ? status : 'Rendez-vous programmé'}</p>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    console.error('RDV patient:', err);
    container.innerHTML = `
      <div class="appointment-item">
        <div class="appointment-time">
          <div class="time">⚠️</div>
        </div>
        <div class="appointment-details">
          <h4>Erreur</h4>
          <p>Impossible de charger vos rendez-vous</p>
        </div>
      </div>`;
  }
}

async function loadTreatments(userId, token) {
  const container = document.getElementById('treatmentSummary');
  if (!container) return;

  container.innerHTML = `
    <div class="treatment-item">
      <div class="treatment-icon">⏳</div>
      <div class="treatment-info">
        <h4>Chargement des ordonnances...</h4>
        <p>Merci de patienter</p>
      </div>
    </div>`;

  try {
    const resp = await fetch(`/api/patients/${userId}/traitements`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await resp.json();
    if (!resp.ok || !data.success) {
      throw new Error(data.error || 'Erreur de chargement');
    }

    const traitements = data.traitements || [];
    if (traitements.length === 0) {
      container.innerHTML = `
        <div class="treatment-item">
          <div class="treatment-icon">💊</div>
          <div class="treatment-info">
            <h4>Aucune ordonnance</h4>
            <p>Revenez après la prochaine prescription</p>
          </div>
        </div>`;
      return;
    }

    container.innerHTML = traitements.map(t => {
      const dateText = t.date ? new Date(t.date).toLocaleDateString('fr-FR') : 'Ordonnance';
      const lines = (t.prescription || '').split('\n').filter(Boolean);
      const first = lines[0] || 'Prescription en cours';
      const rest = lines.slice(1, 3).join(' • ');
      const preview = [first, rest].filter(Boolean).join(' • ');

      return `
        <div class="treatment-item">
          <div class="treatment-icon">💊</div>
          <div class="treatment-info">
            <h4>${dateText}</h4>
            <p>${preview}</p>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    console.error(err);
    container.innerHTML = `
      <div class="treatment-item">
        <div class="treatment-icon">⚠️</div>
        <div class="treatment-info">
          <h4>Erreur</h4>
          <p>Impossible de charger vos ordonnances</p>
        </div>
      </div>`;
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
