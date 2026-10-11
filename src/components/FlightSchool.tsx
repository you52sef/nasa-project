import { useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, X } from 'lucide-react'
import { LESSONS } from '../game/lessons'
import ar from '../i18n/ar'
import en from '../i18n/en'
import { useGameStore } from '../store/gameStore'
import { useSettingsStore } from '../store/settingsStore'

type Phase = 'lesson' | 'question'

export function FlightSchool({ onClose }: { onClose: () => void }) {
  const language = useSettingsStore((state) => state.language)
  const t = language === 'ar' ? ar : en
  const completed = useGameStore((state) => state.lessonsCompleted)
  const completeLesson = useGameStore((state) => state.completeLesson)
  const [selected, setSelected] = useState(LESSONS[0])
  const [phase, setPhase] = useState<Phase>('lesson')
  const [answer, setAnswer] = useState<number | null>(null)
  const [feedback, setFeedback] = useState('')
  const BackIcon = language === 'ar' ? ArrowRight : ArrowLeft
  const answers = selected.postOptions[language]

  const chooseLesson = (id: number) => {
    const lesson = LESSONS.find((item) => item.id === id)
    if (!lesson) return
    setSelected(lesson)
    setPhase('lesson')
    setAnswer(null)
    setFeedback('')
  }

  const continueQuiz = () => {
    if (answer !== selected.postAnswer) {
      setFeedback(t.flightSchoolRetry)
      return
    }
    try {
      completeLesson(selected.id)
      setFeedback(t.correct)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Could not save lesson progress.')
    }
  }

  const finishLesson = () => {
    const nextLesson = LESSONS.find((lesson) => lesson.id > selected.id && !completed.includes(lesson.id))
    if (nextLesson) chooseLesson(nextLesson.id)
    else onClose()
  }

  return (
    <div className="modal-backdrop">
      <section role="dialog" aria-modal="true" aria-labelledby="school-title" className="modal-card max-w-3xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow"><BookOpen size={13} /> FLIGHT SCHOOL · {completed.length}/6</p>
            <h2 id="school-title" className="mt-2 text-2xl font-black text-white">{t.lessons}</h2>
          </div>
          <button type="button" onClick={onClose} className="icon-button" aria-label={t.close}><X size={17} /></button>
        </div>
        <div className="grid gap-5 md:grid-cols-[200px_1fr]">
          <nav className="grid grid-cols-2 gap-2 md:flex md:flex-col">
            {LESSONS.map((lesson) => (
              <button key={lesson.id} type="button" onClick={() => chooseLesson(lesson.id)} className={`flex items-center gap-2 rounded-xl border p-2.5 text-start text-xs transition ${selected.id === lesson.id ? 'border-sky-200/30 bg-sky-100/[0.07] text-white' : 'border-white/[0.06] bg-white/[0.02] text-slate-400'}`}>
                {completed.includes(lesson.id) ? <CheckCircle2 size={14} className="text-emerald-300" /> : <span className="w-[14px] text-slate-600">{String(lesson.id).padStart(2, '0')}</span>}
                <span className="truncate">{lesson.title[language]}</span>
              </button>
            ))}
          </nav>

          <div className="min-h-[290px] rounded-2xl border border-white/[0.06] bg-slate-950/40 p-4 sm:p-5">
            <p className="eyebrow">{t.lesson} {selected.id} / 6</p>
            <h3 className="mt-2 text-xl font-black text-white">{selected.title[language]}</h3>
            {phase === 'lesson' ? (
              <>
                <p className="mt-3 text-[10px] font-bold tracking-wide text-cyan-100">{t.trainingReadingLabel}</p>
                <p className="mt-4 text-sm leading-7 text-slate-300">{selected.content[language]}</p>
                <button type="button" onClick={() => { setPhase('question'); setAnswer(null); setFeedback('') }} className="primary-button mt-6 w-full">{t.questionAfter}<BackIcon size={16} /></button>
              </>
            ) : (
              <>
                <p className="mt-5 text-sm font-bold text-slate-200">{selected.postQuestion[language]}</p>
                <div className="mt-3 grid gap-2">
                  {answers.map((option, index) => (
                    <button key={option} type="button" onClick={() => { setAnswer(index); setFeedback('') }} className={`rounded-xl border px-3 py-2.5 text-start text-xs transition ${answer === index ? 'border-sky-200/40 bg-sky-100/[0.08] text-sky-50' : 'border-white/[0.06] bg-white/[0.025] text-slate-400 hover:bg-white/[0.05]'}`}>
                      {option}
                    </button>
                  ))}
                </div>
                {feedback ? <p className={`mt-3 text-xs font-semibold ${feedback === t.correct ? 'text-emerald-300' : 'text-amber-200'}`}>{feedback}</p> : null}
                <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={feedback === t.correct ? finishLesson : continueQuiz}
                        className="primary-button flex-1"
                        disabled={answer === null}
                      >
                        {feedback === t.correct ? t.continue : t.checkAnswer}<BackIcon size={16} />
                      </button>
                    {phase === 'question' ? <button type="button" onClick={() => setPhase('lesson')} className="secondary-button">{t.lesson}</button> : null}
                  </div>
                  {feedback === t.correct ? <p className="mt-3 rounded-lg bg-emerald-300/[0.06] p-2 text-xs text-emerald-200">{t.correct}</p> : null}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
