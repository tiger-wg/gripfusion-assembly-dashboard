import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { auth } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'

const severityOrder = { ERROR: 0, WARNING: 1, INFO: 2 }

const router = Router()
router.use(auth)

router.get('/', async (req, res) => {
  const { unitId } = req.query
  const where = unitId ? { unitId: String(unitId) } : {}

  if (!unitId && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only admins can list all flags.' })
  }

  const flags = await prisma.flag.findMany({
    where,
    include: { unit: true, raisedBy: true, resolvedBy: true },
    orderBy: { createdAt: 'desc' },
  })

  if (unitId && req.user.role !== 'ADMIN') {
    const unit = await prisma.unit.findUnique({ where: { id: String(unitId) } })
    if (!unit) return res.status(404).json({ error: 'Unit not found.' })
    if (unit.assignedTechId !== req.user.userId) {
      return res.status(403).json({ error: 'Not your assigned unit.' })
    }
  }

  if (!unitId) {
    flags.sort((a, b) => {
      const diff = severityOrder[a.severity] - severityOrder[b.severity]
      if (diff !== 0) return diff
      return b.createdAt.getTime() - a.createdAt.getTime()
    })
  }

  return res.json({ flags })
})

router.post('/', async (req, res) => {
  if (req.user.role !== 'TECHNICIAN') {
    return res.status(403).json({ error: 'Only technicians can raise flags.' })
  }

  const { unitId, stepId, severity, message } = req.body ?? {}
  if (!unitId || !severity || !message) {
    return res.status(400).json({ error: 'unitId, severity, message are required.' })
  }
  if (!['ERROR', 'WARNING', 'INFO'].includes(String(severity))) {
    return res.status(400).json({ error: 'severity must be one of ERROR, WARNING, INFO.' })
  }

  const unit = await prisma.unit.findUnique({ where: { id: unitId } })
  if (!unit) return res.status(404).json({ error: 'Unit not found.' })
  if (unit.assignedTechId !== req.user.userId) {
    return res.status(403).json({ error: 'Not your assigned unit.' })
  }

  const flag = await prisma.flag.create({
    data: { unitId, stepId: stepId ?? null, severity, message, raisedById: req.user.userId },
  })
  return res.status(201).json({ flag })
})

router.patch('/:id/resolve', requireRole('ADMIN'), async (req, res) => {
  const flag = await prisma.flag.update({
    where: { id: req.params.id },
    data: { resolved: true, resolvedAt: new Date(), resolvedById: req.user.userId },
  })
  return res.json({ flag })
})

export default router
