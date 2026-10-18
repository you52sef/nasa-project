import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, BarChart3, BatteryCharging, BookOpen, Boxes, Clock3, Database, HardHat, Home, MessageCircle, Radio, Save, Send, Settings2, StopCircle, Users, Volume2, VolumeX, Wrench, X } from 'lucide-react'
import type { GameState } from '../game/model'
import { canSleepAndAdvance, canWaitUntilBedtime, getCompletedWorkShifts, getEnergyCapacity, getMarsCommunicationDelayMinutes, getObjectiveProgress, getObjectiveTarget, MISSION_BEDTIME } from '../game/model'
import { getCrewDailyRoutine } from '../game/constants'
import ar from '../i18n/ar'
import en from '../i18n/en'
import { useGameStore } from '../store/gameStore'
import { useSettingsStore } from '../store/settingsStore'
import { ControlPanel } from './ControlPanel'
import { EndScreen } from './EndScreen'
import { EventModal } from './EventModal'
import { LanguageSwitch } from './LanguageSwitch'
import { BaseView } from './BaseView'
import { BuildingMenu } from './BuildingMenu'
import { ForecastTable } from './ForecastTable'
import { CrewReadiness } from './CrewReadiness'
import { useSound } from '../hooks/useSound'
import { TutorialGuide } from './TutorialGuide'
import { AchievementsPanel } from './AchievementsPanel'
import { SCENARIOS } from '../game/scenarios'
import { MissionLog } from './MissionLog'
import { CrewCouncil } from './CrewCouncil'
import { CREW_ROLES, getMissionCrewAssignments } from '../game/teamwork'
import { localizeCrewRole } from '../game/crewRosters'
import { FlightExperience } from './FlightExperience'
import { formatResourceValue, RESOURCE_META } from '../game/resources'
import { ResourceBar } from './ResourceBar'
import { SurvivalSystems } from './SurvivalSystems'
import { TelemetryDashboard } from './TelemetryDashboard'
import { MissionOperations } from './MissionOperations'
import { GreenhousePanel } from './GreenhousePanel'
import { LearningAcademy } from './LearningAcademy'
import { DataOriginsModal } from './DataOriginsModal'
import { AstronautProfileHud } from './AstronautProfileHud'
import { MISSION_PROFILES } from '../game/missionProfiles'
import { EveningDebrief } from './EveningDebrief'
import { CrewCommLink } from './CrewCommLink'

import { getAccessibleMissionPanels } from '../game/teamwork'
import type { MissionPanelId } from '../game/teamwork'

type MissionSidePanel = MissionPanelId

export function GameScreen({ state }: { state: GameState }) {
  const language = useSettingsStore((store) => store.language)
  const t = language === 'ar' ? ar : en
  const advanceDay = useGameStore((store) => store.advanceDay)
  const sleepAndAdvance = useGameStore((store) => store.sleepAndAdvance)
  const acknowledgeEveningDebrief = useGameStore((store) => store.acknowledgeEveningDebrief)
  const waitUntilBedtime = useGameStore((store) => store.waitUntilBedtime)
  const chooseTransit = useGameStore((store) => store.chooseTransit)
  const save = useGameStore((store) => store.save)
  const markTutorialStep = useGameStore((store) => store.markTutorialStep)
  const pauseAndReturnToMain = useGameStore((store) => store.pauseAndReturnToMain)
  const endMission = useGameStore((store) => store.endMission)
  const [schoolOpen, setSchoolOpen] = useState(false)
  const [dataOriginsOpen, setDataOriginsOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [confirmEndMission, setConfirmEndMission] = useState(false)
  const [sleeping, setSleeping] = useState(false)
  const [surfaceArrival, setSurfaceArrival] = useState(false)
  const [sidePanel, setSidePanel] = useState<MissionSidePanel | null>(null)
  const [routineOpen, setRoutineOpen] = useState(false)
  const [queuedDebriefDay, setQueuedDebriefDay] = useState<number | null>(null)
  const sleepTimer = useRef<number | null>(null)
  const noticeTimer = useRef<number | null>(null)
  const arrivalTimer = useRef<number | null>(null)
  const sleepInProgress = useRef(false)
  const oxygenAlertActive = useRef(false)
  const { soundEnabled, toggleSound, playSuccess, playLowOxygen, setAmbientEnabled, setSuitBreathingEnabled } = useSound()
  const isArabic = language === 'ar'
  const objectiveTitle = state.objective === 'tutorial'
    ? t.objective_tutorial
    : MISSION_PROFILES[state.missionType].goal[language]
  const objectiveProgress = getObjectiveProgress(state)
  const objectiveTarget = getObjectiveTarget(state)
  const objectiveProgressPercent = Math.min(100, objectiveProgress / objectiveTarget * 100)
  const acceptedCrewRequestsToday = state.crewCommunications
    .filter((request) => request.day === state.day && request.decision === 'accepted').length
  const activeRole = CREW_ROLES.find((role) => role.id === state.controlledRole)
  const activeDuty = getMissionCrewAssignments(state.crewSize, state.destination, state.maxDays)
    .find((duty) => duty.id === state.controlledDutyId)
  const accessiblePanels = getAccessibleMissionPanels(state)
  const controlledSpecialty = activeDuty?.specialty
  const canManageGreenhouse = state.controlMode !== 'specialist' ||
    ['agriculture', 'agriculture-resources', 'geology-agriculture'].includes(activeDuty?.specialty || '')
  const canManageFieldOperations = state.controlMode !== 'specialist' ||
    ['command', 'pilot', 'science', 'engineering', 'power', 'resources', 'robotics', 'engineering-science', 'geology-agriculture', 'agriculture-resources'].includes(activeDuty?.specialty || '')
  const energyCapacity = getEnergyCapacity(state)
  const criticalResources = (['energy', 'oxygen', 'water', 'food', 'health'] as const)
    .filter((resource) => state.resources[resource] <= (resource === 'energy' ? energyCapacity : 100) * 0.25)
  const showNotice = (message: string) => {
    setNotice(message)
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => {
      setNotice('')
      noticeTimer.current = null
    }, 4500)
  }

  if (state.isGameOver) return <EndScreen state={state} />

  const handleSave = () => {
    try {
      save()
      showNotice(isArabic ? 'تم حفظ المهمة على هذا الجهاز.' : 'Mission saved on this device.')
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Save failed.')
    }
  }

  const handleAcknowledgeDebrief = () => {
    try {
      acknowledgeEveningDebrief()
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Unable to save the debrief acknowledgment.')
    }
  }

  const handlePauseAndReturn = () => {
    try {
      pauseAndReturnToMain()
    } catch (error) {
      showNotice(error instanceof Error ? error.message : t.pauseSaveFailed)
    }
  }

  const handleEndMission = () => {
    try {
      endMission()
    } catch (error) {
      showNotice(error instanceof Error ? error.message : t.pauseSaveFailed)
    }
  }

  const handleAction = (action: Parameters<typeof advanceDay>[0]) => {
    advanceDay(action)
  }
  const handleSleep = () => {
    if (sleepInProgress.current || !canSleepAndAdvance(useGameStore.getState())) return
    sleepInProgress.current = true
    setSleeping(true)
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 350 : 3_800
    sleepTimer.current = window.setTimeout(() => {
      try {
        const before = useGameStore.getState()
        if (canSleepAndAdvance(before)) {
          sleepAndAdvance()
          const next = useGameStore.getState()
          if (!next.isGameOver && !next.activeEvent && next.day !== before.day) playSuccess()
        }
      } finally {
        sleepInProgress.current = false
        setSleeping(false)
        sleepTimer.current = null
      }
    }, duration)
  }
  useEffect(() => () => {
    if (sleepTimer.current !== null) window.clearTimeout(sleepTimer.current)
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current)
    if (arrivalTimer.current !== null) window.clearTimeout(arrivalTimer.current)
    sleepInProgress.current = false
  }, [])
  useEffect(() => {
    setAmbientEnabled(soundEnabled)
    return () => setAmbientEnabled(false)
  }, [setAmbientEnabled, soundEnabled])
  useEffect(() => {
    setSuitBreathingEnabled(soundEnabled && state.activeOperation?.status === 'active')
    return () => setSuitBreathingEnabled(false)
  }, [setSuitBreathingEnabled, soundEnabled, state.activeOperation?.status])
  useEffect(() => {
    const isCritical = state.resources.oxygen <= 25
    if (isCritical && !oxygenAlertActive.current) playLowOxygen()
    oxygenAlertActive.current = isCritical
  }, [playLowOxygen, state.resources.oxygen])
  const hasTransitDecision = state.transitDecisions.some((decision) => decision.leg === state.missionPhase)
  const needsTransitDecision = (state.missionPhase === 'outbound' || state.missionPhase === 'return') && !hasTransitDecision
  const transitLeg = state.missionPhase === 'outbound' ? 'outbound' : 'return'
  const handleTransitArrival = useCallback((leg: 'outbound' | 'return', choice: Parameters<typeof chooseTransit>[1]) => {
    if (leg === 'outbound') {
      setSurfaceArrival(true)
      arrivalTimer.current = window.setTimeout(() => {
        setSurfaceArrival(false)
        arrivalTimer.current = null
      }, 1_500)
    }
    chooseTransit(leg, choice)
  }, [chooseTransit])
  const clockMinutes = Math.round(state.hour * 60)
  const clock = `${String(Math.floor(clockMinutes / 60) % 24).padStart(2, '0')}:${String(clockMinutes % 60).padStart(2, '0')}`
  const timeOfDay = state.hour < 8 ? 'dawn' : state.hour >= 20 ? 'night' : state.hour >= 17 ? 'dusk' : 'day'
  const latestReport = state.dailyReports[state.dailyReports.length - 1]
  const showEveningDebrief = state.missionPhase === 'surface' &&
    canSleepAndAdvance(state) &&
    state.lastDebriefDay !== state.day
  const signalDelay = latestReport?.earthTransmission?.delayMinutes ??
    (state.destination === 'mars'
      ? getMarsCommunicationDelayMinutes(state.missionSeed, latestReport?.day || state.day, 'research')
      : 2)
  const reportQueued = latestReport?.earthTransmission?.status === 'queued' ||
    (!latestReport?.earthTransmission && state.destination === 'mars')
  const panelDetails: Record<MissionSidePanel, { label: string; icon: typeof Database }> = {
    resources: { label: isArabic ? 'الموارد' : 'Resources', icon: Boxes },
    crew: { label: isArabic ? 'الطاقم' : 'Crew', icon: Users },
    systems: { label: isArabic ? 'دعم الحياة والطاقة' : 'ECLSS & power', icon: BatteryCharging },
    operations: { label: isArabic ? 'الأنشطة والعمليات' : 'Activities & operations', icon: Wrench },
    infrastructure: { label: isArabic ? 'المباني والإنشاء' : 'Buildings & construction', icon: HardHat },
    forecast: { label: isArabic ? 'توقع الموارد' : 'Resource forecast', icon: BarChart3 },
    communications: { label: isArabic ? 'التواصل مع الطاقم' : 'Crew Comm-Link', icon: MessageCircle },
  }

  useEffect(() => {
    if (sidePanel && !accessiblePanels.includes(sidePanel)) setSidePanel(null)
  }, [sidePanel, state.controlMode, state.controlledDutyId, state.destination, state.crewSize, state.maxDays])

  useEffect(() => {
    if (sidePanel && state.missionPhase !== 'surface') setSidePanel(null)
  }, [sidePanel, state.missionPhase])

  useEffect(() => {
    if (!sidePanel) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidePanel(null)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [sidePanel])

  if (needsTransitDecision) {
    return <FlightExperience state={state} leg={transitLeg} onArrive={handleTransitArrival} />
  }

  return (
    <main className={`mission-game mission-command-screen mission-light-${timeOfDay}${surfaceArrival ? ' mission-base-arrival' : ''}${routineOpen ? ' mission-routine-expanded' : ''}`} dir={isArabic ? 'rtl' : 'ltr'}>
      <header className="mission-command-header">
        <div className="mission-command-clock">
          <span className="mission-command-destination" aria-hidden="true">{state.destination === 'moon' ? '🌙' : '🔴'}</span>
          <div>
            <h1>{state.baseName}</h1>
            <p><Clock3 size={12} /> {state.destination === 'mars' ? 'Sol' : (isArabic ? 'اليوم' : 'LUNAR DAY')} {String(state.day).padStart(2, '0')} · <b dir="ltr">{clock}</b></p>
          </div>
          <span className={`mission-daylight-indicator is-${timeOfDay}`}><i />{isArabic ? (timeOfDay === 'night' ? 'ليل' : 'نهار') : timeOfDay}</span>
        </div>

        <div className="mission-command-ticker"><MissionLog state={state} language={language} /></div>

        <div className="mission-command-actions">
          <div className="mission-signal-readout" title={isArabic ? 'تأخير اتصال محاكى؛ لا يوجد إرسال شبكي فعلي.' : 'Modeled communication delay; no live network transmission.'}>
            <Radio size={14} aria-hidden="true" />
            <span>{state.destination === 'mars' ? `${isArabic ? 'تأخير المريخ' : 'MARS DELAY'} · ${signalDelay} ${isArabic ? 'د' : 'min'}` : `${isArabic ? 'وصلة القمر' : 'LUNAR LINK'} · 2 ${isArabic ? 'ث' : 's'}`}</span>
          </div>
          <button
            type="button"
            className="mission-report-send"
            disabled={!latestReport}
            title={isArabic ? 'تقرير اليوم يُجهّز تلقائيًا ويُضاف إلى قائمة الإرسال المحاكية' : 'Daily reports are compiled and queued automatically for simulated uplink'}
            onClick={() => {
              if (!latestReport) return
              showNotice(isArabic
                ? reportQueued
                  ? `تقرير اليوم ${latestReport.day} في قائمة الإرسال المحاكية · التأخير ${signalDelay} دقيقة. لا يتم اتصال شبكي فعلي.`
                  : `حُفظ تقرير اليوم ${latestReport.day} محليًا. لا يتم اتصال شبكي فعلي.`
                : reportQueued
                  ? `Day ${latestReport.day} report is in the simulated uplink queue · ${signalDelay} min delay. No live network connection.`
                  : `Day ${latestReport.day} report is stored locally. No live network connection.`)
            }}
          >
            <Send size={14} aria-hidden="true" /> <span>{reportQueued ? (isArabic ? 'التقرير في قائمة الإرسال' : 'Report queued') : (isArabic ? 'التقرير محفوظ' : 'Report stored')}</span>
          </button>
          <AstronautProfileHud state={state} language={language} />
          <div className="mission-language-switch"><LanguageSwitch /></div>
          <details className="mission-menu">
            <summary aria-label={t.missionMenuLabel}><Settings2 size={17} /><span>{t.missionMenuLabel}</span></summary>
            <div className="mission-menu-panel">
              <p className="mission-menu-metadata">
                {state.missionMode === 'education' ? t.educationSection : t.simulationSection}
                {' · '}{state.controlMode === 'specialist' && activeRole
                  ? `${activeRole.icon} ${activeDuty ? localizeCrewRole(activeDuty.title, language) : t[activeRole.title]}`
                  : t.fullControlTitle}
                {' · '}{state.difficulty === 'easy' ? '🟢' : state.difficulty === 'normal' ? '🟡' : '🔴'} {t[state.difficulty]}
                {' · '}{SCENARIOS[state.scenario || 'baseline'].icon} {SCENARIOS[state.scenario || 'baseline'].name[language]}
              </p>
              {state.controlMode === 'specialist' && activeDuty ? <p className="mt-2 text-[10px] leading-5 text-slate-400">{activeDuty.duty[language]}</p> : null}
              <div className="mission-menu-actions">
                <AchievementsPanel />
                <button type="button" onClick={() => setSchoolOpen(true)} className="secondary-button !px-3 !py-2 text-xs"><BookOpen size={15} /> {t.lessons}</button>
                <button type="button" onClick={() => setDataOriginsOpen(true)} className="secondary-button !px-3 !py-2 text-xs"><Database size={15} /> {t.dataOriginsLabel}</button>
                <button type="button" onClick={handleSave} className="secondary-button !px-3 !py-2 text-xs"><Save size={15} /> {t.save}</button>
                <button type="button" onClick={handlePauseAndReturn} className="secondary-button !px-3 !py-2 text-xs" aria-label={t.pauseAndReturn}><Home size={15} /> {t.pauseAndReturn}</button>
                <button type="button" onClick={() => setConfirmEndMission(true)} disabled={Boolean(state.activeEvent)} className="secondary-button !px-3 !py-2 text-xs text-amber-100 disabled:cursor-not-allowed disabled:opacity-40" aria-label={t.endMission}><StopCircle size={15} /> {t.endMission}</button>
                <button type="button" onClick={toggleSound} className="secondary-button !px-3 !py-2 text-xs">{soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}{soundEnabled ? t.muteSound : t.unmuteSound}</button>
              </div>
            </div>
          </details>
        </div>
      </header>

      <section className="mission-command-map-stage" aria-label={t.siteMapLabel}>
        <nav className="mission-side-rail" aria-label={isArabic ? 'لوحات التحكم' : 'Mission panels'}>
          {(Object.entries(panelDetails) as [MissionSidePanel, typeof panelDetails[MissionSidePanel]][])
            .filter(([id]) => accessiblePanels.includes(id))
            .map(([id, detail]) => {
            const Icon = detail.icon
            return (
              <button
                key={id}
                type="button"
                className="mission-side-rail-button"
                aria-label={detail.label}
                aria-pressed={sidePanel === id}
                title={detail.label}
                onClick={() => setSidePanel((current) => current === id ? null : id)}
              >
                <Icon size={19} aria-hidden="true" />
                <span>{detail.label}</span>
                {id === 'resources' && criticalResources.length ? <i className="mission-rail-alert" aria-label={isArabic ? 'تنبيه موارد' : 'Resource alert'} /> : null}
              </button>
            )
          })}
        </nav>

        <div className="mission-command-map-wrap">
          <BaseView state={state} onAction={handleAction} className="mission-command-map" />
          <div className="mission-objective-chip" title={objectiveTitle}>
            <span>{state.destination === 'moon' ? '🌙' : '🔴'} {objectiveTitle}</span>
            <span>
              {Math.min(objectiveProgress, objectiveTarget)} / {objectiveTarget} · {Math.round(objectiveProgressPercent)}%
              {acceptedCrewRequestsToday ? ` · ${acceptedCrewRequestsToday} ${isArabic ? 'تكليفات مقبولة' : 'crew requests accepted'}` : ''}
            </span>
            <i><b style={{ width: `${objectiveProgressPercent}%` }} /></i>
          </div>
          {criticalResources.length ? (
            <div className="mission-critical-strip" role="status" aria-live="polite">
              <strong>{t.resourceAttentionTitle}</strong>
              {criticalResources.map((resource) => (
                <span key={resource}>
                  {RESOURCE_META[resource].icon} {RESOURCE_META[resource].label[language]} · {formatResourceValue(resource, state.resources[resource], language)}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {sidePanel ? (
          <aside className="mission-side-drawer" aria-labelledby="mission-side-drawer-title">
            <header>
              <div><p>{isArabic ? 'مركز المهمة' : 'MISSION CONTROL'}</p><h2 id="mission-side-drawer-title">{panelDetails[sidePanel].label}</h2></div>
              <button type="button" onClick={() => setSidePanel(null)} aria-label={isArabic ? 'إغلاق اللوحة' : 'Close panel'}><X size={18} /></button>
            </header>
            <div className="mission-side-drawer-content">
              {sidePanel === 'resources' ? <ResourceBar resources={state.resources} language={language} energyCapacity={energyCapacity} /> : null}
              {sidePanel === 'crew' ? (
                <div className="grid gap-3">
                  <CrewReadiness state={state} language={language} />
                  <CrewCouncil state={state} />
                </div>
              ) : null}
              {sidePanel === 'communications' ? <CrewCommLink state={state} /> : null}
              {sidePanel === 'systems' ? (
                <div className="grid gap-3">
                  {controlledSpecialty === 'medical' ? <CrewReadiness state={state} language={language} /> : <SurvivalSystems state={state} />}
                  {controlledSpecialty !== 'medical' ? <TelemetryDashboard state={state} language={language} /> : null}
                </div>
              ) : null}
              {sidePanel === 'operations' ? (
                <div className="grid gap-3">
                  {state.objective === 'tutorial' && state.controlMode === 'full' ? <TutorialGuide completed={state.tutorialSteps} language={language} /> : null}
                  <ControlPanel state={state} disabled={Boolean(state.activeEvent) || needsTransitDecision} onAction={handleAction} />
                  {canManageFieldOperations ? <MissionOperations state={state} /> : null}
                  {canManageGreenhouse ? <GreenhousePanel state={state} /> : null}
                </div>
              ) : null}
              {sidePanel === 'infrastructure' ? <BuildingMenu state={state} /> : null}
              {sidePanel === 'forecast' ? <ForecastTable state={state} language={language} onPreview={() => markTutorialStep('forecast')} /> : null}
            </div>
          </aside>
        ) : null}
      </section>

      <details className={`mission-routine-dock${routineOpen ? ' is-open' : ''}`} open={routineOpen} onToggle={(event) => setRoutineOpen(event.currentTarget.open)}>
        <summary>
          <span className="mission-routine-icon"><Activity size={16} /></span>
          <span className="mission-routine-title">{t.dailyScheduleTitle} · {state.destination === 'mars' ? 'Sol' : t.operationCycle} {state.day}</span>
          <span className="mission-routine-time" dir="ltr">{clock}</span>
          <span className={`mission-routine-status ${state.todayActions.includes('exercise') ? 'is-done' : ''}`}>{state.todayActions.includes('exercise') ? '✓' : '○'} 2.5h</span>
          <span className={`mission-routine-status ${getCompletedWorkShifts(state.todayActions) >= 2 ? 'is-done' : ''}`}>{getCompletedWorkShifts(state.todayActions)}/2 {t.dailyWorkRequirement}</span>
          <span className="mission-routine-chevron" aria-hidden="true">⌃</span>
        </summary>
        <div className="mission-routine-body">
          <div className="mission-routine-progress"><span style={{ width: `${Math.max(0, Math.min(100, (state.hour - 6) / 16 * 100))}%` }} /></div>
          <ol aria-label={t.dailyRoutineTitle}>
            {getCrewDailyRoutine(state.destination).map((item, index) => {
              const workShifts = getCompletedWorkShifts(state.todayActions)
              const complete = item.id === 'exercise'
                ? state.todayActions.includes('exercise')
                : item.id === 'shift-1'
                  ? workShifts >= 1
                  : item.id === 'shift-2'
                    ? workShifts >= 2
                    : state.hour >= 6 + getCrewDailyRoutine(state.destination).slice(0, index + 1).reduce((total, block) => total + block.hours, 0)
              const mandatory = item.id === 'exercise' || item.id.startsWith('shift-')
              return <li key={item.id} className={`${complete ? 'is-done' : ''}${mandatory ? ' is-mandatory' : ''}`}><span>{complete ? '✓' : mandatory ? '○' : '·'}</span><b>{item.label[language]}</b><small>{item.hours}h</small></li>
            })}
          </ol>
          <div className="mission-routine-actions">
            <p>{t.currentTimeLabel}: <b dir="ltr">{clock}</b> · {t.scheduledActivitiesLabel}: {state.todayActions.length}</p>
            {state.lastMessage ? <p role="status">{state.lastMessage}</p> : null}
            <div>
              {state.hour < MISSION_BEDTIME ? <button type="button" onClick={waitUntilBedtime} disabled={!canWaitUntilBedtime(state)} className="secondary-button !px-4 !py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40">{t.waitUntilBedtime}</button> : null}
              <button type="button" onClick={handleSleep} disabled={sleeping || !canSleepAndAdvance(state)} className="primary-button !px-4 !py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40">🌙 {t.sleepAndNextDay}</button>
            </div>
          </div>
        </div>
      </details>

      {notice ? <div role="status" className="fixed bottom-24 start-1/2 z-40 -translate-x-1/2 rounded-xl border border-emerald-200/15 bg-slate-900 px-4 py-3 text-sm text-emerald-100 shadow-2xl">{notice}</div> : null}
      {sleeping ? (
        <div className="sleep-sequence" role="status" aria-live="assertive" dir={isArabic ? 'rtl' : 'ltr'}>
          <p className="eyebrow">{t.crewRestCycle}</p>
          <div className="sleep-habitat" aria-hidden="true">
            <div className="sleep-habitat-module">
              <span className="sleep-habitat-window sleep-habitat-window-one" />
              <span className="sleep-habitat-window sleep-habitat-window-two" />
              <span className="sleep-habitat-status" />
            </div>
            <div className="sleep-habitat-horizon" />
          </div>
          <p className="sleep-sequence-caption">{t.sleepSequenceCaption}</p>
          <div className="sleep-sequence-stars" aria-hidden="true">✦　·　✧　·　✦</div>
        </div>
      ) : null}
      {state.activeEvent ? <EventModal /> : null}
      {showEveningDebrief ? (
        <EveningDebrief
          state={state}
          language={language}
          queued={queuedDebriefDay === state.day}
          onQueueReport={() => setQueuedDebriefDay(state.day)}
          onAcknowledge={handleAcknowledgeDebrief}
          onSleep={handleSleep}
        />
      ) : null}
      {schoolOpen ? <LearningAcademy onClose={() => setSchoolOpen(false)} /> : null}
      {dataOriginsOpen ? <DataOriginsModal onClose={() => setDataOriginsOpen(false)} /> : null}
      {confirmEndMission ? (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setConfirmEndMission(false)
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="end-mission-title" className="modal-card max-w-sm" dir={isArabic ? 'rtl' : 'ltr'}>
            <h2 id="end-mission-title" className="text-lg font-black">{t.endMission}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">{t.endMissionConfirm}</p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
              <button type="button" onClick={() => setConfirmEndMission(false)} className="secondary-button flex-1">{t.close}</button>
              <button type="button" onClick={handleEndMission} className="primary-button flex-1"><StopCircle size={16} />{t.endMission}</button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}
