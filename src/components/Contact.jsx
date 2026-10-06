import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import { RichTextEditor } from './RichTextEditor'
import { eventSubcategories } from '../data/eventSubcategories'
import styles from './Contact.module.css'

export function Contact() {
  const [submitted, setSubmitted] = useState(false)
  const [itemTypes, setItemTypes] = useState([])
  const [locations, setLocations] = useState([])
  const [itemType, setItemType] = useState('')
  const [itemTypeId, setItemTypeId] = useState('')
  const [city, setCity] = useState('')
  const [otherCity, setOtherCity] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [message, setMessage] = useState('')
  const [otherItemType, setOtherItemType] = useState('')
  const [eventSubcategory, setEventSubcategory] = useState('')
  const [availableEventSubcategories, setAvailableEventSubcategories] = useState(eventSubcategories)
  const isEvent = /\bevents?\b/i.test(itemType === 'other' ? otherItemType : itemType)
  const isLoggedIn = Boolean(localStorage.getItem('listToken'))

  useEffect(() => {
    apiFetch('/api/menu?active=true&menuType=left_menu')
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load item types')
        return response.json()
      })
      .then((items) => setItemTypes(items))
      .catch(() => setItemTypes([]))
    apiFetch('/api/locations')
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load locations')
        return response.json()
      })
      .then((items) => setLocations(items))
      .catch(() => setLocations([]))
    apiFetch('/api/event-subcategories')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load event subcategories')))
      .then((items) => setAvailableEventSubcategories(items.map((item) => item.label)))
      .catch(() => setAvailableEventSubcategories(eventSubcategories))
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccessMessage('')
    const token = localStorage.getItem('listToken')
    if (!token) {
      setError('Please register or log in before submitting a list.')
      return
    }
    const response = await apiFetch('/api/lists', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: new FormData(event.currentTarget),
    })
    if (response.ok) {
      setSubmitted(true)
      const result = await response.json()
      setSuccessMessage(result.message || 'Your listing is under admin approval.')
      event.currentTarget.reset()
      setItemType('')
      setItemTypeId('')
      setCity('')
      setOtherCity('')
      setOtherItemType('')
      setEventSubcategory('')
      setMessage('')
    } else {
      const result = await response.json()
      setError(result.error || 'Unable to submit your list.')
    }
  }

  return (
    <section className={styles.contact} id="contact">
      <div className={styles.contactIntro}>
        <p className={styles.kicker}>Add to the map</p>
        <h2>Know somewhere<br /><em>special?</em></h2>
        <p>We’re always looking for the next good place. Tell us about a space, maker, or hidden corner we should know.</p>
      </div>
      <form className={styles.form} onSubmit={handleSubmit}>
        <fieldset className={styles.formFields} disabled={!isLoggedIn}>
          <label>
            Item name
            <input required type="text" name="itemName" placeholder="The name of your item" />
          </label>
          <label>
            Type
            <select required name="itemTypeId" value={itemTypeId} onChange={(event) => {
              const selected = itemTypes.find((item) => item._id === event.target.value)
              setItemTypeId(event.target.value)
              setItemType(selected?.label || '')
            }}>
              <option value="" disabled>Select a type</option>
              {itemTypes.map((item) => <option value={item._id} key={item._id || item.label}>{item.label}</option>)}
              <option value="other">Other</option>
            </select>
            <input type="hidden" name="itemType" value={itemType} />
          </label>
          {isEvent && <>
            <label>
              Event subcategory
              <select required name="eventSubcategory" value={eventSubcategory} onChange={(event) => setEventSubcategory(event.target.value)}>
                <option value="" disabled>Select a subcategory</option>
                {availableEventSubcategories.map((subcategory) => <option value={subcategory} key={subcategory}>{subcategory}</option>)}
              </select>
            </label>
            <label>
              From date
              <input required type="date" name="startDate" min={new Date().toISOString().slice(0, 10)} />
            </label>
            <label>
              To date
              <input required type="date" name="endDate" min={new Date().toISOString().slice(0, 10)} />
            </label>
          </>}
          {itemType === 'other' && <label>
            Other type
            <input required type="text" name="otherItemType" value={otherItemType} onChange={(event) => setOtherItemType(event.target.value)} placeholder="Describe the type" />
          </label>}
          <label>
            Address (optional)
            <input type="text" name="address" placeholder="Street address" />
          </label>
          <label>
            City
            <select required name="location" value={city} onChange={(event) => setCity(event.target.value)}>
              <option value="" disabled>Select a city</option>
              {locations.map((location) => <option value={location.name} key={location._id}>{location.name}</option>)}
              <option value="__other__">Other city</option>
            </select>
          </label>
          {city === '__other__' && <label>
            Other city
            <input required type="text" name="otherCity" value={otherCity} onChange={(event) => setOtherCity(event.target.value)} maxLength="100" placeholder="Enter a city" />
          </label>}
          <label>
            Phone number
            <input required type="tel" name="phone" pattern="^\+?[0-9][0-9\s().-]{6,24}$" title="Enter a valid phone number with 7 to 15 digits." placeholder="+1 555 123 4567" />
          </label>
          <label>
            URL (optional)
            <input type="text" name="url" inputMode="url" autoCapitalize="none" placeholder="example.com" />
          </label>
          <label>
            Instagram (optional)
            <input type="text" name="instagram" inputMode="url" autoCapitalize="none" placeholder="@your-account or instagram.com/your-account" />
          </label>
          <label>
            Photos
            <input type="file" name="photos" accept="image/*" multiple />
          </label>
          <label>
            Why does it matter?
            <RichTextEditor value={message} onChange={setMessage} placeholder="A few words about what makes it special..." />
            <input type="hidden" name="message" value={message} required />
          </label>
          {isLoggedIn && <button className={styles.submitButton} type="submit">
            {submitted ? 'Thanks for sharing!' : 'Send it our way'}
            <span aria-hidden="true">↗</span>
          </button>}
        </fieldset>
        {!isLoggedIn && <p className={styles.authPrompt}><a href="/register">Register</a> or <a href="/login">log in</a> to submit your list.</p>}
        {successMessage && <p className={styles.success}>{successMessage}</p>}
        {error && <p className={styles.error}>
          {error.includes('register or log in') ? <><a href="/register">Register</a> or <a href="/login">log in</a> to continue.</> : error}
        </p>}
      </form>
    </section>
  )
}
