import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting DB seed for ESL v3...');

    // ─── Tenant ─────────────────────────────────────────────────────
    const tenant = await prisma.tenant.upsert({
        where: { id: 'tenant-001' },
        update: { defaultLanguage: 'en', code: 'ENT-UAT' },
        create: {
            id: 'tenant-001', name: 'Enterprise UAT Corp', code: 'ENT-UAT',
            status: 'ACTIVE', defaultLanguage: 'en', contactEmail: 'admin@enterprise.com',
            maxStores: 50, maxTags: 100000
        }
    });
    console.log('✓ Tenant:', tenant.name);

    // ─── Users with RBAC ────────────────────────────────────────────
    const adminHash = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.upsert({
        where: { email: 'admin@enterprise.com' },
        update: { role: 'TENANT_ADMIN', language: 'en' },
        create: {
            tenantId: tenant.id, email: 'admin@enterprise.com', name: 'Admin User',
            passwordHash: adminHash, role: 'TENANT_ADMIN', language: 'en', status: 'ACTIVE'
        }
    });

    const storeAdminHash = await bcrypt.hash('store123', 10);
    const storeAdmin = await prisma.user.upsert({
        where: { email: 'store@enterprise.com' },
        update: { role: 'STORE_ADMIN', language: 'es' },
        create: {
            tenantId: tenant.id, email: 'store@enterprise.com', name: 'Store Manager',
            passwordHash: storeAdminHash, role: 'STORE_ADMIN', language: 'es', status: 'ACTIVE'
        }
    });
    console.log('✓ Users: admin (TENANT_ADMIN), store (STORE_ADMIN)');

    // ─── Store ──────────────────────────────────────────────────────
    const store = await prisma.store.upsert({
        where: { id: 'store-001' },
        update: { code: 'STORE-HQ', address: '123 Main St, City' },
        create: {
            id: 'store-001', tenantId: tenant.id, name: 'Headquarters Store',
            code: 'STORE-HQ', timezone: 'America/Bogota', address: '123 Main St, City', status: 'ACTIVE'
        }
    });

    const store2 = await prisma.store.upsert({
        where: { id: 'store-002' },
        update: { code: 'STORE-NORTH' },
        create: {
            id: 'store-002', tenantId: tenant.id, name: 'North Branch',
            code: 'STORE-NORTH', timezone: 'America/Bogota', address: '456 North Ave', status: 'ACTIVE'
        }
    });
    console.log('✓ Stores:', store.name, ',', store2.name);

    // Update store admin scope
    await prisma.user.update({
        where: { email: 'store@enterprise.com' },
        data: { storeScope: JSON.stringify([store.id]) }
    });

    // ─── Tag Models ─────────────────────────────────────────────────
    const model1 = await prisma.tagModel.upsert({
        where: { id: 'model-2.13' },
        update: {},
        create: { id: 'model-2.13', name: '2.13_BWR', width: 250, height: 122, supportsRed: true }
    });
    const model2 = await prisma.tagModel.upsert({
        where: { id: 'model-4.2' },
        update: {},
        create: { id: 'model-4.2', name: '4.2_BWR', width: 400, height: 300, supportsRed: true }
    });
    console.log('✓ Tag Models: 2.13_BWR, 4.2_BWR');

    // ─── Gateway ────────────────────────────────────────────────────
    await prisma.gateway.upsert({
        where: { macAddress: '00:11:22:33:44:01' },
        update: {},
        create: {
            macAddress: '00:11:22:33:44:01', tenantId: tenant.id, storeId: store.id,
            status: 'ONLINE', lastSeenAt: new Date()
        }
    });
    console.log('✓ Gateway: 00:11:22:33:44:01');

    // ─── Tags ───────────────────────────────────────────────────────
    for (const i of [1, 2, 3]) {
        const mac = `AA:BB:CC:00:00:0${i}`;
        await prisma.tag.upsert({
            where: { macAddress: mac },
            update: {},
            create: {
                macAddress: mac, tenantId: tenant.id, storeId: store.id,
                modelId: i <= 2 ? model1.id : model2.id, status: 'ONLINE', lastSeenAt: new Date()
            }
        });
    }
    console.log('✓ Tags: AA:BB:CC:00:00:01-03');

    // ─── Templates ──────────────────────────────────────────────────
    const tmpl1 = await prisma.template.upsert({
        where: { id: 'tmpl-price' },
        update: {},
        create: { id: 'tmpl-price', tenantId: tenant.id, name: 'Standard Price Tag', description: 'Default layout for product price tags' }
    });
    const tmpl2 = await prisma.template.upsert({
        where: { id: 'tmpl-promo' },
        update: {},
        create: { id: 'tmpl-promo', tenantId: tenant.id, name: 'Promo Banner', description: 'Promotional sale banners' }
    });
    console.log('✓ Templates:', tmpl1.name, ',', tmpl2.name);

    // ─── Template Versions ──────────────────────────────────────────
    const tv1 = await prisma.templateVersion.upsert({
        where: { templateId_version: { templateId: tmpl1.id, version: 1 } },
        update: {},
        create: {
            id: 'tv-price-v1', templateId: tmpl1.id, version: 1, tagModelId: model1.id,
            colorMode: 'BWR', fabricJson: '{}', normalizedDtoJson: '{}', isPublished: true
        }
    });
    const tv2 = await prisma.templateVersion.upsert({
        where: { templateId_version: { templateId: tmpl2.id, version: 1 } },
        update: {},
        create: {
            id: 'tv-promo-v1', templateId: tmpl2.id, version: 1, tagModelId: model2.id,
            colorMode: 'BWR', fabricJson: '{}', normalizedDtoJson: '{}', isPublished: true
        }
    });
    console.log('✓ Template Versions: v1 (Standard), v1 (Promo)');

    // ─── Store Defaults ─────────────────────────────────────────────
    await prisma.storeDefault.upsert({
        where: { storeId_tagModelId_colorMode: { storeId: store.id, tagModelId: model1.id, colorMode: 'BWR' } },
        update: { templateVersionId: tv1.id },
        create: { tenantId: tenant.id, storeId: store.id, tagModelId: model1.id, colorMode: 'BWR', templateVersionId: tv1.id }
    });
    await prisma.storeDefault.upsert({
        where: { storeId_tagModelId_colorMode: { storeId: store.id, tagModelId: model2.id, colorMode: 'BWR' } },
        update: { templateVersionId: tv2.id },
        create: { tenantId: tenant.id, storeId: store.id, tagModelId: model2.id, colorMode: 'BWR', templateVersionId: tv2.id }
    });
    console.log('✓ Store Defaults set');

    // ─── Products (SKUs) ────────────────────────────────────────────
    const products = [
        { sku: 'SKU-001', name: 'Organic Milk 1L', category: 'Dairy', brand: 'FarmFresh', barcode: '7501234567890', price: 3.49 },
        { sku: 'SKU-002', name: 'Whole Wheat Bread', category: 'Bakery', brand: 'GoldenHarvest', barcode: '7501234567891', price: 2.99 },
        { sku: 'SKU-003', name: 'Free Range Eggs 12ct', category: 'Dairy', brand: 'HappyHens', barcode: '7501234567892', price: 5.99 },
        { sku: 'SKU-004', name: 'Mineral Water 500ml', category: 'Beverages', brand: 'PureSpring', barcode: '7501234567893', price: 1.29 },
        { sku: 'SKU-005', name: 'Dark Chocolate 70%', category: 'Snacks', brand: 'CocoaLux', barcode: '7501234567894', price: 4.49 },
    ];
    for (const p of products) {
        await prisma.product.upsert({
            where: { tenantId_sku: { tenantId: tenant.id, sku: p.sku } },
            update: { name: p.name, price: p.price },
            create: { tenantId: tenant.id, ...p, currency: 'USD', status: 'ACTIVE' }
        });
    }
    console.log('✓ Products: 5 SKUs seeded');

    // ─── Tag Assignments ────────────────────────────────────────────
    await prisma.tagAssignment.upsert({
        where: { tagMac: 'AA:BB:CC:00:00:01' },
        update: {},
        create: {
            tagMac: 'AA:BB:CC:00:00:01', tenantId: tenant.id, storeId: store.id,
            sku: 'SKU-001', templateVersionId: tv1.id, assignedBy: admin.id, source: 'WEB'
        }
    });
    await prisma.tagAssignment.upsert({
        where: { tagMac: 'AA:BB:CC:00:00:02' },
        update: {},
        create: {
            tagMac: 'AA:BB:CC:00:00:02', tenantId: tenant.id, storeId: store.id,
            sku: 'SKU-002', assignedBy: admin.id, source: 'WEB'
        }
    });
    console.log('✓ Tag Assignments for tags 01, 02');

    // ─── Location Zone + Slot ───────────────────────────────────────
    const zone = await prisma.locationZone.upsert({
        where: { id: 'zone-a' },
        update: {},
        create: { id: 'zone-a', tenantId: tenant.id, storeId: store.id, name: 'Aisle A' }
    });
    await prisma.locationSlot.upsert({
        where: { storeId_code: { storeId: store.id, code: 'A1-B1-S1-P1' } },
        update: {},
        create: { tenantId: tenant.id, storeId: store.id, zoneId: zone.id, code: 'A1-B1-S1-P1', status: 'ACTIVE' }
    });
    console.log('✓ Location Zone + Slot');

    // ─── Campaign ───────────────────────────────────────────────────
    await prisma.campaign.upsert({
        where: { id: 'camp-weekend' },
        update: {},
        create: {
            id: 'camp-weekend', tenantId: tenant.id, storeId: store.id, name: 'Weekend Sale',
            startAt: new Date('2026-03-01'), endAt: new Date('2026-03-03'),
            templateVersionId: tv2.id, status: 'DRAFT'
        }
    });
    console.log('✓ Campaign: Weekend Sale');

    console.log('\n🎉 Seeding completed successfully (v3).');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
