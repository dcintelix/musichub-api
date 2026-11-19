import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const roles = [
    { name: 'super_admin', description: 'Platform super administrator' },
    { name: 'admin', description: 'Platform administrator' },
    { name: 'moderator', description: 'Community moderator' },
    { name: 'member', description: 'Standard platform member' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }

  const permissions = [
    { key: 'users:read', description: 'Read users' },
    { key: 'users:write', description: 'Write users' },
    { key: 'profiles:write', description: 'Manage profile data' },
    { key: 'communities:read', description: 'Read communities' },
    { key: 'communities:write', description: 'Manage communities' },
    { key: 'admin:access', description: 'Access admin APIs' },
  ];

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: {},
      create: permission,
    });
  }

  const professions = [
    'Singer / Vocalist',
    'Instrumentalist',
    'Music Producer',
    'DJ',
    'Composer',
    'Songwriter',
    'Music Arranger',
    'Sound Engineer',
    'Music Director',
    'Music Teacher',
    'Choir Director',
    'Music Manager',
    'Other music professional',
  ];
  for (const name of professions) {
    await prisma.profession.upsert({
      where: { name },
      update: { isActive: true },
      create: { name },
    });
  }

  const genres = [
    'Afrobeats',
    'Afro-fusion',
    'Gospel',
    'Traditional Rwandan',
    'Hip hop',
    'R&B',
    'Pop',
    'Jazz',
    'Reggae',
    'Soul',
    'Classical',
    'Electronic',
    'World music',
  ];
  for (const name of genres) {
    await prisma.genre.upsert({
      where: { name },
      update: { isActive: true },
      create: { name },
    });
  }

  const instruments = [
    'Vocals',
    'Piano / Keyboard',
    'Guitar',
    'Bass guitar',
    'Drums',
    'Percussion',
    'Violin',
    'Saxophone',
    'Trumpet',
    'Flute',
    'Traditional instrument',
  ];
  for (const name of instruments) {
    await prisma.instrument.upsert({
      where: { name },
      update: { isActive: true },
      create: { name },
    });
  }

  console.log('Seeded core roles, permissions, and music catalogs.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
