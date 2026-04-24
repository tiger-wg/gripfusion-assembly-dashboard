import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import authRoutes from './routes/auth.js'
import stepsRoutes from './routes/steps.js'
import unitsRoutes from './routes/units.js'
import completionsRoutes from './routes/completions.js'
import flagsRoutes from './routes/flags.js'
import inventoryRoutes from './routes/inventory.js'
import analyticsRoutes from './routes/analytics.js'

if (!process.env.JWT_SECRET) {
  console.warn('Missing JWT_SECRET in environment. Auth routes will fail until it is configured.')
}

const app = express()
const port = Number(process.env.PORT ?? 4000)

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/auth', authRoutes)
app.use('/api/steps', stepsRoutes)
app.use('/api/units', unitsRoutes)
app.use('/api/completions', completionsRoutes)
app.use('/api/flags', flagsRoutes)
app.use('/api/inventory', inventoryRoutes)
app.use('/api/analytics', analyticsRoutes)

app.use((err, _req, res, _next) => {
  // Keep error output concise for API consumers while logging details server-side.
  console.error(err)
  return res.status(500).json({ error: 'Internal server error.' })
})

app.listen(port, () => {
  console.log(`GripFusion backend listening on http://localhost:${port}`)
})
