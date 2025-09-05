// WebSocket Manager - Sistema otimizado de monitoramento
class WebSocketManager {
    constructor() {
        this.servers = [
            { name: 'Sao-Paulo', url: 'Sao-Paulo.littlebigsnake.com', priority: 1 },
            { name: 'Santiago', url: 'Santiago.littlebigsnake.com', priority: 2 },
            { name: 'Miami', url: 'Miami.littlebigsnake.com', priority: 2 },
            { name: 'New-York', url: 'New-York.littlebigsnake.com', priority: 2 },
            { name: 'Toronto', url: 'Toronto.littlebigsnake.com', priority: 3 },
            { name: 'Dallas', url: 'Dallas.littlebigsnake.com', priority: 3 },
            { name: 'London', url: 'London.littlebigsnake.com', priority: 2 },
            { name: 'Frankfurt', url: 'Frankfurt.littlebigsnake.com', priority: 2 },
            { name: 'Amsterdam', url: 'Amsterdam.littlebigsnake.com', priority: 3 },
            { name: 'Madrid', url: 'Madrid.littlebigsnake.com', priority: 3 },
            { name: 'Paris', url: 'Paris.littlebigsnake.com', priority: 3 },
            { name: 'Stockholm', url: 'Stockholm.littlebigsnake.com', priority: 4 },
            { name: 'Moscow', url: 'Moscow.littlebigsnake.com', priority: 4 },
            { name: 'Mumbai', url: 'Mumbai.littlebigsnake.com', priority: 4 },
            { name: 'Singapore', url: 'Singapore.littlebigsnake.com', priority: 3 },
            { name: 'Sydney', url: 'Sydney.littlebigsnake.com', priority: 4 },
            { name: 'Tokyo', url: 'Tokyo.littlebigsnake.com', priority: 3 },
            { name: 'Seoul', url: 'Seoul.littlebigsnake.com', priority: 4 }
        ];

        this.connections = new Map();
        this.connectionPool = new Map();
        this.clanTags = ['ЙЖ*', 'ЙЖ$', 'ЙEЖЦ$'];
        this.clanMembers = new Map();
        this.memberActivity = new Map();
        this.onlineThreshold = 180000; // 3 minutos
        this.maxConcurrentConnections = 8;
        this.connectionDelay = 500;
        this.healthCheckInterval = 30000;
        
        // Performance metrics
        this.metrics = {
            totalConnections: 0,
            activeConnections: 0,
            failedConnections: 0,
            membersDetected: 0,
            lastUpdate: Date.now()
        };
        
        // Callbacks
        this.onMemberDetected = null;
        this.onMemberUpdate = null;
        this.onServerUpdate = null;
        this.onConnectionStatusChange = null;
    }

    async initialize() {
        console.log('🚀 Iniciando sistema WebSocket otimizado...');
        
        // Ordena servidores por prioridade
        this.servers.sort((a, b) => a.priority - b.priority);
        
        // Conecta aos servidores prioritários primeiro
        await this.connectToPriorityServers();
        
        // Inicia monitoramento de saúde das conexões
        this.startHealthMonitoring();
        
        // Inicia verificação de status online
        this.startOnlineStatusChecker();
        
        console.log(`✅ Sistema iniciado com ${this.metrics.activeConnections} conexões ativas`);
    }

    async connectToPriorityServers() {
        const priorityGroups = this.groupServersByPriority();
        
        for (const [priority, servers] of priorityGroups) {
            console.log(`🔗 Conectando servidores prioridade ${priority}...`);
            
            const connectionPromises = servers.map(server => 
                this.connectToServerWithRetry(server)
            );
            
            // Aguarda todas as conexões do grupo atual
            await Promise.allSettled(connectionPromises);
            
            // Delay entre grupos para não sobrecarregar
            if (priority < Math.max(...this.servers.map(s => s.priority))) {
                await this.delay(1000);
            }
        }
    }

    groupServersByPriority() {
        const groups = new Map();
        
        this.servers.forEach(server => {
            if (!groups.has(server.priority)) {
                groups.set(server.priority, []);
            }
            groups.get(server.priority).push(server);
        });
        
        return new Map([...groups.entries()].sort());
    }

    async connectToServerWithRetry(serverInfo, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await this.connectToServer(serverInfo);
                return true;
            } catch (error) {
                console.warn(`⚠️ Tentativa ${attempt}/${maxRetries} falhou para ${serverInfo.name}:`, error.message);
                
                if (attempt < maxRetries) {
                    await this.delay(1000 * attempt);
                }
            }
        }
        
        console.error(`❌ Falha ao conectar ${serverInfo.name} após ${maxRetries} tentativas`);
        this.metrics.failedConnections++;
        return false;
    }

    async connectToServer(serverInfo) {
        // Limita conexões simultâneas
        if (this.metrics.activeConnections >= this.maxConcurrentConnections) {
            throw new Error('Limite de conexões simultâneas atingido');
        }

        const connectionKey = `${serverInfo.name}-PC`;
        
        try {
            const connection = new OptimizedArenaConnection(
                `wss://${serverInfo.url}:9001`,
                serverInfo.name,
                'PC',
                this.handleTopPlayersUpdate.bind(this),
                this.handleConnectionStatusChange.bind(this)
            );
            
            this.connections.set(connectionKey, connection);
            this.metrics.totalConnections++;
            
            // Aguarda conexão estabelecer
            await this.waitForConnection(connection, 10000);
            
            this.metrics.activeConnections++;
            console.log(`✅ ${connectionKey} conectado`);
            
            return connection;
            
        } catch (error) {
            this.connections.delete(connectionKey);
            throw new Error(`Falha na conexão ${connectionKey}: ${error.message}`);
        }
    }

    waitForConnection(connection, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('Timeout na conexão'));
            }, timeout);

            const checkConnection = () => {
                if (connection.isConnected()) {
                    clearTimeout(timeoutId);
                    resolve();
                } else if (connection.isFailed()) {
                    clearTimeout(timeoutId);
                    reject(new Error('Conexão falhou'));
                } else {
                    setTimeout(checkConnection, 100);
                }
            };

            checkConnection();
        });
    }

    handleConnectionStatusChange(connectionKey, status, connection) {
        switch (status) {
            case 'connected':
                this.metrics.activeConnections++;
                break;
            case 'disconnected':
                this.metrics.activeConnections = Math.max(0, this.metrics.activeConnections - 1);
                this.scheduleReconnection(connectionKey, connection);
                break;
            case 'error':
                this.metrics.failedConnections++;
                break;
        }

        if (this.onConnectionStatusChange) {
            this.onConnectionStatusChange(connectionKey, status);
        }
    }

    scheduleReconnection(connectionKey, connection) {
        // Reconecta após delay progressivo
        const delay = Math.min(5000 * Math.pow(2, connection.reconnectAttempts), 30000);
        
        setTimeout(() => {
            if (connection.reconnectAttempts < 5) {
                console.log(`🔄 Reconectando ${connectionKey}...`);
                connection.reconnect();
            } else {
                console.error(`❌ Desistindo de reconectar ${connectionKey}`);
                this.connections.delete(connectionKey);
            }
        }, delay);
    }

    handleTopPlayersUpdate(players, serverName, platform) {
        const now = Date.now();
        let clanMembersFound = 0;

        players.forEach((player, index) => {
            if (this.isClanMember(player.name)) {
                this.processClanMember(player, serverName, platform, now);
                clanMembersFound++;
            }
        });

        // Atualiza métricas
        this.metrics.lastUpdate = now;
        
        if (this.onServerUpdate) {
            this.onServerUpdate(serverName, platform, players, clanMembersFound);
        }
    }

    isClanMember(playerName) {
        return this.clanTags.some(tag => playerName.includes(tag));
    }

    processClanMember(player, serverName, platform, timestamp) {
        const playerId = player.accountId;
        const memberKey = `${playerId}`;
        
        // Cria ou atualiza membro
        if (!this.clanMembers.has(memberKey)) {
            const memberData = this.createMemberData(player, timestamp);
            this.clanMembers.set(memberKey, memberData);
            this.metrics.membersDetected++;
            
            if (this.onMemberDetected) {
                this.onMemberDetected(memberData);
            }
        }

        const member = this.clanMembers.get(memberKey);
        
        // Atualiza dados do membro
        this.updateMemberData(member, player, serverName, platform, timestamp);
        
        // Registra atividade
        this.recordMemberActivity(playerId, timestamp, player.mass);
        
        if (this.onMemberUpdate) {
            this.onMemberUpdate(member);
        }
    }

    createMemberData(player, timestamp) {
        return {
            id: player.accountId,
            nickname: player.name,
            firstSeen: timestamp,
            lastSeen: timestamp,
            isOnline: true,
            currentServer: null,
            currentPlatform: null,
            stats: {
                last24h: { matches: 0, totalScore: 0, bestScore: 0, playTime: 0 },
                last7d: { matches: 0, totalScore: 0, bestScore: 0, playTime: 0 },
                last30d: { matches: 0, totalScore: 0, bestScore: 0, playTime: 0 },
                allTime: { matches: 0, totalScore: 0, bestScore: 0, playTime: 0 }
            },
            hourlyActivity: new Array(24).fill(0),
            weeklyActivity: new Array(7).fill(0),
            recentScores: []
        };
    }

    updateMemberData(member, player, serverName, platform, timestamp) {
        // Atualiza informações básicas
        member.nickname = player.name;
        member.lastSeen = timestamp;
        member.isOnline = true;
        member.currentServer = serverName;
        member.currentPlatform = platform;
        
        // Atualiza estatísticas se é uma nova pontuação significativa
        if (this.isSignificantScore(member, player.mass)) {
            this.updateMemberStats(member, player.mass, timestamp);
        }
    }

    isSignificantScore(member, newScore) {
        const recentScores = member.recentScores;
        
        // Se não há scores recentes, é significativo
        if (recentScores.length === 0) return true;
        
        const lastScore = recentScores[recentScores.length - 1];
        const timeDiff = Date.now() - lastScore.timestamp;
        
        // Nova partida se passou mais de 30 segundos ou score muito diferente
        return timeDiff > 30000 || Math.abs(newScore - lastScore.score) > newScore * 0.1;
    }

    updateMemberStats(member, score, timestamp) {
        const hour = new Date(timestamp).getHours();
        const dayOfWeek = new Date(timestamp).getDay();
        
        // Registra score recente
        member.recentScores.push({ score, timestamp });
        if (member.recentScores.length > 10) {
            member.recentScores.shift();
        }
        
        // Atualiza atividade por período
        member.hourlyActivity[hour]++;
        member.weeklyActivity[dayOfWeek]++;
        
        // Estima tempo de jogo (2-5 minutos por partida baseado no score)
        const estimatedPlayTime = Math.min(300, Math.max(120, score / 1000));
        
        // Atualiza estatísticas por período
        this.updatePeriodStats(member, score, estimatedPlayTime, timestamp);
    }

    updatePeriodStats(member, score, playTime, timestamp) {
        const periods = [
            { key: 'last24h', maxAge: 24 * 60 * 60 * 1000 },
            { key: 'last7d', maxAge: 7 * 24 * 60 * 60 * 1000 },
            { key: 'last30d', maxAge: 30 * 24 * 60 * 60 * 1000 },
            { key: 'allTime', maxAge: Infinity }
        ];

        periods.forEach(period => {
            const age = Date.now() - timestamp;
            if (age <= period.maxAge) {
                const stats = member.stats[period.key];
                stats.matches++;
                stats.totalScore += score;
                stats.bestScore = Math.max(stats.bestScore, score);
                stats.playTime += playTime;
            }
        });
    }

    recordMemberActivity(playerId, timestamp, score) {
        if (!this.memberActivity.has(playerId)) {
            this.memberActivity.set(playerId, []);
        }
        
        const activity = this.memberActivity.get(playerId);
        activity.push({ timestamp, score });
        
        // Mantém apenas últimas 100 atividades
        if (activity.length > 100) {
            activity.shift();
        }
    }

    startOnlineStatusChecker() {
        setInterval(() => {
            const now = Date.now();
            
            this.clanMembers.forEach(member => {
                const timeSinceLastSeen = now - member.lastSeen;
                member.isOnline = timeSinceLastSeen < this.onlineThreshold;
            });
        }, 10000); // Verifica a cada 10 segundos
    }

    startHealthMonitoring() {
        setInterval(() => {
            this.performHealthCheck();
        }, this.healthCheckInterval);
    }

    performHealthCheck() {
        let healthyConnections = 0;
        let unhealthyConnections = 0;
        
        this.connections.forEach((connection, key) => {
            if (connection.isHealthy()) {
                healthyConnections++;
            } else {
                unhealthyConnections++;
                console.warn(`⚠️ Conexão não saudável: ${key}`);
                
                // Tenta reconectar conexões não saudáveis
                if (connection.shouldReconnect()) {
                    connection.reconnect();
                }
            }
        });
        
        console.log(`💓 Health Check: ${healthyConnections} saudáveis, ${unhealthyConnections} problemáticas`);
        
        // Atualiza métricas
        this.metrics.activeConnections = healthyConnections;
    }

    // Métodos de utilidade
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    formatNumber(num) {
        if (num >= 1e12) return (num / 1e12).toFixed(1) + 'T';
        if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
        return num.toString();
    }

    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}min`;
        }
        return `${minutes}min`;
    }

    // Métodos públicos para UI
    getMembersList(sortBy = 'online', period = 'allTime') {
        const members = Array.from(this.clanMembers.values());
        
        switch (sortBy) {
            case 'online':
                members.sort((a, b) => {
                    if (a.isOnline && !b.isOnline) return -1;
                    if (!a.isOnline && b.isOnline) return 1;
                    return b.lastSeen - a.lastSeen;
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
        
        return members.map(member => ({
            ...member,
            formattedStats: this.formatMemberStats(member.stats)
        }));
    }

    formatMemberStats(stats) {
        const formatted = {};
        
        Object.keys(stats).forEach(period => {
            formatted[period] = {
                matches: stats[period].matches,
                totalScore: this.formatNumber(stats[period].totalScore),
                bestScore: this.formatNumber(stats[period].bestScore),
                playTime: this.formatTime(stats[period].playTime),
                playTimeSeconds: stats[period].playTime
            };
        });
        
        return formatted;
    }

    getMemberData(playerId) {
        const member = this.clanMembers.get(playerId.toString());
        if (!member) return null;
        
        return {
            ...member,
            formattedStats: this.formatMemberStats(member.stats)
        };
    }

    getClanStats() {
        const stats = {
            totalMembers: this.clanMembers.size,
            onlineMembers: 0,
            totalScore: 0,
            totalMatches: 0,
            totalPlayTime: 0,
            avgScore: 0,
            activityRate: 0
        };

        let totalScoreSum = 0;
        let totalMembersWithMatches = 0;

        this.clanMembers.forEach(member => {
            if (member.isOnline) stats.onlineMembers++;
            
            const allTimeStats = member.stats.allTime;
            stats.totalScore += allTimeStats.totalScore;
            stats.totalMatches += allTimeStats.matches;
            stats.totalPlayTime += allTimeStats.playTime;
            
            if (allTimeStats.matches > 0) {
                totalScoreSum += allTimeStats.totalScore;
                totalMembersWithMatches++;
            }
        });

        // Calcula médias
        if (totalMembersWithMatches > 0) {
            stats.avgScore = Math.floor(totalScoreSum / totalMembersWithMatches);
        }
        
        if (stats.totalMembers > 0) {
            stats.activityRate = Math.floor((stats.onlineMembers / stats.totalMembers) * 100);
        }

        return stats;
    }

    getConnectionStatus() {
        const status = [];
        
        this.connections.forEach((connection, key) => {
            status.push({
                name: key,
                connected: connection.isConnected(),
                healthy: connection.isHealthy(),
                playersCount: connection.getPlayersCount(),
                lastUpdate: connection.getLastUpdate(),
                reconnectAttempts: connection.reconnectAttempts
            });
        });
        
        return status;
    }

    getMetrics() {
        return {
            ...this.metrics,
            connectionsHealth: this.getConnectionStatus(),
            uptime: Date.now() - this.metrics.lastUpdate
        };
    }
}

// Classe de conexão otimizada
class OptimizedArenaConnection {
    constructor(url, serverName, platform, onTopPlayersUpdate, onStatusChange) {
        this.url = url;
        this.serverName = serverName;
        this.platform = platform;
        this.onTopPlayersUpdate = onTopPlayersUpdate;
        this.onStatusChange = onStatusChange;
        
        this.socket = null;
        this.heartbeatInterval = null;
        this.reconnectTimeout = null;
        this.connectionKey = `${serverName}-${platform}`;
        
        // Estado da conexão
        this.state = 'disconnected'; // disconnected, connecting, connected, error
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.lastHeartbeat = 0;
        this.lastUpdate = 0;
        this.playersCount = 0;
        
        // Buffer de dados
        this.topplayers = [];
        this.messageBuffer = [];
        
        // Inicia conexão
        this.connect();
    }

    connect() {
        if (this.state === 'connecting' || this.state === 'connected') {
            return;
        }

        this.state = 'connecting';
        console.log(`🔗 Conectando ${this.connectionKey}...`);

        try {
            this.socket = new WebSocket(this.url);
            this.socket.binaryType = "arraybuffer";
            
            // Timeout para conexão
            const connectionTimeout = setTimeout(() => {
                if (this.state === 'connecting') {
                    this.handleError(new Error('Timeout na conexão'));
                }
            }, 10000);
            
            this.socket.onopen = (e) => {
                clearTimeout(connectionTimeout);
                this.handleOpen();
            };
            
            this.socket.onclose = (e) => {
                clearTimeout(connectionTimeout);
                this.handleClose(e);
            };
            
            this.socket.onerror = (e) => {
                clearTimeout(connectionTimeout);
                this.handleError(e);
            };
            
            this.socket.onmessage = (e) => {
                this.handleMessage(e);
            };
            
        } catch (error) {
            this.handleError(error);
        }
    }

    handleOpen() {
        this.state = 'connected';
        this.reconnectAttempts = 0;
        this.lastHeartbeat = Date.now();
        
        console.log(`✅ ${this.connectionKey} conectado`);
        
        // Inicia heartbeat
        this.startHeartbeat();
        
        // Entra na arena
        this.enterArena();
        
        // Notifica mudança de status
        if (this.onStatusChange) {
            this.onStatusChange(this.connectionKey, 'connected', this);
        }
    }

    handleClose(event) {
        this.state = 'disconnected';
        this.stopHeartbeat();
        
        console.log(`❌ ${this.connectionKey} desconectado (${event.code})`);
        
        if (this.onStatusChange) {
            this.onStatusChange(this.connectionKey, 'disconnected', this);
        }
    }

    handleError(error) {
        this.state = 'error';
        this.stopHeartbeat();
        
        console.error(`⚠️ Erro ${this.connectionKey}:`, error.message);
        
        if (this.onStatusChange) {
            this.onStatusChange(this.connectionKey, 'error', this);
        }
    }

    handleMessage(event) {
        try {
            this.lastUpdate = Date.now();
            this.parseMessage(event);
        } catch (error) {
            console.error(`Erro ao processar mensagem ${this.connectionKey}:`, error);
        }
    }

    startHeartbeat() {
        this.stopHeartbeat();
        
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected()) {
                this.sendHeartbeat();
                
                // Verifica se recebeu resposta recente
                const timeSinceLastUpdate = Date.now() - this.lastUpdate;
                if (timeSinceLastUpdate > 30000) {
                    console.warn(`⚠️ ${this.connectionKey} sem resposta há ${timeSinceLastUpdate}ms`);
                }
            }
        }, 2000);
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    sendHeartbeat() {
        if (this.isConnected()) {
            this.send([0, 3, 1]);
            this.lastHeartbeat = Date.now();
        }
    }

    enterArena() {
        setTimeout(() => {
            if (this.isConnected()) {
                this.send([0, 3, 5, 0, 3, 4]);
            }
        }, 500);
    }

    send(data) {
        if (this.isConnected()) {
            try {
                this.socket.send(Uint8Array.from(data));
                return true;
            } catch (error) {
                console.error(`Erro ao enviar dados ${this.connectionKey}:`, error);
                return false;
            }
        }
        return false;
    }

    parseMessage(event) {
        const data = new Uint8Array(event.data);
        let current = 0;
        const fim = data.length;

        while (current < fim) {
            try {
                const size = (data[current] & 255) << 8 | data[current + 1] & 255;
                const next = current + size;
                
                if (next > fim) break;
                
                const packet = data.slice(current, next);
                this.processPacket(packet);
                
                current = next;
            } catch (error) {
                console.error(`Erro ao processar pacote ${this.connectionKey}:`, error);
                break;
            }
        }
    }

    processPacket(packet) {
        if (packet.length < 3) return;
        
        const tipo = packet[2];
        let offset = 3;
        
        switch (tipo) {
            case 22: // Top players
                this.processTopPlayers(packet, offset);
                break;
            case 79: // Reconnect request
                console.log(`🔄 Servidor solicitou reconexão ${this.connectionKey}`);
                this.reconnect();
                break;
        }
    }

    processTopPlayers(packet, offset) {
        try {
            if (packet.length < offset + 1) return;
            
            const count = packet[offset++] & 255;
            const players = [];
            
            for (let i = 0; i < count && offset < packet.length; i++) {
                const player = this.parsePlayer(packet, offset);
                if (player) {
                    players.push(player.data);
                    offset = player.newOffset;
                } else {
                    break;
                }
            }
            
            this.topplayers = players;
            this.playersCount = players.length;
            
            if (this.onTopPlayersUpdate && players.length > 0) {
                this.onTopPlayersUpdate(players, this.serverName, this.platform);
            }
            
        } catch (error) {
            console.error(`Erro ao processar top players ${this.connectionKey}:`, error);
        }
    }

    parsePlayer(packet, offset) {
        try {
            if (offset + 15 > packet.length) return null;
            
            // Place (2 bytes)
            const place = (packet[offset] & 255) << 8 | packet[offset + 1] & 255;
            offset += 2;
            
            // Name length (2 bytes)
            const nameLength = (packet[offset] & 255) << 8 | packet[offset + 1] & 255;
            offset += 2;
            
            if (offset + nameLength + 11 > packet.length) return null;
            
            // Name
            const name = new TextDecoder().decode(packet.slice(offset, offset + nameLength));
            offset += nameLength;
            
            // Mass (4 bytes)
            const mass = (packet[offset] & 255) << 24 |
                        (packet[offset + 1] & 255) << 16 |
                        (packet[offset + 2] & 255) << 8 |
                        packet[offset + 3] & 255;
            offset += 4;
            
            // Crowns (1 byte)
            const crowns = packet[offset++] & 255;
            
            // Skin (1 byte)
            const skin = packet[offset++] & 255;
            
            // Flags (1 byte)
            const flags = packet[offset++] & 255;
            
            // Account ID (4 bytes)
            const accountId = (packet[offset] & 255) << 24 |
                             (packet[offset + 1] & 255) << 16 |
                             (packet[offset + 2] & 255) << 8 |
                             packet[offset + 3] & 255;
            offset += 4;
            
            // ID (2 bytes)
            const id = (packet[offset] & 255) << 8 | packet[offset + 1] & 255;
            offset += 2;
            
            return {
                data: {
                    place,
                    name,
                    mass,
                    crowns,
                    skin,
                    flags,
                    accountId,
                    id
                },
                newOffset: offset
            };
            
        } catch (error) {
            console.error(`Erro ao parsear jogador:`, error);
            return null;
        }
    }

    reconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error(`❌ Máximo de tentativas atingido para ${this.connectionKey}`);
            return;
        }

        this.disconnect();
        this.reconnectAttempts++;
        
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        
        this.reconnectTimeout = setTimeout(() => {
            this.connect();
        }, delay);
    }

    disconnect() {
        this.state = 'disconnected';
        this.stopHeartbeat();
        
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        
        if (this.socket) {
            try {
                this.socket.close();
            } catch (error) {
                // Ignora erros ao fechar
            }
            this.socket = null;
        }
    }

    // Métodos de status
    isConnected() {
        return this.state === 'connected' && 
               this.socket && 
               this.socket.readyState === WebSocket.OPEN;
    }

    isFailed() {
        return this.state === 'error' || 
               (this.socket && this.socket.readyState === WebSocket.CLOSED);
    }

    isHealthy() {
        if (!this.isConnected()) return false;
        
        const timeSinceLastUpdate = Date.now() - this.lastUpdate;
        const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeat;
        
        return timeSinceLastUpdate < 60000 && timeSinceLastHeartbeat < 10000;
    }

    shouldReconnect() {
        return this.reconnectAttempts < this.maxReconnectAttempts && 
               (this.state === 'disconnected' || this.state === 'error');
    }

    getPlayersCount() {
        return this.playersCount;
    }

    getLastUpdate() {
        return this.lastUpdate;
    }
}