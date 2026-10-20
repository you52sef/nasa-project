import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Activity, AlertTriangle, BatteryCharging, BookOpen, ChevronDown, Compass, Radio, ShieldCheck, Users, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { KeyboardEvent } from 'react'

type GuideStep = { title: string; body: string }
type GuideTab = {
  title: string
  icon: LucideIcon
  introduction: string
  steps: GuideStep[]
}

const guideContent: Record<'en' | 'ar', GuideTab[]> = {
  en: [
    {
      title: 'Mission Objective & Core Loop',
      icon: Compass,
      introduction: 'Keep the lunar or Martian base sustainable while completing mission milestones and responding to changing conditions.',
      steps: [
        { title: 'Protect the five essentials', body: 'Monitor Oxygen, Water, Power, Food, and crew mental and physical health. Low reserves can cascade: a power shortfall may disable life support and drive oxygen downward.' },
        { title: 'Work through the daily cycle', body: 'Timed activities advance the mission clock and consume resources. Plan the required work shifts and exercise, then use Wait until bedtime or Sleep and next day when the schedule allows.' },
        { title: 'Check each Sol report', body: 'At a day transition, review resource changes, crew readiness, events, and mission progress. Adjust the next shift before a manageable issue becomes an emergency.' },
      ],
    },
    {
      title: 'Interface & Navigation',
      icon: Radio,
      introduction: 'Use the map and HUD as an operations console: inspect the site, check communications timing, and open the panels you are authorized to use.',
      steps: [
        { title: 'Pan, zoom, and inspect the interactive map', body: 'Drag open terrain to pan; use the plus and minus controls to zoom. Select a facility, crew member, rover, or science site to inspect its details and available actions. Map labels identify the base, location, scenario, and destination.' },
        { title: 'Read the top HUD', body: 'The clock and destination show the current mission day and local time. Mars Delay is a modeled one-way communication delay; the Lunar Link is shown for Moon missions. The live operations ticker summarizes mission events.' },
        { title: 'Advance or pause safely', body: 'Choose a timed operation to move the mission clock forward. Wait until bedtime moves to the rest period; Sleep and next day advances the Sol when required shifts and exercise are complete. Pause & return saves the mission and returns to the menu.' },
        { title: 'Track alerts and field work', body: 'Open the bell-shaped Notifications center to review critical alerts, resource warnings, mission progress, and active field-operation status.' },
      ],
    },
    {
      title: 'Crew Roles & Specializations',
      icon: Users,
      introduction: 'Role isolation is enforced: each astronaut can use only the systems and actions permitted for their assigned specialization.',
      steps: [
        { title: 'Commander / Pilot', body: 'Controls flight trajectory and launch decisions, and coordinates crew assignments and global operational directives.' },
        { title: 'Systems Engineer', body: 'Manages power generation, solar arrays, facility repairs, and structural systems.' },
        { title: 'Biologist / Doctor', body: 'Manages ECLSS, oxygen scrubbers, water recycling, crops, and crew health or stress care.' },
        { title: 'Geologist / Specialist', body: 'Leads surface exploration, rover operations, resource collection, and geological analysis.' },
        { title: 'Switch the active astronaut', body: 'Open the crew profile in the top HUD and select a crew member. The available mission panels update to that astronaut’s specialization. Commanders and Pilots can coordinate other crew through the Crew panel and Command Dispatch.' },
      ],
    },
    {
      title: 'Resource Management & Trade-offs',
      icon: BatteryCharging,
      introduction: 'Resource systems are coupled. A reserve can look healthy while the power needed to produce or recycle it is running low.',
      steps: [
        { title: 'Balance power and life support', body: 'Power shortages constrain life-support and greenhouse output. Keep generation and stored energy sufficient for essential loads before expanding optional operations.' },
        { title: 'Manage recycling deliberately', body: 'ECLSS recycling can conserve water and oxygen, but its equipment consumes power. Check both the projected resource balance and power reserve when changing system settings.' },
        { title: 'Protect crew readiness', body: 'Monitor each astronaut’s health, fatigue, stress, and morale in the Crew panel. Schedule recovery when needed and complete daily exercise to reduce fatigue and stress.' },
        { title: 'Use forecasts before committing', body: 'Review resource forecasts and operation costs before assigning work. Preserve enough energy, oxygen, and supplies for emergency response.' },
      ],
    },
    {
      title: 'Disaster Control & Emergencies',
      icon: AlertTriangle,
      introduction: 'Treat an emergency as a sequence: identify the initiating fault, stabilize essential services, then repair the cause with a qualified specialist.',
      steps: [
        { title: '1. Detect and assess', body: 'Open Notifications and Systems to identify the active event, offline facilities, and critical reserves. Check whether the affected specialist is available.' },
        { title: '2. Stabilize essentials', body: 'Prioritize power and life support. Reduce avoidable loads, use available emergency controls, and avoid starting secondary operations while an active emergency has priority.' },
        { title: '3. Dispatch the qualified crew member', body: 'Command/Pilot can issue a role-appropriate directive to another astronaut. Repair and subsystem actions remain restricted to their qualified specialty; unavailable specialists must recover before they can act.' },
        { title: '4. Verify recovery', body: 'For example, a solar flare or dust event can reduce generation; low power may then constrain ECLSS, followed by declining oxygen. Confirm the initiating fault is cleared, facilities are online, and oxygen, water, food, and power trends have stabilized. Continue monitoring through the next Sol transition.' },
      ],
    },
  ],
  ar: [
    {
      title: 'الهدف الرئيسي ودورة المهمة',
      icon: Compass,
      introduction: 'حافظ على استدامة القاعدة القمرية أو المريخية، وأنجز مراحل المهمة واستجب لتغير الظروف.',
      steps: [
        { title: 'احمِ الاحتياجات الأساسية الخمسة', body: 'راقب الأكسجين والماء والطاقة والغذاء والصحة النفسية والجسدية للطاقم. قد يؤدي نقص الطاقة إلى تعطيل دعم الحياة ثم انخفاض الأكسجين.' },
        { title: 'اتبع دورة التشغيل اليومية', body: 'تقدّم الأنشطة المحددة بوقت ساعة المهمة وتستهلك الموارد. خطط لنوبات العمل والتمرين المطلوبين، ثم استخدم الانتظار حتى موعد النوم أو النوم وبدء اليوم التالي عندما يسمح الجدول.' },
        { title: 'راجع تقرير كل يوم شمسي', body: 'عند الانتقال إلى يوم جديد، راجع تغير الموارد وجاهزية الطاقم والأحداث وتقدم المهمة. عدّل النوبة التالية قبل أن تتحول المشكلة إلى حالة طوارئ.' },
      ],
    },
    {
      title: 'شرح الواجهة والتنقل',
      icon: Radio,
      introduction: 'استخدم الخريطة وشريط الحالة كمركز عمليات: افحص الموقع، وتابع توقيت الاتصال، وافتح اللوحات المصرح بها.',
      steps: [
        { title: 'حرّك الخريطة وقرّب وافحص المواقع', body: 'اسحب منطقة التضاريس المفتوحة لتحريك الخريطة، واستخدم زري الجمع والطرح للتقريب والإبعاد. حدد منشأة أو فردًا من الطاقم أو المركبة الجوالة أو موقعًا علميًا لعرض التفاصيل والإجراءات المتاحة. توضح التسميات القاعدة والموقع والسيناريو والوجهة.' },
        { title: 'اقرأ شريط الحالة العلوي', body: 'تعرض الساعة والوجهة يوم المهمة والوقت المحلي. تأخير المريخ هو تأخير اتصال أحادي الاتجاه محاكى؛ ويظهر رابط القمر في المهمات القمرية. يلخص شريط العمليات الأحداث.' },
        { title: 'قدّم الوقت أو أوقف المهمة بأمان', body: 'اختر نشاطًا محددًا بوقت لتقديم ساعة المهمة. ينقلك الانتظار حتى موعد النوم إلى فترة الراحة؛ ويبدأ النوم يومًا جديدًا عند استيفاء نوبات العمل والتمرين. يؤدي الإيقاف والعودة إلى حفظ المهمة والعودة للقائمة.' },
        { title: 'تابع التنبيهات والعمليات الميدانية', body: 'افتح مركز الإشعارات عبر زر الجرس لمراجعة التنبيهات الحرجة وتحذيرات الموارد وتقدم المهمة وحالة العمليات الميدانية.' },
      ],
    },
    {
      title: 'أدوار الرواد وقواعد التخصص',
      icon: Users,
      introduction: 'تُطبّق عزل الأدوار: لا يستخدم رائد الفضاء إلا الأنظمة والإجراءات المسموح بها لتخصصه.',
      steps: [
        { title: 'القائد / الطيار', body: 'يتحكم في المسار المداري وقرارات الإطلاق، وينسق تعيينات الطاقم والتوجيهات التشغيلية العامة.' },
        { title: 'مهندس الأنظمة', body: 'يدير توليد الطاقة والألواح الشمسية وإصلاح المنشآت والأنظمة الهيكلية.' },
        { title: 'عالم الأحياء / الطبيب', body: 'يدير أنظمة دعم الحياة وأجهزة تنقية الأكسجين وإعادة تدوير المياه والمحاصيل ورعاية صحة الطاقم وتوتره.' },
        { title: 'الجيولوجي / الاختصاصي', body: 'يقود الاستكشاف السطحي وتشغيل المركبة الجوالة وجمع الموارد والتحليل الجيولوجي.' },
        { title: 'تبديل رائد الفضاء النشط', body: 'افتح ملف الطاقم في شريط الحالة العلوي واختر رائدًا. تتغير لوحات المهمة المتاحة وفق تخصصه. يستطيع القائد أو الطيار تنسيق الطاقم عبر لوحة الطاقم وقناة التوجيه.' },
      ],
    },
    {
      title: 'إدارة الموارد والمفاضلات',
      icon: BatteryCharging,
      introduction: 'أنظمة الموارد مترابطة؛ فقد يبدو الاحتياطي جيدًا بينما تنخفض الطاقة اللازمة لإنتاجه أو إعادة تدويره.',
      steps: [
        { title: 'وازن الطاقة ودعم الحياة', body: 'يحد نقص الطاقة من إنتاج دعم الحياة والبيوت المحمية. حافظ على توليد الطاقة واحتياطها للأحمال الأساسية قبل توسيع العمليات الاختيارية.' },
        { title: 'أدر إعادة التدوير بعناية', body: 'توفر إعادة التدوير في أنظمة دعم الحياة المياه والأكسجين، لكن معداتها تستهلك الطاقة. راجع توازن الموارد واحتياطي الطاقة عند تغيير إعدادات الأنظمة.' },
        { title: 'حافظ على جاهزية الطاقم', body: 'راقب صحة كل رائد وإرهاقه وتوتره ومعنوياته في لوحة الطاقم. خطط للتعافي عند الحاجة وأكمل التمرين اليومي لتقليل الإرهاق والتوتر.' },
        { title: 'استخدم التوقعات قبل الالتزام', body: 'راجع توقعات الموارد وتكاليف العمليات قبل إسناد العمل. احتفظ بما يكفي من الطاقة والأكسجين والمؤن للاستجابة للطوارئ.' },
      ],
    },
    {
      title: 'إدارة الكوارث والطوارئ',
      icon: AlertTriangle,
      introduction: 'تعامل مع الطوارئ كسلسلة خطوات: حدد سبب العطل، وثبّت الخدمات الأساسية، ثم أصلح السبب عبر الاختصاصي المؤهل.',
      steps: [
        { title: '١. اكتشف الحالة وقيّمها', body: 'افتح الإشعارات والأنظمة لتحديد الحدث النشط والمنشآت المتوقفة والاحتياطيات الحرجة. تحقق من جاهزية الاختصاصي المسؤول.' },
        { title: '٢. ثبّت الخدمات الأساسية', body: 'أعط الأولوية للطاقة ودعم الحياة. خفّض الأحمال غير الضرورية واستخدم عناصر التحكم المتاحة للطوارئ، ولا تبدأ عمليات ثانوية أثناء أولوية الطوارئ.' },
        { title: '٣. وجّه فرد الطاقم المؤهل', body: 'يمكن للقائد أو الطيار إصدار توجيه مناسب للتخصص إلى رائد آخر. تظل الإصلاحات وإجراءات الأنظمة مقصورة على التخصص المؤهل؛ ويجب أن يتعافى الاختصاصي غير المتاح قبل العمل.' },
        { title: '٤. تحقق من التعافي', body: 'مثال: قد تخفض عاصفة شمسية أو غبارية توليد الطاقة؛ وقد يحد نقص الطاقة من دعم الحياة ثم ينخفض الأكسجين. تأكد من إزالة سبب العطل وعودة المنشآت للعمل واستقرار اتجاهات الأكسجين والماء والغذاء والطاقة. واصل المراقبة حتى انتقال اليوم الشمسي التالي.' },
      ],
    },
  ],
}

export function HowToPlayGuide({ language }: { language: 'en' | 'ar' }) {
  const arabic = language === 'ar'
  const tabs = guideContent[language]
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      triggerRef.current?.focus()
    }
  }, [open])

  const onDialogKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      return
    }
    if (event.key === 'Tab') {
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]):not([tabindex="-1"]), [href], summary, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
      return
    }
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    const target = event.target
    if (!(target instanceof HTMLElement) || !target.matches('[role="tab"]')) return
    event.preventDefault()
    const direction = event.key === 'ArrowRight' ? 1 : -1
    const nextIndex = (activeTab + direction + tabs.length) % tabs.length
    setActiveTab(nextIndex)
    dialogRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[nextIndex]?.focus()
  }

  const activeGuideTab = tabs[activeTab]
  const ActiveIcon = activeGuideTab.icon

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="mission-how-to-play-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <BookOpen size={15} aria-hidden="true" />
        <span>How to play</span>
      </button>
      {open ? createPortal(
        <div
          className="mission-guide-backdrop"
          dir={arabic ? 'rtl' : 'ltr'}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false)
          }}
        >
          <section
            ref={dialogRef}
            className="mission-guide-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mission-guide-title"
            onKeyDown={onDialogKeyDown}
          >
            <header className="mission-guide-header">
              <div className="mission-guide-heading">
                <span className="mission-guide-title-icon" aria-hidden="true"><BookOpen size={22} /></span>
                <div>
                  <p>{arabic ? 'دليل مركز المهمة' : 'MISSION CONTROL FIELD GUIDE'}</p>
                  <h2 id="mission-guide-title">How to play</h2>
                </div>
              </div>
              <button ref={closeRef} type="button" className="mission-guide-close" onClick={() => setOpen(false)} aria-label={arabic ? 'إغلاق الدليل' : 'Close guide'}>
                <X size={19} aria-hidden="true" />
              </button>
            </header>

            <nav className="mission-guide-tabs" role="tablist" aria-label={arabic ? 'موضوعات الدليل' : 'Guide topics'}>
              {tabs.map((tab, index) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.title}
                    id={`mission-guide-tab-${index}`}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === index}
                    aria-controls={`mission-guide-panel-${index}`}
                    tabIndex={activeTab === index ? 0 : -1}
                    className={`mission-guide-tab${activeTab === index ? ' is-active' : ''}`}
                    onClick={() => setActiveTab(index)}
                  >
                    <Icon size={15} aria-hidden="true" />
                    <span>{tab.title}</span>
                  </button>
                )
              })}
            </nav>

            <div
              id={`mission-guide-panel-${activeTab}`}
              className="mission-guide-content"
              role="tabpanel"
              aria-labelledby={`mission-guide-tab-${activeTab}`}
              tabIndex={0}
            >
              <div className="mission-guide-intro">
                <span><ActiveIcon size={19} aria-hidden="true" /></span>
                <p>{activeGuideTab.introduction}</p>
              </div>
              <div className="mission-guide-steps">
                {activeGuideTab.steps.map((step, index) => (
                  <details className="mission-guide-step" key={step.title} open={index === 0}>
                    <summary>
                      <span className="mission-guide-step-number">{String(index + 1).padStart(2, '0')}</span>
                      <span>{step.title}</span>
                      <ChevronDown size={16} aria-hidden="true" />
                    </summary>
                    <p>{step.body}</p>
                  </details>
                ))}
              </div>
              <div className="mission-guide-footer">
                <span><ShieldCheck size={14} aria-hidden="true" /> {arabic ? 'تدريب محاكى · لا توجد اتصالات خارجية' : 'Training simulation · no external communication'}</span>
                <span><Activity size={14} aria-hidden="true" /> {activeTab + 1} / {tabs.length}</span>
              </div>
            </div>
          </section>
        </div>,
        document.body,
      ) : null}
    </>
  )
}
