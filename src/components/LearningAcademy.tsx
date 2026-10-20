import { useEffect, useState } from 'react'
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Award, BatteryCharging, BookOpenCheck, Check, CircleAlert,
  ClipboardCheck, Database, HeartPulse, LifeBuoy, Play, Radio, RotateCcw, Shield,
  Users, Volume2, VolumeX, X, Zap,
} from 'lucide-react'
import { useSettingsStore } from '../store/settingsStore'
import { useSound } from '../hooks/useSound'
import { LanguageSwitch } from './LanguageSwitch'
import { DataOriginsModal } from './DataOriginsModal'
import {
  ACADEMY_PHASE_COUNT, EMPTY_ACADEMY_PROGRESS, readAcademyProgress, saveAcademyProgress,
  type AcademyProgress,
} from '../utils/academyProgress'

type Choice = { en: string; ar: string }
type TrialStep = { prompt: Choice; options: readonly Choice[]; answer: number; rationale: Choice }
type LessonArticle = { title: Choice; url: string; summary: Choice }
type LearningPhase = {
  title: Choice
  subtitle: Choice
  icon: typeof Users
  articles: readonly LessonArticle[]
  theory: readonly Choice[]
  metrics: readonly { label: Choice; value: string; note: Choice }[]
  quiz: readonly TrialStep[]
  scenario: Choice
  trial: readonly TrialStep[]
}
type PhaseDefinition = Pick<LearningPhase, 'icon'>

const c = (en: string, ar: string): Choice => ({ en, ar })
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[character] || character)

const PHASE_DEFINITIONS: readonly PhaseDefinition[] = [
  { icon: Users },
  { icon: LifeBuoy },
  { icon: BatteryCharging },
  { icon: Shield },
  { icon: Radio },
]

const LESSONS: readonly LearningPhase[] = PHASE_DEFINITIONS.slice(0, 5).map((phase, index) => {
  const lessons: readonly Omit<LearningPhase, 'icon'>[] = [
    {
      title: c('Mission architecture & crew dynamics', 'هندسة المهام وديناميكيات الطاقم'),
      subtitle: c('Match mission class, duration and crew specialties before committing to a plan.', 'طابق فئة المهمة ومدتها وتخصصات الطاقم قبل اعتماد الخطة.'),
      articles: [
        { title: c('NASA: Moon Facts', 'NASA: حقائق عن القمر'), url: 'https://science.nasa.gov/moon/facts/', summary: c('A NASA overview of the Moon and its exploration.', 'نظرة عامة من NASA على القمر واستكشافه.') },
        { title: c('NASA: Mars Facts', 'NASA: حقائق عن المريخ'), url: 'https://science.nasa.gov/mars/facts/', summary: c('A NASA overview of Mars, its environment, and exploration.', 'نظرة عامة من NASA على المريخ وبيئته واستكشافه.') },
      ],
      theory: [
        c('Mission profiles are planning examples, not hard limits: short lunar stays commonly plan for 7–14 days and 2–4 crew; sustained lunar outposts for 90–180 days and 4–8; Mars opposition concepts may include 30–60 surface days, 4–6 crew and 300+ transit days; conjunction settlement concepts may last roughly 500–900 days with 6–16 crew. Vehicle design, destination, mission architecture and verified requirements determine the real numbers.', 'ملفات المهمة أمثلة تخطيطية وليست حدودًا ثابتة: قد تخطط الإقامة القمرية القصيرة عادةً لـ7–14 يومًا وطاقم من 2–4؛ والقواعد القمرية المستدامة لـ90–180 يومًا و4–8؛ وقد تتضمن مفاهيم مواجهة المريخ 30–60 يومًا على السطح وطاقمًا من 4–6 أفراد وأكثر من 300 يوم عبور؛ أما الاستيطان خلال الاقتران فقد يمتد نحو 500–900 يوم مع 6–16 فردًا. تحدد المركبة والوجهة وهندسة المهمة والمتطلبات المعتمدة الأرقام الفعلية.'),
        c('A commander coordinates priorities, crew wellbeing and ground communication; a pilot handles vehicle control and landing operations; systems/power engineers maintain electrical generation, storage and loads; an ECLSS specialist maintains atmosphere and water loops; an ISRU specialist evaluates local-resource processing; and a flight surgeon leads medical triage. Actual authority depends on training, procedures and mission rules—not job titles alone.', 'ينسق القائد الأولويات ورفاه الطاقم والاتصال بالأرض؛ ويتولى الطيار التحكم بالمركبة والهبوط؛ ويصون مهندس الأنظمة والطاقة التوليد والتخزين والأحمال؛ ويصون اختصاصي دعم الحياة دورات الجو والماء؛ ويقيّم اختصاصي الموارد المحلية المعالجة؛ ويقود طبيب الطيران الفرز الطبي. تعتمد الصلاحيات الفعلية على التدريب والإجراءات وقواعد المهمة، لا على المسمى وحده.'),
        c('Assign safety-critical work to qualified, available crew. Cross-training provides backup, but it does not make every person interchangeable. The simulator does not apply a universal 80% error penalty, a 40% ISRU specialist production bonus or an Emergency Override / Calm Crew ability; the drills teach role-aware decision-making rather than certify real procedures.', 'أسند الأعمال الحرجة للسلامة إلى أفراد مؤهلين ومتاحين. يوفر التدريب المتقاطع بديلًا، لكنه لا يجعل الجميع قابلين للاستبدال. لا تطبق المحاكاة عقوبة خطأ عامة بنسبة 80٪ أو مكافأة إنتاج ISRU ثابتة بنسبة 40٪ أو مهارة Emergency Override / Calm Crew؛ بل تدرب التمارين على القرار الواعي بالأدوار ولا تصادق على إجراءات حقيقية.'),
        c('Crew stress and fatigue are system-level constraints: protect rest, avoid simultaneous high-demand assignments, and let the commander coordinate calm communication while specialists stabilize technical problems. Medical care and EVA response require approved mission procedures.', 'الإجهاد والإرهاق قيود على مستوى النظام: احمِ فترات الراحة، وتجنب تكليفات الإجهاد المتزامنة، واجعل القائد ينسق التواصل الهادئ بينما يثبت الاختصاصيون المشكلات التقنية. تتطلب الرعاية الطبية والاستجابة للنشاط خارج المركبة إجراءات مهمة معتمدة.'),
      ],
      metrics: [
        { label: c('Short lunar stay', 'إقامة قمرية قصيرة'), value: '7–14 days', note: c('Illustrative profile · 2–4 crew', 'ملف توضيحي · 2–4 أفراد') },
        { label: c('Mars settlement concept', 'مفهوم استيطان المريخ'), value: '500–900 days', note: c('Illustrative profile · 6–16 crew', 'ملف توضيحي · 6–16 فردًا') },
        { label: c('Critical assignment rule', 'قاعدة إسناد المهام الحرجة'), value: 'Qualified + ready', note: c('Back up with cross-training', 'وفّر بديلًا بالتدريب المتقاطع') },
      ],
      quiz: [
        { prompt: c('A Mars base loses 80% of solar output during a dust storm. What response and specialist are the best match?', 'فقدت قاعدة مريخية 80٪ من إنتاج الطاقة الشمسية أثناء عاصفة غبارية. ما الاستجابة والاختصاص الأنسب؟'), options: [c('Send the commander outside to clean the arrays immediately', 'إرسال القائد للخارج لتنظيف الألواح فورًا'), c('Have the systems engineer shed noncritical loads and protect ECLSS power', 'تكليف مهندس الأنظمة بفصل الأحمال غير الحرجة وحماية طاقة دعم الحياة'), c('Increase oxygen use to compensate for lost electricity', 'زيادة استهلاك الأكسجين لتعويض الكهرباء المفقودة')], answer: 1, rationale: c('Protect survival loads first; the systems/power engineer manages load shedding.', 'احمِ أحمال النجاة أولًا؛ ويدير مهندس الأنظمة والطاقة فصل الأحمال.') },
        { prompt: c('Why should a CO₂ scrubber repair be assigned to a qualified ECLSS specialist rather than an unrelated specialist?', 'لماذا يُسند إصلاح مرشح CO₂ إلى اختصاصي دعم حياة مؤهل بدل اختصاصي في مجال آخر؟'), options: [c('Any crew member can perform every safety-critical repair equally', 'يمكن لأي فرد تنفيذ كل إصلاح حرج بالقدر نفسه'), c('Role training supports correct diagnosis and repair; cross-training is only a backup', 'يساعد تدريب الدور على التشخيص والإصلاح الصحيحين؛ والتدريب المتقاطع بديل احتياطي'), c('The repair can wait until CO₂ reaches an unsafe level', 'يمكن تأجيل الإصلاح حتى يصل CO₂ إلى مستوى غير آمن')], answer: 1, rationale: c('Specialization and procedures matter; the course does not assign a fixed 80% error rate.', 'التخصص والإجراءات مهمان؛ ولا تفرض الدورة معدل خطأ ثابتًا قدره 80٪.') },
      ],
      scenario: c('Emergency landing · A four-person Mars crew faces an oxygen-line leak, backup-generator failure and an injured pilot. Triage the life-support leak, restore reserve power and stabilize crew wellbeing in that order.', 'هبوط اضطراري · يواجه طاقم مريخي من أربعة أفراد تسربًا في خط الأكسجين وتعطلًا في المولد الاحتياطي وإصابة الطيار. رتّب معالجة تسرب دعم الحياة واستعادة الطاقة الاحتياطية وتهدئة الطاقم بهذا الترتيب.'),
      trial: [
        { prompt: c('DECISION 1 · Oxygen pressure is falling. Who should isolate the branch valve and assess the ECLSS leak?', 'القرار 1 · ينخفض ضغط الأكسجين. من يعزل صمام الفرع ويفحص تسرب دعم الحياة؟'), options: [c('The ECLSS / life-support specialist', 'اختصاصي دعم الحياة ECLSS'), c('The flight surgeon, regardless of system training', 'طبيب الطيران بصرف النظر عن تدريب الأنظمة'), c('Leave the valve open until landing is complete', 'اترك الصمام مفتوحًا حتى اكتمال الهبوط')], answer: 0, rationale: c('Assign the atmosphere-system fault to the qualified life-support specialist.', 'أسند عطل نظام الجو إلى اختصاصي دعم الحياة المؤهل.') },
        { prompt: c('DECISION 2 · The auxiliary generator has stopped. What should the systems engineer do?', 'القرار 2 · توقف المولد المساعد. ماذا ينبغي لمهندس الأنظمة أن يفعل؟'), options: [c('Transfer critical loads to the verified backup battery and check remaining reserve', 'تحويل الأحمال الحرجة إلى البطارية الاحتياطية بعد التحقق منها وفحص المتبقي'), c('Power optional research before life support', 'تشغيل الأبحاث الاختيارية قبل دعم الحياة'), c('Disconnect every battery without checking the bus', 'فصل كل البطاريات دون فحص شبكة التوزيع')], answer: 0, rationale: c('Preserve life-support loads and verify the backup power path and margin.', 'حافظ على أحمال دعم الحياة وتحقق من مسار الطاقة الاحتياطية وهامشها.') },
        { prompt: c('DECISION 3 · The pilot is injured and crew stress is rising. What is the command response?', 'القرار 3 · أُصيب الطيار ويرتفع توتر الطاقم. ما استجابة القيادة؟'), options: [c('The commander communicates calmly, assigns medical triage and confirms the crew status', 'يتواصل القائد بهدوء ويسند الفرز الطبي ويتحقق من حالة الطاقم'), c('Ignore the injury and continue optional tasks', 'تجاهل الإصابة وواصل المهام الاختيارية'), c('Claim an unmodeled override skill guarantees recovery', 'الادعاء بأن مهارة تجاوز غير محاكية تضمن التعافي')], answer: 0, rationale: c('Coordinate a calm response and qualified medical care; no automatic skill bonus is simulated.', 'نسّق استجابة هادئة ورعاية طبية مؤهلة؛ فالمحاكاة لا تمنح مكافأة مهارة تلقائية.') },
      ],
    },
    {
      title: c('ECLSS & resource thermodynamics', 'دعم الحياة والديناميكا الحرارية للموارد'),
      subtitle: c('Follow oxygen, water, food and CO₂ through a finite, coupled life-support loop.', 'تتبّع الأكسجين والماء والغذاء وCO₂ عبر حلقة دعم حياة مترابطة ومحدودة.'),
      articles: [
        { title: c('NASA: International Space Station', 'NASA: محطة الفضاء الدولية'), url: 'https://www.nasa.gov/international-space-station/', summary: c('Explore the crewed research station and its mission systems.', 'تعرّف على محطة الأبحاث المأهولة وأنظمة مهامها.') },
        { title: c('NASA: Space Radiation', 'NASA: الإشعاع في الفضاء'), url: 'https://www.nasa.gov/directorates/esdmd/hhp/space-radiation/', summary: c('NASA explains space-radiation health risks and current knowledge limits.', 'تشرح NASA مخاطر الإشعاع الفضائي على الصحة وحدود المعرفة الحالية.') },
      ],
      theory: [
        c('For this educational model, per-person daily baselines are 0.84 kg oxygen, 3.8 L potable water before recovery, 24.5 L hygiene water as a separate gross-use reference, 2.39 kg food and about 1.0 kg generated CO₂. Actual consumption varies with crew, activity, hardware, diet and mission design; do not treat lesson values as universal flight specifications.', 'في هذا النموذج التعليمي، القيم اليومية الأساسية للفرد هي 0.84 كجم أكسجين و3.8 لتر ماء شرب قبل الاسترداد و24.5 لترًا مرجعًا منفصلًا لاستخدام مياه النظافة الإجمالي و2.39 كجم غذاء ونحو 1.0 كجم CO₂ منتج. يتغير الاستهلاك الفعلي حسب الطاقم والنشاط والمعدات والغذاء وتصميم المهمة؛ فلا تعتبر القيم مواصفات طيران عامة.'),
        c('A closed-loop ECLSS collects humidity and wastewater, treats water, controls temperature and pressure, supplies oxygen and removes carbon dioxide. Watch trends and storage margins: recycling reduces resupply demand but does not make resources infinite or remove the need for maintenance.', 'يجمع نظام دعم الحياة المغلق الرطوبة ومياه الصرف ويعالج الماء ويتحكم بالحرارة والضغط ويوفر الأكسجين ويزيل ثاني أكسيد الكربون. راقب الاتجاهات وهوامش التخزين: يقلل التدوير الحاجة للإمداد لكنه لا يجعل الموارد لا نهائية ولا يلغي الصيانة.'),
        c('The course simulation uses simplified water-recovery settings of 98% Easy, 94% Medium and 90% Hard. The unrecovered fraction is a modeled loss that must be covered by reserves or verified production; never assume a nominal percentage guarantees potable output.', 'تستخدم المحاكاة التعليمية إعدادات مبسطة لاسترداد الماء: 98٪ للسهل و94٪ للمتوسط و90٪ للصعب. الجزء غير المسترد فاقد محاكى يجب تعويضه من المخزون أو الإنتاج المؤكد؛ ولا تفترض أن النسبة الاسمية تضمن ماءً صالحًا للشرب.'),
        c('CDRA-style sorbent beds capture CO₂ and require regeneration. In a Sabatier process, hydrogen can react with CO₂ to form methane and water; additional processing and energy are needed, and the simplified lesson is not a complete mass/energy balance or operational recipe.', 'تلتقط أسرّة الامتصاص الشبيهة بـCDRA غاز CO₂ وتحتاج إلى التجديد. وفي عملية ساباتير يمكن للهيدروجين التفاعل مع CO₂ لتكوين الميثان والماء؛ وتلزم معالجة وطاقة إضافيتان، والشرح المبسط ليس موازنة كاملة للكتلة والطاقة ولا وصفة تشغيلية.'),
      ],
      metrics: [
        { label: c('Oxygen per crew member', 'الأكسجين لكل فرد'), value: '0.84 kg/day', note: c('Educational baseline', 'أساس تعليمي') },
        { label: c('Potable water per crew member', 'ماء الشرب لكل فرد'), value: '3.8 L/day', note: c('Before modeled recovery', 'قبل الاسترداد المحاكى') },
        { label: c('Hard-mode water recovery', 'استرداد الماء · صعب'), value: '90%', note: c('Simplified game setting', 'إعداد مبسط للعبة') },
      ],
      quiz: [
        { prompt: c('What is the lesson’s modeled daily breathing-oxygen baseline per astronaut?', 'ما أساس استهلاك الأكسجين التنفسي اليومي للفرد في الدرس؟'), options: [c('0.25 kg/day', '0.25 كجم/يوم'), c('0.84 kg/day', '0.84 كجم/يوم'), c('3.80 kg/day', '3.80 كجم/يوم')], answer: 1, rationale: c('The lesson uses 0.84 kg per crew member per day as an educational baseline.', 'يستخدم الدرس 0.84 كجم للفرد يوميًا كأساس تعليمي.') },
        { prompt: c('At the simplified 90% recovery setting, what does the remaining 10% represent?', 'عند إعداد الاسترداد المبسط البالغ 90٪، ماذا تمثل نسبة 10٪ المتبقية؟'), options: [c('Water not recovered in the model; plan reserves or verified local production', 'ماء لا يسترده النموذج؛ خطط للمخزون أو الإنتاج المحلي المؤكد'), c('Pure oxygen stored automatically', 'أكسجين نقي يُخزن تلقائيًا'), c('Ready-to-use launch propellant', 'وقود إطلاق جاهز للاستخدام')], answer: 0, rationale: c('The unrecovered portion is a modeled water loss, not oxygen or propellant.', 'الجزء غير المسترد فاقد ماء محاكى، وليس أكسجينًا أو وقودًا.') },
      ],
      scenario: c('Water-pump failure · Potable-water reserve is falling while CO₂ rises toward the drill’s 0.8% warning threshold. Restore a verified emergency water path and switch to a regenerated backup CO₂ sorbent before the scenario’s 1.0% critical limit.', 'تعطل مضخة الماء · ينخفض احتياطي الشرب بينما يرتفع CO₂ نحو عتبة التحذير التدريبية 0.8٪. أعد مسار ماء طوارئ موثوقًا وحوّل إلى مادة امتصاص احتياطية مجددة قبل الحد الحرج للسيناريو البالغ 1.0٪.'),
      trial: [
        { prompt: c('DECISION 1 · The main water-recovery pump is offline. What is the first response?', 'القرار 1 · مضخة استرداد الماء الرئيسية متوقفة. ما الاستجابة الأولى؟'), options: [c('Assign the life-support specialist to verify and open the emergency potable-water supply', 'تكليف اختصاصي دعم الحياة بالتحقق من خط ماء الشرب الاحتياطي وفتحه'), c('Assume recovery continues without power', 'افترض استمرار الاسترداد دون طاقة'), c('Use hygiene water without checking its treatment status', 'استخدم ماء النظافة دون التحقق من معالجته')], answer: 0, rationale: c('Protect potable reserves with a verified backup path and monitor its level.', 'احمِ مخزون الشرب بمسار احتياطي موثوق وراقب مستواه.') },
        { prompt: c('DECISION 2 · CO₂ is rising toward the scenario warning. What system action is appropriate?', 'القرار 2 · يرتفع CO₂ نحو التحذير في السيناريو. ما الإجراء المناسب؟'), options: [c('Switch airflow to the available regenerated backup sorbent and verify readings', 'حوّل تدفق الهواء إلى مادة الامتصاص الاحتياطية المجددة وتحقق من القراءات'), c('Wait until the critical limit is reached', 'انتظر حتى بلوغ الحد الحرج'), c('Turn off cabin circulation', 'أوقف تدوير هواء المقصورة')], answer: 0, rationale: c('Use the backup scrubber before the modeled critical threshold and confirm telemetry.', 'استخدم المرشح الاحتياطي قبل العتبة الحرجة المحاكية وتحقق من القياسات.') },
        { prompt: c('DECISION 3 · The gauges improve after intervention. What confirms recovery?', 'القرار 3 · تحسنت المؤشرات بعد التدخل. ما الذي يؤكد التعافي؟'), options: [c('Check stable trends, water quality/status, power and reserve margins', 'تحقق من استقرار الاتجاهات وحالة الماء والطاقة وهوامش الاحتياط'), c('Assume one green reading proves every loop is healthy', 'افترض أن قراءة خضراء واحدة تثبت سلامة كل الدورات'), c('Resume all optional loads immediately', 'استأنف كل الأحمال الاختيارية فورًا')], answer: 0, rationale: c('Verify more than one reading and ensure the backup remains sustainable.', 'تحقق من أكثر من قراءة وتأكد من استدامة النظام الاحتياطي.') },
      ],
    },
    {
      title: c('Power grids, reactors & ISRU', 'شبكات الطاقة والمفاعلات واستخدام الموارد المحلية'),
      subtitle: c('Balance weather-sensitive generation, safe reserves and local-resource processing.', 'وازن بين التوليد المتأثر بالطقس والاحتياطي الآمن ومعالجة الموارد المحلية.'),
      articles: [
        { title: c('NASA: Harvesting Oxygen on Mars with Perseverance', 'NASA: إنتاج الأكسجين على المريخ بمركبة بيرسيفيرانس'), url: 'https://science.nasa.gov/mission/mars-2020-perseverance/', summary: c('The mission page includes MOXIE, a technology demonstration that produced oxygen from the Martian atmosphere.', 'تتضمن صفحة المهمة تجربة MOXIE التقنية التي أنتجت الأكسجين من الغلاف الجوي للمريخ.') },
        { title: c('NASA: Moon Water and Ices', 'NASA: الماء والجليد على القمر'), url: 'https://science.nasa.gov/moon/moon-water-and-ices/', summary: c('NASA summarizes evidence for lunar water and the challenges of studying it.', 'تلخص NASA أدلة وجود الماء القمري وتحديات دراسته.') },
      ],
      theory: [
        c('Solar arrays are useful but their output depends on orientation, illumination, dust and hardware. A severe Mars dust storm can sharply reduce solar generation; the game’s storm is a stress-test scenario, not a guarantee of a fixed percentage loss.', 'الألواح الشمسية مفيدة لكن إنتاجها يعتمد على الاتجاه والإضاءة والغبار والمعدات. قد تخفض عاصفة مريخية شديدة التوليد بشدة؛ وعاصفة اللعبة اختبار إجهاد وليست ضمانًا لنسبة فقد ثابتة.'),
        c('A fission surface-power concept can provide dispatchable power independent of sunlight, but real systems require shielding, thermal rejection, control, maintenance and safety analysis. This lesson does not model a certified reactor or assert that any named design is ready for a particular mission.', 'يمكن لمفهوم طاقة الانشطار السطحي توفير طاقة قابلة للتحكم ومستقلة عن ضوء الشمس، لكن الأنظمة الحقيقية تتطلب تدريعًا وطرحًا حراريًا وتحكمًا وصيانة وتحليل سلامة. لا يحاكي الدرس مفاعلًا معتمدًا ولا يزعم جاهزية تصميم مسمى لمهمة محددة.'),
        c('Batteries bridge short deficits; preserve a reserve rather than planning to drain them completely. Shed noncritical research and external lighting before cutting life-support, thermal-control or other survival loads. Restore optional loads only after generation and reserve trends stabilize.', 'تجسر البطاريات العجز القصير؛ وحافظ على احتياطي بدل التخطيط لتفريغها كليًا. افصل الأبحاث غير الحرجة والإنارة الخارجية قبل خفض دعم الحياة أو التحكم الحراري أو أحمال النجاة. أعد الأحمال الاختيارية بعد استقرار التوليد واتجاه الاحتياطي.'),
        c('ISRU is a chain: prospect local feedstock, confirm accessibility, extract and process it, then store and verify product. Water electrolysis separates water into hydrogen and oxygen; a Sabatier reactor can combine hydrogen with CO₂ to produce methane and water. All stages need equipment, energy, time and mass-balance checks.', 'استخدام الموارد المحلية سلسلة تبدأ باستكشاف المواد وتأكيد إمكانية الوصول إليها ثم استخراجها ومعالجتها وتخزين الناتج والتحقق منه. يفصل التحليل الكهربائي للماء الهيدروجين والأكسجين؛ ويمكن لساباتير دمج الهيدروجين مع CO₂ لإنتاج الميثان والماء. تحتاج المراحل إلى معدات وطاقة ووقت وفحوص موازنة الكتلة.'),
      ],
      metrics: [
        { label: c('Battery reserve target', 'هدف احتياطي البطارية'), value: '≥20%', note: c('Planning margin from the lesson', 'هامش تخطيط في الدرس') },
        { label: c('Solar storm response', 'استجابة عاصفة شمسية'), value: 'Load shed', note: c('Noncritical loads first', 'الأحمال غير الحرجة أولًا') },
        { label: c('Electrolysis products', 'نواتج التحليل الكهربائي'), value: 'H₂ + O₂', note: c('Requires water and energy', 'يتطلب الماء والطاقة') },
      ],
      quiz: [
        { prompt: c('Why can’t a long-duration Mars base rely on solar arrays alone?', 'لماذا لا يمكن لقاعدة مريخية طويلة الأمد الاعتماد على الألواح الشمسية وحدها؟'), options: [c('They are always heavier than every alternative', 'لأنها دائمًا أثقل من كل بديل'), c('Dust, illumination and night can reduce or interrupt output; dispatchable backup improves resilience', 'قد يخفض الغبار والإضاءة والليل الإنتاج أو يقطعانه؛ ويعزز الاحتياطي القابل للتحكم المرونة'), c('Solar panels directly produce oxygen without water', 'تنتج الألواح الأكسجين مباشرة دون ماء')], answer: 1, rationale: c('A resilient grid combines generation, storage and prioritized loads.', 'تجمع الشبكة المرنة بين التوليد والتخزين وترتيب الأحمال.') },
        { prompt: c('What are the relevant products when water electrolysis is paired with a Sabatier process?', 'ما النواتج ذات الصلة عند دمج تحليل الماء كهربائيًا مع عملية ساباتير؟'), options: [c('Oxygen and methane, with water also formed in the Sabatier reaction', 'الأكسجين والميثان، مع تكوّن الماء أيضًا في تفاعل ساباتير'), c('Carbon dioxide only', 'ثاني أكسيد الكربون فقط'), c('Plastic and fertilizer directly', 'البلاستيك والأسمدة مباشرة')], answer: 0, rationale: c('Electrolysis supplies hydrogen and oxygen; hydrogen plus CO₂ can yield methane and water.', 'يوفر التحليل الكهربائي الهيدروجين والأكسجين؛ ويمكن للهيدروجين مع CO₂ إنتاج الميثان والماء.') },
      ],
      scenario: c('Dust storm · Solar generation collapses in the training scenario and battery charge approaches its warning reserve. Shed optional loads, bring the verified backup generator online and confirm cooling and life-support buses remain powered.', 'عاصفة غبار · ينهار إنتاج الشمس في سيناريو التدريب ويقترب شحن البطارية من احتياطي التحذير. افصل الأحمال الاختيارية وشغّل المولد الاحتياطي المتحقق منه وتأكد من استمرار طاقة التبريد ودعم الحياة.'),
      trial: [
        { prompt: c('DECISION 1 · Solar output falls and the battery is nearing its reserve. What is the first action?', 'القرار 1 · ينخفض الإنتاج الشمسي وتقترب البطارية من الاحتياطي. ما الإجراء الأول؟'), options: [c('Shed noncritical research and external lighting; preserve survival loads', 'افصل الأبحاث غير الحرجة والإنارة الخارجية؛ واحمِ أحمال النجاة'), c('Turn off life support to preserve research', 'أوقف دعم الحياة للحفاظ على الأبحاث'), c('Drain the battery completely before acting', 'فرّغ البطارية كليًا قبل التصرف')], answer: 0, rationale: c('Load shedding extends reserves while preserving critical systems.', 'يطيل فصل الأحمال عمر الاحتياطي مع الحفاظ على الأنظمة الحرجة.') },
        { prompt: c('DECISION 2 · The backup generator is available. What should the systems engineer verify?', 'القرار 2 · المولد الاحتياطي متاح. ما الذي يتحقق منه مهندس الأنظمة؟'), options: [c('Generator output, cooling status and critical power-bus stability', 'خرج المولد وحالة التبريد واستقرار شبكة الأحمال الحرجة'), c('Only the science facility display', 'شاشة منشأة العلوم فقط'), c('That every optional load is active', 'أن كل حمل اختياري نشط')], answer: 0, rationale: c('Confirm the source and dependent cooling/power systems before relying on it.', 'تحقق من المصدر وأنظمة التبريد والطاقة التابعة قبل الاعتماد عليه.') },
        { prompt: c('DECISION 3 · Local ice prospecting is promising. When should its output enter the supply plan?', 'القرار 3 · تبدو نتائج استكشاف الجليد المحلي واعدة. متى يُدرج إنتاجه في خطة الإمداد؟'), options: [c('After accessibility, extraction, processing, power and stored product are verified', 'بعد التحقق من إمكانية الوصول والاستخراج والمعالجة والطاقة والناتج المخزن'), c('Immediately, before a site or plant is confirmed', 'فورًا قبل تأكيد الموقع أو المنشأة'), c('Without reserving power for life support', 'دون تخصيص طاقة لدعم الحياة')], answer: 0, rationale: c('ISRU supply depends on a working chain, not the prospecting result alone.', 'يعتمد إمداد الموارد المحلية على سلسلة تشغيل كاملة، لا على نتيجة الاستكشاف وحدها.') },
      ],
    },
    {
      title: c('Emergency protocols, radiation & safety', 'بروتوكولات الطوارئ والإشعاع والسلامة'),
      subtitle: c('Recognize the hazard, protect the crew, isolate damage and verify recovery.', 'تعرّف الخطر واحمِ الطاقم واعزل الضرر وتحقق من التعافي.'),
      articles: [
        { title: c('NASA: Space Radiation', 'NASA: الإشعاع في الفضاء'), url: 'https://www.nasa.gov/directorates/esdmd/hhp/space-radiation/', summary: c('Read about radiation hazards and why long-duration mission risks remain uncertain.', 'اقرأ عن مخاطر الإشعاع ولماذا لا تزال مخاطر المهمات الطويلة غير مؤكدة.') },
        { title: c('NASA: Moon Water and Ices', 'NASA: الماء والجليد على القمر'), url: 'https://science.nasa.gov/moon/moon-water-and-ices/', summary: c('Learn how observations and evidence shape exploration plans.', 'تعرّف على دور الرصد والأدلة في تخطيط الاستكشاف.') },
      ],
      theory: [
        c('Galactic cosmic rays are a persistent background exposure; solar particle events can produce rapidly changing radiation conditions. Dose depends on particle energy, shielding, geometry, duration and individual factors. A single universal career limit cannot be applied without the relevant agency and mission standard.', 'الأشعة الكونية المجرية تعرض خلفي مستمر؛ وقد تنتج أحداث الجسيمات الشمسية ظروف إشعاع متغيرة بسرعة. تعتمد الجرعة على طاقة الجسيمات والتدريع والهندسة والمدة وعوامل الفرد. لا يمكن تطبيق حد مهني عالمي واحد دون معيار الوكالة والمهمة ذي الصلة.'),
        c('A storm shelter should use the best available shielding and be reached promptly when mission procedures direct it. Water and hydrogen-rich materials can contribute shielding, but the actual protection depends on material thickness, layout and radiation spectrum; do not treat a room as completely radiation-proof.', 'ينبغي أن يستخدم مأوى العاصفة أفضل تدريع متاح ويُدخله الطاقم سريعًا عندما توجه إجراءات المهمة بذلك. قد تسهم المياه والمواد الغنية بالهيدروجين في التدريع، لكن الحماية الفعلية تعتمد على السماكة والتخطيط وطيف الإشعاع؛ فلا تعتبر الغرفة منيعة تمامًا.'),
        c('A micrometeoroid pressure leak calls for alarm acknowledgement, crew protection, compartment isolation where designed, pressure-trend checks and a qualified repair plan. Isolation reduces propagation but does not substitute for locating the leak and confirming that the remaining habitat is safe.', 'يتطلب تسرب الضغط بسبب نيزك دقيق تأكيد الإنذار وحماية الطاقم وعزل المقصورات المصممة لذلك وفحص اتجاه الضغط وخطة إصلاح مؤهلة. يقلل العزل انتشار الضرر لكنه لا يغني عن تحديد التسرب والتأكد من سلامة بقية الموئل.'),
        c('During an SPE warning, recall EVA crew using the mission’s approved return protocol, account for everyone, move to the designated shelter and follow communications and medical monitoring procedures. The lesson’s countdown and radiation indicators are training signals—not a real forecast or dose calculation.', 'عند التحذير من SPE، استدعِ أفراد النشاط الخارجي وفق بروتوكول العودة المعتمد، وتأكد من وجود الجميع، وانتقل إلى المأوى المحدد واتبع إجراءات الاتصال والمراقبة الطبية. العد التنازلي ومؤشرات الإشعاع في الدرس إشارات تدريبية وليست توقعًا حقيقيًا أو حساب جرعة.'),
      ],
      metrics: [
        { label: c('Radiation units', 'وحدات الإشعاع'), value: 'Sv · mSv', note: c('Dose is cumulative and context-dependent', 'الجرعة تراكمية وتعتمد على السياق') },
        { label: c('First priorities', 'الأولويات الأولى'), value: 'Crew · isolate · verify', note: c('Follow approved procedures', 'اتبع الإجراءات المعتمدة') },
        { label: c('Shelter principle', 'مبدأ المأوى'), value: 'Shield + account', note: c('Verify every crew member', 'تحقق من كل فرد') },
      ],
      quiz: [
        { prompt: c('A solar particle event warning is received. What is the immediate training response?', 'ورد تحذير من حدث جسيمات شمسية. ما الاستجابة التدريبية الفورية؟'), options: [c('Send the crew outside to clean solar panels', 'أرسل الطاقم للخارج لتنظيف الألواح'), c('Recall exposed crew and move everyone to the designated shielded shelter per procedure', 'استدعِ الطاقم المعرض وانقل الجميع للمأوى المدرع المحدد حسب الإجراء'), c('Increase water consumption and remove protective clothing', 'زد استهلاك الماء وانزع الملابس الواقية')], answer: 1, rationale: c('Reduce exposure and follow the approved shelter protocol.', 'قلل التعرض واتبع بروتوكول المأوى المعتمد.') },
        { prompt: c('What is the purpose of compartment / airlock isolation after a pressure leak?', 'ما الغرض من عزل المقصورات أو غرفة المعادلة بعد تسرب الضغط؟'), options: [c('Limit air loss and prevent the fault from propagating while the crew assesses the remaining habitat', 'الحد من فقد الهواء ومنع انتشار العطل أثناء تقييم بقية الموئل'), c('Restart every computer automatically', 'إعادة تشغيل كل الحواسيب تلقائيًا'), c('Increase methane flow to the engine', 'زيادة تدفق الميثان للمحرك')], answer: 0, rationale: c('Isolation can contain a leak, but pressure and crew safety still need verification.', 'يمكن للعزل احتواء التسرب، لكن يجب التحقق من الضغط وسلامة الطاقم.') },
      ],
      scenario: c('Solar-flare warning · The training radar predicts arrival in 45 seconds; two crew members are outside and two are in the habitat. Recall the EVA crew, account for all four, shelter centrally and verify external ventilation isolation per the scenario procedure.', 'إنذار عاصفة شمسية · يتوقع رادار التدريب وصولها خلال 45 ثانية؛ فردان خارج القاعدة واثنان داخل الموئل. استدعِ فريق النشاط الخارجي، وتحقق من الأفراد الأربعة، وأوِهم مركزيًا وتأكد من عزل التهوية الخارجية وفق إجراء السيناريو.'),
      trial: [
        { prompt: c('DECISION 1 · Two crew members are on EVA when the alert arrives. What do you do?', 'القرار 1 · فردان في نشاط خارجي عند ورود الإنذار. ماذا تفعل؟'), options: [c('Issue the approved recall and airlock-return call immediately', 'أصدر فورًا أمر العودة المعتمد عبر غرفة المعادلة'), c('Let them finish optional work', 'دعهم يكملون العمل الاختياري'), c('Wait for the storm peak before calling', 'انتظر ذروة العاصفة قبل الاتصال')], answer: 0, rationale: c('Recall exposed crew promptly and track their return.', 'استدعِ الطاقم المعرض فورًا وتابع عودته.') },
        { prompt: c('DECISION 2 · All crew are inside. What is the next priority?', 'القرار 2 · أصبح جميع الأفراد بالداخل. ما الأولوية التالية؟'), options: [c('Account for everyone and move to the designated sheltered area', 'تحقق من الجميع وانتقل إلى منطقة المأوى المحددة'), c('Return to optional lab work', 'عد إلى عمل المختبر الاختياري'), c('Open external vents for more airflow', 'افتح فتحات التهوية الخارجية لزيادة تدفق الهواء')], answer: 0, rationale: c('Confirm crew accountability and shelter according to procedure.', 'تحقق من وجود الطاقم وأوِه وفق الإجراء.') },
        { prompt: c('DECISION 3 · A pressure-leak alarm occurs during sheltering. What is the appropriate response?', 'القرار 3 · انطلق إنذار تسرب ضغط أثناء الاحتماء. ما الاستجابة المناسبة؟'), options: [c('Isolate the designed affected compartment, monitor pressure and follow the qualified response checklist', 'اعزل المقصورة المتأثرة المصممة لذلك وراقب الضغط واتبع قائمة الاستجابة المؤهلة'), c('Open every hatch to equalize pressure', 'افتح كل البوابات لمعادلة الضغط'), c('Ignore the alarm until the event ends', 'تجاهل الإنذار حتى انتهاء الحدث')], answer: 0, rationale: c('Contain the fault where designed and verify safe pressure and crew status.', 'احتوِ العطل حيثما صُمم النظام لذلك وتحقق من الضغط وسلامة الطاقم.') },
      ],
    },
    {
      title: c('Autonomous logic, telemetry & final flight certification', 'المنطق الذاتي والقياسات واعتماد التدريب النهائي'),
      subtitle: c('Read delayed signals in context, act on verified local state and coordinate a compound emergency.', 'اقرأ الإشارات المتأخرة ضمن سياقها، وتصرف وفق الحالة المحلية المؤكدة، ونسّق استجابة لطوارئ مركبة.'),
      articles: [
        { title: c('NASA: Mars Facts', 'NASA: حقائق عن المريخ'), url: 'https://science.nasa.gov/mars/facts/', summary: c('Explore Mars distances, day length, seasons, and the exploration context.', 'استكشف مسافات المريخ وطول يومه وفصوله وسياق استكشافه.') },
        { title: c('NASA: International Space Station', 'NASA: محطة الفضاء الدولية'), url: 'https://www.nasa.gov/international-space-station/', summary: c('See how a long-running human spaceflight program coordinates crews and operations.', 'اطّلع على كيفية تنسيق الطواقم والعمليات في برنامج فضائي مأهول طويل الأمد.') },
      ],
      theory: [
        c('Earth–Mars radio delay varies with geometry and is commonly described as roughly 4–24 minutes one way; the game uses an illustrative 3–22 minute range. During a critical event, a crew cannot wait for a real-time Earth reply. Follow onboard procedures, communicate status and use local telemetry while accounting for delayed instructions.', 'يتغير تأخير الاتصال بين الأرض والمريخ بحسب الهندسة المدارية، ويوصف عادةً بنحو 4–24 دقيقة في اتجاه واحد؛ وتستخدم اللعبة نطاقًا توضيحيًا قدره 3–22 دقيقة. لا يستطيع الطاقم انتظار رد فوري من الأرض أثناء حدث حرج. اتبع الإجراءات على متن المركبة وأبلغ الحالة واستخدم القياسات المحلية مع مراعاة تأخر التعليمات.'),
        c('Telemetry is a time series, not an isolated gauge: compare current value, rate of change, capacity, alarm thresholds, sensor status and related systems. Check that a reading is plausible and corroborate it before irreversible action where time permits.', 'القياسات سلسلة زمنية لا مؤشر منفرد: قارن القيمة الحالية ومعدل التغير والسعة وعتبات الإنذار وحالة المستشعر والأنظمة المرتبطة. تحقق من معقولية القراءة وأكدها قبل إجراء لا رجعة فيه حين يسمح الوقت.'),
        c('Autonomous safe-state logic may isolate a leak, protect essential power and prioritize life support when configured and validated for the vehicle. Automation can fail or act on faulty inputs; crews still monitor, acknowledge alarms and follow their approved procedures. This educational simulator does not certify real autonomous control.', 'قد يعزل منطق الحالة الآمنة الذاتي التسرب ويحمي الطاقة الأساسية ويعطي أولوية لدعم الحياة عند تهيئته والتحقق منه للمركبة. قد تتعطل الأتمتة أو تستند إلى مدخلات خاطئة؛ لذا يراقب الطاقم الإنذارات ويؤكدها ويتبع الإجراءات المعتمدة. لا تصادق هذه المحاكاة التعليمية على التحكم الذاتي الحقيقي.'),
        c('Mars launch/resupply opportunities recur on an approximately 26-month synodic cycle, but the usable window and trajectory depend on ephemerides, propulsion and mission constraints. Allocate finite logistics between life-support spares and objectives, protect contingency margin and never treat a planned shipment as delivered cargo.', 'تتكرر فرص الإطلاق أو الإمداد للمريخ تقريبًا ضمن دورة اقتران تبلغ 26 شهرًا، لكن النافذة والمسار الصالحين يعتمدان على مواقع الأجرام والدفع وقيود المهمة. خصص الإمدادات المحدودة بين قطع دعم الحياة والأهداف، واحمِ هامش الطوارئ، ولا تعتبر الشحنة المخطط لها واصلة.'),
        c('Final certification drill · Combine an oxygen leak, a dust-related power loss and rising crew stress. The decision order is: qualified ECLSS response, systems-engineer load transfer to a verified backup source, then commander-led calm communication and crew check. Verify every action in telemetry before resuming objectives.', 'تمرين الاعتماد النهائي · اجمع بين تسرب أكسجين وفقد طاقة بسبب الغبار وارتفاع توتر الطاقم. ترتيب القرار: استجابة اختصاصي دعم الحياة، ثم تحويل الأحمال بواسطة مهندس الأنظمة إلى مصدر احتياطي متحقق منه، ثم تواصل هادئ بقيادة القائد وفحص الطاقم. تحقق من كل إجراء بالقياسات قبل استئناف الأهداف.'),
      ],
      metrics: [
        { label: c('Modeled Mars one-way delay', 'تأخير المريخ أحادي الاتجاه في النموذج'), value: '3–22 min', note: c('Varies with orbital geometry', 'يتغير حسب الهندسة المدارية') },
        { label: c('Resupply cycle reference', 'مرجع دورة الإمداد'), value: '~26 months', note: c('Approximate synodic cycle', 'دورة اقتران تقريبية') },
        { label: c('Final trial', 'التجربة النهائية'), value: '3 critical actions', note: c('ECLSS · power · crew', 'دعم الحياة · الطاقة · الطاقم') },
      ],
      quiz: [
        { prompt: c('Why can’t mission control provide an immediate real-time response to a Mars emergency?', 'لماذا لا يستطيع مركز التحكم تقديم استجابة فورية مباشرة لحالة طوارئ على المريخ؟'), options: [c('Radio communication has a significant distance-dependent delay', 'لأن الاتصال اللاسلكي يتأخر زمنيًا بسبب المسافة'), c('Radio messages are too expensive to send', 'لأن إرسال الرسائل اللاسلكية مكلف جدًا'), c('Earth computers cannot read oxygen telemetry', 'لأن حواسيب الأرض لا تقرأ قياسات الأكسجين')], answer: 0, rationale: c('One-way delay changes with geometry; local procedures and telemetry are essential.', 'يتغير التأخير أحادي الاتجاه حسب الهندسة؛ لذا فالإجراءات والقياسات المحلية أساسية.') },
        { prompt: c('When should an autonomous safe-state response be used?', 'متى ينبغي استخدام استجابة الحالة الآمنة الذاتية؟'), options: [c('Only during normal meal service', 'فقط أثناء الوجبات الاعتيادية'), c('When a validated fault condition requires immediate protective action while crew verifies status', 'عندما تتطلب حالة عطل متحقق منها إجراءً وقائيًا فوريًا مع تحقق الطاقم من الحالة'), c('Only after local resources are mined', 'فقط بعد استخراج الموارد المحلية')], answer: 1, rationale: c('Automation can protect time-critical systems, but must be validated and monitored.', 'قد تحمي الأتمتة الأنظمة الحساسة للوقت، لكن يجب التحقق منها ومراقبتها.') },
      ],
      scenario: c('Final integrated trial · An oxygen leak is active, a dust storm cuts solar generation and crew stress rises while Earth is out of contact. Complete three decisions in sequence: assign ECLSS to isolate the leak; assign systems engineering to transfer critical loads to verified backup power; have the commander calmly account for the crew. A perfect result awards the in-app certificate and unlocks the free simulation sandbox.', 'التجربة النهائية المتكاملة · يوجد تسرب أكسجين وتخفض عاصفة غبار التوليد الشمسي ويرتفع توتر الطاقم مع انقطاع الاتصال بالأرض. أكمل ثلاثة قرارات بالتتابع: أسند عزل التسرب إلى اختصاصي دعم الحياة؛ وأسند تحويل الأحمال الحرجة للطاقة الاحتياطية المتحقق منها إلى مهندس الأنظمة؛ واجعل القائد يتواصل بهدوء ويتحقق من الطاقم. تمنح النتيجة الكاملة الشهادة التعليمية داخل التطبيق وتفتح المحاكاة الحرة.'),
      trial: [
        { prompt: c('FINAL 1 · Oxygen pressure is falling and CO₂ scrubbing is at risk. Who acts first?', 'النهائي 1 · ينخفض ضغط الأكسجين ويتعرض امتصاص CO₂ للخطر. من يتصرف أولًا؟'), options: [c('The qualified ECLSS specialist isolates the fault and verifies life-support telemetry', 'يعزل اختصاصي دعم الحياة المؤهل العطل ويتحقق من قياساته'), c('The commander attempts an untrained valve repair', 'يحاول القائد إصلاح الصمام دون تدريب'), c('Wait for a delayed Earth reply', 'انتظر رد الأرض المتأخر')], answer: 0, rationale: c('Stabilize life support locally with the qualified specialist and confirm the readings.', 'ثبّت دعم الحياة محليًا بواسطة الاختصاصي المؤهل وأكد القراءات.') },
        { prompt: c('FINAL 2 · Solar output drops during the dust storm. What does the systems engineer do?', 'النهائي 2 · ينخفض إنتاج الشمس أثناء العاصفة الترابية. ماذا يفعل مهندس الأنظمة؟'), options: [c('Shed noncritical loads and transfer essential buses to verified backup power', 'يفصل الأحمال غير الحرجة ويحوّل الشبكات الأساسية إلى طاقة احتياطية متحقق منها'), c('Disconnect life support to retain science power', 'يفصل دعم الحياة للإبقاء على طاقة العلوم'), c('Assume the reactor is online without checking it', 'يفترض تشغيل المفاعل دون التحقق')], answer: 0, rationale: c('Protect essential buses, confirm the backup source and monitor the reserve.', 'احمِ الشبكات الأساسية وتحقق من المصدر الاحتياطي وراقب المخزون.') },
        { prompt: c('FINAL 3 · Crew stress rises and Earth is temporarily out of contact. What should the commander do?', 'النهائي 3 · يرتفع توتر الطاقم وينقطع الاتصال بالأرض مؤقتًا. ماذا ينبغي للقائد؟'), options: [c('Communicate calmly, account for every crewmember and verify the team is following local procedures', 'يتواصل بهدوء ويتحقق من كل فرد ومن اتباع الفريق للإجراءات المحلية'), c('Promise an unmodeled skill will eliminate all stress', 'يعد بمهارة غير محاكية ستزيل كل التوتر'), c('Stop monitoring telemetry until Earth responds', 'يوقف مراقبة القياسات حتى ترد الأرض')], answer: 0, rationale: c('Coordinate people and procedures while maintaining local situational awareness.', 'نسّق الأفراد والإجراءات مع الحفاظ على الوعي المحلي بالحالة.') },
      ],
    },
  ]
  const lesson = lessons[index]
  return {
    ...phase,
    ...lesson,
    icon: phase.icon,
  }
})

const PHASES = LESSONS

const EXAM: readonly TrialStep[] = [
  PHASES[1].quiz[0],
  { prompt: c('At Normal difficulty, what modeled water recovery efficiency is used?', 'ما كفاءة استرداد الماء المحاكية في الصعوبة المتوسطة؟'), options: [c('94%', '94٪'), c('98%', '98٪'), c('90%', '90٪')], answer: 0, rationale: c('Normal uses 94%; Easy 98% and Hard 90%.', 'المتوسط 94٪؛ والسهل 98٪ والصعب 90٪.') },
  PHASES[0].trial[1],
  PHASES[2].trial[0],
  PHASES[3].trial[0],
  PHASES[4].trial[0],
  { prompt: c('What are the modeled Moon and Mars solar nameplate values?', 'ما القيم الاسمية الشمسية المحاكية للقمر والمريخ؟'), options: [c('15 kW / 7 kW', '15 كيلوواط / 7 كيلوواط'), c('7 kW / 25 kW', '7 كيلوواط / 25 كيلوواط'), c('25 kW / 200 kW', '25 كيلوواط / 200 كيلوواط')], answer: 0, rationale: c('The game uses 15 kW Moon solar and 7 kW Mars solar before losses.', 'تستخدم اللعبة 15 كيلوواط للقمر و7 كيلوواط للمريخ قبل الخسائر.') },
  { prompt: c('What is the modeled battery capacity?', 'ما سعة البطارية المحاكية؟'), options: [c('200 kWh', '200 كيلوواط ساعة'), c('25 kWh', '25 كيلوواط ساعة'), c('600 kWh', '600 كيلوواط ساعة')], answer: 0, rationale: c('The modeled storage capacity is 200 kWh.', 'سعة التخزين المحاكية هي 200 كيلوواط ساعة.') },
  { prompt: c('A communications delay is present. Which log is authoritative for local actions already taken?', 'يوجد تأخير اتصال. أي سجل موثوق للأفعال المحلية التي نُفذت بالفعل؟'), options: [c('The local mission log and current telemetry', 'سجل المهمة المحلي والقياسات الحالية'), c('An Earth reply that has not arrived', 'رد الأرض الذي لم يصل بعد'), c('A planned action that has not been executed', 'إجراء مخطط لم يُنفذ')], answer: 0, rationale: c('Use local state for local actions and account for message delay.', 'استخدم الحالة المحلية للأفعال المحلية وراعِ تأخير الرسائل.') },
]

type Screen = 'lesson' | 'quiz' | 'trial' | 'exam'

export function LearningAcademy({ onClose, onLaunch }: { onClose: () => void; onLaunch?: () => void }) {
  const language = useSettingsStore((store) => store.language)
  const isArabic = language === 'ar'
  const copy = (value: Choice) => value[language]
  const { soundEnabled, toggleSound } = useSound()
  const [progress, setProgress] = useState<AcademyProgress>(EMPTY_ACADEMY_PROGRESS)
  const [storageError, setStorageError] = useState('')
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [learnerNameDraft, setLearnerNameDraft] = useState('')
  const [screen, setScreen] = useState<Screen>('lesson')
  const [quizAnswers, setQuizAnswers] = useState<number[]>([])
  const [trialAnswers, setTrialAnswers] = useState<number[]>([])
  const [trialSecondsLeft, setTrialSecondsLeft] = useState<number | null>(null)
  const [examAnswers, setExamAnswers] = useState<number[]>([])
  const [examQuestions, setExamQuestions] = useState<readonly TrialStep[]>(EXAM)
  const [trialResult, setTrialResult] = useState<'passed' | 'failed' | null>(null)
  const [examResult, setExamResult] = useState<{ score: number; missed: number[] } | null>(null)
  const [quizResult, setQuizResult] = useState<'passed' | 'failed' | null>(null)
  const [dataOriginsOpen, setDataOriginsOpen] = useState(false)
  const current = PHASES[phaseIndex]
  const Icon = current.icon
  const trialDurationSeconds = phaseIndex === PHASES.length - 1 ? 90 : 60
  const completeCount = progress.completedPhases.length
  const percentage = Math.round(completeCount / ACADEMY_PHASE_COUNT * 100)
  const unlockedPhaseCount = Math.min(ACADEMY_PHASE_COUNT, completeCount + 1)
  const examUnlocked = completeCount === ACADEMY_PHASE_COUNT
  const examScore = examResult ? Math.round(examResult.score / EXAM.length * 100) : null
  const completed = progress.completedPhases.includes(phaseIndex + 1)
  useEffect(() => {
    try {
      const saved = readAcademyProgress()
      setProgress(saved)
      setLearnerNameDraft(saved.learnerName)
      const firstIncomplete = PHASES.findIndex((_, index) => !saved.completedPhases.includes(index + 1))
      setPhaseIndex(firstIncomplete < 0 ? PHASES.length - 1 : firstIncomplete)
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Could not load saved training progress.')
    }
  }, [])

  const persist = (next: AcademyProgress) => {
    setProgress(next)
    try {
      saveAcademyProgress(next)
      setStorageError('')
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Could not save training progress.')
    }
  }

  const openQuiz = () => {
    setQuizAnswers(Array(PHASES[phaseIndex].quiz.length).fill(-1))
    setQuizResult(null)
    setScreen('quiz')
  }

  const openTrial = () => {
    const phaseId = phaseIndex + 1
    if (!progress.quizPassedPhases.includes(phaseId) && !progress.completedPhases.includes(phaseId)) return
    setTrialAnswers(Array(PHASES[phaseIndex].trial.length).fill(-1))
    setTrialResult(null)
    setTrialSecondsLeft(trialDurationSeconds)
    setScreen('trial')
  }

  const recordTrialOutcome = (passed: boolean) => {
    const id = phaseIndex + 1
    const next: AcademyProgress = {
      ...progress,
      completedPhases: passed && !completed ? [...progress.completedPhases, id].sort((a, b) => a - b) : progress.completedPhases,
      certified: progress.certified || (passed && phaseIndex === PHASES.length - 1),
      trialAttempts: { ...progress.trialAttempts, [id]: (progress.trialAttempts[id] || 0) + 1 },
      trialOutcomes: {
        ...progress.trialOutcomes,
        [id]: [...(progress.trialOutcomes[id] || []), passed],
      },
    }
    persist(next)
    setTrialResult(passed ? 'passed' : 'failed')
    setTrialSecondsLeft(null)
  }

  const submitQuiz = () => {
    const quiz = current.quiz
    const passed = quizAnswers.length === quiz.length &&
      quizAnswers.every((answer, index) => answer === quiz[index].answer)
    if (passed) {
      const phaseId = phaseIndex + 1
      persist({
        ...progress,
        quizPassedPhases: [...new Set([...progress.quizPassedPhases, phaseId])].sort((a, b) => a - b),
      })
    }
    setQuizResult(passed ? 'passed' : 'failed')
  }

  const submitTrial = () => {
    const trial = current.trial
    const passed = trialAnswers.length === trial.length &&
      trialAnswers.every((answer, index) => answer === trial[index].answer)
    recordTrialOutcome(passed)
  }

  useEffect(() => {
    if (screen !== 'trial' || trialResult || trialSecondsLeft === null) return
    const timer = window.setInterval(() => {
      setTrialSecondsLeft((remaining) => remaining === null ? null : Math.max(0, remaining - 1))
    }, 1_000)
    return () => window.clearInterval(timer)
  }, [screen, trialResult, trialSecondsLeft === null])

  useEffect(() => {
    if (screen === 'trial' && trialSecondsLeft === 0 && trialResult === null) recordTrialOutcome(false)
  }, [screen, trialSecondsLeft, trialResult])

  const submitExam = () => {
    const score = examQuestions.reduce((total, question, index) => total + (examAnswers[index] === question.answer ? 1 : 0), 0)
    const missed = examQuestions.flatMap((question, index) => examAnswers[index] === question.answer ? [] : [index])
    const passed = score / examQuestions.length >= .8
    const next: AcademyProgress = {
      ...progress,
      examAttempts: progress.examAttempts + 1,
      examBestScore: Math.max(progress.examBestScore, score),
      certified: progress.certified || passed,
    }
    persist(next)
    setExamResult({ score, missed })
  }

  const saveLearnerName = () => {
    const learnerName = learnerNameDraft.trim().slice(0, 80)
    setLearnerNameDraft(learnerName)
    if (learnerName !== progress.learnerName) persist({ ...progress, learnerName })
  }

  const selectAnswer = (index: number, value: number) => {
    setTrialAnswers((answers) => answers.map((answer, answerIndex) => answerIndex === index ? value : answer))
    setTrialResult(null)
  }

  const selectQuizAnswer = (index: number, value: number) => {
    setQuizAnswers((answers) => answers.map((answer, answerIndex) => answerIndex === index ? value : answer))
    setQuizResult(null)
  }

  const selectExamAnswer = (index: number, value: number) => {
    setExamAnswers((answers) => answers.map((answer, answerIndex) => answerIndex === index ? value : answer))
    setExamResult(null)
  }

  const downloadCertificate = () => {
    const learnerName = escapeHtml(progress.learnerName || 'Mission trainee')
    const completedDate = escapeHtml(new Date().toLocaleDateString())
    const certificateCopy = isArabic
      ? {
        eyebrow: 'رائد فضاء صغير · أكاديمية الطيران',
        title: 'شهادة الطيران',
        presented: 'تُمنح إلى',
        award: 'لإتمام الدروس الخمسة واجتياز تجربة المهمة النهائية في أكاديمية الطيران التعليمية.',
        exam: 'التجربة النهائية',
        date: 'تاريخ الإتمام',
        disclaimer: 'جائزة تعليمية غير رسمية. هذه الشهادة غير صادرة عن NASA أو مؤيدة أو معتمدة منها، ولا تمثل مؤهلًا تشغيليًا.',
      }
      : {
        eyebrow: 'JUNIOR ASTRONAUT · FLIGHT ACADEMY',
        title: 'FLIGHT CERTIFICATE',
        presented: 'Presented to',
        award: 'For completing all five lessons and passing the final integrated mission trial in the educational Flight Academy.',
        exam: 'FINAL PRACTICAL',
        date: 'COMPLETED',
        disclaimer: 'Unofficial educational award. This certificate is not issued, endorsed, accredited, or affiliated with NASA and is not an operational qualification.',
      }
    const html = `<!doctype html>
<html lang="${isArabic ? 'ar' : 'en'}" dir="${isArabic ? 'rtl' : 'ltr'}">
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${certificateCopy.title}</title>
<style>
  *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#050b18;color:#e9faff;font:16px/1.6 Arial,sans-serif}
  main{position:relative;width:min(900px,100%);overflow:hidden;border:1px solid #48cfe5;border-radius:24px;background:radial-gradient(ellipse at 50% 0,#163c5b,#091629 68%);padding:clamp(32px,7vw,76px);text-align:center;box-shadow:0 24px 80px #0009,0 0 38px #28b5d533}
  main:before,main:after{position:absolute;inset:18px;border:1px solid #62d9ed33;border-radius:16px;content:"";pointer-events:none}
  .seal{display:inline-grid;width:74px;height:74px;place-items:center;border:1px solid #7be5f4;border-radius:50%;color:#9cf1ff;font-size:30px;box-shadow:0 0 25px #42d6ec55}
  .eyebrow{margin:24px 0 8px;color:#7fe4f2;font-size:12px;font-weight:700;letter-spacing:.2em}
  h1{margin:0;font-size:clamp(28px,6vw,52px);line-height:1.1;letter-spacing:.04em}
  .learner{margin:34px 0 8px;color:#a6b9cc;font-size:14px}.name{margin:0;color:#fff;font-size:clamp(25px,5vw,40px);font-weight:700}
  .award{margin:14px auto 26px;max-width:620px;color:#b6c8d7}
  .score{display:inline-block;border:1px solid #55d4e755;border-radius:999px;background:#38bfd519;padding:8px 18px;color:#a8f4ff;font-weight:700}
  .date{margin-top:26px;color:#8398ae;font-size:13px}
  footer{position:relative;margin-top:32px;border-top:1px solid #7fcce42d;padding-top:17px;color:#899caf;font-size:11px}
  @media print{body{background:#fff}main{box-shadow:none;print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style>
<main>
  <span class="seal" aria-hidden="true">✦</span>
  <p class="eyebrow">${certificateCopy.eyebrow}</p>
  <h1>${certificateCopy.title}</h1>
  <p class="learner">${certificateCopy.presented}</p>
  <p class="name">${learnerName}</p>
  <p class="award">${certificateCopy.award}</p>
  <span class="score">${certificateCopy.exam} · ${isArabic ? 'اجتياز' : 'PASSED'}</span>
  <p class="date">${certificateCopy.date} · ${completedDate}</p>
  <footer>${certificateCopy.disclaimer}</footer>
</main>`
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'junior-astronaut-flight-academy-certificate.html'
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
  }

  const beginExam = () => {
    const questions = [...EXAM]
    for (let index = questions.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1))
      ;[questions[index], questions[swapIndex]] = [questions[swapIndex], questions[index]]
    }
    setExamQuestions(questions)
    setExamAnswers(Array(questions.length).fill(-1))
    setExamResult(null)
    setScreen('exam')
  }

  const closeScreen = () => {
    onClose()
  }

  const answeredAllTrial = trialAnswers.length === current.trial.length && trialAnswers.every((answer) => answer >= 0)
  const answeredAllQuiz = quizAnswers.length === current.quiz.length && quizAnswers.every((answer) => answer >= 0)
  const firstUnresolvedTrialIndex = current.trial.findIndex((item, index) => trialAnswers[index] !== item.answer)
  const activeTrialIndex = firstUnresolvedTrialIndex < 0 ? current.trial.length : firstUnresolvedTrialIndex
  const answeredAllExam = examAnswers.length === examQuestions.length && examAnswers.every((answer) => answer >= 0)

  return (
    <main className="learning-academy fixed inset-0 z-[100] overflow-y-auto px-4 pb-8 pt-24 text-white sm:px-8 sm:pt-28" dir={isArabic ? 'rtl' : 'ltr'}>
      <button type="button" className="academy-back-control" onClick={closeScreen} aria-label={copy(c('Back to menu', 'العودة للقائمة'))} title={copy(c('Back to menu', 'العودة للقائمة'))}><ArrowLeft size={17} /><span>{copy(c('MENU', 'القائمة'))}</span></button>
      <nav className="academy-floating-controls" aria-label={copy(c('Academy controls', 'أدوات الأكاديمية'))} dir="ltr">
        <button type="button" className="academy-hud-button" onClick={() => setDataOriginsOpen(true)} aria-label={copy(c('Data & sources', 'البيانات والمصادر'))} title={copy(c('Data & sources', 'البيانات والمصادر'))}><Database size={17} /></button>
        <button type="button" className="academy-hud-button" onClick={toggleSound} aria-label={soundEnabled ? copy(c('Mute sound', 'كتم الصوت')) : copy(c('Enable sound', 'تشغيل الصوت'))} title={soundEnabled ? copy(c('Mute sound', 'كتم الصوت')) : copy(c('Enable sound', 'تشغيل الصوت'))}>{soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
        <LanguageSwitch />
      </nav>

      <div className="mx-auto max-w-6xl academy-content">
        <header className="mb-7 flex flex-wrap items-start justify-between gap-4 border-b border-cyan-200/10 pb-5">
          <div>
            <p className="eyebrow"><BookOpenCheck size={14} /> {copy(c('MISSION TRAINING · FLIGHT ACADEMY', 'تدريب المهمة · أكاديمية الطيران'))}</p>
            <h1 className="mt-3 text-3xl font-black sm:text-5xl">{copy(c('Mission Systems Masterclass', 'دروس متقدمة في أنظمة المهمة'))}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{copy(c('Five lessons, one small step at a time: get the takeaway, try a quick check, then practice in a sandbox. Full notes are optional.', 'خمسة دروس بخطوة صغيرة كل مرة: تعرّف على الخلاصة، أجب عن اختبار سريع، ثم تدرّب في بيئة محاكاة. الملاحظات الكاملة اختيارية.'))}</p>
          </div>
          {onLaunch ? <button type="button" onClick={onLaunch} className="primary-button !px-4 !py-2 text-xs"><Play size={14} /> {copy(c('Launch training mission', 'ابدأ مهمة التدريب'))}</button> : null}
        </header>

        {storageError ? <p role="alert" className="mb-4 rounded-xl border border-rose-300/25 bg-rose-400/[.06] p-3 text-sm text-rose-200">{storageError}</p> : null}

        <section className="mb-5 grid gap-3 sm:grid-cols-3" aria-label={copy(c('Academy progress summary', 'ملخص تقدم الأكاديمية'))}>
          <article className="glass-panel p-4"><p className="eyebrow">{copy(c('LESSONS PASSED', 'الدروس المجتازة'))}</p><p className="mt-2 text-2xl font-black text-cyan-100">{completeCount} / {ACADEMY_PHASE_COUNT}</p><div className="academy-progress-track mt-3"><span style={{ transform: `scaleX(${percentage / 100})` }} /></div></article>
          <article className="glass-panel p-4"><p className="eyebrow">{copy(c('EXAM BEST SCORE', 'أفضل نتيجة للاختبار'))}</p><p className="mt-2 text-2xl font-black text-cyan-100">{Math.round(progress.examBestScore / EXAM.length * 100)}%</p><p className="mt-1 text-xs text-slate-500">{copy(c(`${progress.examAttempts} attempts`, `${progress.examAttempts} محاولات`))}</p></article>
          <article className={`glass-panel p-4 ${progress.certified ? 'academy-certified-summary' : ''}`}><p className="eyebrow">{copy(c('FLIGHT ACADEMY AWARD', 'جائزة أكاديمية الطيران'))}</p><p className="mt-2 flex items-center gap-2 text-lg font-black text-cyan-100">{progress.certified ? <><Award size={20} /> {copy(c('CERTIFIED · UNOFFICIAL', 'مُعتمد تعليميًا · غير رسمي'))}</> : copy(c('Not yet earned', 'لم تُكتسب بعد'))}</p><p className="mt-1 text-xs text-slate-500">{copy(c('Educational in-app award; not NASA-issued or endorsed.', 'جائزة تعليمية داخل التطبيق؛ ليست صادرة عن NASA أو مؤيدة منها.'))}</p></article>
        </section>

        <nav className="academy-roadmap mb-5" aria-label={copy(c('Five-lesson learning roadmap', 'خارطة التعلم من خمسة دروس'))}>
          {PHASES.map((phase, index) => {
            const PhaseIcon = phase.icon
            const id = index + 1
            const locked = id > unlockedPhaseCount && !progress.completedPhases.includes(id)
            const done = progress.completedPhases.includes(id)
            return (
              <button
                key={phase.title.en}
                type="button"
                disabled={locked}
                aria-current={phaseIndex === index ? 'step' : undefined}
                onClick={() => { setPhaseIndex(index); setScreen('lesson'); setTrialResult(null) }}
                className={`academy-phase-tab ${phaseIndex === index ? 'is-active' : ''} ${done ? 'is-complete' : ''}`}
              >
                <span className="academy-phase-number">{done ? <Check size={15} /> : <PhaseIcon size={15} />}</span>
                <span><b>{copy(c(`LESSON ${id}`, `الدرس ${id}`))}</b><small>{copy(phase.title)}</small></span>
              </button>
            )
          })}
          <button type="button" disabled={!examUnlocked} className={`academy-phase-tab academy-exam-tab ${screen === 'exam' ? 'is-active' : ''}`} onClick={beginExam}>
            <span className="academy-phase-number"><ClipboardCheck size={15} /></span>
            <span><b>{copy(c('KNOWLEDGE EXAM', 'اختبار المعرفة'))}</b><small>{copy(c('Optional review · 10 questions', 'مراجعة اختيارية · ١٠ أسئلة'))}</small></span>
          </button>
        </nav>

        {screen !== 'exam' ? (
          <section className="glass-panel academy-lesson-panel p-5 sm:p-8" key={`${phaseIndex}-${screen}`}>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="academy-phase-hero-icon"><Icon size={26} /></span>
                <div>
                  <p className="eyebrow">{copy(c(`LESSON ${phaseIndex + 1} · ${screen === 'trial' ? 'PRACTICAL TRIAL' : screen === 'quiz' ? '100% KNOWLEDGE CHECK' : completed ? 'PASSED' : 'THEORY READER'}`, `الدرس ${phaseIndex + 1} · ${screen === 'trial' ? 'تجربة عملية' : screen === 'quiz' ? 'اختبار المعرفة 100٪' : completed ? 'مجتاز' : 'المادة النظرية'}`))}</p>
                  <h2 className="mt-2 text-2xl font-black sm:text-3xl">{copy(current.title)}</h2>
                </div>
              </div>
              {completed ? <span className="academy-passed-badge"><Check size={14} /> {copy(c('LESSON PASSED', 'درس مجتاز'))}</span> : null}
            </div>

            {screen === 'lesson' ? (
              <>
            <aside className="academy-takeaway">
              <span className="academy-takeaway-label">{copy(c('QUICK TAKEAWAY', 'الخلاصة السريعة'))}</span>
              <p>{copy(current.subtitle)}</p>
            </aside>
            <div className="mb-6 grid gap-3 md:grid-cols-3">
              {current.metrics.map((metric) => (
                <article key={metric.label.en} className="academy-metric-card">
                      <span className="academy-metric-label">{copy(metric.label)}</span>
                      <strong>{metric.value}</strong>
                      <small>{copy(metric.note)}</small>
                    </article>
                  ))}
                </div>
                <details className="academy-theory-details">
                  <summary>{copy(c(`Read the full lesson notes (${current.theory.length})`, `اقرأ ملاحظات الدرس كاملة (${current.theory.length})`))}</summary>
                  <div className="academy-theory-list">
                    {current.theory.map((paragraph, index) => (
                      <article key={paragraph.en} className="academy-theory-card">
                        <span>{String(index + 1).padStart(2, '0')}</span>
                        <p>{copy(paragraph)}</p>
                      </article>
                    ))}
                  </div>
                </details>
                <details className="academy-theory-details academy-articles-details">
                  <summary>{copy(c(`Notes & Articles (${current.articles.length})`, `ملاحظات ومقالات (${current.articles.length})`))}</summary>
                  <div className="academy-article-list">
                    {current.articles.map((article) => (
                      <article key={article.url} className="academy-article-card">
                        <div>
                          <h3>{copy(article.title)}</h3>
                          <p>{copy(article.summary)}</p>
                        </div>
                        <a href={article.url} target="_blank" rel="noopener noreferrer">
                          {copy(c('Open NASA article', 'افتح مقال NASA'))}
                          <ArrowUpRight size={14} aria-hidden="true" />
                        </a>
                      </article>
                    ))}
                    <p className="academy-article-disclaimer">
                      {copy(c('These sources provide background science; they do not validate the game’s illustrative rates or thresholds.', 'تقدم هذه المصادر خلفية علمية، لكنها لا تصادق على معدلات اللعبة أو عتباتها التوضيحية.'))}
                    </p>
                  </div>
                </details>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                  <p className="max-w-2xl text-xs leading-5 text-slate-500">{copy(c('Rates and system values are game-model inputs or educational references. They are not operational guidance or NASA-qualified system specifications.', 'المعدلات وقيم الأنظمة مدخلات لنموذج اللعبة أو مراجع تعليمية، وليست إرشادات تشغيلية أو مواصفات أنظمة مؤهلة من NASA.'))}</p>
                  <button type="button" onClick={openQuiz} className="primary-button academy-launch-trial"><ClipboardCheck size={16} /> {copy(c(progress.quizPassedPhases.includes(phaseIndex + 1) ? 'Retake 100% Knowledge Check' : 'Start 100% Knowledge Check', progress.quizPassedPhases.includes(phaseIndex + 1) ? 'أعد اختبار المعرفة 100٪' : 'ابدأ اختبار المعرفة 100٪'))} <ArrowRight size={16} /></button>
                </div>
              </>
            ) : screen === 'quiz' ? (
              <>
                <div className="academy-trial-banner"><ClipboardCheck size={16} /><p>{copy(c('KNOWLEDGE GATE · Answer every question correctly (100%) to unlock this lesson’s practical simulation. Review the lesson and retry if needed.', 'بوابة المعرفة · أجب عن كل الأسئلة بشكل صحيح (100٪) لفتح المحاكاة العملية لهذا الدرس. راجع الدرس وأعد المحاولة عند الحاجة.'))}</p></div>
                <div className="mt-5 space-y-5">
                  {current.quiz.map((item, itemIndex) => (
                    <fieldset key={item.prompt.en} className="academy-question">
                      <legend><span>{copy(c(`QUESTION ${itemIndex + 1}`, `السؤال ${itemIndex + 1}`))}</span>{copy(item.prompt)}</legend>
                      <div className="mt-3 grid gap-2">
                        {item.options.map((option, optionIndex) => (
                          <label key={option.en} className={`academy-answer-option ${quizAnswers[itemIndex] === optionIndex ? 'is-selected' : ''}`}>
                            <input type="radio" name={`quiz-${phaseIndex}-${itemIndex}`} checked={quizAnswers[itemIndex] === optionIndex} onChange={() => selectQuizAnswer(itemIndex, optionIndex)} />
                            <span>{copy(option)}</span>
                          </label>
                        ))}
                      </div>
                      {quizResult ? <p className={`academy-rationale ${quizAnswers[itemIndex] === item.answer ? 'is-correct' : 'is-incorrect'}`}><CircleAlert size={14} />{copy(item.rationale)}</p> : null}
                    </fieldset>
                  ))}
                </div>
                {quizResult === 'passed' ? (
                  <div role="status" className="academy-result-banner is-passed">
                    <Check size={20} />
                    <div><strong>{copy(c('100% · Knowledge check passed', '100٪ · اجتزت اختبار المعرفة'))}</strong><p>{copy(c('The pass is saved on this device. You can now launch the targeted practical scenario.', 'حُفظ النجاح على هذا الجهاز. يمكنك الآن بدء السيناريو العملي المخصص.'))}</p></div>
                    <button type="button" onClick={openTrial} className="primary-button !px-4 !py-2 text-xs"><Zap size={14} /> {copy(c('Start Practical Trial', 'ابدأ التجربة العملية'))} <ArrowRight size={14} /></button>
                  </div>
                ) : quizResult === 'failed' ? (
                  <div role="status" className="academy-result-banner is-failed">
                    <CircleAlert size={20} />
                    <div><strong>{copy(c('Not 100% yet — review and retry', 'لم تصل إلى 100٪ — راجع وأعد المحاولة'))}</strong><p>{copy(c('Every answer must be correct to unlock the practical trial.', 'يجب أن تكون كل الإجابات صحيحة لفتح التجربة العملية.'))}</p></div>
                    <button type="button" onClick={openQuiz} className="secondary-button !px-3 !py-2 text-xs"><RotateCcw size={14} /> {copy(c('Retry Check', 'أعد الاختبار'))}</button>
                  </div>
                ) : (
                  <button type="button" disabled={!answeredAllQuiz} onClick={submitQuiz} className="primary-button mt-5"><Check size={16} /> {copy(c('Submit Knowledge Check', 'أرسل اختبار المعرفة'))}</button>
                )}
                <button type="button" onClick={() => { setScreen('lesson'); setQuizResult(null) }} className="secondary-button ms-2 mt-5 !px-4 !py-2 text-xs"><BookOpenCheck size={14} /> {copy(c('Re-read Lesson', 'أعد قراءة الدرس'))}</button>
              </>
            ) : (
              <>
                <div className="academy-trial-banner"><Zap size={16} /><p className="min-w-0 flex-1"><strong>{copy(c('CONTROLLED SANDBOX · ', 'ساحة تدريب محكومة · '))}</strong>{copy(current.scenario)}<br />{copy(c('This drill is separate from your saved mission. Complete the decisions in sequence before the timer expires.', 'هذا التدريب منفصل عن مهمتك المحفوظة. أكمل القرارات بالتتابع قبل انتهاء المؤقت.'))}</p><span role="timer" aria-label={copy(c('Time remaining', 'الوقت المتبقي'))} className="shrink-0 rounded-full border border-cyan-200/20 bg-slate-950/50 px-3 py-1 font-mono text-sm font-bold text-cyan-100">{String(Math.floor((trialSecondsLeft ?? 0) / 60)).padStart(2, '0')}:{String((trialSecondsLeft ?? 0) % 60).padStart(2, '0')}</span></div>
                <div className="mt-5 space-y-5">
                  {current.trial.map((item, itemIndex) => (
                    <fieldset key={item.prompt.en} disabled={trialResult !== null || itemIndex > activeTrialIndex} className="academy-question">
                      <legend><span>{copy(c(`DECISION ${itemIndex + 1}`, `القرار ${itemIndex + 1}`))}</span>{copy(item.prompt)}</legend>
                      <div className="mt-3 grid gap-2">
                        {item.options.map((option, optionIndex) => (
                          <label key={option.en} className={`academy-answer-option ${trialAnswers[itemIndex] === optionIndex ? 'is-selected' : ''}`}>
                            <input type="radio" name={`trial-${phaseIndex}-${itemIndex}`} checked={trialAnswers[itemIndex] === optionIndex} onChange={() => selectAnswer(itemIndex, optionIndex)} />
                            <span>{copy(option)}</span>
                          </label>
                        ))}
                      </div>
                      {trialResult ? <p className={`academy-rationale ${trialAnswers[itemIndex] === item.answer ? 'is-correct' : 'is-incorrect'}`}><CircleAlert size={14} />{copy(item.rationale)}</p> : null}
                    </fieldset>
                  ))}
                </div>
                {trialResult ? (
                  <div role="status" className={`academy-result-banner ${trialResult === 'passed' ? 'is-passed' : 'is-failed'}`}>
                    {trialResult === 'passed' ? <Check size={20} /> : <CircleAlert size={20} />}
                    <div><strong>{copy(trialResult === 'passed' ? c(phaseIndex === PHASES.length - 1 ? 'Final trial passed — learning award earned' : 'Trial passed — next lesson unlocked', phaseIndex === PHASES.length - 1 ? 'اجتزت التجربة النهائية — حصلت على الجائزة التعليمية' : 'اجتزت التجربة — فُتح الدرس التالي') : c('Trial not passed — review the feedback', 'لم تجتز التجربة — راجع الملاحظات'))}</strong><p>{copy(trialResult === 'passed' ? c(phaseIndex === PHASES.length - 1 ? 'You completed all five lessons and earned an unofficial in-app educational certificate. The full simulation sandbox is now unlocked.' : 'Your decisions protected crew safety and mission priorities. Your progress is saved on this device.', phaseIndex === PHASES.length - 1 ? 'أكملت الدروس الخمسة وحصلت على شهادة تعليمية غير رسمية داخل التطبيق. فُتحت ساحة المحاكاة الكاملة.' : 'حمت قراراتك سلامة الطاقم وأولويات المهمة. حُفظ تقدمك على هذا الجهاز.') : c('Review each decision rationale, then retry this controlled scenario.', 'راجع تفسير كل قرار ثم أعد هذه التجربة المحكومة.'))}</p></div>
                    {trialResult === 'failed' ? <button type="button" onClick={() => { setTrialAnswers(Array(current.trial.length).fill(-1)); setTrialResult(null); setTrialSecondsLeft(trialDurationSeconds) }} className="secondary-button !px-3 !py-2 text-xs"><RotateCcw size={14} /> {copy(c('Retry Trial', 'أعد التجربة'))}</button> : <button type="button" onClick={() => { setScreen('lesson'); setTrialSecondsLeft(null); if (phaseIndex < PHASES.length - 1) setPhaseIndex(phaseIndex + 1) }} className="secondary-button !px-3 !py-2 text-xs">{copy(c(phaseIndex === PHASES.length - 1 ? 'Review lesson' : 'Next lesson', phaseIndex === PHASES.length - 1 ? 'راجع الدرس' : 'الدرس التالي'))} <ArrowRight size={14} /></button>}
                  </div>
                ) : (
                  <button type="button" disabled={!answeredAllTrial} onClick={submitTrial} className="primary-button mt-5"><Check size={16} /> {copy(c('Submit trial decisions', 'أرسل قرارات التجربة'))}</button>
                )}
                <button type="button" onClick={() => { setScreen('lesson'); setTrialResult(null); setTrialSecondsLeft(null) }} className="secondary-button ms-2 mt-5 !px-4 !py-2 text-xs"><BookOpenCheck size={14} /> {copy(c('Re-read Lesson', 'أعد قراءة الدرس'))}</button>
              </>
            )}
          </section>
        ) : (
          <section className="glass-panel academy-lesson-panel p-5 sm:p-8" key="exam">
            <div className="mb-6 flex items-center gap-4">
              <span className="academy-phase-hero-icon"><ClipboardCheck size={26} /></span>
              <div><p className="eyebrow">{copy(c('OPTIONAL KNOWLEDGE REVIEW · 80% TARGET', 'مراجعة معرفة اختيارية · الهدف ٨٠٪'))}</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">{copy(c('Mission Systems Knowledge Review', 'مراجعة معرفة أنظمة المهمة'))}</h2><p className="mt-1 text-sm text-slate-400">{copy(c('Ten questions · all five lessons · unlimited retries', 'عشرة أسئلة · الدروس الخمسة · محاولات غير محدودة'))}</p></div>
            </div>
            {progress.certified ? (
              <div className="academy-certificate mb-6">
                <Award size={34} />
                <div>
                  <p className="eyebrow">{copy(c('COMPLETION AWARD · UNOFFICIAL', 'جائزة إتمام · غير رسمية'))}</p>
                  <h3>{copy(c('Junior Astronaut Flight Academy Certificate', 'شهادة أكاديمية طيران رائد الفضاء الصغير'))}</h3>
                  <label className="mt-3 block text-xs font-semibold text-slate-300" htmlFor="academy-learner-name">{copy(c('Name for certificate', 'الاسم على الشهادة'))}</label>
                  <input id="academy-learner-name" value={learnerNameDraft} maxLength={80} onChange={(event) => setLearnerNameDraft(event.target.value)} onBlur={saveLearnerName} placeholder={copy(c('Mission trainee', 'متدرب المهمة'))} className="mt-1 w-full max-w-sm rounded-lg border border-cyan-100/15 bg-slate-950/55 px-3 py-2 text-sm text-white outline-none focus:border-cyan-200/50" />
                  <p>{copy(c(`Final practical passed · Optional review best score ${Math.round(progress.examBestScore / EXAM.length * 100)}% · This educational award is not issued or endorsed by NASA.`, `اجتياز التجربة العملية النهائية · أفضل نتيجة للمراجعة الاختيارية ${Math.round(progress.examBestScore / EXAM.length * 100)}٪ · هذه الجائزة التعليمية ليست صادرة عن NASA أو مؤيدة منها.`))}</p>
                  <button type="button" onClick={downloadCertificate} className="secondary-button mt-3 !px-3 !py-2 text-xs"><Award size={14} /> {copy(c('Download certificate', 'تنزيل الشهادة'))}</button>
                </div>
              </div>
            ) : null}
            <div className="space-y-5">
              {examQuestions.map((item, itemIndex) => (
                <fieldset key={`${item.prompt.en}-${itemIndex}`} className="academy-question">
                  <legend><span>{copy(c(`QUESTION ${itemIndex + 1}`, `السؤال ${itemIndex + 1}`))}</span>{copy(item.prompt)}</legend>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {item.options.map((option, optionIndex) => {
                      const isCorrectAnswer = examResult && optionIndex === item.answer
                      const isWrongSelection = examResult && examAnswers[itemIndex] === optionIndex && optionIndex !== item.answer
                      return (
                        <label key={option.en} className={`academy-answer-option ${examAnswers[itemIndex] === optionIndex ? 'is-selected' : ''} ${isCorrectAnswer ? 'is-answer-correct' : ''} ${isWrongSelection ? 'is-answer-wrong' : ''}`}>
                          <input type="radio" name={`exam-${itemIndex}`} checked={examAnswers[itemIndex] === optionIndex} onChange={() => selectExamAnswer(itemIndex, optionIndex)} />
                          <span>{copy(option)}</span>
                        </label>
                      )
                    })}
                  </div>
                  {examResult && examResult.missed.includes(itemIndex) ? <p className="academy-rationale is-incorrect"><CircleAlert size={14} />{copy(item.rationale)}</p> : null}
                </fieldset>
              ))}
            </div>
            {examResult ? (
              <div role="status" className={`academy-result-banner mt-6 ${examScore !== null && examScore >= 80 ? 'is-passed' : 'is-failed'}`}>
                {examScore !== null && examScore >= 80 ? <Award size={22} /> : <CircleAlert size={22} />}
                <div><strong>{copy(c(`Score: ${examResult.score} / ${EXAM.length} (${examScore}%)`, `النتيجة: ${examResult.score} / ${EXAM.length} (${examScore}٪)`))}</strong><p>{copy(examScore !== null && examScore >= 80 ? c('Passed. The full sandbox and learning award were already unlocked by your successful final practical trial.', 'نجحت. كانت ساحة المحاكاة الكاملة والجائزة التعليمية قد فُتحتا بعد اجتياز التجربة العملية النهائية.') : c('Not passed yet. Review the highlighted explanations and retry when ready. This optional exam does not revoke your final-trial award.', 'لم تنجح بعد. راجع التفسيرات الموضحة وأعد المحاولة عندما تكون مستعدًا. لا يلغي هذا الاختبار الاختياري جائزتك بعد اجتياز التجربة النهائية.'))}</p></div>
                <button type="button" onClick={beginExam} className="secondary-button !px-3 !py-2 text-xs"><RotateCcw size={14} /> {copy(c('Retry Exam', 'أعد الاختبار'))}</button>
              </div>
            ) : (
              <button type="button" disabled={!answeredAllExam} onClick={submitExam} className="primary-button mt-6"><Check size={16} /> {copy(c('Submit Final Exam', 'أرسل الاختبار النهائي'))}</button>
            )}
            <p className="mt-5 text-xs leading-5 text-slate-500">{copy(c('Educational assessment only. This course and its certificate do not confer NASA affiliation, accreditation, or operational qualification.', 'تقييم تعليمي فقط. لا تمنح هذه الدورة أو شهادتها انتسابًا إلى NASA أو اعتمادًا أو تأهيلًا تشغيليًا.'))}</p>
          </section>
        )}

        {examUnlocked ? (
          <section className="mt-5 glass-panel flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3"><Award size={21} className={progress.certified ? 'text-cyan-200' : 'text-slate-500'} /><div><b className="text-sm">{copy(c(progress.certified ? 'Full sandbox unlocked' : 'All phase trials passed · Exam unlocked', progress.certified ? 'فُتحت ساحة المحاكاة الكاملة' : 'اجتزت تجارب المراحل · فُتح الاختبار'))}</b><p className="mt-1 text-xs text-slate-500">{copy(c('The main simulation remains an educational model and can now be configured freely.', 'تظل المحاكاة الرئيسية نموذجًا تعليميًا ويمكن الآن تهيئتها بحرية.'))}</p></div></div>
            {!progress.certified ? <button type="button" onClick={beginExam} className="primary-button !px-4 !py-2 text-xs"><ClipboardCheck size={14} /> {copy(c('Take certification exam', 'ابدأ اختبار الشهادة'))}</button> : null}
          </section>
        ) : null}
      </div>
      {dataOriginsOpen ? <DataOriginsModal onClose={() => setDataOriginsOpen(false)} /> : null}
    </main>
  )
}
