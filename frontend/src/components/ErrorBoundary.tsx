import React from 'react'
import { logError } from '@/utils/logger'

type Props = { children: React.ReactNode, fallback?: React.ReactNode }
type State = { hasError: boolean, message?: string, details?: string }

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(error: any) {
    const msg = String(error?.message || error || '')
    return { hasError: true, message: msg }
  }
  componentDidCatch(error: any, info: any) {
    logError('ErrorBoundary', 'Erro não tratado na UI', { error, info })
    try {
      const msg = String(error?.message || error || '')
      const details = import.meta?.env?.DEV ? String(info?.componentStack || '').trim() || undefined : undefined
      if (msg || details) this.setState({ message: msg || undefined, details })
      const isChunkError =
        msg.includes('ChunkLoadError') ||
        msg.includes('Loading chunk') ||
        msg.includes('Failed to fetch dynamically imported module')

      if (isChunkError) {
        const key = 'sf_chunk_reload_once'
        if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
          const already = sessionStorage.getItem(key) === '1'
          if (!already) {
            sessionStorage.setItem(key, '1')
            window.location.reload()
          }
        }
      }
    } catch (e: any) {
      logError('ErrorBoundary', 'Falha ao tratar erro da UI', e)
    }
  }
  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      const msg = String(this.state.message || '').trim()
      const isChunkError =
        msg.includes('ChunkLoadError') ||
        msg.includes('Loading chunk') ||
        msg.includes('Failed to fetch dynamically imported module')
      const details = import.meta?.env?.DEV ? (this.state.details || msg || null) : null
      return (
        <div className="p-6 text-center space-y-2">
          <div className="text-sm text-red-400">{isChunkError ? 'Falha ao carregar módulo.' : 'Ocorreu um erro nesta tela.'}</div>
          {details ? <div className="text-xs text-[var(--text-muted)] break-words">{details}</div> : null}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-soft)] text-xs font-bold hover:bg-white/10 transition-colors"
          >
            Recarregar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
