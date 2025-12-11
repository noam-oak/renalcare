
// admin-users.js - Gestion des utilisateurs pour le dashboard admin

document.addEventListener('DOMContentLoaded', () => {
    // Charger les utilisateurs si on est sur la page users
    if (document.getElementById('page-users')) {
        loadUsers();
    }

    // Écouter les changements d'onglets pour recharger si nécessaire
    const usersTabBtn = document.querySelector('[onclick="navigateTo(\'users\')"]');
    if (usersTabBtn) {
        usersTabBtn.addEventListener('click', loadUsers);
    }
});

let allUsers = []; // Stockage local pour le filtrage

async function loadUsers() {
    const tbody = document.querySelector('#page-users tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Chargement...</td></tr>';

    try {
        const res = await fetch('/api/admin/users');
        const users = await res.json();
        allUsers = users; // Sauvegarder pour le filtrage
        renderUsers(users);
        updateBadges(users);
    } catch (err) {
        console.error('Erreur chargement utilisateurs:', err);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red">Erreur lors du chargement des utilisateurs.</td></tr>';
    }
}

function renderUsers(users) {
    const tbody = document.querySelector('#page-users tbody');
    tbody.innerHTML = '';

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Aucun utilisateur trouvé.</td></tr>';
        return;
    }

    users.forEach(user => {
        const tr = document.createElement('tr');
        tr.dataset.type = user.role ? user.role.toLowerCase() : 'inconnu';
        tr.dataset.id = user.id;

        const initials = (user.prenom?.[0] || '') + (user.nom?.[0] || '');
        // Date de création non disponible dans la table utilisateur actuelle
        const dateInscription = 'N/A'; 
        const roleDisplay = user.role === 'Medecin' ? 'Médecin' : (user.role === 'Patient' ? 'Patient' : user.role);

        tr.innerHTML = `
            <td>
                <div class="user-cell">
                    <div class="user-avatar-small">${initials}</div>
                    <div class="user-details">
                        <h4>${user.prenom} ${user.nom}</h4>
                        <p>${user.email}</p>
                    </div>
                </div>
            </td>
            <td>${roleDisplay}</td>
            <td>${dateInscription}</td>
            <td><span class="status-badge status-active">Actif</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn-action btn-view" onclick="viewUserDetails(${user.id})">👁️</button>
                    <button class="btn-action btn-edit" onclick="openEditUserModal(${user.id})">✏️</button>
                    <button class="btn-action btn-delete" onclick="deleteUserById(${user.id}, '${user.prenom} ${user.nom}')">🗑️</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updateBadges(users) {
    const total = users.length;
    const patients = users.filter(u => u.role === 'Patient').length;
    const medecins = users.filter(u => u.role === 'Medecin').length;

    document.querySelector('.tab[onclick="filterUsers(\'all\')"] .tab-badge').textContent = total;
    document.querySelector('.tab[onclick="filterUsers(\'patient\')"] .tab-badge').textContent = patients;
    document.querySelector('.tab[onclick="filterUsers(\'medecin\')"] .tab-badge').textContent = medecins;
}

// Fonction de filtrage (remplace celle inline si nécessaire, ou l'utilise)
window.filterUsers = function(type) {
    // Mettre à jour l'UI des onglets
    document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.querySelector(`.tab[onclick="filterUsers('${type}')"]`);
    if (activeTab) activeTab.classList.add('active');

    if (type === 'all') {
        renderUsers(allUsers);
    } else {
        const filtered = allUsers.filter(u => u.role && u.role.toLowerCase() === type.toLowerCase());
        renderUsers(filtered);
    }
};

// Suppression
window.deleteUserById = async function(id, name) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer définitivement le compte de ${name} ?\nCette action supprimera également tout l'historique médical associé.`)) {
        return;
    }

    try {
        const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
        const data = await res.json();

        if (data.success) {
            alert('Utilisateur supprimé avec succès.');
            loadUsers(); // Recharger la liste
        } else {
            alert('Erreur: ' + data.error);
        }
    } catch (err) {
        console.error(err);
        alert('Erreur réseau lors de la suppression.');
    }
};

// Édition
window.openEditUserModal = async function(id) {
    try {
        const res = await fetch(`/api/admin/users/${id}`);
        const data = await res.json();

        if (!data.success) {
            alert('Impossible de charger les données de l\'utilisateur.');
            return;
        }

        const user = data.user;
        
        // Remplir le formulaire du modal d'édition
        document.getElementById('editUserId').value = user.id;
        document.getElementById('editUserNom').value = user.nom;
        document.getElementById('editUserPrenom').value = user.prenom;
        document.getElementById('editUserEmail').value = user.email;
        document.getElementById('editUserTelephone').value = user.telephone || '';
        document.getElementById('editUserRole').value = user.role;
        document.getElementById('editUserSecu').value = user.securite_sociale || '';

        // Afficher le modal
        document.getElementById('editUserModal').classList.add('active');
    } catch (err) {
        console.error(err);
        alert('Erreur lors du chargement des détails.');
    }
};

window.closeEditUserModal = function() {
    document.getElementById('editUserModal').classList.remove('active');
};

// Soumission du formulaire d'édition
window.submitEditUser = async function(event) {
    event.preventDefault();
    
    const id = document.getElementById('editUserId').value;
    const data = {
        nom: document.getElementById('editUserNom').value,
        prenom: document.getElementById('editUserPrenom').value,
        email: document.getElementById('editUserEmail').value,
        telephone: document.getElementById('editUserTelephone').value,
        role: document.getElementById('editUserRole').value,
        securite_sociale: document.getElementById('editUserSecu').value
    };

    try {
        const res = await fetch(`/api/admin/users/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();

        if (result.success) {
            alert('Utilisateur mis à jour avec succès.');
            closeEditUserModal();
            loadUsers();
        } else {
            alert('Erreur: ' + result.error);
        }
    } catch (err) {
        console.error(err);
        alert('Erreur réseau lors de la mise à jour.');
    }
};

// Voir détails
window.viewUserDetails = async function(id) {
    try {
        const res = await fetch(`/api/admin/users/${id}`);
        const data = await res.json();
        
        if (data.success) {
            const u = data.user;
            let info = `Détails de l'utilisateur:\n\n`;
            info += `Nom: ${u.prenom} ${u.nom}\n`;
            info += `Email: ${u.email}\n`;
            info += `Rôle: ${u.role}\n`;
            info += `Téléphone: ${u.telephone || 'N/A'}\n`;
            info += `Sécu: ${u.securite_sociale || 'N/A'}\n`;
            
            if (data.details && data.details.dossier) {
                info += `\n[Dossier Médical]\n`;
                info += `Groupe Sanguin: ${data.details.dossier.groupe_sanguin || 'N/A'}\n`;
            }
            
            alert(info);
        }
    } catch (err) {
        console.error(err);
    }
};
