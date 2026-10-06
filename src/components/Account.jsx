import { useEffect, useState } from 'react'
import { apiFetch, apiUrl } from '../api'
import { RichTextEditor } from './RichTextEditor'
import { eventSubcategories } from '../data/eventSubcategories'
import { formatEventDates } from '../utils/eventDisplay'
import styles from './Account.module.css'

export function Account() {
  const [credentials, setCredentials] = useState({ email: '', password: '' })
  const [lists, setLists] = useState([])
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState({ name: '', email: '', phone: '', eventReminders: false })
  const [profileOpen, setProfileOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [itemTypes, setItemTypes] = useState([])
  const [locations, setLocations] = useState([])
  const [newPhotos, setNewPhotos] = useState([])
  const [removedPhotos, setRemovedPhotos] = useState([])
  const [availableEventSubcategories, setAvailableEventSubcategories] = useState(eventSubcategories)

  const loadLists = async () => {
    const response = await apiFetch('/api/my-lists', { headers: { Authorization: `Bearer ${localStorage.getItem('listToken') || ''}` } })
    if (!response.ok) throw new Error('Please log in to manage your lists.')
    setLists(await response.json())
    setLoading(false)
  }

  const loadProfile = async () => {
    const response = await apiFetch('/api/me', {
      headers: { Authorization: `Bearer ${localStorage.getItem('listToken') || ''}` },
    })
    if (!response.ok) throw new Error('Unable to load account information.')
    setProfile(await response.json())
  }

  useEffect(() => {
    apiFetch('/api/menu?active=true&menuType=left_menu')
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load item types')
        return response.json()
      })
      .then(setItemTypes)
      .catch(() => setItemTypes([]))
    apiFetch('/api/locations')
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load locations')
        return response.json()
      })
      .then(setLocations)
      .catch(() => setLocations([]))
    apiFetch('/api/event-subcategories')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load event subcategories')))
      .then((items) => setAvailableEventSubcategories(items.map((item) => item.label)))
      .catch(() => setAvailableEventSubcategories(eventSubcategories))

    const timer = window.setTimeout(() => {
      if (localStorage.getItem('listToken')) {
        loadProfile().catch((reason) => setError(reason.message))
        loadLists().catch((reason) => {
          setError(reason.message)
          setLoading(false)
        })
      } else {
        setLoading(false)
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const login = async (event) => {
    event.preventDefault()
    const response = await apiFetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) })
    if (!response.ok) {
      const result = await response.json()
      setError(result.error)
      return
    }

    const result = await response.json()
    localStorage.setItem('listToken', result.token)
    loadProfile().catch((reason) => setError(reason.message))
    setError('')
    loadLists()
  }

  const saveProfile = async (event) => {
    event.preventDefault()
    const response = await apiFetch('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('listToken')}` },
      body: JSON.stringify(profile),
    })
    if (!response.ok) {
      const result = await response.json()
      setError(result.error || 'Unable to update account information.')
      return
    }
    setProfile(await response.json())
    setProfileOpen(false)
    setError('')
  }

  const save = async (event) => {
    event.preventDefault()
    const formData = new FormData()
    Object.entries(editing).forEach(([key, value]) => {
      if (!['photos', '_id', '__v', 'createdAt', 'updatedAt'].includes(key) && value !== undefined && value !== null) {
        formData.append(key, String(value))
      }
    })
    formData.set('removePhotos', JSON.stringify(removedPhotos))
    newPhotos.forEach((photo) => formData.append('photos', photo))
    const response = await apiFetch(`/api/my-lists/${editing._id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${localStorage.getItem('listToken')}` },
      body: formData,
    })
    if (response.ok) {
      setEditing(null)
      setNewPhotos([])
      setRemovedPhotos([])
      loadLists()
    } else {
      const result = await response.json()
      setError(result.error || 'Unable to save list.')
    }

  }

  const beginEdit = (list) => {
    const matchingType = itemTypes.find((item) => item.label === list.itemType)
    setEditing({ ...list, itemTypeId: list.itemTypeId || matchingType?._id || '' })
    setNewPhotos([])
    setRemovedPhotos([])
  }

  const remove = async (id) => {
    const response = await apiFetch(`/api/my-lists/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('listToken')}` } })
    if (response.ok) loadLists()
  }

  const logout = () => {
    localStorage.removeItem('listToken')
    window.location.href = '/login'
  }

  return (
    <main className={styles.account}>
      <a href="/" className={styles.back}>← Back to site</a>
      <h1>Manage your lists</h1>
      {localStorage.getItem('listToken') && <button type="button" className={styles.logout} onClick={logout}>Log out</button>}
      <button type="button" className={styles.profileToggle} onClick={() => setProfileOpen((open) => !open)}>Edit account information</button>
      {profileOpen && <form className={styles.edit} onSubmit={saveProfile}>
        <input required placeholder="Full name" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} />
        <input required type="email" pattern="^[^\s@]+@[^\s@]+\.[^\s@]+$" title="Enter a valid email address." placeholder="Email address" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} />
        <input required type="tel" pattern="^\+?[0-9][0-9\s().-]{6,24}$" title="Enter a valid phone number with 7 to 15 digits." placeholder="Phone number" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} />
        <label className={styles.reminderOptIn}>
          <input type="checkbox" checked={profile.eventReminders === true} onChange={(event) => setProfile({ ...profile, eventReminders: event.target.checked })} />
          Email and in-app event reminders 24 hours before an event starts
        </label>
        <button type="submit">Save account information</button>
      </form>}
      {!localStorage.getItem('listToken') && <form className={styles.login} onSubmit={login}>
        <h2>Sign in</h2>
        <input required type="email" pattern="^[^\s@]+@[^\s@]+\.[^\s@]+$" title="Enter a valid email address." placeholder="Email address" value={credentials.email} onChange={(event) => setCredentials({ ...credentials, email: event.target.value })} />
        <input required type="password" placeholder="Password" value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: event.target.value })} />
        <button type="submit">Sign in</button>
      </form>}
      {!profileOpen && loading && localStorage.getItem('listToken') && <p className={styles.muted}>Loading your submitted lists...</p>}
      {!profileOpen && !loading && localStorage.getItem('listToken') && lists.length === 0 && <p className={styles.muted}>You have not submitted any lists yet.</p>}
      {!profileOpen && lists.map((list) => editing?._id === list._id ? (
        <form className={`${styles.edit} ${styles.listEdit}`} onSubmit={save} key={list._id}>
          <label>Name<input required value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label>
          <label>Item name<input required value={editing.itemName} onChange={(event) => setEditing({ ...editing, itemName: event.target.value })} /></label>
          <label>Type<select required value={editing.itemTypeId || editing.itemType} onChange={(event) => {
            const selected = event.target.value === 'other' ? null : itemTypes.find((item) => item._id === event.target.value)
            setEditing({ ...editing, itemTypeId: event.target.value === 'other' ? '' : event.target.value, itemType: selected?.label || 'other' })
          }}>
            <option value="" disabled>Select a type</option>
            {itemTypes.map((item) => <option value={item._id} key={item._id || item.label}>{item.label}</option>)}
            <option value="other">Other</option>
          </select></label>
          {editing.itemType === 'other' && <label>Other type<input required value={editing.otherItemType || ''} onChange={(event) => setEditing({ ...editing, otherItemType: event.target.value })} /></label>}
          {/\bevents?\b/i.test(editing.itemType === 'other' ? editing.otherItemType || '' : editing.itemType || '') && <>
            <label>Event subcategory<select required value={editing.eventSubcategory || ''} onChange={(event) => setEditing({ ...editing, eventSubcategory: event.target.value })}>
              <option value="" disabled>Select a subcategory</option>
              {availableEventSubcategories.map((subcategory) => <option value={subcategory} key={subcategory}>{subcategory}</option>)}
            </select></label>
            <label>From date<input required type="date" value={editing.startDate ? editing.startDate.slice(0, 10) : ''} onChange={(event) => setEditing({ ...editing, startDate: event.target.value })} /></label>
            <label>To date<input required type="date" min={editing.startDate ? editing.startDate.slice(0, 10) : undefined} value={editing.endDate ? editing.endDate.slice(0, 10) : ''} onChange={(event) => setEditing({ ...editing, endDate: event.target.value })} /></label>
          </>}
          <label>Address (optional)<input value={editing.address || ''} onChange={(event) => setEditing({ ...editing, address: event.target.value })} /></label>
          <label>City<select required value={editing.location || ''} onChange={(event) => setEditing({ ...editing, location: event.target.value })}>
            <option value="" disabled>Select a city</option>
            {locations.map((location) => <option value={location.name} key={location._id}>{location.name}</option>)}
          </select></label>
          <label>Phone number<input required type="tel" pattern="^\+?[0-9][0-9\s().-]{6,24}$" title="Enter a valid phone number with 7 to 15 digits." value={editing.phone} onChange={(event) => setEditing({ ...editing, phone: event.target.value })} /></label>
          <label>URL (optional)<input type="text" inputMode="url" autoCapitalize="none" value={editing.url || ''} onChange={(event) => setEditing({ ...editing, url: event.target.value })} placeholder="example.com" /></label>
          <label>Instagram (optional)<input type="text" inputMode="url" autoCapitalize="none" value={editing.instagram || ''} onChange={(event) => setEditing({ ...editing, instagram: event.target.value })} placeholder="@your-account or instagram.com/your-account" /></label>
          <label>Message<RichTextEditor value={editing.message} onChange={(message) => setEditing({ ...editing, message })} placeholder="Describe this list" /></label>
          <label className={styles.checkbox}><input type="checkbox" checked={editing.user_is_active !== false} onChange={(event) => setEditing({ ...editing, user_is_active: event.target.checked })} /> Active</label>
          <div className={styles.photoEditor}>
            <strong>Photos</strong>
            <div className={styles.editPhotos}>
              {(editing.photos || []).filter((photo) => !removedPhotos.includes(photo.filename)).map((photo) => (
                <div className={styles.editPhoto} key={photo.filename}>
                  <img src={apiUrl(photo.url)} alt={photo.originalName} />
                  <button type="button" onClick={() => setRemovedPhotos((current) => [...current, photo.filename])}>Remove</button>
                </div>
              ))}
            </div>
            <input type="file" accept="image/*" multiple onChange={(event) => setNewPhotos(Array.from(event.target.files || []))} />
            {newPhotos.length > 0 && <span className={styles.muted}>{newPhotos.length} new photo{newPhotos.length === 1 ? '' : 's'} selected</span>}
          </div>
          <button type="submit">Save changes</button>
          <button type="button" onClick={() => setEditing(null)}>Cancel</button>
        </form>
      ) : (
        <article className={styles.list} key={list._id}>
          <div className={styles.listDetails}>
            <div className={styles.listTitle}>
              <strong>{list.itemName}</strong>
              {list.is_Premium && <em>Premium</em>}
            </div>
            <span>Type: {list.itemType === 'other' ? list.otherItemType : list.itemType}</span>
            {list.eventSubcategory && <span>Event: {list.eventSubcategory}</span>}
            {(list.startDate || list.endDate) && <span>Dates: {formatEventDates(list.startDate, list.endDate)}</span>}
            {list.address && <span>Address: {list.address}</span>}
            {list.location && <span>City: {list.location}</span>}
            {list.phone && <span>Phone: {list.phone}</span>}
            {list.url && <span>URL: <a href={list.url} target="_blank" rel="noreferrer">{list.url}</a></span>}
            {list.instagram && <span>Instagram: <a href={list.instagram} target="_blank" rel="noreferrer">{list.instagram}</a></span>}
            <span className={`${styles.status} ${list.user_is_active === false ? styles.inactive : styles.active}`}>
              User: {list.user_is_active === false ? 'Inactive' : 'Active'}
            </span>
            <span className={`${styles.status} ${list.admin_is_active === false ? styles.inactive : styles.active}`}>
              Admin: {list.admin_is_active === false ? 'Inactive' : 'Active'}
            </span>
            <p>{list.message}</p>
            {list.photos?.length > 0 && <div className={styles.listPhotos}>
              {list.photos.map((photo) => <a href={photo.url} target="_blank" rel="noreferrer" key={photo.filename || photo.originalName}>
                <img src={apiUrl(photo.url)} alt={photo.originalName} />
              </a>)}
            </div>}
          </div>
          <div className={styles.listActions}>
            <button type="button" onClick={() => beginEdit(list)}>Edit</button>
            <button type="button" onClick={() => remove(list._id)}>Delete</button>
          </div>
        </article>
      ))}
      {error && <p className={styles.error}>{error}</p>}
    </main>
  )
}
