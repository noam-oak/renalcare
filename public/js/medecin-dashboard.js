// Charger les informations de l'utilisateur connecté (Médecin)
document.addEventListener('DOMContentLoaded', () => {
  // Récupérer les données du localStorage
  const userName = localStorage.getItem('user_name');
  const userEmail = localStorage.getItem('user_email');
  const userRole = localStorage.getItem('user_role');

  // Vérifier que l'utilisateur est connecté et est un médecin
  if (!userName || userRole !== 'medecin') {
    // Rediriger vers la page de connexion si pas de session valide
    window.location.href = '/login';
    return;
  }

  // Extraire prénom et nom
  const nameParts = userName.split(' ');
  const prenom = nameParts[0] || '';
  const nom = nameParts.slice(1).join(' ') || '';
  const initials = (prenom.charAt(0) + (nom.charAt(0) || '')).toUpperCase();

  // Mettre à jour le titre de bienvenue
  const pageTitle = document.getElementById('pageTitle');
  if (pageTitle) {
    pageTitle.textContent = `Bonjour, Dr. ${nom}`;
  }

  // Mettre à jour le profil utilisateur dans le header
  const userAvatar = document.querySelector('.user-avatar');
  if (userAvatar) {
    userAvatar.textContent = initials;
  }

  const userNameHeader = document.querySelector('.user-info h3');
  if (userNameHeader) {
    userNameHeader.textContent = `Dr. ${nom}`;
  }

  const userStatusHeader = document.querySelector('.user-info p');
  if (userStatusHeader) {
    userStatusHeader.textContent = 'Médecin';
  }

  // Bouton de déconnexion
  setupLogoutButton();

  // Charger les patients non affectés si on est sur cette page
  loadUnassignedPatientsIfNeeded();

  // Charger les patients affectés
  loadAssignedPatientsIfNeeded();

  // Charger les patients récents sur le dashboard
  loadRecentPatientsOnDashboard();
});

// Fonction pour charger les patients non affectés
async function loadUnassignedPatientsIfNeeded() {
  const unassignedPage = document.getElementById('page-patients-non-affectes');
  if (!unassignedPage) return;

  // Observer les changements de page
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class' && unassignedPage.classList.contains('active')) {
        loadUnassignedPatients();
      }
    });
  });

  observer.observe(unassignedPage, { attributes: true });

  // Charger immédiatement si la page est déjà active
  if (unassignedPage.classList.contains('active')) {
    loadUnassignedPatients();
  }
}

// Fonction pour charger la liste des patients non affectés
async function loadUnassignedPatients() {
  const listContainer = document.getElementById('unassignedPatientsList');
  if (!listContainer) return;

  try {
    listContainer.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">Chargement des patients...</p>';

    const token = localStorage.getItem('auth_token');
    const response = await fetch('/api/medecin/patients-non-affectes', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Erreur lors du chargement des patients');
    }

    const data = await response.json();
    
    if (!data.success || !data.patients || data.patients.length === 0) {
      listContainer.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">Aucun patient non affecté</p>';
      return;
    }

    // Afficher les patients
    listContainer.innerHTML = data.patients.map(patient => {
      const initials = getInitials(patient.prenom, patient.nom);
      const dateInscription = new Date(patient.created_at).toLocaleDateString('fr-FR');
      
      return `
        <div class="patient-item" style="cursor: default;">
          <div class="patient-avatar">${initials}</div>
          <div class="patient-info">
            <h4>${patient.prenom} ${patient.nom}</h4>
            <p>${patient.email} • Inscrit le ${dateInscription}</p>
          </div>
          <button class="btn-primary" style="width: auto; padding: 8px 16px;" 
                  onclick="assignPatientToMe('${patient.id}', '${patient.prenom}', '${patient.nom}')">
            ➕ Affecter à moi
          </button>
        </div>
      `;
    }).join('');

  } catch (error) {
    console.error('Erreur:', error);
    listContainer.innerHTML = '<p style="text-align: center; color: #e74c3c; padding: 40px;">❌ Erreur lors du chargement des patients</p>';
  }
}

// Fonction pour obtenir les initiales
function getInitials(prenom, nom) {
  const p = (prenom || '').charAt(0).toUpperCase();
  const n = (nom || '').charAt(0).toUpperCase();
  return p + n;
}

// Fonction pour affecter un patient au médecin connecté
async function assignPatientToMe(patientId, prenom, nom) {
  if (!confirm(`Voulez-vous vraiment affecter ${prenom} ${nom} à votre liste de patients ?`)) {
    return;
  }

  try {
    const token = localStorage.getItem('auth_token');
    const response = await fetch('/api/medecin/affecter-patient', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ patient_id: patientId })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Erreur lors de l\'affectation');
    }

    alert(`✅ ${prenom} ${nom} a été ajouté(e) à votre liste de patients avec succès !`);
    
    // Recharger la liste
    loadUnassignedPatients();

  } catch (error) {
    console.error('Erreur:', error);
    alert('❌ Une erreur est survenue lors de l\'affectation du patient.');
  }
}

// Fonction de recherche des patients non affectés
function searchUnassignedPatients() {
  const searchInput = document.getElementById('searchUnassignedPatient');
  const searchTerm = searchInput.value.toLowerCase().trim();
  const patientItems = document.querySelectorAll('#unassignedPatientsList .patient-item');

  patientItems.forEach(item => {
    const text = item.textContent.toLowerCase();
    item.style.display = text.includes(searchTerm) ? 'flex' : 'none';
  });
}

// Fonction pour charger les patients affectés au médecin
async function loadAssignedPatientsIfNeeded() {
  const patientsPage = document.getElementById('page-patients');
  if (!patientsPage) return;

  // Observer les changements de page
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class' && patientsPage.classList.contains('active')) {
        loadAssignedPatients();
      }
    });
  });

  observer.observe(patientsPage, { attributes: true });

  // Charger immédiatement si la page est déjà active
  if (patientsPage.classList.contains('active')) {
    loadAssignedPatients();
  }
}

// Fonction pour charger la liste des patients affectés au médecin
async function loadAssignedPatients() {
  const listContainer = document.getElementById('allPatientsList');
  if (!listContainer) return;

  try {
    listContainer.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">Chargement des patients...</p>';

    const token = localStorage.getItem('auth_token');
    const response = await fetch('/api/medecin/mes-patients', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Erreur lors du chargement des patients');
    }

    const data = await response.json();
    
    if (!data.success || !data.patients || data.patients.length === 0) {
      listContainer.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">Aucun patient affecté. Consultez la section "Patients non affectés" pour en ajouter.</p>';
      return;
    }

    // Afficher les patients
    listContainer.innerHTML = data.patients.map(patient => {
      const initials = getInitials(patient.prenom, patient.nom);
      const dateInscription = new Date(patient.created_at).toLocaleDateString('fr-FR');
      
      return `
        <div class="patient-item" data-priority="stable" onclick="viewPatient('${patient.prenom} ${patient.nom}')">
          <div class="patient-avatar">${initials}</div>
          <div class="patient-info">
            <h4>${patient.prenom} ${patient.nom}</h4>
            <p>${patient.email} • Inscrit le ${dateInscription}</p>
          </div>
          <span class="patient-status status-stable">Affecté</span>
        </div>
      `;
    }).join('');

    // Mettre à jour le compteur
    updatePatientsCount(data.patients.length);

  } catch (error) {
    console.error('Erreur:', error);
    listContainer.innerHTML = '<p style="text-align: center; color: #e74c3c; padding: 40px;">❌ Erreur lors du chargement des patients</p>';
  }
}

// Fonction pour mettre à jour le compteur de patients
function updatePatientsCount(count) {
  const totalPatientsElement = document.getElementById('totalPatients');
  if (totalPatientsElement) {
    totalPatientsElement.textContent = count;
  }
  
  // Mettre à jour les onglets si nécessaire
  const allTab = document.querySelector('#page-patients .tab');
  if (allTab) {
    allTab.textContent = `Tous (${count})`;
  }
}

// Fonction pour charger les patients récents sur le dashboard principal
async function loadRecentPatientsOnDashboard() {
  const dashboardPage = document.getElementById('page-dashboard');
  const recentList = document.getElementById('recentPatientsList');
  
  if (!recentList || !dashboardPage) return;

  try {
    const token = localStorage.getItem('auth_token');
    const response = await fetch('/api/medecin/mes-patients', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Erreur lors du chargement des patients récents');
      return;
    }

    const data = await response.json();
    
    if (!data.success || !data.patients || data.patients.length === 0) {
      recentList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Aucun patient affecté</p>';
      return;
    }

    // Afficher les 4 patients les plus récents
    const recentPatients = data.patients.slice(0, 4);
    
    recentList.innerHTML = recentPatients.map(patient => {
      const initials = getInitials(patient.prenom, patient.nom);
      const dateInscription = new Date(patient.created_at).toLocaleDateString('fr-FR');
      
      return `
        <div class="patient-item" onclick="viewPatient('${patient.prenom} ${patient.nom}')">
          <div class="patient-avatar">${initials}</div>
          <div class="patient-info">
            <h4>${patient.prenom} ${patient.nom}</h4>
            <p>Inscrit le ${dateInscription}</p>
          </div>
          <span class="patient-status status-stable">Stable</span>
        </div>
      `;
    }).join('');

    // Mettre à jour le compteur total sur le dashboard
    const totalPatientsElement = document.getElementById('totalPatients');
    if (totalPatientsElement) {
      totalPatientsElement.textContent = data.patients.length;
    }

  } catch (error) {
    console.error('Erreur:', error);
  }
}

// Bouton de déconnexion
setupLogoutButton();

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
      window.location.href = '/login';
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
      window.location.href = '/login';
    }
  });
}
