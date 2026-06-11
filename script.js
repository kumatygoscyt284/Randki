// ================== FIREBASE CONFIG ==================
const firebaseConfig = {
  apiKey: "TUTAJ_WSTAW_API_KEY",
  authDomain: "event1000osob.firebaseapp.com",
  projectId: "event1000osob",
  storageBucket: "event1000osob.firebasestorage.app",
  messagingSenderId: "TUTAJ_WSTAW_SENDER_ID",
  appId: "TUTAJ_WSTAW_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ================== ZMIENNE GLOBALNE ==================
let currentUser = null;
const TARGET_DATE = new Date("2026-08-03T10:00:00").getTime();

// ================== FUNKCJE POMOCNICZE ==================
function hexToHsl(hex) {
  let r = parseInt(hex.slice(1,3),16)/255;
  let g = parseInt(hex.slice(3,5),16)/255;
  let b = parseInt(hex.slice(5,7),16)/255;
  let max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h, s, l = (max + min) / 2;

  if (max === min) h = s = 0;
  else {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return {h: h*360, s: s*100, l: l*100};
}

function hslToHex(h, s, l) {
  h = h % 360;
  s /= 100; l /= 100;
  let c = (1 - Math.abs(2*l-1)) * s;
  let x = c * (1 - Math.abs(((h/60)%2)-1));
  let m = l - c/2;
  let r=0, g=0, b=0;

  if (h < 60) { r=c; g=x; }
  else if (h < 120) { r=x; g=c; }
  else if (h < 180) { g=c; b=x; }
  else if (h < 240) { g=x; b=c; }
  else if (h < 300) { r=x; b=c; }
  else { r=c; b=x; }

  r = Math.round((r+m)*255);
  g = Math.round((g+m)*255);
  b = Math.round((b+m)*255);
  return "#" + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('');
}

async function isColorUsed(color) {
  const snapshot = await db.collection("usedColors").doc(color.toUpperCase()).get();
  return snapshot.exists;
}

async function generateUniqueSimilarColor(baseColor) {
  let color = baseColor;
  let attempts = 0;
  while (await isColorUsed(color) && attempts < 30) {
    const hsl = hexToHsl(color);
    const newHue = (hsl.h + 35 + Math.random() * 45) % 360;
    color = hslToHex(newHue, 90, 55);
    attempts++;
  }
  return color;
}

// ================== ANIMACJA OGNI ==================
function initFireAnimation() {
  const canvas = document.getElementById("fireCanvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 600;
  canvas.height = 200;

  const particles = [];

  class Particle {
    constructor() {
      this.x = canvas.width/2 + (Math.random()-0.5)*120;
      this.y = canvas.height - 30;
      this.size = Math.random()*6 + 4;
      this.speedY = Math.random()*-2.5 - 1;
      this.speedX = (Math.random()-0.5)*1.5;
      this.alpha = 1;
      this.hue = 15 + Math.random()*25;
    }
    update() {
      this.y += this.speedY;
      this.x += this.speedX;
      this.speedY -= 0.08;
      this.alpha -= 0.018;
    }
    draw() {
      ctx.globalAlpha = this.alpha;
      ctx.fillStyle = `hsl(${this.hue}, 100%, 60%)`;
      ctx.fillRect(this.x, this.y, this.size, this.size*2);
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (Math.random() < 0.7) particles.push(new Particle());

    for (let i = particles.length-1; i >= 0; i--) {
      particles[i].update();
      particles[i].draw();
      if (particles[i].alpha <= 0) particles.splice(i,1);
    }
    requestAnimationFrame(animate);
  }
  animate();
}

// ================== ODLICZANIE ==================
function startCountdown() {
  const timerEl = document.getElementById("timer");

  setInterval(() => {
    const now = Date.now();
    const diff = TARGET_DATE - now;

    if (diff <= 0) {
      timerEl.innerHTML = "<strong>EVENT TRWA!</strong>";
      return;
    }

    const days = Math.floor(diff / (1000*60*60*24));
    const hours = Math.floor((diff % (1000*60*60*24)) / (1000*60*60));
    const minutes = Math.floor((diff % (1000*60*60)) / (1000*60));
    const seconds = Math.floor((diff % (1000*60)) / 1000);

    timerEl.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }, 1000);
}

// ================== CZAT ==================
let messagesUnsubscribe = null;

function renderMessage(msg, isOwn) {
  const div = document.createElement("div");
  div.className = `message ${isOwn ? 'own' : 'other'}`;
  div.innerHTML = `<strong style="color:${msg.color}">${msg.nickname}</strong>: ${msg.text}`;
  document.getElementById("chatMessages").appendChild(div);
  div.scrollIntoView();
}

function loadChat() {
  const chatMessages = document.getElementById("chatMessages");
  chatMessages.innerHTML = "";

  if (messagesUnsubscribe) messagesUnsubscribe();

  messagesUnsubscribe = db.collection("messages")
    .orderBy("timestamp", "asc")
    .onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === "added") {
          const msg = change.doc.data();
          const isOwn = currentUser && msg.nickname === currentUser.nickname;
          renderMessage(msg, isOwn);
        }
      });
    });
}

function sendMessage() {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text || !currentUser) return;

  db.collection("messages").add({
    nickname: currentUser.nickname,
    color: currentUser.color,
    text: text,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });

  input.value = "";
}

// ================== GŁÓWNA LOGIKA ==================
async function createProfile() {
  const nickname = document.getElementById("nickname").value.trim();
  let color = document.getElementById("colorPicker").value.toUpperCase();

  if (!nickname) {
    document.getElementById("errorMsg").textContent = "Podaj pseudonim!";
    return;
  }

  if (await isColorUsed(color)) {
    color = await generateUniqueSimilarColor(color);
    alert(`Ten kolor jest zajęty. Zaproponowaliśmy podobny: ${color}`);
  }

  currentUser = {
    nickname: nickname,
    color: color,
    deviceId: "device_" + Date.now() + Math.random().toString(36).substr(2,9)
  };

  // Zapisz używany kolor
  await db.collection("usedColors").doc(color).set({ used: true, nickname: nickname });

  // Zapisz użytkownika
  await db.collection("users").doc(currentUser.deviceId).set(currentUser);

  localStorage.setItem("eventUser", JSON.stringify(currentUser));

  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("mainScreen").classList.remove("hidden");

  initFireAnimation();
  startCountdown();
}

// ================== INICJALIZACJA ==================
window.onload = () => {
  const savedUser = localStorage.getItem("eventUser");

  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("mainScreen").classList.remove("hidden");
    initFireAnimation();
    startCountdown();
  } else {
    document.getElementById("loginScreen").classList.remove("hidden");
  }

  // Event Listenery
  document.getElementById("createProfileBtn").addEventListener("click", createProfile);

  document.getElementById("showBannerBtn").addEventListener("click", () => {
    document.getElementById("bannerModal").classList.remove("hidden");
  });

  document.querySelectorAll(".close").forEach(el => {
    el.addEventListener("click", () => {
      document.getElementById("bannerModal").classList.add("hidden");
      document.getElementById("chatModal").classList.add("hidden");
    });
  });

  document.getElementById("openChatBtn").addEventListener("click", () => {
    if (!currentUser) return alert("Najpierw utwórz profil!");
    document.getElementById("chatModal").classList.remove("hidden");
    loadChat();
  });

  document.getElementById("sendMessageBtn").addEventListener("click", sendMessage);
  document.getElementById("chatInput").addEventListener("keypress", e => {
    if (e.key === "Enter") sendMessage();
  });

  document.getElementById("downloadBannerBtn").addEventListener("click", () => {
    const link = document.createElement("a");
    link.href = "foty/baner_event.jpg";
    link.download = "baner_event.jpg";
    link.click();
  });

  // Aktualizacja preview koloru
  const colorPicker = document.getElementById("colorPicker");
  const colorPreview = document.getElementById("colorPreview");
  colorPicker.addEventListener("input", () => {
    colorPreview.style.backgroundColor = colorPicker.value;
  });
};
