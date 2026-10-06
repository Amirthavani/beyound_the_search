import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import styles from './VisitorPreferences.module.css'

const getStoredPreferences = () => {
  try {
    const preferences = JSON.parse(localStorage.getItem('visitorPreferences') || 'null')
    return preferences && typeof preferences === 'object' && !Array.isArray(preferences) ? preferences : {}
  } catch {
    return {}
  }
}
const preferenceValues = (preferences, pluralKey, singularKey) => {
  const pluralValues = Array.isArray(preferences[pluralKey])
    ? preferences[pluralKey]
    : typeof preferences[pluralKey] === 'string' ? [preferences[pluralKey]] : []
  const singularValue = typeof preferences[singularKey] === 'string' ? [preferences[singularKey]] : []
  return [...new Set([...pluralValues, ...singularValue].map((value) => String(value || '').trim()).filter(Boolean))]
}
const mergeLocations = (items, selectedNames) => {
  const names = new Set(items.map((item) => item.name))
  return [...items, ...selectedNames.filter((name) => !names.has(name)).map((name) => ({ _id: name, name }))]
}

export function VisitorPreferences({ onComplete }) {
  const [initialPreferences] = useState(getStoredPreferences)
  const [interests, setInterests] = useState([])
  const [zipCode, setZipCode] = useState(() => String(initialPreferences.zipCode || '').replace(/\D/g, '').slice(0, 5))
  const [selectedLocations, setSelectedLocations] = useState(() => preferenceValues(initialPreferences, 'locations', 'location'))
  const [selectedInterests, setSelectedInterests] = useState(() => preferenceValues(initialPreferences, 'interests', 'interest'))
  const [locations, setLocations] = useState(() => {
    const savedZipCode = String(initialPreferences.zipCode || '').trim()
    return /^\d{5}$/.test(savedZipCode)
      ? []
      : preferenceValues(initialPreferences, 'locations', 'location').map((name) => ({ _id: name, name }))
  })
  const [error, setError] = useState('')
  const [loadingLocations, setLoadingLocations] = useState(() => /^\d{5}$/.test(String(initialPreferences.zipCode || '').trim()))

  useEffect(() => {
    apiFetch('/api/menu?active=true&menuType=left_menu')
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load interests')
        return response.json()
      })
      .then((items) => setInterests([...new Set([
        ...items.map((item) => item.label).filter(Boolean),
        ...preferenceValues(initialPreferences, 'interests', 'interest'),
      ])]))
      .catch(() => setInterests(preferenceValues(initialPreferences, 'interests', 'interest')))
  }, [initialPreferences])

  useEffect(() => {
    const savedLocations = preferenceValues(initialPreferences, 'locations', 'location')
    const savedZipCode = String(initialPreferences.zipCode || '').trim()
    if (!/^\d{5}$/.test(savedZipCode)) return undefined

    let cancelled = false
    apiFetch(`/api/locations/nearby?zip=${encodeURIComponent(savedZipCode)}`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to find nearby cities.')))
      .then((items) => {
        if (!cancelled) setLocations(mergeLocations(items, savedLocations))
      })
      .catch(() => {
        if (!cancelled) setLocations(savedLocations.map((name) => ({ _id: name, name })))
      })
      .finally(() => {
        if (!cancelled) setLoadingLocations(false)
      })
    return () => {
      cancelled = true
    }
  }, [initialPreferences])

  const findLocations = async (event) => {
    event.preventDefault()
    setError('')
    if (!/^\d{5}$/.test(zipCode.trim())) {
      setError('Please enter a valid 5-digit ZIP code.')
      return
    }
    setLoadingLocations(true)
    try {
      const response = await apiFetch(`/api/locations/nearby?zip=${encodeURIComponent(zipCode.trim())}`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to find nearby cities.')
      setLocations(mergeLocations(result, selectedLocations))
    } catch (reason) {
      setLocations([])
      setError(reason.message)
    } finally {
      setLoadingLocations(false)
    }
  }

  const submit = (event) => {
    event.preventDefault()
    if (selectedLocations.length === 0 || selectedInterests.length === 0) {
      setError('Please select at least one city and one interest to continue.')
      return
    }
    const preferences = { zipCode: zipCode.trim(), locations: selectedLocations, interests: selectedInterests }
    localStorage.setItem('visitorPreferences', JSON.stringify(preferences))
    onComplete(preferences)
  }

  const toggleSelection = (value, selected, setSelected) => {
    setSelected((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.kicker}>Welcome to Beyond The Searches</p>
        <h1>Let’s make your search more local.</h1>
        <p className={styles.description}>Tell us where you are and what you are interested in so we can show you more relevant places.</p>
        <form onSubmit={submit}>
          <fieldset>
            <legend>Find cities near you</legend>
            <div className={styles.zipForm}>
              <input
                type="text"
                inputMode="numeric"
                maxLength="5"
                pattern="\d{5}"
                value={zipCode}
                onChange={(event) => setZipCode(event.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="Enter ZIP code"
                aria-label="ZIP code"
              />
              <button type="button" onClick={findLocations} disabled={loadingLocations}>
                {loadingLocations ? 'Finding...' : 'Find cities'}
              </button>
            </div>
            {locations.length > 0 && <div className={styles.options}>
              {locations.map((item) => (
                <label className={styles.option} key={item._id || item.name}>
                  <input type="checkbox" checked={selectedLocations.includes(item.name)} onChange={() => toggleSelection(item.name, selectedLocations, setSelectedLocations)} />
                  <span>{item.name}</span>
                </label>
              ))}
            </div>}
          </fieldset>
          <fieldset>
            <legend>Interest</legend>
            <div className={styles.options}>
              {interests.map((item) => (
                <label className={styles.option} key={item}>
                  <input type="checkbox" checked={selectedInterests.includes(item)} onChange={() => toggleSelection(item, selectedInterests, setSelectedInterests)} />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit">Enter the site <span aria-hidden="true">↗</span></button>
        </form>
      </section>
    </main>
  )
}
