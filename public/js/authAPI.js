// API Helper pour communiquer avec le backend
const API_BASE_URL = '/api';

// Classes pour les requêtes API
class AuthAPI {
    static async patientLogin(email, password) {
        return this._post('/auth/patient/login', { email, password });
    }

    static async patientSignup(email, password, nom, prenom) {
        return this._post('/auth/patient/signup', { email, password, nom, prenom });
    }

    static async medecinLogin(email, password) {
        return this._post('/auth/medecin/login', { email, password });
    }

    static async medecinSignup(email, password, nom, prenom, specialite) {
        return this._post('/auth/medecin/signup', { email, password, nom, prenom, specialite });
    }

    static async adminLogin(email, password) {
        return this._post('/auth/admin/login', { email, password });
    }

    static async logout() {
        return this._post('/auth/logout', {});
    }

    static async getCurrentUser() {
        return this._get('/auth/current-user');
    }

    static async _get(endpoint) {
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`);
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    }

    static async _post(endpoint, data) {
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    }
}

// Exemple d'utilisation
async function handlePatientLogin(email, password) {
    const result = await AuthAPI.patientLogin(email, password);
    if (result.success) {
        console.log('Patient connecté:', result.patient);
        // Rediriger vers le dashboard
        window.location.href = '/patient/dashboard';
    } else {
        console.error('Erreur de connexion:', result.message);
        alert('Identifiants incorrects');
    }
}

async function handlePatientSignup(email, password, nom, prenom) {
    const result = await AuthAPI.patientSignup(email, password, nom, prenom);
    if (result.success) {
        console.log('Patient inscrit:', result.user);
        alert('Inscription réussie! Veuillez vous connecter.');
        window.location.href = '/patient/login';
    } else {
        console.error('Erreur d\'inscription:', result.message);
        alert('Erreur d\'inscription: ' + result.message);
    }
}

async function handleLogout() {
    const result = await AuthAPI.logout();
    if (result.success) {
        window.location.href = '/';
    } else {
        console.error('Erreur de déconnexion:', result.message);
    }
}

// Vérifier si l'utilisateur est connecté
async function checkAuth() {
    const result = await AuthAPI.getCurrentUser();
    if (result.success) {
        console.log('Utilisateur connecté:', result.user);
        return result.user;
    } else {
        console.log('Non connecté');
        return null;
    }
}

// Au chargement, vérifier l'authentification
document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    if (user) {
        // L'utilisateur est connecté
        console.log('Connecté en tant que:', user.email);
    }
});
