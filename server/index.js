import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import mongoose from 'mongoose'
import multer from 'multer'
import nodemailer from 'nodemailer'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { List } from './models/List.js'
import { Location } from './models/Location.js'
import { MenuItem } from './models/MenuItem.js'
import { EventSubcategory } from './models/EventSubcategory.js'
import { User } from './models/User.js'
import { Notification } from './models/Notification.js'

const app = express()
const port = Number(process.env.PORT || 4000)
const uploadDirectory = path.resolve('server/uploads')
const clientIndex = path.resolve('dist/index.html')
const jwtSecret = process.env.JWT_SECRET || 'development-secret-change-me'
const appUrl = process.env.APP_URL?.replace(/\/$/, '')
const reminderLeadTimeMs = 24 * 60 * 60 * 1000
const reminderWindowMs = 15 * 60 * 1000
const defaultMenu = [
  { label: 'Directory', href: '#projects', menuType: 'main_menu', order: 0, visible: true },
  { label: 'About', href: '#about', menuType: 'main_menu', order: 1, visible: true },
  { label: 'Contact', href: '#contact', menuType: 'main_menu', order: 2, visible: true },
]
const defaultLocations = [
  { name: 'Fremont', state: 'CA', latitude: 37.5485, longitude: -121.9886, order: 0, is_active: true },
  { name: 'Sunnyvale', state: 'CA', latitude: 37.3688, longitude: -122.0363, order: 1, is_active: true },
  { name: 'San Jose', state: 'CA', latitude: 37.3382, longitude: -121.8863, order: 2, is_active: true },
  { name: 'Newark', state: 'CA', latitude: 37.5297, longitude: -122.0402, order: 3, is_active: true },
  { name: 'Union City', state: 'CA', latitude: 37.5934, longitude: -122.0438, order: 4, is_active: true },
  { name: 'Pleasanton', state: 'CA', latitude: 37.6624, longitude: -121.8747, order: 5, is_active: true },
  { name: 'Mountain View', state: 'CA', latitude: 37.3861, longitude: -122.0839, order: 6, is_active: true },
]
const defaultCommunityTypes = [
  '🍲 Home Food',
  '🎂 Bakers & Desserts',
  '💄 Beauty & Makeup',
  '💍 Jewelry & Fashion',
  '🧵 Tailoring',
  '📚 Tutors & Classes',
  '📸 Photography',
  '🎉 Event Services',
  '🏠 Home Services',
  '🛍️ Local Small Businesses',
]
const defaultEventSubcategories = [
  '👧 Kids Events', '🎵 Music Events', '🎭 Drama & Theater', '🎉 Parties & Celebrations',
  '💍 Weddings & Engagements', '🎂 Birthdays', '🎪 Festivals & Cultural Events',
  '🪔 Religious & Spiritual Events', '💃 Dance Events', '🎤 Live Performances',
  '🎨 Art & Cultural Shows', '🍽️ Food Events', '🏃 Sports Events',
  '🏫 School & Community Events', '💼 Corporate Events', '🤝 Networking Events',
  '🎓 Educational Events', '🛍️ Fairs & Markets', '🎄 Holiday Events',
  '🎆 Seasonal Events', '🎟️ Concerts & Shows', '📸 Photo & Media Events',
  '🥳 Social Gatherings', '🌎 Cultural Community Events', '📅 Other Events',
]
const sampleCommunityLists = [
  ['🍲 Home Food', 'Asha’s South Indian Kitchen', 'Fresh dosa, idli, chutney, and family-style meals prepared to order.'],
  ['🎂 Bakers & Desserts', 'Sweet Crumb Bakery', 'Custom cakes, cupcakes, cookies, and desserts for every celebration.'],
  ['💄 Beauty & Makeup', 'Glow Studio', 'Makeup services and beauty appointments for events and everyday looks.'],
  ['💍 Jewelry & Fashion', 'Maya Style Boutique', 'Curated jewelry, accessories, and contemporary fashion for every occasion.'],
  ['🧵 Tailoring', 'Perfect Stitch Tailoring', 'Alterations, custom tailoring, and traditional outfit fittings.'],
  ['📚 Tutors & Classes', 'Bright Path Learning', 'Friendly tutoring and enrichment classes for students of all ages.'],
  ['📸 Photography', 'Golden Hour Photography', 'Portrait, family, product, and event photography in the Bay Area.'],
  ['🎉 Event Services', 'Celebrate Events', 'Planning, decorations, and coordination for memorable community events.'],
  ['🏠 Home Services', 'Trusted Home Helpers', 'Reliable cleaning, organizing, and everyday home support services.'],
  ['🛍️ Local Small Businesses', 'Neighborhood Market Co.', 'A collection of useful local products and services from small businesses.'],
]
const upload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => callback(null, uploadDirectory),
    filename: (_request, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase()
      callback(null, `${randomUUID()}${extension}`)
    },
  }),
  fileFilter: (_request, file, callback) => callback(null, file.mimetype.startsWith('image/')),
  limits: { files: 10, fileSize: 10 * 1024 * 1024 },
})
const mailer = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  tls: {
    ciphers: 'SSLv3',
    rejectUnauthorized: true // Helps bypass potential local certificate issues
  } })
  : null

const sanitizeMessage = (value) => {
  const source = String(value || '').replace(/<!--[\s\S]*?-->|<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
  return source.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (tag, name, attributes) => {
    const element = name.toLowerCase()
    if (!['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'a'].includes(element)) return ''
    if (element !== 'a') return tag.startsWith('</') ? `</${element}>` : `<${element}>`
    if (tag.startsWith('</')) return '</a>'
    const href = attributes.match(/\bhref\s*=\s*["'](https?:\/\/[^"']+)["']/i)?.[1]
    return href ? `<a href="${href}" target="_blank" rel="noreferrer">` : '<a>'
  })
}

const requireRole = (...roles) => (request, response, next) => {
  if (!request.user || !roles.includes(request.user.role)) return response.status(403).json({ error: 'You do not have permission to perform this action.' })
  next()
}

const messageText = (value) => sanitizeMessage(value).replace(/<[^>]+>/g, '').trim()
const isValidPhone = (value) => {
  const phone = String(value || '').trim()
  const digits = phone.replace(/\D/g, '')
  return /^\+?[0-9\s().-]+$/.test(phone) && digits.length >= 7 && digits.length <= 15
}
const normalizeOptionalUrl = (value, { instagram = false } = {}) => {
  const rawUrl = String(value || '').trim()
  if (!rawUrl) return ''
  const isInstagramHandle = instagram && /^@?[a-z0-9._]+$/i.test(rawUrl)
  const normalizedUrl = isInstagramHandle
    ? `https://www.instagram.com/${rawUrl.replace(/^@/, '')}`
    : /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`
  try {
    const url = new URL(normalizedUrl)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
const validateListContactFields = (body) => {
  const phone = String(body.phone || '').trim()
  const url = normalizeOptionalUrl(body.url)
  const instagram = normalizeOptionalUrl(body.instagram, { instagram: true })
  const message = sanitizeMessage(body.message)

  if (!isValidPhone(phone)) return { error: 'Enter a valid phone number containing 7 to 15 digits.' }
  if (url === null) return { error: 'Enter a valid website URL.' }
  if (instagram === null) return { error: 'Enter a valid Instagram URL or handle.' }
  if (!messageText(message)) return { error: 'Add a description for this list.' }

  return { value: { phone, url, instagram, message } }
}
const parseDateRange = (body) => {
  const startDate = typeof body.startDate === 'string' && body.startDate ? new Date(body.startDate) : null
  const endDate = typeof body.endDate === 'string' && body.endDate ? new Date(body.endDate) : null
  if ((startDate && Number.isNaN(startDate.getTime())) || (endDate && Number.isNaN(endDate.getTime()))) return null
  if (startDate && endDate && startDate > endDate) return null
  return { startDate: startDate || undefined, endDate: endDate || undefined }
}
const isUpcomingDateRange = ({ startDate, endDate }) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return startDate && endDate && startDate >= today && endDate >= today
}
const isEventType = (body) => {
  const type = body.itemType === 'other' ? body.otherItemType : body.itemType
  return /\bevents?\b/i.test(String(type || ''))
}
const formatEventStart = (startDate) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'full',
  timeStyle: 'short',
}).format(startDate)
const isDuplicateKeyError = (error) => error?.code === 11000
let eventReminderRunInProgress = false

const createEventReminder = async (user, event) => {
  const startDate = new Date(event.startDate)
  const eventUrl = `${appUrl.replace(/\/$/, '')}/lists/${event._id}`
  const message = `Reminder: ${event.itemName} starts in about 24 hours.`
  try {
    await Notification.create({
      userId: user._id,
      listId: event._id,
      kind: 'event_reminder',
      eventName: event.itemName,
      eventStartDate: startDate,
      message,
    })
  } catch (error) {
    if (isDuplicateKeyError(error)) return
    throw error
  }

  if (!mailer || !process.env.SMTP_FROM) return
  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM,
      to: user.email,
      subject: `Event reminder: ${event.itemName}`,
      text: [
        `Your event reminder for ${event.itemName}`,
        '',
        `Starts: ${formatEventStart(startDate)}`,
        '',
        message,
        `View event: ${eventUrl}`,
      ].join('\n'),
    })
  } catch (error) {
    console.error(`Event reminder email failed for user ${user._id}, event ${event._id}: ${error.message}`)
  }
}

const runEventReminders = async () => {
  if (eventReminderRunInProgress) return
  eventReminderRunInProgress = true
  try {
    const targetTime = Date.now() + reminderLeadTimeMs
    const events = await List.find({
      user_is_active: { $ne: false },
      admin_is_active: { $ne: false },
      startDate: {
        $gte: new Date(targetTime - reminderWindowMs),
        $lte: new Date(targetTime + reminderWindowMs),
      },
      $or: [
        { itemType: { $regex: /\bevents?\b/i } },
        { otherItemType: { $regex: /\bevents?\b/i } },
      ],
    }).select('_id itemName startDate').lean()
    if (!events.length) return

    const users = await User.find({ eventReminders: true }).select('_id email').lean()
    for (const event of events) {
      for (const user of users) {
        try {
          await createEventReminder(user, event)
        } catch (error) {
          console.error(`Event reminder notification failed for user ${user._id}, event ${event._id}: ${error.message}`)
        }
      }
    }
  } catch (error) {
    console.error(`Event reminder scheduler failed: ${error.message}`)
  } finally {
    eventReminderRunInProgress = false
  }
}
const resolveListItemType = async (body) => {
  if (body.itemType === 'other') {
    const menuItem = await addSubmittedTypeToMenu(body.otherItemType)
    return { itemType: menuItem.label, itemTypeId: menuItem._id }
  }

  if (!body.itemTypeId) return null
  const menuItem = await MenuItem.findOne({
    _id: body.itemTypeId,
    menuType: 'left_menu',
    is_active: true,
  }).select('_id label').lean()
  if (!menuItem || body.itemType !== menuItem.label) return null
  return { itemType: menuItem.label, itemTypeId: menuItem._id }
}
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const normalizeCityName = (value) => String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim()
const resolveListCity = async (body) => {
  const isOtherCity = body.location === '__other__'
  const name = normalizeCityName(isOtherCity ? body.otherCity : body.location)
  if (!name || name.length > 100) return { error: 'Enter a city name up to 100 characters.' }

  const existing = await Location.findOne({ name: { $regex: `^${escapeRegExp(name)}$`, $options: 'i' } })
  if (existing) {
    if (!existing.is_active) {
      existing.is_active = true
      await existing.save()
    }
    return { value: existing.name }
  }
  if (!isOtherCity) return { error: 'Please select a valid city.' }

  const lastLocation = await Location.findOne().sort({ order: -1 }).select('order').lean()
  try {
    const location = await Location.create({
      name,
      order: (lastLocation?.order ?? -1) + 1,
      is_active: true,
    })
    return { value: location.name }
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error
    const duplicate = await Location.findOne({ name: { $regex: `^${escapeRegExp(name)}$`, $options: 'i' } })
    if (!duplicate) throw error
    if (!duplicate.is_active) {
      duplicate.is_active = true
      await duplicate.save()
    }
    return { value: duplicate.name }
  }
}

app.use(cors())
app.use(express.json())
app.use('/uploads', express.static(uploadDirectory))

const authenticate = async (request, response, next) => {
  const token = request.headers.authorization?.replace('Bearer ', '')
  if (!token) return response.status(401).json({ error: 'Login required.' })
  try {
    const payload = jwt.verify(token, jwtSecret)
    request.user = await User.findById(payload.userId)
    if (!request.user) return response.status(401).json({ error: 'User not found.' })
    next()
  } catch {
    response.status(401).json({ error: 'Invalid or expired login.' })
  }
}

app.post('/api/auth/register', async (request, response, next) => {
  try {
    const name = typeof request.body.name === 'string' ? request.body.name.trim() : ''
    const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : ''
    const phone = typeof request.body.phone === 'string' ? request.body.phone.trim() : ''
    const password = typeof request.body.password === 'string' ? request.body.password : ''
    if (!name || !isValidEmail(email) || !isValidPhone(phone) || password.length < 6) {
      return response.status(400).json({ error: 'Name, email, phone, and a password of at least 6 characters are required.' })
    }
    if (await User.exists({ email })) return response.status(409).json({ error: 'An account with this email already exists.' })
    const user = await User.create({ name, email, phone, username: email, role: 'enduser', passwordHash: await bcrypt.hash(password, 12) })
    response.status(201).json({ token: jwt.sign({ userId: user._id.toString() }, jwtSecret, { expiresIn: '7d' }), name, email, role: user.role })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/login', async (request, response, next) => {
  try {
    const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : ''
    const password = typeof request.body.password === 'string' ? request.body.password : ''
    const user = await User.findOne({ email })
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return response.status(401).json({ error: 'Invalid email or password.' })
    }
    response.json({ token: jwt.sign({ userId: user._id.toString() }, jwtSecret, { expiresIn: '7d' }), name: user.name, email: user.email, role: user.role })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/forgot-password', async (request, response, next) => {
  try {
    const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : ''
    const genericResponse = { message: 'If an account exists for that email, a password reset link has been sent.' }
    if (!isValidEmail(email)) return response.json(genericResponse)

    const user = await User.findOne({ email }).select('+resetTokenHash +resetTokenExpires')
    if (!user) return response.json(genericResponse)

    const token = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    user.resetTokenHash = tokenHash
    user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000)
    await user.save()

    if (!mailer) return response.status(503).json({ error: 'Password reset email is not configured.' })
    const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`
    await mailer.sendMail({
      from: process.env.SMTP_FROM,
      to: user.email,
      subject: 'Reset your Beyond The Searches password',
      text: `Use this link to reset your password: ${resetUrl}\n\nThis link expires in one hour.`,
    })
    response.json(genericResponse)
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/reset-password', async (request, response, next) => {
  try {
    const token = typeof request.body.token === 'string' ? request.body.token.trim() : ''
    const password = typeof request.body.password === 'string' ? request.body.password : ''
    if (!token || password.length < 6) {
      return response.status(400).json({ error: 'A valid reset token and password of at least 6 characters are required.' })
    }
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const user = await User.findOne({
      resetTokenHash: tokenHash,
      resetTokenExpires: { $gt: new Date() },
    }).select('+resetTokenHash +resetTokenExpires')
    if (!user) return response.status(400).json({ error: 'This reset link is invalid or expired.' })

    user.passwordHash = await bcrypt.hash(password, 12)
    user.resetTokenHash = undefined
    user.resetTokenExpires = undefined
    await user.save()
    response.json({ message: 'Your password has been reset. You can now log in.' })
  } catch (error) {
    next(error)
  }
})

app.get('/api/me', authenticate, async (request, response, next) => {
  try {
    response.json({
      name: request.user.name,
      email: request.user.email,
      phone: request.user.phone,
      role: request.user.role,
      eventReminders: request.user.eventReminders === true,
    })
  } catch (error) {
    next(error)
  }
})

app.patch('/api/me', authenticate, async (request, response, next) => {
  try {
    const updates = {
      name: typeof request.body.name === 'string' ? request.body.name.trim() : request.user.name,
      email: typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : request.user.email,
      phone: typeof request.body.phone === 'string' ? request.body.phone.trim() : request.user.phone,
    }
    if (!updates.name || !isValidEmail(updates.email) || !isValidPhone(updates.phone)) return response.status(400).json({ error: 'Name, a valid email, and a valid phone number are required.' })
    if (request.body.eventReminders !== undefined && typeof request.body.eventReminders !== 'boolean') {
      return response.status(400).json({ error: 'Event reminder preference must be true or false.' })
    }
    if (typeof request.body.eventReminders === 'boolean') updates.eventReminders = request.body.eventReminders
    const duplicate = await User.findOne({ email: updates.email, _id: { $ne: request.user._id } })
    if (duplicate) return response.status(409).json({ error: 'That email is already in use.' })
    const user = await User.findByIdAndUpdate(request.user._id, updates, { new: true, runValidators: true }).select('name email phone role eventReminders')
    response.json(user)
  } catch (error) {
    next(error)
  }
})

app.get('/api/notifications', authenticate, async (request, response, next) => {
  try {
    const notifications = await Notification.find({ userId: request.user._id })
      .sort({ createdAt: -1 })
      .select('listId kind eventName eventStartDate message read createdAt updatedAt')
      .lean()
    response.json(notifications)
  } catch (error) {
    next(error)
  }
})

app.patch('/api/notifications/:id/read', authenticate, async (request, response, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: request.params.id, userId: request.user._id },
      { $set: { read: true } },
      { new: true, runValidators: true },
    ).select('listId kind eventName eventStartDate message read createdAt updatedAt')
    if (!notification) return response.status(404).json({ error: 'Notification not found.' })
    response.json(notification)
  } catch (error) {
    next(error)
  }
})

const validateMenuItem = (body) => {
  const label = typeof body.label === 'string' ? body.label.trim() : ''
  const href = typeof body.href === 'string' ? body.href.trim() : ''
  const menuType = body.menuType
  const order = Number(body.order)

  if (!label || !href || !['left_menu', 'main_menu'].includes(menuType) || !Number.isInteger(order) || order < 0) {
    return { error: 'Label, href, menu type, and a non-negative integer order are required.' }
  }

  return { value: { label, href, menuType, order, visible: body.visible !== false, is_active: body.is_active !== false } }
}

const addSubmittedTypeToMenu = async (label) => {
  const normalizedLabel = label.trim()
  const existing = await MenuItem.findOne({
    menuType: 'left_menu',
    label: { $regex: `^${normalizedLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
  })
  if (existing) return existing

  const lastItem = await MenuItem.findOne({ menuType: 'left_menu' }).sort({ order: -1 }).select('order').lean()
  return MenuItem.create({
    label: normalizedLabel,
    href: `#${normalizedLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    menuType: 'left_menu',
    order: (lastItem?.order ?? -1) + 1,
    visible: true,
    is_active: true,
  })
}
const normalizeItemTypeLabel = (label) => String(label)
  .normalize('NFKC')
  .replace(/[^\p{L}\p{N}\s]/gu, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' })
})

app.post('/api/contact', async (request, response, next) => {
  try {
    const name = typeof request.body.name === 'string' ? request.body.name.trim() : ''
    const mobile = typeof request.body.mobile === 'string' ? request.body.mobile.trim() : ''
    const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : ''
    const message = typeof request.body.message === 'string' ? request.body.message.trim() : ''
    if (!name || !isValidPhone(mobile) || !isValidEmail(email) || !message) {
      return response.status(400).json({ error: 'Please provide a valid name, mobile number, email, and message.' })
    }
    if (!mailer) return response.status(503).json({ error: 'Contact email is not configured.' })
    await mailer.sendMail({
      from: process.env.SMTP_FROM,
      to: 'amir.vasan@gmail.com',
      replyTo: email,
      subject: `New contact message from ${name}`,
      text: [`Name: ${name}`, `Mobile: ${mobile}`, `Email: ${email}`, '', message].join('\n'),
    })
    response.json({ message: 'Thanks for reaching out. Your message has been sent.' })
  } catch (error) {
    next(error)
  }
})

app.get('/api/menu', async (request, response, next) => {
  try {
    const filter = { is_active: true }
    if (request.query.includeInactive === 'true') {
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) return response.status(401).json({ error: 'Login required.' })
      try {
        const payload = jwt.verify(token, jwtSecret)
        const user = await User.findById(payload.userId)
        if (!user || user.role !== 'admin') return response.status(403).json({ error: 'Admin access required.' })
      } catch {
        return response.status(401).json({ error: 'Invalid or expired login.' })
      }
      delete filter.is_active
    }
    if (request.query.active === 'true') filter.visible = true
    if (['left_menu', 'main_menu'].includes(request.query.menuType)) filter.menuType = request.query.menuType
    const items = await MenuItem.find(filter).sort({ order: 1, createdAt: 1 }).lean()
    response.json(items)
  } catch (error) {
    next(error)
  }
})

app.get('/api/locations', async (_request, response, next) => {
  try {
    response.json(await Location.find({ is_active: true }).sort({ order: 1, name: 1 }).select('name').lean())
  } catch (error) {
    next(error)
  }
})

app.get('/api/event-subcategories', async (_request, response, next) => {
  try {
    response.json(await EventSubcategory.find({ is_active: true }).sort({ order: 1 }).select('label order').lean())
  } catch (error) {
    next(error)
  }
})

app.get('/api/locations/nearby', async (request, response, next) => {
  try {
    const zip = String(request.query.zip || '').trim()
    if (!/^\d{5}$/.test(zip)) return response.status(400).json({ error: 'Please enter a valid 5-digit ZIP code.' })

    const lookup = await fetch(`https://api.zippopotam.us/us/${zip}`)
    if (!lookup.ok) return response.status(404).json({ error: 'We could not find that ZIP code.' })
    const data = await lookup.json()
    const place = data.places?.[0]
    const latitude = Number(place?.latitude)
    const longitude = Number(place?.longitude)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return response.status(404).json({ error: 'We could not find that ZIP code.' })
    }

    const locations = await Location.find({ is_active: true }).lean()
    const toRadians = (value) => value * Math.PI / 180
    const distance = (location) => {
      const latDelta = toRadians(location.latitude - latitude)
      const lonDelta = toRadians(location.longitude - longitude)
      const originLat = toRadians(latitude)
      const locationLat = toRadians(location.latitude)
      const a = Math.sin(latDelta / 2) ** 2 + Math.cos(originLat) * Math.cos(locationLat) * Math.sin(lonDelta / 2) ** 2
      return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }
    response.json(locations
      .filter((location) => Number.isFinite(location.latitude) && Number.isFinite(location.longitude))
      .sort((first, second) => distance(first) - distance(second))
      .slice(0, 5))
  } catch (error) {
    next(error)
  }
})

app.post('/api/menu', authenticate, requireRole('admin'), async (request, response, next) => {
  try {
    const result = validateMenuItem(request.body)
    if (result.error) return response.status(400).json({ error: result.error })

    const item = await MenuItem.create(result.value)
    response.status(201).json(item)
  } catch (error) {
    next(error)
  }
})

app.post('/api/lists', authenticate, upload.array('photos', 10), async (request, response, next) => {
  try {
    const requiredFields = ['itemName', 'itemType', 'phone', 'message', 'location']
    const missingFields = requiredFields.filter((field) => typeof request.body[field] !== 'string' || !request.body[field].trim())
    if (missingFields.length > 0) return response.status(400).json({ error: `Required fields missing: ${missingFields.join(', ')}.` })
    const contactFields = validateListContactFields(request.body)
    if (contactFields.error) return response.status(400).json({ error: contactFields.error })
    Object.assign(request.body, contactFields.value)
    if (request.body.itemType === 'other' && !request.body.otherItemType?.trim()) {
      return response.status(400).json({ error: 'Other item type is required when item type is Other.' })
    }
    const listItemType = await resolveListItemType(request.body)
    if (!listItemType) return response.status(400).json({ error: 'Please select a valid item type.' })
    if (isEventType(request.body) && !request.body.eventSubcategory?.trim()) {
      return response.status(400).json({ error: 'Please select an event subcategory.' })
    }
    const city = await resolveListCity(request.body)
    if (city.error) return response.status(400).json({ error: city.error })
    const dateRange = isEventType(request.body) ? parseDateRange(request.body) : {}
    if (isEventType(request.body) && (!dateRange || !isUpcomingDateRange(dateRange))) {
      return response.status(400).json({ error: 'Events require future start and end dates.' })
    }
    const list = await List.create({
      ...request.body,
      userId: request.user._id,
      itemType: listItemType.itemType,
      itemTypeId: listItemType.itemTypeId,
      otherItemType: undefined,
      name: request.user.name,
      user_is_active: true,
      admin_is_active: false,
      is_Premium: request.body.is_Premium === 'true',
      ...dateRange,
      eventSubcategory: isEventType(request.body) ? request.body.eventSubcategory.trim() : undefined,
      address: request.body.address?.trim() || undefined,
      location: city.value,
      url: request.body.url?.trim() || undefined,
      instagram: request.body.instagram?.trim() || undefined,
      message: sanitizeMessage(request.body.message),
      photos: (request.files || []).map((file) => ({
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        filename: file.filename,
        url: `/uploads/${file.filename}`,
      })),
    })
    if (request.user.role === 'enduser') {
      request.user.role = 'list_owner'
      await request.user.save()
    }
    let emailSent = false
    if (mailer && process.env.ADMIN_EMAIL && process.env.SMTP_FROM) {
      await mailer.sendMail({
        from: process.env.SMTP_FROM,
        to: process.env.ADMIN_EMAIL,
        subject: `New list submission: ${list.itemName}`,
        text: [
          `Name: ${list.name}`,
          `Item: ${list.itemName}`,
          `Type: ${list.itemType === 'other' ? list.otherItemType : list.itemType}`,
          `Dates: ${list.startDate ? list.startDate.toISOString().slice(0, 10) : 'Not provided'} to ${list.endDate ? list.endDate.toISOString().slice(0, 10) : 'Not provided'}`,
          `Location: ${list.location || 'Not provided'}`,
          `Phone: ${list.phone}`,
          '',
          list.message,
          '',
          `Photos uploaded: ${list.photos.length}`,
        ].join('\n'),
      })
      emailSent = true
    }
    response.status(201).json({ id: list._id, emailSent, message: 'Your listing is under admin approval.' })
  } catch (error) {
    next(error)
  }
})

app.get('/api/lists', async (_request, response, next) => {
  try {
    if (_request.query.includeInactive === 'true') {
      const token = _request.headers.authorization?.replace('Bearer ', '')
      if (!token) return response.status(401).json({ error: 'Login required.' })
      try {
        const payload = jwt.verify(token, jwtSecret)
        const user = await User.findById(payload.userId)
        if (!user || user.role !== 'admin') return response.status(403).json({ error: 'Admin access required.' })
      } catch {
        return response.status(401).json({ error: 'Invalid or expired login.' })
      }
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const filter = _request.query.includeInactive === 'true'
      ? {}
      : {
          user_is_active: true,
          admin_is_active: true,
          $or: [
            { itemType: { $not: /^events$/i } },
            { itemType: 'other', otherItemType: { $not: /^events$/i } },
            { endDate: { $gte: today } },
            { endDate: { $exists: false } },
            { endDate: null },
          ],
        }
    const isPaginated = _request.query.page !== undefined || _request.query.limit !== undefined
    if (!isPaginated) {
      const lists = await List.find(filter).populate('userId', 'username').sort({ createdAt: -1 }).lean()
      return response.json(lists)
    }

    const page = Math.max(1, Number.parseInt(_request.query.page, 10) || 1)
    const limit = Math.min(50, Math.max(1, Number.parseInt(_request.query.limit, 10) || 10))
    const search = String(_request.query.search || '').trim()
    const itemType = String(_request.query.itemType || '').trim()
    const eventSubcategory = String(_request.query.eventSubcategory || '').trim()
    const location = String(_request.query.location || '').trim()
    const date = String(_request.query.date || '').trim()
    const interests = String(_request.query.interests || '').split(',').map((value) => value.trim()).filter(Boolean)
    const preferredLocations = String(_request.query.locations || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean)
    const query = { ...filter }
    if (search) {
      const searchPattern = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      query.$and = [{ $or: [{ itemName: searchPattern }, { itemType: searchPattern }, { otherItemType: searchPattern }, { eventSubcategory: searchPattern }, { address: searchPattern }, { location: searchPattern }, { message: searchPattern }, { name: searchPattern }] }]
    }
    if (itemType) {
      const itemTypePattern = itemType.replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      query.$and = [...(query.$and || []), {
        $or: [
          { itemType: { $regex: itemTypePattern, $options: 'i' } },
          { itemType: 'other', otherItemType: { $regex: itemTypePattern, $options: 'i' } },
        ],
      }]
    }
    if (eventSubcategory) {
      query.$and = [...(query.$and || []), {
        eventSubcategory: {
          $regex: eventSubcategory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          $options: 'i',
        },
      }]
    }
    if (location) query.location = { $regex: location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
    if (preferredLocations.length) {
      query.$and = [...(query.$and || []), {
        $or: preferredLocations.map((preferredLocation) => ({
          location: {
            $regex: `^${preferredLocation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
            $options: 'i',
          },
        })),
      }]
    }
    if (date) {
      const selectedDate = new Date(`${date}T00:00:00.000Z`)
      if (!Number.isNaN(selectedDate.getTime())) {
        query.$and = [...(query.$and || []), { startDate: { $lte: selectedDate } }, { endDate: { $gte: selectedDate } }]
      }
    }

    const normalizedInterests = interests.map((interest) => interest.toLowerCase())
    const aggregation = [
      { $match: query },
      {
        $set: {
          rankingType: {
            $toLower: {
              $ifNull: [
                { $cond: [{ $eq: ['$itemType', 'other'] }, '$otherItemType', '$itemType'] },
                '',
              ],
            },
          },
          rankingLocation: { $toLower: { $ifNull: ['$location', ''] } },
        },
      },
      {
        $set: {
          interestMatch: normalizedInterests.length
            ? { $cond: [{ $in: ['$rankingType', normalizedInterests] }, 1, 0] }
            : 0,
          locationMatch: preferredLocations.length
            ? { $cond: [{ $in: ['$rankingLocation', preferredLocations] }, 1, 0] }
            : 0,
        },
      },
      { $sort: { locationMatch: -1, interestMatch: -1, is_Premium: -1, updatedAt: -1, views: -1, _id: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          let: { ownerId: '$userId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$ownerId'] } } },
            { $project: { _id: 1, username: 1 } },
          ],
          as: 'owner',
        },
      },
      {
        $set: {
          userId: { $arrayElemAt: ['$owner', 0] },
        },
      },
      { $unset: ['owner', 'rankingType', 'rankingLocation', 'interestMatch', 'locationMatch'] },
    ]
    const [total, itemTypes, lists] = await Promise.all([
      List.countDocuments(query),
      List.distinct('itemType', filter),
      List.aggregate(aggregation),
    ])
    const customTypes = await List.distinct('otherItemType', { ...filter, itemType: 'other', otherItemType: { $exists: true, $ne: '' } })
    const eventSubcategories = await EventSubcategory.find({ is_active: true }).sort({ order: 1 }).select('label -_id').lean()
    const allItemTypes = [...new Map(
      [...itemTypes.filter((value) => value !== 'other'), ...customTypes]
        .map((value) => [String(value).replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim().toLowerCase(), value]),
    ).values()].sort()
    response.json({
      items: lists,
      total,
      page,
      limit,
      pageCount: Math.max(1, Math.ceil(total / limit)),
      itemTypes: allItemTypes,
      eventSubcategories: eventSubcategories.map((item) => item.label),
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/lists/:id/view', async (request, response, next) => {
  try {
    const updated = await List.findByIdAndUpdate(
      request.params.id,
      { $inc: { views: 1 } },
      { new: true, projection: { views: 1 } },
    ).lean()
    if (!updated) return response.status(404).json({ error: 'List not found.' })
    response.json({ views: updated?.views || 0 })
  } catch (error) {
    next(error)
  }
})

app.post('/api/lists/:id/like', async (request, response, next) => {
  try {
    const updated = await List.findByIdAndUpdate(
      request.params.id,
      { $inc: { likes: 1 } },
      { new: true, projection: { likes: 1 } },
    ).lean()
    if (!updated) return response.status(404).json({ error: 'List not found.' })
    response.json({ likes: updated.likes || 0 })
  } catch (error) {
    next(error)
  }
})

app.get('/api/my-lists', authenticate, async (request, response, next) => {
  try {
    response.json(await List.find({ userId: request.user._id }).populate('userId', 'username').sort({ createdAt: -1 }).lean())
  } catch (error) {
    next(error)
  }
})

app.patch('/api/my-lists/:id', authenticate, upload.array('photos', 10), async (request, response, next) => {
  try {
    const requiredFields = ['name', 'itemName', 'itemType', 'phone', 'message', 'location']
    const missingFields = requiredFields.filter((field) => typeof request.body[field] !== 'string' || !request.body[field].trim())
    if (missingFields.length > 0) return response.status(400).json({ error: `Required fields missing: ${missingFields.join(', ')}.` })
    const contactFields = validateListContactFields(request.body)
    if (contactFields.error) return response.status(400).json({ error: contactFields.error })
    Object.assign(request.body, contactFields.value)
    if (request.body.itemType.trim() === 'other' && !request.body.otherItemType?.trim()) {
      return response.status(400).json({ error: 'Other item type is required when item type is Other.' })
    }
    const listItemType = await resolveListItemType(request.body)
    if (!listItemType) return response.status(400).json({ error: 'Please select a valid item type.' })
    if (isEventType(request.body) && !request.body.eventSubcategory?.trim()) {
      return response.status(400).json({ error: 'Please select an event subcategory.' })
    }
    if (!(await Location.exists({ name: request.body.location.trim(), is_active: true }))) {
      return response.status(400).json({ error: 'Please select a valid location.' })
    }
    const dateRange = isEventType(request.body) ? parseDateRange(request.body) : {}
    if (isEventType(request.body) && (!dateRange || !isUpcomingDateRange(dateRange))) {
      return response.status(400).json({ error: 'Events require future start and end dates.' })
    }
    const removePhotos = request.body.removePhotos ? JSON.parse(request.body.removePhotos) : []
    const removedPhotoNames = new Set(Array.isArray(removePhotos) ? removePhotos : [])
    const list = await List.findOneAndUpdate(
      { _id: request.params.id, userId: request.user._id },
      { $set: {
        name: request.body.name.trim(),
        itemName: request.body.itemName?.trim(),
        itemType: listItemType.itemType,
        itemTypeId: listItemType.itemTypeId,
        otherItemType: undefined,
        eventSubcategory: isEventType(request.body) ? request.body.eventSubcategory.trim() : undefined,
        ...dateRange,
        address: request.body.address?.trim() || undefined,
        location: request.body.location?.trim() || undefined,
        phone: request.body.phone?.trim(),
        url: request.body.url?.trim() || undefined,
        instagram: request.body.instagram?.trim() || undefined,
        message: sanitizeMessage(request.body.message),
        user_is_active: request.body.user_is_active !== false,
        photos: [
          ...(await List.findOne({ _id: request.params.id, userId: request.user._id }).select('photos').lean()).photos
            .filter((photo) => !removedPhotoNames.has(photo.filename)),
          ...(request.files || []).map((file) => ({
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            filename: file.filename,
            url: `/uploads/${file.filename}`,
          })),
        ],
      } },
      { new: true, runValidators: true },
    )
    if (!list) return response.status(404).json({ error: 'List not found.' })
    response.json(list)
  } catch (error) {
    next(error)
  }
})

app.delete('/api/my-lists/:id', authenticate, async (request, response, next) => {
  try {
    const list = await List.findOneAndDelete({ _id: request.params.id, userId: request.user._id })
    if (!list) return response.status(404).json({ error: 'List not found.' })
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})

app.patch('/api/lists/:id', authenticate, requireRole('admin'), async (request, response, next) => {
  try {
    const requiredFields = ['name', 'itemName', 'itemType', 'phone', 'message', 'location']
    const missingFields = requiredFields.filter((field) => typeof request.body[field] !== 'string' || !request.body[field].trim())
    if (missingFields.length > 0) return response.status(400).json({ error: `Required fields missing: ${missingFields.join(', ')}.` })
    const contactFields = validateListContactFields(request.body)
    if (contactFields.error) return response.status(400).json({ error: contactFields.error })
    Object.assign(request.body, contactFields.value)
    if (request.body.itemType === 'other' && !request.body.otherItemType?.trim()) {
      return response.status(400).json({ error: 'Other item type is required when item type is Other.' })
    }
    const listItemType = await resolveListItemType(request.body)
    if (!listItemType) return response.status(400).json({ error: 'Please select a valid item type.' })
    if (isEventType(request.body) && !request.body.eventSubcategory?.trim()) {
      return response.status(400).json({ error: 'Please select an event subcategory.' })
    }
    if (!(await Location.exists({ name: request.body.location.trim(), is_active: true }))) {
      return response.status(400).json({ error: 'Please select a valid location.' })
    }
    const dateRange = isEventType(request.body) ? parseDateRange(request.body) : {}
    if (isEventType(request.body) && (!dateRange || !isUpcomingDateRange(dateRange))) {
      return response.status(400).json({ error: 'Events require future start and end dates.' })
    }

    const list = await List.findByIdAndUpdate(
      request.params.id,
      {
        name: request.body.name.trim(),
        itemName: request.body.itemName.trim(),
        itemType: listItemType.itemType,
        itemTypeId: listItemType.itemTypeId,
        otherItemType: undefined,
        eventSubcategory: isEventType(request.body) ? request.body.eventSubcategory.trim() : undefined,
        is_Premium: request.body.is_Premium === true,
        admin_is_active: request.body.admin_is_active !== false,
        ...dateRange,
        address: request.body.address?.trim() || undefined,
        location: request.body.location?.trim() || undefined,
        phone: request.body.phone.trim(),
        url: request.body.url?.trim() || undefined,
        instagram: request.body.instagram?.trim() || undefined,
        message: sanitizeMessage(request.body.message),
      },
      { new: true, runValidators: true },
    )
    if (!list) return response.status(404).json({ error: 'List not found.' })

    response.json(list)
  } catch (error) {
    next(error)
  }
})

app.delete('/api/lists/:id', authenticate, requireRole('admin'), async (request, response, next) => {
  try {
    const list = await List.findByIdAndDelete(request.params.id)
    if (!list) return response.status(404).json({ error: 'List not found.' })

    response.status(204).end()
  } catch (error) {
    next(error)
  }
})

app.patch('/api/menu/:id', authenticate, requireRole('admin'), async (request, response, next) => {
  try {
    const result = validateMenuItem(request.body)
    if (result.error) return response.status(400).json({ error: result.error })

    const item = await MenuItem.findByIdAndUpdate(request.params.id, result.value, {
      new: true,
      runValidators: true,
    })
    if (!item) return response.status(404).json({ error: 'Menu item not found.' })

    response.json(item)
  } catch (error) {
    next(error)
  }
})

app.delete('/api/menu/:id', authenticate, requireRole('admin'), async (request, response, next) => {
  try {
    const item = await MenuItem.findByIdAndDelete(request.params.id)
    if (!item) return response.status(404).json({ error: 'Menu item not found.' })

    response.status(204).end()
  } catch (error) {
    next(error)
  }
})

if (existsSync(clientIndex)) {
  app.use(express.static(path.dirname(clientIndex)))
  app.get('{*path}', (request, response, next) => {
    if (request.path === '/api' || request.path.startsWith('/api/') || request.path === '/uploads' || request.path.startsWith('/uploads/')) {
      return next()
    }
    response.sendFile(clientIndex)
  })
}

app.use((error, _request, response, _next) => {
  console.error(error)
  if (error instanceof multer.MulterError) {
    return response.status(400).json({ error: `Upload failed: ${error.message}` })
  }
  if (error.name === 'ValidationError') {
    const details = Object.values(error.errors || {}).map((item) => item.message).join(' ')
    return response.status(400).json({ error: details || 'Please check the submitted list details.' })
  }
  response.status(500).json({ error: 'Unable to complete the request.' })
})

const start = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required. Copy .env.example to .env and configure MongoDB.')
  }
  if (mailer && !appUrl) {
    throw new Error('APP_URL is required when SMTP is configured.')
  }

  await mongoose.connect(process.env.MONGODB_URI)
  await mkdir(uploadDirectory, { recursive: true })
  await Notification.init()
  await List.updateMany(
    { user_is_active: { $exists: false } },
    [{ $set: { user_is_active: { $ifNull: ['$is_active', true] } } }],
  )
  await List.updateMany(
    { admin_is_active: { $exists: false } },
    [{ $set: { admin_is_active: { $ifNull: ['$is_active', true] } } }],
  )
  await List.updateMany(
    { is_Premium: { $exists: false } },
    [{ $set: { is_Premium: { $ifNull: ['$isPremium', false] } } }, { $unset: 'isPremium' }],
  )
  await List.updateMany({ views: { $exists: false } }, { $set: { views: 0 } })
  await List.updateMany({ likes: { $exists: false } }, { $set: { likes: 0 } })
  await List.updateMany(
    {
      eventSubcategory: { $exists: false },
      $or: [
        { itemType: { $regex: /events?/i } },
        { itemType: 'other', otherItemType: { $regex: /events?/i } },
      ],
    },
    { $set: { eventSubcategory: '📅 Other Events' } },
  )
  await List.updateMany(
    { date: { $exists: true }, startDate: { $exists: false } },
    [{ $set: { startDate: '$date', endDate: '$date' } }, { $unset: 'date' }],
  )
  await MenuItem.updateMany({ is_active: { $exists: false } }, { $set: { is_active: true } })
  await MenuItem.updateMany({ menuType: { $exists: false } }, { $set: { menuType: 'main_menu' } })
  const lastLeftMenuItem = await MenuItem.findOne({ menuType: 'left_menu' }).sort({ order: -1 }).select('order').lean()
  await Promise.all(defaultCommunityTypes.map((label, index) => MenuItem.updateOne(
    { label, menuType: 'left_menu' },
    {
      $setOnInsert: {
        label,
        href: `#${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
        menuType: 'left_menu',
        order: (lastLeftMenuItem?.order ?? -1) + index + 1,
        visible: true,
        is_active: true,
      },
    },
    { upsert: true },
  )))
  await Promise.all(defaultEventSubcategories.map((label, index) => EventSubcategory.updateOne(
    { label },
    { $setOnInsert: { label, order: index, is_active: true } },
    { upsert: true },
  )))
  const leftMenuItems = await MenuItem.find({ menuType: 'left_menu' }).select('_id label').lean()
  const legacyOtherItemTypes = await List.distinct('otherItemType', {
    itemType: 'other',
    otherItemType: { $exists: true, $ne: '' },
  })
  await Promise.all(legacyOtherItemTypes.map(async (label) => {
    const menuItem = await addSubmittedTypeToMenu(label)
    await List.updateMany(
      { itemType: 'other', otherItemType: label },
      { $set: { itemType: menuItem.label, itemTypeId: menuItem._id }, $unset: { otherItemType: '' } },
    )
  }))
  const menuItemsByNormalizedLabel = new Map(leftMenuItems.map((menuItem) => [
    normalizeItemTypeLabel(menuItem.label),
    menuItem,
  ]))
  const legacyItemTypes = await List.distinct('itemType', { itemTypeId: { $in: [null] }, itemType: { $ne: 'other' } })
  await Promise.all(legacyItemTypes.map(async (label) => {
    let menuItem = menuItemsByNormalizedLabel.get(normalizeItemTypeLabel(label))
    if (!menuItem) {
      menuItem = await addSubmittedTypeToMenu(label)
      menuItemsByNormalizedLabel.set(normalizeItemTypeLabel(label), menuItem)
    }
    await List.updateMany(
      { itemType: label, itemTypeId: { $in: [null] } },
      { $set: { itemType: menuItem.label, itemTypeId: menuItem._id } },
    )
  }))
  await User.updateMany({ role: { $exists: false } }, { $set: { role: 'enduser' } })
  await User.updateMany({ eventReminders: { $exists: false } }, { $set: { eventReminders: false } })
  if (process.env.ADMIN_EMAIL) {
    await User.updateOne({ email: process.env.ADMIN_EMAIL.trim().toLowerCase() }, { $set: { role: 'admin' } })
  }
  if (await MenuItem.countDocuments() === 0) await MenuItem.insertMany(defaultMenu)
  await Promise.all(defaultLocations.map((location) => Location.updateOne(
    { name: location.name },
    { $set: location },
    { upsert: true },
  )))
  const sampleOwner = await User.findOne(
    process.env.ADMIN_EMAIL ? { email: process.env.ADMIN_EMAIL.trim().toLowerCase() } : {},
  ).sort({ createdAt: 1 })
  if (sampleOwner) {
    await Promise.all(sampleCommunityLists.map(async ([itemType, itemName, message]) => {
      const exists = await List.exists({ userId: sampleOwner._id, itemType, itemName })
      if (exists) return
      await List.create({
        userId: sampleOwner._id,
        name: sampleOwner.name,
        itemName,
        itemType,
        itemTypeId: leftMenuItems.find((menuItem) => menuItem.label === itemType)?._id,
        is_Premium: false,
        user_is_active: true,
        admin_is_active: true,
        location: 'Fremont',
        phone: '510-555-0100',
        message,
        views: 0,
        likes: 0,
      })
    }))
  }
  await runEventReminders()
  setInterval(() => {
    runEventReminders()
  }, reminderWindowMs)
  app.listen(port, () => console.log(`Admin API listening on port ${port}`))
}

start().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
