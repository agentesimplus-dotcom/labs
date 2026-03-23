import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.production') });

import Aedes from 'aedes';
import { createServer } from 'net';
import { prisma, normalizeMac } from '@esl/shared';

const aedes = new Aedes();
const server = createServer(aedes.handle);

const PORT = parseInt(process.env.MQTT_PORT || '8003', 10);

// Throttle map: MAC → last DB update timestamp (avoid excessive writes)
const lastUpdateMap = new Map<string, number>();
const THROTTLE_MS = 60_000; // Only update DB every 60 seconds per gateway

function shouldUpdate(mac: string): boolean {
    const now = Date.now();
    const last = lastUpdateMap.get(mac) || 0;
    if (now - last >= THROTTLE_MS) {
        lastUpdateMap.set(mac, now);
        return true;
    }
    return false;
}

// Authenticate: worker clients pass through, gateway clients verified by MAC in DB
aedes.authenticate = async (client, username, password, callback) => {
    try {
        if (client.id.startsWith('worker_')) {
            console.log(`[AUTH] Worker client allowed: ${client.id}`);
            return callback(null, true);
        }

        const macNorm = normalizeMac(client.id);
        console.log(`[AUTH] Checking Gateway MAC: ${client.id} -> normalized: ${macNorm}`);

        const gateway = await prisma.gateway.findUnique({
            where: { macAddress: macNorm }
        });

        if (gateway) {
            console.log(`[AUTH] Access GRANTED for Gateway: ${macNorm}`);
            callback(null, true);
        } else {
            console.log(`[AUTH] Access DENIED for MAC: ${macNorm}`);
            const error: any = new Error('Auth error');
            error.returnCode = 4;
            callback(error, false);
        }
    } catch (err) {
        console.error(`[AUTH] Error authenticating client:`, err);
        const error: any = new Error('Auth error');
        error.returnCode = 3;
        callback(error, false);
    }
};

// On connect: mark gateway ONLINE + update lastSeenAt
aedes.on('client', async (client) => {
    console.log(`[CLIENT_CONNECTED] Client ${client.id}`);
    if (client.id.startsWith('worker_')) return;

    try {
        const macNorm = normalizeMac(client.id);
        await prisma.gateway.update({
            where: { macAddress: macNorm },
            data: { status: 'ONLINE', lastSeenAt: new Date() }
        });
        lastUpdateMap.set(macNorm, Date.now());
        console.log(`[STATUS] Gateway ${macNorm} → ONLINE`);
    } catch (err) {
        console.error(`[STATUS] Error updating gateway on connect:`, err);
    }
});

// On disconnect: mark gateway OFFLINE
aedes.on('clientDisconnect', async (client) => {
    console.log(`[CLIENT_DISCONNECTED] Client ${client.id}`);
    if (client.id.startsWith('worker_')) return;

    try {
        const macNorm = normalizeMac(client.id);
        await prisma.gateway.update({
            where: { macAddress: macNorm },
            data: { status: 'OFFLINE' }
        });
        lastUpdateMap.delete(macNorm);
        console.log(`[STATUS] Gateway ${macNorm} → OFFLINE`);
    } catch (err) {
        console.error(`[STATUS] Error updating gateway on disconnect:`, err);
    }
});

const tagUpdateMap = new Map<string, number>();
const TAG_THROTTLE_MS = 60_000 * 5; // 5 minutes per tag

function shouldUpdateTag(mac: string): boolean {
    const now = Date.now();
    const last = tagUpdateMap.get(mac) || 0;
    if (now - last >= TAG_THROTTLE_MS) {
        tagUpdateMap.set(mac, now);
        return true;
    }
    return false;
}

// On publish: throttled lastSeenAt update (every 60s per gateway)
aedes.on('publish', async (packet, client) => {
    if (!client || packet.topic.startsWith('$SYS/')) return;
    if (client.id.startsWith('worker_')) return;

    // Uncomment this if you want to see all topics, but it can be noisy
    // console.log(`[PUBLISH] Client ${client.id} topic: ${packet.topic}`);

    const macNorm = normalizeMac(client.id);

    // 1. Tag extraction logic (find any tags mentioned in this payload)
    try {
        const payloadStr = packet.payload.toString();
        if (payloadStr.startsWith('{') || payloadStr.startsWith('[')) {
            const parsed = JSON.parse(payloadStr);
            const foundMacs = new Set<string>();

            const extractMacs = (obj: any, depth = 0) => {
                if (depth > 5 || !obj) return; // Prevent deep recursion
                if (Array.isArray(obj)) {
                    obj.forEach(item => extractMacs(item, depth + 1));
                } else if (typeof obj === 'object') {
                    const m = obj.mac || obj.macAddress || obj.device || obj.id || obj.tag_mac || obj.tagMac;
                    if (typeof m === 'string') {
                        const norm = normalizeMac(m);
                        if (norm && norm.length === 12 && /^[0-9A-F]{12}$/.test(norm)) {
                            foundMacs.add(norm);
                        }
                    }
                    for (const val of Object.values(obj)) {
                        if (val && typeof val === 'object') extractMacs(val, depth + 1);
                    }
                }
            };
            extractMacs(parsed);

            // Remove the gateway itself from tag updates just in case
            foundMacs.delete(macNorm);

            for (const tagMac of foundMacs) {
                if (shouldUpdateTag(tagMac)) {
                    await prisma.tag.updateMany({
                        where: { macAddress: tagMac },
                        data: { status: 'ONLINE', lastSeenAt: new Date() }
                    });
                }
            }
        }
    } catch (e) {
        // Ignore parse errors, payload might not be JSON or just partial data
    }

    // 2. Gateway update logic
    if (shouldUpdate(macNorm)) {
        try {
            await prisma.gateway.update({
                where: { macAddress: macNorm },
                data: { lastSeenAt: new Date() }
            });
        } catch (err) {
            console.error(`[PUBLISH] Error updating lastSeenAt:`, err);
        }
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`ESL MQTT Broker started and listening on port ${PORT}`);
});

process.on('SIGINT', () => {
    console.log('Shutting down broker...');
    server.close(() => {
        aedes.close(() => {
            console.log('Broker closed gracefully.');
            process.exit(0);
        });
    });
});
