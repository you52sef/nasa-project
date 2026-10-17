import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpenCheck, Check, CircleAlert, Play, RotateCcw, X } from 'lucide-react'
import { useSettingsStore } from '../store/settingsStore'
import { EMPTY_ACADEMY_PROGRESS, readAcademyProgress, saveAcademyProgress, type AcademyProgress } from '../utils/academyProgress'

const LESSONS = [
  {
    title: ['ECLSS · life support', 'دعم الحياة · ECLSS'],
    theory: ['ECLSS keeps a crew alive by managing oxygen, water, food and carbon dioxide. Treat telemetry as a trend: small reserves leave little time to react.', 'يحافظ نظام دعم الحياة على الأكسجين والماء والغذاء ويزيل ثاني أكسيد الكربون. راقب اتجاه القياسات؛ فالاحتياطي المنخفض يترك وقتًا أقل للاستجابة.'],
    guided: ['Open the live O₂ and water telemetry panels. Identify the lower reserve before confirming.', 'افتح لوحتي الأكسجين والماء المباشرتين وحدد الاحتياطي الأقل قبل التأكيد.'],
    cumulative: ['Life support + reading a changing reserve: which response protects the crew first?', 'دعم الحياة + قراءة الاحتياطي: أي استجابة تحمي الطاقم أولًا؟'],
    options: [['Restore life-support operation and reassess reserves', 'أعِد تشغيل دعم الحياة وأعد تقييم الاحتياطيات'], ['Ignore O₂ until the next sleep cycle', 'تجاهل الأكسجين حتى دورة النوم التالية'], ['Spend remaining oxygen on optional research', 'استهلك الأكسجين المتبقي في بحث اختياري']],
    answer: 0,
  },
  {
    title: ['Power · load management', 'الطاقة · إدارة الأحمال'],
    theory: ['Generation, stored energy and demand must balance. Protect life-support loads first; defer productive facilities when a storm or night cuts solar output.', 'يجب موازنة التوليد والتخزين والطلب. احمِ أحمال دعم الحياة أولًا، وأوقف الإنتاج غير الضروري عند انخفاض الطاقة الشمسية.'],
    guided: ['Inspect the power and facility panels. Find a backup source and one load that could be deferred.', 'افحص لوحتي الطاقة والمنشآت وحدد مصدرًا احتياطيًا وحملًا يمكن تأجيله.'],
    cumulative: ['Using lesson 1, a storm cuts solar while O₂ is low. Which power plan preserves life support?', 'باستخدام الدرس ١، عاصفة تخفض الشمس والأكسجين منخفض. أي خطة تحمي دعم الحياة؟'],
    options: [['Use stored/reactor power for life support; shed noncritical loads', 'استخدم طاقة البطارية أو المفاعل لدعم الحياة وأوقف الأحمال غير الحرجة'], ['Keep every productive facility at full power', 'أبقِ كل المنشآت الإنتاجية بكامل طاقتها'], ['Wait for solar output to recover before acting', 'انتظر عودة الطاقة الشمسية قبل اتخاذ إجراء']],
    answer: 0,
  },
  {
    title: ['Radiation · exposure limits', 'الإشعاع · حدود التعرض'],
    theory: ['Radiation exposure accumulates. Compare dose with the crew career reference and use available shelter during solar events; do not treat a single safe day as a reset.', 'يتراكم التعرض الإشعاعي. قارن الجرعة بالمرجع المهني واستخدم الملجأ أثناء أحداث الشمس؛ فاليوم الآمن لا يصفر الجرعة.'],
    guided: ['Read each crew member’s cumulative dose on the radiation telemetry panel.', 'اقرأ الجرعة التراكمية لكل فرد في لوحة الإشعاع.'],
    cumulative: ['Lessons 1–2: a solar event threatens dose while power is constrained. What should happen first?', 'الدروسان ١ و٢: حدث شمسي يرفع الجرعة والطاقة محدودة. ما الأولوية؟'],
    options: [['Move crew to shelter and preserve critical power', 'انقل الطاقم إلى الملجأ وحافظ على الطاقة الحرجة'], ['Continue EVA to improve solar production', 'واصل النشاط الخارجي لتحسين إنتاج الطاقة الشمسية'], ['Ignore dose because it will fall overnight', 'تجاهل الجرعة لأنها ستنخفض أثناء الليل']],
    answer: 0,
  },
  {
    title: ['ISRU · water and regolith', 'استخدام الموارد المحلية · الماء والثرى'],
    theory: ['In-situ resource use can supplement supplies, but recovery is not free or perfect. Greenhouse regolith requires perchlorate pretreatment before planting.', 'يمكن لاستخدام الموارد المحلية دعم المؤن، لكن الاسترداد ليس مجانيًا أو كاملًا. يجب معالجة الثرى لإزالة البيركلورات قبل الزراعة.'],
    guided: ['Inspect the greenhouse and water-recovery telemetry. Verify soil pretreatment before starting a crop cycle.', 'افحص الدفيئة واسترداد الماء وتحقق من معالجة التربة قبل بدء دورة المحصول.'],
    cumulative: ['Lessons 1–3: after an outage and solar alert, what is a safe way to improve food resilience?', 'الدروس ١–٣: بعد انقطاع الطاقة وإنذار شمسي، كيف تعزز الغذاء بأمان؟'],
    options: [['Restore critical power, pretreat regolith, then run the greenhouse', 'أعِد الطاقة الحرجة وعالج الثرى ثم شغّل الدفيئة'], ['Plant untreated regolith and disable life support', 'ازرع في ثرى غير معالج وأوقف دعم الحياة'], ['Assume recycling creates unlimited water', 'افترض أن إعادة التدوير تنتج ماءً بلا حدود']],
    answer: 0,
  },
  {
    title: ['Rover · maintenance & EVA', 'المركبة الجوالة · الصيانة والسير خارج المركبة'],
    theory: ['A useful EVA begins with a crew and equipment check, route and weather review, and adequate suit resources. Stop and return when life-support margins become unsafe.', 'تبدأ المهمة الخارجية بفحص الطاقم والمعدات والمسار والطقس وموارد البدلة. أوقفها وعد عند تراجع احتياطي دعم الحياة.'],
    guided: ['Review the operation prerequisites, crew roles and weather indicators before selecting an expedition.', 'راجع متطلبات المهمة وأدوار الطاقم والطقس قبل اختيار الاستكشاف.'],
    cumulative: ['Lessons 1–4: a storm approaches during a rover repair with low O₂ and limited power. What is the safest sequence?', 'الدروس ١–٤: عاصفة تقترب أثناء إصلاح مركبة والأكسجين والطاقة منخفضان. ما التسلسل الآمن؟'],
    options: [['Suspend EVA, shelter the crew, stabilize life support, then reassess repair', 'أوقف المهمة الخارجية وأمّن الطاقم وثبّت دعم الحياة ثم أعد تقييم الإصلاح'], ['Send the whole crew out before the storm arrives', 'أرسل الطاقم بأكمله قبل وصول العاصفة'], ['Ignore suit checks and repair as fast as possible', 'تجاهل فحوص البدلات وأصلح بأسرع وقت']],
    answer: 0,
  },
] as const

export function LearningAcademy({ onClose, onLaunch }: { onClose: () => void; onLaunch?: () => void }) {
  const language = useSettingsStore((state) => state.language)
  const isArabic = language === 'ar'
  const [progress, setProgress] = useState<AcademyProgress>(EMPTY_ACADEMY_PROGRESS)
  const [storageError, setStorageError] = useState('')
  const [lesson, setLesson] = useState(LESSONS.findIndex((_, index) => !progress.completed.includes(index + 1)))
  const [step, setStep] = useState<'theory' | 'guided' | 'simulation'>('theory')
  const [feedback, setFeedback] = useState('')
  const copy = (en: string, ar: string) => isArabic ? ar : en
  const activeLessonIndex = Math.max(0, lesson)
  const activeLesson = LESSONS[activeLessonIndex]
  const completion = Math.round(progress.completed.length / LESSONS.length * 100)
  const mastery = useMemo(() => progress.completed.length === 0 ? 0 : Math.round(
    progress.completed.filter((id) => !progress.weakPoints.includes(id)).length / progress.completed.length * 100,
  ), [progress])

  useEffect(() => {
    try {
      const saved = readAcademyProgress()
      setProgress(saved)
      setLesson(saved.completed.length >= LESSONS.length ? 0 : LESSONS.findIndex((_, index) => !saved.completed.includes(index + 1)))
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Could not load saved Academy progress.')
    }
  }, [])

  const persist = (next: AcademyProgress) => {
    try {
      saveAcademyProgress(next)
      setProgress(next)
      setStorageError('')
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Could not save Academy progress.')
    }
  }

  const answer = (index: number) => {
    const id = activeLessonIndex + 1
    const correct = index === activeLesson.answer
    const next: AcademyProgress = {
      ...progress,
      completed: correct && !progress.completed.includes(id) ? [...progress.completed, id] : progress.completed,
      attempts: { ...progress.attempts, [id]: (progress.attempts[id] || 0) + 1 },
      weakPoints: correct ? progress.weakPoints.filter((weak) => weak !== id) : [...new Set([...progress.weakPoints, id])],
    }
    persist(next)
    setFeedback(correct
      ? copy('Correct. The cumulative scenario is complete.', 'إجابة صحيحة. اكتمل سيناريو المحاكاة التراكمي.')
      : copy('Not quite. Revisit the lesson and try again.', 'ليست الإجابة الصحيحة. راجع الدرس وحاول مجددًا.'))
  }

  const nextLesson = () => {
    const next = LESSONS.findIndex((_, index) => !progress.completed.includes(index + 1))
    setLesson(next < 0 ? LESSONS.length - 1 : next)
    setStep('theory')
    setFeedback('')
  }

  return (
    <main className="learning-academy fixed inset-0 z-[100] overflow-y-auto bg-[#090e16] px-4 py-5 text-white sm:px-8 sm:py-8" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="eyebrow"><BookOpenCheck size={14} /> {copy('MISSION TRAINING · ACADEMY', 'تدريب المهمة · الأكاديمية')}</p>
            <h1 className="mt-3 text-3xl font-black sm:text-5xl">{copy('Learning Hub', 'مركز التعلم')}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{copy('Five cumulative lessons: learn the principle, find the live control, then make a decision in a growing mission scenario.', 'خمسة دروس تراكمية: تعلّم المبدأ، اعثر على أداة التحكم، ثم اتخذ قرارًا ضمن سيناريو مهمة متدرج.')}</p>
          </div>
          <div className="flex gap-2">
            {onLaunch ? <button type="button" onClick={onLaunch} className="primary-button !px-4 !py-2 text-xs"><Play size={14} /> {copy('Launch training mission', 'ابدأ مهمة التدريب')}</button> : null}
            <button type="button" onClick={onClose} className="secondary-button !px-3 !py-2 text-xs" aria-label={copy('Close academy', 'إغلاق الأكاديمية')}><X size={15} /> {copy('Close', 'إغلاق')}</button>
          </div>
        </header>
        {storageError ? <p role="alert" className="mb-4 rounded-xl border border-rose-300/20 bg-rose-400/5 p-3 text-sm text-rose-200">{storageError}</p> : null}
        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          {[
            [copy('COURSE PROGRESS', 'تقدم الدورة'), `${progress.completed.length} / 5`, `${completion}%`],
            [copy('TOPIC MASTERY', 'إتقان الموضوعات'), `${mastery}%`, copy('Based on completed simulations', 'استنادًا إلى المحاكاة المكتملة')],
            [copy('REVISIT THESE TOPICS', 'موضوعات للمراجعة'), progress.weakPoints.length ? progress.weakPoints.map((id) => LESSONS[id - 1].title[isArabic ? 1 : 0]).join(', ') : copy('No weak points recorded', 'لا توجد نقاط ضعف مسجلة'), `${progress.weakPoints.length} ${copy('topics', 'موضوعات')}`],
          ].map(([label, value, detail]) => <article key={label} className="glass-panel p-4"><p className="eyebrow">{label}</p><p className="mt-3 text-2xl font-black text-cyan-100"><bdi dir={/^[\d%]/.test(value) ? 'ltr' : 'auto'}>{value}</bdi></p><p className="mt-1 text-xs text-slate-500"><bdi dir="auto">{detail}</bdi></p></article>)}
        </section>
        <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-cyan-300 to-violet-300 transition-all" style={{ width: `${completion}%` }} /></div>
        <nav className="mb-6 grid gap-2 sm:grid-cols-5" aria-label={copy('Course lessons', 'دروس الدورة')}>
          {LESSONS.map((item, index) => {
            const done = progress.completed.includes(index + 1)
            const locked = index > 0 && !progress.completed.includes(index)
            return <button key={item.title[0]} type="button" disabled={locked} onClick={() => { setLesson(index); setStep('theory'); setFeedback('') }} className={`rounded-xl border p-3 text-start text-xs transition ${done ? 'border-emerald-300/20 bg-emerald-300/[0.04] text-emerald-100' : index === activeLessonIndex ? 'border-cyan-200/30 bg-cyan-200/[0.05] text-white' : 'border-white/10 text-slate-500 disabled:opacity-45'}`}><span className="flex justify-between gap-2"><b>{String(index + 1).padStart(2, '0')}</b>{done ? <Check size={14} /> : locked ? <span>🔒</span> : null}</span><span className="mt-2 block">{item.title[isArabic ? 1 : 0]}</span></button>
          })}
        </nav>
        <section className="glass-panel p-5 sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div><p className="eyebrow">{copy(`LESSON ${activeLessonIndex + 1} · ${step.toUpperCase()}`, `الدرس ${activeLessonIndex + 1} · ${step === 'theory' ? 'النظرية' : step === 'guided' ? 'تطبيق موجّه' : 'محاكاة'}`)}</p><h2 className="mt-2 text-2xl font-black">{activeLesson.title[isArabic ? 1 : 0]}</h2></div>
            <div className="flex gap-2 text-[10px] text-slate-500">{(['theory', 'guided', 'simulation'] as const).map((phase) => <span key={phase} className={`rounded-full border px-2 py-1 ${phase === step ? 'border-cyan-200/30 text-cyan-100' : 'border-white/10'}`}>{phase === 'theory' ? copy('Theory', 'نظرية') : phase === 'guided' ? copy('Guided action', 'تطبيق') : copy('Cumulative sim', 'محاكاة')}</span>)}</div>
          </div>
          {step === 'theory' ? <div className="max-w-3xl text-sm leading-7 text-slate-300"><p>{activeLesson.theory[isArabic ? 1 : 0]}</p><button type="button" onClick={() => setStep('guided')} className="primary-button mt-6 !px-4 !py-2 text-xs">{copy('Continue to guided action', 'تابع إلى التطبيق الموجّه')} {isArabic ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}</button></div> : null}
          {step === 'guided' ? <div className="max-w-3xl"><p className="text-sm leading-7 text-slate-300">{activeLesson.guided[isArabic ? 1 : 0]}</p><button type="button" onClick={() => setStep('simulation')} className="primary-button mt-6 !px-4 !py-2 text-xs">{copy('I found the control — start simulation', 'وجدت أداة التحكم — ابدأ المحاكاة')} {isArabic ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}</button></div> : null}
          {step === 'simulation' ? <div className="max-w-3xl"><p className="mb-4 text-sm leading-7 text-cyan-50">{activeLesson.cumulative[isArabic ? 1 : 0]}</p><div className="grid gap-2">{activeLesson.options.map((option, index) => <button key={option[0]} type="button" onClick={() => answer(index)} className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-start text-sm leading-6 text-slate-200 transition hover:border-cyan-200/30 hover:bg-cyan-200/[0.04]">{option[isArabic ? 1 : 0]}</button>)}</div>{feedback ? <div role="status" className={`mt-4 flex items-center gap-2 text-sm ${feedback.startsWith('Correct') || feedback.startsWith('إجابة') ? 'text-emerald-200' : 'text-amber-200'}`}><CircleAlert size={15} />{feedback}</div> : null}{feedback && (feedback.startsWith('Correct') || feedback.startsWith('إجابة')) ? <button type="button" onClick={nextLesson} className="secondary-button mt-4 !px-4 !py-2 text-xs">{progress.completed.length === LESSONS.length ? copy('Review course', 'مراجعة الدورة') : copy('Next lesson', 'الدرس التالي')} <RotateCcw size={13} /></button> : null}</div> : null}
        </section>
      </div>
    </main>
  )
}
