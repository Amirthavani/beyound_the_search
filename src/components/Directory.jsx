import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch, apiUrl } from '../api'
import { eventSubcategories as defaultEventSubcategories } from '../data/eventSubcategories'
import styles from './Directory.module.css'

const pageSize = 10
const isEventsType = (value) => /\bevents?\b/i.test(String(value || ''))
const categoryKey = (value) => String(value || '').replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim().toLowerCase()
const getStoredPreferences = () => {
  try {
    const preferences = JSON.parse(localStorage.getItem('visitorPreferences') || 'null')
    return preferences && typeof preferences === 'object' && !Array.isArray(preferences) ? preferences : {}
  } catch {
    return {}
  }
}
const preferenceValues = (preferences, pluralKey, singularKey) => {
  const pluralValues = Array.isArray(preferences[pluralKey]) ? preferences[pluralKey] : []
  const singularValue = typeof preferences[singularKey] === 'string' ? [preferences[singularKey]] : []
  return [...new Set([...pluralValues, ...singularValue].map((value) => String(value || '').trim()).filter(Boolean))]
}

export function Directory({ embedded = false, selectedCategory = '', onClearCategory }) {
  const [preferences] = useState(getStoredPreferences)
  const [lists, setLists] = useState([])
  const [itemTypes, setItemTypes] = useState([])
  const [locations, setLocations] = useState([])
  const [eventSubcategories, setEventSubcategories] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ itemType: '', eventSubcategory: '', date: '', location: '' })
  const [search] = useState(() => new URLSearchParams(window.location.search).get('search') || '')
  const loadMoreRef = useRef(null)
  const activeItemType = embedded ? selectedCategory : filters.itemType
  const preferredLocations = preferenceValues(preferences, 'locations', 'location')
  const preferredCategories = preferenceValues(preferences, 'interests', 'interest')

  useEffect(() => {
    apiFetch('/api/event-subcategories')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load event subcategories')))
      .then((items) => setEventSubcategories(items.map((item) => item.label)))
      .catch(() => setEventSubcategories(defaultEventSubcategories))

    apiFetch('/api/locations')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load locations')))
      .then(setLocations)
      .catch(() => setLocations([]))
  }, [])

  const loadPage = useCallback((requestedPage, append = false) => {
    setError('')
    const preferences = (() => {
      try {
        return JSON.parse(localStorage.getItem('visitorPreferences') || 'null')
      } catch {
        return null
      }
    })()
    const params = new URLSearchParams({ page: String(requestedPage), limit: String(pageSize) })
    if (search) params.set('search', search)
    if (activeItemType) params.set('itemType', activeItemType)
    if (filters.eventSubcategory) params.set('eventSubcategory', filters.eventSubcategory)
    if (filters.date) params.set('date', filters.date)
    if (filters.location) params.set('location', filters.location)
    if (preferences?.interests?.length) params.set('interests', preferences.interests.join(','))
    setLoading(true)
    apiFetch(`/api/lists?${params}`)
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load lists')
        return response.json()
      })
      .then((result) => {
        setLists((current) => append ? [...current, ...result.items] : result.items)
        setTotal(result.total)
        setItemTypes([...new Map(result.itemTypes.map((itemType) => [categoryKey(itemType), itemType])).values()])
        setPage(result.page)
        setHasMore(result.page < result.pageCount)
        if (result.eventSubcategories?.length) {
          setEventSubcategories(result.eventSubcategories)
        }
      })
      .catch(() => setError('The directory could not be loaded.'))
      .finally(() => setLoading(false))
  }, [activeItemType, filters, search])

  useEffect(() => {
    const timer = window.setTimeout(() => loadPage(1), 0)
    return () => window.clearTimeout(timer)
  }, [loadPage])

  useEffect(() => {
    const sentinel = loadMoreRef.current
    if (!sentinel) return undefined
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        loadPage(page + 1, true)
      }
    }, { rootMargin: '300px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loading, loadPage, page])

  const updateFilter = (event) => {
    const { name, value } = event.target
    if (embedded && name === 'itemType') {
      onClearCategory?.(value)
      return
    }
    setFilters((current) => ({ ...current, [name]: value, ...(name === 'itemType' && !isEventsType(value) ? { eventSubcategory: '' } : {}) }))
    setPage(1)
  }
  const clearSearch = () => {
    window.location.href = '/directory'
  }

  const Container = embedded ? 'section' : 'main'

  return (
    <Container className={embedded ? styles.homeFeed : styles.page} id={embedded ? 'listings' : undefined}>
      {embedded ? <div className={styles.feedHeading}>
        <p className={`${styles.kicker} ${styles.recommendationKicker}`}>
          Recommended for you
          <div><strong>Cities:</strong> {preferredLocations.join(', ') || 'All cities'} · </div><div><strong>Categories:</strong> {selectedCategory || preferredCategories.join(', ') || 'All categories'}</span>
        </p>
        <div className={styles.feedTitle}>
          <h2>{selectedCategory ? `${selectedCategory} listings` : 'All places worth finding.'}</h2>
          {selectedCategory && <button type="button" onClick={() => onClearCategory?.('')}>Show all listings</button>}
        </div>
      </div> : <>
        <a href="/" className={styles.back}>← Back to home</a>
        <p className={styles.kicker}>Complete directory</p>
        <h1>All places worth finding.</h1>
      </>}
      {search && <div className={styles.searchTerm}>
        <span>Search results for “{search}”</span>
        <button type="button" onClick={clearSearch}>Clear search</button>
      </div>}
      <div className={styles.filters} aria-label="Search directory">
        <label>
          Items
          <select name="itemType" value={activeItemType} onChange={updateFilter}>
            <option value="">All types</option>
            {itemTypes.map((itemType) => <option value={itemType} key={itemType}>{itemType}</option>)}
          </select>
        </label>
        {isEventsType(activeItemType) && <label>
          Event subcategory
          <select name="eventSubcategory" value={filters.eventSubcategory} onChange={updateFilter}>
            <option value="">All event subcategories</option>
            {eventSubcategories.map((subcategory) => <option value={subcategory} key={subcategory}>{subcategory}</option>)}
          </select>
        </label>}
        <label>
          Date
          <input type="date" name="date" value={filters.date} onChange={updateFilter} />
        </label>
        <label>
          City
          <select name="location" value={filters.location} onChange={updateFilter}>
            <option value="">All cities</option>
            {locations.map((location) => <option value={location.name} key={location._id}>{location.name}</option>)}
          </select>
        </label>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      {!error && lists.length === 0 && <p className={styles.empty}>{total === 0 ? 'No listings match your search.' : 'No lists have been submitted yet.'}</p>}
      {lists.length > 0 && <div className={styles.grid}>
        {lists.map((list) => (
          <a className={styles.card} href={`/lists/${list._id}`} key={list._id}>
            <div className={styles.image}>
              {list.photos?.[0]?.url ? <img src={apiUrl(list.photos[0].url)} alt={list.itemName} /> : <span>No photo</span>}
            </div>
            <div className={styles.cardInfo}>
              <p>{list.itemType === 'other' ? list.otherItemType : list.itemType}</p>
              {list.eventSubcategory && <small>{list.eventSubcategory}</small>}
              <h2>{list.itemName}</h2>
              <span>{[list.address, list.location, list.phone].filter(Boolean).map((value, index) => <span key={`${list._id}-${index}`}>{index > 0 && <br />}{value}</span>)}</span>
            </div>
            <small>Submitted by {list.userId?.username || list.name} · <span className={styles.viewCount} aria-label={`${list.views || 0} views`}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></svg>
              {list.views || 0}
            </span> · <span className={styles.likeCount} aria-label={`${list.likes || 0} likes`}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.7c0 5.2-8.8 10.1-8.8 10.1S3.2 13.9 3.2 8.7A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.5Z" /></svg>
              {list.likes || 0}
            </span></small>
          </a>
        ))}
      </div>}
      {loading && <p className={styles.loading}>Loading more listings...</p>}
      {!loading && hasMore && <div ref={loadMoreRef} className={styles.loadMore} aria-hidden="true" />}
      {!loading && !hasMore && total > 0 && <p className={styles.endMessage}>You’ve reached the end of the directory.</p>}
    </Container>
  )
}
