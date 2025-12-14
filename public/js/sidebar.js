(function () {
  const PARTIALS = {
    patient: '/html/partials/sidebar-patient.html',
    admin: '/html/partials/sidebar-admin.html',
    medecin: '/html/partials/sidebar-medecin.html',
  };

  const normalizePath = (value) => {
    if (!value) return '/';
    try {
      const url = new URL(value, window.location.origin);
      return url.pathname.replace(/\/+$/, '') || '/';
    } catch (_) {
      return value.replace(/\/+$/, '') || '/';
    }
  };

  const setActiveLink = (sidebarElement, activeKey) => {
    if (activeKey) {
      const explicit = sidebarElement.querySelector(`[data-nav="${activeKey}"]`);
      if (explicit) {
        explicit.classList.add('active');
        return;
      }
    }

    const currentPath = normalizePath(window.location.pathname);
    const links = Array.from(sidebarElement.querySelectorAll('.nav-link[href]')).filter(
      (link) => link.getAttribute('href') && link.getAttribute('href') !== '#',
    );

    const match = links.find((link) => normalizePath(link.getAttribute('href')) === currentPath);
    if (match) {
      match.classList.add('active');
    }
  };

  const injectSidebar = async (placeholder) => {
    const type = placeholder.dataset.sidebar;
    const partialPath = PARTIALS[type];

    if (!partialPath) {
      console.warn(`Sidebar type "${type}" non supporté.`);
      return;
    }

    try {
      const response = await fetch(partialPath, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const template = document.createElement('template');
      template.innerHTML = (await response.text()).trim();
      const sidebarElement = template.content.firstElementChild;

      if (!sidebarElement) {
        throw new Error('Template vide');
      }

      setActiveLink(sidebarElement, placeholder.dataset.active);
      placeholder.replaceWith(sidebarElement);

      window.dispatchEvent(
        new CustomEvent('sidebar:loaded', {
          detail: { type, element: sidebarElement },
        }),
      );
    } catch (error) {
      console.error(`Impossible de charger la sidebar "${type}":`, error);
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-sidebar]').forEach((placeholder) => {
      injectSidebar(placeholder);
    });
  });
})();

// Fonction de déconnexion globale pour tous les types d'utilisateurs
window.logout = function() {
  if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
    // Supprimer toutes les données de session
    localStorage.removeItem('token');
    localStorage.removeItem('userType');
    localStorage.removeItem('userId');
    sessionStorage.clear();
    
    // Redirection vers la page d'accueil
    window.location.href = '/';
  }
};
