// Gerenciador de Interface do Usuário
class UIManager {
    constructor(clanManager) {
        this.clanManager = clanManager;
        this.currentPeriod = 'last24h';
        this.currentView = 'members';
        this.selectedMemberId = null;
        this.charts = {};
        
        // Cache de elementos DOM
        this.elements = {};
        
        // Inicializa após DOM carregar
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    initialize() {
        console.log('🎨 Inicializando UI Manager...');
        
        this.cacheElements();
        this.setupEventListeners();
        this.initializeCharts();
        this.startAnimations();
        
        // Configura callbacks do Clan Manager
        this.clanManager.onDataUpdate = this.updateUI.bind(this);
        this.clanManager.onNewMember = this.handleNewMember.bind(this);
        this.clanManager.onMemberOnline = this.handleMemberOnline.bind(this);
        this.clanManager.onMemberOffline = this.handleMemberOffline.bind(this);
        
        console.log('✅ UI Manager inicializado!');
    }

    cacheElements() {
        // Elementos principais
        this.elements.totalMembers = document.getElementById('totalMembers');
        this.elements.onlineMembers = document.getElementById('onlineMembers');
        this.elements.totalScore = document.getElementById('totalScore');
        
        // Containers
        this.elements.membersContainer = document.getElementById('membersContainer');
        this.elements.activityContainer = document.getElementById('activityContainer');
        this.elements.scoreContainer = document.getElementById('scoreContainer');
        this.elements.profileModal = document.getElementById('profileModal');
        this.elements.activityFeed = document.getElementById('activityFeed');
        this.elements.serverStatus = document.getElementById('serverStatus');
        
        // Tabs
        this.elements.timeTabs = document.querySelectorAll('.time-tab');
        this.elements.viewTabs = document.querySelectorAll('.view-tab');
    }

    setupEventListeners() {
        // Time period tabs
        this.elements.timeTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.playSound('click');
                this.switchPeriod(e.target.dataset.period);
            });
        });
        
        // View tabs
        this.elements.viewTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.playSound('click');
                this.switchView(e.target.dataset.view);
            });
        });
        
        // Search
        const searchInput = document.getElementById('searchMember');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterMembers(e.target.value);
            });
        }
        
        // Profile modal close
        const closeBtn = document.querySelector('.profile-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeProfile();
            });
        }
        
        // Click outside modal to close
        this.elements.profileModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.profileModal) {
                this.closeProfile();
            }
        });
        
        // Navbar scroll effect
        window.addEventListener('scroll', () => {
            const navbar = document.querySelector('.navbar');
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }

    initializeCharts() {
        // Gráfico de atividade por hora
        const hourlyCtx = document.getElementById('hourlyChart');
        if (hourlyCtx) {
            this.charts.hourly = new Chart(hourlyCtx, {
                type: 'bar',
                data: {
                    labels: Array.from({length: 24}, (_, i) => `${i}h`),
                    datasets: [{
                        label: 'Partidas',
                        data: new Array(24).fill(0),
                        backgroundColor: 'rgba(0, 255, 136, 0.5)', borderColor: 'rgba(0, 255, 136, 1)', borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#888' } }, x: { grid: { display: false }, ticks: { color: '#888' } } } } }); } // Gráfico de atividade semanal const weeklyCtx = document.getElementById('weeklyChart'); if (weeklyCtx) { this.charts.weekly = new Chart(weeklyCtx, { type: 'line', data: { labels: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'], datasets: [{ label: 'Atividade', data: new Array(7).fill(0), borderColor: 'rgba(255, 0, 255, 1)', backgroundColor: 'rgba(255, 0, 255, 0.1)', tension: 0.4, fill: true }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#888' } }, x: { grid: { display: false }, ticks: { color: '#888' } } } } }); } } updateUI(data) { // Atualiza estatísticas gerais this.updateStats(data.stats); // Atualiza lista baseada na view atual switch (this.currentView) { case 'members': this.updateMembersList(data.members); break; case 'activity': this.updateActivityList(data.activityMembers); break; case 'scores': this.updateScoresList(data.scoreMembers); break; } // Atualiza status dos servidores this.updateServerStatus(data.serverStatus); } updateStats(stats) { // Anima números this.animateNumber(this.elements.totalMembers, stats.totalMembers); this.animateNumber(this.elements.onlineMembers, stats.onlineMembers); this.animateNumber(this.elements.totalScore, stats.totalScore, true); } animateNumber(element, target, format = false) { if (!element) return; const start = parseInt(element.textContent.replace(/\D/g, '')) || 0; const duration = 1000; const startTime = performance.now(); const animate = (currentTime) => { const elapsed = currentTime - startTime; const progress = Math.min(elapsed / duration, 1); const current = Math.floor(start + (target - start) * this.easeOutQuart(progress)); if (format) { element.textContent = this.clanManager.wsManager.formatNumber(current); } else { element.textContent = current; } if (progress < 1) { requestAnimationFrame(animate); } }; requestAnimationFrame(animate); } easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); } updateMembersList(members) { if (!this.elements.membersContainer) return; const html = members.map((member, index) => ` <div class="col-lg-4 col-md-6 mb-4 fade-in" style="animation-delay: ${index * 0.05}s"> <div class="member-card" onclick="uiManager.showProfile(${member.id})"> <div class="member-status ${member.isOnline ? 'online' : 'offline'}"></div> <h5 class="member-name">${this.escapeHtml(member.nickname)}</h5> <p class="member-id">#${member.id}</p> <div class="member-stats"> <div class="stat-item"> <i class="fas fa-gamepad"></i> <span>${member.stats[this.currentPeriod].matches} partidas</span> </div> <div class="stat-item"> <i class="fas fa-clock"></i> <span>${member.formattedStats[this.currentPeriod].playTime}</span> </div> </div> </div> </div> `).join(''); this.elements.membersContainer.innerHTML = html; } updateActivityList(members) { if (!this.elements.activityContainer) return; const html = ` <div class="table-glow"> <table class="table"> <thead> <tr> <th>Pos</th> <th>Nick</th> <th>Partidas</th> <th>Tempo Jogado</th> </tr> </thead> <tbody> ${members.map((member, index) => ` <tr class="fade-in" style="animation-delay: ${index * 0.05}s"> <td class="ranking-position ${this.getRankClass(index + 1)}">${index + 1}</td> <td> <span class="member-name" onclick="uiManager.showProfile(${member.id})"> ${this.escapeHtml(member.nickname)} </span> ${member.isOnline ? '<span class="member-status online"></span>' : ''} </td> <td>${member.matches}</td> <td class="ranking-value">${member.playTime}</td> </tr> `).join('')} </tbody> </table> </div> `; this.elements.activityContainer.innerHTML = html; } updateScoresList(members) { if (!this.elements.scoreContainer) return; const html = ` <div class="table-glow"> <table class="table"> <thead> <tr> <th>Pos</th> <th>Nick</th> <th>Melhor Score</th> <th>Score Total</th> </tr> </thead> <tbody> ${members.map((member, index) => ` <tr class="fade-in" style="animation-delay: ${index * 0.05}s"> <td class="ranking-position ${this.getRankClass(index + 1)}">${index + 1}</td> <td> <span class="member-name" onclick="uiManager.showProfile(${member.id})"> ${this.escapeHtml(member.nickname)} </span> ${member.isOnline ? '<span class="member-status online"></span>' : ''} </td> <td>${member.bestScore}</td> <td class="ranking-value">${member.totalScore}</td> </tr> `).join('')} </tbody> </table> </div> `; this.elements.scoreContainer.innerHTML = html; } getRankClass(position) { switch (position) { case 1: return 'gold'; case 2: return 'silver'; case 3: return 'bronze'; default: return ''; } } showProfile(memberId) { this.playSound('click'); this.selectedMemberId = memberId; const profile = this.clanManager.getMemberProfile(memberId); if (!profile) return; // Atualiza conteúdo do modal const modalContent = document.getElementById('profileContent'); if (modalContent) { modalContent.innerHTML = this.generateProfileHTML(profile); } // Atualiza gráficos this.updateProfileCharts(profile); // Mostra modal this.elements.profileModal?.classList.add('active'); document.body.style.overflow = 'hidden'; } generateProfileHTML(profile) { const stats = profile.formattedStats[this.currentPeriod]; return ` <div class="profile-header"> <h2 class="profile-name">${this.escapeHtml(profile.nickname)}</h2> <p class="member-id">#${profile.id}</p> <div class="member-status ${profile.isOnline ? 'online' : 'offline'}"> ${profile.isOnline ? 'Online' : 'Offline'} </div> </div> <div class="profile-stats"> <div class="row g-3"> <div class="col-6"> <div class="stat-card"> <div class="stat-number">${stats.matches}</div> <div class="stat-label">Partidas</div> </div> </div> <div class="col-6"> <div class="stat-card"> <div class="stat-number">${stats.playTime}</div> <div class="stat-label">Tempo Jogado</div> </div> </div> <div class="col-6"> <div class="stat-card"> <div class="stat-number">${stats.bestScore}</div> <div class="stat-label">Melhor Score</div> </div> </div> <div class="col-6"> <div class="stat-card"> <div class="stat-number">${stats.totalScore}</div> <div class="stat-label">Score Total</div> </div> </div> </div> </div> <div class="chart-container"> <canvas id="profileChart" height="200"></canvas> </div> <div class="profile-navigation"> <button class="btn btn-secondary-glow" onclick="uiManager.previousProfile()"> <i class="fas fa-chevron-left"></i> Anterior </button> <button class="btn btn-secondary-glow" onclick="uiManager.nextProfile()"> Próximo <i class="fas fa-chevron-right"></i> </button> </div> `; } updateProfileCharts(profile) { const ctx = document.getElementById('profileChart'); if (!ctx) return; // Destrói gráfico anterior se existir if (this.charts.profile) { this.charts.profile.destroy(); } // Dados baseados no período let labels, data; if (this.currentPeriod === 'last24h') { labels = Array.from({length: 24}, (_, i) => `${i}h`); data = profile.hourlyActivity; } else if (this.currentPeriod === 'last7d') { labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']; data = profile.weeklyActivity; } else { // Para 30 dias e all time, não mostra gráfico ctx.parentElement.style.display = 'none'; return; } ctx.parentElement.style.display = 'block'; this.charts.profile = new Chart(ctx, { type: 'bar', data: { labels: labels, datasets: [{ label: 'Partidas', data: data, backgroundColor: 'rgba(0, 255, 136, 0.5)', borderColor: 'rgba(0, 255, 136, 1)', borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#888' } }, x: { grid: { display: false }, ticks: { color: '#888' } } } } }); } closeProfile() { this.playSound('click'); this.elements.profileModal?.classList.remove('active'); document.body.style.overflow = ''; } previousProfile() { // Implementar navegação entre perfis const members = this.clanManager.wsManager.getMembersList('online'); const currentIndex = members.findIndex(m => m.id === this.selectedMemberId); if (currentIndex > 0) { this.showProfile(members[currentIndex - 1].id); } } nextProfile() { // Implementar navegação entre perfis const members = this.clanManager.wsManager.getMembersList('online'); const currentIndex = members.findIndex(m => m.id === this.selectedMemberId); if (currentIndex < members.length - 1) { this.showProfile(members[currentIndex + 1].id); } } switchPeriod(period) { this.currentPeriod = period; // Atualiza tabs this.elements.timeTabs.forEach(tab => { tab.classList.toggle('active', tab.dataset.period === period); }); // Recarrega dados const data = this.clanManager.getAllData(); this.updateUI(data); } switchView(view) { this.currentView = view; // Atualiza tabs this.elements.viewTabs.forEach(tab => { tab.classList.toggle('active', tab.dataset.view === view); }); // Mostra/esconde containers document.querySelectorAll('.view-container').forEach(container => { container.style.display = container.dataset.view === view ? 'block' : 'none'; }); // Recarrega dados const data = this.clanManager.getAllData(); this.updateUI(data); } filterMembers(searchTerm) { const cards = document.querySelectorAll('.member-card'); const term = searchTerm.toLowerCase(); cards.forEach(card => { const name = card.querySelector('.member-name').textContent.toLowerCase(); const id = card.querySelector('.member-id').textContent.toLowerCase(); const matches = name.includes(term) || id.includes(term); card.parentElement.style.display = matches ? 'block' : 'none'; }); } updateServerStatus(servers) { if (!this.elements.serverStatus) return; const html = servers.map(server => ` <div class="server-status-item"> <span> <span class="server-status-indicator ${server.connected ? 'connected' : 'disconnected'}"></span> ${server.name} </span> <span class="text-muted">${server.playersCount} jogadores</span> </div> `).join(''); this.elements.serverStatus.innerHTML = html; } handleNewMember(member) { this.addActivityFeedItem(`Novo membro detectado: ${member.nickname}`, 'new-member'); this.showNotification(`🎉 Novo membro: ${member.nickname}`, 'success'); } handleMemberOnline(member) { this.addActivityFeedItem(`${member.nickname} está online`, 'online'); this.showNotification(`✅ ${member.nickname} entrou`, 'info'); } handleMemberOffline(member) { this.addActivityFeedItem(`${member.nickname} ficou offline`, 'offline'); } addActivityFeedItem(message, type) { if (!this.elements.activityFeed) return; const time = new Date().toLocaleTimeString('pt-BR'); const item = document.createElement('div'); item.className = `activity-item activity-${type} fade-in`; item.innerHTML = ` <div class="activity-message">${this.escapeHtml(message)}</div> <div class="activity-time">${time}</div> `; this.elements.activityFeed.insertBefore(item, this.elements.activityFeed.firstChild); // Limita a 50 itens while (this.elements.activityFeed.children.length > 50) { this.elements.activityFeed.removeChild(this.elements.activityFeed.lastChild); } } showNotification(message, type = 'info') { const notification = document.createElement('div'); notification.className = `notification notification-${type} slide-in-right`; notification.innerHTML = ` <div class="notification-content"> ${this.escapeHtml(message)} </div> `; document.body.appendChild(notification); setTimeout(() => { notification.classList.add('fade-out'); setTimeout(() => notification.remove(), 300); }, 3000); } startAnimations() { // Partículas de fundo this.createParticles(); // Animação de cobra this.createSnakeAnimation(); // Efeito de digitação no título this.typewriterEffect(); } createParticles() { const particlesContainer = document.createElement('div'); particlesContainer.className = 'particles'; document.body.appendChild(particlesContainer); for (let i = 0; i < 50; i++) { const particle = document.createElement('div'); particle.className = 'particle'; particle.style.left = Math.random() * 100 + '%'; particle.style.animationDelay = Math.random() * 10 + 's'; particle.style.animationDuration = (Math.random() * 10 + 10) + 's'; particlesContainer.appendChild(particle); } } createSnakeAnimation() { const snakeContainer = document.createElement('div'); snakeContainer.className = 'snake-animation'; document.querySelector('.hero-section')?.appendChild(snakeContainer); for (let i = 0; i < 5; i++) { const snake = document.createElement('div'); snake.className = 'snake'; snake.style.animationDelay = i * 4 + 's'; snakeContainer.appendChild(snake); } } typewriterEffect() { const title = document.querySelector('.hero-title'); if (!title) return; const text = title.textContent; title.textContent = ''; title.style.visibility = 'visible'; let i = 0; const type = () => { if (i < text.length) { title.textContent += text.charAt(i); i++; setTimeout(type, 100); } }; type(); } playSound(type) { this.clanManager.playSound(type); } escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; } } // Adiciona estilos de notificação const notificationStyles = ` <style> .notification { position: fixed; top: 100px; right: 20px; padding: 1rem 2rem; border-radius: 10px; background: var(--card-bg); border: 2px solid; z-index: 9999; max-width: 300px; } .notification-success { border-color: var(--success); box-shadow: 0 0 20px rgba(0, 255, 0, 0.5); } .notification-info { border-color: var(--primary-color); box-shadow: 0 0 20px rgba(0, 255, 136, 0.5); } .notification-warning { border-color: var(--warning); box-shadow: 0 0 20px rgba(255, 170, 0, 0.5); } .notification-error { border-color: var(--danger); box-shadow: 0 0 20px rgba(255, 0, 68, 0.5); } .fade-out { opacity: 0; transform: translateX(100%); transition: all 0.3s ease; } </style> `; document.head.insertAdjacentHTML('beforeend', notificationStyles);