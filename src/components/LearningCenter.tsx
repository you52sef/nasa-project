import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, CircleAlert, RefreshCw, Send, X } from 'lucide-react'
import type { GameState } from '../game/model'
import { useSettingsStore } from '../store/settingsStore'
import ar from '../i18n/ar'
import en from '../i18n/en'

type Message = { role: 'user' | 'assistant'; content: string }

export function LearningCenter({
  mission,
  assistantVariant,
  onClose,
}: {
  mission: GameState
  assistantVariant: 'astronaut' | 'robot'
  onClose: () => void
}) {
  const language = useSettingsStore((store) => store.language)
  const t = language === 'ar' ? ar : en
  const assistantName = assistantVariant === 'robot' ? t.robotAssistantTitle : t.astronautTitle
  const assistantIcon = assistantVariant === 'robot' ? '🤖' : '👩‍🚀'
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: language === 'ar' ? 'أنا مساعدك في المهمة. اسألني عن الموارد أو الأحداث أو الخطوة التالية.' : 'I’m your mission assistant. Ask me about resources, events, or what to do next.' }])
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(true)
  const [apiAvailable, setApiAvailable] = useState(false)
  const [apiOffline, setApiOffline] = useState(false)
  const [needsConfiguration, setNeedsConfiguration] = useState(false)

  const checkApi = useCallback(async () => {
    setChecking(true)
    try {
      const response = await fetch('/api/astronaut/health', { signal: AbortSignal.timeout(5000) })
      if (!response.ok) throw new Error(`Assistant health check returned ${response.status}`)
      const result: unknown = await response.json()
      if (!result || typeof result !== 'object' || !('enabled' in result) || typeof result.enabled !== 'boolean') {
        throw new Error('Assistant health check returned an invalid response')
      }
      setApiAvailable(result.enabled)
      setNeedsConfiguration(!result.enabled)
      setApiOffline(false)
    } catch (error) {
      console.error('Could not check the astronaut assistant API.', error)
      setApiAvailable(false)
      setNeedsConfiguration(false)
      setApiOffline(true)
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => { void checkApi() }, [checkApi])

  const localReply = (text: string) => {
    const query = text.toLocaleLowerCase()
    if (mission.activeEvent) return language === 'ar'
      ? 'هناك حدث طارئ نشط. راجع سبب الإنذار ومتطلبات كل استجابة وكلفتها مقارنة بالمخزون، ثم اختر القرار المناسب قبل بدء نشاط آخر.'
      : 'An emergency is active. Review the alert, each response’s requirements, and its cost against current reserves before choosing.'
    const low = (['energy', 'oxygen', 'water', 'food', 'health'] as const).find((key) => mission.resources[key] <= 25)
    if (low) {
      const labels = language === 'ar'
        ? { energy: 'الطاقة', oxygen: 'الأكسجين', water: 'الماء', food: 'الغذاء', health: 'صحة الطاقم' }
        : { energy: 'energy', oxygen: 'oxygen', water: 'water', food: 'food', health: 'crew health' }
      return language === 'ar'
        ? `تنبيه: ${labels[low]} عند ${Math.round(mission.resources[low])}٪. راجع توقع الموارد واختر إجراءً يعالج هذا النقص أولًا؛ تذكّر أن كل قرار يغيّر موارد أخرى أيضًا.`
        : `Heads-up: ${labels[low]} is at ${Math.round(mission.resources[low])}%. Check the forecast and prioritize this shortage while considering each action’s trade-offs.`
    }
    if (/water|ماء|مياه/.test(query)) return language === 'ar'
      ? 'راقب الماء في شريط الموارد والتوقعات. معيد التدوير يساعد على تقليل الضغط، لكن البناء يستهلك اعتمادات وشحنًا وطاقة.'
      : 'Watch water in the resource bar and forecast. A recycler can ease the pressure, but construction costs credits, cargo, and energy.'
    if (/energy|power|طاقة|كهرباء/.test(query)) return language === 'ar'
      ? 'تنتج الألواح الشمسية الطاقة، وتستهلكها الأنظمة والأنشطة. افحص التوقع قبل البحث أو الاستكشاف، وفكّر في البطارية أو الصيانة عند انخفاض الاحتياطي.'
      : 'Solar panels produce power, while facilities and activities consume it. Check the forecast before research or exploration, and consider a battery or maintenance when reserves are low.'
    if (/oxygen|أكسجين|اكسجين/.test(query)) return language === 'ar'
      ? 'ينتج نظام دعم الحياة الأكسجين. أبقِ مصدرًا واحدًا على الأقل عاملًا، وراجع كلفة البحث والاستكشاف قبل تنفيذها.'
      : 'Life support produces oxygen. Keep at least one oxygen source online and review research or exploration costs before committing.'
    if (/food|غذاء|طعام/.test(query)) return language === 'ar'
      ? 'تستهلك المؤن عند النوم. خطط لبناء دفيئة مبكرًا، وتأكد من توفر الطاقة اللازمة لتشغيلها.'
      : 'Supplies are consumed during sleep. Plan a greenhouse early and make sure you can afford the energy needed to run it.'
    if (/fatigue|health|rest|إرهاق|صحة|راحة/.test(query)) return language === 'ar'
      ? 'تؤثر الراحة على صحة الطاقم وإرهاقه ومعنوياته، لكنها تستهلك الغذاء. خفف الاستكشاف عندما تنخفض الجاهزية.'
      : 'Rest affects crew health, fatigue, and morale, but consumes food. Reduce exploration when readiness is low.'
    if (/commander|engineer|biologist|water officer|قائد|مهندس|أحيائي|مياه/.test(query)) return t.teamDecisionDescription
    if (/event|حدث|طوارئ/.test(query)) return t.eventGuideSteps
    if (/time|schedule|bed|sleep|وقت|جدول|نوم/.test(query)) return language === 'ar'
      ? `الوقت المحاكى الآن ${String(mission.hour).padStart(2, '0')}:00. يمكنك جدولة الأنشطة حتى 22:00، والنوم بعد 20:00 لبدء يوم جديد.`
      : `The modeled time is ${String(mission.hour).padStart(2, '0')}:00. Schedule activities until 22:00 and send the crew to sleep at or after 20:00 to begin a new day.`
    if (/fail|فشل|إخلاء|خطر/.test(query)) return t.failureGuide
    return language === 'ar'
      ? 'افحص توقع الموارد قبل القرار، ووازن بين دعم الحياة والهدف الرئيسي وجاهزية الطاقم. افتح تبويب الأنشطة لرؤية التكلفة المتوقعة، ثم راجع ناتج العملية بعد التنفيذ.'
      : 'Check the resource forecast before deciding, balancing life support, the mission objective, and crew readiness. Review the operation cost, then check the result afterward.'
  }
  const send = async (event: FormEvent) => {
    event.preventDefault()
    const content = question.trim()
    if (!content || busy) return
    const conversation = [...messages, { role: 'user' as const, content }].slice(-10)
    setMessages(conversation)
    setQuestion('')
    setBusy(true)
    try {
      const response = await fetch('/api/astronaut', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversation,
          mission: {
            day: mission.day,
            maxDays: mission.maxDays,
            mode: mission.objective === 'tutorial' ? 'training' : 'simulation',
            missionMode: mission.missionMode,
            destination: mission.destination,
            stage: mission.activeEvent ? 'emergency response' : 'base operations',
            missionPhase: mission.missionPhase,
            missionTime: `${String(mission.hour).padStart(2, '0')}:00`,
            controlMode: mission.controlMode,
            controlledRole: mission.controlledRole,
            scheduledActivities: mission.todayActions,
            assistantActivitiesCompleted: mission.assistantActionHistory.length,
            resources: mission.resources,
            fatigue: mission.fatigue,
            morale: mission.morale,
            eventActive: Boolean(mission.activeEvent),
            lastAction: mission.lastAction,
            failureCause: mission.failureCause,
          },
        }),
        signal: AbortSignal.timeout(25_000),
      })
      if (!response.ok) throw new Error(`Assistant API returned ${response.status}`)
      const result: unknown = await response.json()
      if (!result || typeof result !== 'object' || !('reply' in result) || typeof result.reply !== 'string' || !result.reply.trim()) {
        throw new Error('Assistant API returned an invalid response')
      }
      setMessages([...conversation, { role: 'assistant', content: result.reply.trim() }])
    } catch (error) {
      console.error('Could not reach the astronaut assistant API.', error)
      setApiOffline(true)
      setApiAvailable(false)
      setMessages([...conversation, { role: 'assistant', content: localReply(content) }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop assistant-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="learning-center-title" className="modal-card assistant-dialog assistant-chat-only max-w-3xl" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <header className="assistant-dialog-header">
          <div className="flex min-w-0 items-center gap-3">
            <span className="assistant-avatar" aria-hidden="true">{assistantIcon}</span>
            <div><p className="eyebrow">{assistantVariant === 'astronaut' ? t.educationSection : t.simulationSection}</p><h2 id="learning-center-title" className="mt-1 text-lg font-black">{assistantName}</h2></div>
          </div>
          <div className={`assistant-api-status ${checking ? 'assistant-api-checking' : apiAvailable ? 'assistant-api-ready' : apiOffline ? 'assistant-api-offline' : 'assistant-api-local'}`} role="status">
            {checking ? <RefreshCw size={13} className="animate-spin" /> : apiAvailable ? <CheckCircle2 size={14} /> : <CircleAlert size={14} />}
            {checking ? t.aiStatusChecking : apiAvailable ? t.aiStatusReady : apiOffline ? t.aiStatusOffline : needsConfiguration ? t.aiStatusNeedsConfig : t.aiStatusOffline}
          </div>
          {!checking && !apiAvailable ? <button type="button" className="icon-button !h-8 !w-8" onClick={() => void checkApi()} disabled={checking} aria-label={t.aiCheckConnection} title={t.aiCheckConnection}><RefreshCw size={14} /></button> : null}
          <button type="button" onClick={onClose} className="icon-button" aria-label={t.close}><X size={17} /></button>
        </header>
        <section className="assistant-chat-panel assistant-chat-only-panel">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-2" aria-live="polite">
            {messages.map((message, index) => <p key={`${message.role}-${index}`} className={`assistant-message ${message.role === 'user' ? 'ms-auto' : ''}`}>{message.role === 'assistant' ? `${assistantIcon} ` : ''}{message.content}</p>)}
            {busy ? <p className="text-xs text-slate-400">{assistantName}…</p> : null}
          </div>
          <p className="my-2 text-[10px] text-slate-500">{apiAvailable ? t.aiKeyPrivacy : t.astronautLocalMode}</p>
          <form onSubmit={(event) => { void send(event) }} className="flex gap-2">
            <input aria-label={t.astronautPlaceholder} placeholder={t.astronautPlaceholder} value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1000} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" />
            <button type="submit" className="primary-button" disabled={busy || !question.trim()} aria-label={t.send}><Send size={15} /></button>
          </form>
        </section>
      </section>
    </div>
  )
}
