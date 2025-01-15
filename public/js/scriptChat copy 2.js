document.addEventListener('DOMContentLoaded', () => {
    const socket = io({ withCredentials: true });

    const messageInput = document.getElementById('messageInput');
    const envoyerMessage = document.getElementById('envoyerMessage');
    const messagesContainer = document.getElementById('messages-container');

    if (!messageInput || !envoyerMessage || !messagesContainer) {
        console.error("Un ou plusieurs éléments du DOM sont introuvables.");
        return;
    }

    // Envoi de message
    envoyerMessage.addEventListener('click', (event) => {
        event.preventDefault();

        const message = messageInput.value.trim();
        if (message) {
            socket.emit('messageChat', message);
            messageInput.value = '';
        } else {
            console.warn("Le champ de message est vide.");
        }
    });

    // Mise à jour du nombre de connectés
    socket.on('updateNbConnected', (nbConnected) => {
        const nbConnectedElement = document.getElementById('nb-connected');
        if (nbConnectedElement) {
            nbConnectedElement.textContent = `( Online : ${nbConnected} )`;
        }
    });

    // Réception des messages
    socket.on('nouveauMessage', ({ content, time, username, avatar }) => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');

        // // Structure HTML du message
        // messageElement.innerHTML = `
        //     <div class="message-content">
        //         <img src="${avatar || '/images/default-avatar.png'}" alt="Avatar" class="avatar-chat">
        //         <div>
        //             <p><strong>${username}:</strong> ${content}</p>
        //             <p class="time">${time}</p>
        //         </div>
        //     </div>
        // `;

         // Structure HTML du message
         messageElement.innerHTML = `
         <div class="message">
                <img class="avatarChat" src="${avatar || '/images/default-avatar.png'}" alt="avatar">
                <p class="content">m${username}e</p>  <br />
                <p class="contentEnd">${time} : ${content}</p>
            </div>`;

        // Ajout au conteneur et défilement automatique
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });

    // Gestion des erreurs de connexion
    socket.on('connect_error', (err) => {
        console.error('Erreur de connexion au serveur Socket.IO:', err.message);
    });
});
