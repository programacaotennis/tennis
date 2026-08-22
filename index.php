<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Programação Tênis | Agende sua quadra</title>
    <meta name="description" content="Agende sua quadra de tênis de forma simples e rápida.">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/styles.css">
</head>
<body>
    <main class="auth-shell" id="authScreen">
        <section class="brand-panel">
            <div class="brand-copy">
                <img src="src/img/vector/isolated-monochrome-white.svg" alt="" class="brand-mark">
                <p class="eyebrow">PROGRAMACAO TENIS</p>
                <h1>Seu próximo<br><em>match point</em><br>começa aqui.</h1>
                <p class="brand-description">Quadras, horários e partidas em um só lugar.</p>
            </div>
            <p class="brand-footer">DO PRIMEIRO CLIQUE AO MATCH POINT</p>
        </section>

        <section class="auth-panel">
            <div class="auth-card">
                <div class="auth-heading">
                    <span class="mini-logo">PT</span>
                    <span class="status-pill"><span></span> Clube online</span>
                </div>
                <div class="auth-title">
                    <p class="eyebrow">BEM-VINDO DE VOLTA</p>
                    <h2>Entre em quadra.</h2>
                    <p>Gerencie suas reservas e encontre seu próximo horário.</p>
                </div>

                <div class="auth-tabs" role="tablist">
                    <button class="tab-button active" data-auth-tab="login" role="tab">Entrar</button>
                    <button class="tab-button" data-auth-tab="signup" role="tab">Criar conta</button>
                </div>

                <form id="loginForm" class="auth-form active-form">
                    <label for="loginEmail">Login ou e-mail</label>
                    <input id="loginEmail" type="text" placeholder="progtenis ou voce@email.com" required>
                    <div class="label-row"><label for="loginPassword">Senha</label><a href="#" class="text-link">Esqueci minha senha</a></div>
                    <input id="loginPassword" type="password" placeholder="Sua senha" required>
                    <button class="primary-button" type="submit">Entrar <span>→</span></button>
                </form>

                <form id="signupForm" class="auth-form">
                    <label for="signupName">Nome completo</label>
                    <input id="signupName" type="text" placeholder="Como podemos te chamar?" required>
                    <label for="signupEmail">E-mail</label>
                    <input id="signupEmail" type="email" placeholder="voce@email.com" required>
                    <label for="signupPassword">Crie uma senha</label>
                    <input id="signupPassword" type="password" placeholder="Mínimo de 6 caracteres" minlength="6" required>
                    <button class="primary-button" type="submit">Criar minha conta <span>→</span></button>
                </form>

                <div class="divider"><span>ou continue com</span></div>
                <button class="google-button" type="button" id="googleButton"><span class="google-g">G</span> Continuar com Google</button>
                <p class="demo-hint">O acesso administrativo usa o login <strong>progtenis</strong>.</p>
            </div>
        </section>
    </main>

    <main class="app-shell hidden" id="appScreen">
        <aside class="sidebar">
            <div class="sidebar-brand"><span class="mini-logo">PT</span><div><strong>Programação</strong><small>Tênis</small></div></div>
            <nav class="main-nav" aria-label="Navegação principal">
                <button class="nav-item active" data-view="booking"><span>◷</span> Reservar quadra</button>
                <button class="nav-item" data-view="reservations"><span>✓</span> Minhas reservas</button>
                <button class="nav-item admin-only" data-view="admin"><span>⌘</span> Administração</button>
            </nav>
            <div class="sidebar-bottom"><div class="club-note"><span class="pulse-dot"></span><div><strong>Clube aberto</strong><small>Hoje, 06:00 — 22:00</small></div></div><button class="logout-button" id="logoutButton">Sair da conta <span>↗</span></button></div>
        </aside>

        <section class="content-area">
            <header class="topbar"><div class="mobile-brand"><span class="mini-logo">PT</span> Programação Tênis</div><div class="topbar-actions"><button class="icon-button" id="notificationButton" title="Notificações">♢<i></i></button><div class="user-menu"><div class="avatar" id="userAvatar">VC</div><div><strong id="userName">Visitante</strong><small id="userRole">Membro</small></div></div></div></header>

            <div class="view active-view" id="bookingView">
                <div class="page-intro"><div><p class="eyebrow">RESERVE SEU MOMENTO</p><h2>Escolha quando jogar.</h2><p>Selecione uma quadra e um horário disponível para confirmar sua partida.</p></div><div class="date-control"><button id="prevDay">‹</button><div><small>DATA DA RESERVA</small><strong id="selectedDateLabel">Hoje</strong><input id="datePicker" type="date" aria-label="Escolha a data da reserva"></div><button id="nextDay">›</button></div></div>
                <div class="booking-layout"><div class="court-list" id="courtList"></div><aside class="summary-panel"><div class="summary-top"><span class="eyebrow">SUA RESERVA</span><span class="summary-icon">◒</span></div><div id="emptySummary" class="empty-summary"><span>＋</span><p>Escolha uma quadra<br>e um horário para começar.</p></div><div id="filledSummary" class="filled-summary hidden"><div class="summary-court"><div class="court-thumb"></div><div><strong id="summaryCourt">Quadra 1</strong><small id="summaryType">Saibro · Externa</small></div></div><div class="summary-line"><span>Data</span><strong id="summaryDate">24 ago, 2026</strong></div><div class="summary-line"><span>Horário</span><strong id="summaryTime">08:00 — 10:00</strong></div><label for="recurrenceType">Periodicidade</label><select id="recurrenceType"><option value="once">Somente este dia</option><option value="daily">Diária</option><option value="weekly">Semanal</option><option value="monthly">Mensal</option></select><label for="recurrenceCount">Quantidade de ocorrências</label><select id="recurrenceCount" aria-label="Quantidade de ocorrências"></select><button class="primary-button" id="confirmBooking">Confirmar reserva <span>→</span></button></div><div class="summary-foot">Cada ocorrência dura 2 horas. Reservas repetidas dependem da disponibilidade.</div></aside></div>
            </div>

            <div class="view" id="reservationsView"><div class="page-intro compact"><div><p class="eyebrow">SUA AGENDA</p><h2>Minhas reservas.</h2><p>Confira seus próximos encontros em quadra.</p></div></div><div class="reservation-list" id="reservationList"></div></div>

            <div class="view" id="adminView"><div class="page-intro compact"><div><p class="eyebrow">ÁREA RESTRITA</p><h2>Painel do clube.</h2><p>Uma visão rápida da operação de hoje.</p></div><button class="primary-button small" id="newCourtButton">＋ Nova quadra</button></div><div class="admin-grid"><div class="stat-card"><span>RESERVAS HOJE</span><strong id="bookingCount">12</strong><small class="positive">↑ 18% esta semana</small></div><div class="stat-card"><span>QUADRAS ATIVAS</span><strong>04</strong><small>todas operacionais</small></div><div class="stat-card"><span>TAXA DE OCUPAÇÃO</span><strong>68%</strong><small>últimos 7 dias</small></div></div><div class="admin-section"><div class="section-heading"><div><h3>Quadras e disponibilidade</h3><p>Configure os horários que os membros podem reservar.</p></div><span class="table-date">Hoje, 24 ago</span></div><div class="court-admin-list" id="courtAdminList"></div></div><div class="admin-section members-section"><div class="section-heading"><div><h3>Administradores</h3><p>Defina quem pode gerenciar o clube.</p></div></div><div class="member-row"><div class="avatar admin-avatar">MC</div><div><strong>Marina Costa</strong><small>admin@programacaotenis.com · Administradora principal</small></div><span class="role-badge">Admin</span></div><div class="member-row"><div class="avatar">RS</div><div><strong>Rafael Souza</strong><small>rafael@email.com · Membro desde jun 2026</small></div><button class="outline-button">Tornar admin</button></div></div></div>
        </section>
    </main>
    <div class="toast" id="toast" role="status"></div>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="assets/app.js"></script>
</body>
</html>