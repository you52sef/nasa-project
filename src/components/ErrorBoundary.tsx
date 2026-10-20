import { Component } from 'react'
import type { ReactNode } from 'react'

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="mission-recovery-screen" role="alert">
          <section className="mission-recovery-card">
            <span className="mission-recovery-icon" aria-hidden="true">!</span>
            <p className="mission-recovery-eyebrow">MISSION SYSTEM RECOVERY</p>
            <h1>Mission console paused</h1>
            <p>The dashboard encountered an unexpected condition. Reload to restore the last saved mission state.</p>
            <button type="button" onClick={() => window.location.reload()}>
              Reload mission
            </button>
            <p lang="ar" dir="rtl">حدثت مشكلة غير متوقعة. أعد تحميل الصفحة لاستعادة آخر حالة محفوظة للمهمة.</p>
          </section>
        </main>
      )
    }
    return this.props.children
  }
}
