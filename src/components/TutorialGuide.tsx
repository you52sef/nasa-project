import { CheckCircle2, GraduationCap, Circle } from 'lucide-react'
import type { TutorialStep } from '../game/model'
import { TUTORIAL_STEPS } from '../game/model'
import ar from '../i18n/ar'
import en from '../i18n/en'

type TutorialCopyKey =
  | 'tutorialStepForecast' | 'tutorialHintForecast'
  | 'tutorialStepMaintenance' | 'tutorialHintMaintenance'
  | 'tutorialStepGreenhouse' | 'tutorialHintGreenhouse'
  | 'tutorialStepRest' | 'tutorialHintRest'
  | 'tutorialStepResearch' | 'tutorialHintResearch'
  | 'tutorialWhyForecast' | 'tutorialCheckForecast'
  | 'tutorialWhyMaintenance' | 'tutorialCheckMaintenance'
  | 'tutorialWhyGreenhouse' | 'tutorialCheckGreenhouse'
  | 'tutorialWhyRest' | 'tutorialCheckRest'
  | 'tutorialWhyResearch' | 'tutorialCheckResearch'

const stepCopy: Record<TutorialStep, { title: TutorialCopyKey; hint: TutorialCopyKey; why: TutorialCopyKey; check: TutorialCopyKey }> = {
  forecast: { title: 'tutorialStepForecast', hint: 'tutorialHintForecast', why: 'tutorialWhyForecast', check: 'tutorialCheckForecast' },
  maintenance: { title: 'tutorialStepMaintenance', hint: 'tutorialHintMaintenance', why: 'tutorialWhyMaintenance', check: 'tutorialCheckMaintenance' },
  greenhouse: { title: 'tutorialStepGreenhouse', hint: 'tutorialHintGreenhouse', why: 'tutorialWhyGreenhouse', check: 'tutorialCheckGreenhouse' },
  rest: { title: 'tutorialStepRest', hint: 'tutorialHintRest', why: 'tutorialWhyRest', check: 'tutorialCheckRest' },
  research: { title: 'tutorialStepResearch', hint: 'tutorialHintResearch', why: 'tutorialWhyResearch', check: 'tutorialCheckResearch' },
}

export function TutorialGuide({ completed, language }: { completed: TutorialStep[]; language: 'ar' | 'en' }) {
  const t = language === 'ar' ? ar : en
  const currentIndex = completed.length
  const currentStep = TUTORIAL_STEPS[currentIndex]
  const progress = completed.length / TUTORIAL_STEPS.length * 100

  return (
    <section className="tutorial-guide mb-4 rounded-2xl border border-cyan-200/15 bg-gradient-to-br from-cyan-950/35 via-slate-950/75 to-indigo-950/35 p-4 sm:p-5" aria-label={t.tutorialTitle}>
      <div className="flex items-start gap-3">
        <div className="tutorial-guide-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-200/10 text-cyan-100"><GraduationCap size={20} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-black text-cyan-50">{t.tutorialTitle}</h2>
            <span className="text-[10px] font-semibold text-cyan-100/75">{t.tutorialProgress} · {completed.length}/{TUTORIAL_STEPS.length}</span>
          </div>
          <p className="mt-1 text-xs leading-6 text-slate-300">{currentStep ? t.tutorialIntro : t.tutorialDone}</p>
          <div
            className="tutorial-progress mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]"
            role="progressbar"
            aria-label={t.tutorialProgress}
            aria-valuemin={0}
            aria-valuemax={TUTORIAL_STEPS.length}
            aria-valuenow={completed.length}
          >
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-sky-400 transition-[width] duration-500" style={{ width: `${progress}%` }} />
          </div>
          {currentStep ? (
            <div className="tutorial-current-step mt-3 rounded-xl border border-cyan-100/10 bg-slate-950/45 p-3 sm:p-4" aria-live="polite">
              <p className="eyebrow text-cyan-200/70">{t.tutorialStepOf} {currentIndex + 1} / {TUTORIAL_STEPS.length}</p>
              <h3 className="mt-2 text-sm font-bold text-white">{t[stepCopy[currentStep].title]}</h3>
              <p className="mt-1 text-xs leading-6 text-slate-300">{t[stepCopy[currentStep].hint]}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <p className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-2.5 text-[11px] leading-5 text-slate-400">
                  <span className="mb-1 block font-bold tracking-wide text-sky-200">{t.tutorialWhyLabel}</span>
                  {t[stepCopy[currentStep].why]}
                </p>
                <p className="rounded-lg border border-emerald-200/[0.09] bg-emerald-200/[0.025] p-2.5 text-[11px] leading-5 text-slate-400">
                  <span className="mb-1 block font-bold tracking-wide text-emerald-200">{t.tutorialCheckLabel}</span>
                  {t[stepCopy[currentStep].check]}
                </p>
              </div>
            </div>
          ) : null}
          <ol className="mt-3 grid gap-2 sm:grid-cols-2">
            {TUTORIAL_STEPS.map((step, index) => {
              const isComplete = completed.includes(step)
              const isCurrent = step === currentStep
              const Icon = isComplete ? CheckCircle2 : Circle
              return (
                <li
                  key={step}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`tutorial-step flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[11px] ${isCurrent ? 'border-cyan-200/20 bg-cyan-100/[0.08] text-cyan-50' : isComplete ? 'border-emerald-200/10 text-emerald-200' : 'border-transparent text-slate-500'}`}
                >
                  <Icon size={14} className="shrink-0" aria-hidden="true" />
                  <span>{index + 1}. {t[stepCopy[step].title]}</span>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}
