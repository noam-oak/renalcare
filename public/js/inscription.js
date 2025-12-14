// =========================================================
// INSCRIPTION.JS ADAPTÉ À VOS FICHIERS HTML
// =========================================================
// À remplacer le ancien inscription.js
// Fonctionne avec vos fichiers patient-inscription.html et medecin-inscription.html

const ROLE = document.body.dataset.role; // 'patient' ou 'medecin'

// --- Helpers d'étapes ---
function goToStep(stepNumber) {
  // Fonctionne avec data-step OU data-section
  document.querySelectorAll('[data-step], [data-section]').forEach(step => {
    const stepNum = step.dataset.step || step.dataset.section;
    if (stepNum === String(stepNumber)) {
      step.classList.add('active');
    } else {
      step.classList.remove('active');
    }
  });

  // Mettre à jour les indicateurs de progrès
  document.querySelectorAll('.progress-step').forEach(step => {
    const num = parseInt(step.dataset.step);
    step.classList.remove('active', 'completed');
    if (num === stepNumber) {
      step.classList.add('active');
    } else if (num < stepNumber) {
      step.classList.add('completed');
    }
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function getOtpFromInputs() {
  // Fonctionne avec class="otp-input" OU class="code-input"
  const inputs = document.querySelectorAll('.otp-input, .code-input');
  return Array.from(inputs).map(i => i.value.trim()).join('');
}

// On stocke les données saisies progressivement
const registrationData = {
  role: ROLE,
};

// --- ÉTAPE 1: Infos de base + envoi du code ---
const step1Form = document.getElementById('step1-form') || document.getElementById('inscriptionForm');

if (step1Form) {
  // Écouter le bouton "Suivant" si c'est un bouton onclick
  const nextBtn = document.querySelector('[onclick*="nextStep"]');
  if (nextBtn && !step1Form.id.includes('step')) {
    // Créer un événement pour capturer les données
    nextBtn.addEventListener('click', async (e) => {
      // Récupérer les données de l'étape 1
      const nom = document.querySelector('input[name="nom"]')?.value?.trim();
      const prenom = document.querySelector('input[name="prenom"]')?.value?.trim();
      const email = document.querySelector('input[name="email"]')?.value?.trim();
      const telephone = document.querySelector('input[name="telephone"]')?.value?.trim();
      const date_greffe = document.querySelector('input[name="date_greffe"]')?.value;
      const num_secu = document.querySelector('input[name="num_secu"]')?.value?.trim();

      if (!nom || !prenom || !email) {
        alert('Merci de remplir nom, prénom et email.');
        return;
      }

      // Sauvegarder les données
      registrationData.nom = nom;
      registrationData.prenom = prenom;
      registrationData.email = email;
      registrationData.telephone = telephone;
      registrationData.date_greffe = date_greffe;
      registrationData.num_secu = num_secu;

      try {
        const res = await fetch('/api/register/send-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, role: ROLE }),
        });
        const data = await res.json();

        if (!data.success) {
          alert(data.error || "Erreur lors de l'envoi du code.");
          return;
        }

        alert('Un code de vérification vient de vous être envoyé par email.');
        goToStep(2);
      } catch (err) {
        console.error(err);
        alert("Erreur réseau lors de l'envoi du code.");
      }
    });
  } else {
    // Sinon, gérer comme un vrai formulaire
    step1Form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const nom = document.querySelector('input[name="nom"]')?.value?.trim();
      const prenom = document.querySelector('input[name="prenom"]')?.value?.trim();
      const email = document.querySelector('input[name="email"]')?.value?.trim();

      if (!nom || !prenom || !email) {
        alert('Merci de remplir nom, prénom et email.');
        return;
      }

      registrationData.nom = nom;
      registrationData.prenom = prenom;
      registrationData.email = email;

      try {
        const res = await fetch('/api/register/send-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, role: ROLE }),
        });
        const data = await res.json();

        if (!data.success) {
          alert(data.error || "Erreur lors de l'envoi du code.");
          return;
        }

        alert('Un code de vérification vient de vous être envoyé par email.');
        goToStep(2);
      } catch (err) {
        console.error(err);
        alert("Erreur réseau lors de l'envoi du code.");
      }
    });
  }
}

// --- ÉTAPE 2: Saisie du code OTP ---
const verifyCodeBtn = document.getElementById('verify-code-btn');
if (verifyCodeBtn) {
  verifyCodeBtn.addEventListener('click', async () => {
    const code = getOtpFromInputs();
    if (code.length !== 6) {
      alert('Merci de saisir les 6 chiffres du code.');
      return;
    }

    try {
      const res = await fetch('/api/register/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registrationData.email, code }),
      });
      const data = await res.json();

      if (!data.success) {
        alert(data.error || 'Code incorrect.');
        return;
      }

      alert('Email vérifié avec succès.');
      goToStep(3);
    } catch (err) {
      console.error(err);
      alert("Erreur réseau lors de la vérification du code.");
    }
  });
}

// --- ÉTAPE 3: Mot de passe ---
const step3Form = document.getElementById('step3-form');
if (step3Form) {
  // Gestion du bouton "Suivant" pour mot de passe
  const validatePasswordBtn = document.getElementById('btnNextPassword');
  
  if (validatePasswordBtn) {
    validatePasswordBtn.addEventListener('click', (e) => {
      const password = document.querySelector('input[name="password"]')?.value;
      const confirm = document.querySelector('input[name="password_confirm"]')?.value;

      if (!password || password.length < 8) {
        alert('Le mot de passe doit contenir au moins 8 caractères.');
        return;
      }
      if (password !== confirm) {
        alert('Les mots de passe ne correspondent pas.');
        return;
      }

      registrationData.password = password;
      goToStep(4);
    });
  }

  // Gestion de la soumission du formulaire
  step3Form.addEventListener('submit', (e) => {
    e.preventDefault();
    const password = document.querySelector('input[name="password"]')?.value;
    const confirm = document.querySelector('input[name="password_confirm"]')?.value;

    if (!password || password.length < 8) {
      alert('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== confirm) {
      alert('Les mots de passe ne correspondent pas.');
      return;
    }

    registrationData.password = password;
    goToStep(4);
  });
}

// --- ÉTAPE 4: Profil + envoi final ---
const step4Form = document.getElementById('step4-form');
if (step4Form) {
  step4Form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Récupérer les champs optionnels/additionnels
    const maladie = document.querySelector('input[name="maladie"]')?.value || null;
    const groupe_sanguin = document.querySelector('select[name="groupe_sanguin"]')?.value || null;
    const poids = document.querySelector('input[name="poids"]')?.value || null;
    const allergie = document.querySelector('textarea[name="allergie"]')?.value || null;
    const adresse = document.querySelector('textarea[name="adresse"]')?.value || null;

    // Compléter registrationData
    Object.assign(registrationData, {
      maladie,
      groupe_sanguin,
      poids,
      allergie,
      adresse,
    });

    try {
      const res = await fetch('/api/register/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registrationData),
      });
      const data = await res.json();

      if (!data.success) {
        alert(data.error || 'Erreur lors de la création du compte.');
        return;
      }

      alert('Votre compte a été créé avec succès. Vous pouvez maintenant vous connecter.');
      goToStep(5); // Afficher la page de succès si elle existe
      
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } catch (err) {
      console.error(err);
      alert('Erreur réseau lors de la création du compte.');
    }
  });
}

// === FONCTIONS UTILITAIRES (déjà dans votre HTML, mais à garder) ===

// Navigation entre étapes
function nextStep() {
  const currentSection = document.querySelector('[data-section].active, [data-step].active');
  if (currentSection) {
    const currentNum = parseInt(currentSection.dataset.step || currentSection.dataset.section);
    goToStep(currentNum + 1);
  }
}

function prevStep() {
  const currentSection = document.querySelector('[data-section].active, [data-step].active');
  if (currentSection) {
    const currentNum = parseInt(currentSection.dataset.step || currentSection.dataset.section);
    if (currentNum > 1) {
      goToStep(currentNum - 1);
    }
  }
}

// Gestion auto-avance des inputs OTP
document.addEventListener('DOMContentLoaded', () => {
  const otpInputs = document.querySelectorAll('.otp-input, .code-input');
  otpInputs.forEach((input, index) => {
    input.addEventListener('input', function(e) {
      if (e.target.value.length === 1 && index < otpInputs.length - 1) {
        otpInputs[index + 1].focus();
      }
    });

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
        otpInputs[index - 1].focus();
      }
    });
  });
});

console.log('✅ inscription.js chargé pour role:', ROLE);