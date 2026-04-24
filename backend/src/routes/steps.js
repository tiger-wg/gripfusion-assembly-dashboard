import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { auth } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'

const router = Router()

router.use(auth)

const normalizeImportRow = (row, index) => {
  const stepNumber = Number(row?.stepNumber)
  const stepId = String(row?.stepId ?? '').trim()
  const stepTitle = String(row?.stepTitle ?? '').trim()
  const stepInstruction = String(row?.stepInstruction ?? '').trim()
  const substepId = String(row?.substepId ?? '').trim()
  const substepTitle = String(row?.substepTitle ?? '').trim()
  const substepOrder = Number(row?.substepOrder)
  const published = row?.published == null ? true : Boolean(row.published)

  const rowErrors = []
  if (!Number.isFinite(stepNumber) || stepNumber <= 0) rowErrors.push('stepNumber must be a positive number')
  if (!stepId) rowErrors.push('stepId is required')
  if (!stepTitle) rowErrors.push('stepTitle is required')
  if (!stepInstruction) rowErrors.push('stepInstruction is required')
  if (!substepId) rowErrors.push('substepId is required')
  if (!substepTitle) rowErrors.push('substepTitle is required')
  if (!Number.isFinite(substepOrder) || substepOrder <= 0) rowErrors.push('substepOrder must be a positive number')

  return {
    index,
    rowErrors,
    value: {
      stepNumber,
      stepId,
      stepTitle,
      stepInstruction,
      substepId,
      substepTitle,
      substepOrder,
      published,
    },
  }
}

router.get('/', async (req, res) => {
  const where = req.user.role === 'ADMIN' ? {} : { isPublished: true }
  const steps = await prisma.assemblyStep.findMany({
    where,
    orderBy: { stepNumber: 'asc' },
  })
  return res.json({ steps })
})

router.get('/:id', async (req, res) => {
  const step = await prisma.assemblyStep.findUnique({ where: { id: req.params.id } })
  if (!step) return res.status(404).json({ error: 'Step not found.' })
  if (req.user.role !== 'ADMIN' && !step.isPublished) {
    return res.status(403).json({ error: 'Step is not published.' })
  }
  return res.json({ step })
})

router.post('/', requireRole('ADMIN'), async (req, res) => {
  const { stepNumber, title, description, subSteps } = req.body ?? {}
  if (!stepNumber || !title || !description || !Array.isArray(subSteps)) {
    return res.status(400).json({ error: 'stepNumber, title, description, subSteps are required.' })
  }

  const step = await prisma.assemblyStep.create({
    data: {
      stepNumber: Number(stepNumber),
      title,
      description,
      subSteps,
      updatedBy: req.user.userId,
    },
  })
  return res.status(201).json({ step })
})

router.post('/import', requireRole('ADMIN'), async (req, res) => {
  const { rows } = req.body ?? {}
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'rows must be a non-empty array.' })
  }

  const normalized = rows.map((row, index) => normalizeImportRow(row, index))
  const errors = normalized
    .filter((entry) => entry.rowErrors.length > 0)
    .map((entry) => ({ row: entry.index + 1, errors: entry.rowErrors }))

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Some rows are invalid.', errors })
  }

  const grouped = new Map()
  for (const entry of normalized) {
    const row = entry.value
    const existing = grouped.get(row.stepNumber)
    if (!existing) {
      grouped.set(row.stepNumber, {
        stepNumber: row.stepNumber,
        stepId: row.stepId,
        stepTitle: row.stepTitle,
        stepInstruction: row.stepInstruction,
        published: row.published,
        subSteps: [{ id: row.substepId, label: row.substepTitle, order: row.substepOrder }],
      })
      continue
    }

    if (existing.stepId !== row.stepId || existing.stepTitle !== row.stepTitle) {
      errors.push({
        row: entry.index + 1,
        errors: ['Conflicting step metadata found for same stepNumber.'],
      })
      continue
    }

    existing.published = existing.published || row.published
    existing.subSteps.push({ id: row.substepId, label: row.substepTitle, order: row.substepOrder })
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Import contains conflicting rows.', errors })
  }

  let created = 0
  let updated = 0

  for (const step of Array.from(grouped.values()).sort((a, b) => a.stepNumber - b.stepNumber)) {
    const subSteps = step.subSteps
      .sort((a, b) => a.order - b.order)
      .filter((sub, index, list) => list.findIndex((item) => item.id === sub.id) === index)

    const existing = await prisma.assemblyStep.findUnique({
      where: { stepNumber: step.stepNumber },
      select: { id: true },
    })

    await prisma.assemblyStep.upsert({
      where: { stepNumber: step.stepNumber },
      create: {
        stepNumber: step.stepNumber,
        title: step.stepTitle,
        description: step.stepInstruction,
        subSteps,
        isPublished: step.published,
        updatedBy: req.user.userId,
      },
      update: {
        title: step.stepTitle,
        description: step.stepInstruction,
        subSteps,
        isPublished: step.published,
        updatedBy: req.user.userId,
      },
    })

    if (existing) updated += 1
    else created += 1
  }

  return res.status(201).json({
    summary: {
      rows: rows.length,
      steps: grouped.size,
      created,
      updated,
      errors: 0,
    },
  })
})

router.patch('/:id', requireRole('ADMIN'), async (req, res) => {
  const { title, description, subSteps } = req.body ?? {}
  const step = await prisma.assemblyStep.update({
    where: { id: req.params.id },
    data: {
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(Array.isArray(subSteps) ? { subSteps } : {}),
      updatedBy: req.user.userId,
    },
  })
  return res.json({ step })
})

router.patch('/:id/publish', requireRole('ADMIN'), async (req, res) => {
  const { isPublished } = req.body ?? {}
  const step = await prisma.assemblyStep.update({
    where: { id: req.params.id },
    data: { isPublished: Boolean(isPublished), updatedBy: req.user.userId },
  })
  return res.json({ step })
})

router.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  await prisma.assemblyStep.delete({ where: { id: req.params.id } })
  return res.status(204).send()
})

export default router
