import type { MissionObjective, MissionType } from './model'

export interface MissionProfile {
  minimumCrew: number
  objective: MissionObjective
  goal: { en: string; ar: string }
  goalDescription: { en: string; ar: string }
  equipment: { en: string; ar: string }[]
  dailyActivities: { en: string; ar: string }[]
  sources: { label: { en: string; ar: string }; url: string }[]
}

const moonFacts = 'https://science.nasa.gov/moon/facts/'
const moonWater = 'https://science.nasa.gov/moon/moon-water-and-ices/'
const marsFacts = 'https://science.nasa.gov/mars/facts/'

export const MISSION_PROFILES: Readonly<Record<MissionType, MissionProfile>> = {
  'moon-exploration': {
    minimumCrew: 2,
    objective: 'science',
    goal: { en: 'Short-Term Surface Exploration', ar: 'استكشاف سطحي قصير الأمد' },
    goalDescription: {
      en: 'Collect core geological samples, perform radiation telemetry, and analyze samples via Mass Spectrometer.',
      ar: 'جمع عينات جيولوجية أساسية، وإجراء قياسات الإشعاع، وتحليل العينات بمطياف الكتلة.',
    },
    equipment: [
      { en: 'Pressurized or unpressurized rover', ar: 'عربة جوالة مضغوطة أو غير مضغوطة' },
      { en: 'Handheld rock drills and sensing tools', ar: 'أدوات حفر الصخور اليدوية وأجهزة الاستشعار' },
      { en: 'Portable mass spectrometer', ar: 'مطياف كتلة محمول' },
      { en: 'Surface radiation and dosimetry instruments', ar: 'أجهزة قياس الإشعاع السطحي والجرعات' },
    ],
    dailyActivities: [
      { en: 'EVA field shifts to collect samples and analyze them in the temporary lab', ar: 'ورديات استكشاف خارج المركبة لجمع العينات وتحليلها في المختبر المؤقت' },
      { en: 'Calibrate science instruments and verify cosmic-radiation readings', ar: 'معايرة الأجهزة العلمية والتحقق من قراءات الإشعاع الكوني' },
      { en: 'Inspect spacesuits and replenish their oxygen supplies', ar: 'فحص بدلات الفضاء وإعادة تعبئة خزانات الأكسجين' },
    ],
    sources: [
      { label: { en: 'NASA Moon facts', ar: 'حقائق NASA عن القمر' }, url: moonFacts },
      { label: { en: 'NASA lunar water and ice', ar: 'ماء القمر وجليده لدى NASA' }, url: moonWater },
    ],
  },
  'moon-settlement': {
    minimumCrew: 6,
    objective: 'survival',
    goal: { en: 'Lunar Base Construction', ar: 'إنشاء قاعدة قمرية' },
    goalDescription: {
      en: 'Establish landing pads, deploy Kilopower fission reactors, and initialize ISRU water extraction.',
      ar: 'إنشاء منصات الهبوط، ونشر مفاعلات انشطار من فئة كيلوباور، وبدء استخراج الماء بالموارد المحلية (ISRU).',
    },
    equipment: [
      { en: 'Construction robots and autonomous 3D printers', ar: 'روبوتات البناء والطابعات الآلية ثلاثية الأبعاد' },
      { en: 'Kilopower-class reactor module and high-capacity batteries', ar: 'وحدة مفاعل من فئة كيلوباور وبطاريات عالية السعة' },
      { en: 'ISRU units for extracting water from lunar regolith', ar: 'وحدات موارد محلية لاستخراج الماء من الثرى القمري' },
      { en: 'Landing-pad excavation equipment; keep the landing site at least 100 units from the habitat', ar: 'معدات حفر منصة الهبوط؛ إبعاد موقعها ١٠٠ وحدة على الأقل عن المأوى' },
    ],
    dailyActivities: [
      { en: 'Continuous construction shifts supervised by infrastructure and reactor engineers', ar: 'ورديات بناء مستمرة بإشراف مهندسي البنية التحتية والمفاعلات' },
      { en: 'Monitor solar-array performance and battery-bank charge', ar: 'مراقبة كفاءة الألواح الشمسية ومستويات شحن البطاريات' },
      { en: 'Inspect water and air recycling (ECLSS) as the workforce grows', ar: 'فحص أنظمة تدوير الماء والهواء (ECLSS) مع زيادة عدد العاملين' },
    ],
    sources: [
      { label: { en: 'NASA Moon facts', ar: 'حقائق NASA عن القمر' }, url: moonFacts },
      { label: { en: 'NASA lunar water and ice', ar: 'ماء القمر وجليده لدى NASA' }, url: moonWater },
    ],
  },
  'mars-opposition': {
    minimumCrew: 4,
    objective: 'exploration',
    goal: { en: 'Short Opposition Exploration', ar: 'استكشاف قصير خلال المقابلة المريخية' },
    goalDescription: {
      en: 'Analyze perchlorate-rich regolith, test deep-ice drilling tools, and search for astrobiology indicators.',
      ar: 'تحليل الثرى الغني بالبيركلورات، واختبار أدوات حفر الجليد العميق، والبحث عن مؤشرات الأحياء الفلكية.',
    },
    equipment: [
      { en: 'Long-range Mars rover with solar panels and radioisotope power', ar: 'عربة مريخية طويلة المدى بألواح شمسية ومولد طاقة بالنظائر المشعة' },
      { en: 'Deep-drilling kit for subsurface ice prospecting', ar: 'عدة حفر عميق للبحث عن الجليد تحت السطح' },
      { en: 'Sterile, isolated sample tubes to limit perchlorate contamination', ar: 'أنابيب عينات معقمة ومعزولة للحد من تلوث البيركلورات' },
      { en: 'Optical spectroscopy and soil-chemistry instruments', ar: 'أجهزة التحليل الطيفي الضوئي وكيمياء التربة' },
    ],
    dailyActivities: [
      { en: 'Scheduled geological rover traverses within the base safety range', ar: 'رحلات جيولوجية مجدولة بالعربة ضمن النطاق الآمن للقاعدة' },
      { en: 'Clean suit and rover equipment to manage regolith dust and perchlorates', ar: 'تنظيف البدلات ومعدات العربات للتعامل مع غبار الثرى والبيركلورات' },
      { en: 'Analyze collected samples in the astrobiology laboratory', ar: 'تحليل العينات المجموعة في مختبر الأحياء الفلكية' },
    ],
    sources: [
      { label: { en: 'NASA Mars facts', ar: 'حقائق NASA عن المريخ' }, url: marsFacts },
    ],
  },
  'mars-conjunction': {
    minimumCrew: 6,
    objective: 'survival',
    goal: { en: 'Long Conjunction Settlement', ar: 'استيطان طويل خلال الاقتران الشمسي للمريخ' },
    goalDescription: {
      en: 'Operate Astro-Botany greenhouses, run Sabatier fuel/water recovery reactors, and achieve long-term base self-sustainability.',
      ar: 'تشغيل صوبات الزراعة الفضائية، ومفاعلات ساباتيه لاستعادة الوقود والماء، وتحقيق الاكتفاء الذاتي للقاعدة على المدى الطويل.',
    },
    equipment: [
      { en: 'Automated astro-botany greenhouses with perchlorate soil filters', ar: 'صوبات زراعية آلية مع مرشحات للبيركلورات في التربة' },
      { en: 'Sabatier reactors to produce methane, water, and oxygen from Mars resources', ar: 'مفاعلات ساباتيه لإنتاج الميثان والماء والأكسجين من موارد المريخ' },
      { en: 'High-capacity resource-recycling systems (90–98% game-model efficiency by difficulty)', ar: 'أنظمة تدوير موارد كبرى (كفاءة نموذج اللعبة ٩٠–٩٨٪ حسب الصعوبة)' },
    ],
    dailyActivities: [
      { en: 'Manage greenhouse sowing, irrigation, harvest, and growth checks; model target: 20 kg food and 3 kg oxygen per cycle', ar: 'إدارة بذر الصوبة وريها وحصادها وفحص نمو النباتات؛ هدف النموذج ٢٠ كجم طعام و٣ كجم أكسجين لكل دورة' },
      { en: 'Monitor carbon dioxide, adjust levels, and operate CO₂ scrubbers', ar: 'مراقبة مستويات ثاني أكسيد الكربون وضبطها وتشغيل أجهزة استخلاصه' },
      { en: 'Complete the required 2.5 hours of daily exercise to counter deconditioning', ar: 'إكمال التمرين اليومي الإلزامي لمدة ساعتين ونصف لمقاومة تراجع اللياقة' },
    ],
    sources: [
      { label: { en: 'NASA Mars facts', ar: 'حقائق NASA عن المريخ' }, url: marsFacts },
    ],
  },
}
