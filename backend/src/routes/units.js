import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { auth } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'

const router = Router()

router.use(auth)

router.get('/', requireRole('ADMIN'), async (_req, res) => {
  const units = await prisma.unit.findMany({
    orderBy: { createdAt: 'desc' },
    include: { assignedTech: true },
  })
  return res.json({ units })
})

router.get('/mine', async (req, res) => {
  if (req.user.role === 'ADMIN') {
    const units = await prisma.unit.findMany({ orderBy: { createdAt: 'desc' } })
    return res.json({ units })
  }
  const units = await prisma.unit.findMany({
    where: { assignedTechId: req.user.userId },
    orderBy: { createdAt: 'desc' },
  })
  return res.json({ units })
})

router.post('/', requireRole('ADMIN'), async (req, res) => {
  const { serialNumber, assignedTechId, shift } = req.body ?? {}
  if (!serialNumber || !shift) {
    return res.status(400).json({ error: 'serialNumber and shift are required.' })
  }

  const unit = await prisma.unit.create({
    data: {
      serialNumber,
      assignedTechId: assignedTechId ?? null,
      shift,
    },
  })
  return res.status(201).json({ unit })
})

router.patch('/:id/advance', async (req, res) => {
  const unit = await prisma.unit.findUnique({ where: { id: req.params.id } })
  if (!unit) return res.status(404).json({ error: 'Unit not found.' })
  if (req.user.role !== 'ADMIN' && unit.assignedTechId !== req.user.userId) {
    return res.status(403).json({ error: 'Not your assigned unit.' })
  }
  if (unit.status === 'COMPLETE') {
    return res.status(400).json({ error: 'Unit is already complete.' })
  }

  const currentStep = await prisma.assemblyStep.findUnique({
    where: { stepNumber: unit.currentStepNumber },
  })
  if (!currentStep) {
    return res.status(400).json({ error: `No step exists for step number ${unit.currentStepNumber}.` })
  }

  const finalStep = await prisma.assemblyStep.findFirst({
    orderBy: { stepNumber: 'desc' },
  })
  if (!finalStep) {
    return res.status(400).json({ error: 'No assembly steps are configured.' })
  }

  const now = new Date()
  const actorTechId = unit.assignedTechId ?? req.user.userId

  const existingCompletion = await prisma.stepCompletion.findFirst({
    where: { unitId: unit.id, stepId: currentStep.id },
    orderBy: { startedAt: 'desc' },
  })

  const completion =
    existingCompletion && !['COMPLETE', 'REWORK', 'BLOCKED'].includes(existingCompletion.status)
      ? await prisma.stepCompletion.update({
          where: { id: existingCompletion.id },
          data: {
            status: 'COMPLETE',
            completedAt: now,
            elapsedSeconds: Math.floor(
              (now.getTime() - new Date(existingCompletion.startedAt ?? now).getTime()) / 1000,
            ),
          },
        })
      : existingCompletion
        ? existingCompletion
        : await prisma.stepCompletion.create({
            data: {
              unitId: unit.id,
              stepId: currentStep.id,
              techId: actorTechId,
              status: 'COMPLETE',
              startedAt: now,
              completedAt: now,
              elapsedSeconds: 0,
            },
          })

  const isFinalStep = unit.currentStepNumber >= finalStep.stepNumber
  const next = await prisma.unit.update({
    where: { id: unit.id },
    data: isFinalStep
      ? { status: 'COMPLETE', completedAt: now }
      : { currentStepNumber: { increment: 1 } },
  })

  return res.json({ unit: next, completion })
})

router.patch('/:id/status', requireRole('ADMIN'), async (req, res) => {
  const { status } = req.body ?? {}
  const unit = await prisma.unit.update({
    where: { id: req.params.id },
    data: { status },
  })
  return res.json({ unit })
})

export default router
