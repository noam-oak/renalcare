document.addEventListener('DOMContentLoaded', () => {
  const userId = localStorage.getItem('user_id');
  const token = localStorage.getItem('auth_token');

  window.__resultsUserId = userId;
  window.__resultsToken = token;

  if (!userId || !token) {
    renderNoSession();
    return;
  }

  loadResults(userId, token);
});

let resultsChartInstance = null;
const historicCache = new Map();

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
  const poidsSubtitle = formatPoidsTrend(rows);
  cards.push(makeResultCard('Poids', latest.poids, 'kg', 'info', poidsSubtitle));

  grid.innerHTML = cards.join('');
}

function formatPoidsTrend(rows) {
  if (!rows || rows.length < 2) return 'Suivi quotidien';
  const latest = rows[0];
  const prev = rows[1];
  if (latest?.poids == null || prev?.poids == null) return 'Suivi quotidien';

  const delta = Number(latest.poids) - Number(prev.poids);
  if (!Number.isFinite(delta)) return 'Suivi quotidien';
  if (Math.abs(delta) < 0.1) return 'Poids stable depuis le dernier bilan';

  const sign = delta > 0 ? '+' : '';
  const direction = delta > 0 ? 'En hausse' : 'En baisse';
  return `${direction} de ${sign}${delta.toFixed(1)} kg vs dernier bilan`;
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
          <div class="timeline-actions" style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
            <button class="button button-outline" style="padding:6px 10px;" onclick="viewHistoric(${r.id})">Voir l'interprétation</button>
            <button class="button button-outline" style="padding:6px 10px;" onclick="downloadHistoricPdf(${r.id})">Télécharger le PDF</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function viewHistoric(reponseId) {
  window.location.href = `/html/Patient/questionnaire.html?reponseId=${reponseId}`;
}

async function downloadHistoricPdf(reponseId) {
  try {
    const data = await fetchHistoric(reponseId);
    generateHistoricPdf(data);
  } catch (err) {
    console.error('Historic pdf:', err);
    alert('Impossible de générer le PDF.');
  }
}

async function fetchHistoric(reponseId) {
  if (historicCache.has(reponseId)) return historicCache.get(reponseId);
  const userId = window.__resultsUserId;
  const token = window.__resultsToken;
  if (!userId || !token) throw new Error('Session expirée');

  const resp = await fetch(`/api/patients/${userId}/reponses/${reponseId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error('Chargement impossible');
  const data = await resp.json();
  if (!data.success || !data.reponse) throw new Error(data.error || 'Réponse manquante');
  historicCache.set(reponseId, data.reponse);
  return data.reponse;
}

function renderHistoricDetail(row) {
  const card = document.getElementById('historic-detail-card');
  const content = document.getElementById('historic-detail-content');
  const title = document.getElementById('historic-detail-title');
  if (!card || !content) return;

  const dateText = row.date ? new Date(row.date).toLocaleDateString('fr-FR') : 'Questionnaire';
  if (title) title.textContent = `Questionnaire du ${dateText}`;

  const interpretation = interpretRow(row);
  const rows = buildValueRows(row);

  content.innerHTML = `
    <div class="alert" style="margin-bottom:12px;">
      <strong>Interprétation rapide :</strong> ${interpretation}
    </div>
    <div class="table" style="overflow-x:auto;">
      <table class="data-table" style="width:100%; border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left; padding:8px; border-bottom:1px solid #e5e7eb;">Paramètre</th>
            <th style="text-align:left; padding:8px; border-bottom:1px solid #e5e7eb;">Valeur</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => `<tr><td style="padding:6px 8px; border-bottom:1px solid #f1f5f9;">${r.label}</td><td style="padding:6px 8px; border-bottom:1px solid #f1f5f9;">${r.value}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;

  card.style.display = 'block';
}

function buildValueRows(row) {
  const fmt = (v, unit) => (v === null || v === undefined ? '—' : `${v} ${unit || ''}`.trim());
  return [
    { label: 'Poids', value: fmt(row.poids, 'kg') },
    { label: 'Créatinine', value: fmt(row.creatinine, 'mg/L') },
    { label: 'Tension', value: row.tension_systolique && row.tension_diastolique ? `${row.tension_systolique}/${row.tension_diastolique} mmHg` : '—' },
    { label: 'Température', value: fmt(row.temperature, '°C') },
    { label: 'Glycémie', value: fmt(row.glycemie, 'g/L') },
    { label: 'Hémoglobine', value: fmt(row.hemoglobine, 'g/dL') },
    { label: 'Tacrolimus', value: fmt(row.tacrolimus_ng, 'ng/mL') },
    { label: 'Évérolimus', value: fmt(row.everolimus_ng, 'ng/mL') },
    { label: 'Fréquence cardiaque', value: fmt(row.frequence_cardiaque, 'bpm') },
    { label: 'Fréquence urinaire', value: fmt(row.frequence_urinaire, 'fois/jour') },
  ];
}

function interpretRow(row) {
  const sex = getPatientSex();
  const refs = getRefRangesBySex(sex);
  const num = (v) => (v === null || v === undefined ? null : Number(v));
  const creat = num(row.creatinine);
  const ts = num(row.tension_systolique);
  const td = num(row.tension_diastolique);
  const temp = num(row.temperature);
  const gly = num(row.glycemie);
  const hgb = num(row.hemoglobine);
  const tac = num(row.tacrolimus_ng);
  const eve = num(row.everolimus_ng);
  const fc = num(row.frequence_cardiaque);
  const fu = num(row.frequence_urinaire);
  const chol = num(row.cholesterol);
  const dg = num(row.douleur_greffon);

  const hasAny = [creat, ts, td, temp, gly, hgb, tac, eve, fc, fu, chol, dg].some((v) => v !== null && !Number.isNaN(v));
  if (!hasAny) return 'Données insuffisantes pour interpréter ce bilan.';

  const flags = [];
  if (creat !== null) {
    if (creat > refs.creatinine.max) flags.push('Créatinine élevée (fonction rénale)');
    else if (creat < refs.creatinine.min) flags.push('Créatinine basse (vérifier labo)');
  }

  if (ts !== null) {
    if (ts > refs.ta_sys.max) flags.push('Tension systolique élevée (>140)');
    else if (ts < refs.ta_sys.min) flags.push('Tension systolique basse (<100)');
  }
  if (td !== null) {
    if (td > refs.ta_dia.max) flags.push('Tension diastolique élevée (>90)');
    else if (td < refs.ta_dia.min) flags.push('Tension diastolique basse (<60)');
  }

  if (temp !== null) {
    if (temp > refs.temperature.max) flags.push('Fièvre (>38°C)');
    else if (temp < refs.temperature.min) flags.push('Hypothermie (<36.5°C)');
  }

  if (gly !== null) {
    if (gly >= 1.26) flags.push('Hyperglycémie (≥1.26 g/L)');
    else if (gly < 0.60) flags.push('Hypoglycémie (<0.60 g/L)');
    else if (gly > refs.glycemie.max) flags.push('Glycémie élevée (>1.00 g/L)');
  }

  if (hgb !== null) {
    if (hgb < refs.hemoglobine.min) flags.push('Anémie');
    else if (hgb > refs.hemoglobine.max) flags.push('Hémoglobine élevée (à confirmer)');
  }

  if (fc !== null && (fc < 50 || fc > 100)) flags.push('Fréquence cardiaque anormale');

  if (fu !== null) {
    if (fu < refs.frequence_urinaire.min) {
      flags.push(`Fréquence urinaire basse (${fu} < ${refs.frequence_urinaire.min}/j)`);
    } else if (fu > refs.frequence_urinaire.max) {
      flags.push(`Fréquence urinaire élevée (${fu} > ${refs.frequence_urinaire.max}/j)`);
    }
  }

  if (tac !== null && (tac < refs.tacrolimus.min || tac > refs.tacrolimus.max)) flags.push('Tacrolimus hors cible');
  if (eve !== null && eve > refs.everolimus.max) flags.push('Évérolimus élevé');

  if (chol !== null && chol > refs.cholesterol.maxAlert) flags.push('Hypercholestérolémie (>2.40 g/L)');

  if (dg !== null && dg >= 5) flags.push('Douleur greffon élevée (≥5/10)');

  if (flags.length === 0) return 'Pas d’alerte majeure détectée ; contrôle clinique recommandé.';
  return flags.join(' • ');
}

function getPatientSex() {
  const stored = localStorage.getItem('user_sexe') || localStorage.getItem('user_gender') || localStorage.getItem('gender');
  if (!stored) return 'Homme';
  const val = stored.toLowerCase();
  if (val.startsWith('f')) return 'Femme';
  if (val.startsWith('h') || val.startsWith('m')) return 'Homme';
  return 'Homme';
}

function getRefRangesBySex(sex) {
  const base = {
    creatinine: sex === 'Femme' ? { min: 60, max: 100 } : { min: 80, max: 115 },
    ta_sys: { min: 100, max: 140 },
    ta_dia: { min: 60, max: 90 },
    temperature: { min: 36.5, max: 37.5 },
    glycemie: { min: 0.70, max: 1.00 },
    hemoglobine: sex === 'Femme' ? { min: 12, max: 16 } : { min: 13, max: 17 },
    frequence_urinaire: { min: 4, max: 7 },
    tacrolimus: { min: 3, max: 7 },
    everolimus: { min: 3, max: 8 },
    cholesterol: { max: 2.00, maxAlert: 2.40 },
  };
  return base;
}

function generateHistoricPdf(row) {
  if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('jsPDF manquant');
  const doc = new window.jspdf.jsPDF();
  const margin = 15;

  const dateText = row.date ? new Date(row.date).toLocaleDateString('fr-FR') : 'Questionnaire';

  doc.setFontSize(14);
  doc.text('www.renalcare.fr', 105, margin, { align: 'center' });
  doc.setFontSize(18);
  doc.text('Questionnaire patient', 105, margin + 10, { align: 'center' });
  doc.setFontSize(12);
  doc.text(`Date : ${dateText}`, margin, margin + 20);

  const rows = buildValueRows(row);
  const tableY = margin + 30;
  const rowHeight = 8;
  const tableWidth = 180;
  const headerHeight = 10;
  const totalHeight = headerHeight + rows.length * rowHeight;

  doc.setDrawColor(200);
  doc.rect(margin, tableY, tableWidth, totalHeight);
  doc.line(margin, tableY + headerHeight, margin + tableWidth, tableY + headerHeight);
  doc.line(margin + 100, tableY, margin + 100, tableY + totalHeight);

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('Paramètre', margin + 4, tableY + 7);
  doc.text('Valeur', margin + 104, tableY + 7);
  doc.setFont(undefined, 'normal');

  rows.forEach((r, idx) => {
    const y = tableY + headerHeight + (idx + 1) * rowHeight - 2;
    doc.text(r.label, margin + 4, y);
    doc.text(r.value, margin + 104, y);
    doc.line(margin, tableY + headerHeight + (idx + 1) * rowHeight, margin + tableWidth, tableY + headerHeight + (idx + 1) * rowHeight);
  });

  doc.setFontSize(10);
  doc.text('Interprétation rapide :', margin, tableY + totalHeight + 10);
  doc.text(interpretRow(row), margin, tableY + totalHeight + 18);

  doc.save(`questionnaire-${dateText.replace(/\//g, '-')}.pdf`);
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
