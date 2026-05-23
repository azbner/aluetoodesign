// Cibler les éléments du DOM
// CORRECTION : Remplacement de .chat-input par .input-container pour correspondre à ton HTML
const chatInput = document.querySelector('.input-container textarea');
const sendButton = document.querySelector('.input-container .btn-send');
const chatMessages = document.querySelector('.chat-messages');

// Fonction pour envoyer un message
function handleSendMessage() {
    const messageText = chatInput.value.trim();
    
    if (messageText !== "") {
        // Créer l'élément de message
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'user-message');
        messageDiv.textContent = messageText;

        // Ajouter au chat
        chatMessages.appendChild(messageDiv);

        // Vider le champ
        chatInput.value = "";

        // Défiler vers le bas
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Optionnel : Simulation de réponse de l'IA
        setTimeout(() => {
            const aiMessageDiv = document.createElement('div');
            aiMessageDiv.classList.add('message', 'ai-message');
            aiMessageDiv.textContent = "Ceci est une simulation de réponse d'Aluetoo AI.";
            chatMessages.appendChild(aiMessageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 1000);
    }
}

// Événements
sendButton.addEventListener('click', handleSendMessage);

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
    }
});
