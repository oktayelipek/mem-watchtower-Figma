const BASE = 'https://api.figma.com/v1'

async function figmaFetch(token: string, path: string): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as Record<string, string>).message ?? `HTTP ${res.status}`)
  }
  return res
}

export async function getMe(token: string) {
  const res = await figmaFetch(token, '/me')
  return res.json()
}

export async function getTeamProjects(token: string, teamId: string) {
  const res = await figmaFetch(token, `/teams/${teamId}/projects`)
  const data = await res.json()
  return data.projects as Array<{ id: string; name: string }>
}

export async function getProjectFiles(token: string, projectId: string) {
  const res = await figmaFetch(token, `/projects/${projectId}/files`)
  const data = await res.json()
  return data.files as Array<{ key: string; name: string; thumbnail_url: string; last_modified: string }>
}

export async function getFastMetrics(token: string, fileKey: string) {
  const res = await figmaFetch(token, `/files/${fileKey}?depth=2&geometry=omit`)
  const data = await res.json()
  const doc = data.document

  let pageCount = 0
  let frameCount = 0

  if (doc?.children) {
    pageCount = doc.children.length
    for (const page of doc.children) {
      if (page.children) frameCount += page.children.length
    }
  }

  const componentCount = Object.keys(data.components ?? {}).length
  const complexityScore = pageCount * 10 + frameCount + componentCount * 2

  return { pageCount, frameCount, componentCount, complexityScore }
}

export async function getDeepMetrics(token: string, fileKey: string) {
  const res = await figmaFetch(token, `/files/${fileKey}`)
  const text = await res.text()
  const jsonSizeMB = new Blob([text]).size / 1024 / 1024

  let nodeCount = 0
  const countNodes = (node: unknown): void => {
    if (!node || typeof node !== 'object') return
    nodeCount++
    const n = node as Record<string, unknown>
    if (Array.isArray(n.children)) {
      for (const child of n.children) countNodes(child)
    }
  }

  try {
    const data = JSON.parse(text)
    countNodes(data.document)
  } catch {
    // ignore parse errors
  }

  return { jsonSizeMB, nodeCount, estimatedRamMB: jsonSizeMB * 7 }
}

export async function pLimit<T>(tasks: (() => Promise<T>)[], concurrency = 5): Promise<T[]> {
  const results: T[] = []
  let i = 0
  async function worker() {
    while (i < tasks.length) {
      const idx = i++
      results[idx] = await tasks[idx]()
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  return results
}
