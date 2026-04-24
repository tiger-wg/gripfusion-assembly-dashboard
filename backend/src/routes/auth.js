import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma.js'
import { auth } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'

const router = Router()

router.post('/login', async (req, res) => {
  const { email, username, identifier, password } = req.body ?? {}
  const loginIdentifier = String(email ?? username ?? identifier ?? '').trim().toLowerCase()
  if (!loginIdentifier || !password) {
    return res.status(400).json({ error: 'Username/email and password are required.' })
  }

  let user = await prisma.user.findUnique({ where: { email: loginIdentifier } })
  if (!user && !loginIdentifier.includes('@')) {
    user = await prisma.user.findFirst({
      where: {
        email: {
          startsWith: `${loginIdentifier}@`,
        },
      },
    })
  }

  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'Invalid credentials.' })
  }

  const isValid = await bcrypt.compare(password, user.passwordHash)
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials.' })
  }

  const token = jwt.sign(
    { userId: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '24h' },
  )

  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.email.split('@')[0],
      role: user.role,
      avatarInitials: user.avatarInitials,
    },
  })
})

router.post('/logout', (_req, res) => {
  return res.json({ ok: true })
})

router.get('/me', auth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.userId } })
  if (!user) {
    return res.status(404).json({ error: 'User not found.' })
  }

  return res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.email.split('@')[0],
      role: user.role,
      avatarInitials: user.avatarInitials,
    },
  })
})

router.get('/users', auth, requireRole('ADMIN'), async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      avatarInitials: true,
      createdAt: true,
    },
  })
  return res.json({
    users: users.map((user) => ({
      ...user,
      username: user.email.split('@')[0],
    })),
  })
})

router.post('/users', auth, requireRole('ADMIN'), async (req, res) => {
  const { name, username, email, password, role = 'TECHNICIAN', isActive = true } = req.body ?? {}

  const normalizedName = String(name ?? '').trim()
  const normalizedUsername = String(username ?? '').trim().toLowerCase()
  const normalizedEmail = String(
    email ?? (normalizedUsername ? `${normalizedUsername}@gripfusion.local` : ''),
  )
    .trim()
    .toLowerCase()
  const normalizedPassword = String(password ?? '').trim()
  const normalizedRole = String(role).toUpperCase()

  if (!normalizedName || !normalizedEmail || !normalizedPassword) {
    return res.status(400).json({ error: 'name, username/email, and password are required.' })
  }

  if (!['ADMIN', 'TECHNICIAN'].includes(normalizedRole)) {
    return res.status(400).json({ error: 'role must be ADMIN or TECHNICIAN.' })
  }

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (existing) {
    return res.status(409).json({ error: 'An account with this username/email already exists.' })
  }

  const passwordHash = await bcrypt.hash(normalizedPassword, 10)
  const initials = normalizedName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  const created = await prisma.user.create({
    data: {
      name: normalizedName,
      email: normalizedEmail,
      passwordHash,
      role: normalizedRole,
      isActive: Boolean(isActive),
      avatarInitials: initials || null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      avatarInitials: true,
      createdAt: true,
    },
  })

  return res.status(201).json({
    user: {
      ...created,
      username: created.email.split('@')[0],
    },
  })
})

export default router
