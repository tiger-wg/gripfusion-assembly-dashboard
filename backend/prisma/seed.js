import bcrypt from 'bcrypt'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const adminPasswordHash = await bcrypt.hash('admin123', 10)
  const techPasswordHash = await bcrypt.hash('tech123', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'mason@gripfusion.com' },
    update: {
      name: 'Mason F.',
      role: 'ADMIN',
      isActive: true,
      passwordHash: adminPasswordHash,
      avatarInitials: 'MF',
    },
    create: {
      name: 'Mason F.',
      email: 'mason@gripfusion.com',
      role: 'ADMIN',
      isActive: true,
      passwordHash: adminPasswordHash,
      avatarInitials: 'MF',
    },
  })

  const tech = await prisma.user.upsert({
    where: { email: 'alex@gripfusion.com' },
    update: {
      name: 'Alex K.',
      role: 'TECHNICIAN',
      isActive: true,
      passwordHash: techPasswordHash,
      avatarInitials: 'AK',
    },
    create: {
      name: 'Alex K.',
      email: 'alex@gripfusion.com',
      role: 'TECHNICIAN',
      isActive: true,
      passwordHash: techPasswordHash,
      avatarInitials: 'AK',
    },
  })

  const stepData = [
    {
      stepNumber: 1,
      title: 'Pre-Assembly Setup',
      description: 'ESD setup, tool calibration, and station bind checks.',
      subSteps: [
        { id: '1-1', label: 'Verify ESD readiness', order: 1 },
        { id: '1-2', label: 'Calibrate torque tools', order: 2 },
      ],
      isPublished: true,
    },
    {
      stepNumber: 2,
      title: 'Petal Assembly',
      description: 'Align and lock petal set before core integration.',
      subSteps: [
        { id: '2-1', label: 'Align petals to orientation marks', order: 1 },
        { id: '2-2', label: 'Confirm clamp pressure and fit', order: 2 },
      ],
      isPublished: true,
    },
    {
      stepNumber: 3,
      title: 'Electronics and Core Assembly',
      description: 'Install PCB and harness; verify connector seating.',
      subSteps: [
        { id: '3-1', label: 'Install PCB and route harness', order: 1 },
        { id: '3-2', label: 'Inspect connector lock state', order: 2 },
      ],
      isPublished: false,
    },
  ]

  for (const step of stepData) {
    await prisma.assemblyStep.upsert({
      where: { stepNumber: step.stepNumber },
      update: { ...step, updatedBy: admin.id },
      create: { ...step, updatedBy: admin.id },
    })
  }

  const inventory = [
    { name: 'Super Glue', code: '3M PR100', category: 'CONSUMABLE', quantity: 40, minStock: 10 },
    { name: 'Hot Melt Glue', code: 'AP 10-4', category: 'CONSUMABLE', quantity: 18, minStock: 8 },
    { name: 'Torque Driver T8', code: 'DRV-T8', category: 'TOOL', quantity: 6, minStock: 3 },
  ]

  for (const item of inventory) {
    await prisma.inventoryItem.upsert({
      where: { id: `${item.code}-${item.name}`.replace(/\s+/g, '-').toLowerCase() },
      update: item,
      create: { id: `${item.code}-${item.name}`.replace(/\s+/g, '-').toLowerCase(), ...item },
    })
  }

  await prisma.unit.upsert({
    where: { serialNumber: 'GF-044' },
    update: { assignedTechId: tech.id, shift: 'Shift A' },
    create: { serialNumber: 'GF-044', assignedTechId: tech.id, shift: 'Shift A' },
  })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
