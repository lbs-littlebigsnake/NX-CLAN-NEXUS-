// Gerenciador do Clã NEXUS
class ClanManager {
    constructor() {
        this.wsManager = new WebSocketManager();
        this.storage = new ClanStorage();
        this.initialized = false;
        
        // Configurações
        this.config = {
            clanName: 'NEXUS',
            clanTags: ['ЙЖ*', 'ЙЖ$', 'ЙEЖЦ$'],
            updateInterval: 5000,
            saveInterval: 30000
        };
        
        // Callbacks para UI
        this.onDataUpdate = null;
        this.onNewMember = null;
        this.onMemberOnline = null;
        this.onMemberOffline = null;
    }

    async initialize() {
        console.log('🎮 Inicializando Clan Manager...');
        
        // Carrega dados salvos
        await this.storage.loadData();
        
        // Configura callbacks do WebSocket Manager
        this.wsManager.onMemberDetected = this.handleNewMember.bind(this);
        this.wsManager.onMemberUpdate = this.handleMemberUpdate.bind(this);
        this.wsManager.onServerUpdate = this.handleServerUpdate.bind(this);
        
        // Inicializa conexões WebSocket
        await this.wsManager.initialize();
        
        // Inicia loops de atualização
        this.startUpdateLoop();
        this.startSaveLoop();
        
        this.initialized = true;
        console.log('✅ Clan Manager inicializado!');
    }

    handleNewMember(memberData) {
        console.log(`🆕 Novo membro detectado: ${memberData.nickname} (#${memberData.id})`);
        
        // Salva no storage
        this.storage.saveMember(memberData);
        
        // Notifica UI
        if (this.onNewMember) {
            this.onNewMember(memberData);
        }
        
        // Toca som de notificação
        this.playSound('newMember');
    }

    handleMemberUpdate(memberData) {
        // Verifica mudança de status online
        const previousData = this.storage.getMember(memberData.id);
        
        if (previousData && previousData.isOnline !== memberData.isOnline) {
            if (memberData.isOnline && this.onMemberOnline) {
                this.onMemberOnline(memberData);
                this.playSound('memberOnline');
            } else if (!memberData.isOnline && this.onMemberOffline) {
                this.onMemberOffline(memberData);
            }
        }
        
        // Atualiza storage
        this.storage.updateMember(memberData);
    }

    handleServerUpdate(serverName, platform, players) {
        // Pode ser usado para estatísticas de servidor
        this.storage.updateServerStats(serverName, platform, players);
    }

    startUpdateLoop() {
        setInterval(() => {
            if (this.onDataUpdate) {
                const data = this.getAllData();
                this.onDataUpdate(data);
            }
        }, this.config.updateInterval);
    }

    startSaveLoop() {
        setInterval(() => {
            this.storage.saveToLocalStorage();
        }, this.config.saveInterval);
    }

    // Obtém todos os dados para a UI
    getAllData() {
        return {
            members: this.wsManager.getMembersList('online'),
            stats: this.wsManager.getClanStats(),
            activityMembers: this.getTopActiveMembers(),
            scoreMembers: this.getTopScoreMembers(),
            serverStatus: this.getServerStatus()
        };
    }

    // Obtém membros mais ativos por período
    getTopActiveMembers(period = 'last24h', limit = 10) {
        const members = this.wsManager.getMembersList('activity', period);
        return members.slice(0, limit).map(member => ({
            nickname: member.nickname,
            id: member.id,
            matches: member.stats[period].matches,
            playTime: this.wsManager.formatTime(member.stats[period].playTime),
            playTimeSeconds: member.stats[period].playTime,
            isOnline: member.isOnline
        }));
    }

    // Obtém membros com maiores pontuações por período
    getTopScoreMembers(period = 'last24h', limit = 10) {
        const members = this.wsManager.getMembersList('score', period);
        return members.slice(0, limit).map(member => ({
            nickname: member.nickname,
            id: member.id,
            bestScore: this.wsManager.formatNumber(member.stats[period].bestScore),
            bestScoreRaw: member.stats[period].bestScore,
            totalScore: this.wsManager.formatNumber(member.stats[period].totalScore),
            totalScoreRaw: member.stats[period].totalScore,
            isOnline: member.isOnline
        }));
    }

    // Obtém dados de um membro específico
    getMemberProfile(memberId) {
        const member = this.wsManager.getMemberData(memberId);
        if (!member) return null;

        return {
            ...member,
            formattedStats: {
                last24h: this.formatMemberStats(member.stats.last24h),
                last7d: this.formatMemberStats(member.stats.last7d),
                last30d: this.formatMemberStats(member.stats.last30d),
                allTime: this.formatMemberStats(member.stats.allTime)
            }
        };
    }

    formatMemberStats(stats) {
        return {
            matches: stats.matches,
            totalScore: this.wsManager.formatNumber(stats.totalScore),
            totalScoreRaw: stats.totalScore,
            bestScore: this.wsManager.formatNumber(stats.bestScore),
            bestScoreRaw: stats.bestScore,
            playTime: this.wsManager.formatTime(stats.playTime),
            playTimeSeconds: stats.playTime
        };
    }

    // Obtém status dos servidores
    getServerStatus() {
        const status = [];
        this.wsManager.connections.forEach((connection, key) => {
            status.push({
                name: key,
                connected: connection.socket && connection.socket.readyState === 1,
                playersCount: connection.topplayers.length
            });
        });
        return status;
    }

    // Toca sons do sistema
    playSound(soundType) {
        const audio = new Audio();
        switch (soundType) {
            case 'newMember':
                audio.src = 'sounds/new-member.mp3';
                break;
            case 'memberOnline':
                audio.src = 'sounds/member-online.mp3';
                break;
            case 'click':
                audio.src = 'sounds/click.mp3';
                break;
        }
        audio.volume = 0.3;
        audio.play().catch(e => console.log('Erro ao tocar som:', e));
    }
}

// Sistema de armazenamento local
class ClanStorage {
    constructor() {
        this.storageKey = 'nexusClanData';
        this.members = new Map();
        this.serverStats = new Map();
    }

    async loadData() {
        try {
            const savedData = localStorage.getItem(this.storageKey);
            if (savedData) {
                const parsed = JSON.parse(savedData);
                
                // Restaura membros
                if (parsed.members) {
                    parsed.members.forEach(member => {
                        this.members.set(member.id, member);
                    });
                }
                
                console.log(`📂 Carregados ${this.members.size} membros do storage`);
            }
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        }
    }

    saveToLocalStorage() {
        try {
            const data = {
                members: Array.from(this.members.values()),
                lastSave: new Date().toISOString()
            };
            
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (error) {
            console.error('Erro ao salvar dados:', error);
        }
    }

    saveMember(memberData) {
        this.members.set(memberData.id, memberData);
    }

    updateMember(memberData) {
        const existing = this.members.get(memberData.id);
        if (existing) {
            this.members.set(memberData.id, { ...existing, ...memberData });
        } else {
            this.saveMember(memberData);
        }
    }

    getMember(memberId) {
        return this.members.get(memberId);
    }

    updateServerStats(serverName, platform, players) {
        const key = `${serverName}-${platform}`;
        this.serverStats.set(key, {
            lastUpdate: Date.now(),
            playerCount: players.length,
            topScore: players[0]?.mass || 0
        });
    }
}