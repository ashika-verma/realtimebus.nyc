import React from 'react'

interface Props {
  children: React.ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
          style={{ backgroundColor: 'lightseagreen' }}
        >
          <p className="text-white font-semibold text-lg">Something went wrong</p>
          <p className="text-white/70 text-sm mt-1 mb-6">{this.state.error.message}</p>
          <button
            className="bg-white text-teal-700 font-semibold text-sm px-5 py-2 rounded-full"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
