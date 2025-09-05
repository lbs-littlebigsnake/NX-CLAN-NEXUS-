// WebSocket Manager - Sistema completo de monitoramento
class WebSocketManager {
    constructor() {
        this.servers = [
            { name: 'Sao-Paulo', url: 'Sao-Paulo.littlebigsnake.com' },
            { name: 'Santiago', url: 'Santiago.littlebigsnake.com' },
            { name: 'Miami', url: 'Miami.littlebigsnake.com' },
            { name: 'New-York', url: 'New-York.littlebigsnake.com' },
            { name: 'Toronto', url: 'Toronto.littlebigsnake.com' },
            { name: 'Dallas', url: 'Dallas.littlebigsnake.com' },
            { name: 'Chicago', url: 'Chicago.littlebigsnake.com' },
            { name: 'Johannesburg', url: 'Johannesburg.littlebigsnake.com' },
            { name: 'Madrid', url: 'Madrid.littlebigsnake.com' },
            { name: 'London', url: 'London.littlebigsnake.com' },
            { name: 'Paris', url: 'Paris.littlebigsnake.com' },
            { name: 'Amsterdam', url: 'Amsterdam.littlebigsnake.com' },
            { name: 'Frankfurt', url: 'Frankfurt.littlebigsnake.com' },
            { name: 'San-Francisco', url: 'San-Francisco.littlebigsnake.com' },
            { name: 'Seattle', url: 'Seattle.littlebigsnake.com' },
            { name: 'Stockholm', url: 'Stockholm.littlebigsnake.com' },
            { name: 'TelAviv', url: 'TelAviv.littlebigsnake.com' },
            { name: 'Moscow', url: 'Moscow.littlebigsnake.com' },
            { name: 'Bahrain', url: 'Bahrain.littlebigsnake.com' },
            { name: 'Mumbai', url: 'Mumbai.littlebigsnake.com' },
            { name: 'Sydney', url: 'Sydney.littlebigsnake.com' },
            { name: 'Bangalore', url: 'Bangalore.littlebigsnake.com' },
            { name: 'Singapore', url: 'Singapore.littlebigsnake.com' },
            { name: 'Seoul', url: 'Seoul.littlebigsnake.com' },
            { name: 'Hong-Kong', url: 'Hong-Kong.littlebigsnake.com' },
            { name: 'Tokyo', url: 'Tokyo.littlebigsnake.com' }
        ];

        this.connections = new Map();
        this.clanTags = ['ЙЖ*', 'ЙЖ$', 'ЙEЖЦ$'];
        this.clanMembers = new Map(); // ID -> Member Data
        this.appearanceHistory = new Map(); // ID -> Array of appearances
        this.onlineThreshold = 300000; // 5 minutos em ms
        this.extendedThreshold = 480000; // 8 minutos em ms
        this.lastSeenTimestamps = new Map(); // ID -> timestamp
        this.serverTop10Scores = new Map(); // server -> 10th place score
        
        // Callbacks
        this.onMemberDetected = null;
        this.onMemberUpdate = null;
        this.onServerUpdate = null;
    }

    // Inicializa todas as conexões
    async initialize() {
        console.log('🚀 Iniciando conexões com servidores...');
        
        for (const server of this.servers) {
            await this.connectToServer(server);
            // Delay para não sobrecarregar
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Inicia loop de verificação de status online
        this.startOnlineStatusChecker();
        
        console.log('✅ Todas as conexões estabelecidas!');
    }

    // Conecta a um servidor específico
    async connectToServer(serverInfo) {
        const pcConnection = new ArenaConnection(
            `wss://${serverInfo.url}:9001`,
            serverInfo.name,
            'PC',
            this.handleTopPlayersUpdate.bind(this)
        );
        
        const mobileConnection = new ArenaConnection(
            `wss://${serverInfo.url}:9002`,
            serverInfo.name,
            'Mobile',
            this.handleTopPlayersUpdate.bind(this)
        );

        this.connections.set(`${serverInfo.name}-PC`, pcConnection);
        this.connections.set(`${serverInfo.name}-Mobile`, mobileConnection);
    }

    // Processa atualização do top 10
    handleTopPlayersUpdate(players, serverName, platform) {
        // Armazena a pontuação do 10º colocado
        if (players.length >= 10) {
            this.serverTop10Scores.set(`${serverName}-${platform}`, players[9].mass);
        }

        players.forEach(player => {
            // Verifica se é membro do clã
            if (this.isClanMember(player.name)) {
                this.processClanMember(player, serverName, platform);
            }
        });

        // Callback para atualização do servidor
        if (this.onServerUpdate) {
            this.onServerUpdate(serverName, platform, players);
        }
    }

    // Verifica se o jogador é membro do clã
    isClanMember(playerName) {
        return this.clanTags.some(tag => playerName.includes(tag));
    }

    // Processa membro do clã detectado
    processClanMember(player, serverName, platform) {
        const now = Date.now();
        const brazilTime = this.getBrazilTime();
        
        // Cria ou atualiza dados do membro
        if (!this.clanMembers.has(player.accountId)) {
            const memberData = {
                id: player.accountId,
                nickname: player.name,
                firstSeen: brazilTime,
                stats: {
                    last24h: { matches: 0, totalScore: 0, bestScore: 0, playTime: 0 },
                    last7d: { matches: 0, totalScore: 0, bestScore: 0, playTime: 0 },
                    last30d: { matches: 0, totalScore: 0, bestScore: 0, playTime: 0 },
                    allTime: { matches: 0, totalScore: 0, bestScore: 0, playTime: 0 }
                },
                hourlyActivity: new Array(24).fill(0),
                weeklyActivity: new Array(7).fill(0)
            };
            
            this.clanMembers.set(player.accountId, memberData);
            
            // Callback para novo membro detectado
            if (this.onMemberDetected) {
                this.onMemberDetected(memberData);
            }
        }

        // Atualiza nickname se mudou
        const member = this.clanMembers.get(player.accountId);
        if (member.nickname !== player.name) {
            member.nickname = player.name;
        }

        // Processa aparição
        this.processAppearance(player, serverName, platform, now);
        
        // Atualiza último visto
        this.lastSeenTimestamps.set(player.accountId, now);
    }

    // Processa aparição do jogador
    processAppearance(player, serverName, platform, timestamp) {
        const playerId = player.accountId;
        
        if (!this.appearanceHistory.has(playerId)) {
            this.appearanceHistory.set(playerId, []);
        }

        const history = this.appearanceHistory.get(playerId);
        const lastAppearance = history[history.length - 1];
        
        // Verifica se é uma nova partida (intervalo > 20 segundos)
        const isNewMatch = !lastAppearance || 
                          (timestamp - lastAppearance.timestamp) > 20000;

        const appearance = {
            timestamp,
            serverName,
            platform,
            position: player.place,
            score: player.mass,
            isNewMatch
        };

        history.push(appearance);

        // Se é uma nova partida, atualiza estatísticas
        if (isNewMatch) {
            this.updateMemberStats(playerId, player.mass, timestamp);
        }

        // Limita histórico para economizar memória (últimos 1000 registros)
        if (history.length > 1000) {
            history.shift();
        }
    }

    // Atualiza estatísticas do membro
    updateMemberStats(playerId, score, timestamp) {
        const member = this.clanMembers.get(playerId);
        if (!member) return;

        const hour = new Date(timestamp).getHours();
        const dayOfWeek = new Date(timestamp).getDay();
        
        // Atualiza atividade por hora e dia da semana
        member.hourlyActivity[hour]++;
        member.weeklyActivity[dayOfWeek]++;

        // Calcula tempo de jogo estimado (média de 2 minutos por partida)
        const estimatedPlayTime = 120; // segundos

        // Atualiza estatísticas para cada período
        const periods = [
            { key: 'last24h', maxAge: 24 * 60 * 60 * 1000 },
            { key: 'last7d', maxAge: 7 * 24 * 60 * 60 * 1000 },
            { key: 'last30d', maxAge: 30 * 24 * 60 * 60 * 1000 },
            { key: 'allTime', maxAge: Infinity }
        ];

        periods.forEach(period => {
            const stats = member.stats[period.key];
            const age = Date.now() - timestamp;
            
            if (age <= period.maxAge) {
                stats.matches++;
                stats.totalScore += score;
                stats.bestScore = Math.max(stats.bestScore, score);
                stats.playTime += estimatedPlayTime;
            }
        });

        // Callback para atualização de membro
        if (this.onMemberUpdate) {
            this.onMemberUpdate(member);
        }
    }

    // Verifica status online dos membros
    startOnlineStatusChecker() {
        setInterval(() => {
            const now = Date.now();
            
            this.clanMembers.forEach((member, id) => {
                const lastSeen = this.lastSeenTimestamps.get(id);
                if (!lastSeen) return;

                // Verifica qual threshold usar
                const lastServer = this.getLastServerForPlayer(id);
                const threshold = this.shouldUseExtendedThreshold(lastServer) 
                    ? this.extendedThreshold 
                    : this.onlineThreshold;

                member.isOnline = (now - lastSeen) < threshold;
            });
        }, 5000); // Verifica a cada 5 segundos
    }

    // Verifica se deve usar threshold estendido
    shouldUseExtendedThreshold(serverKey) {
        if (!serverKey) return false;
        const score = this.serverTop10Scores.get(serverKey);
        return score && score > 200000;
    }

    // Obtém último servidor onde o jogador foi visto
    getLastServerForPlayer(playerId) {
        const history = this.appearanceHistory.get(playerId);
        if (!history || history.length === 0) return null;
        
        const lastAppearance = history[history.length - 1];
        return `${lastAppearance.serverName}-${lastAppearance.platform}`;
    }

    // Obtém horário de Brasília
    getBrazilTime() {
        return new Date().toLocaleString('pt-BR', { 
            timeZone: 'America/Sao_Paulo' 
        });
    }

    // Formata números grandes
    formatNumber(num) {
        if (num >= 1e12) return (num / 1e12).toFixed(1) + 'T';
        if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
        return num.toString();
    }

    // Formata tempo em segundos para formato legível
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}min`;
        }
        return `${minutes}min`;
    }

    // Obtém lista de membros ordenada
    getMembersList(sortBy = 'online', period = 'allTime') {
        const members = Array.from(this.clanMembers.values());
        
        // Ordena conforme critério
        switch (sortBy) {
            case 'online':
                members.sort((a, b) => {
                    if (a.isOnline && !b.isOnline) return -1;
                    if (!a.isOnline && b.isOnline) return 1;
                    return a.id - b.id;
                });
                break;
            case 'activity':
                members.sort((a, b) => 
                    b.stats[period].playTime - a.stats[period].playTime
                );
                break;
            case 'score':
                members.sort((a, b) => 
                    b.stats[period].totalScore - a.stats[period].totalScore
                );
                break;
        }
        
        return members;
    }

    // Obtém dados de um membro específico
    getMemberData(playerId) {
        return this.clanMembers.get(playerId);
    }

    // Obtém estatísticas gerais do clã
    getClanStats() {
        const stats = {
            totalMembers: this.clanMembers.size,
            onlineMembers: 0,
            totalScore: 0,
            totalMatches: 0,
            totalPlayTime: 0
        };

        this.clanMembers.forEach(member => {
            if (member.isOnline) stats.onlineMembers++;
            stats.totalScore += member.stats.allTime.totalScore;
            stats.totalMatches += member.stats.allTime.matches;
            stats.totalPlayTime += member.stats.allTime.playTime;
        });

        return stats;
    }
}

// Classe ArenaConnection atualizada
class ArenaConnection {
    constructor(url, serverName, platform, onTopPlayersUpdate) {
        this.url = url;
        this.serverName = serverName;
        this.platform = platform;
        this.onTopPlayersUpdate = onTopPlayersUpdate;
        this.socket = null;
        this.interval = null;
        this.offset = 0;
        this.packet = null;
        this.topplayers = [];
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        
        this.connect();
    }

    connect() {
        try {
                        this.socket = new WebSocket(this.url);
            this.socket.binaryType = "arraybuffer";
            
            this.socket.onclose = (e) => {
                console.log(`❌ Conexão fechada: ${this.serverName}-${this.platform}`);
                this.handleReconnect();
            };
            
            this.socket.onerror = (e) => {
                console.error(`⚠️ Erro na conexão: ${this.serverName}-${this.platform}`, e);
            };
            
            this.socket.onopen = (e) => {
                console.log(`✅ Conectado: ${this.serverName}-${this.platform}`);
                this.reconnectAttempts = 0;
                this.reconnectDelay = 1000;
                
                clearInterval(this.interval);
                this.interval = setInterval(() => {
                    if (this.socket.readyState === 1) {
                        this.send([0, 3, 1]);
                    } else {
                        clearInterval(this.interval);
                    }
                }, 2000);
                
                this.enterArena();
            };
            
            this.socket.onmessage = this.parse.bind(this);
        } catch (error) {
            console.error(`Erro ao criar WebSocket: ${this.serverName}-${this.platform}`, error);
            this.handleReconnect();
        }
    }

    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Tentando reconectar ${this.serverName}-${this.platform}... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                this.connect();
            }, this.reconnectDelay);
            
            this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
        } else {
            console.error(`❌ Falha ao reconectar ${this.serverName}-${this.platform} após ${this.maxReconnectAttempts} tentativas`);
        }
    }

    send(data) {
        if (this.socket && this.socket.readyState === 1) {
            this.socket.send(Uint8Array.from(data));
        }
    }

    enterArena() {
        setTimeout(() => {
            this.send([0, 3, 5, 0, 3, 4]);
        }, 500);
    }

    int16() {
        return (this.packet[this.offset++] & 255) << 8 |
               (this.packet[this.offset++] & 255);
    }

    int32() {
        return (this.packet[this.offset++] & 255) << 24 |
               (this.packet[this.offset++] & 255) << 16 |
               (this.packet[this.offset++] & 255) << 8 |
               this.packet[this.offset++] & 255;
    }

    int8() {
        return this.packet[this.offset++] & 255;
    }

    getString() {
        const length = this.int16();
        const val = new TextDecoder().decode(
            this.packet.slice(this.offset, this.offset + length)
        );
        this.offset += length;
        return val;
    }

    parse(e) {
        try {
            const data = new Uint8Array(e.data);
            let current = 0;
            const fim = data.length;

            while (current < fim) {
                const size = (data[current] & 255) << 8 | data[current + 1] & 255;
                const next = current + size;
                this.packet = data.slice(current, next);
                this.offset = 3;

                const tipo = this.packet[2];
                
                switch (tipo) {
                    case 22:
                        this.topplayers = [];
                        const count = this.int8();
                        
                        for (let i = 0; i < count; i++) {
                            const row = {
                                place: this.int16(),
                                name: this.getString(),
                                mass: this.int32(),
                                crowns: this.int8(),
                                skin: this.int8(),
                                flags: this.int8(),
                                accountId: this.int32(),
                                id: this.int16(),
                            };
                            this.topplayers.push(row);
                        }
                        
                        // Callback com os top players
                        if (this.onTopPlayersUpdate) {
                            this.onTopPlayersUpdate(this.topplayers, this.serverName, this.platform);
                        }
                        break;

                    case 79:
                        console.log(`🔄 Reconectando ${this.serverName}-${this.platform}...`);
                        this.connect();
                        break;
                }
                
                current = next;
            }
        } catch (error) {
            console.error(`Erro ao processar mensagem: ${this.serverName}-${this.platform}`, error);
        }
    }
}