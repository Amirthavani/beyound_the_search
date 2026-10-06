import { useEffect, useRef, useState } from 'react'
import { apiFetch, apiUrl } from '../api'
import { formatEventDates } from '../utils/eventDisplay'
import styles from './ListDetail.module.css'

export function ListDetail({ id }) {
  const [list, setList] = useState(null)
  const [activePhoto, setActivePhoto] = useState(0)
  const [error, setError] = useState('')
  const [liked, setLiked] = useState(() => {
    try {
      const likedLists = JSON.parse(localStorage.getItem('likedLists') || '[]')
      return Array.isArray(likedLists) && likedLists.includes(id)
    } catch {
      return false
    }
  })
  const viewedListId = useRef(null)
  const goBack = () => window.history.back()

  const likeList = async () => {
    if (liked) return
    try {
      const response = await apiFetch(`/api/lists/${id}/like`, { method: 'POST' })
      if (!response.ok) return
      const result = await response.json()
      const storedLikes = JSON.parse(localStorage.getItem('likedLists') || '[]')
      const likedLists = Array.isArray(storedLikes) ? storedLikes : []
      localStorage.setItem('likedLists', JSON.stringify([...new Set([...likedLists, id])]))
      setLiked(true)
      setList((current) => current ? { ...current, likes: result.likes } : current)
    } catch {
      setError('This list could not be liked right now.')
    }
  }

  useEffect(() => {
    apiFetch('/api/lists')
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load list')
        return response.json()
      })
      .then((items) => {
        const match = items.find((item) => item._id === id)
        if (!match) throw new Error('List not found')
        setList(match)
        if (viewedListId.current === id) return null
        viewedListId.current = id
        return apiFetch(`/api/lists/${id}/view`, { method: 'POST' })
      })
      .then((response) => {
        if (!response?.ok) return null
        return response.json()
      })
      .then((result) => {
        if (result) setList((current) => current ? { ...current, views: result.views } : current)
      })
      .catch(() => setError('This list could not be found.'))
  }, [id])

  if (error) {
    return (
      <main className={styles.detail}>
        <button type="button" className={styles.back} onClick={goBack}>← Back to previous page</button>
        <p className={styles.error}>{error}</p>
      </main>
    )
  }

  if (!list) return <main className={styles.detail}><p className={styles.loading}>Loading list...</p></main>

  const photos = list.photos || []
  const photo = photos[activePhoto]
  const itemType = list.itemType === 'other' ? list.otherItemType : list.itemType

  return (
    <main className={styles.detail}>
      <button type="button" className={styles.back} onClick={goBack}>← Back to previous page</button>
      <div className={styles.content}>
        <section className={styles.gallery} aria-label="List photos">
          <div className={styles.mainImage}>
            {photo ? <img src={apiUrl(photo.url)} alt={list.itemName} /> : <span>No photos uploaded</span>}
          </div>
          {photos.length > 1 && <div className={styles.thumbnails}>
            {photos.map((item, index) => (
              <button type="button" className={index === activePhoto ? styles.activeThumbnail : ''} onClick={() => setActivePhoto(index)} key={item.filename || item.originalName}>
                <img src={apiUrl(item.url)} alt={`${list.itemName} thumbnail ${index + 1}`} />
              </button>
            ))}
          </div>}
          {photos.length > 1 && <div className={styles.galleryControls}>
            <button type="button" onClick={() => setActivePhoto((activePhoto - 1 + photos.length) % photos.length)} aria-label="Previous image">←</button>
            <span>{activePhoto + 1} / {photos.length}</span>
            <button type="button" onClick={() => setActivePhoto((activePhoto + 1) % photos.length)} aria-label="Next image">→</button>
          </div>}
        </section>
        <section className={styles.info}>
          {list.is_Premium && <span className={styles.premium}>Premium listing</span>}
          <p className={styles.kicker}>{itemType}</p>
          {list.eventSubcategory && <p className={styles.kicker}>{list.eventSubcategory}</p>}
          <h1>{list.itemName}</h1>
          <div className={styles.engagement} aria-label="Listing engagement">
            <span className={styles.viewCount} aria-label={`${list.views || 0} views`}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></svg>
              {list.views || 0}
            </span>
            <button type="button" className={`${styles.likeButton} ${liked ? styles.liked : ''}`} onClick={likeList} disabled={liked} aria-label={liked ? 'List liked' : 'Like this list'}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.7c0 5.2-8.8 10.1-8.8 10.1S3.2 13.9 3.2 8.7A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.5Z" /></svg>
              {list.likes || 0}
            </button>
          </div>
          <div className={styles.description} dangerouslySetInnerHTML={{ __html: list.message }} />
          <dl>
            {list.location && <div><dt>City</dt><dd>{list.location}</dd></div>}
            {list.address && <div><dt>Address</dt><dd>{list.address}</dd></div>}
            {(list.startDate || list.endDate) && <div><dt>Dates</dt><dd>{formatEventDates(list.startDate, list.endDate)}</dd></div>}
            {(list.userId?.username || list.name) && <div><dt>Submitted by</dt><dd>{list.userId?.username || list.name}</dd></div>}
            {list.phone && <div><dt>Phone</dt><dd>{list.phone}</dd></div>}
            {list.url && <div><dt>URL</dt><dd><a href={list.url} target="_blank" rel="noreferrer">{list.url}</a></dd></div>}
            {list.instagram && <div><dt>Instagram</dt><dd><a href={list.instagram} target="_blank" rel="noreferrer">{list.instagram}</a></dd></div>}
          </dl>
        </section>
      </div>
    </main>
  )
}
