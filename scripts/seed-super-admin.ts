import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.production') });

import bcrypt from 'bcrypt';
import { prisma } from '@esl/shared';

async function main() {
    const email = 'admin-esl@eplus.com.ec';
    const password = '3$lPa$$26';
    const role = 'SUPER_ADMIN';
    const tenantId = 'tenant-001';

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        console.log(`User ${email} already exists (id: ${existing.id}, role: ${existing.role}).`);
        // Update role to SUPER_ADMIN if needed
        if (existing.role !== role) {
            await prisma.user.update({ where: { email }, data: { role } });
            console.log(`Updated role to ${role}.`);
        }
        process.exit(0);
    }

    // Check tenant exists
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
        console.error(`Tenant ${tenantId} not found. Please create the tenant first.`);
        process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
        data: {
            email,
            passwordHash,
            name: 'Super Admin ESL',
            role,
            tenantId,
            status: 'ACTIVE'
        }
    });

    console.log(`✅ SUPER_ADMIN user created:`);
    console.log(`   Email:    ${email}`);
    console.log(`   Role:     ${role}`);
    console.log(`   Tenant:   ${tenantId}`);
    console.log(`   User ID:  ${user.id}`);
    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
