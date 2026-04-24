import jwt from 'jsonwebtoken'

export const auth = (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing bearer token.' })
  }

  const token = authHeader.replace('Bearer ', '')

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = payload
    return next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' })
  }
}
