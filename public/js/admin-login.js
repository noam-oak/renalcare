// Gestion de la connexion admin
document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email')?.value.trim();
  const password = document.getElementById('password')?.value.trim();

  // Validation
  if (!email || !password) {
    alert('⚠️ Email et mot de passe sont obligatoires');
    return;
  }

  if (password.length < 3) {
    alert('⚠️ Le mot de passe doit contenir au moins 3 caractères');
    return;
  }

  // Afficher un loading
  const btn = document.querySelector('.btn-login');
  const originalText = btn.textContent;
  btn.textContent = 'Connexion en cours...';
  btn.disabled = true;

  try {
    const response = await fetch('/api/auth/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
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
    localStorage.setItem('user_role', 'admin');
    localStorage.setItem('user_name', `${data.user.prenom} ${data.user.nom}`);
    
    if (data.user.profile) {
      localStorage.setItem('user_profile', JSON.stringify(data.user.profile));
    }

    // Message de succès
    alert('✅ Connexion réussie ! Redirection en cours...');
    
    // Redirection vers le dashboard admin
    window.location.href = '/admin';
  } catch (error) {
    console.error('Erreur:', error);
    alert('❌ ' + error.message);
  } finally {
    // Réinitialiser le bouton
    btn.textContent = originalText;
    btn.disabled = false;
  }
});
