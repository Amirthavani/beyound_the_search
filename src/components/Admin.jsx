import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../api'
import { defaultMenu } from '../data/menu'
import { RichTextEditor } from './RichTextEditor'
import styles from './Admin.module.css'
import { eventSubcategories } from '../data/eventSubcategories'
import { formatEventDates } from '../utils/eventDisplay'

const emptyItem = { label: '', href: '#', menuType: 'main_menu', order: 0, visible: true, is_active: true }
const emptyList = { name: '', itemName: '', itemType: '', itemTypeId: '', otherItemType: '', eventSubcategory: '', startDate: '', endDate: '', address: '', location: '', phone: '', url: '', instagram: '', message: '', is_Premium: false, admin_is_active: true }

export function Admin() {
  const [items, setItems] = useState([])
  const [form, setForm] = useState(emptyItem)
  const [editingId, setEditingId] = useState(null)
  const [status, setStatus] = useState('')
  const [lists, setLists] = useState([])
  const [activeTab, setActiveTab] = useState('menu')
  const [listForm, setListForm] = useState(emptyList)
  const [editingListId, setEditingListId] = useState(null)
  const [locations, setLocations] = useState([])
  const [authorized, setAuthorized] = useState(null)
  const [availableEventSubcategories, setAvailableEventSubcategories] = useState(eventSubcategories)
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${localStorage.getItem('listToken') || ''}` }), [])

  const loadItems = useCallback(async () => {
    try {
      const response = await apiFetch('/api/menu?includeInactive=true', { headers: authHeaders })
      if (!response.ok) throw new Error('Unable to load menu items.')
      setItems(await response.json())
    } catch {
      setItems(defaultMenu)
      setStatus('API unavailable. Connect MongoDB to save changes.')
    }
  }, [authHeaders])

  const loadLists = useCallback(async () => {
    const response = await apiFetch('/api/lists?includeInactive=true', { headers: authHeaders })
    if (response.ok) setLists(await response.json())
  }, [authHeaders])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      apiFetch('/api/me', { headers: authHeaders })
        .then((response) => {
          if (!response.ok) throw new Error('Admin login required.')
          return response.json()
        })
        .then((user) => {
          if (user.role !== 'admin') throw new Error('Admin access required.')
          setAuthorized(true)
          loadItems()
          apiFetch('/api/event-subcategories')
            .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load event subcategories')))
            .then((items) => setAvailableEventSubcategories(items.map((item) => item.label)))
            .catch(() => setAvailableEventSubcategories(eventSubcategories))
          loadLists()
        })
        .catch((reason) => {
          setAuthorized(false)
          setStatus(reason.message)
        })
      apiFetch('/api/locations')
        .then((response) => {
          if (!response.ok) throw new Error('Unable to load locations.')
          return response.json()
        })
        .then(setLocations)
        .catch(() => setLocations([]))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [authHeaders, loadItems, loadLists])

  const updateForm = (event) => {
    const { name, value, type, checked } = event.target
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  const saveItem = async (event) => {
    event.preventDefault()
    setStatus('')
    const payload = { ...form, order: Number(form.order) }
    const url = editingId ? `/api/menu/${editingId}` : '/api/menu'
    const response = await apiFetch(url, {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      const result = await response.json()
      setStatus(result.error || 'Unable to save menu item.')
      return
    }
    setForm(emptyItem)
    setEditingId(null)
    setStatus('Menu saved.')
    loadItems()
  }

  const editItem = (item) => {
    setEditingId(item._id)
    setForm({ label: item.label, href: item.href, menuType: item.menuType, order: item.order, visible: item.visible, is_active: item.is_active !== false })
    setStatus('')
  }

  const deleteItem = async (id) => {
    const response = await apiFetch(`/api/menu/${id}`, { method: 'DELETE', headers: authHeaders })
    if (!response.ok) {
      setStatus('Unable to delete menu item.')
      return
    }
    setStatus('Menu item deleted.')
    loadItems()
  }

  const updateListForm = (event) => {
    const { name, value, type, checked } = event.target
    setListForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  const editList = (list) => {
    setEditingListId(list._id)
    setListForm({
      name: list.name || '',
      itemName: list.itemName || '',
      itemType: list.itemType || '',
      itemTypeId: list.itemTypeId || items.find((item) => item.menuType === 'left_menu' && item.label === list.itemType)?._id || '',
      otherItemType: list.otherItemType || '',
      eventSubcategory: list.eventSubcategory || '',
      startDate: list.startDate ? list.startDate.slice(0, 10) : '',
      endDate: list.endDate ? list.endDate.slice(0, 10) : '',
      address: list.address || '',
      location: list.location || '',
      phone: list.phone || '',
      url: list.url || '',
      instagram: list.instagram || '',
      message: list.message || '',
      is_Premium: Boolean(list.is_Premium),
      admin_is_active: list.admin_is_active !== false,
    })
    setStatus('')
  }

  const saveList = async (event) => {
    event.preventDefault()
    const response = await apiFetch(`/api/lists/${editingListId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(listForm),
    })
    if (!response.ok) {
      const result = await response.json()
      setStatus(result.error || 'Unable to save list.')
      return
    }
    setEditingListId(null)
    setListForm(emptyList)
    setStatus('List updated.')
    loadLists()
  }

  const deleteList = async (id) => {
    const response = await apiFetch(`/api/lists/${id}`, { method: 'DELETE', headers: authHeaders })
    if (!response.ok) {
      setStatus('Unable to delete list.')
      return
    }
    setStatus('List deleted.')
    if (editingListId === id) {
      setEditingListId(null)
      setListForm(emptyList)
    }
    loadLists()
  }

  if (authorized === null) return <section className={styles.admin}><p className={styles.status}>Checking admin access...</p></section>
  if (!authorized) return <section className={styles.admin}><p className={styles.status}>{status || 'Admin access required.'} <a href="/login">Log in as an admin</a></p></section>

  return (
    <section className={styles.admin} id="admin">
      <div className={styles.heading}>
        <div>
          <p className={styles.kicker}>Admin / Navigation</p>
          <h1>Manage the menu.</h1>
          <p className={styles.description}>Create, reorder, hide, or remove the links shown in the public header.</p>
        </div>
        <a href="/" className={styles.backLink}>Back to site ↗</a>
      </div>
      <div className={styles.tabs} role="tablist" aria-label="Admin sections">
        <button type="button" className={activeTab === 'menu' ? styles.activeTab : ''} onClick={() => setActiveTab('menu')} role="tab" aria-selected={activeTab === 'menu'}>Menu</button>
        <button type="button" className={activeTab === 'lists' ? styles.activeTab : ''} onClick={() => setActiveTab('lists')} role="tab" aria-selected={activeTab === 'lists'}>Lists <span>{lists.length}</span></button>
      </div>
      {activeTab === 'menu' && <div className={styles.workspace}>
        <form className={styles.form} onSubmit={saveItem}>
          <h2>{editingId ? 'Edit link' : 'Add a link'}</h2>
          <label>Label<input name="label" value={form.label} onChange={updateForm} placeholder="Journal" required /></label>
          <label>Destination<input name="href" value={form.href} onChange={updateForm} placeholder="#journal or https://..." required /></label>
          <label>Menu type
            <select name="menuType" value={form.menuType} onChange={updateForm}>
              <option value="main_menu">Main menu</option>
              <option value="left_menu">Left menu</option>
            </select>
          </label>
          <label>Order<input name="order" type="number" min="0" value={form.order} onChange={updateForm} required /></label>
          <label className={styles.checkbox}><input name="visible" type="checkbox" checked={form.visible} onChange={updateForm} /> Visible on public site</label>
          <label className={styles.checkbox}><input name="is_active" type="checkbox" checked={form.is_active} onChange={updateForm} /> Active</label>
          <button type="submit">{editingId ? 'Save changes' : 'Add menu item'} <span>↗</span></button>
          {editingId && <button type="button" className={styles.cancel} onClick={() => { setEditingId(null); setForm(emptyItem) }}>Cancel edit</button>}
        </form>
        <div className={styles.list}>
          <div className={styles.listHeader}><h2>Current links</h2><span>{items.length} items</span></div>
          {items.map((item) => (
            <div className={`${styles.item} ${!item.visible ? styles.hidden : ''}`} key={item._id || `${item.label}-${item.order}`}>
              <span className={styles.order}>0{Number(item.order) + 1}</span>
              <div><strong>{item.label}</strong><small>{item.href} · {item.menuType}</small></div>
              <span className={styles.state}>{item.visible ? 'Live' : 'Hidden'}</span>
              <button type="button" onClick={() => editItem(item)}>Edit</button>
              {item._id && <button type="button" onClick={() => deleteItem(item._id)} aria-label={`Delete ${item.label}`}>×</button>}
            </div>
          ))}
        </div>
      </div>}
      {activeTab === 'lists' && <div className={styles.submissions}>
        <div className={styles.listHeader}><h2>Submitted lists</h2><span>{lists.length} submissions</span></div>
        {editingListId && <form className={styles.listEditForm} onSubmit={saveList}>
          <h2>Edit submitted list</h2>
          <div className={styles.editGrid}>
            <label>Name<input name="name" value={listForm.name} onChange={updateListForm} required /></label>
            <label>Item name<input name="itemName" value={listForm.itemName} onChange={updateListForm} required /></label>
            <label>Type<select name="itemTypeId" value={listForm.itemTypeId || 'other'} onChange={(event) => {
              const selected = items.find((item) => item._id === event.target.value)
              updateListForm({ target: { name: 'itemTypeId', value: event.target.value } })
              updateListForm({ target: { name: 'itemType', value: selected?.label || 'other' } })
            }} required>
              <option value="" disabled>Select a type</option>
              {items.filter((item) => item.menuType === 'left_menu' && item.is_active !== false).map((item) => <option value={item._id} key={item._id}>{item.label}</option>)}
              <option value="other">Other</option>
            </select></label>
            <label>Other type<input name="otherItemType" value={listForm.otherItemType} onChange={updateListForm} /></label>
            {/\bevents?\b/i.test(listForm.itemType === 'other' ? listForm.otherItemType || '' : listForm.itemType || '') && <>
              <label>Event subcategory<select name="eventSubcategory" value={listForm.eventSubcategory} onChange={updateListForm} required>
                <option value="" disabled>Select a subcategory</option>
                {availableEventSubcategories.map((subcategory) => <option value={subcategory} key={subcategory}>{subcategory}</option>)}
              </select></label>
              <label>From date<input name="startDate" type="date" value={listForm.startDate} onChange={updateListForm} required /></label>
              <label>To date<input name="endDate" type="date" min={listForm.startDate || undefined} value={listForm.endDate} onChange={updateListForm} required /></label>
            </>}
            <label>Address (optional)<input name="address" value={listForm.address} onChange={updateListForm} /></label>
            <label>City<select name="location" value={listForm.location} onChange={updateListForm} required>
              <option value="" disabled>Select a city</option>
              {locations.map((location) => <option value={location.name} key={location._id}>{location.name}</option>)}
            </select></label>
            <label>Phone number<input name="phone" type="tel" pattern="^\+?[0-9][0-9\s().-]{6,24}$" title="Enter a valid phone number with 7 to 15 digits." value={listForm.phone} onChange={updateListForm} required /></label>
            <label>URL (optional)<input name="url" type="text" inputMode="url" autoCapitalize="none" value={listForm.url} onChange={updateListForm} placeholder="example.com" /></label>
            <label>Instagram (optional)<input name="instagram" type="text" inputMode="url" autoCapitalize="none" value={listForm.instagram} onChange={updateListForm} placeholder="@your-account or instagram.com/your-account" /></label>
            <label className={styles.checkbox}><input name="is_Premium" type="checkbox" checked={listForm.is_Premium} onChange={updateListForm} /> Premium listing</label>
            <label className={styles.checkbox}><input name="admin_is_active" type="checkbox" checked={listForm.admin_is_active} onChange={updateListForm} /> Admin active</label>
            <label className={styles.fullWidth}>Description<RichTextEditor value={listForm.message} onChange={(message) => setListForm((current) => ({ ...current, message }))} placeholder="Describe this list" /></label>
          </div>
          <button type="submit">Save changes</button>
          <button type="button" className={styles.cancel} onClick={() => { setEditingListId(null); setListForm(emptyList) }}>Cancel</button>
        </form>}
        {lists.length === 0 && <p className={styles.empty}>No list submissions yet.</p>}
        {lists.map((list) => (
          <article className={styles.submission} key={list._id}>
            <div>
              <strong>{list.itemName}</strong>
            <small>{[list.itemType === 'other' ? list.otherItemType : list.itemType, list.eventSubcategory, list.location, list.is_Premium ? 'Premium' : ''].filter(Boolean).join(' · ')}</small>
            </div>
            <div className={styles.submissionMeta}>
              <span>{list.userId?.username || list.name}</span>
              {(list.startDate || list.endDate) && <span>Dates: {formatEventDates(list.startDate, list.endDate)}</span>}
              <span>Phone: {list.phone}</span>
              {list.url && <a href={list.url} target="_blank" rel="noreferrer">URL: {list.url}</a>}
              {list.instagram && <a href={list.instagram} target="_blank" rel="noreferrer">Instagram: {list.instagram}</a>}
              <span>{list.photos.length} photo{list.photos.length === 1 ? '' : 's'}</span>
              <span>{list.user_is_active === false ? 'User inactive' : 'User active'}</span>
              <span>{list.admin_is_active === false ? 'Admin inactive' : 'Admin active'}</span>
            </div>
            <div className={styles.submissionDescription} dangerouslySetInnerHTML={{ __html: list.message }} />
            <div className={styles.actions}>
              <button type="button" onClick={() => editList(list)}>Edit</button>
              <button type="button" onClick={() => deleteList(list._id)}>Delete</button>
            </div>
            {list.photos.length > 0 && <div className={styles.photos}>
              {list.photos.map((photo) => (
                <a href={photo.url} target="_blank" rel="noreferrer" key={photo.filename || photo.originalName}>
                  {photo.originalName}
                </a>
              ))}
            </div>}
          </article>
        ))}
      </div>}
      {status && <p className={styles.status}>{status}</p>}
    </section>
  )
}
