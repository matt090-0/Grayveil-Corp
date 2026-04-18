import { useEffect } from 'react'

const SITE_URL = 'https://grayveil.net'
const DEFAULT_OG = '/brand/banner.png'

function upsertMeta(attr, key, value) {
  if (value == null) return
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', value)
}

function upsertLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export function useSeo({ title, description, ogImage, path } = {}) {
  useEffect(() => {
    if (title) document.title = title
    upsertMeta('name', 'description', description)
    upsertMeta('property', 'og:title', title)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:image', ogImage || DEFAULT_OG)
    upsertMeta('name', 'twitter:title', title)
    upsertMeta('name', 'twitter:description', description)
    upsertMeta('name', 'twitter:image', ogImage || DEFAULT_OG)
    if (path) {
      const url = SITE_URL + path
      upsertMeta('property', 'og:url', url)
      upsertLink('canonical', url)
    }
  }, [title, description, ogImage, path])
}

export function useJsonLd(data) {
  const serialized = JSON.stringify(data)
  useEffect(() => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.text = serialized
    document.head.appendChild(script)
    return () => {
      if (script.parentNode) script.parentNode.removeChild(script)
    }
  }, [serialized])
}
