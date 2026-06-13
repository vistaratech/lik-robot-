/**
 * ═══════════════════════════════════════════════
 *  VILY WiFi Manager
 *  WebSockets client wrapper for ESP32 WiFi communication
 * ═══════════════════════════════════════════════
 */

const CMD = {
    MOVE_FORWARD:   0x01,
    MOVE_BACKWARD:  0x02,
    TURN_LEFT:      0x03,
    TURN_RIGHT:     0x04,
    STOP:           0x05,
    SPIN_LEFT:      0x06,
    SPIN_RIGHT:     0x07,
    LED_SET:        0x10,
    LED_BLINK:      0x11,
    LED_OFF:        0x12,
    ANIM_PLAY:      0x20,
    ANIM_STOP:      0x21,
    HANDSHAKE:      0xFE,
    PING:           0xFF,
};

const ANIM = {
    SHAKE:    0x01,
    NOD:      0x02,
    DANCE:    0x03,
    EXCITED:  0x04,
    SHY:      0x05,
};

class WiFiManager {
    constructor() {
        this.socket = null;
        this.ipAddress = '';
        this.connected = false;
        this.handshaked = false;
        this.seq = 0;
        this.pingInterval = null;
        
        // Event callbacks (populated by app.js)
        this.onConnect = null;
        this.onDisconnect = null;
        this.onBattery = null;
        this.onMotorStatus = null;
        this.onLog = null;
    }

    isSupported() {
        return 'WebSocket' in window;
    }

    log(msg, level = 'info') {
        console.log(`[WiFi] ${msg}`);
        if (this.onLog) this.onLog(msg, level);
    }

    /**
     * Connect to VILY via WebSocket
     */
    connect(ipAddress) {
        return new Promise((resolve, reject) => {
            if (!this.isSupported()) {
                this.log('WebSockets not supported in this browser!', 'error');
                return reject(new Error('WebSockets not supported'));
            }

            this.log(`Connecting to ws://${ipAddress}...`);
            this.ipAddress = ipAddress;

            try {
                this.socket = new WebSocket(`ws://${ipAddress}`);
                this.socket.binaryType = 'arraybuffer';

                const connectTimeout = setTimeout(() => {
                    if (this.socket.readyState !== WebSocket.OPEN) {
                        this.log('Connection timeout', 'error');
                        this.socket.close();
                        reject(new Error('Connection timeout'));
                    }
                }, 5000);

                this.socket.onopen = () => {
                    clearTimeout(connectTimeout);
                    this.connected = true;
                    this.log('Socket open, performing handshake...', 'success');
                    
                    // Send handshake command
                    const packet = this.buildPacket(CMD.HANDSHAKE);
                    this.socket.send(packet);

                    this.startPing();
                    resolve(true);
                };

                this.socket.onmessage = (event) => {
                    if (typeof event.data === 'string') {
                        this.log(`Handshake response: ${event.data}`, 'success');
                        this.handshaked = true;
                        if (this.onConnect) this.onConnect(event.data.split('|')[0] || 'VILY');
                    } else if (event.data instanceof ArrayBuffer) {
                        const data = new Uint8Array(event.data);
                        if (data.length === 1) {
                            const percent = data[0];
                            if (this.onBattery) this.onBattery(percent);
                        } else if (data.length === 4) {
                            if (this.onMotorStatus) this.onMotorStatus(data);
                        }
                    }
                };

                this.socket.onclose = () => {
                    clearTimeout(connectTimeout);
                    this.handleDisconnect();
                };

                this.socket.onerror = (err) => {
                    clearTimeout(connectTimeout);
                    this.log(`WebSocket error: ${err.message || 'unknown'}`, 'error');
                    reject(err);
                };

            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Build an 8-byte command packet matching firmware specification
     */
    buildPacket(cmd, param1 = 0, param2 = 0, value = 0, duration = 0, flags = 0) {
        const packet = new Uint8Array(8);
        packet[0] = this.seq & 0xFF;       // SEQ — rolling counter
        packet[1] = cmd;                     // CMD
        packet[2] = param1 & 0xFF;          // PARAM1
        packet[3] = param2 & 0xFF;          // PARAM2
        packet[4] = value & 0xFF;           // VALUE (speed/magnitude)
        packet[5] = duration & 0xFF;        // DURATION
        packet[6] = flags & 0xFF;           // FLAGS
        
        // CRC — XOR checksum of bytes 0-6
        let crc = 0;
        for (let i = 0; i < 7; i++) {
            crc ^= packet[i];
        }
        packet[7] = crc;                    // CRC
        
        this.seq = (this.seq + 1) & 0xFF;  // Increment sequence
        return packet;
    }

    /**
     * Write command packet to WebSocket
     */
    async writeCmd(packet) {
        if (!this.connected || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return false;
        }

        try {
            this.socket.send(packet);
            return true;
        } catch (err) {
            this.log(`Write failed: ${err.message}`, 'error');
            return false;
        }
    }

    // ─────────────────────────────────────────────
    //  High-Level Command Methods (Exact match of BLEManager)
    // ─────────────────────────────────────────────

    async moveForward(speed) {
        return this.writeCmd(this.buildPacket(CMD.MOVE_FORWARD, 0, 0, speed));
    }

    async moveBackward(speed) {
        return this.writeCmd(this.buildPacket(CMD.MOVE_BACKWARD, 0, 0, speed));
    }

    async turnLeft(speed) {
        return this.writeCmd(this.buildPacket(CMD.TURN_LEFT, 0, 0, speed));
    }

    async turnRight(speed) {
        return this.writeCmd(this.buildPacket(CMD.TURN_RIGHT, 0, 0, speed));
    }

    async stop() {
        return this.writeCmd(this.buildPacket(CMD.STOP));
    }

    async spinLeft(speed) {
        return this.writeCmd(this.buildPacket(CMD.SPIN_LEFT, 0, 0, speed));
    }

    async spinRight(speed) {
        return this.writeCmd(this.buildPacket(CMD.SPIN_RIGHT, 0, 0, speed));
    }

    async setLED(r, g, b) {
        return this.writeCmd(this.buildPacket(CMD.LED_SET, r, g, 0, 0, b));
    }

    async blinkLED(rate, count) {
        return this.writeCmd(this.buildPacket(CMD.LED_BLINK, rate, count));
    }

    async ledOff() {
        return this.writeCmd(this.buildPacket(CMD.LED_OFF));
    }

    async playAnimation(animId) {
        return this.writeCmd(this.buildPacket(CMD.ANIM_PLAY, animId));
    }

    async stopAnimation() {
        return this.writeCmd(this.buildPacket(CMD.ANIM_STOP));
    }

    async ping() {
        return this.writeCmd(this.buildPacket(CMD.PING));
    }

    // ─────────────────────────────────────────────
    //  Connection Management
    // ─────────────────────────────────────────────

    startPing() {
        this.stopPing();
        this.pingInterval = setInterval(async () => {
            if (this.connected && this.handshaked) {
                try {
                    await this.ping();
                } catch (e) {}
            }
        }, 3000);
    }

    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    handleDisconnect() {
        this.log('Disconnected from VILY', 'warning');
        this.cleanup();
        if (this.onDisconnect) this.onDisconnect();
    }

    async disconnect() {
        if (this.socket) {
            try {
                await this.stop();
                await this.ledOff();
            } catch (e) {}
            this.socket.close();
        }
        this.cleanup();
        this.log('Disconnected', 'info');
    }

    cleanup() {
        this.stopPing();
        this.connected = false;
        this.handshaked = false;
        this.socket = null;
    }

    async reconnect() {
        if (!this.ipAddress) {
            this.log('No previous IP address to reconnect to', 'warning');
            return false;
        }
        try {
            await this.connect(this.ipAddress);
            return true;
        } catch (err) {
            return false;
        }
    }
}

// Export singleton instance as 'ble' to maintain backward compatibility with games.js/app.js
const ble = new WiFiManager();
window.ble = ble; // Bind to window so global scripts see it
