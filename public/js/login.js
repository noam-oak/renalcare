// Gestion de la connexion unifiée avec redirection automatique
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const numSecu = document.getElementById('numSecu').value.trim();
  const errorDiv = document.getElementById('errorMessage');

  // Validation
  if (!email || !password || !numSecu) {
    showError('Email, mot de passe et numéro de sécurité sociale sont obligatoires');
    return;
  }

  if (password.length < 3) {
    showError('Le mot de passe doit contenir au moins 3 caractères');
    return;
  }

  if (numSecu.length < 5) {
    showError('Le numéro de sécurité sociale semble invalide');
    return;
  }

  // Afficher un loading
  const btn = document.querySelector('.btn-login');
  const originalText = btn.textContent;
  btn.textContent = 'Connexion en cours...';
  btn.disabled = true;
  errorDiv.classList.remove('show');

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        securite_sociale: numSecu ? parseInt(numSecu) : null,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erreur de connexion');
    }

    // Sauvegarder les données d'authentification
    localStorage.setItem('auth_token', data.user.id);
    localStorage.setItem('user_id', data.user.id);
    localStorage.setItem('user_email', data.user.email);
    localStorage.setItem('user_role', data.user.role);
    localStorage.setItem('user_name', `${data.user.prenom} ${data.user.nom}`);
    
    if (data.user.profile) {
      localStorage.setItem('user_profile', JSON.stringify(data.user.profile));
    }

    // Redirection basée sur le rôle
    const role = data.user.role;
    let redirectUrl = '/';

    if (role === 'patient') {
      redirectUrl = '/patient/dashboard';
    } else if (role === 'medecin') {
      redirectUrl = '/medecin/dashboard';
    } else if (role === 'admin') {
      redirectUrl = '/admin';
    }

    // Message de succès et redirection
    showSuccess(`✅ Connexion réussie ! Redirection vers votre espace ${role}...`);
    
    setTimeout(() => {
      window.location.href = redirectUrl;
    }, 1500);

  } catch (error) {
    console.error('Erreur:', error);
    //showError(error.message);
  } finally {
    // Réinitialiser le bouton
    btn.textContent = originalText;
    btn.disabled = false;
  }
});

function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  errorDiv.textContent = message;
  errorDiv.classList.add('show');
}

function showSuccess(message) {
  const errorDiv = document.getElementById('errorMessage');
  errorDiv.textContent = message;
  errorDiv.style.background = '#efe';
  errorDiv.style.borderColor = '#8f8';
  errorDiv.style.color = '#080';
  errorDiv.classList.add('show');
}
