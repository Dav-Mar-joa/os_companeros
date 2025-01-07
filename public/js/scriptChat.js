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
        const { content, time, username } = data;

        // Créer un élément pour afficher le message
        const messageElement = document.createElement('div');
        messageElement.classList.add('message'); // Ajout d'une classe CSS
        messageElement.innerHTML = `
            <p class="time">${time}</p>
            <p class="content"><strong>${username}:</strong> ${content}</p>
        `;

        // Ajouter le message au conteneur
        messagesContainer.appendChild(messageElement);

        // Faire défiler automatiquement vers le bas
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });

    // Affichage des informations de session (si nécessaire)
    socket.on('session-info', (session) => {
        console.log('Session reçue du serveur:', session);
    });

    // Gestion des erreurs de connexion
    socket.on('connect_error', (err) => {
        console.error('Erreur de connexion au serveur Socket.IO:', err.message);
    });
});
