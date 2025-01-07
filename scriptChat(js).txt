

document.addEventListener('DOMContentLoaded', () => {
    // const socket = io();
    const socket = io( {
        withCredentials: true // Permet d'envoyer les cookies avec la connexion
    });

    // Récupérer les éléments du DOM
    const messageInput = document.getElementById('messageInput');
    console.log("message input : ", messageInput);
    
    const envoyerMessage = document.getElementById('envoyerMessage');
    console.log("message envoyer : ", envoyerMessage);
    
    const messagesContainer = document.getElementById('messages-container');

    if (!messageInput || !envoyerMessage || !messagesContainer) {
        console.error("Un ou plusieurs éléments du DOM sont introuvables.");
        return;
    }

    // Gérer l'envoi de message
    envoyerMessage.addEventListener('click', (event) => {
        event.preventDefault(); // Empêche la soumission du formulaire
        console.log("Le bouton a été cliqué !");
        
        const message = messageInput.value.trim();
        console.log("message", message);
        
        if (message) {
            const username = 'Utilisateur'; // Vous pouvez la récupérer dynamiquement selon votre application
            

            socket.emit('messageChat', message, username); // Envoyer le message au serveur
            messageInput.value = ''; // Réinitialise le champ de saisie
        }
    });
    socket.on('session-info', (session) => {
        console.log('Session reçue du serveur:', session);
      });

    socket.on('nouveauMessage', (data) => {
        // `data` contient le message, l'heure et le nom d'utilisateur
        const { content, time, username } = data;
    
        // Créer un élément pour afficher le message
        const messageElement = document.createElement('div');
        messageElement.innerHTML = `${time} <strong>${username}</strong> --> ${content}`;
    
        // Ajouter le message au conteneur
        messagesContainer.appendChild(messageElement);
    
        // Faire défiler vers le bas
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
});



