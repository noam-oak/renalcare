document.addEventListener('DOMContentLoaded', () => {
  const userId = localStorage.getItem('user_id');
  const token = localStorage.getItem('auth_token');

  if (!userId || !token) {
    renderUnauthorized();
    return;
  }

  loadTreatments(userId, token);
});

async function loadTreatments(userId, token) {
  setSummaryLoading();
  setListLoading();

  try {
    const treatments = await fetchTreatments(userId, token);
    renderSummary(treatments);
    renderList(treatments);
    renderAlert(treatments);
  } catch (err) {
    console.error('Erreur chargement traitements:', err);
    renderSummaryError();
    renderListError();
  }
}

async function fetchTreatments(userId, token) {
  const resp = await fetch(`/api/patients/${userId}/traitements`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!resp.ok) {
    throw new Error('Réponse serveur invalide');
  }

  const data = await resp.json();
  if (!data.success) {
    throw new Error(data.error || 'Impossible de récupérer les traitements');
  }

  return data.traitements || [];
}

function renderSummary(treatments) {
  const container = document.getElementById('treatmentSummary');
  if (!container) return;

  if (!treatments.length) {
    container.innerHTML = `
      <div class="treatment-item">
        <div class="treatment-icon">💊</div>
        <div class="treatment-info">
          <h4>Aucun traitement</h4>
          <p>En attente d'une prescription</p>
        </div>
      </div>
    `;
    return;
  }

  const latest = treatments[0];
  const lines = formatLines(latest.prescription);
  const firstLine = lines[0] || 'Prescription en cours';
  const dateText = latest.date ? new Date(latest.date).toLocaleDateString('fr-FR') : '';

  container.innerHTML = `
    <div class="treatment-item">
      <div class="treatment-icon">💊</div>
      <div class="treatment-info">
        <h4>${firstLine}</h4>
        <p>${dateText ? `${dateText} • ` : ''}${lines.slice(1, 3).join(' • ')}</p>
      </div>
      <span class="treatment-status status-pending">Suivre</span>
    </div>
  `;
}

function renderList(treatments) {
  const list = document.getElementById('treatmentList');
  if (!list) return;

  if (!treatments.length) {
    list.innerHTML = `
      <div class="medication-card">
        <div class="medication-header">
          <div class="medication-name">
            <div class="medication-icon">💊</div>
            <div class="medication-info">
              <h3>Aucune prescription</h3>
              <p>En attente de votre médecin</p>
            </div>
          </div>
        </div>
      </div>
    `;
    return;
  }

  list.innerHTML = treatments.map((t) => {
    const dateText = t.date ? new Date(t.date).toLocaleDateString('fr-FR') : 'Prescription';
    const lines = formatLines(t.prescription);
    const detail = lines.map((line) => `<li>${line}</li>`).join('');

    return `
      <div class="medication-card">
        <div class="medication-header">
          <div class="medication-name">
            <div class="medication-icon">💊</div>
            <div class="medication-info">
              <h3>${dateText}</h3>
              <p>Suivi du traitement</p>
            </div>
          </div>
          <span class="medication-status status-active">Actif</span>
        </div>
        <div class="medication-details" style="grid-template-columns: 1fr; text-align: left;">
          <div class="detail-item" style="text-align:left;">
            <div class="detail-label">Détails</div>
            <ul style="padding-left: 18px; margin: 0; line-height: 1.5;">${detail}</ul>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderAlert(treatments) {
  const alertBox = document.getElementById('treatmentAlert');
  if (!alertBox) return;

  if (!treatments.length) {
    alertBox.style.display = 'none';
    return;
  }

  const latest = treatments[0];
  const lines = formatLines(latest.prescription);
  const nextLine = lines[0] || 'Traitement à suivre';

  alertBox.style.display = 'flex';
  alertBox.innerHTML = `
    <span class="alert-icon">⚠️</span>
    <div class="alert-content">
      <h4>Rappel Important</h4>
      <p>${nextLine}</p>
    </div>
  `;
}

function renderUnauthorized() {
  const summary = document.getElementById('treatmentSummary');
  if (summary) {
    summary.innerHTML = `<div class="treatment-item"><div class="treatment-info"><h4>Session expirée</h4><p>Veuillez vous reconnecter</p></div></div>`;
  }
  const list = document.getElementById('treatmentList');
  if (list) {
    list.innerHTML = `<div class="medication-card"><div class="medication-header"><div class="medication-name"><div class="medication-icon">🔒</div><div class="medication-info"><h3>Session expirée</h3><p>Reconnectez-vous pour voir vos prescriptions</p></div></div></div></div>`;
  }
}

function setSummaryLoading() {
  const summary = document.getElementById('treatmentSummary');
  if (summary) {
    summary.innerHTML = `<div class="treatment-item"><div class="treatment-icon">⏳</div><div class="treatment-info"><h4>Chargement du traitement...</h4><p>Merci de patienter</p></div></div>`;
  }
}

function setListLoading() {
  const list = document.getElementById('treatmentList');
  if (list) {
    list.innerHTML = `<div class="medication-card"><div class="medication-header"><div class="medication-name"><div class="medication-icon">⏳</div><div class="medication-info"><h3>Chargement des prescriptions...</h3><p>Merci de patienter</p></div></div></div></div>`;
  }
}

function renderSummaryError() {
  const summary = document.getElementById('treatmentSummary');
  if (summary) {
    summary.innerHTML = `<div class="treatment-item"><div class="treatment-icon">⚠️</div><div class="treatment-info"><h4>Erreur de chargement</h4><p>Réessayez plus tard</p></div></div>`;
  }
}

function renderListError() {
  const list = document.getElementById('treatmentList');
  if (list) {
    list.innerHTML = `<div class="medication-card"><div class="medication-header"><div class="medication-name"><div class="medication-icon">⚠️</div><div class="medication-info"><h3>Erreur</h3><p>Impossible de charger vos prescriptions</p></div></div></div></div>`;
  }
}

function formatLines(prescription) {
  if (!prescription) return [];
  return prescription
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}
