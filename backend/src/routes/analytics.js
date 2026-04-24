import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { auth } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'

const router = Router()
router.use(auth)
router.use(requireRole('ADMIN'))

router.get('/shift', async (_req, res) => {
  const start = new Date()
  start.setHours(0, 0, 0, 0)

  const completedUnits = await prisma.unit.findMany({
    where: { completedAt: { gte: start } },
    include: { completions: true },
  })

  const unitsCompleted = completedUnits.length
  const reworkCount = completedUnits.filter((u) => u.status === 'REWORK').length

  const completedCompletions = completedUnits.flatMap((u) =>
    u.completions.filter((c) => typeof c.elapsedSeconds === 'number'),
  )
  const totalElapsed = completedCompletions.reduce((sum, c) => sum + (c.elapsedSeconds ?? 0), 0)
  const avgCycleTimeSeconds = unitsCompleted ? Math.floor(totalElapsed / unitsCompleted) : 0

  const allDone = await prisma.stepCompletion.count({
    where: { completedAt: { gte: start }, status: { in: ['COMPLETE', 'REWORK', 'BLOCKED'] } },
  })
  const completeOnly = await prisma.stepCompletion.count({
    where: { completedAt: { gte: start }, status: 'COMPLETE' },
  })
  const passRate = allDone ? completeOnly / allDone : 0

  const activeTechs = await prisma.user.count({
    where: {
      role: 'TECHNICIAN',
      isActive: true,
      units: { some: { status: { in: ['IN_PROGRESS', 'BLOCKED', 'REWORK'] } } },
    },
  })

  return res.json({
    unitsCompleted,
    avgCycleTimeSeconds,
    passRate,
    activeTechs,
    reworkCount,
  })
})

router.get('/throughput', async (_req, res) => {
  const now = new Date()
  const start = new Date(now.getTime() - 8 * 60 * 60 * 1000)

  const units = await prisma.unit.findMany({
    where: { completedAt: { gte: start } },
    select: { completedAt: true },
  })

  const buckets = Array.from({ length: 8 }, (_, i) => {
    const bucketStart = new Date(start.getTime() + i * 60 * 60 * 1000)
    return { hour: bucketStart.toISOString(), count: 0 }
  })

  units.forEach((u) => {
    if (!u.completedAt) return
    const idx = Math.floor((u.completedAt.getTime() - start.getTime()) / (60 * 60 * 1000))
    if (idx >= 0 && idx < buckets.length) buckets[idx].count += 1
  })

  return res.json({ throughput: buckets })
})

router.get('/tech', async (_req, res) => {
  const techs = await prisma.user.findMany({
    where: { role: 'TECHNICIAN' },
    select: { id: true, name: true, units: { select: { status: true } } },
  })

  const output = techs.map((t) => ({
    techId: t.id,
    name: t.name,
    activeUnits: t.units.filter((u) => u.status === 'IN_PROGRESS').length,
    completedUnits: t.units.filter((u) => u.status === 'COMPLETE').length,
  }))

  return res.json({ technicians: output })
})

export default router
