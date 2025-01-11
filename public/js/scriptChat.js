document.addEventListener('DOMContentLoaded', () => {
    // Connexion au serveur Socket.IO avec les cookies de session
    const socket = io({
        withCredentials: true // Permet d'envoyer les cookies avec la connexion
    });

    // Récupérer les éléments du DOM
    const messageInput = document.getElementById('messageInput');
    const envoyerMessage = document.getElementById('envoyerMessage');
    const messagesContainer = document.getElementById('messages-container');

    if (!messageInput || !envoyerMessage || !messagesContainer) {
        console.error("Un ou plusieurs éléments du DOM sont introuvables.");
        return;
    }

    // Gestion de l'envoi de message
    envoyerMessage.addEventListener('click', (event) => {
        event.preventDefault(); // Empêche la soumission du formulaire
        
        const message = messageInput.value.trim();
        if (message) {
            socket.emit('messageChat', message); // Envoie le message au serveur
            messageInput.value = ''; // Réinitialise le champ de saisie
        } else {
            console.warn("Le champ de message est vide.");
        }
    });

    // Réception des messages de la part du serveur
    socket.on('nouveauMessage', (data) => {
        const { content, time, username, avatar } = data;

        // Créer un élément pour afficher le message
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        messageElement.style.display="none"
        messageElement.innerHTML = `
            <img src="${avatar || '/images/default-avatar.png'}" alt="Avatar" class="avatar">
            <div class="content">
                <p class="time">${time}</p>
                <p><strong>${username}:</strong> ${content}</p>
            </div>
        `;
        setTimeout(() => {
            location.reload();  // Recharge la page après 5 
            messageElement.style.display="block"
        }, 1);

        // Ajouter le message au conteneur
        messagesContainer.appendChild(messageElement);
setTimeout(() => {
            location.reload();  // Recharge la page après 5 
            messageElement.style.display="block"
        }, 10);
        // Faire défiler automatiquement vers le bas
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });

    // Gestion des erreurs de connexion
    socket.on('connect_error', (err) => {
        console.error('Erreur de connexion au serveur Socket.IO:', err.message);
    });
});
