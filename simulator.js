// simulator.js
const net = require('net');

const client = new net.Socket();

// High-density waypoints matching exact turns, lanes, and flyovers
const DENSE_ROUTE = [
    // 1. Thane Station West Exit / Gokhale Rd
    { lat: 19.18652, lng: 72.97576 },
    { lat: 19.18735, lng: 72.97415 },
    { lat: 19.18820, lng: 72.97270 },
    { lat: 19.18905, lng: 72.97080 },
    // 2. Hariniwas Circle & Teen Hath Naka Approach
    { lat: 19.18995, lng: 72.96890 },
    { lat: 19.19080, lng: 72.96750 },
    { lat: 19.19185, lng: 72.96645 },
    // 3. Merging on Eastern Express Highway (EEH)
    { lat: 19.19360, lng: 72.96580 },
    { lat: 19.19580, lng: 72.96540 },
    { lat: 19.19820, lng: 72.96525 }, // Past Nitin Casting
    { lat: 19.20100, lng: 72.96550 },
    { lat: 19.20380, lng: 72.96620 }, // Cadbury Junction Flyover
    { lat: 19.20650, lng: 72.96730 },
    { lat: 19.20920, lng: 72.96890 }, // Viviana Mall side
    { lat: 19.21180, lng: 72.97060 }, // Jupiter Hospital
    // 4. Majiwada Flyover curve towards Ghodbunder Rd
    { lat: 19.21480, lng: 72.97250 },
    { lat: 19.21720, lng: 72.97410 },
    { lat: 19.21950, lng: 72.97540 },
    { lat: 19.22180, lng: 72.97630 }, // Kapurbawdi Junction
    // 5. Ghodbunder Road straight to Manpada
    { lat: 19.22450, lng: 72.97685 },
    { lat: 19.22720, lng: 72.97710 }, // Tattvagyan Vidyapeeth
    { lat: 19.22980, lng: 72.97680 },
    { lat: 19.23220, lng: 72.97635 }, // R-Mall / Manpada Junction
    { lat: 19.23450, lng: 72.97570 }  // Manpada Service Road
];

let currentIndex = 0;
let stepDirection = 1;
let speed = 36; // km/h

client.connect(5023, '127.0.0.1', () => {
    console.log(`[Connected] Simulating Jimi VL03 GPS Tracker.`);

    const loginPacket = Buffer.from([
        0x78, 0x78, 0x0d, 0x01,
        0x01, 0x23, 0x45, 0x67, 0x89, 0x01, 0x23, 0x45,
        0x00, 0x01, 0x8c, 0xdd, 0x0d, 0x0a
    ]);
    client.write(loginPacket);
});

function sendGpsLocation() {
    const currentPos = DENSE_ROUTE[currentIndex];

    currentIndex += stepDirection;

    // Reverse path at boundaries
    if (currentIndex >= DENSE_ROUTE.length - 1) {
        stepDirection = -1;
    } else if (currentIndex <= 0) {
        stepDirection = 1;
    }

    const now = new Date();
    const rawLat = Math.round(currentPos.lat * 1800000);
    const rawLng = Math.round(currentPos.lng * 1800000);

    const packet = Buffer.alloc(28);
    packet[0] = 0x78;
    packet[1] = 0x78;
    packet[2] = 0x16;
    packet[3] = 0x12;

    packet[4] = now.getUTCFullYear() - 2000;
    packet[5] = now.getUTCMonth() + 1;
    packet[6] = now.getUTCDate();
    packet[7] = now.getUTCHours();
    packet[8] = now.getUTCMinutes();
    packet[9] = now.getUTCSeconds();

    packet[10] = 0x84;
    packet.writeUInt32BE(rawLat, 11);
    packet.writeUInt32BE(rawLng, 15);
    packet[19] = speed;
    packet.writeUInt16BE(45, 20);
    packet.writeUInt16BE(currentIndex, 22);
    packet.writeUInt16BE(0xBEEF, 24);
    packet[26] = 0x0d;
    packet[27] = 0x0a;

    console.log(`[--> Step ${currentIndex}/${DENSE_ROUTE.length}] Lat: ${currentPos.lat}, Lng: ${currentPos.lng}`);
    client.write(packet);
}

client.on('data', (data) => {
    if (data[3] === 0x01) {
        console.log(`[SUCCESS] Streaming high-fidelity route...\n`);
        // Stream coordinates every 2.5 seconds
        setInterval(sendGpsLocation, 2500);
    }
});

client.on('error', (err) => console.error(`Error:`, err.message));