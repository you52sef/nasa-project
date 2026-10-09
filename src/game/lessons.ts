export interface Lesson {
  id: number
  title: { ar: string; en: string }
  preQuestion: { ar: string; en: string }
  options: { ar: string[]; en: string[] }
  preAnswer: number
  content: { ar: string; en: string }
  postQuestion: { ar: string; en: string }
  postOptions: { ar: string[]; en: string[] }
  postAnswer: number
}

export const LESSONS: Lesson[] = [
  {
    id: 1, title: { ar: 'لماذا القمر؟', en: 'Why the Moon?' },
    preQuestion: { ar: 'ما أقرب جسم سماوي طبيعي إلى الأرض؟', en: 'What is the closest natural celestial body to Earth?' },
    options: { ar: ['القمر', 'المريخ', 'الشمس'], en: ['The Moon', 'Mars', 'The Sun'] }, preAnswer: 0,
    content: {
      ar: 'القمر أقرب جار سماوي لنا، ويبعد في المتوسط نحو 384,400 كم. تستغرق رحلة المركبة بضعة أيام فقط، لذلك يُعد مكانًا مناسبًا لاختبار تقنيات العيش والعمل قبل الرحلات الأبعد.',
      en: 'The Moon is our closest celestial neighbor, about 384,400 km away on average. A spacecraft can reach it in a few days, making it a useful place to test living and working technologies before farther journeys.',
    },
    postQuestion: { ar: 'ما الذي يجعل القمر مكانًا مناسبًا لاختبار التقنيات؟', en: 'Why is the Moon useful for testing technologies?' },
    postOptions: { ar: ['قربه النسبي من الأرض', 'وجود غلاف جوي كثيف', 'وجود محيطات واسعة'], en: ['Its relative closeness to Earth', 'Its thick atmosphere', 'Its large oceans'] }, postAnswer: 0,
  },
  {
    id: 2, title: { ar: 'تحديات المريخ', en: 'Mars challenges' },
    preQuestion: { ar: 'ما الغاز الأكثر وفرة في جو المريخ؟', en: 'Which gas is most abundant in Mars’ atmosphere?' },
    options: { ar: ['الأكسجين', 'ثاني أكسيد الكربون', 'النيتروجين'], en: ['Oxygen', 'Carbon dioxide', 'Nitrogen'] }, preAnswer: 1,
    content: {
      ar: 'الغلاف الجوي للمريخ رقيق جدًا ويتكون في معظمه من ثاني أكسيد الكربون، ولا يستطيع الإنسان التنفس فيه. كما يواجه المستكشفون البرد والإشعاع والعواصف الترابية، لذا يحتاجون إلى موائل محكمة وأنظمة موثوقة.',
      en: 'Mars has a very thin atmosphere made mostly of carbon dioxide, which humans cannot breathe. Explorers also face cold, radiation, and dust storms, so they need sealed habitats and dependable life-support systems.',
    },
    postQuestion: { ar: 'لماذا يحتاج رواد المريخ إلى موئل محكم؟', en: 'Why do Mars explorers need a sealed habitat?' },
    postOptions: { ar: ['لأن الجو غير قابل للتنفس ورقيق', 'لأن الجاذبية معدومة', 'لأن الشمس لا تشرق'], en: ['The atmosphere is thin and unbreathable', 'There is no gravity', 'The Sun never rises'] }, postAnswer: 0,
  },
  {
    id: 3, title: { ar: 'دورة الماء', en: 'The water cycle' },
    preQuestion: { ar: 'ما أفضل طريقة لزيادة الماء في قاعدة بعيدة؟', en: 'What is a good way to increase water at a remote base?' },
    options: { ar: ['إعادة تدوير الماء', 'ترك الصنابير مفتوحة', 'استخدامه مرة واحدة فقط'], en: ['Recycle water', 'Leave taps running', 'Use it only once'] }, preAnswer: 0,
    content: {
      ar: 'كل قطرة ماء مهمة في الفضاء. أنظمة دعم الحياة تجمع الرطوبة وتُنقّي المياه المستخدمة لإعادة استعمالها. وعلى القمر والمريخ قد تساعد معالجة الجليد المحلي مستقبلًا في دعم الطواقم.',
      en: 'Every drop matters in space. Life-support systems collect moisture and purify used water so it can be reused. Processing local ice on the Moon or Mars may support future crews.',
    },
    postQuestion: { ar: 'لماذا تُعاد تدوير المياه في الموائل الفضائية؟', en: 'Why is water recycled in space habitats?' },
    postOptions: { ar: ['لأن الإمدادات محدودة', 'لزيادة الجاذبية', 'لتقليل ضوء الشمس'], en: ['Supplies are limited', 'To increase gravity', 'To reduce sunlight'] }, postAnswer: 0,
  },
  {
    id: 4, title: { ar: 'الطاقة الشمسية', en: 'Solar power' },
    preQuestion: { ar: 'ما الذي يحوّل ضوء الشمس إلى كهرباء؟', en: 'What converts sunlight into electricity?' },
    options: { ar: ['الألواح الشمسية', 'الرادار', 'الهوائيات'], en: ['Solar panels', 'Radar', 'Antennas'] }, preAnswer: 0,
    content: {
      ar: 'تحوّل الخلايا الشمسية الضوء إلى كهرباء لتشغيل الأجهزة. يتغير إنتاجها مع زاوية الشمس والغبار والظل؛ لذلك تستخدم القواعد البطاريات أو مصادر طاقة أخرى لتوفير الكهرباء عند انخفاض الإضاءة.',
      en: 'Solar cells convert light into electricity for equipment. Their output changes with sunlight angle, dust, and shadow, so bases use batteries or other power sources when light is low.',
    },
    postQuestion: { ar: 'ما فائدة البطاريات في قاعدة فضائية؟', en: 'Why does a space base use batteries?' },
    postOptions: { ar: ['تخزين الطاقة للاستخدام لاحقًا', 'صنع الأكسجين', 'إصلاح المحاصيل'], en: ['Store energy for later', 'Make oxygen', 'Repair crops'] }, postAnswer: 0,
  },
  {
    id: 5, title: { ar: 'الزراعة في الفضاء', en: 'Growing food in space' },
    preQuestion: { ar: 'ما الذي تحتاجه النباتات لتنمو؟', en: 'What do plants need to grow?' },
    options: { ar: ['ماء وضوء ومغذيات', 'صخور فقط', 'أكسجين فقط'], en: ['Water, light, and nutrients', 'Rocks only', 'Oxygen only'] }, preAnswer: 0,
    content: {
      ar: 'تسمح الدفيئات بزراعة الطعام في بيئة محكومة. تحتاج النباتات إلى الماء والضوء والمغذيات، وتُراقَب حرارتها ورطوبتها بعناية. كما تساعد النباتات على تجديد جزء من الهواء وتمنح الطاقم غذاءً طازجًا.',
      en: 'Greenhouses let crews grow food in a controlled environment. Plants need water, light, and nutrients, while temperature and humidity must be monitored. Plants can also refresh some air and provide fresh food.',
    },
    postQuestion: { ar: 'ما فائدة إضافية للنباتات في الموائل؟', en: 'What is another benefit of plants in habitats?' },
    postOptions: { ar: ['تساعد على تجديد بعض الهواء', 'تمنع الجاذبية', 'تنتج المعادن'], en: ['They help refresh some air', 'They remove gravity', 'They produce minerals'] }, postAnswer: 0,
  },
  {
    id: 6, title: { ar: 'الإشعاع الفضائي', en: 'Space radiation' },
    preQuestion: { ar: 'ما الذي يساعد في حماية الطاقم من الإشعاع؟', en: 'What can help shield a crew from radiation?' },
    options: { ar: ['الملاجئ والمواد الواقية', 'زيادة سرعة المركبة', 'إطفاء الأنوار'], en: ['Shelters and shielding materials', 'Increasing spacecraft speed', 'Turning off lights'] }, preAnswer: 0,
    content: {
      ar: 'الغلاف الجوي والمجال المغناطيسي للأرض يخففان كثيرًا من الإشعاع. خارج هذه الحماية، تخطط المهمات لاستخدام دروع وموائل محمية ومراقبة الطقس الفضائي. الملجأ الجيد يقلل التعرض أثناء العواصف الشمسية.',
      en: 'Earth’s atmosphere and magnetic field block much radiation. Beyond that protection, missions plan shielding, protected habitats, and space-weather monitoring. A well-designed shelter reduces exposure during solar storms.',
    },
    postQuestion: { ar: 'متى تكون حماية الملجأ مهمة خصوصًا؟', en: 'When is shelter protection especially important?' },
    postOptions: { ar: ['أثناء العواصف الشمسية', 'أثناء شروق الشمس فقط', 'عند زراعة النباتات'], en: ['During solar storms', 'Only at sunrise', 'When planting crops'] }, postAnswer: 0,
  },
]
