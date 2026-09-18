// server.js
const net = require('net');
const http = require('http');
const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');

const WEB_PORT = 3000; // Hosts Dashboard HTML + WebSocket Telemetry
const TCP_PORT = 5023; // Ingests GT06 GPS Hardware / Simulator data

// 1. HTTP Server + Express (Static Web Files)
const app = express();
app.use(express.static(path.join(__dirname)));

const httpServer = http.createServer(app);

// 2. Attach WebSocket Server to the same HTTP Server
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
    console.log(`[WS] New browser client connected!`);
    ws.on('close', () => console.log(`[WS] Browser client disconnected.`));
});

// Broadcast GPS data to all connected browser tabs/phones
function broadcastToBrowsers(payload) {
    const message = JSON.stringify(payload);
    wss.clients.forEach((client) => {
        if (client.readyState === 1) { // 1 = OPEN
            client.send(message);
        }
    });
}

// Start Combined Web + WS Server
httpServer.listen(WEB_PORT, '0.0.0.0', () => {
    console.log(`[HTTP/WS] Dashboard & Telemetry live at http://localhost:${WEB_PORT}`);
});

// 3. TCP Server for Hardware / Simulator (GT06 Protocol)
const tcpServer = net.createServer((socket) => {
    const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`\n[TCP] Hardware connected: ${clientAddress}`);

    let busImei = '0123456789012345';

    socket.on('data', (data) => {
        // GT06 header check
        if (data[0] !== 0x78 || data[1] !== 0x78) return;

        const protocolNumber = data[3];

        // CASE 1: Login Packet (0x01)
        if (protocolNumber === 0x01) {
            busImei = data.subarray(4, 12).toString('hex');
            const serialNo = data.subarray(12, 14);

            console.log(`[Handshake] Bus Registered -> IMEI: ${busImei}`);

            const ack = Buffer.from([
                0x78, 0x78, 0x05, 0x01,
                serialNo[0], serialNo[1],
                0xd9, 0xdc, 0x0d, 0x0a
            ]);
            socket.write(ack);
            return;
        }

        // CASE 2: Location Packet (0x12)
        if (protocolNumber === 0x12) {
            const rawLat = data.readUInt32BE(11);
            const rawLng = data.readUInt32BE(15);
            const latitude = rawLat / 1800000;
            const longitude = rawLng / 1800000;
            const speed = data[19];

            const locationData = {
                type: 'BUS_TELEMETRY',
                busId: busImei,
                lat: Number(latitude.toFixed(6)),
                lng: Number(longitude.toFixed(6)),
                speed: speed,
                timestamp: new Date().toLocaleTimeString()
            };

            console.log(`[TCP Ingest] Decoded: Lat ${locationData.lat}, Lng ${locationData.lng} -> Broadcasting...`);
            broadcastToBrowsers(locationData);
        }
    });

    socket.on('close', () => console.log(`[TCP] Hardware disconnected: ${clientAddress}`));
    socket.on('error', (err) => console.error(`[TCP] Error:`, err.message));
});

tcpServer.listen(TCP_PORT, '0.0.0.0', () => {
    console.log(`[TCP] Hardware Ingestion Server running on port ${TCP_PORT}`);
});