
// admin-overview.js - Gestion de la vue d'ensemble pour le dashboard admin

document.addEventListener('DOMContentLoaded', () => {
    // Charger les stats si on est sur la page overview
    if (document.getElementById('page-overview')) {
        loadStats();
    }

    // Empêcher l'accès sans session admin
        // Empêcher l'accès sans session admin et bloquer le retour arrière
        enforceAdminSession();
        preventBackNavigation('admin');

    // Écouter les changements d'onglets pour recharger si nécessaire
    const overviewTabBtn = document.querySelector('[onclick="navigateTo(\'overview\')"]');
    if (overviewTabBtn) {
        overviewTabBtn.addEventListener('click', loadStats);
    }

    // Précharger les logs si on est déjà sur l'onglet logs (rare)
    const logsPage = document.getElementById('page-logs');
    if (logsPage && logsPage.classList.contains('active')) {
        loadLogs();
    }
});

async function loadStats() {
    try {
        const res = await fetch('/api/admin/stats');
        const data = await res.json();

        if (data.success) {
            updateStatDisplay(data.stats);
        }
    } catch (err) {
        console.error('Erreur chargement stats:', err);
    }
}

// Vérifie la session admin, sinon redirige vers l'accueil
function enforceAdminSession() {
    const role = localStorage.getItem('user_role');
    const name = localStorage.getItem('user_name');
    if (!name || role !== 'admin') {
        window.location.replace('/');
    }
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

function updateStatDisplay(stats) {
    // Mise à jour des compteurs avec animation
    animateValue('stat-total', stats.total);
    animateValue('stat-patients', stats.patients);
    animateValue('stat-medecins', stats.medecins);
    animateValue('stat-pending', stats.pending);
    
    // Mise à jour du bouton d'accès rapide
    const pendingBtn = document.getElementById('btn-quick-pending');
    if (pendingBtn) {
        pendingBtn.textContent = `⏳ Valider les comptes (${stats.pending})`;
    }

    updateActivityList(stats.recentActivity);
}

function updateActivityList(activities) {
    const container = document.getElementById('activity-list');
    if (!container) return;

    if (!activities || activities.length === 0) {
        container.innerHTML = `
            <div class="activity-item">
                <div class="activity-content">
                    <div class="activity-details">Aucune activité récente</div>
                </div>
            </div>`;
        return;
    }

    container.innerHTML = activities.map(req => `
        <div class="activity-item">
            <div class="activity-icon">👤</div>
            <div class="activity-content">
                <div class="activity-title">Nouvelle demande d'inscription</div>
                <div class="activity-details">${req.type === 'medecin' ? 'Médecin' : 'Patient'}: ${req.prenom} ${req.nom}</div>
                <div class="activity-time">En attente</div>
            </div>
        </div>
    `).join('');
}

// Chargement des logs applicatifs
async function loadLogs() {
    const list = document.getElementById('logs-list');
    if (!list) return;

    list.innerHTML = `<div class="log-item"><span class="log-time">Chargement...</span><span class="log-level info">INFO</span><span>Lecture des logs</span></div>`;

    try {
        const res = await fetch('/api/admin/logs');
        const data = await res.json();

        if (!data.success) {
            throw new Error(data.error || 'Erreur de lecture des logs');
        }

        const logs = data.logs || [];
        if (!logs.length) {
            list.innerHTML = `<div class="log-item"><span class="log-time">—</span><span class="log-level info">INFO</span><span>Aucun log disponible</span></div>`;
            return;
        }

        list.innerHTML = logs.map((entry) => formatLogItem(entry.line)).join('');
    } catch (err) {
        console.error('Logs admin:', err);
        list.innerHTML = `<div class="log-item"><span class="log-time">Erreur</span><span class="log-level error">ERROR</span><span>${err.message}</span></div>`;
    }
}

function formatLogItem(line) {
    // Tentative de parsing rudimentaire [timestamp] LEVEL message
    const match = line.match(/^(\[[^\]]+\])?\s*(INFO|ERROR|WARN|WARNING|DEBUG)?\s*-?\s*(.*)$/i);
    const time = match && match[1] ? match[1] : '';
    const levelRaw = match && match[2] ? match[2].toUpperCase() : '';
    const message = match ? match[3] : line;

    const levelClass = levelRaw === 'ERROR' ? 'error'
        : (levelRaw === 'WARN' || levelRaw === 'WARNING') ? 'warning'
        : 'info';

    const levelLabel = levelRaw || 'INFO';
    const timeLabel = time || '[log]';

    return `<div class="log-item"><span class="log-time">${timeLabel}</span><span class="log-level ${levelClass}">${levelLabel}</span><span>${escapeHtml(message)}</span></div>`;
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function animateValue(id, end) {
    const obj = document.getElementById(id);
    if (!obj) return;
    
    const start = parseInt(obj.textContent) || 0;
    if (start === end) return;

    const duration = 1000;
    const range = end - start;
    let startTime = null;

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        obj.textContent = Math.floor(progress * range + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    }
    window.requestAnimationFrame(step);
}
