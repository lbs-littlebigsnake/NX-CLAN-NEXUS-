// Configuração global e inicialização
let clanManager;
let uiManager;

// Aguarda DOM carregar
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando aplicação Clã NEXUS...');
    
    try {
        // Inicializa gerenciadores
        clanManager = new ClanManager();
        uiManager = new UIManager(clanManager);
        
        // Torna uiManager global para onclick handlers
        window.uiManager = uiManager;
        
        // Inicializa o sistema
        await clanManager.initialize();
        
        // Remove tela de loading após 2 segundos
        setTimeout(() => {
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen) {
                loadingScreen.style.opacity = '0';
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 500);
            }
        }, 2000);
        
        console.log('✅ Aplicação iniciada com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao iniciar aplicação:', error);
        showErrorMessage('Erro ao conectar aos servidores. Por favor, recarregue a página.');
    }
});

// Funções utilitárias globais
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        const offset = 100; // Compensar navbar fixa
        const sectionTop = section.offsetTop - offset;
        
        window.scrollTo({
            top: sectionTop,
            behavior: 'smooth'
        });
    }
}

function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

function showErrorMessage(message) {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        const loadingContent = loadingScreen.querySelector('.loading-content');
        loadingContent.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
                <h3>${message}</h3>
                <button class="btn btn-primary-glow mt-3" onclick="location.reload()">
                    <i class="fas fa-redo me-2"></i>Recarregar
                </button>
            </div>
        `;
    }
}

// Smooth scroll para links internos
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href').substring(1);
        scrollToSection(targetId);
    });
});

// Detecta mudança de visibilidade da página
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('🔴 Página em background');
        // Pode pausar algumas animações para economizar recursos
    } else {
        console.log('🟢 Página ativa');
        // Reativa animações
    }
});

// Service Worker para funcionar offline (opcional)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => {
        console.log('Service Worker não registrado:', err);
    });
}

// Previne erros de console em produção
if (window.location.hostname !== 'localhost') {
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
}

// Easter egg: Konami Code
let konamiCode = [];
const konamiPattern = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 
                      'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 
                      'b', 'a'];

document.addEventListener('keydown', (e) => {
    konamiCode.push(e.key);
    konamiCode = konamiCode.slice(-10);
    
    if (konamiCode.join(',') === konamiPattern.join(',')) {
        activateEasterEgg();
    }
});

function activateEasterEgg() {
    document.body.style.animation = 'rainbow 2s linear infinite';
    uiManager.showNotification('🐍 Modo Snake Ativado! 🐍', 'success');
    
    setTimeout(() => {
        document.body.style.animation = '';
    }, 10000);
}

// CSS para o easter egg
const easterEggStyles = `
<style>
@keyframes rainbow {
    0% { filter: hue-rotate(0deg); }
    100% { filter: hue-rotate(360deg); }
}

.loading-screen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--darker-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    transition: opacity 0.5s ease;
}

.loading-content {
    text-align: center;
}

.loading-text {
    margin-top: 2rem;
    color: var(--primary-color);
    animation: pulse 1s ease-in-out infinite;
}

.error-message {
    color: var(--danger);
    text-align: center;
}
</style>
`;

document.head.insertAdjacentHTML('beforeend', easterEggStyles);

// Adiciona tela de loading ao HTML
const loadingHTML = `
<div id="loadingScreen" class="loading-screen">
    <div class="loading-content">
        <div class="loading-spinner"></div>
        <h2 class="loading-text">Conectando aos servidores...</h2>
    </div>
</div>
`;

if (!document.getElementById('loadingScreen')) {
    document.body.insertAdjacentHTML('afterbegin', loadingHTML);
}

// Performance monitoring
const performanceObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
        if (entry.duration > 100) {
            console.warn('Performance issue detected:', entry.name, entry.duration);
        }
    }
});

performanceObserver.observe({ entryTypes: ['measure'] });

// Exporta para debugging em desenvolvimento
if (window.location.hostname === 'localhost') {
    window.debugClan = {
        clanManager,
        uiManager,
        getMembers: () => clanManager.wsManager.clanMembers,
        getConnections: () => clanManager.wsManager.connections,
        simulateNewMember: () => {
            const fakeMember = {
                id: Math.floor(Math.random() * 1000000),
                nickname: 'ЙЖ* TestPlayer',
                isOnline: true,
                stats: {
                    last24h: { matches: 10, totalScore: 50000, bestScore: 10000, playTime: 1200 },
                    last7d: { matches: 50, totalScore: 250000, bestScore: 15000, playTime: 6000 },
                    last30d: { matches: 200, totalScore: 1000000, bestScore: 20000, playTime: 24000 },
                    allTime: { matches: 500, totalScore: 2500000, bestScore: 25000, playTime: 60000 }
                }
            };
            clanManager.handleNewMember(fakeMember);
        }
    };
}

console.log('🎮 Clã NEXUS ЙЖ* - Sistema carregado!');