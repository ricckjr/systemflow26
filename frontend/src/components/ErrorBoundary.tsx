import React from 'react'

type Props = { children: React.ReactNode, fallback?: React.ReactNode }
type State = { hasError: boolean, message?: string }

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error: any) {
    try {
      const msg = String(error?.message || error || '')
      if (msg) this.setState({ message: msg })
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
    } catch {
    }
  }
  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      const details = import.meta?.env?.DEV ? this.state.message : null
      return (
        <div className="p-6 text-center space-y-2">
          <div className="text-sm text-red-400">Falha ao carregar módulo.</div>
          {details ? <div className="text-xs text-slate-500 break-words">{details}</div> : null}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-200 text-xs font-bold hover:bg-white/10 transition-colors"
          >
            Recarregar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
