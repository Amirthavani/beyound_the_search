import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import { defaultMenu } from '../data/menu'
import styles from './Header.module.css'

export function Header() {
  const [menu, setMenu] = useState(defaultMenu)
  const [leftMenu, setLeftMenu] = useState([])
  const [activeListCounts, setActiveListCounts] = useState({})
  const [leftMenuOpen, setLeftMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [search, setSearch] = useState('')
  const [preferences] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('visitorPreferences') || 'null')
    } catch {
      return null
    }
  })
  const isLoggedIn = Boolean(localStorage.getItem('listToken'))
  const getMenuHref = (href) => href === '#projects' ? '/directory' : href === '#about' ? '/about' : href === '#contact' ? '/contact' : href.startsWith('#') ? `/${href}` : href
  const getLeftMenuHref = (item) => `/list-type/${encodeURIComponent(item.label)}`
  const logout = () => {
    localStorage.removeItem('listToken')
    window.location.href = '/login'
  }
  const submitSearch = (event) => {
    event.preventDefault()
    const query = search.trim()
    window.location.href = query ? `/directory?search=${encodeURIComponent(query)}` : '/directory'
  }
  const resetPreferences = () => {
    sessionStorage.setItem('editingVisitorPreferences', 'true')
    window.location.reload()
  }
  const preferenceLocations = preferences?.locations || (preferences?.location ? [preferences.location] : [])
  const preferenceInterests = preferences?.interests || (preferences?.interest ? [preferences.interest] : [])
  const unreadNotificationCount = notifications.filter((notification) => !notification.read).length
  const normalizeCategory = (value) => String(value || '').replace(/[^\p{L}\p{N}\s]/gu, '').trim().replace(/\s+/g, ' ').toLowerCase()
  const markNotificationRead = async (id) => {
    const response = await apiFetch(`/api/notifications/${id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${localStorage.getItem('listToken') || ''}` },
    })
    if (response.ok) {
      const notification = await response.json()
      setNotifications((current) => current.map((item) => item._id === notification._id ? notification : item))
    }
  }

  useEffect(() => {
    apiFetch('/api/menu?active=true&menuType=main_menu')
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load menu')
        return response.json()
      })
      .then((items) => {
        const activeItems = items.filter((item) => item.is_active !== false)
        setMenu(activeItems.length ? activeItems : defaultMenu)
      })
      .catch(() => setMenu(defaultMenu))

    apiFetch('/api/menu?active=true&menuType=left_menu')
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load left menu')
        return response.json()
      })
      .then(setLeftMenu)
      .catch(() => setLeftMenu([]))

    apiFetch('/api/lists')
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load active list counts')
        return response.json()
      })
      .then((lists) => {
        const counts = lists.reduce((result, list) => {
          const category = normalizeCategory(list.itemType === 'other' ? list.otherItemType : list.itemType)
          if (category) result[category] = (result[category] || 0) + 1
          return result
        }, {})
        setActiveListCounts(counts)
      })
      .catch(() => setActiveListCounts({}))

    if (isLoggedIn) {
      apiFetch('/api/notifications', {
        headers: { Authorization: `Bearer ${localStorage.getItem('listToken') || ''}` },
      })
        .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load notifications')))
        .then(setNotifications)
        .catch(() => setNotifications([]))
    }
  }, [isLoggedIn])

  return (
    <header className={styles.header}>
      <div className={styles.brandGroup}>
        <button
          type="button"
          className={`${styles.menuButton} ${leftMenuOpen ? styles.menuButtonOpen : ''}`}
          onClick={() => setLeftMenuOpen((open) => !open)}
          aria-expanded={leftMenuOpen}
          aria-controls="left-menu"
          aria-label="Open left menu"
        >
          <span />
          <span />
          <span />
        </button>
        <a className={styles.brand} href="/" aria-label="Beyond The Searches home">
          <span className={styles.brandMark} aria-hidden="true">
            <svg viewBox="0 0 24 24" role="img">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 5 5" />
            </svg>
          </span>
          <span className={styles.brandCopy}>
            <span className={styles.brandName}>
              <span className={styles.brandBlue}>Beyond</span>{' '}
              <span className={styles.brandRed}>The</span>{' '}
              <span className={styles.brandYellow}>Searches</span>
            </span>
            <span className={styles.tagline}>Discover Local. Support Small. Connect Better</span>
          </span>
        </a>
      </div>
      {leftMenuOpen && (leftMenu.length > 0 || menu.length > 0) && (
        <nav className={styles.leftMenu} id="left-menu" aria-label="Additional navigation">
          {leftMenu.map((item) => (
            <a href={getLeftMenuHref(item)} key={item._id || item.href} onClick={() => setLeftMenuOpen(false)}>
              <span>{item.label}</span>
              <span className={styles.listCount}>{activeListCounts[normalizeCategory(item.label)] || 0}</span>
            </a>
          ))}
          <div className={styles.mobileMainMenu}>
            {menu.map((item) => (
              <a href={getMenuHref(item.href)} key={item._id || item.href} onClick={() => setLeftMenuOpen(false)}>
                {item.label}
              </a>
            ))}
          </div>
        </nav>
      )}
      <nav className={styles.nav} aria-label="Main navigation">
        {menu.map((item) => <a href={getMenuHref(item.href)} key={item._id || item.href}>{item.label}</a>)}
      </nav>
      {isLoggedIn && <a className={styles.submitLink} href="/#contact">
        Submit your list <span aria-hidden="true">↗</span>
      </a>}
      <form className={styles.searchForm} onSubmit={submitSearch} role="search">
        <input aria-label="Search lists" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search lists" />
        <button type="submit" aria-label="Submit search">⌕</button>
      </form>
      <div className={styles.accountWrap}>
        <button
          type="button"
          className={styles.accountLink}
          onClick={() => isLoggedIn ? setAccountOpen((open) => !open) : window.location.assign('/login')}
          aria-expanded={isLoggedIn ? accountOpen : undefined}
          aria-haspopup={isLoggedIn ? 'menu' : undefined}
          aria-label={isLoggedIn ? `Open account menu${unreadNotificationCount ? ` (${unreadNotificationCount} unread notifications)` : ''}` : 'Log in'}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.2 3.2-5 7-5s6.2 1.8 7 5" /></svg>
          {unreadNotificationCount > 0 && <span className={styles.notificationBadge} aria-hidden="true">{unreadNotificationCount}</span>}
        </button>
        {isLoggedIn && accountOpen && <nav className={styles.accountMenu} aria-label="Account menu">
          {preferences && <div className={styles.preferences}>
            <strong>Your preferences</strong>
            <span>Cities: {preferenceLocations.join(', ')}</span>
            <span>Interests: {preferenceInterests.join(', ')}</span>
            <button type="button" onClick={resetPreferences}>Change preferences</button>
          </div>}
          <a href="/#contact" onClick={() => setAccountOpen(false)}>Submit your list</a>
          <a href="/account" onClick={() => setAccountOpen(false)}>Manage Account</a>
          <button type="button" className={styles.notificationButton} onClick={() => setNotificationsOpen((open) => !open)} aria-expanded={notificationsOpen}>
            Notifications{unreadNotificationCount ? ` (${unreadNotificationCount})` : ''}
          </button>
          {notificationsOpen && <section className={styles.notificationList} aria-label="Event reminders">
            {notifications.length === 0 && <p>No event reminders yet.</p>}
            {notifications.map((notification) => (
              <article className={`${styles.notification} ${!notification.read ? styles.notificationUnread : ''}`} key={notification._id}>
                <a href={`/lists/${notification.listId}`} onClick={() => !notification.read && markNotificationRead(notification._id)}>
                  <strong>{notification.eventName}</strong>
                  <span>{notification.message}</span>
                  <time dateTime={notification.eventStartDate}>Starts {new Date(notification.eventStartDate).toLocaleString()}</time>
                </a>
                {!notification.read && <button type="button" onClick={() => markNotificationRead(notification._id)}>Mark as read</button>}
              </article>
            ))}
          </section>}
          <a href="/login" onClick={(event) => { event.preventDefault(); logout() }}>Logout</a>
        </nav>}
        {!isLoggedIn && accountOpen && <nav className={styles.accountMenu} aria-label="Visitor preferences">
          {preferences && <div className={styles.preferences}>
            <strong>Your preferences</strong>
            <span>Cities: {preferenceLocations.join(', ')}</span>
            <span>Interests: {preferenceInterests.join(', ')}</span>
            <button type="button" onClick={resetPreferences}>Change preferences</button>
          </div>}
        </nav>}
      </div>
    </header>
  )
}
