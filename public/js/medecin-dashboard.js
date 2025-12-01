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
});

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
