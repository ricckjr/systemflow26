import React from 'react'

type Props = { children: React.ReactNode, fallback?: React.ReactNode }
type State = { hasError: boolean }

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch() {}
  render() {
    if (this.state.hasError) {
      return this.props.fallback || <div className="p-6 text-center text-sm text-red-400">Falha ao carregar módulo.</div>
    }
    return this.props.children
  }
}
