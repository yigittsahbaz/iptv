import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT_DIR = process.cwd()
const STREAMS_DIR = path.join(ROOT_DIR, 'streams')
const CUSTOM_DIR = path.join(ROOT_DIR, 'custom')
const API_BASE = 'https://iptv-org.github.io/api'

const CONFIG = {
  excludedCountries: new Set(['TR']),
  excludedLanguages: new Set(['tur']),
  excludedFilePrefixes: ['tr'],
  rules: {
    eng: new Set(['movies', 'series', 'sports']),
    fra: new Set(['movies', 'series', 'sports', 'news', 'documentary'])
  }
}

function sanitizeHeaderValue(value) {
  return String(value || '')
    .replace(/[\r\n"]/g, '')
    .trim()
}

function isSafeHttpUrl(url, httpsOnly = false) {
  try {
    const parsed = new URL(url)
    if (httpsOnly) return parsed.protocol === 'https:'
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

function parsePlaylistContent(content, filename) {
  const lines = content.split(/\r?\n/)
  const items = []
  let current = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    if (line.startsWith('#EXTINF:')) {
      const commaIdx = line.indexOf(',')
      const attrsPart = commaIdx >= 0 ? line.slice(8, commaIdx) : line.slice(8)
      const name = commaIdx >= 0 ? line.slice(commaIdx + 1).trim() : ''

      const tvgMatch = attrsPart.match(/tvg-id="([^"]*)"/)
      const refMatch = attrsPart.match(/http-referrer="([^"]*)"/)
      const uaMatch = attrsPart.match(/http-user-agent="([^"]*)"/)

      current = {
        filename,
        tvgId: tvgMatch ? tvgMatch[1].trim() : '',
        rawName: name,
        referrer: refMatch ? sanitizeHeaderValue(refMatch[1]) : '',
        userAgent: uaMatch ? sanitizeHeaderValue(uaMatch[1]) : ''
      }
      continue
    }

    if (line.startsWith('#EXTVLCOPT:') && current) {
      const opt = line.slice('#EXTVLCOPT:'.length)
      if (opt.startsWith('http-referrer=')) {
        current.referrer = sanitizeHeaderValue(opt.slice('http-referrer='.length))
      } else if (opt.startsWith('http-user-agent=')) {
        current.userAgent = sanitizeHeaderValue(opt.slice('http-user-agent='.length))
      }
      continue
    }

    if (line.startsWith('#')) continue

    if (current && isSafeHttpUrl(line, false)) {
      items.push({ ...current, url: line })
    }
    current = null
  }

  return items
}

function parseLabelsAndQuality(rawName) {
  let title = rawName
  const labelMatch = title.match(/ \[(.*)\]$/)
  const labels = labelMatch ? labelMatch[1].split(';').map(s => s.trim()).filter(Boolean) : []
  if (labelMatch) {
    title = title.slice(0, labelMatch.index)
  }

  const qualityMatch = title.match(/ \((\d+[pi])\)$/)
  const quality = qualityMatch ? qualityMatch[1] : ''
  const resolution = quality ? parseInt(quality, 10) : 0
  if (qualityMatch) {
    title = title.slice(0, qualityMatch.index)
  }

  return {
    baseTitle: title.trim(),
    quality,
    resolution,
    isGeoBlocked: labels.includes('Geo-blocked'),
    isNot247: labels.includes('Not 24/7'),
    labels
  }
}

async function fetchJson(endpoint) {
  const res = await fetch(`${API_BASE}/${endpoint}.json`)
  if (!res.ok) {
    throw new Error(`Failed to fetch ${endpoint}.json: HTTP ${res.status}`)
  }
  return res.json()
}

function pickBestLogo(logos) {
  if (!logos || !logos.length) return ''
  const formatScore = { PNG: 3, JPEG: 2, WebP: 1, AVIF: 1, GIF: 1, APNG: 1, SVG: 0 }
  const sorted = [...logos].sort((a, b) => {
    const fa = formatScore[a.format] ?? 0
    const fb = formatScore[b.format] ?? 0
    if (fb !== fa) return fb - fa
    const sa = Math.abs(512 - (a.width || 0)) + Math.abs(512 - (a.height || 0))
    const sb = Math.abs(512 - (b.width || 0)) + Math.abs(512 - (b.height || 0))
    return sa - sb
  })
  const best = sorted[0]
  return best && isSafeHttpUrl(best.url, false) ? best.url : ''
}

function buildGroupTitle(matchedLangs, matchedCats) {
  const langPrefix = matchedLangs.includes('eng') && matchedLangs.includes('fra')
    ? 'EN/FR'
    : matchedLangs.includes('eng')
      ? 'EN'
      : 'FR'

  if (matchedCats.includes('sports')) return `${langPrefix} | Sports`
  if (matchedCats.includes('movies') || matchedCats.includes('series')) {
    return `${langPrefix} | Movies & Series`
  }
  if (matchedCats.includes('documentary')) return `${langPrefix} | Documentary`
  if (matchedCats.includes('news')) return `${langPrefix} | News`
  return `${langPrefix} | Other`
}

function scoreStream(s) {
  return [
    s.isGeoBlocked ? 0 : 1,
    s.url.startsWith('https://') ? 1 : 0,
    s.isNot247 ? 0 : 1,
    s.isMainFeed ? 1 : 0,
    s.resolution
  ]
}

function compareScores(a, b) {
  const sa = scoreStream(a)
  const sb = scoreStream(b)
  for (let i = 0; i < sa.length; i++) {
    if (sb[i] !== sa[i]) return sb[i] - sa[i]
  }
  return 0
}

function formatM3U(entries) {
  const lines = ['#EXTM3U']
  for (const s of entries) {
    let extinf = `#EXTINF:-1 tvg-id="${s.tvgId}"`
    if (s.logo) extinf += ` tvg-logo="${s.logo}"`
    if (s.referrer) extinf += ` http-referrer="${s.referrer}"`
    if (s.userAgent) extinf += ` http-user-agent="${s.userAgent}"`
    extinf += ` group-title="${s.groupTitle}",${s.displayTitle}`
    lines.push(extinf)

    if (s.referrer) lines.push(`#EXTVLCOPT:http-referrer=${s.referrer}`)
    if (s.userAgent) lines.push(`#EXTVLCOPT:http-user-agent=${s.userAgent}`)
    lines.push(s.url)
  }
  return lines.join('\r\n') + '\r\n'
}

async function main() {
  console.log('Downloading iptv-org metadata...')
  const [channelsArr, feedsArr, blocklistArr, logosArr] = await Promise.all([
    fetchJson('channels'),
    fetchJson('feeds'),
    fetchJson('blocklist'),
    fetchJson('logos')
  ])

  const channels = new Map(channelsArr.map(c => [c.id, c]))
  const feeds = new Map(feedsArr.map(f => [`${f.channel}@${f.id}`, f]))
  const blocklist = new Set(blocklistArr.map(b => b.channel))
  const logosByChannel = new Map()
  for (const logo of logosArr) {
    if (!logosByChannel.has(logo.channel)) logosByChannel.set(logo.channel, [])
    logosByChannel.get(logo.channel).push(logo)
  }

  const files = (await fs.readdir(STREAMS_DIR))
    .filter(f => f.endsWith('.m3u'))
    .filter(f => !CONFIG.excludedFilePrefixes.some(p => f === `${p}.m3u` || f.startsWith(`${p}_`)))
    .sort()

  const candidates = []
  for (const file of files) {
    const content = await fs.readFile(path.join(STREAMS_DIR, file), 'utf8')
    const parsed = parsePlaylistContent(content, file)

    for (const item of parsed) {
      if (!item.tvgId) continue
      const [channelId, feedId] = item.tvgId.split('@')
      const channel = channels.get(channelId)
      if (!channel) continue
      if (channel.is_nsfw) continue
      if (blocklist.has(channelId)) continue
      if (CONFIG.excludedCountries.has(channel.country)) continue

      const feed = feedId ? feeds.get(`${channelId}@${feedId}`) : null
      const feedLangs = feed?.languages || []
      if (feedLangs.some(lang => CONFIG.excludedLanguages.has(lang))) continue

      const channelCats = channel.categories || []
      const matchedLangs = []
      const matchedCats = new Set()

      for (const [lang, allowedCats] of Object.entries(CONFIG.rules)) {
        if (!feedLangs.includes(lang)) continue
        const hits = channelCats.filter(c => allowedCats.has(c))
        if (hits.length > 0) {
          matchedLangs.push(lang)
          hits.forEach(h => matchedCats.add(h))
        }
      }

      if (matchedLangs.length === 0) continue

      const meta = parseLabelsAndQuality(item.rawName)
      const groupTitle = buildGroupTitle(matchedLangs, [...matchedCats])
      const logo = pickBestLogo(logosByChannel.get(channelId))

      let displayTitle = channel.name
      if (feed && !feed.is_main && feed.name) {
        displayTitle += ` ${feed.name}`
      }
      if (meta.quality) displayTitle += ` (${meta.quality})`
      if (meta.labels.length) displayTitle += ` [${meta.labels.join(';')}]`

      candidates.push({
        channelId,
        channelName: channel.name,
        tvgId: item.tvgId,
        displayTitle,
        groupTitle,
        logo,
        referrer: item.referrer,
        userAgent: item.userAgent,
        url: item.url,
        isMainFeed: Boolean(feed?.is_main),
        ...meta
      })
    }
  }

  const pickBestPerChannel = list => {
    const byChannel = new Map()
    for (const entry of list) {
      if (!byChannel.has(entry.channelId)) byChannel.set(entry.channelId, [])
      byChannel.get(entry.channelId).push(entry)
    }

    const best = []
    for (const group of byChannel.values()) {
      group.sort(compareScores)
      best.push(group[0])
    }

    best.sort((a, b) => {
      const g = a.groupTitle.localeCompare(b.groupTitle)
      if (g !== 0) return g
      return a.channelName.localeCompare(b.channelName)
    })

    return best
  }

  const allBest = pickBestPerChannel(candidates)
  const httpsBest = pickBestPerChannel(candidates.filter(c => c.url.startsWith('https://')))

  await fs.mkdir(CUSTOM_DIR, { recursive: true })
  await fs.writeFile(path.join(CUSTOM_DIR, 'playlist.m3u'), formatM3U(allBest), 'utf8')
  await fs.writeFile(path.join(CUSTOM_DIR, 'playlist-https.m3u'), formatM3U(httpsBest), 'utf8')

  const summarize = list => {
    const counts = {}
    for (const item of list) {
      counts[item.groupTitle] = (counts[item.groupTitle] || 0) + 1
    }
    return counts
  }

  console.log(`Generated custom/playlist.m3u (${allBest.length} channels):`, summarize(allBest))
  console.log(
    `Generated custom/playlist-https.m3u (${httpsBest.length} channels):`,
    summarize(httpsBest)
  )
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
