const supabaseUrl = 'https://uakjpmkkcxbmizfsxdqj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVha2pwbWtrY3hibWl6ZnN4ZHFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczODM4MzUsImV4cCI6MjEwMjk1OTgzNX0.thBY1EhLkUop9kTuv6ZwfXG1C4AcQ2hOEI8p8yxsCz8';
const pushVapidPublicKey = 'BLrod_1W-uxEhv_QTR-TcfvBPDdLVOqUTsmIVwSegLXU4RXIUR268zfTZ3ikcNEEKYGuh4WQvsIPlFWBZZUg6Qw';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
const productionUrl = 'https://tennis.programacaotennis.workers.dev';
const authRedirectUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? window.location.origin : productionUrl;
const bookingSlots = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
let selectedCourt = null;
let selectedTime = null;
let currentUser = null;
let currentProfile = null;
let courts = [];
let availability = [];
let notificationPollingId = null;
let unreadNotificationCount = null;
let notificationLoadErrorShown = false;
let bookingIdsToCancel = [];
let selectedReservationIds = new Set();
const today = new Date();
let currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
let bookingCalendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let bookingCalendarCourtId = '';
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

$('#googleButton')?.addEventListener('click', async () => { const { error } = await supabaseClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: authRedirectUrl, queryParams: { prompt: 'select_account' } } }); if (error) showToast(error.message); });

function showToast(message, tone = 'default') { const toast = $('#toast'); toast.textContent = message; toast.classList.toggle('toast-error', tone === 'error'); toast.classList.add('show'); setTimeout(() => { toast.classList.remove('show'); toast.classList.remove('toast-error'); }, 6000); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])); }
function urlBase64ToUint8Array(value) { const padding = '='.repeat((4 - (value.length % 4)) % 4); const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/'); return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0)); }
function arrayBufferToBase64(buffer) { return btoa(String.fromCharCode(...new Uint8Array(buffer))); }
async function syncPushNotificationButton() {
    const button = $('#enablePushButton');
    if (!button) return;
    button.disabled = false;
    button.textContent = 'Ativar alertas neste dispositivo';
    if (!pushVapidPublicKey || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
    if (Notification.permission === 'denied') { button.textContent = 'Alertas bloqueados neste navegador'; button.disabled = true; return; }
    try {
        const registration = await navigator.serviceWorker.getRegistration('/sw.js');
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) { button.textContent = 'Alertas ativados neste dispositivo'; button.disabled = true; }
    } catch (error) { console.warn('Não foi possível verificar os alertas push.', error); }
}
async function enablePushNotifications() { if (!pushVapidPublicKey) { showToast('A chave VAPID ainda não foi configurada para este site.'); return; } if (!('serviceWorker' in navigator) || !('PushManager' in window)) { showToast('Este navegador não oferece suporte a alertas push.'); return; } try { const registration = await navigator.serviceWorker.register('/sw.js'); const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(pushVapidPublicKey) }); const keys = subscription.toJSON().keys; const { error } = await supabaseClient.from('push_subscriptions').upsert({ user_id: currentUser.id, endpoint: subscription.endpoint, p256dh: keys?.p256dh || arrayBufferToBase64(subscription.getKey('p256dh')), auth: keys?.auth || arrayBufferToBase64(subscription.getKey('auth')) }, { onConflict: 'endpoint' }); if (error) throw error; await syncPushNotificationButton(); showToast('Alertas push ativados com sucesso.'); } catch (error) { showToast(error.name === 'NotAllowedError' ? 'Você bloqueou a permissão de notificações deste navegador.' : error.message); } }
async function sendCancelledBookingPush(bookingId) { if (!pushVapidPublicKey) return; const { error } = await supabaseClient.functions.invoke('send-booking-push', { body: { booking_id: bookingId } }); if (error) console.warn('Não foi possível enviar o alerta push.', error.message); }
function formatDate(date) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date).replace('.', ''); }
function formatBookingDate(date) { return date.split('-').reverse().join('-'); }
function dateLabel(date) { const label = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'long' }).format(date).replace('.', ''); return label.charAt(0).toUpperCase() + label.slice(1); }
function dateValue(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function endTime(startTime) { return `${String(Number(startTime.slice(0, 2)) + 2).padStart(2, '0')}:00`; }
function recurrenceDates(startDate, type, count) { const dates = []; const date = new Date(`${startDate}T12:00:00`); for (let index = 0; index < count; index += 1) { dates.push(dateValue(date)); if (type === 'daily') date.setDate(date.getDate() + 1); if (type === 'weekly') date.setDate(date.getDate() + 7); if (type === 'monthly') date.setMonth(date.getMonth() + 1); } return dates; }
function recurrenceLimit(type) { const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate(); const remainingDays = daysInMonth - currentDate.getDate() + 1; if (type === 'monthly') return 1; if (type === 'weekly') return Math.min(5, Math.floor((remainingDays - 1) / 7) + 1); return type === 'daily' ? Math.min(30, remainingDays) : 1; }
function updateRecurrenceOptions() { const type = $('#recurrenceType').value; const limit = Math.max(1, recurrenceLimit(type)); const count = $('#recurrenceCount'); count.innerHTML = Array.from({ length: limit }, (_, index) => `<option value="${index + 1}">${index + 1} ${index === 0 ? 'ocorrência' : 'ocorrências'}</option>`).join(''); count.value = '1'; }
function isPastDate(date) { const current = new Date(); current.setHours(0, 0, 0, 0); return date < current; }
function syncDatePicker() { const picker = $('#datePicker'); if (picker) { picker.value = dateValue(currentDate); picker.min = dateValue(new Date(today.getFullYear(), today.getMonth(), today.getDate())); } $('#prevDay').disabled = isPastDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 1)); }

async function loadCourts() {
    const { data, error } = await supabaseClient.from('courts').select('id, name, surface, location, active').order('id');
    if (error) throw error;
    courts = data || [];
}

async function loadAvailability() {
    const { data, error } = await supabaseClient.from('availability').select('court_id, day_of_week, start_time');
    if (error) throw error;
    availability = data || [];
}

async function loadBookedSlots() {
    const { data, error } = await supabaseClient.rpc('get_booked_slots', { p_booking_date: dateValue(currentDate) });
    if (error) throw error;
    return new Map((data || []).map((booking) => [`${booking.court_id}-${booking.start_time.slice(0, 5)}`, booking]));
}

async function renderCourts() {
    $('#selectedDateLabel').textContent = dateLabel(currentDate);
    syncDatePicker();
    const list = $('#courtList');
    const activeCourts = courts.filter((court) => court.active);
    if (!activeCourts.length) { list.innerHTML = '<div class="empty-summary"><p>Nenhuma quadra ativa foi cadastrada.</p></div>'; return; }
    try {
        const bookedSlots = await loadBookedSlots();
        const weekday = currentDate.getDay();
        const availableSlots = new Set(availability.filter((item) => item.day_of_week === weekday).map((item) => `${item.court_id}-${item.start_time.slice(0, 5)}`));
        list.innerHTML = activeCourts.map((court) => `<article class="court-row ${selectedCourt?.id === court.id ? 'selected' : ''}"><span class="court-color"></span><div><strong class="court-name">${court.name}</strong><span class="court-meta">${court.surface} · ${court.location}</span></div><div class="time-grid">${bookingSlots.map((slot) => { const booking = bookedSlots.get(`${court.id}-${slot}`); const unavailable = Boolean(booking) || !availableSlots.has(`${court.id}-${slot}`); const button = `<button class="time-slot ${unavailable ? 'unavailable' : ''} ${selectedCourt?.id === court.id && selectedTime === slot ? 'selected' : ''}" data-court="${court.id}" data-time="${slot}" ${unavailable ? 'disabled' : ''}>${slot}</button>`; return booking ? `<span class="reserved-slot" tabindex="0" role="button" data-booked-by="${escapeHtml(booking.booked_by)}" data-tooltip="Reservado por ${escapeHtml(booking.booked_by)}">${button}</span>` : button; }).join('')}</div></article>`).join('');
        $$('.time-slot:not(:disabled)').forEach((button) => button.addEventListener('click', () => { selectedCourt = courts.find((court) => court.id === Number(button.dataset.court)); selectedTime = button.dataset.time; renderCourts(); updateSummary(); }));
        $$('.reserved-slot').forEach((slot) => slot.addEventListener('click', () => showToast(`Horário reservado por ${slot.dataset.bookedBy}.`)));
    } catch (error) { list.innerHTML = '<div class="empty-summary"><p>Não foi possível carregar os horários.</p></div>'; showToast(error.message); }
}

function updateSummary() {
    const filled = Boolean(selectedCourt && selectedTime);
    $('#emptySummary').classList.toggle('hidden', filled); $('#filledSummary').classList.toggle('hidden', !filled);
    if (filled) { $('#summaryCourt').textContent = selectedCourt.name; $('#summaryType').textContent = `${selectedCourt.surface} · ${selectedCourt.location}`; $('#summaryDate').textContent = formatDate(currentDate); $('#summaryTime').textContent = `${selectedTime} — ${endTime(selectedTime)}`; }
}

async function renderReservations() {
    const list = $('#reservationList');
    const { data, error } = await supabaseClient.from('bookings').select('id, booking_date, start_time, end_time, courts(name, surface, location)').eq('user_id', currentUser.id).eq('status', 'confirmed').order('booking_date').order('start_time');
    if (error) { showToast(error.message); return; }
    const reservations = data || [];
    const reservationIds = new Set(reservations.map((reservation) => String(reservation.id)));
    selectedReservationIds = new Set([...selectedReservationIds].filter((id) => reservationIds.has(id)));
    $('#reservationActions').classList.toggle('hidden', !reservations.length);
    list.innerHTML = reservations.length ? reservations.map((reservation) => `<div class="reservation-item"><label class="reservation-select"><input class="reservation-selection" type="checkbox" data-booking-id="${reservation.id}" ${selectedReservationIds.has(String(reservation.id)) ? 'checked' : ''} aria-label="Selecionar reserva" /></label><div><strong>${reservation.courts.name}</strong><small>${reservation.courts.surface} · ${reservation.courts.location} · ${formatBookingDate(reservation.booking_date)}</small></div><time>${reservation.start_time.slice(0, 5)} — ${reservation.end_time.slice(0, 5)}</time><button class="outline-button cancel-booking" data-booking-id="${reservation.id}">Desistir</button></div>`).join('') : '<div class="empty-summary"><span>＋</span><p>Você ainda não tem reservas.<br>Seu próximo jogo começa com um clique.</p></div>';
    updateReservationActions();
}

function updateReservationActions() {
    const checkboxes = $$('.reservation-selection');
    const selectedCount = selectedReservationIds.size;
    const selectAll = $('#selectAllReservations');
    selectAll.checked = Boolean(checkboxes.length && selectedCount === checkboxes.length);
    selectAll.indeterminate = Boolean(selectedCount && selectedCount < checkboxes.length);
    const button = $('#cancelSelectedBookings');
    button.disabled = !selectedCount;
    button.textContent = selectedCount ? `Cancelar selecionadas (${selectedCount})` : 'Cancelar selecionadas';
}

async function renderCourtBookings() {
    const list = $('#courtBookingList');
    const monthStart = new Date(bookingCalendarMonth.getFullYear(), bookingCalendarMonth.getMonth(), 1);
    const monthEnd = new Date(bookingCalendarMonth.getFullYear(), bookingCalendarMonth.getMonth() + 1, 0);
    $('#bookingCalendarMonth').textContent = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(monthStart);
    const courtSelect = $('#courtBookingCourt');
    courtSelect.innerHTML = `<option value="">Todas as quadras</option>${courts.filter((court) => court.active).map((court) => `<option value="${court.id}">${escapeHtml(court.name)}</option>`).join('')}`;
    courtSelect.value = bookingCalendarCourtId;
    if (!courtSelect.value) bookingCalendarCourtId = '';
    const { data, error } = await supabaseClient.from('bookings').select('id, user_id, court_id, booking_date, start_time, end_time, courts(name)').eq('status', 'confirmed').gte('booking_date', dateValue(monthStart)).lte('booking_date', dateValue(monthEnd)).order('start_time');
    if (error) { list.innerHTML = '<div class="empty-summary"><p>Não foi possível carregar as reservas.</p></div>'; showToast(error.message); return; }
    const userIds = [...new Set((data || []).map((booking) => booking.user_id))];
    const { data: profiles, error: profilesError } = userIds.length ? await supabaseClient.from('profiles').select('id, full_name, email').in('id', userIds) : { data: [], error: null };
    if (profilesError) { list.innerHTML = '<div class="empty-summary"><p>Não foi possível carregar os membros.</p></div>'; showToast(profilesError.message); return; }
    const profilesById = new Map((profiles || []).map((profile) => [profile.id, profile]));
    const bookingsByDate = new Map();
    (data || []).filter((booking) => !bookingCalendarCourtId || booking.court_id === Number(bookingCalendarCourtId)).forEach((booking) => {
        const bookings = bookingsByDate.get(booking.booking_date) || [];
        bookings.push(booking);
        bookingsByDate.set(booking.booking_date, bookings);
    });
    const emptyDays = Array.from({ length: monthStart.getDay() }, () => '<div class="booking-calendar-day empty" aria-hidden="true"></div>').join('');
    const days = Array.from({ length: monthEnd.getDate() }, (_, index) => {
        const day = index + 1;
        const date = new Date(bookingCalendarMonth.getFullYear(), bookingCalendarMonth.getMonth(), day);
        const bookings = bookingsByDate.get(dateValue(date)) || [];
        const reservations = bookings.map((booking) => {
            const member = profilesById.get(booking.user_id);
            const court = Array.isArray(booking.courts) ? booking.courts[0] : booking.courts;
            return `<div class="calendar-reservation"><strong>${escapeHtml(booking.start_time.slice(0, 5))}</strong><span>${escapeHtml(member?.full_name || member?.email || 'Membro')}</span>${bookingCalendarCourtId ? '' : `<small>${escapeHtml(court?.name || 'Quadra')}</small>`}</div>`;
        }).join('');
        return `<article class="booking-calendar-day ${dateValue(date) === dateValue(today) ? 'today' : ''}"><strong class="calendar-day-number">${day}</strong><div class="calendar-reservations">${reservations || '<span class="calendar-no-reservations">Livre</span>'}</div></article>`;
    }).join('');
    list.innerHTML = emptyDays + days;
}

async function loadNotifications({ announce = false } = {}) { if (!currentUser) return; const { data, error } = await supabaseClient.from('notifications').select('id, message, court_id, booking_date, start_time').eq('user_id', currentUser.id).eq('read', false).order('created_at', { ascending: false }).limit(20); const panel = $('#notificationList'); if (error) { panel.innerHTML = '<p class="notification-empty">Não foi possível carregar as notificações.</p>'; $('#notificationButton').classList.remove('has-notifications'); if (!notificationLoadErrorShown) showToast('Atualize a migração de recorrência no Supabase para ativar as notificações.'); notificationLoadErrorShown = true; return; } notificationLoadErrorShown = false; const count = data?.length || 0; if (announce && unreadNotificationCount !== null && count > unreadNotificationCount) showToast('Um horário acabou de ser liberado.'); unreadNotificationCount = count; if (count) { $('#notificationButton').classList.add('has-notifications'); $('#notificationButton').title = `${count} nova(s) notificação(ões)`; panel.innerHTML = data.map((notification) => { const court = courts.find((item) => item.id === Number(notification.court_id)); const date = notification.booking_date ? formatDate(new Date(`${notification.booking_date}T12:00:00`)) : 'Data não informada'; const time = notification.start_time?.slice(0, 5) || 'Horário não informado'; return `<button class="notification-item" data-notification-id="${notification.id}" data-court-id="${notification.court_id || ''}" data-date="${notification.booking_date || ''}" data-time="${time}"><span class="notification-item-icon">⌾</span><span class="notification-item-content"><strong>Horário liberado</strong><span class="notification-item-court">${court?.name || 'Quadra disponível'}</span><span class="notification-item-details">${date} · ${time}–${notification.start_time ? endTime(time) : ''}</span><span class="notification-item-action">Reservar este horário <b>→</b></span></span></button>`; }).join(''); } else { $('#notificationButton').classList.remove('has-notifications'); $('#notificationButton').title = 'Notificações'; panel.innerHTML = '<div class="notification-empty"><span>✓</span><p>Nenhuma notificação nova.</p><small>Quando uma quadra for liberada, ela aparecerá aqui.</small></div>'; } }

function renderAdminCourts() { const activeCount = courts.filter((court) => court.active).length; $('#activeCourtCount').textContent = String(activeCount).padStart(2, '0'); $('#courtAdminList').innerHTML = courts.map((court) => `<div class="court-admin-row"><span class="admin-court-icon">⌂</span><div><strong>${court.name}</strong><small>${court.surface} · ${court.location}</small></div><span class="admin-court-state">${court.active ? 'Ativa' : 'Inativa'}</span><button class="outline-button edit-court" data-court-id="${court.id}">Editar</button></div>`).join('') || '<p>Nenhuma quadra cadastrada.</p>'; }
async function renderAdminStats() { const todayValue = dateValue(today); const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - 6); const [{ count: todayBookings, error: todayError }, { count: weeklyBookings, error: weeklyError }] = await Promise.all([supabaseClient.from('bookings').select('*', { count: 'exact', head: true }).eq('booking_date', todayValue).eq('status', 'confirmed'), supabaseClient.from('bookings').select('*', { count: 'exact', head: true }).gte('booking_date', dateValue(weekStart)).lte('booking_date', todayValue).eq('status', 'confirmed')]); if (todayError || weeklyError) { showToast((todayError || weeklyError).message); return; } $('#bookingCount').textContent = String(todayBookings || 0); const availableWeeklySlots = availability.filter((item) => courts.some((court) => court.id === item.court_id && court.active)).length; $('#occupancyRate').textContent = `${availableWeeklySlots ? Math.round(((weeklyBookings || 0) / availableWeeklySlots) * 100) : 0}%`; }

async function renderMembers() { const { data, error } = await supabaseClient.from('profiles').select('id, full_name, email, role').order('full_name'); if (error) { showToast(error.message); return; } $('#memberList').innerHTML = (data || []).map((member) => `<div class="member-row"><div class="avatar">${(member.full_name || '?').slice(0, 2).toUpperCase()}</div><div><strong>${member.full_name || 'Usuário'}</strong><small>${member.email || 'E-mail não informado'}</small></div><span class="role-badge">${member.role === 'admin' ? 'Admin' : 'Membro'}</span><button class="outline-button toggle-admin" data-member-id="${member.id}" data-role="${member.role}">${member.role === 'admin' ? 'Remover admin' : 'Tornar admin'}</button></div>`).join('') || '<p>Nenhum usuário cadastrado.</p>'; }

async function openApp(profile) {
    currentProfile = profile;
    document.body.classList.add('app-open'); $('#authScreen').classList.add('hidden'); $('#appScreen').classList.remove('hidden');
    const name = profile.full_name || currentUser.email.split('@')[0];
    $('#userName').textContent = name; $('#userRole').textContent = profile.role === 'admin' ? 'Administrador' : 'Membro'; const avatar = $('#userAvatar'); avatar.textContent = name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase(); const avatarUrl = currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture; if (avatarUrl) { avatar.textContent = ''; avatar.style.backgroundImage = `url("${avatarUrl}")`; avatar.classList.add('has-image'); }
    $$('.admin-only').forEach((item) => item.classList.toggle('hidden', profile.role !== 'admin'));
    try { await loadCourts(); await loadAvailability(); await renderCourts(); await renderReservations(); await loadNotifications(); await syncPushNotificationButton(); clearInterval(notificationPollingId); notificationPollingId = setInterval(() => loadNotifications({ announce: true }), 30000); renderAdminCourts(); if (profile.role === 'admin') { await renderAdminStats(); await renderMembers(); } } catch (error) { showToast(error.message); }
}

async function loadSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;
    currentUser = session.user;
    const { data: profile, error } = await supabaseClient.from('profiles').select('full_name, email, role').eq('id', currentUser.id).single();
    if (error) { showToast(error.message); return; }
    await openApp(profile);
}

$$('[data-auth-tab]').forEach((tab) => tab.addEventListener('click', () => { $$('[data-auth-tab]').forEach((button) => button.classList.remove('active')); tab.classList.add('active'); $('#loginForm').classList.toggle('active-form', tab.dataset.authTab === 'login'); $('#signupForm').classList.toggle('active-form', tab.dataset.authTab === 'signup'); }));
$$('.password-toggle').forEach((button) => button.addEventListener('click', () => { const input = $(`#${button.dataset.passwordTarget}`); if (!input) return; const visible = input.type === 'text'; input.type = visible ? 'password' : 'text'; button.classList.toggle('is-visible', !visible); button.setAttribute('aria-label', visible ? 'Mostrar senha' : 'Ocultar senha'); }));
$('#recurrenceType').addEventListener('change', updateRecurrenceOptions);
$('#datePicker').addEventListener('change', async () => { const selectedDate = new Date(`${$('#datePicker').value}T12:00:00`); if (isPastDate(selectedDate)) { showToast('Não é possível agendar uma data passada.'); syncDatePicker(); return; } currentDate = selectedDate; selectedCourt = null; selectedTime = null; updateRecurrenceOptions(); await renderCourts(); updateSummary(); });
$('#openCalendar').addEventListener('click', () => { const picker = $('#datePicker'); if (typeof picker.showPicker === 'function') picker.showPicker(); else picker.focus(); });
$('#confirmBooking').addEventListener('click', (event) => { if (isPastDate(currentDate)) { event.stopImmediatePropagation(); showToast('Não é possível agendar uma data passada.'); } }, true);
$('#loginForm').addEventListener('submit', async (event) => { event.preventDefault(); const login = $('#loginEmail').value.trim().toLowerCase(); const email = login === 'progtenis' ? 'programacaotennis@gmail.com' : login; const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: $('#loginPassword').value }); if (error) { showToast(error.message); return; } currentUser = data.user; const { data: profile } = await supabaseClient.from('profiles').select('full_name, email, role').eq('id', currentUser.id).single(); await openApp(profile); });
$('#resendConfirmation')?.addEventListener('click', async (event) => { event.preventDefault(); const login = $('#loginEmail').value.trim().toLowerCase(); const email = login === 'progtenis' ? 'programacaotennis@gmail.com' : login; if (!email || !email.includes('@')) { showToast('Informe seu e-mail para reenviar a confirmação.'); return; } const { error } = await supabaseClient.auth.resend({ type: 'signup', email, options: { emailRedirectTo: authRedirectUrl } }); showToast(error ? error.message : 'Novo e-mail de confirmação enviado. Verifique spam e promoções.'); });
$('#signupForm').addEventListener('submit', async (event) => { event.preventDefault(); const name = $('#signupName').value.trim(); const { data, error } = await supabaseClient.auth.signUp({ email: $('#signupEmail').value.trim(), password: $('#signupPassword').value, options: { data: { full_name: name } } }); if (error) { showToast(error.message); return; } if (!data.session) { showToast('Conta criada. Confirme seu e-mail para entrar.'); return; } currentUser = data.user; await openApp({ full_name: name, role: 'member' }); });
$('.text-link').addEventListener('click', async (event) => { event.preventDefault(); const email = $('#loginEmail').value.trim(); if (!email) { showToast('Informe seu e-mail para recuperar a senha.'); return; } const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl }); showToast(error ? error.message : 'Enviamos o link de recuperação para seu e-mail.'); });
$('#logoutButton').addEventListener('click', async () => { await supabaseClient.auth.signOut(); clearInterval(notificationPollingId); notificationPollingId = null; unreadNotificationCount = null; notificationLoadErrorShown = false; currentUser = null; document.body.classList.remove('app-open'); $('#appScreen').classList.add('hidden'); $('#authScreen').classList.remove('hidden'); });
$('#mobileLogout').addEventListener('click', async () => { await supabaseClient.auth.signOut(); clearInterval(notificationPollingId); notificationPollingId = null; unreadNotificationCount = null; notificationLoadErrorShown = false; currentUser = null; document.body.classList.remove('app-open'); $('#appScreen').classList.add('hidden'); $('#authScreen').classList.remove('hidden'); });
function openCancelBookingModal(ids) { bookingIdsToCancel = ids; const count = ids.length; $('#cancelBookingTitle').textContent = count === 1 ? 'Desistir desta reserva?' : `Desistir de ${count} reservas?`; $('#cancelBookingMessage').textContent = count === 1 ? 'Este horário ficará disponível para outros membros e não poderá ser recuperado automaticamente.' : 'Todos estes horários ficarão disponíveis para outros membros e não poderão ser recuperados automaticamente.'; $('#cancelBookingModal').classList.remove('hidden'); $('#confirmCancelBooking').focus(); }
function closeCancelBookingModal() { $('#cancelBookingModal').classList.add('hidden'); bookingIdsToCancel = []; }
$('#reservationList').addEventListener('click', (event) => { const button = event.target.closest('.cancel-booking'); if (!button) return; openCancelBookingModal([button.dataset.bookingId]); });
$('#reservationList').addEventListener('change', (event) => { const checkbox = event.target.closest('.reservation-selection'); if (!checkbox) return; if (checkbox.checked) selectedReservationIds.add(checkbox.dataset.bookingId); else selectedReservationIds.delete(checkbox.dataset.bookingId); updateReservationActions(); });
$('#selectAllReservations').addEventListener('change', (event) => { $$('.reservation-selection').forEach((checkbox) => { if (event.target.checked) selectedReservationIds.add(checkbox.dataset.bookingId); else selectedReservationIds.delete(checkbox.dataset.bookingId); checkbox.checked = event.target.checked; }); updateReservationActions(); });
$('#cancelSelectedBookings').addEventListener('click', () => { if (selectedReservationIds.size) openCancelBookingModal([...selectedReservationIds]); });
$('#keepBookingButton').addEventListener('click', closeCancelBookingModal);
$('#cancelBookingModal').addEventListener('click', (event) => { if (event.target.id === 'cancelBookingModal') closeCancelBookingModal(); });
$('#confirmCancelBooking').addEventListener('click', async () => { if (!bookingIdsToCancel.length) return; const button = $('#confirmCancelBooking'); const cancelledBookingIds = bookingIdsToCancel; button.disabled = true; button.querySelector('span').textContent = '...'; const { error } = await supabaseClient.from('bookings').update({ status: 'cancelled' }).in('id', cancelledBookingIds).eq('user_id', currentUser.id); button.disabled = false; button.querySelector('span').textContent = '→'; if (error) { showToast(error.message); return; } selectedReservationIds = new Set(); closeCancelBookingModal(); showToast(cancelledBookingIds.length === 1 ? 'Reserva cancelada e horário liberado.' : 'Reservas canceladas e horários liberados.'); await Promise.all(cancelledBookingIds.map(sendCancelledBookingPush)); await renderReservations(); await renderCourts(); });
$('#notificationButton').addEventListener('click', async () => { $('#notificationPanel').classList.toggle('hidden'); await loadNotifications(); });
$('#closeNotifications').addEventListener('click', () => $('#notificationPanel').classList.add('hidden'));
$('#enablePushButton').addEventListener('click', enablePushNotifications);
$('#scrollToCourts').addEventListener('click', () => $('#courtList').scrollIntoView({ behavior: 'smooth', block: 'start' }));
$('#clearNotificationsButton').addEventListener('click', async () => { const { error } = await supabaseClient.from('notifications').update({ read: true }).eq('user_id', currentUser.id).eq('read', false); if (error) { showToast(error.message); return; } showToast('Notificações limpas.'); await loadNotifications(); });
$('#notificationList').addEventListener('click', async (event) => { const item = event.target.closest('.notification-item'); if (!item) return; await supabaseClient.from('notifications').update({ read: true }).eq('id', item.dataset.notificationId); if (item.dataset.date) currentDate = new Date(`${item.dataset.date}T12:00:00`); selectedCourt = courts.find((court) => court.id === Number(item.dataset.courtId)) || null; selectedTime = item.dataset.time || null; $('#notificationPanel').classList.add('hidden'); $$('.nav-item, .mobile-nav-item[data-view]').forEach((button) => button.classList.remove('active')); $$('[data-view="booking"]').forEach((button) => button.classList.add('active')); $$('.view').forEach((view) => view.classList.remove('active-view')); $('#bookingView').classList.add('active-view'); await renderCourts(); updateSummary(); await loadNotifications(); });
$$('.nav-item, .mobile-nav-item[data-view]').forEach((item) => item.addEventListener('click', async () => { $$('.nav-item, .mobile-nav-item[data-view]').forEach((button) => button.classList.remove('active')); $$(`.nav-item[data-view="${item.dataset.view}"], .mobile-nav-item[data-view="${item.dataset.view}"]`).forEach((button) => button.classList.add('active')); $$('.view').forEach((view) => view.classList.remove('active-view')); $(`#${item.dataset.view}View`).classList.add('active-view'); if (item.dataset.view === 'courtBookings') await renderCourtBookings(); }));
$('#courtBookingCourt').addEventListener('change', async () => { bookingCalendarCourtId = $('#courtBookingCourt').value; await renderCourtBookings(); });
$('#prevBookingMonth').addEventListener('click', async () => { bookingCalendarMonth = new Date(bookingCalendarMonth.getFullYear(), bookingCalendarMonth.getMonth() - 1, 1); await renderCourtBookings(); });
$('#nextBookingMonth').addEventListener('click', async () => { bookingCalendarMonth = new Date(bookingCalendarMonth.getFullYear(), bookingCalendarMonth.getMonth() + 1, 1); await renderCourtBookings(); });
$('#prevDay').addEventListener('click', async () => { if ($('#prevDay').disabled) return; currentDate.setDate(currentDate.getDate() - 1); selectedCourt = null; selectedTime = null; updateRecurrenceOptions(); await renderCourts(); updateSummary(); });
$('#nextDay').addEventListener('click', async () => { currentDate.setDate(currentDate.getDate() + 1); selectedCourt = null; selectedTime = null; updateRecurrenceOptions(); await renderCourts(); updateSummary(); });
$('#confirmBooking').addEventListener('click', async () => {
    if (!selectedCourt || !selectedTime || !currentUser) return;
    const recurrenceType = $('#recurrenceType').value;
    const recurrenceCount = recurrenceType === 'once' ? 1 : Math.max(1, Math.min(recurrenceLimit(recurrenceType), Number($('#recurrenceCount').value) || 1));
    const monthlyOccurrences = Math.min(30, new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate() - currentDate.getDate() + 1);
    const occurrenceTotal = recurrenceType === 'monthly' ? monthlyOccurrences : recurrenceCount;
    const { count, error: countError } = await supabaseClient.from('bookings').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id).eq('court_id', selectedCourt.id).eq('start_time', selectedTime).eq('status', 'confirmed').gte('booking_date', dateValue(today));
    if (!countError && (count || 0) + occurrenceTotal > 30) {
        showToast(`Limite de 30 dias: você já utilizou por 30 dias sequenciais essa ${selectedCourt.name} nesse horário das ${selectedTime}h.`, 'error');
        return;
    }
    const button = $('#confirmBooking');
    button.disabled = true;
    button.querySelector('span').textContent = '...';
    const { error } = await supabaseClient.rpc('create_recurring_booking', { p_court_id: selectedCourt.id, p_booking_date: dateValue(currentDate), p_start_time: selectedTime, p_recurrence_type: recurrenceType, p_recurrence_count: recurrenceCount });
    button.disabled = false;
    button.querySelector('span').textContent = '→';
    if (error) { showToast(error.code === '42883' ? 'Execute a migração de recorrência no Supabase.' : error.message || 'Não foi possível confirmar a reserva.'); await renderCourts(); return; }
    showToast(recurrenceType === 'monthly' || recurrenceCount > 1 ? 'Reservas recorrentes confirmadas!' : 'Reserva confirmada com sucesso!');
    selectedCourt = null;
    selectedTime = null;
    $('#recurrenceType').value = 'once';
    $('#recurrenceCount').value = 1;
    await renderCourts();
    updateSummary();
    await renderReservations();
});
let editingCourtId = null;
function openCourtModal(court = null) { editingCourtId = court?.id || null; $('#courtModalTitle').textContent = court ? 'Editar quadra' : 'Nova quadra'; $('#courtName').value = court?.name || ''; $('#courtSurface').value = court?.surface || 'Saibro'; $('#courtLocation').value = court?.location || 'Externa'; $('#courtActive').checked = court?.active ?? true; $('#deleteCourtButton').classList.toggle('hidden', !editingCourtId); $('#courtModal').classList.remove('hidden'); $('#courtName').focus(); }
function closeCourtModal() { $('#courtModal').classList.add('hidden'); editingCourtId = null; $('#courtForm').reset(); $('#courtActive').checked = true; }
$('#newCourtButton').addEventListener('click', () => { if (currentProfile?.role === 'admin') openCourtModal(); });
$('#closeCourtModal').addEventListener('click', closeCourtModal);
$('#cancelCourtModal').addEventListener('click', closeCourtModal);
$('#courtModal').addEventListener('click', (event) => { if (event.target.id === 'courtModal') closeCourtModal(); });
$('#deleteCourtButton').addEventListener('click', async () => { if (!editingCourtId || !window.confirm('Excluir esta quadra? Esta ação não pode ser desfeita.')) return; const { data: bookings, error: bookingError } = await supabaseClient.from('bookings').select('id').eq('court_id', editingCourtId).limit(1); if (bookingError) { showToast(bookingError.message); return; } if (bookings?.length) { showToast('Esta quadra possui reservas no histórico e não pode ser excluída. Desative-a para impedir novas reservas.'); return; } const { error } = await supabaseClient.from('courts').delete().eq('id', editingCourtId); if (error) { showToast(error.message); return; } closeCourtModal(); showToast('Quadra excluída com sucesso.'); await loadCourts(); await loadAvailability(); await renderCourts(); renderAdminCourts(); await renderAdminStats(); });
$('#courtForm').addEventListener('submit', async (event) => { event.preventDefault(); const wasEditing = Boolean(editingCourtId); const payload = { name: $('#courtName').value.trim(), surface: $('#courtSurface').value, location: $('#courtLocation').value, active: $('#courtActive').checked }; const query = wasEditing ? supabaseClient.from('courts').update(payload).eq('id', editingCourtId) : supabaseClient.from('courts').insert(payload).select('id').single(); const { data: createdCourt, error } = await query; if (error) { showToast(error.message); return; } if (!wasEditing && createdCourt) { const courtAvailability = [0, 1, 2, 3, 4, 5, 6].flatMap((day) => bookingSlots.map((start) => ({ court_id: createdCourt.id, day_of_week: day, start_time: start, end_time: endTime(start) }))); const { error: availabilityError } = await supabaseClient.from('availability').insert(courtAvailability); if (availabilityError) { showToast(availabilityError.message); return; } } closeCourtModal(); showToast(wasEditing ? 'Quadra atualizada com sucesso.' : 'Quadra criada com sucesso.'); await loadCourts(); await loadAvailability(); await renderCourts(); renderAdminCourts(); await renderAdminStats(); });
$('#courtAdminList').addEventListener('click', (event) => { const button = event.target.closest('.edit-court'); if (button) openCourtModal(courts.find((court) => court.id === Number(button.dataset.courtId))); });
$('#memberList').addEventListener('click', async (event) => { const button = event.target.closest('.toggle-admin'); if (!button || button.dataset.memberId === currentUser.id) { if (button?.dataset.memberId === currentUser.id) showToast('Você não pode alterar o próprio acesso por aqui.'); return; } const role = button.dataset.role === 'admin' ? 'member' : 'admin'; const { error } = await supabaseClient.from('profiles').update({ role }).eq('id', button.dataset.memberId); if (error) { showToast(error.message); return; } showToast(role === 'admin' ? 'Usuário promovido a administrador.' : 'Administrador removido.'); await renderMembers(); });
$('#changeAccessButton')?.addEventListener('click', async () => { const email = window.prompt('Novo e-mail de acesso:', currentUser.email); const password = window.prompt('Nova senha (deixe vazio para manter a atual):'); const updates = {}; if (email?.trim() && email.trim() !== currentUser.email) updates.email = email.trim(); if (password) updates.password = password; if (!Object.keys(updates).length) return; const { error } = await supabaseClient.auth.updateUser(updates); if (error) { showToast(error.message); return; } showToast(updates.email ? 'E-mail atualizado. Confirme-o na sua caixa de entrada.' : 'Senha atualizada com sucesso.'); });
supabaseClient.auth.onAuthStateChange((_event, session) => { if (session && !currentUser) { currentUser = session.user; loadSession(); } });
updateRecurrenceOptions();
loadSession();
