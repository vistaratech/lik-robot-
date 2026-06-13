/**
 * ═══════════════════════════════════════════════
 *  VILY BLE Manager
 *  Web Bluetooth API wrapper for ESP32 communication
 * ═══════════════════════════════════════════════
 */

const BLE_CONFIG = {
    deviceName: 'VILY',
    serviceUUID: '4fafc201-1fb5-459e-8fcc-c5c9c331914b',
    characteristics: {
        motorCmd:    'beb5483e-36e1-4688-b7f5-ea07361b26a8',
        motorStatus: 'beb5483f-36e1-4688-b7f5-ea07361b26a8',
        ledControl:  'beb54840-36e1-4688-b7f5-ea07361b26a8',
        battery:     'beb54841-36e1-4688-b7f5-ea07361b26a8',
        handshake:   'beb54842-36e1-4688-b7f5-ea07361b26a8',
    }
};

// Command type constants (must match firmware config.h)
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

// Animation IDs
const ANIM = {
    SHAKE:    0x01,
    NOD:      0x02,
    DANCE:    0x03,
    EXCITED:  0x04,
    SHY:      0x05,
};

class BLEManager {
    constructor() {
        this.device = null;
        this.server = null;
        this.service = null;
        this.chars = {};
        this.connected = false;
        this.handshaked = false;
        this.seq = 0;
        this.pingInterval = null;
        this.batteryInterval = null;
        
        // Event callbacks
        this.onConnect = null;
        this.onDisconnect = null;
        this.onBattery = null;
        this.onMotorStatus = null;
        this.onLog = null;
    }

    /**
     * Check if Web Bluetooth is supported
     */
    isSupported() {
        return 'bluetooth' in navigator;
    }

    /**
     * Log a message (forwarded to UI)
     */
    log(msg, level = 'info') {
        console.log(`[BLE] ${msg}`);
        if (this.onLog) this.onLog(msg, level);
    }

    /**
     * Connect to VILY
     */
    async connect() {
        if (!this.isSupported()) {
            this.log('Web Bluetooth not supported in this browser!', 'error');
            throw new Error('Web Bluetooth not supported');
        }

        try {
            this.log('Scanning for VILY...');
            
            // Request device
            this.device = await navigator.bluetooth.requestDevice({
                filters: [
                    { name: BLE_CONFIG.deviceName },
                    { services: [BLE_CONFIG.serviceUUID] }
                ],
                optionalServices: [BLE_CONFIG.serviceUUID]
            });

            this.log(`Found device: ${this.device.name}`);

            // Listen for disconnection
            this.device.addEventListener('gattserverdisconnected', () => {
                this.handleDisconnect();
            });

            // Connect to GATT server
            this.log('Connecting to GATT server...');
            this.server = await this.device.gatt.connect();

            // Get primary service
            this.log('Discovering services...');
            this.service = await this.server.getPrimaryService(BLE_CONFIG.serviceUUID);

            // Get all characteristics
            this.log('Getting characteristics...');
            await this.discoverCharacteristics();

            this.connected = true;
            this.log('Connected! Sending handshake...', 'success');

            // Perform handshake
            await this.performHandshake();

            // Subscribe to notifications
            await this.subscribeNotifications();

            // Start ping heartbeat
            this.startPing();

            if (this.onConnect) this.onConnect(this.device.name);

            return true;

        } catch (err) {
            if (err.message.includes('User cancelled')) {
                this.log('Connection cancelled by user', 'warning');
            } else {
                this.log(`Connection failed: ${err.message}`, 'error');
            }
            this.cleanup();
            throw err;
        }
    }

    /**
     * Discover and cache all GATT characteristics
     */
    async discoverCharacteristics() {
        const charMap = BLE_CONFIG.characteristics;
        
        for (const [name, uuid] of Object.entries(charMap)) {
            try {
                this.chars[name] = await this.service.getCharacteristic(uuid);
                this.log(`  ✓ ${name} (${uuid.substring(0, 8)}...)`, 'success');
            } catch (err) {
                this.log(`  ✗ ${name} not found`, 'warning');
            }
        }
    }

    /**
     * Perform handshake with VILY (like LOOI's authentication)
     */
    async performHandshake() {
        const packet = this.buildPacket(CMD.HANDSHAKE, 0, 0, 0, 0, 0);
        await this.writeMotorCmd(packet);
        
        // Also write to handshake characteristic directly
        if (this.chars.handshake) {
            const encoder = new TextEncoder();
            await this.chars.handshake.writeValue(encoder.encode('HELLO'));
            
            // Read handshake response
            try {
                const response = await this.chars.handshake.readValue();
                const decoder = new TextDecoder();
                const info = decoder.decode(response);
                this.log(`Handshake response: ${info}`, 'success');
            } catch (e) {
                this.log('Handshake response read failed (non-critical)', 'warning');
            }
        }
        
        this.handshaked = true;
        this.log('🤝 Handshake complete!', 'success');
    }

    /**
     * Subscribe to notification characteristics
     */
    async subscribeNotifications() {
        // Motor status notifications
        if (this.chars.motorStatus) {
            try {
                await this.chars.motorStatus.startNotifications();
                this.chars.motorStatus.addEventListener('characteristicvaluechanged', (event) => {
                    const data = new Uint8Array(event.target.value.buffer);
                    if (this.onMotorStatus) this.onMotorStatus(data);
                });
                this.log('Subscribed to motor status', 'info');
            } catch (e) {
                this.log('Motor status subscription failed', 'warning');
            }
        }

        // Battery notifications
        if (this.chars.battery) {
            try {
                await this.chars.battery.startNotifications();
                this.chars.battery.addEventListener('characteristicvaluechanged', (event) => {
                    const data = new Uint8Array(event.target.value.buffer);
                    const percent = data[0];
                    if (this.onBattery) this.onBattery(percent);
                });
                this.log('Subscribed to battery updates', 'info');
                
                // Read initial battery value
                try {
                    const val = await this.chars.battery.readValue();
                    const percent = new Uint8Array(val.buffer)[0];
                    if (this.onBattery) this.onBattery(percent);
                } catch (e) {}
            } catch (e) {
                this.log('Battery subscription failed', 'warning');
            }
        }
    }

    /**
     * Build an 8-byte command packet
     * Format: [SEQ, CMD, PARAM1, PARAM2, VALUE, DURATION, FLAGS, CRC]
     */
    buildPacket(cmd, param1 = 0, param2 = 0, value = 0, duration = 0, flags = 0) {
        const packet = new Uint8Array(8);
        packet[0] = this.seq & 0xFF;       // SEQ — rolling counter
        packet[1] = cmd;                     // CMD
        packet[2] = param1 & 0xFF;          // PARAM1
        packet[3] = param2 & 0xFF;          // PARAM2
        packet[4] = value & 0xFF;           // VALUE (speed 0-100)
        packet[5] = duration & 0xFF;        // DURATION (in 10ms units)
        packet[6] = flags & 0xFF;           // FLAGS
        
        // CRC — XOR of bytes 0-6
        let crc = 0;
        for (let i = 0; i < 7; i++) {
            crc ^= packet[i];
        }
        packet[7] = crc;                    // CRC
        
        this.seq = (this.seq + 1) & 0xFF;  // Increment sequence
        
        return packet;
    }

    /**
     * Write to motor command characteristic
     */
    async writeMotorCmd(packet) {
        if (!this.chars.motorCmd) {
            this.log('Motor command characteristic not available', 'error');
            return false;
        }

        try {
            await this.chars.motorCmd.writeValue(packet);
            return true;
        } catch (err) {
            this.log(`Write failed: ${err.message}`, 'error');
            return false;
        }
    }

    // ─────────────────────────────────────────────
    //  High-Level Command Methods
    // ─────────────────────────────────────────────

    async moveForward(speed) {
        return this.writeMotorCmd(this.buildPacket(CMD.MOVE_FORWARD, 0, 0, speed));
    }

    async moveBackward(speed) {
        return this.writeMotorCmd(this.buildPacket(CMD.MOVE_BACKWARD, 0, 0, speed));
    }

    async turnLeft(speed) {
        return this.writeMotorCmd(this.buildPacket(CMD.TURN_LEFT, 0, 0, speed));
    }

    async turnRight(speed) {
        return this.writeMotorCmd(this.buildPacket(CMD.TURN_RIGHT, 0, 0, speed));
    }

    async stop() {
        return this.writeMotorCmd(this.buildPacket(CMD.STOP));
    }

    async spinLeft(speed) {
        return this.writeMotorCmd(this.buildPacket(CMD.SPIN_LEFT, 0, 0, speed));
    }

    async spinRight(speed) {
        return this.writeMotorCmd(this.buildPacket(CMD.SPIN_RIGHT, 0, 0, speed));
    }

    async setLED(r, g, b) {
        return this.writeMotorCmd(this.buildPacket(CMD.LED_SET, r, g, 0, 0, b));
    }

    async blinkLED(rate, count) {
        return this.writeMotorCmd(this.buildPacket(CMD.LED_BLINK, rate, count));
    }

    async ledOff() {
        return this.writeMotorCmd(this.buildPacket(CMD.LED_OFF));
    }

    async playAnimation(animId) {
        return this.writeMotorCmd(this.buildPacket(CMD.ANIM_PLAY, animId));
    }

    async stopAnimation() {
        return this.writeMotorCmd(this.buildPacket(CMD.ANIM_STOP));
    }

    async ping() {
        return this.writeMotorCmd(this.buildPacket(CMD.PING));
    }

    // ─────────────────────────────────────────────
    //  Connection Management
    // ─────────────────────────────────────────────

    /**
     * Start periodic ping to keep connection alive
     */
    startPing() {
        this.stopPing();
        this.pingInterval = setInterval(async () => {
            if (this.connected && this.handshaked) {
                try {
                    await this.ping();
                } catch (e) {
                    // Silently fail — disconnect handler will catch it
                }
            }
        }, 3000); // Ping every 3 seconds
    }

    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    /**
     * Handle disconnection event
     */
    handleDisconnect() {
        this.log('Disconnected from VILY', 'warning');
        this.cleanup();
        if (this.onDisconnect) this.onDisconnect();
    }

    /**
     * Manually disconnect
     */
    async disconnect() {
        if (this.device && this.device.gatt.connected) {
            // Send stop before disconnecting
            try {
                await this.stop();
                await this.ledOff();
            } catch (e) {}
            
            this.device.gatt.disconnect();
        }
        this.cleanup();
        this.log('Disconnected', 'info');
    }

    /**
     * Cleanup state
     */
    cleanup() {
        this.stopPing();
        this.connected = false;
        this.handshaked = false;
        this.chars = {};
        this.service = null;
        this.server = null;
        // Don't null device — needed for reconnect
    }

    /**
     * Attempt to reconnect to previously paired device
     */
    async reconnect() {
        if (!this.device) {
            this.log('No previous device to reconnect to', 'warning');
            return false;
        }

        try {
            this.log('Reconnecting...');
            this.server = await this.device.gatt.connect();
            this.service = await this.server.getPrimaryService(BLE_CONFIG.serviceUUID);
            await this.discoverCharacteristics();
            this.connected = true;
            await this.performHandshake();
            await this.subscribeNotifications();
            this.startPing();
            
            if (this.onConnect) this.onConnect(this.device.name);
            return true;
        } catch (err) {
            this.log(`Reconnect failed: ${err.message}`, 'error');
            return false;
        }
    }
}

// Export singleton instance
const ble = new BLEManager();
