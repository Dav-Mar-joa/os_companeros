// // Recevoir et afficher les messages de chat
// const socket = io();
// socket.on('nouveauMessage', (message) => {
//     const messagesContainer = document.getElementById('messages-container');
//     const messageElement = document.createElement('p');
//     messageElement.textContent = message; // Afficher le message avec l'auteur
//     messagesContainer.appendChild(messageElement);
//     messagesContainer.scrollTop = messagesContainer.scrollHeight;  // Faire défiler vers le bas pour voir le dernier message
// });

// const socket = io();

// document.getElementById('envoyerMessage').addEventListener('click', () => {
//     const messageInput = document.getElementById('messageInput');
//     const message = messageInput.value.trim();
//     const username = 'VotreNom'; // Remplacez par un vrai nom d'utilisateur

//     if (message) {
//         socket.emit('messageChat', message, username);
//         messageInput.value = ''; // Effacez l'input après l'envoi
//     }
// });

// Connexion au serveur Socket.IO
// const socket = io();

// // Récupérer les éléments du DOM
// const messageInput = document.getElementById('messageInput');
// console.log("message input : ",messageInput)
// const envoyerMessage = document.getElementById('envoyerMessage');
// console.log("message envoyer : ",envoyerMessage)
// const messagesContainer = document.getElementById('messages-container');


// // Gérer l'envoi de message
// envoyerMessage.addEventListener('click', (event) => {
//     event.preventDefault(); // Empêche la soumission du formulaire
//     console.log("Le bouton a été cliqué !");
//     const message = messageInput.value.trim();
//     console.log("message ",message)
//     if (message) {
//         // Remplacez "username" par la variable contenant le nom d'utilisateur
//         const username = 'Utilisateur'; // Vous pouvez la récupérer dynamiquement selon votre application
//         socket.emit('messageChat', message, username); // Envoyer le message au serveur
//         messageInput.value = ''; // Réinitialise le champ de saisie
//     }
// });

// // Recevoir et afficher les nouveaux messages
// socket.on('nouveauMessage', (message) => {
//     const messageElement = document.createElement('div');
//     messageElement.textContent = message;
//     messagesContainer.appendChild(messageElement); // Ajoute le message au conteneur
//     messagesContainer.scrollTop = messagesContainer.scrollHeight; // Défilement vers le bas
// });

document.addEventListener('DOMContentLoaded', () => {
    // const socket = io();
    const socket = io('http://localhost:4000', {
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
    // // Recevoir et afficher les nouveaux messages
    // socket.on('nouveauMessage', (message) => {
    //     const messageElement = document.createElement('div');
    //     messageElement.textContent = message;
    //     messagesContainer.appendChild(messageElement); // Ajoute le message au conteneur
    //     messagesContainer.scrollTop = messagesContainer.scrollHeight; // Défilement vers le bas
    // });
    // socket.on('nouveauMessage', (data) => {
    //     // `data` contient le message, l'heure et le nom d'utilisateur
    //     const { content, time, username,avatar } = data;
    
    //     // Créer un élément pour afficher le message
    //     const messageElement = document.createElement('div');
    //     messageElement.innerHTML = `${time} <strong>${username}</strong> --> ${content} ${avatar}`;
    
    //     // Ajouter le message au conteneur
    //     messagesContainer.appendChild(messageElement);
    
    //     // Faire défiler vers le bas
    //     messagesContainer.scrollTop = messagesContainer.scrollHeight;
    // });
    socket.on('nouveauMessage', (data) => {
    // `data` contient le message, l'heure, le nom d'utilisateur et l'avatar
    const { content, time, username, avatar } = data;

    // Créer un élément conteneur pour le message
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');

    // Ajouter l'avatar
    const avatarElement = document.createElement('img');
    avatarElement.src = avatar || 'default-avatar.png'; // Utilisez une image par défaut si l'avatar est manquant
    avatarElement.alt = `${username}'s avatar`;
    avatarElement.classList.add('avatarChat');

    // Ajouter le contenu du message
    const contentElement = document.createElement('p');
    contentElement.innerHTML = `${time} <strong>${username}</strong> --> ${content}`;

    // Ajouter l'avatar et le contenu au conteneur du message
    messageElement.appendChild(avatarElement);
    messageElement.appendChild(contentElement);

    // Ajouter le message au conteneur principal
    messagesContainer.appendChild(messageElement);

    // Faire défiler vers le bas
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});
    
});



