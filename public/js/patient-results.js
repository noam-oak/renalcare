document.addEventListener('DOMContentLoaded', () => {
  const userId = localStorage.getItem('user_id');
  const token = localStorage.getItem('auth_token');

  if (!userId || !token) {
    renderNoSession();
    return;
  }

  loadResults(userId, token);
});

let resultsChartInstance = null;

async function loadResults(userId, token) {
  try {
    const resp = await fetch(`/api/patients/${userId}/resultats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!resp.ok) throw new Error('Réponse serveur invalide');
    const data = await resp.json();
    if (!data.success) throw new Error(data.error || 'Erreur de chargement');

    const rows = data.resultats || [];
    logHistory(rows);
    renderAlert(rows);
    renderLatest(rows);
    renderTimeline(rows);
    renderChart(rows);
  } catch (err) {
    console.error('Mes résultats:', err);
    renderError(err.message);
  }
}

function logHistory(rows) {
  if (!rows || !rows.length) return;
  console.table(rows.map((r) => ({
    date: r.date,
    poids: r.poids,
    creatinine: r.creatinine,
    tension: r.tension_systolique && r.tension_diastolique ? `${r.tension_systolique}/${r.tension_diastolique}` : null,
    temperature: r.temperature,
    glycemie: r.glycemie,
    hemoglobine: r.hemoglobine,
    tacrolimus_ng: r.tacrolimus_ng,
    everolimus_ng: r.everolimus_ng,
  })));
}

function renderAlert(rows) {
  const alertBox = document.getElementById('results-alert');
  if (!alertBox) return;

  if (!rows.length) {
    alertBox.style.display = 'none';
    return;
  }

  const latest = rows[0];
  const creat = latest.creatinine;
  if (creat && creat > 120) {
    alertBox.style.display = 'flex';
    alertBox.innerHTML = `
      <span class="alert-icon">🔴</span>
      <div class="alert-text">
        <h3>Attention : Créatinine élevée</h3>
        <p>Dernière valeur: ${creat} mg/L. Votre équipe a été informée.</p>
      </div>`;
  } else if (creat) {
    alertBox.style.display = 'flex';
    alertBox.innerHTML = `
      <span class="alert-icon">🟢</span>
      <div class="alert-text">
        <h3>Créatinine dans la cible</h3>
        <p>Dernière valeur: ${creat} mg/L.</p>
      </div>`;
  } else {
    alertBox.style.display = 'none';
  }
}

function renderLatest(rows) {
  const grid = document.getElementById('results-grid');
  const title = document.getElementById('last-result-title');
  if (!grid) return;

  if (!rows.length) {
    if (title) title.textContent = 'Aucun bilan disponible';
    grid.innerHTML = `<div class="result-card"><div class="result-header"><div class="result-title"><h3>Aucune donnée</h3><p>En attente d'analyses</p></div><span class="result-status">—</span></div><div class="result-value"><span class="value-number">—</span></div></div>`;
    return;
  }

  const latest = rows[0];
  const dateText = latest.date ? new Date(latest.date).toLocaleDateString('fr-FR') : '';
  if (title) title.textContent = dateText ? `Dernier bilan - ${dateText}` : 'Dernier bilan';

  const cards = [];
  cards.push(makeResultCard('Créatinine', latest.creatinine, 'mg/L', assessCreatinine(latest.creatinine), 'Fonction rénale'));
  cards.push(makeResultCard('Tension', formatTension(latest), 'mmHg', assessTension(latest), 'Pression artérielle'));
  cards.push(makeResultCard('Température', latest.temperature, '°C', assessTemperature(latest.temperature), 'Surveillance infection'));
  cards.push(makeResultCard('Poids', latest.poids, 'kg', 'info', 'Suivi quotidien'));

  grid.innerHTML = cards.join('');
}

function renderTimeline(rows) {
  const timeline = document.getElementById('results-timeline');
  if (!timeline) return;

  if (!rows.length) {
    timeline.innerHTML = `<div class="timeline-item"><div class="timeline-dot"></div><div class="timeline-date">—</div><div class="timeline-content"><h4>Aucune entrée</h4><p>En attente d'un premier bilan</p></div></div>`;
    return;
  }

  timeline.innerHTML = rows.map((r) => {
    const dateText = r.date ? new Date(r.date).toLocaleDateString('fr-FR') : 'Bilan';
    const summary = [
      r.creatinine ? `Créatinine: ${r.creatinine} mg/L` : null,
      r.tension_systolique && r.tension_diastolique ? `TA: ${r.tension_systolique}/${r.tension_diastolique} mmHg` : null,
      r.poids ? `Poids: ${r.poids} kg` : null,
    ].filter(Boolean).join(' • ');
    return `
      <div class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="timeline-date">${dateText}</div>
        <div class="timeline-content">
          <h4>Bilan</h4>
          <p>${summary || 'Détails non fournis'}</p>
        </div>
      </div>
    `;
  }).join('');
}

function renderChart(rows) {
  const canvas = document.getElementById('results-chart');
  const empty = document.getElementById('results-chart-empty');
  if (!canvas || typeof Chart === 'undefined') {
    return;
  }

  if (!rows.length) {
    canvas.style.display = 'none';
    if (empty) empty.style.display = 'block';
    return;
  }

  canvas.style.display = 'block';
  if (empty) empty.style.display = 'none';

  const sorted = [...rows].sort((a, b) => new Date(a.date || a.created_at || 0) - new Date(b.date || b.created_at || 0));
  const labels = sorted.map((r) => (r.date ? new Date(r.date).toLocaleDateString('fr-FR') : `#${r.id}`));

  const series = [
    { key: 'creatinine', label: 'Créatinine (mg/L)', color: '#ef4444' },
    { key: 'poids', label: 'Poids (kg)', color: '#3b82f6' },
    { key: 'tension_systolique', label: 'Tension systolique (mmHg)', color: '#f59e0b' },
    { key: 'temperature', label: 'Température (°C)', color: '#10b981' },
    { key: 'glycemie', label: 'Glycémie (g/L)', color: '#6366f1' },
  ];

  const datasets = series.map((serie) => ({
    label: serie.label,
    data: sorted.map((r) => (r[serie.key] === null || r[serie.key] === undefined ? null : Number(r[serie.key]))),
    borderColor: serie.color,
    backgroundColor: serie.color,
    spanGaps: true,
    pointRadius: 4,
    pointHoverRadius: 6,
    tension: 0.25,
  })).filter((d) => d.data.some((v) => v !== null && !Number.isNaN(v)));

  if (datasets.length === 0) {
    canvas.style.display = 'none';
    if (empty) empty.style.display = 'block';
    return;
  }

  const ctx = canvas.getContext('2d');
  if (resultsChartInstance) {
    resultsChartInstance.destroy();
  }

  resultsChartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      scales: {
        x: {
          ticks: { maxRotation: 45, minRotation: 0 },
        },
        y: {
          title: { display: true, text: 'Valeurs' },
        },
      },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.formattedValue}`,
          },
        },
      },
    },
  });
}

function renderError(message) {
  const grid = document.getElementById('results-grid');
  const timeline = document.getElementById('results-timeline');
  if (grid) grid.innerHTML = `<div class="result-card"><div class="result-header"><div class="result-title"><h3>Erreur</h3><p>${message}</p></div><span class="result-status status-danger">!</span></div></div>`;
  if (timeline) timeline.innerHTML = `<div class="timeline-item"><div class="timeline-dot"></div><div class="timeline-date">Erreur</div><div class="timeline-content"><h4>Chargement impossible</h4><p>${message}</p></div></div>`;
}

function renderNoSession() {
  renderError('Session expirée, reconnectez-vous.');
}

function makeResultCard(label, value, unit, status, subtitle) {
  const { cls, badge } = statusToClasses(status);
  const val = value !== null && value !== undefined ? value : '—';
  return `
    <div class="result-card ${cls}">
      <div class="result-header">
        <div class="result-title">
          <h3>${label}</h3>
          <p>${subtitle || ''}</p>
        </div>
        <span class="result-status ${badge}">${statusLabel(status)}</span>
      </div>
      <div class="result-value">
        <span class="value-number">${val}</span>
        <span class="value-unit">${val === '—' ? '' : unit}</span>
      </div>
    </div>
  `;
}

function statusToClasses(status) {
  switch (status) {
    case 'danger':
      return { cls: 'danger', badge: 'status-danger' };
    case 'warning':
      return { cls: 'warning', badge: 'status-warning' };
    case 'success':
      return { cls: 'success', badge: 'status-success' };
    default:
      return { cls: '', badge: '' };
  }
}

function statusLabel(status) {
  switch (status) {
    case 'danger': return 'Élevé';
    case 'warning': return 'À surveiller';
    case 'success': return 'Normal';
    default: return '—';
  }
}

function assessCreatinine(value) {
  if (!value && value !== 0) return 'info';
  if (value > 120) return 'danger';
  if (value >= 100) return 'warning';
  return 'success';
}

function assessTension(row) {
  if (!row || !row.tension_systolique || !row.tension_diastolique) return 'info';
  if (row.tension_systolique > 160 || row.tension_diastolique > 100) return 'danger';
  if (row.tension_systolique > 140 || row.tension_diastolique > 90) return 'warning';
  return 'success';
}

function assessTemperature(value) {
  if (!value && value !== 0) return 'info';
  if (value >= 38) return 'danger';
  if (value >= 37.5) return 'warning';
  return 'success';
}

function formatTension(row) {
  if (!row || !row.tension_systolique || !row.tension_diastolique) return '—';
  return `${row.tension_systolique}/${row.tension_diastolique}`;
}
