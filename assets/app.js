const supabaseUrl = 'https://uakjpmkkcxbmizfsxdqj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVha2pwbWtrY3hibWl6ZnN4ZHFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczODM4MzUsImV4cCI6MjEwMjk1OTgzNX0.thBY1EhLkUop9kTuv6ZwfXG1C4AcQ2hOEI8p8yxsCz8';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
const productionUrl = 'https://tennis.programacaotennis.workers.dev';
const authRedirectUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? window.location.origin : productionUrl;
const bookingSlots = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
let selectedCourt = null;
let selectedTime = null;
let currentUser = null;
let currentProfile = null;
let courts = [];
const today = new Date();
let currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function showToast(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3000); }
function formatDate(date) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date).replace('.', ''); }
function dateLabel(date) { const label = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'long' }).format(date).replace('.', ''); return label.charAt(0).toUpperCase() + label.slice(1); }
function dateValue(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function endTime(startTime) { return `${String(Number(startTime.slice(0, 2)) + 2).padStart(2, '0')}:00`; }
function recurrenceDates(startDate, type, count) { const dates = []; const date = new Date(`${startDate}T12:00:00`); for (let index = 0; index < count; index += 1) { dates.push(dateValue(date)); if (type === 'daily') date.setDate(date.getDate() + 1); if (type === 'weekly') date.setDate(date.getDate() + 7); if (type === 'monthly') date.setMonth(date.getMonth() + 1); } return dates; }
function recurrenceLimit(type) { if (type === 'monthly') return 1; if (type === 'weekly') { const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate(); return Math.min(5, Math.floor((daysInMonth - currentDate.getDate()) / 7) + 1); } return type === 'daily' ? 30 : 1; }
function updateRecurrenceOptions() { const type = $('#recurrenceType').value; const limit = Math.max(1, recurrenceLimit(type)); const count = $('#recurrenceCount'); count.innerHTML = Array.from({ length: limit }, (_, index) => `<option value="${index + 1}">${index + 1} ${index === 0 ? 'ocorrência' : 'ocorrências'}</option>`).join(''); count.value = '1'; }
function isPastDate(date) { const current = new Date(); current.setHours(0, 0, 0, 0); return date < current; }
function syncDatePicker() { const picker = $('#datePicker'); if (picker) { picker.value = dateValue(currentDate); picker.min = dateValue(new Date(today.getFullYear(), today.getMonth(), today.getDate())); } $('#prevDay').disabled = isPastDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 1)); }

async function loadCourts() {
    const { data, error } = await supabaseClient.from('courts').select('id, name, surface, location').eq('active', true).order('id');
    if (error) throw error;
    courts = data || [];
}

async function loadBookedSlots() {
    const { data, error } = await supabaseClient.rpc('get_booked_slots', { p_booking_date: dateValue(currentDate) });
    if (error) throw error;
    return new Set((data || []).map((booking) => `${booking.court_id}-${booking.start_time.slice(0, 5)}`));
}

async function renderCourts() {
    $('#selectedDateLabel').textContent = dateLabel(currentDate);
    syncDatePicker();
    const list = $('#courtList');
    if (!courts.length) { list.innerHTML = '<div class="empty-summary"><p>Nenhuma quadra ativa foi cadastrada.</p></div>'; return; }
    try {
        const bookedSlots = await loadBookedSlots();
        list.innerHTML = courts.map((court) => `<article class="court-row ${selectedCourt?.id === court.id ? 'selected' : ''}"><span class="court-color"></span><div><strong class="court-name">${court.name}</strong><span class="court-meta">${court.surface} · ${court.location}</span></div><div class="time-grid">${bookingSlots.map((slot) => { const unavailable = bookedSlots.has(`${court.id}-${slot}`); return `<button class="time-slot ${unavailable ? 'unavailable' : ''} ${selectedCourt?.id === court.id && selectedTime === slot ? 'selected' : ''}" data-court="${court.id}" data-time="${slot}" ${unavailable ? 'disabled' : ''}>${slot}</button>`; }).join('')}</div></article>`).join('');
        $$('.time-slot:not(:disabled)').forEach((button) => button.addEventListener('click', () => { selectedCourt = courts.find((court) => court.id === Number(button.dataset.court)); selectedTime = button.dataset.time; renderCourts(); updateSummary(); }));
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
    list.innerHTML = data?.length ? data.map((reservation) => `<div class="reservation-item"><div><strong>${reservation.courts.name}</strong><small>${reservation.courts.surface} · ${reservation.courts.location} · ${reservation.booking_date}</small></div><time>${reservation.start_time.slice(0, 5)} — ${reservation.end_time.slice(0, 5)}</time><button class="outline-button cancel-booking" data-booking-id="${reservation.id}">Desistir</button></div>`).join('') : '<div class="empty-summary"><span>＋</span><p>Você ainda não tem reservas.<br>Seu próximo jogo começa com um clique.</p></div>';
}

async function loadNotifications() { const { data } = await supabaseClient.from('notifications').select('message').eq('user_id', currentUser.id).eq('read', false).order('created_at', { ascending: false }).limit(5); if (data?.length) { $('#notificationButton').classList.add('has-notifications'); $('#notificationButton').title = `${data.length} nova(s) notificação(ões)`; } }

function renderAdminCourts() { $('#activeCourtCount').textContent = String(courts.length).padStart(2, '0'); $('#courtAdminList').innerHTML = courts.map((court) => `<div class="court-admin-row"><span class="admin-court-icon">⌂</span><div><strong>${court.name}</strong><small>${court.surface} · ${court.location}</small></div><span class="admin-court-state">Ativa</span><button class="outline-button edit-court" data-court-id="${court.id}">Editar</button></div>`).join(''); }
async function renderMembers() { const { data, error } = await supabaseClient.from('profiles').select('id, full_name, email, role').order('full_name'); if (error) { showToast(error.message); return; } $('#memberList').innerHTML = (data || []).map((member) => `<div class="member-row"><div class="avatar">${(member.full_name || '?').slice(0, 2).toUpperCase()}</div><div><strong>${member.full_name || 'Usuário'}</strong><small>${member.email || 'E-mail não informado'}</small></div><span class="role-badge">${member.role === 'admin' ? 'Admin' : 'Membro'}</span><button class="outline-button toggle-admin" data-member-id="${member.id}" data-role="${member.role}">${member.role === 'admin' ? 'Remover admin' : 'Tornar admin'}</button></div>`).join('') || '<p>Nenhum usuário cadastrado.</p>'; }

async function openApp(profile) {
    currentProfile = profile;
    $('#authScreen').classList.add('hidden'); $('#appScreen').classList.remove('hidden');
    const name = profile.full_name || currentUser.email.split('@')[0];
    $('#userName').textContent = name; $('#userRole').textContent = profile.role === 'admin' ? 'Administrador' : 'Membro'; const avatar = $('#userAvatar'); avatar.textContent = name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase(); const avatarUrl = currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture; if (avatarUrl) { avatar.textContent = ''; avatar.style.backgroundImage = `url("${avatarUrl}")`; avatar.classList.add('has-image'); }
    $$('.admin-only').forEach((item) => item.classList.toggle('hidden', profile.role !== 'admin'));
    try { await loadCourts(); await renderCourts(); await renderReservations(); await loadNotifications(); renderAdminCourts(); if (profile.role === 'admin') await renderMembers(); } catch (error) { showToast(error.message); }
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
$('#recurrenceType').addEventListener('change', updateRecurrenceOptions);
$('#datePicker').addEventListener('change', async () => { const selectedDate = new Date(`${$('#datePicker').value}T12:00:00`); if (isPastDate(selectedDate)) { showToast('Não é possível agendar uma data passada.'); syncDatePicker(); return; } currentDate = selectedDate; selectedCourt = null; selectedTime = null; updateRecurrenceOptions(); await renderCourts(); updateSummary(); });
$('#openCalendar').addEventListener('click', () => { const picker = $('#datePicker'); if (typeof picker.showPicker === 'function') picker.showPicker(); else picker.focus(); });
$('#confirmBooking').addEventListener('click', (event) => { if (isPastDate(currentDate)) { event.stopImmediatePropagation(); showToast('Não é possível agendar uma data passada.'); } }, true);
$('#loginForm').addEventListener('submit', async (event) => { event.preventDefault(); const login = $('#loginEmail').value.trim().toLowerCase(); const email = login === 'progtenis' ? 'programacaotennis@gmail.com' : login; const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: $('#loginPassword').value }); if (error) { showToast(error.message); return; } currentUser = data.user; const { data: profile } = await supabaseClient.from('profiles').select('full_name, email, role').eq('id', currentUser.id).single(); await openApp(profile); });
$('#resendConfirmation')?.addEventListener('click', async (event) => { event.preventDefault(); const login = $('#loginEmail').value.trim().toLowerCase(); const email = login === 'progtenis' ? 'programacaotennis@gmail.com' : login; if (!email || !email.includes('@')) { showToast('Informe seu e-mail para reenviar a confirmação.'); return; } const { error } = await supabaseClient.auth.resend({ type: 'signup', email, options: { emailRedirectTo: authRedirectUrl } }); showToast(error ? error.message : 'Novo e-mail de confirmação enviado. Verifique spam e promoções.'); });
$('#signupForm').addEventListener('submit', async (event) => { event.preventDefault(); const name = $('#signupName').value.trim(); const { data, error } = await supabaseClient.auth.signUp({ email: $('#signupEmail').value.trim(), password: $('#signupPassword').value, options: { data: { full_name: name } } }); if (error) { showToast(error.message); return; } if (!data.session) { showToast('Conta criada. Confirme seu e-mail para entrar.'); return; } currentUser = data.user; await openApp({ full_name: name, role: 'member' }); });
$('#googleButton').addEventListener('click', async () => { const { error } = await supabaseClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: authRedirectUrl, queryParams: { prompt: 'select_account' } } }); if (error) showToast(error.message); });
$('.text-link').addEventListener('click', async (event) => { event.preventDefault(); const email = $('#loginEmail').value.trim(); if (!email) { showToast('Informe seu e-mail para recuperar a senha.'); return; } const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl }); showToast(error ? error.message : 'Enviamos o link de recuperação para seu e-mail.'); });
$('#logoutButton').addEventListener('click', async () => { await supabaseClient.auth.signOut(); currentUser = null; $('#appScreen').classList.add('hidden'); $('#authScreen').classList.remove('hidden'); });
$('#mobileLogout').addEventListener('click', async () => { await supabaseClient.auth.signOut(); currentUser = null; $('#appScreen').classList.add('hidden'); $('#authScreen').classList.remove('hidden'); });
$('#reservationList').addEventListener('click', async (event) => { const button = event.target.closest('.cancel-booking'); if (!button) return; if (!window.confirm('Deseja liberar este horário para outro usuário?')) return; button.disabled = true; const { error } = await supabaseClient.from('bookings').update({ status: 'cancelled' }).eq('id', button.dataset.bookingId).eq('user_id', currentUser.id); if (error) { showToast(error.message); button.disabled = false; return; } showToast('Reserva cancelada e horário liberado.'); await renderReservations(); await renderCourts(); });
$('#notificationButton').addEventListener('click', async () => { const { data, error } = await supabaseClient.from('notifications').select('id, message').eq('user_id', currentUser.id).eq('read', false).order('created_at', { ascending: false }).limit(5); if (error) { showToast('Execute a migração de notificações no Supabase.'); return; } if (!data?.length) { showToast('Você não tem novas notificações.'); return; } data.forEach((notification) => showToast(notification.message)); await supabaseClient.from('notifications').update({ read: true }).in('id', data.map((notification) => notification.id)); $('#notificationButton').classList.remove('has-notifications'); });
$$('.nav-item, .mobile-nav-item[data-view]').forEach((item) => item.addEventListener('click', () => { $$('.nav-item, .mobile-nav-item[data-view]').forEach((button) => button.classList.remove('active')); $$(`.nav-item[data-view="${item.dataset.view}"], .mobile-nav-item[data-view="${item.dataset.view}"]`).forEach((button) => button.classList.add('active')); $$('.view').forEach((view) => view.classList.remove('active-view')); $(`#${item.dataset.view}View`).classList.add('active-view'); }));
$('#prevDay').addEventListener('click', async () => { if ($('#prevDay').disabled) return; currentDate.setDate(currentDate.getDate() - 1); selectedCourt = null; selectedTime = null; updateRecurrenceOptions(); await renderCourts(); updateSummary(); });
$('#nextDay').addEventListener('click', async () => { currentDate.setDate(currentDate.getDate() + 1); selectedCourt = null; selectedTime = null; updateRecurrenceOptions(); await renderCourts(); updateSummary(); });
$('#confirmBooking').addEventListener('click', async () => { if (!selectedCourt || !selectedTime || !currentUser) return; const button = $('#confirmBooking'); button.disabled = true; button.querySelector('span').textContent = '...'; const recurrenceType = $('#recurrenceType').value; const recurrenceCount = recurrenceType === 'once' ? 1 : Math.max(1, Math.min(31, Number($('#recurrenceCount').value) || 1)); const { error } = await supabaseClient.rpc('create_recurring_booking', { p_court_id: selectedCourt.id, p_booking_date: dateValue(currentDate), p_start_time: selectedTime, p_recurrence_type: recurrenceType, p_recurrence_count: recurrenceCount }); button.disabled = false; button.querySelector('span').textContent = '→'; if (error) { showToast(error.code === '42883' ? 'Execute a migração de recorrência no Supabase.' : error.message); await renderCourts(); return; } showToast(recurrenceCount > 1 ? 'Reservas recorrentes confirmadas!' : 'Reserva confirmada com sucesso!'); selectedCourt = null; selectedTime = null; $('#recurrenceType').value = 'once'; $('#recurrenceCount').value = 1; await renderCourts(); updateSummary(); await renderReservations(); });
let editingCourtId = null;
function openCourtModal(court = null) { editingCourtId = court?.id || null; $('#courtModalTitle').textContent = court ? 'Editar quadra' : 'Nova quadra'; $('#courtName').value = court?.name || ''; $('#courtSurface').value = court?.surface || 'Saibro'; $('#courtLocation').value = court?.location || 'Externa'; $('#courtActive').checked = court?.active ?? true; $('#courtModal').classList.remove('hidden'); $('#courtName').focus(); }
function closeCourtModal() { $('#courtModal').classList.add('hidden'); editingCourtId = null; $('#courtForm').reset(); $('#courtActive').checked = true; }
$('#newCourtButton').addEventListener('click', () => { if (currentProfile?.role === 'admin') openCourtModal(); });
$('#closeCourtModal').addEventListener('click', closeCourtModal);
$('#cancelCourtModal').addEventListener('click', closeCourtModal);
$('#courtModal').addEventListener('click', (event) => { if (event.target.id === 'courtModal') closeCourtModal(); });
$('#courtForm').addEventListener('submit', async (event) => { event.preventDefault(); const wasEditing = Boolean(editingCourtId); const payload = { name: $('#courtName').value.trim(), surface: $('#courtSurface').value, location: $('#courtLocation').value, active: $('#courtActive').checked }; const query = wasEditing ? supabaseClient.from('courts').update(payload).eq('id', editingCourtId) : supabaseClient.from('courts').insert(payload).select('id').single(); const { data: createdCourt, error } = await query; if (error) { showToast(error.message); return; } if (!wasEditing && createdCourt) { const availability = [0, 1, 2, 3, 4, 5, 6].flatMap((day) => bookingSlots.map((start) => ({ court_id: createdCourt.id, day_of_week: day, start_time: start, end_time: endTime(start) }))); const { error: availabilityError } = await supabaseClient.from('availability').insert(availability); if (availabilityError) { showToast(availabilityError.message); return; } } closeCourtModal(); showToast(wasEditing ? 'Quadra atualizada com sucesso.' : 'Quadra criada com sucesso.'); await loadCourts(); await renderCourts(); renderAdminCourts(); });
$('#courtAdminList').addEventListener('click', (event) => { const button = event.target.closest('.edit-court'); if (button) openCourtModal(courts.find((court) => court.id === Number(button.dataset.courtId))); });
$('#memberList').addEventListener('click', async (event) => { const button = event.target.closest('.toggle-admin'); if (!button || button.dataset.memberId === currentUser.id) { if (button?.dataset.memberId === currentUser.id) showToast('Você não pode alterar o próprio acesso por aqui.'); return; } const role = button.dataset.role === 'admin' ? 'member' : 'admin'; const { error } = await supabaseClient.from('profiles').update({ role }).eq('id', button.dataset.memberId); if (error) { showToast(error.message); return; } showToast(role === 'admin' ? 'Usuário promovido a administrador.' : 'Administrador removido.'); await renderMembers(); });
$('#changeAccessButton')?.addEventListener('click', async () => { const email = window.prompt('Novo e-mail de acesso:', currentUser.email); const password = window.prompt('Nova senha (deixe vazio para manter a atual):'); const updates = {}; if (email?.trim() && email.trim() !== currentUser.email) updates.email = email.trim(); if (password) updates.password = password; if (!Object.keys(updates).length) return; const { error } = await supabaseClient.auth.updateUser(updates); if (error) { showToast(error.message); return; } showToast(updates.email ? 'E-mail atualizado. Confirme-o na sua caixa de entrada.' : 'Senha atualizada com sucesso.'); });
supabaseClient.auth.onAuthStateChange((_event, session) => { if (session && !currentUser) { currentUser = session.user; loadSession(); } });
updateRecurrenceOptions();
loadSession();
