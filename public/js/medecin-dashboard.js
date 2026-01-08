// Charger les informations de l'utilisateur connecté (Médecin)
document.addEventListener('DOMContentLoaded', () => {
  // Récupérer les données du localStorage
  const userName = localStorage.getItem('user_name');
  const userEmail = localStorage.getItem('user_email');
  const userRole = localStorage.getItem('user_role');

  // Vérifier que l'utilisateur est connecté et est un médecin
  if (!userName || userRole !== 'medecin') {
    window.location.replace('/');
    return;
  }

  // Empêcher le retour arrière sur le dashboard après déconnexion
  preventBackNavigation('medecin');

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

  // Alimenter le sélecteur de patients pour le suivi
  populatePatientSelect();

  // Activer les barres de recherche
  setupMedecinSearchBars();
});

let assignedPatients = [];
let patientsSearchTerm = '';
let managePatientsSearchTerm = '';
let patientSelectSearchTerm = '';
let patientSelectRendered = false;

// Remplit le select du suivi avec les patients affectés
async function populatePatientSelect() {
  const listContainer = document.getElementById('patientSelectList');
  if (!listContainer) return;

  listContainer.innerHTML = '<div style="color:#666; padding:8px 12px;">Chargement...</div>';

  const searchInput = document.getElementById('patientSelectSearch');
  const searchInputTop = document.getElementById('patientSelectSearchTop');
  if (searchInput && !searchInput.dataset.bound) {
    searchInput.dataset.bound = 'true';
    searchInput.addEventListener('input', (e) => {
      patientSelectSearchTerm = e.target.value.toLowerCase().trim();
      renderPatientSelectOptions();
    });
  }
  if (searchInputTop && !searchInputTop.dataset.bound) {
    searchInputTop.dataset.bound = 'true';
    searchInputTop.addEventListener('input', (e) => {
      patientSelectSearchTerm = e.target.value.toLowerCase().trim();
      renderPatientSelectOptions();
    });
  }

  try {
    // Si déjà chargés, réutiliser la liste assignée pour éviter les doublons
    if (assignedPatients.length > 0) {
      renderPatientSelectOptions();
      return;
    }

    const token = localStorage.getItem('auth_token');
    const response = await fetch('/api/medecin/patients', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Erreur lors du chargement des patients');
    }

    const data = await response.json();
    assignedPatients = dedupePatients(data.patients || []);
    if (!data.success || assignedPatients.length === 0) {
      const emptyOption = document.createElement('option');
      emptyOption.value = '';
      emptyOption.textContent = 'Aucun patient affecté';
      select.appendChild(emptyOption);
      return;
    }

    renderPatientSelectOptions();

  } catch (error) {
    console.error('Erreur chargement select patients:', error);
    listContainer.innerHTML = '<div style="color:#e74c3c; padding:8px 12px;">Erreur de chargement</div>';
  }
}

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
      const birthDate = patient.date_naissance
        ? new Date(patient.date_naissance).toLocaleDateString('fr-FR')
        : 'Date inconnue';
      const contact = [patient.email, patient.telephone].filter(Boolean).join(' • ');
      
      return `
        <div class="patient-item" style="cursor: default;">
          <div class="patient-avatar">${initials}</div>
          <div class="patient-info">
            <h4>${patient.prenom} ${patient.nom}</h4>
            <p>${contact || 'Contact non renseigné'} • Naissance: ${birthDate}</p>
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

// Déduplique une liste de patients en normalisant l'id (string) et le fallback nom/prénom/email en minuscule
function dedupePatients(patients = []) {
  const seen = new Set();
  return patients.filter((p) => {
    const key = (p?.id !== undefined && p?.id !== null)
      ? String(p.id)
      : `${(p?.prenom || '').toLowerCase()}|${(p?.nom || '').toLowerCase()}|${(p?.email || '').toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function setupMedecinSearchBars() {
  const listSearchInput = document.querySelector('#page-patients .search-bar .search-input');
  const manageSearchInput = document.querySelector('#page-gestion .search-bar .search-input');

  if (listSearchInput) {
    listSearchInput.addEventListener('input', (e) => {
      patientsSearchTerm = e.target.value.toLowerCase().trim();
      renderPatientLists();
    });
  }

  if (manageSearchInput) {
    manageSearchInput.addEventListener('input', (e) => {
      managePatientsSearchTerm = e.target.value.toLowerCase().trim();
      renderPatientLists();
    });
  }
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
    const text = item.textContent.toLowerCase().replace(/@[^\s]+/g, '');
    item.style.display = text.includes(searchTerm) ? 'flex' : 'none';
  });
}

// Fonction pour charger les patients affectés au médecin
async function loadAssignedPatientsIfNeeded() {
  const targetPageIds = ['page-patients', 'page-gestion'];
  const observers = [];

  targetPageIds.forEach((pageId) => {
    const pageEl = document.getElementById(pageId);
    if (!pageEl) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class' && pageEl.classList.contains('active')) {
          loadAssignedPatients();
        }
      });
    });

    observer.observe(pageEl, { attributes: true });
    observers.push(observer);

    if (pageEl.classList.contains('active')) {
      loadAssignedPatients();
    }
  });

  // Précharger pour mettre à jour les compteurs dès l'arrivée sur le dashboard
  if (!observers.length) return;
  loadAssignedPatients();
}

// Fonction pour charger la liste des patients affectés au médecin
async function loadAssignedPatients() {
  const listContainer = document.getElementById('allPatientsList');
  const manageList = document.getElementById('managePatientsList');
  if (!listContainer && !manageList) return;

  try {
    if (listContainer) {
      listContainer.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">Chargement des patients...</p>';
    }
    if (manageList) {
      manageList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Chargement des patients...</p>';
    }

    const token = localStorage.getItem('auth_token');
    const response = await fetch('/api/medecin/patients', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Erreur lors du chargement des patients');
    }

    const data = await response.json();
    assignedPatients = dedupePatients(data.patients || []);
    
    if (!data.success || assignedPatients.length === 0) {
      if (listContainer) {
        listContainer.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">Aucun patient affecté. Consultez la section "Patients non affectés" pour en ajouter.</p>';
      }
      if (manageList) {
        manageList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Aucun patient affecté pour le moment.</p>';
      }
      updatePatientsCount(0);
      populatePatientSelect();
      return;
    }

    renderPatientLists();
    updatePatientsCount(assignedPatients.length);
    populatePatientSelect();

  } catch (error) {
    console.error('Erreur:', error);
    if (listContainer) {
      listContainer.innerHTML = '<p style="text-align: center; color: #e74c3c; padding: 40px;">❌ Erreur lors du chargement des patients</p>';
    }
    if (manageList) {
      manageList.innerHTML = '<p style="text-align: center; color: #e74c3c; padding: 20px;">❌ Erreur lors du chargement des patients</p>';
    }
  }
}

function renderPatientLists() {
  renderAllPatientsList();
  renderManagePatientsList();
  renderPatientSelectOptions();
  updateActionFormSelects();
}

function filterPatientsByTerm(list, term) {
  if (!term) return list;
  const lower = term.toLowerCase();
  return list.filter((p) => {
    const emailLocal = (p.email || '').split('@')[0];
    const haystack = `${p.prenom || ''} ${p.nom || ''} ${emailLocal} ${p.telephone || ''} ${p.adresse_postale || ''}`.toLowerCase();
    return haystack.includes(lower);
  });
}

function renderPatientSelectOptions() {
  const listContainer = document.getElementById('patientSelectList');
  const hiddenSelect = document.getElementById('patientSelectHidden');
  const searchInput = document.getElementById('patientSelectSearch');
  const searchInputTop = document.getElementById('patientSelectSearchTop');
  if (!listContainer) return;

  const currentTerm = (searchInputTop?.value || searchInput?.value || patientSelectSearchTerm || '').toLowerCase().trim();
  patientSelectSearchTerm = currentTerm;
  const filtered = filterPatientsByTerm(assignedPatients, currentTerm);

  if (hiddenSelect) {
    hiddenSelect.innerHTML = '';
  }

  if (!filtered.length) {
    listContainer.innerHTML = '<div style="color:#666; padding:8px 12px;">Aucun patient correspondant.</div>';
    if (hiddenSelect) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Aucun patient';
      hiddenSelect.appendChild(opt);
    }
    return;
  }

  listContainer.innerHTML = filtered.map((patient) => {
    const contact = [patient.email, patient.telephone].filter(Boolean).join(' • ');
    return `
      <div class="patient-item" style="cursor:pointer;" data-patient-id="${patient.id}" data-patient-name="${patient.prenom} ${patient.nom}">
        <div class="patient-avatar">${getInitials(patient.prenom, patient.nom)}</div>
        <div class="patient-info">
          <h4>${patient.prenom} ${patient.nom}</h4>
          <p>${contact || 'Contact non renseigné'}</p>
        </div>
        <button class="btn-primary" data-action="select-patient" data-patient-id="${patient.id}" data-patient-name="${patient.prenom} ${patient.nom}">Sélectionner</button>
      </div>
    `;
  }).join('');

  if (hiddenSelect) {
    filtered.forEach((patient) => {
      const opt = document.createElement('option');
      opt.value = patient.id;
      opt.textContent = `${patient.prenom} ${patient.nom}`.trim();
      hiddenSelect.appendChild(opt);
    });
  }

  // Synchroniser les champs de recherche
  if (searchInput && searchInput.value.toLowerCase().trim() !== patientSelectSearchTerm) {
    searchInput.value = patientSelectSearchTerm;
  }
  if (searchInputTop && searchInputTop.value.toLowerCase().trim() !== patientSelectSearchTerm) {
    searchInputTop.value = patientSelectSearchTerm;
  }

  // Bind one-time click handler to list container
  if (!patientSelectRendered) {
    patientSelectRendered = true;
    listContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="select-patient"]');
      const item = e.target.closest('[data-patient-id]');
      const patientId = btn?.dataset.patientId || item?.dataset.patientId;
      const patientName = btn?.dataset.patientName || item?.dataset.patientName;
      if (patientId) {
        loadPatientDataById(patientId, patientName);
      }
    });
  }
}

// Chargement des données suivi par ID direct (depuis la liste)
function loadPatientDataById(patientId, patientLabel) {
  const select = document.getElementById('patientSelectHidden');
  if (select) {
    const existingOption = Array.from(select.options).find((opt) => opt.value === String(patientId));
    if (existingOption) {
      select.value = existingOption.value;
    } else {
      // inject a hidden option to keep loadPatientData compatible
      const opt = document.createElement('option');
      opt.value = patientId;
      opt.textContent = patientLabel || 'Patient';
      opt.hidden = true;
      select.appendChild(opt);
      select.value = patientId;
    }
  }
  loadPatientData();
}

function renderAllPatientsList() {
  const listContainer = document.getElementById('allPatientsList');
  if (!listContainer) return;

  const filtered = filterPatientsByTerm(assignedPatients, patientsSearchTerm);

  if (filtered.length === 0) {
    listContainer.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">Aucun patient correspondant.</p>';
    return;
  }

  listContainer.innerHTML = filtered.map(patient => {
    const initials = getInitials(patient.prenom, patient.nom);
    const contact = [patient.email, patient.telephone].filter(Boolean).join(' • ');
    const address = patient.adresse_postale ? ` • ${patient.adresse_postale}` : '';
    
    return `
      <div class="patient-item" data-priority="stable" onclick="viewPatient('${patient.prenom} ${patient.nom}')">
        <div class="patient-avatar">${initials}</div>
        <div class="patient-info">
          <h4>${patient.prenom} ${patient.nom}</h4>
          <p>${contact || 'Contact non renseigné'}${address}</p>
        </div>
        <span class="patient-status status-stable">Affecté</span>
      </div>
    `;
  }).join('');
}

function renderManagePatientsList() {
  const manageList = document.getElementById('managePatientsList');
  if (!manageList) return;

  const filtered = filterPatientsByTerm(assignedPatients, managePatientsSearchTerm);

  if (filtered.length === 0) {
    manageList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Aucun patient correspondant.</p>';
    return;
  }

  manageList.innerHTML = filtered.map(patient => {
    const initials = getInitials(patient.prenom, patient.nom);
    const contact = [patient.email, patient.telephone].filter(Boolean).join(' • ');
    const label = `${patient.prenom} ${patient.nom}`.trim();
    
    return `
      <div class="patient-item">
        <div class="patient-avatar">${initials}</div>
        <div class="patient-info">
          <h4>${label}</h4>
          <p>${contact || 'Contact non renseigné'}</p>
        </div>
        <div class="action-buttons" style="gap:6px; flex-wrap:wrap;">
          <button class="btn-primary" style="padding:6px 10px;" onclick="goToSuiviPatient('${patient.id}', '${label}')">📊 Suivre</button>
          <button class="btn-primary" style="padding:6px 10px;" onclick="goToRdvPatient('${patient.id}', '${label}')">📅 RDV</button>
          <button class="btn-primary" style="padding:6px 10px;" onclick="goToOrdonnancePatient('${patient.id}', '${label}')">💊 Ordonnance</button>
          <button class="btn-primary" style="padding:6px 10px;" onclick="goToMessageriePatient('${patient.id}', '${label}')">💬 Messagerie</button>
        </div>
      </div>
    `;
  }).join('');
}

function updateActionFormSelects(selectedId, selectedLabel) {
  populateSelectWithAssigned('rdvPatient', selectedId, selectedLabel);
  populateSelectWithAssigned('ordoPatient', selectedId, selectedLabel);
}

function populateSelectWithAssigned(selectId, selectedId, selectedLabel) {
  const select = document.getElementById(selectId);
  if (!select) return;

  const hasExplicitSelection = selectedId !== undefined && selectedId !== null;
  const currentValue = hasExplicitSelection ? String(selectedId) : select.value;
  const currentLabel = selectedLabel || select.options[select.selectedIndex]?.textContent || '';

  select.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Sélectionnez un patient...';
  placeholder.selected = !currentValue;
  select.appendChild(placeholder);

  assignedPatients.forEach((patient) => {
    const opt = document.createElement('option');
    opt.value = patient.id;
    opt.textContent = `${patient.prenom} ${patient.nom}`.trim();
    select.appendChild(opt);
  });

  if (currentValue) {
    select.value = currentValue;
    if (!select.value) {
      const opt = document.createElement('option');
      opt.value = currentValue;
      opt.textContent = currentLabel || 'Patient';
      opt.hidden = true;
      select.appendChild(opt);
      select.value = currentValue;
    }
  }
}

function setSelectedPatientContext(patientId, patientLabel) {
  if (patientId !== undefined && patientId !== null) {
    localStorage.setItem('medecin_selected_patient_id', String(patientId));
  }
  if (patientLabel) {
    localStorage.setItem('medecin_selected_patient_name', patientLabel);
  }
}

function getInitialsFromLabel(label) {
  const parts = (label || '').trim().split(/\s+/);
  const prenom = parts.shift() || '';
  const nom = parts.join(' ');
  const initials = getInitials(prenom, nom);
  return initials || (label ? label.charAt(0).toUpperCase() : '?');
}

function goToSuiviPatient(patientId, patientLabel) {
  setSelectedPatientContext(patientId, patientLabel);
  if (typeof navigateTo === 'function') {
    navigateTo('suivi');
  }
  loadPatientDataById(patientId, patientLabel);
}

function goToRdvPatient(patientId, patientLabel) {
  setSelectedPatientContext(patientId, patientLabel);
  updateActionFormSelects(patientId, patientLabel);
  if (typeof navigateTo === 'function') {
    navigateTo('rdv');
  }
  if (typeof openAddRdvModal === 'function') {
    openAddRdvModal();
  }
  const select = document.getElementById('rdvPatient');
  if (select) {
    select.focus();
  }
}

function goToOrdonnancePatient(patientId, patientLabel) {
  setSelectedPatientContext(patientId, patientLabel);
  updateActionFormSelects(patientId, patientLabel);
  if (typeof navigateTo === 'function') {
    navigateTo('ordonnances');
  }
  if (typeof loadOrdonnances === 'function') {
    loadOrdonnances(patientId);
  }
  if (typeof openCreateOrdonnanceModal === 'function') {
    openCreateOrdonnanceModal();
  }
  const select = document.getElementById('ordoPatient');
  if (select) {
    select.focus();
  }
}

function goToMessageriePatient(patientId, patientLabel) {
  setSelectedPatientContext(patientId, patientLabel);
  if (typeof navigateTo === 'function') {
    navigateTo('messagerie');
  }
  const initials = getInitialsFromLabel(patientLabel);
  if (typeof openChat === 'function') {
    openChat(patientLabel, initials);
  } else {
    const nameEl = document.getElementById('chatPatientName');
    const avatarEl = document.getElementById('chatAvatarHeader');
    if (nameEl) nameEl.textContent = patientLabel;
    if (avatarEl) avatarEl.textContent = initials;
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
    const response = await fetch('/api/medecin/patients', {
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
    const patients = dedupePatients(data.patients || []);
    
    if (!data.success || patients.length === 0) {
      recentList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Aucun patient affecté</p>';
      return;
    }

    // Afficher les 4 patients les plus récents
    const recentPatients = patients.slice(0, 4);
    
    recentList.innerHTML = recentPatients.map(patient => {
      const initials = getInitials(patient.prenom, patient.nom);
      const contact = [patient.email, patient.telephone].filter(Boolean).join(' • ');
      
      return `
        <div class="patient-item" onclick="viewPatient('${patient.prenom} ${patient.nom}')">
          <div class="patient-avatar">${initials}</div>
          <div class="patient-info">
            <h4>${patient.prenom} ${patient.nom}</h4>
            <p>${contact || 'Patient affecté'}</p>
          </div>
          <span class="patient-status status-stable">Stable</span>
        </div>
      `;
    }).join('');

    // Mettre à jour le compteur total sur le dashboard
    const totalPatientsElement = document.getElementById('totalPatients');
    if (totalPatientsElement) {
      totalPatientsElement.textContent = patients.length;
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
