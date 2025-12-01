// Gestion de la connexion patient
document.getElementById('patientLoginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const numSecu = document.getElementById('numSecu').value.trim();

  // Validation
  if (!email || !password || !numSecu) {
    alert('⚠️ Email, mot de passe et numéro de sécurité sociale sont obligatoires');
    return;
  }

  if (password.length < 3) {
    alert('⚠️ Le mot de passe doit contenir au moins 3 caractères');
    return;
  }

  if (numSecu.length < 5) {
    alert('⚠️ Le numéro de sécurité sociale semble invalide');
    return;
  }

  // Afficher un loading
  const btn = document.querySelector('.btn-login');
  const originalText = btn.textContent;
  btn.textContent = 'Connexion en cours...';
  btn.disabled = true;

  try {
    const response = await fetch('/api/auth/patient/login', {
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
    localStorage.setItem('auth_token', data.session?.access_token || data.user.id);
    localStorage.setItem('user_id', data.user.id);
    localStorage.setItem('user_email', data.user.email);
    localStorage.setItem('user_role', data.user.role);
    localStorage.setItem('user_name', `${data.user.prenom} ${data.user.nom}`);
    
    if (data.user.profile) {
      localStorage.setItem('user_profile', JSON.stringify(data.user.profile));
    }

    // Message de succès
    alert('✅ Connexion réussie ! Redirection en cours...');
    
    // Redirection vers le dashboard
    window.location.href = '/patient/dashboard';
  } catch (error) {
    console.error('Erreur:', error);
    alert('❌ ' + error.message);
  } finally {
    // Réinitialiser le bouton
    btn.textContent = originalText;
    btn.disabled = false;
  }
});

