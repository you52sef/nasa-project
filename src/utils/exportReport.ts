import type { Action, GameState, ResourceName } from '../game/model'
import { BUILDINGS } from '../game/buildings'
import { RESOURCE_META } from '../game/resources'
import { analyzeMissionBehavior, calculateMissionScore, getObjectiveProgress, getObjectiveTarget, isObjectiveComplete } from '../game/model'
import { SCENARIOS } from '../game/scenarios'
import { EVENTS } from '../game/events'

export async function downloadMissionReport(state: GameState, language: 'ar' | 'en' = 'ar'): Promise<void> {
  const isArabic = language === 'ar'
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser could not create the report image.')

  const width = 1200
  const padding = 72
  const contentWidth = width - padding * 2
  const direction: CanvasDirection = isArabic ? 'rtl' : 'ltr'
  const labels = isArabic
    ? {
        report: 'تقرير المهمة',
        result: 'النتيجة',
        success: 'اكتملت المهمة بنجاح',
        evacuation: 'تم إجلاء الطاقم',
        ended: 'انتهت المهمة مبكرًا',
        endedNote: 'أنهى قائد المهمة التشغيل قبل اكتمال جميع الدورات.',
        destination: 'الوجهة',
        scenario: 'السيناريو',
        difficulty: 'الصعوبة',
        objective: 'هدف المهمة',
        objectiveStatus: 'حالة الهدف',
        complete: 'متحقق',
        incomplete: 'غير متحقق',
        score: 'نتيجة الأداء داخل اللعبة',
        days: 'الدورات المكتملة',
        crew: 'عدد الرواد',
        science: 'نقاط العلم',
        rescues: 'مرات إنقاذ القاعدة',
        fatigue: 'إرهاق الطاقم',
        morale: 'معنويات الطاقم',
        radiation: 'مؤشر التعرض الإشعاعي النسبي',
        remaining: 'الموارد المتبقية',
        credits: 'الاعتمادات',
        cargo: 'الشحن',
        buildings: 'منشآت القاعدة',
        log: 'سجل المهمة',
        lessons: 'الدروس المكتملة',
        seed: 'بذرة المحاكاة',
        disclaimer: 'الوحدات الفيزيائية تقديرية تعليمية وليست قياسات هندسية معتمدة.',
        actions: { research: 'بحث علمي', explore: 'رحلة استكشافية', maintenance: 'صيانة', rest: 'راحة' } satisfies Record<Action, string>,
        difficulties: { easy: 'سهل', normal: 'متوسط', hard: 'صعب' },
        objectives: { survival: 'البقاء', science: 'العلوم', exploration: 'الاستكشاف', tutorial: 'التدريب التفاعلي' },
        cycle: 'الدورة',
        behavior: 'تحليل سلوك القرارات',
        eventResponses: 'استجابات الأحداث المسجلة',
        assistantActions: 'أنشطة نسقها المساعد',
        failureCause: 'سبب الإخلاء',
        failurePrevention: 'ما الذي كان يمكن فعله؟',
        transitSource: 'قرار المركبة',
        outbound: 'رحلة الذهاب',
        return: 'رحلة العودة',
        conservative: 'نمط محافظ',
        efficient: 'نمط كفء',
        failureAdvice: {
          energy: 'نفدت الطاقة قبل تغطية الاستهلاك. راقب التوقع وخفّض الأحمال وحسّن التوليد أو التخزين.',
          oxygen: 'نفد الأكسجين. أبقِ نظام دعم الحياة عاملًا وقلل الأنشطة المستهلكة للأكسجين.',
          water: 'نفد الماء. عالج التسرب وراقب الاستهلاك وابنِ معيد تدوير المياه.',
          food: 'نفد الغذاء. ابنِ الدفيئة مبكرًا ووازن استهلاك المؤن.',
          health: 'وصلت صحة الطاقم إلى الصفر. خطط للراحة وقلل المخاطر واستخدم الحماية المتاحة.',
        } satisfies Record<ResourceName, string>,
      }
    : {
        report: 'Mission report',
        result: 'Result',
        success: 'Mission completed successfully',
        evacuation: 'Crew evacuated',
        ended: 'Mission ended early',
        endedNote: 'The mission commander ended operations before all cycles were completed.',
        destination: 'Destination',
        scenario: 'Scenario',
        difficulty: 'Difficulty',
        objective: 'Mission objective',
        objectiveStatus: 'Objective status',
        complete: 'Achieved',
        incomplete: 'Not achieved',
        score: 'In-game performance score',
        days: 'Cycles completed',
        crew: 'Crew size',
        science: 'Science points',
        rescues: 'Base rescues',
        fatigue: 'Crew fatigue',
        morale: 'Crew morale',
        radiation: 'Relative radiation exposure indicator',
        remaining: 'Resources remaining',
        credits: 'Credits',
        cargo: 'Cargo',
        buildings: 'Base structures',
        log: 'Mission log',
        lessons: 'Lessons completed',
        seed: 'Replayable simulation seed',
        disclaimer: 'Physical units are educational estimates, not validated engineering measurements.',
        actions: { research: 'Research', explore: 'Expedition', maintenance: 'Maintenance', rest: 'Rest' } satisfies Record<Action, string>,
        difficulties: { easy: 'Easy', normal: 'Normal', hard: 'Hard' },
        objectives: { survival: 'Survival', science: 'Science', exploration: 'Exploration', tutorial: 'Guided tutorial' },
        cycle: 'Cycle',
        behavior: 'Decision behavior analysis',
        eventResponses: 'Recorded event responses',
        assistantActions: 'Assistant-managed activities',
        failureCause: 'Evacuation cause',
        failurePrevention: 'What could have prevented it?',
        transitSource: 'Flight decision',
        outbound: 'Outbound leg',
        return: 'Return leg',
        conservative: 'Conservative profile',
        efficient: 'Efficient profile',
        failureAdvice: {
          energy: 'Energy ran out before demand was covered. Review forecasts, reduce loads, and improve or store power.',
          oxygen: 'Oxygen ran out. Keep life support online and limit oxygen-intensive activities.',
          water: 'Water ran out. Repair leaks, monitor use, and build a water recycler.',
          food: 'Food ran out. Build the greenhouse early and balance ration use.',
          health: 'Crew health reached zero. Schedule rest, reduce risk, and use available protection.',
        } satisfies Record<ResourceName, string>,
      }

  const planet = state.destination === 'moon' ? (isArabic ? 'القمر' : 'Moon') : (isArabic ? 'المريخ' : 'Mars')
  const missionResult = state.missionResult === 'success'
    ? labels.success
    : state.missionResult === 'ended'
      ? labels.ended
      : labels.evacuation
  const objectiveProgress = getObjectiveProgress(state)
  const objectiveTarget = getObjectiveTarget(state)
  const objectiveStatus = isObjectiveComplete(state) ? labels.complete : labels.incomplete
  const score = calculateMissionScore(state)
  const actionCounts = analyzeMissionBehavior(state.actionHistory || [])
  const failureResource = state.failureCause?.resource || (['energy', 'oxygen', 'water', 'food', 'health'] as const)
    .find((resource) => state.resources[resource] <= 0)
  const failedEvent = state.failureCause?.eventId
    ? EVENTS.find((event) => event.id === state.failureCause?.eventId)
    : undefined
  const failedChoice = failedEvent && state.failureCause?.choiceIndex !== undefined
    ? failedEvent.choices[state.failureCause.choiceIndex]
    : undefined
  const resources: ResourceName[] = ['energy', 'oxygen', 'water', 'food', 'health']
  const buildings = state.buildings.map((id) => `${BUILDINGS[id]?.icon || ''} ${BUILDINGS[id]?.name[language] || id}`.trim())
  const logEntries = state.log.map((entry) => {
    const match = entry.match(/^اليوم\s+(\d+):\s*(.+)$/)
    if (!match) return entry
    const action = match[2] as keyof typeof labels.actions
    return `${labels.cycle} ${match[1]}: ${labels.actions[action] || match[2]}`
  })

  const fontFamily = isArabic
    ? '"IBM Plex Sans Arabic", "Segoe UI", sans-serif'
    : '"Space Grotesk", "Segoe UI", sans-serif'
  const setFont = (size: number, weight = 400, textDirection = direction) => {
    context.font = `${weight} ${size}px ${fontFamily}`
    context.direction = textDirection
    context.textAlign = isArabic ? 'right' : 'left'
  }
  const wrapText = (text: string, maxWidth: number, fontSize: number, weight = 400): string[] => {
    setFont(fontSize, weight)
    const lines: string[] = []
    let line = ''
    for (const word of text.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line)
        line = word
      } else {
        line = candidate
      }
    }
    if (line) lines.push(line)
    return lines.length ? lines : ['']
  }

  const left = padding
  const right = width - padding
  const startX = isArabic ? right : left
  const cardRows = Math.ceil(6 / 3)
  const logLineRows = logEntries.reduce((count, entry) => count + wrapText(entry, contentWidth - 48, 20).length, 0)
  const buildingRows = Math.max(1, Math.ceil(buildings.length / 2))
  const height = 1420 + cardRows * 116 + logLineRows * 34 + buildingRows * 62 + (state.missionResult === 'ended' ? 40 : 0) + (state.missionResult === 'evacuation' ? 170 : 0)
  canvas.width = width
  canvas.height = height

  context.fillStyle = '#07111f'
  context.fillRect(0, 0, width, height)
  const backgroundGlow = context.createRadialGradient(width * 0.82, 0, 0, width * 0.82, 0, width * 0.8)
  backgroundGlow.addColorStop(0, 'rgba(69, 170, 184, 0.18)')
  backgroundGlow.addColorStop(1, 'rgba(7, 17, 31, 0)')
  context.fillStyle = backgroundGlow
  context.fillRect(0, 0, width, height)

  const drawText = (text: string, x: number, y: number, size: number, color: string, weight = 400, textDirection = direction) => {
    setFont(size, weight, textDirection)
    context.fillStyle = color
    context.fillText(text, x, y, contentWidth)
  }
  const drawSection = (title: string, y: number) => {
    drawText(title, startX, y, 26, '#8ce8df', 700)
    context.fillStyle = 'rgba(173, 207, 225, .16)'
    context.fillRect(left, y + 16, contentWidth, 1)
    return y + 48
  }
  const drawCard = (x: number, y: number, cardWidth: number, cardHeight: number, label: string, value: string, valueColor = '#f8fafc') => {
    context.fillStyle = '#101d2b'
    context.fillRect(x, y, cardWidth, cardHeight)
    context.strokeStyle = 'rgba(173, 207, 225, .16)'
    context.strokeRect(x, y, cardWidth, cardHeight)
    const textX = isArabic ? x + cardWidth - 20 : x + 20
    setFont(17, 500)
    context.fillStyle = '#91a5b9'
    context.fillText(label, textX, y + 32, cardWidth - 40)
    setFont(23, 700, 'ltr')
    context.fillStyle = valueColor
    context.fillText(value, textX, y + 72, cardWidth - 40)
  }

  let y = 104
  drawText('ASTRA ONE  /  MISSION DEBRIEF', startX, y, 20, '#8ce8df', 600)
  y += 62
  drawText(labels.report, startX, y, 48, '#f8fafc', 700)
  y += 58
  drawText(state.baseName, startX, y, 34, '#cbd5e1', 600)
  y += 42
  drawText(`${labels.result}: ${missionResult}`, startX, y, 23, state.missionResult === 'success' ? '#86efac' : state.missionResult === 'ended' ? '#fcd34d' : '#fda4af', 600)
  y += 32
  if (state.missionResult === 'ended') {
    drawText(labels.endedNote, startX, y, 18, '#94a3b8')
    y += 38
  }

  y = drawSection(`${planet} · ${SCENARIOS[state.scenario || 'baseline'].name[language]}`, y + 18)
  const meta = [
    [`${labels.destination} · ${labels.crew}`, `${planet} · ${state.crewSize}`],
    [labels.difficulty, labels.difficulties[state.difficulty]],
    [labels.seed, state.missionSeed.toString(16).padStart(8, '0')],
    [labels.lessons, `${state.lessonsCompleted.length} / 6`],
  ]
  const metaGap = 14
  const metaWidth = (contentWidth - metaGap * 3) / 4
  meta.forEach(([label, value], index) => {
    drawCard(left + index * (metaWidth + metaGap), y, metaWidth, 96, label, value)
  })
  y += 124

  y = drawSection(labels.score, y)
  const stats = [
    [labels.score, `${score} / 100`],
    [labels.days, `${state.daysSurvived} / ${state.maxDays}`],
    [labels.science, String(state.science)],
    [labels.rescues, String(state.totalRescues)],
    [labels.fatigue, `${Math.round(state.fatigue)}%`],
    [labels.morale, `${Math.round(state.morale)}%`],
  ]
  const statGap = 14
  const statWidth = (contentWidth - statGap * 2) / 3
  stats.forEach(([label, value], index) => {
    const row = Math.floor(index / 3)
    const column = index % 3
    drawCard(left + column * (statWidth + statGap), y + row * 108, statWidth, 94, label, value)
  })
  y += 236

  y = drawSection(labels.objective, y)
  const objectiveName = labels.objectives[state.objective]
  drawText(`${objectiveName} · ${labels.objectiveStatus}: ${objectiveStatus}`, startX, y + 4, 22, '#e2e8f0', 500)
  drawText(`${Math.min(objectiveProgress, objectiveTarget)} / ${objectiveTarget}`, startX, y + 38, 19, '#94a3b8', 500, 'ltr')
  y += 68

  y = drawSection(labels.behavior, y)
  for (const action of ['research', 'explore', 'maintenance', 'rest'] as const) {
    drawText(`${labels.actions[action]}: ${actionCounts[action]}`, startX, y, 18, '#cbd5e1')
    y += 28
  }
  drawText(`${labels.eventResponses}: ${state.eventHistory?.length || 0}`, startX, y, 18, '#94a3b8')
  y += 40
  if (state.assistantActionHistory?.length) {
    drawText(`${labels.assistantActions}: ${state.assistantActionHistory.length}`, startX, y, 18, '#94a3b8')
    y += 36
  }

  if (state.missionResult === 'evacuation') {
    y = drawSection(labels.failureCause, y)
    if (failureResource) {
      drawText(`${RESOURCE_META[failureResource].label[language]} · ${labels.failureAdvice[failureResource]}`, startX, y, 18, '#fda4af')
      y += 48
    }
    drawText(labels.failurePrevention, startX, y, 18, '#86efac')
    y += 34
    if (failedEvent && failedChoice) {
      drawText(`${failedEvent.title[language]} · ${failedChoice.label[language]}`, startX, y, 17, '#cbd5e1')
      y += 36
    } else if (state.failureCause?.source === 'transit' && state.failureCause.transitLeg && state.failureCause.transitChoice) {
      drawText(`${labels.transitSource}: ${labels[state.failureCause.transitLeg]} · ${labels[state.failureCause.transitChoice]}`, startX, y, 17, '#cbd5e1')
      y += 36
    }
  }

  y = drawSection(labels.remaining, y)
  drawText(labels.disclaimer, startX, y, 16, '#94a3b8')
  y += 38
  const resourceGap = 12
  const resourceWidth = (contentWidth - resourceGap * 2) / 3
  resources.forEach((key, index) => {
    const column = index % 3
    const row = Math.floor(index / 3)
    const label = RESOURCE_META[key].label[language]
    const unit = RESOURCE_META[key].unit
    const amount = new Intl.NumberFormat(language, { maximumFractionDigits: key === 'health' ? 0 : 1 }).format(state.resources[key])
    const suffix = unit === '%' ? '%' : ` ${unit}`
    drawCard(left + column * (resourceWidth + resourceGap), y + row * 96, resourceWidth, 82, label, `${amount}${suffix}`)
  })
  drawCard(left + resourceWidth + resourceGap, y + 192, resourceWidth, 82, labels.credits, String(state.resources.credits))
  drawCard(left + (resourceWidth + resourceGap) * 2, y + 192, resourceWidth, 82, labels.cargo, String(state.resources.cargo))
  y += 300

  y = drawSection(`${labels.buildings} · ${buildings.length}`, y)
  if (buildings.length) {
    const buildingGap = 14
    const buildingWidth = (contentWidth - buildingGap) / 2
    buildings.forEach((building, index) => {
      const row = Math.floor(index / 2)
      const column = index % 2
      const textX = isArabic ? left + (column === 0 ? buildingWidth : contentWidth) : left + column * (buildingWidth + buildingGap)
      drawText(`• ${building}`, textX, y + row * 44, 19, '#cbd5e1')
    })
    y += buildingRows * 44 + 14
  } else {
    drawText(isArabic ? 'لا توجد منشآت مسجلة.' : 'No structures recorded.', startX, y, 19, '#94a3b8')
    y += 44
  }

  y = drawSection(labels.log, y)
  if (logEntries.length) {
    for (const entry of logEntries) {
      const lines = wrapText(entry, contentWidth - 28, 20)
      for (const line of lines) {
        drawText(line, startX, y, 20, '#cbd5e1')
        y += 32
      }
    }
  } else {
    drawText(isArabic ? 'لا توجد تحديثات مسجلة.' : 'No mission updates recorded.', startX, y, 19, '#94a3b8')
    y += 36
  }
  y += 24
  drawText('ASTRA ONE · EDUCATIONAL SIMULATION', startX, y, 15, '#64748b', 500)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result)
      else reject(new Error('The report image could not be generated.'))
    }, 'image/png')
  })
  const safeBaseName = state.baseName.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/\s+/g, '-')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `astra-one-${safeBaseName || 'mission'}-report.png`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
