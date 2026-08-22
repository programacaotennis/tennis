const demoCourts = [
    { id: 1, name: 'Quadra 1', type: 'Saibro', detail: 'Externa', slots: ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00'] },
    { id: 2, name: 'Quadra 2', type: 'Saibro', detail: 'Externa', slots: ['06:00', '07:00', '08:00', '09:00', '10:00'] },
    { id: 3, name: 'Quadra 3', type: 'Rápida', detail: 'Coberta', slots: ['07:00', '08:00', '09:00', '11:00', '12:00'] },
    { id: 4, name: 'Quadra 4', type: 'Saibro', detail: 'Externa', slots: ['06:00', '08:00', '09:00', '10:00', '11:00'] }
];
let selectedCourt = null;
let selectedTime = null;
let currentDate = new Date(2026, 7, 24);
let reservations = JSON.parse(localStorage.getItem('tennisReservations') || '[]');

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
function showToast(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3000); }
function formatDate(date) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date).replace('.', ''); }
function dateLabel(date) { const label = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'long' }).format(date).replace('.', ''); return date.getDate() === 24 && date.getMonth() === 7 ? `Hoje, ${label.split(',').slice(1).join(',')}` : label; }
function renderCourts() {
    $('#selectedDateLabel').textContent = dateLabel(currentDate);
    $('#courtList').innerHTML = demoCourts.map((court) => `<article class="court-row ${selectedCourt?.id === court.id ? 'selected' : ''}"><span class="court-color"></span><div><strong class="court-name">${court.name}</strong><span class="court-meta">${court.type} · ${court.detail}</span></div><div class="time-grid">${court.slots.map((slot, index) => `<button class="time-slot ${index === 1 && court.id === 2 ? 'unavailable' : ''} ${selectedCourt?.id === court.id && selectedTime === slot ? 'selected' : ''}" data-court="${court.id}" data-time="${slot}" ${index === 1 && court.id === 2 ? 'disabled' : ''}>${slot}</button>`).join('')}</div></article>`).join('');
    $$('.time-slot').forEach((button) => button.addEventListener('click', () => { selectedCourt = demoCourts.find((court) => court.id === Number(button.dataset.court)); selectedTime = button.dataset.time; renderCourts(); updateSummary(); }));
}
function updateSummary() { const filled = Boolean(selectedCourt && selectedTime); $('#emptySummary').classList.toggle('hidden', filled); $('#filledSummary').classList.toggle('hidden', !filled); if (filled) { $('#summaryCourt').textContent = selectedCourt.name; $('#summaryType').textContent = `${selectedCourt.type} · ${selectedCourt.detail}`; $('#summaryDate').textContent = formatDate(currentDate); $('#summaryTime').textContent = `${selectedTime} — ${String(Number(selectedTime.split(':')[0]) + 1).padStart(2, '0')}:00`; } }
function renderReservations() { const list = $('#reservationList'); list.innerHTML = reservations.length ? reservations.map((reservation) => `<div class="reservation-item"><div><strong>${reservation.court}</strong><small>${reservation.type} · ${reservation.date}</small></div><time>${reservation.time}</time></div>`).join('') : '<div class="empty-summary"><span>＋</span><p>Você ainda não tem reservas.<br>Seu próximo jogo começa com um clique.</p></div>'; }
function renderAdminCourts() { $('#courtAdminList').innerHTML = demoCourts.map((court) => `<div class="court-admin-row"><span class="admin-court-icon">⌂</span><div><strong>${court.name}</strong><small>${court.type} · ${court.detail}</small></div><span class="admin-court-state">Ativa</span><button class="outline-button">Editar</button></div>`).join(''); }
function openApp(isAdmin, name = 'Visitante') { $('#authScreen').classList.add('hidden'); $('#appScreen').classList.remove('hidden'); $('#userName').textContent = name; $('#userRole').textContent = isAdmin ? 'Administrador' : 'Membro'; $('#userAvatar').textContent = name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase(); $$('.admin-only').forEach((item) => item.classList.toggle('hidden', !isAdmin)); renderCourts(); renderReservations(); renderAdminCourts(); }
$$('[data-auth-tab]').forEach((tab) => tab.addEventListener('click', () => { $$('[data-auth-tab]').forEach((button) => button.classList.remove('active')); tab.classList.add('active'); $('#loginForm').classList.toggle('active-form', tab.dataset.authTab === 'login'); $('#signupForm').classList.toggle('active-form', tab.dataset.authTab === 'signup'); }));
$('#loginForm').addEventListener('submit', (event) => { event.preventDefault(); const email = $('#loginEmail').value; openApp(email.toLowerCase() === 'admin@programacaotenis.com', email.toLowerCase() === 'admin@programacaotenis.com' ? 'Marina Costa' : email.split('@')[0]); });
$('#signupForm').addEventListener('submit', (event) => { event.preventDefault(); openApp(false, $('#signupName').value); showToast('Conta criada. Bem-vindo ao clube!'); });
$('#googleButton').addEventListener('click', () => showToast('Login Google pronto para conectar ao Supabase Auth.'));
$('#logoutButton').addEventListener('click', () => { $('#appScreen').classList.add('hidden'); $('#authScreen').classList.remove('hidden'); });
$$('.nav-item').forEach((item) => item.addEventListener('click', () => { $$('.nav-item').forEach((button) => button.classList.remove('active')); item.classList.add('active'); $$('.view').forEach((view) => view.classList.remove('active-view')); $(`#${item.dataset.view}View`).classList.add('active-view'); }));
$('#prevDay').addEventListener('click', () => { currentDate.setDate(currentDate.getDate() - 1); selectedCourt = null; selectedTime = null; renderCourts(); updateSummary(); });
$('#nextDay').addEventListener('click', () => { currentDate.setDate(currentDate.getDate() + 1); selectedCourt = null; selectedTime = null; renderCourts(); updateSummary(); });
$('#confirmBooking').addEventListener('click', () => { reservations.push({ court: selectedCourt.name, type: `${selectedCourt.type} · ${selectedCourt.detail}`, date: formatDate(currentDate), time: `${selectedTime} — ${String(Number(selectedTime.split(':')[0]) + 1).padStart(2, '0')}:00` }); localStorage.setItem('tennisReservations', JSON.stringify(reservations)); renderReservations(); showToast('Reserva confirmada com sucesso!'); selectedCourt = null; selectedTime = null; renderCourts(); updateSummary(); });
$('#newCourtButton').addEventListener('click', () => showToast('Formulário de nova quadra será conectado ao Supabase.'));