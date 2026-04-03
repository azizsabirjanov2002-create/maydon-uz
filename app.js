// Mock Data for MVP
const mockVenues = [
    {
        id: 1,
        title: "Экопарк Арена (Поле 1)",
        location: "Мирзо-Улугбекский р-н",
        travelTime: "12 мин",
        price: "250 000",
        image: "https://images.unsplash.com/photo-1575361204480-aadea25e6e68?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
        slots: ["19:00", "19:30", "20:00"]
    },
    {
        id: 2,
        title: "BeFit Sports (Indoor)",
        location: "Шайхантахурский р-н",
        travelTime: "18 мин",
        price: "350 000",
        image: "https://images.unsplash.com/photo-1459865264687-595d652de67e?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
        slots: ["21:00", "21:30"]
    },
    {
        id: 3,
        title: "Стадион Локомотив",
        location: "Мирзо-Улугбекский р-н",
        travelTime: "22 мин",
        price: "200 000",
        image: "https://images.unsplash.com/photo-1529900965600-022ee6b78044?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
        slots: ["18:00", "20:00", "22:00"]
    },
    {
        id: 4,
        title: "Tashkent City Park",
        location: "Шайхантахурский р-н",
        travelTime: "25 мин",
        price: "300 000",
        image: "https://images.unsplash.com/photo-1574629810360-7efbb19f4da8?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
        slots: ["22:00", "23:00"]
    }
];

const mockOwnerSchedule = [
    { time: "18:00", status: "free", label: "Свободно" },
    { time: "19:00", status: "paid", label: "Оплачено (Aziz M.)" },
    { time: "20:00", status: "hold", label: "Hold (Ожидание оплаты)" },
    { time: "21:00", status: "free", label: "Свободно" },
    { time: "22:00", status: "paid", label: "Предоплата (Rustam)" }
];

// App State
let currentSlotInfo = null;

// Initialization
document.addEventListener("DOMContentLoaded", () => {
    // default render on page load? No, wait for search click to show results.
    renderOwnerSchedule();
});

// View Toggle
function toggleView(view) {
    document.getElementById("view-client").style.display = view === 'client' ? 'block' : 'none';
    document.getElementById("view-owner").style.display = view === 'owner' ? 'block' : 'none';
}

// Search Logic
function promptLocation() {
    document.getElementById("locationText").innerText = "Определяется... 📍";
    setTimeout(() => {
        document.getElementById("locationText").innerText = "✅ Мирзо-Улугбекский р-н (Текущая)";
    }, 800);
}

function runSearch() {
    const btn = document.getElementById("btnSearch");
    btn.innerHTML = "Ищем свободные поля... ⚡";
    btn.style.opacity = 0.8;
    
    setTimeout(() => {
        document.getElementById("venuesSection").style.display = 'block';
        renderVenues(mockVenues);
        btn.innerHTML = "Найти свободные слоты";
        btn.style.opacity = 1;
        
        // Scroll to results
        document.getElementById("venuesSection").scrollIntoView({ behavior: 'smooth' });
    }, 600);
}

// Render UI Components
function renderVenues(venues) {
    const grid = document.getElementById("venuesGrid");
    grid.innerHTML = "";
    
    venues.forEach(venue => {
        const spotsHtml = venue.slots.map(t => 
            `<button class="slot-btn" onclick="openCheckout('${venue.title}', '${t}', '${venue.price}')">${t}</button>`
        ).join("");

        const card = `
            <div class="venue-card">
                <div class="card-image" style="background-image: url('${venue.image}')">
                    <div class="card-badge fast">🚗 ${venue.travelTime} в пути</div>
                </div>
                <div class="card-content">
                    <h3 class="card-title">${venue.title}</h3>
                    <div class="card-location">📍 ${venue.location}</div>
                    
                    <div class="card-price-row">
                        <div class="price">${venue.price} <span>UZS / час</span></div>
                    </div>
                    
                    <div class="slots-container">
                        <div class="slots-label">Свободное время:</div>
                        <div class="slots-row">
                            ${spotsHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;
        grid.innerHTML += card;
    });
}

function renderOwnerSchedule() {
    const grid = document.getElementById("ownerScheduleGrid");
    grid.innerHTML = "";
    
    mockOwnerSchedule.forEach(slot => {
        const row = document.createElement("div");
        row.className = "sched-row";
        row.innerHTML = `
            <div class="sched-time">${slot.time}</div>
            <div style="flex:1;">Поле 1 — Футбол</div>
            <div class="sched-status status-${slot.status}">${slot.label}</div>
        `;
        grid.appendChild(row);
    });
}

// Checkout Logic
function openCheckout(venueTitle, time, priceStr) {
    document.getElementById("checkoutVenueName").innerText = venueTitle;
    document.querySelector(".checkout-detail span").innerText = \`Сегодня, \${time}\`; // fixed template literal
    
    // calc prices
    const fullPrice = parseInt(priceStr.replace(/\s/g, ''));
    const prepay = Math.floor(fullPrice * 0.3);
    
    const formatNumber = n => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    
    document.getElementById("checkoutPrepay").innerText = formatNumber(prepay) + " UZS";
    document.getElementById("checkoutFull").innerText = formatNumber(fullPrice) + " UZS";
    document.getElementById("checkoutBtnTotal").innerText = formatNumber(prepay) + " UZS";
    
    document.getElementById("checkoutModal").classList.add("active");
    startTimer();
}

function closeModal() {
    document.getElementById("checkoutModal").classList.remove("active");
    clearInterval(timerInterval);
}

// Payment Select listener
document.querySelectorAll(".payment-card").forEach(card => {
    card.addEventListener("click", function() {
        document.querySelectorAll(".payment-card").forEach(c => c.classList.remove("active"));
        this.classList.add("active");
        this.querySelector("input").checked = true;
        
        const isPrepay = this.querySelector("input").parentElement.querySelector("h5").innerText.includes("Предоплата");
        const val = isPrepay ? document.getElementById("checkoutPrepay").innerText : document.getElementById("checkoutFull").innerText;
        document.getElementById("checkoutBtnTotal").innerText = val;
    });
});

let timerInterval;
function startTimer() {
    let timeLeft = 300; // 5 min
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        if(timeLeft < 0) {
            clearInterval(timerInterval);
            closeModal();
            alert("Время на оплату (hold) истекло. Слот снова свободен.");
            return;
        }
        const m = Math.floor(timeLeft / 60);
        const s = timeLeft % 60;
        document.querySelector(".hold-badge").innerText = \`Hold \${m}:\${s < 10 ? '0'+s : s}\`; // fixed
    }, 1000);
}

function payAndConfirm() {
    const btn = document.querySelector(".checkout-actions .btn");
    btn.innerHTML = "Переход к оплате (Payme/Freedom)...";
    setTimeout(() => {
        alert("Оплата успешно проведена! Бронь подтверждена.");
        closeModal();
        runSearch(); // refresh
    }, 1500);
}
