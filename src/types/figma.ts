export interface FastMetrics {
  pageCount: number
  frameCount: number
  componentCount: number
  complexityScore: number
}

export interface DeepMetrics {
  jsonSizeMB: number
  nodeCount: number
  estimatedRamMB: number
  fetchedAt: number | null
}

export interface BranchInfo {
  branchKey: string
  name: string
  estimatedRamMB: number | null
  lastModified: string | null
}

export interface FileData {
  key: string
  name: string
  thumbnail_url: string
  last_modified: string
  isLibrary: boolean
  branches: BranchInfo[]
  fastMetrics: FastMetrics | null
  deepMetrics: DeepMetrics | null
  loadingFast: boolean
  loadingDeep: boolean
  errorFast: string | null
  errorDeep: string | null
}

export interface ProjectData {
  projectId: string
  projectName: string
  files: FileData[]
  expanded: boolean
  metricsLoaded: boolean
}
