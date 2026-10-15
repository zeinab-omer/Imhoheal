// English/Arabic strings for the current EmoHeal interface. The supplied
// example page contains demo copy, so only its switcher behavior is reused.
const ar = {
  "Home":"الرئيسية","Patients":"المرضى","AI assistant":"المساعد الذكي","My recovery":"تعافيي","Sign in":"تسجيل الدخول","Sign out":"تسجيل الخروج","Doctor":"طبيب","Patient":"مريض","Main":"القائمة الرئيسية","Skip to content":"تخطَّ إلى المحتوى",
  "A connected prototype for orthopedic research":"نموذج متصل لأبحاث جراحة العظام","ImhoHeal is exploring ESP32-based motion sensing and a doctor-facing dashboard. The current MPU6050 prototype records movement; it does not directly measure bone healing.":"يستكشف إمحوهيل استشعار الحركة باستخدام ESP32 ولوحة متابعة للأطباء. يسجل نموذج MPU6050 الحالي الحركة، ولا يقيس التئام العظام مباشرةً.","Open your dashboard":"افتح لوحة المتابعة","See how it works":"شاهد طريقة العمل","From the plate to the care team":"من صفيحة التثبيت إلى فريق الرعاية","One loop, from the implant in the bone to a decision in the clinic.":"رحلة متكاملة من الغرسة داخل العظم إلى القرار في العيادة.",
  "The prototype senses motion":"يرصد النموذج الحركة","An ESP32 with an MPU6050 can send movement and rotation samples to the dashboard. It does not measure bone density or plate strain.":"يمكن لوحدة ESP32 مع MPU6050 إرسال عينات الحركة والدوران إلى لوحة المتابعة. وهي لا تقيس كثافة العظام أو الحمل على الصفيحة.","The dashboard organizes readings":"تنظم لوحة المتابعة القراءات","The current motion view plots sensor samples. The separate healing analysis uses fictional demo readings and is not a trained medical AI.":"يعرض قسم الحركة عينات المستشعر. أما تحليل الالتئام فيستخدم قراءات تجريبية افتراضية، وليس ذكاءً اصطناعيًا طبيًا مدربًا.","Your care team acts":"يتابع فريق الرعاية حالتك","Doctors can pair a device to a demo patient. Patients see only their own record. The prototype is not for clinical decisions.":"يمكن للأطباء ربط جهاز بسجل مريض تجريبي. ولا يرى المرضى سوى سجلاتهم. هذا النموذج غير مخصص لاتخاذ قرارات سريرية.",
  "The platform today":"المنصة اليوم","Aggregate figures only. No individual patient appears in this section.":"أرقام إجمالية فقط؛ لا تظهر بيانات أي مريض بعينه في هذا القسم.","Loading platform figures…":"جارٍ تحميل إحصاءات المنصة…","Monitored cases":"الحالات المتابعة","Recovering on track":"حالات تسير وفق المسار المتوقع","Average weeks monitored":"متوسط أسابيع المتابعة","Average review":"متوسط التقييم","Calculated from the fictional demo cohort.":"محسوب من مجموعة بيانات تجريبية افتراضية.",
  "Sign in to ImhoHeal":"تسجيل الدخول إلى إمحوهيل","Doctors see every patient. Patients see only their own recovery.":"يمكن للأطباء رؤية جميع المرضى، بينما يرى كل مريض سجل تعافيه فقط.","Email address":"البريد الإلكتروني","Password":"كلمة المرور","Invited accounts only":"للحسابات المدعوة فقط","An administrator must invite your email address. Use the password you created from the invitation link.":"يجب أن يرسل المسؤول دعوة إلى بريدك الإلكتروني. استخدم كلمة المرور التي أنشأتها من رابط الدعوة.","Enter your email address and password.":"أدخل بريدك الإلكتروني وكلمة المرور.","Signing in…":"جارٍ تسجيل الدخول…","Choose your password":"اختر كلمة المرور","Set a password for your ImhoHeal account before continuing.":"أنشئ كلمة مرور لحسابك في إمحوهيل قبل المتابعة.","New password":"كلمة المرور الجديدة","Confirm password":"تأكيد كلمة المرور","Save password":"حفظ كلمة المرور","Use a password between 8 and 128 characters.":"استخدم كلمة مرور من 8 إلى 128 حرفًا.","The passwords do not match.":"كلمتا المرور غير متطابقتين.","Saving…":"جارٍ الحفظ…",
  "Patient recovery":"تعافي المرضى","Select a patient to review sensor data, AI findings, and the projected healing path.":"اختر مريضًا لمراجعة بيانات المستشعر ونتائج التحليل ومسار الالتئام المتوقع.","Loading patients…":"جارٍ تحميل المرضى…","Add or invite a patient":"إضافة مريض أو دعوته","Patient name":"اسم المريض","Patient record":"سجل المريض","Share an existing record":"مشاركة سجل موجود","Create a new record":"إنشاء سجل جديد","The invited account will access the same record and readings. No data is copied.":"سيتمكن الحساب المدعو من الوصول إلى السجل والقراءات نفسها. لن تُنسخ أي بيانات.","Choose patient record to share":"اختر سجل المريض المراد مشاركته","Choose a patient record":"اختر سجل مريض","Age":"العمر","Sex":"الجنس","Choose":"اختر","Male":"ذكر","Female":"أنثى","Other":"آخر","Prefer not to say":"أفضل عدم الإفصاح","Injury":"الإصابة","Implant":"الغرسة","Surgery date":"تاريخ الجراحة","Add patient and send invitation":"إضافة المريض وإرسال الدعوة","Create patient and send invitation":"إنشاء سجل المريض وإرسال الدعوة","Send invitation":"إرسال الدعوة","Sending invitation…":"جارٍ إرسال الدعوة…","No patients are monitored yet.":"لا توجد حالات مرضى قيد المتابعة حاليًا.","Loading patient…":"جارٍ تحميل بيانات المريض…","This page shows your recovery only. Your care team can see it too, and no other patient can.":"تعرض هذه الصفحة بيانات تعافيك فقط. يمكن لفريق الرعاية الاطلاع عليها، ولا يمكن لأي مريض آخر ذلك.","Loading your recovery data…":"جارٍ تحميل بيانات تعافيك…",
  "AI diagnostic assistant":"مساعد التحليل الذكي","Sensor readings":"قراءات المستشعر","Weekly readings":"القراءات الأسبوعية","Use sample data":"استخدام بيانات تجريبية","Upload CSV or JSON":"رفع ملف CSV أو JSON","Or start from a patient's logs":"أو ابدأ من سجل أحد المرضى","Choose a patient":"اختر مريضًا","Predict healing path":"توقع مسار الالتئام","Test the separate healing-analysis API":"اختبر واجهة تحليل الالتئام المنفصلة","Assistant":"المساعد","ImhoHeal assistant":"مساعد إمحوهيل",
  "Plate strain":"الحمل على الصفيحة","Bone density":"كثافة العظام","Recovery":"التعافي","Projected union":"الالتحام المتوقع","Your recovery summary":"ملخص تعافيك","AI smart alerts":"تنبيهات التحليل الذكي","Based on your latest weekly reading.":"استنادًا إلى أحدث قراءة أسبوعية.","First reading":"القراءة الأولى","Unchanged since last week":"لم تتغير عن الأسبوع الماضي","Not yet":"ليس بعد","Not reached within 6 weeks":"غير متوقع خلال 6 أسابيع","View weekly readings as a table":"عرض القراءات الأسبوعية في جدول","One reading per week after surgery.":"قراءة واحدة لكل أسبوع بعد الجراحة.","Week":"الأسبوع","Date":"التاريخ","ESP32 / MPU6050 motion data":"بيانات الحركة من ESP32 / MPU6050","No ESP32 is paired to this patient yet.":"لم يتم ربط جهاز ESP32 بهذا المريض بعد.","No motion readings received yet.":"لم يتم استلام قراءات حركة بعد.","Pair a device to this patient":"ربط جهاز بهذا المريض","Device ID":"معرّف الجهاز","Create pairing token":"إنشاء رمز الربط","Creating…":"جارٍ الإنشاء…","Device paired.":"تم ربط الجهاز.","View motion readings":"عرض قراءات الحركة","Acceleration magnitude":"مقدار التسارع","Rotation magnitude":"مقدار الدوران","Needs attention":"تحتاج إلى متابعة","Watch closely":"تحتاج إلى مراقبة دقيقة","Early phase":"مرحلة مبكرة","On track":"وفق المسار المتوقع","Critical":"حرج","Warning":"تحذير","Note":"ملاحظة","Measured":"مقاس","AI forecast":"توقع الذكاء الاصطناعي","Union":"الالتحام","Alert level":"مستوى التنبيه",
  "This patient record has no weekly readings yet. Recovery charts and analysis will appear after readings are added. No medical readings have been generated for this record.":"لا يحتوي سجل هذا المريض على قراءات أسبوعية بعد. ستظهر الرسوم والتحليلات بعد إضافة القراءات. لم تُنشأ لهذا السجل أي قراءات طبية.","Your healing progress":"تقدم تعافيك","View motion readings":"عرض قراءات الحركة","Switch language to Arabic":"التبديل إلى العربية","Switch language to English":"التبديل إلى الإنجليزية",
};
Object.assign(ar, {
  "Orthopedic research prototype":"نموذج لأبحاث جراحة العظام","Login":"تسجيل الدخول","Dashboard":"لوحة المتابعة","Assistant":"المساعد الذكي","Set-password":"إنشاء كلمة المرور",
  "Patient ID":"رقم المريض","Select a patient to review sensor data, AI findings, and the projected healing path.":"اختر مريضًا لمراجعة بيانات المستشعر ونتائج التحليل ومسار الالتئام المتوقع.",
  "See how it works":"شاهد طريقة العمل","Sign in to see recovery data.":"سجّل الدخول للاطلاع على بيانات التعافي.","Your care team can see it too, and no other patient can.":"يمكن لفريق الرعاية الاطلاع عليها، ولا يمكن لأي مريض آخر ذلك.",
  "Projected union:":"الالتحام المتوقع:","Confidence:":"مستوى الثقة:","not within 6 weeks":"ليس خلال 6 أسابيع","unlabelled weeks":"أسابيع بلا تسميات","of 5":"من 5",
  "View motion readings":"عرض قراءات الحركة","View weekly readings as a table":"عرض القراءات الأسبوعية في جدول","First reading":"القراءة الأولى","Unchanged since last week":"لم تتغير عن الأسبوع الماضي",
  "No medical readings have been generated for this record.":"لم تُنشأ لهذا السجل أي قراءات طبية.","Paired devices:":"الأجهزة المرتبطة:","samples":"عينة","Showing the latest readings.":"عرض أحدث القراءات.","Acceleration":"التسارع","Rotation":"الدوران",
  "Some of your readings need your surgeon's attention. Contact your clinic soon. For severe pain or sudden swelling, seek urgent care.":"تحتاج بعض قراءاتك إلى مراجعة الجرّاح. تواصل مع العيادة قريبًا. إذا شعرت بألم شديد أو تورم مفاجئ، فاطلب رعاية عاجلة.",
  "Some readings are outside the usual range. Mention this to your surgeon at your next visit.":"بعض القراءات خارج النطاق المعتاد. أخبر الجرّاح بذلك في زيارتك القادمة.","Your readings show healing is progressing as expected. Keep following your care plan.":"تشير قراءاتك إلى أن الالتئام يسير كما هو متوقع. واصل اتباع خطة الرعاية.","We are still collecting readings. More detail will appear as weeks are logged.":"ما زلنا نجمع القراءات. ستظهر تفاصيل أكثر عند تسجيل بيانات الأسابيع القادمة.",
  "Paste or upload at least one weekly reading.":"ألصق قراءة أسبوعية واحدة على الأقل أو ارفعها.","That JSON could not be read. Check the commas and quotes.":"تعذرت قراءة JSON. تحقق من الفواصل وعلامات الاقتباس.","JSON must be a list of readings, or an object with a 'readings' list.":"يجب أن يكون JSON قائمة قراءات أو كائنًا يحتوي على قائمة باسم readings.",
  "Measured":"مقاس","AI forecast":"توقع الذكاء الاصطناعي","View weekly readings as a table":"عرض القراءات الأسبوعية في جدول","Acceleration magnitude":"مقدار التسارع","Rotation magnitude":"مقدار الدوران",
  "Where ancient wisdom meets smart technology, healing begins.":"حين تلتقي الحكمة العريقة بالتقنية الذكية، تبدأ رحلة التعافي.",
  "ImhoHeal prototype. Motion readings are not bone-healing measurements; demo records and rule-based analysis are not for clinical use.":"نموذج إمحوهيل. قراءات الحركة لا تقيس التئام العظام؛ السجلات التجريبية والتحليل القائم على القواعد غير مخصصين للاستخدام السريري.",
  "A smart plate screwed across a fractured bone, with sensors reporting strain and bone density.":"صفيحة تثبيت ذكية فوق عظمة مكسورة، مع مستشعرات ترصد الحمل وكثافة العظام.","Selected patient":"المريض المحدد",
  "Plate strain 41%":"الحمل على الصفيحة 41%","Density 318 mg/cm³":"الكثافة 318 ملغم/سم³","Week 8 after surgery":"الأسبوع 8 بعد الجراحة",
  "Illustration with sample values. A plate bridges a tibial fracture.":"رسم توضيحي بقيم تجريبية. صفيحة تثبيت تعبر كسرًا في عظمة الساق.",
  "AI diagnostic assistant":"مساعد التحليل الذكي","Test weekly demo values for plate strain and bone density. This rule-based placeholder is separate from ESP32/MPU6050 motion data and is not a clinical AI model.":"اختبر قيمًا أسبوعية تجريبية للحمل على الصفيحة وكثافة العظام. هذا التحليل التجريبي القائم على قواعد منفصل عن بيانات حركة ESP32/MPU6050، وليس نموذجًا للذكاء الاصطناعي السريري.",
  "CSV with week, strain load (%), and bone density (mg/cm³). JSON also works.":"ملف CSV يتضمن الأسبوع والحمل على الصفيحة (%) وكثافة العظام (ملغم/سم³). يمكن استخدام JSON أيضًا.",
  "This endpoint accepts manually supplied demo strain and density values only. For ESP32/MPU6050 motion data, pair the device from a patient's recovery page and use its device token.":"تقبل هذه الواجهة قيم الحمل والكثافة التجريبية المُدخلة يدويًا فقط. لبيانات حركة ESP32/MPU6050، اربط الجهاز من صفحة تعافي المريض واستخدم رمز الجهاز.",
  "Paste weekly readings from the prototype, or load sample data, and I will estimate the healing path and flag anything unusual.":"ألصق القراءات الأسبوعية من النموذج أو حمّل بيانات تجريبية، وسأقدّر مسار الالتئام وأنبّهك إلى أي أمر غير معتاد.",
  "Paste or upload at least one weekly reading.":"ألصق قراءة أسبوعية واحدة على الأقل أو ارفعها.","That JSON could not be read. Check the commas and quotes.":"تعذرت قراءة JSON. تحقق من الفواصل وعلامات الاقتباس.","JSON must be a list of readings, or an object with a 'readings' list.":"يجب أن يكون JSON قائمة قراءات أو كائنًا يحتوي على قائمة باسم readings.","Analysing…":"جارٍ التحليل…","Predicted healing path":"مسار الالتئام المتوقع","Bone density in mg/cm³, measured and forecast.":"كثافة العظام بملغم/سم³، المقاسة والمتوقعة.","Bone density by week with a six week forecast.":"كثافة العظام أسبوعيًا مع توقع لستة أسابيع.","Confidence:":"مستوى الثقة:","Model:":"النموذج:","Findings are decision support, not a diagnosis.":"النتائج لدعم القرار وليست تشخيصًا.",
  "Percent of the plate's design load. Lower means the bone is carrying more.":"النسبة المئوية للحمل التصميمي للصفيحة. انخفاضها يعني أن العظم يتحمل حملًا أكبر.","mg/cm³ at the fracture site, with the AI forecast.":"ملغم/سم³ عند موضع الكسر، مع توقع الذكاء الاصطناعي.","Week after surgery":"الأسبوع بعد الجراحة","Weeks after surgery":"الأسابيع بعد الجراحة","View weekly readings as a table":"عرض القراءات الأسبوعية في جدول","Plate strain (%)":"الحمل على الصفيحة (%)","Bone density (mg/cm³)":"كثافة العظام (ملغم/سم³)",
  "Saved samples":"العينات المحفوظة","Last received":"آخر استلام","Showing the latest":"عرض أحدث","View motion readings":"عرض قراءات الحركة","MPU6050 measurements. Acceleration includes gravity.":"قياسات MPU6050. يتضمن التسارع تأثير الجاذبية.","Time":"الوقت","Sequence":"التسلسل","Acceleration (g), x / y / z":"التسارع (g)، س / ص / ع","Gyroscope (°/s), x / y / z":"الجيروسكوب (°/ث)، س / ص / ع",
  "Prototype movement measurements only. These readings do not measure bone density, fracture healing, or plate strain.":"هذه قياسات حركة النموذج فقط. لا تقيس كثافة العظام أو التئام الكسر أو الحمل على الصفيحة.","Save the token shown after pairing; it is only displayed once and must be configured on the ESP32.":"احفظ الرمز الذي يظهر بعد الربط؛ سيُعرض مرة واحدة فقط ويجب ضبطه على ESP32.","Copy this token now; the server stores only its hash.":"انسخ هذا الرمز الآن؛ يحتفظ الخادم ببصمته فقط.","ESP32 token":"رمز ESP32","Send readings to":"أرسل القراءات إلى","with header":"مع الترويسة",
  "Acceleration magnitude":"مقدار التسارع","Vector magnitude in g, including gravity.":"مقدار متجه التسارع بوحدة g، شاملًا الجاذبية.","MPU6050 acceleration magnitude over recent samples.":"مقدار تسارع MPU6050 في العينات الأخيرة.","Sample (oldest to newest)":"العينة (من الأقدم إلى الأحدث)","Rotation magnitude":"مقدار الدوران","Gyroscope vector magnitude in degrees per second.":"مقدار متجه الجيروسكوب بالدرجات في الثانية.","MPU6050 rotation magnitude over recent samples.":"مقدار دوران MPU6050 في العينات الأخيرة.","Your recovery summary":"ملخص تعافيك","AI smart alerts":"تنبيهات التحليل الذكي","AI estimate,":"تقدير الذكاء الاصطناعي،","confidence":"مستوى الثقة",
});
const en = Object.fromEntries(Object.entries(ar).map(([source, target]) => [target, source]));
const key = "emoheal-language";
let lang = "en";

function replace(value) {
  const clean = value.trim();
  let out = lang === "ar" ? ar[clean] : en[clean];
  if (out === undefined && lang === "ar") {
    let match = clean.match(/^Welcome back, (.+)$/);
    if (match) out = `مرحبًا بعودتك، ${match[1]}`;
    match = clean.match(/^(.+) patients$/);
    if (match) out = `${match[1]} مرضى`;
    match = clean.match(/^(.+) need attention, (.+) to watch closely\.$/);
    if (match) out = `${match[1]} بحاجة إلى متابعة، و${match[2]} تحتاج إلى مراقبة دقيقة.`;
    match = clean.match(/^ImhoHeal \| (.+)$/);
    if (match) out = `إمحوهيل | ${ar[match[1]] || match[1]}`;
    match = clean.match(/^Week (\d+)$/);
    if (match) out = `الأسبوع ${match[1]}`;
    match = clean.match(/^week (\d+)$/);
    if (match) out = `الأسبوع ${match[1]}`;
    match = clean.match(/^Surgery on (.+)$/);
    if (match) out = `تاريخ الجراحة: ${match[1]}`;
    match = clean.match(/^AI estimate, (\d+)% confidence$/);
    if (match) out = `تقدير الذكاء الاصطناعي، ثقة ${match[1]}٪`;
    match = clean.match(/^Showing the latest (\d+) readings\.$/);
    if (match) out = `عرض أحدث ${match[1]} قراءة.`;
    match = clean.match(/^(.+) of 5$/);
    if (match) out = `${match[1]} من 5`;
    match = clean.match(/^Decision support from (.+)\. Not a diagnosis\.$/);
    if (match) out = `معلومات لدعم القرار من ${match[1]}، وليست تشخيصًا.`;
  } else if (out === undefined && lang === "en") {
    let match = clean.match(/^مرحبًا بعودتك، (.+)$/);
    if (match) out = `Welcome back, ${match[1]}`;
    match = clean.match(/^(.+) مرضى$/);
    if (match) out = `${match[1]} patients`;
    match = clean.match(/^(.+) بحاجة إلى متابعة، و(.+) تحتاج إلى مراقبة دقيقة\.$/);
    if (match) out = `${match[1]} need attention, ${match[2]} to watch closely.`;
    match = clean.match(/^إمحوهيل \| (.+)$/);
    if (match) out = `ImhoHeal | ${en[match[1]] || match[1]}`;
    match = clean.match(/^الأسبوع (\d+)$/);
    if (match) out = `Week ${match[1]}`;
    match = clean.match(/^تاريخ الجراحة: (.+)$/);
    if (match) out = `Surgery on ${match[1]}`;
    match = clean.match(/^تقدير الذكاء الاصطناعي، ثقة (\d+)[٪%]$/);
    if (match) out = `AI estimate, ${match[1]}% confidence`;
    match = clean.match(/^معلومات لدعم القرار من (.+)، وليست تشخيصًا\.$/);
    if (match) out = `Decision support from ${match[1]}. Not a diagnosis.`;
    match = clean.match(/^عرض أحدث (\d+) قراءة\.$/);
    if (match) out = `Showing the latest ${match[1]} readings.`;
    match = clean.match(/^(.+) من 5$/);
    if (match) out = `${match[1]} of 5`;
  }
  if (out === undefined) return value;
  return `${value.match(/^\s*/)?.[0] || ""}${out}${value.match(/\s*$/)?.[0] || ""}`;
}

function localize(root = document.body) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => { node.nodeValue = replace(node.nodeValue); });
  root.querySelectorAll?.("[placeholder], [title], [aria-label]").forEach((node) => {
    ["placeholder", "title", "aria-label"].forEach((attr) => {
      if (node.hasAttribute(attr)) node.setAttribute(attr, replace(node.getAttribute(attr)));
    });
  });
}

function setLanguage(next) {
  lang = next === "ar" ? "ar" : "en";
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  const label = document.getElementById("langToggleLabel");
  const button = document.getElementById("langToggle");
  if (label) label.textContent = lang === "ar" ? "EN" : "العربية";
  if (button) {
    const aria = lang === "ar" ? "Switch language to English" : "Switch language to Arabic";
    button.setAttribute("aria-label", aria);
    button.title = aria;
  }
  try { localStorage.setItem(key, lang); } catch { /* Storage may be disabled. */ }
  localize(document.documentElement);
}

export function initLanguage() {
  let saved = "en";
  try { saved = localStorage.getItem(key) || "en"; } catch { /* Use English. */ }
  setLanguage(saved);
  document.getElementById("langToggle")?.addEventListener("click", () => setLanguage(lang === "ar" ? "en" : "ar"));
  new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) localize(node);
    else if (node.nodeType === Node.TEXT_NODE) node.nodeValue = replace(node.nodeValue);
  }))).observe(document.documentElement, { childList: true, subtree: true });
}
