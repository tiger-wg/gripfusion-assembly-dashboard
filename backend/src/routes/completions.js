import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { auth } from '../middleware/auth.js'

const router = Router()

router.use(auth)

router.get('/:unitId', async (req, res) => {
  const unit = await prisma.unit.findUnique({ where: { id: req.params.unitId } })
  if (!unit) return res.status(404).json({ error: 'Unit not found.' })
  if (req.user.role !== 'ADMIN' && unit.assignedTechId !== req.user.userId) {
    return res.status(403).json({ error: 'Not your assigned unit.' })
  }

  const completions = await prisma.stepCompletion.findMany({
    where: { unitId: req.params.unitId },
    orderBy: { startedAt: 'asc' },
    include: { step: true, tech: true },
  })
  return res.json({ completions })
})

router.post('/start', async (req, res) => {
  const { unitId, stepId } = req.body ?? {}
  if (!unitId || !stepId) {
    return res.status(400).json({ error: 'unitId and stepId are required.' })
  }

  const unit = await prisma.unit.findUnique({ where: { id: unitId } })
  const step = await prisma.assemblyStep.findUnique({ where: { id: stepId } })
  if (!unit || !step) return res.status(404).json({ error: 'Unit or step not found.' })
  if (req.user.role !== 'ADMIN' && unit.assignedTechId !== req.user.userId) {
    return res.status(403).json({ error: 'Not your assigned unit.' })
  }

  // Enforce previous step completion server-side.
  if (step.stepNumber > 1) {
    const previous = await prisma.assemblyStep.findUnique({
      where: { stepNumber: step.stepNumber - 1 },
    })
    if (previous) {
      const previousCompletion = await prisma.stepCompletion.findFirst({
        where: { unitId, stepId: previous.id, status: 'COMPLETE' },
      })
      if (!previousCompletion) {
        return res.status(400).json({ error: 'Previous step must be COMPLETE before starting this step.' })
      }
    }
  }

  const existingInProgress = await prisma.stepCompletion.findFirst({
    where: { unitId, stepId, status: 'IN_PROGRESS' },
    orderBy: { startedAt: 'desc' },
  })
  if (existingInProgress) {
    return res.json({ completion: existingInProgress })
  }

  const completion = await prisma.stepCompletion.create({
    data: {
      unitId,
      stepId,
      techId: req.user.userId,
      status: 'IN_PROGRESS',
      startedAt: new Date(),
    },
  })
  return res.status(201).json({ completion })
})

router.post('/complete', async (req, res) => {
  const { completionId, status = 'COMPLETE', notes } = req.body ?? {}
  if (!completionId) return res.status(400).json({ error: 'completionId is required.' })

  const completion = await prisma.stepCompletion.findUnique({ where: { id: completionId } })
  if (!completion) return res.status(404).json({ error: 'Completion not found.' })

  const unit = await prisma.unit.findUnique({ where: { id: completion.unitId } })
  if (!unit) return res.status(404).json({ error: 'Unit not found.' })
  if (req.user.role !== 'ADMIN' && unit.assignedTechId !== req.user.userId) {
    return res.status(403).json({ error: 'Not your assigned unit.' })
  }

  const completedAt = new Date()
  const startedAt = completion.startedAt ? new Date(completion.startedAt) : completedAt
  const elapsedSeconds = Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000)

  const updated = await prisma.stepCompletion.update({
    where: { id: completionId },
    data: {
      status,
      notes: notes ?? completion.notes,
      completedAt,
      elapsedSeconds,
    },
  })
  return res.json({ completion: updated })
})

router.patch('/:id', async (req, res) => {
  const current = await prisma.stepCompletion.findUnique({ where: { id: req.params.id } })
  if (!current) return res.status(404).json({ error: 'Completion not found.' })

  const unit = await prisma.unit.findUnique({ where: { id: current.unitId } })
  if (!unit) return res.status(404).json({ error: 'Unit not found.' })
  if (req.user.role !== 'ADMIN' && unit.assignedTechId !== req.user.userId) {
    return res.status(403).json({ error: 'Not your assigned unit.' })
  }

  const { notes, status } = req.body ?? {}
  const completion = await prisma.stepCompletion.update({
    where: { id: req.params.id },
    data: {
      ...(typeof notes === 'string' ? { notes } : {}),
      ...(status ? { status } : {}),
    },
  })
  return res.json({ completion })
})

export default router
