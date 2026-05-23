// CORRECTION DES SÉLECTEURS : Correspondance avec la structure réelle de l'index.html
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('btn-send');
const chatMessages = document.getElementById('chat-messages');

// Fonction pour envoyer un message
function handleSendMessage() {
    const messageText = chatInput.value.trim();
    
    if (messageText !== "") {
        // Supprimer le message d'accueil et les suggestions au premier message
        const welcome = document.querySelector('.welcome-message');
        const suggestions = document.querySelector('.suggestions');
        if (welcome) welcome.remove();
        if (suggestions) suggestions.remove();

        // Changer l'alignement des messages pour le flux de discussion
        chatMessages.style.justifyContent = 'flex-start';
        chatMessages.style.alignItems = 'stretch';

        // Créer l'élément de message de l'utilisateur
        const userMessageDiv = document.createElement('div');
        userMessageDiv.style.alignSelf = 'flex-end';
        userMessageDiv.style.backgroundColor = '#2a2b2d';
        userMessageDiv.style.padding = '12px 16px';
        userMessageDiv.style.borderRadius = '18px';
        userMessageDiv.style.marginBottom = '15px';
        userMessageDiv.style.maxWidth = '70%';
        userMessageDiv.textContent = messageText;

        // Ajouter le message à l'écran
        chatMessages.appendChild(userMessageDiv);

        // Vider le champ de saisie
        chatInput.value = "";

        // Faire défiler vers le bas automatiquement
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Optionnel : Simulation d'une réponse de l'IA après 1 seconde
        setTimeout(() => {
            const aiMessageDiv = document.createElement('div');
            aiMessageDiv.style.alignSelf = 'flex-start';
            aiMessageDiv.style.backgroundColor = 'transparent';
            aiMessageDiv.style.padding = '12px 16px';
            aiMessageDiv.style.marginBottom = '15px';
            aiMessageDiv.style.maxWidth = '80%';
            aiMessageDiv.textContent = "Je suis Aluetoo AI. C'est une simulation de réponse en attendant la connexion à mon API !";
            chatMessages.appendChild(aiMessageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 1000);
    }
}

// Événement clic sur le bouton envoyer
sendButton.addEventListener('click', handleSendMessage);

// Événement Touche Entrée (sans Shift) pour envoyer le message
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // Empêche le saut de ligne
        handleSendMessage();
    }
});

// Gestion basique du menu responsive (Toggle Sidebar)
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');

if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
        if (sidebar.style.left === '0px') {
            sidebar.style.left = '-280px';
        } else {
            sidebar.style.left = '0px';
        }
    });
}
