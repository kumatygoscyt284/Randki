// Konfiguracja
const EVENT_DATE = new Date('2026-08-03T10:00:00').getTime();
const COLOR_PALETTE = [
    '#FF5733', '#33FF57', '#3357FF', '#F333FF', '#FF33A1',
    '#33FFF6', '#F6FF33', '#FF8C33', '#8C33FF', '#33FF8C',
    '#FF3333', '#33FF33', '#3333FF', '#FF33FF', '#33FFFF',
    '#FFFF33', '#FFA533', '#5333FF', '#33FFA5', '#A533FF'
];

// Symulacja Firebase - zastąp prawdziwym Firebase
const db = {
    users: [],
    messages: []
};

// Stan aplikacji
let currentUser = null;
let selectedColor = null;

// Inicjalizacja
document.addEventListener('DOMContentLoaded', () => {
    initColorPalette();
    checkExistingProfile();
    setupEventListeners();
    startCountdown();
});

// Inicjalizacja palety kolorów
function initColorPalette() {
    const palette = document.getElementById('color-palette');
    const usedColors = getUsedColors();

    COLOR_PALETTE.forEach(color => {
        const colorDiv = document.createElement('div');
        colorDiv.className = 'color-option';
        colorDiv.style.backgroundColor = color;
        colorDiv.dataset.color = color;

        if (usedColors.includes(color)) {
            colorDiv.classList.add('disabled');
            colorDiv.title = 'Kolor już zajęty';
        } else {
            colorDiv.addEventListener('click', () => selectColor(color, colorDiv));
        }

        palette.appendChild(colorDiv);
    });
}

// Pobierz zajęte kolory (symulacja Firebase)
function getUsedColors() {
    const stored = localStorage.getItem('usedColors');
    return stored ? JSON.parse(stored) : [];
}

// Zapisz zajęty kolor
function saveColor(color) {
    let usedColors = getUsedColors();
    if (!usedColors.includes(color)) {
        usedColors.push(color);
        localStorage.setItem('usedColors', JSON.stringify(usedColors));
    }
}

// Wybór koloru
function selectColor(color, element) {
    document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    selectedColor = color;
}

// Sprawdź czy profil już istnieje (symulacja przez localStorage)
function checkExistingProfile() {
    const savedUser = localStorage.getItem('eventUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showMainScreen();
    } else {
        document.getElementById('setup-screen').classList.remove('hidden');
    }
}

// Zapis profilu
document.getElementById('save-profile-btn').addEventListener('click', () => {
    const username = document.getElementById('username-input').value.trim();
    
    if (!username) {
        alert('Proszę wprowadzić pseudonim!');
        return;
    }
    
    if (!selectedColor) {
        alert('Proszę wybrać kolor!');
        return;
    }

    // Sprawdź unikalność pseudonimu (symulacja)
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
        alert('Pseudonim już zajęty! Wybierz inny.');
        return;
    }

    currentUser = {
        username,
        color: selectedColor,
        deviceId: generateDeviceId()
    };

    // Zapisz użytkownika
    localStorage.setItem('eventUser', JSON.stringify(currentUser));
    users.push(currentUser);
    localStorage.setItem('users', JSON.stringify(users));
    saveColor(selectedColor);

    showMainScreen();
});

// Generowanie ID urządzenia
function generateDeviceId() {
    return 'device_' + Math.random().toString(36).substr(2, 9);
}

// Pokaż główny ekran
function showMainScreen() {
    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
    loadChatHistory();
}

// Odliczanie
function startCountdown() {
    const countdown = document.getElementById('countdown');
    
    function update() {
        const now = new Date().getTime();
        const distance = EVENT_DATE - now;
        
        if (distance < 0) {
            countdown.innerHTML = "EVENT ROZPOCZĘTY!";
            return;
        }
        
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        countdown.innerHTML = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    }
    
    setInterval(update, 1000);
    update();
}

// Przyciski
document.getElementById('show-banner-btn').addEventListener('click', function() {
    const bannerContainer = document.getElementById('banner-container');
    bannerContainer.classList.toggle('hidden');
    this.textContent = bannerContainer.classList.contains('hidden') ? 'Baner eventu' : 'Ukryj baner';
});

document.getElementById('download-banner-btn').addEventListener('click', function() {
    const link = document.createElement('a');
    link.href = 'foty/baner_event.jpg';
    link.download = 'baner_event.jpg';
    link.click();
});

document.getElementById('open-chat-btn').addEventListener('click', function() {
    if (!currentUser) {
        alert('Najpierw utwórz profil!');
        document.getElementById('setup-screen').classList.remove('hidden');
        document.getElementById('main-screen').classList.add('hidden');
        return;
    }
    const chatContainer = document.getElementById('chat-container');
    chatContainer.classList.toggle('hidden');
    if (!chatContainer.classList.contains('hidden')) {
        document.getElementById('message-input').focus();
        loadChatHistory();
    }
});

// Czat
document.getElementById('send-message-btn').addEventListener('click', sendMessage);
document.getElementById('message-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    
    if (!text) return;
    
    const message = {
        id: Date.now(),
        username: currentUser.username,
        color: currentUser.color,
        text: text,
        timestamp: new Date().toISOString(),
        deviceId: currentUser.deviceId
    };
    
    // Zapisz w localStorage (symulacja Firebase)
    const messages = JSON.parse(localStorage.getItem('chatMessages') || '[]');
    messages.push(message);
    localStorage.setItem('chatMessages', JSON.stringify(messages));
    
    input.value = '';
    loadChatHistory();
}

function loadChatHistory() {
    const chatHistory = document.getElementById('chat-history');
    const messages = JSON.parse(localStorage.getItem('chatMessages') || '[]');
    
    chatHistory.innerHTML = '';
    
    messages.forEach(msg => {
        const isOwn = msg.deviceId === currentUser.deviceId;
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isOwn ? 'own' : 'other'}`;
        messageDiv.innerHTML = `
            <span class="username" style="color:${msg.color}">${escapeHtml(msg.username)}</span>
            <span class="text">${escapeHtml(msg.text)}</span>
            <span class="timestamp">${formatTime(msg.timestamp)}</span>
        `;
        chatHistory.appendChild(messageDiv);
    });
    
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

// Funkcje pomocnicze
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

// Obsługa błędów Firebase (dla prawdziwej implementacji)
function initFirebase() {
    // Tutaj dodaj konfigurację Firebase z konsoli
    /*
    const firebaseConfig = {
        apiKey: "TWÓJ_API_KEY",
        authDomain: "TWÓJ_PROJEKT.firebaseapp.com",
        projectId: "event1000osob",
        storageBucket: "TWÓJ_PROJEKT.appspot.com",
        messagingSenderId: "TWÓJ_SENDER_ID",
        appId: "TWÓJ_APP_ID"
    };
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    */
}
