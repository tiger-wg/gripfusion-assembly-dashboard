import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { auth } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'

const stockStatus = (quantity, minStock) => {
  if (quantity <= 0) return 'CRITICAL'
  if (quantity <= minStock) return 'LOW'
  return 'OK'
}

const router = Router()
router.use(auth)

router.get('/', async (_req, res) => {
  const items = await prisma.inventoryItem.findMany({ orderBy: { updatedAt: 'desc' } })
  return res.json({
    items: items.map((item) => ({
      ...item,
      stockStatus: stockStatus(item.quantity, item.minStock),
    })),
  })
})

router.post('/', requireRole('ADMIN'), async (req, res) => {
  const { name, code, category, quantity, minStock } = req.body ?? {}
  if (!name || !category || typeof quantity !== 'number') {
    return res.status(400).json({ error: 'name, category, quantity are required.' })
  }

  const item = await prisma.inventoryItem.create({
    data: {
      name,
      code: code ?? null,
      category,
      quantity,
      minStock: minStock ?? 5,
    },
  })
  return res.status(201).json({ item })
})

router.patch('/:id', requireRole('ADMIN'), async (req, res) => {
  const { quantity, minStock, name, code, category } = req.body ?? {}
  const item = await prisma.inventoryItem.update({
    where: { id: req.params.id },
    data: {
      ...(typeof quantity === 'number' ? { quantity } : {}),
      ...(typeof minStock === 'number' ? { minStock } : {}),
      ...(name ? { name } : {}),
      ...(typeof code === 'string' ? { code } : {}),
      ...(category ? { category } : {}),
    },
  })
  return res.json({ item })
})

export default router
