import { useEffect, useRef, useState } from 'react'
import { apiFetch, apiUrl } from '../api'
import { rankLists } from '../utils/listRanking'
import styles from './Hero.module.css'

export function Hero() {
  const [listings, setListings] = useState([])
  const [activeSlide, setActiveSlide] = useState(0)
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)

  const featured = listings[activeSlide] || null

  const handleTouchStart = (event) => {
    touchStartX.current = event.touches[0].clientX
    touchStartY.current = event.touches[0].clientY
  }

  const handleTouchEnd = (event) => {
    if (touchStartX.current === null || touchStartY.current === null || listings.length < 2) return
    const deltaX = event.changedTouches[0].clientX - touchStartX.current
    const deltaY = event.changedTouches[0].clientY - touchStartY.current
    touchStartX.current = null
    touchStartY.current = null
    if (Math.abs(deltaX) < 50 || Math.abs(deltaX) <= Math.abs(deltaY)) return
    event.preventDefault()
    setActiveSlide((current) => (current + (deltaX < 0 ? 1 : -1) + listings.length) % listings.length)
  }

  useEffect(() => {
    apiFetch('/api/lists')
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load featured listing')
        return response.json()
      })
      .then((lists) => setListings(rankLists(lists.filter((list) => list.user_is_active !== false && list.admin_is_active !== false && list.is_Premium))))
      .catch(() => setListings([]))
  }, [])

  return (
    <section className={styles.hero} id="top">
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}><span /> A directory for the discerning</p>
        <h1>{featured ? <span>{featured.itemName}</span> : <>Find places</>}</h1>
        <div className={styles.intro} dangerouslySetInnerHTML={{ __html: featured?.message || 'A considered collection of independent spaces, thoughtful makers, and things that make a city feel like home.' }} />
        <a className={styles.scrollLink} href="#categories">
          <span className={styles.scrollIcon}>↓</span>
          Explore the directory
        </a>
      </div>
      <div
        className={styles.heroVisual}
        aria-label="Featured directory city"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className={styles.sun} />
        {featured ? (
          <a className={styles.featuredLink} href={`/lists/${featured._id}`} aria-label={`View details for ${featured.itemName}`}>
            <div className={styles.arch}>
            {featured?.photos?.[0]?.url ? (
              <img className={styles.archImage} src={apiUrl(featured.photos[0].url)} alt={featured.itemName} />
            ) : (
              <div className={styles.archImage} />
            )}
            {listings.length <= 1 && <div className={styles.archLabel}>01 / 01</div>}
            </div>
          </a>
        ) : (
          <div className={styles.arch}>
            <div className={styles.archImage} />
          </div>
        )}
        {listings.length > 1 && <div className={styles.heroControls}>
        <button type="button" onClick={() => setActiveSlide((activeSlide - 1 + listings.length) % listings.length)} aria-label="Previous listing">←</button>
        <span>{String(activeSlide + 1).padStart(2, '0')} / {String(listings.length).padStart(2, '0')}</span>
        <button type="button" onClick={() => setActiveSlide((activeSlide + 1) % listings.length)} aria-label="Next listing">→</button>
        </div>}
        {featured ? (
          <a className={styles.locationCard} href={`/lists/${featured._id}`}>
            <span>Featured premium listing</span>
            <strong>{featured.itemName}</strong>
            {featured.location && <small>{featured.location}</small>}
          </a>
        ) : (
          <div className={styles.locationCard}>
            <span>Featured today</span>
            <strong>No listing yet</strong>
            <small>Submit a premium listing to be featured</small>
          </div>
        )}
      </div>
    </section>
  )
}
