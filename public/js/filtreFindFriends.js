document.addEventListener('DOMContentLoaded', () => {
    const filterInput = document.getElementById('filterInput');
    const userElements = document.querySelectorAll('.ajoutCommentaire');
  
    // Écoute les changements dans l'input
    filterInput.addEventListener('input', (e) => {
      const filterValue = e.target.value.toLowerCase();
  
      userElements.forEach(userElement => {
        const username = userElement.dataset.username.toLowerCase();
        if (username.startsWith(filterValue)) {
          userElement.style.display = ''; // Affiche l'utilisateur
        } else {
          userElement.style.display = 'none'; // Masque l'utilisateur
        }
      });
    });
  });
  