// prisma/seed-welver.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const firebaseProjectId = process.env['FIREBASE_PROJECT_ID'];
  if (!firebaseProjectId) {
    throw new Error('FIREBASE_PROJECT_ID no está definido en .env');
  }

  console.log(`Registrando Welver → Firebase: ${firebaseProjectId}`);

  const ecosystem = await prisma.ecosystem.upsert({
    where:  { firebaseProjectId },
    update: { name: 'Welver', isActive: true },
    create: {
      firebaseProjectId,
      name:     'Welver',
      isActive: true,
      config: {
        maxProjects: 50,
        features: { faq: true, channels: true, widget: true },
      },
    },
  });

  console.log(`✓ Ecosistema: ${ecosystem.name}`);
  console.log(`  id:                ${ecosystem.id}`);
  console.log(`  firebaseProjectId: ${ecosystem.firebaseProjectId}`);
  console.log('');
  console.log('El TenantGuard resolverá este ecosistema en cada request (Sprint 2).');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());