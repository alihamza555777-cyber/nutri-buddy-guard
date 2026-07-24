import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Globe,
  ShieldAlert,
  UtensilsCrossed,
  X,
  CheckCircle2,
  AlertTriangle,
  Info,
  Sparkles,
  Plus,
} from "lucide-react";

export type LanguageCode = "en" | "es" | "fr" | "it" | "ur" | "ar";

interface DigitalWaiterCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRestrictions?: string[] | null;
  initialCustomNotes?: string | null;
}

const LANGUAGES: { code: LanguageCode; name: string; flag: string }[] = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "ur", name: "اردو", flag: "🇵🇰" },
  { code: "ar", name: "العربية", flag: "🇸🇦" },
];

const RESTRICTION_TRANSLATIONS: Record<string, Record<LanguageCode, string>> = {
  Peanut: {
    en: "Peanuts / Peanut Oil",
    es: "Cacahuetes / Maní / Aceite de maní",
    fr: "Arachides / Huile d'arachide",
    it: "Noccioline / Olio di arachidi",
    ur: "مونگ پھلی / مونگ پھلی کا تیل",
    ar: "الفول السوداني / زيت الفول السوداني",
  },
  "Tree Nut": {
    en: "Tree Nuts (Almonds, Walnuts, Cashews)",
    es: "Frutos Secos (Almendras, Nueces, Anacardos)",
    fr: "Fruits à coque (Amandes, Noix, Anacardes)",
    it: "Frutta a guscio (Mandorle, Noci, Anacardi)",
    ur: "ٹری نٹس (بادام، اخروٹ، کاجو)",
    ar: "المكسرات (اللوز، الجوز، الكاجو)",
  },
  Gluten: {
    en: "Gluten / Wheat / Barley / Rye",
    es: "Gluten / Trigo / Cebada / Centeno",
    fr: "Gluten / Blé / Orge / Seigle",
    it: "Glutine / Grano / Orzo / Segale",
    ur: "گلوٹن / گندم / جو",
    ar: "الغلوتين / القمح / الشعير",
  },
  "Lactose/Dairy": {
    en: "Lactose / Milk / Dairy / Butter / Cheese",
    es: "Lactosa / Leche / Lácteos / Mantequilla / Queso",
    fr: "Lactose / Lait / Produits laitiers / Beurre / Fromage",
    it: "Lattosio / Latte / Latticini / Burro / Formaggio",
    ur: "لیٹکوز / دودھ / مکھن / پنیر",
    ar: "اللاكتوز / الحليب / الزبدة / الجبن",
  },
  Shellfish: {
    en: "Shellfish / Shrimp / Crab / Lobster",
    es: "Mariscos / Camarones / Cangrejo / Langosta",
    fr: "Crustacés / Crevettes / Crabe / Homard",
    it: "Crostacei / Gamberi / Granchio / Aragosta",
    ur: "شیل فش / جھینگا / کیکڑا",
    ar: "القشريات / الروبيان / السرطان / الكابوريا",
  },
  Soy: {
    en: "Soy / Soy Sauce / Tofu / Edamame",
    es: "Soja / Salsa de soja / Tofu",
    fr: "Soja / Sauce soja / Tofu",
    it: "Soia / Salsa di soia / Tofu",
    ur: "سویا / سویا ساس / توفو",
    ar: "الصويا / صلصة الصويا / التوفو",
  },
  Egg: {
    en: "Eggs / Mayonnaise",
    es: "Huevos / Mayonesa",
    fr: "Œufs / Mayonnaise",
    it: "Uova / Maionese",
    ur: "انڈے / مایونیز",
    ar: "البيض / المايونيز",
  },
  Halal: {
    en: "Strictly Halal (No Pork, Pork Gelatin, Alcohol)",
    es: "Estrictamente Halal (Sin Cerdo, Gelatina de Cerdo, Alcohol)",
    fr: "Strictement Halal (Sans Porc, Gélatine de Porc, Alcool)",
    it: "Rigorosamente Halal (No Maiale, Gelatina di Maiale, Alcol)",
    ur: "سخت حلال (سؤر کا گوشت، جیلیٹن، یا الکحل سے پاک)",
    ar: "حلال بصرامة (خالي من الخنزير والجيلاتين والكحول)",
  },
  Vegan: {
    en: "Vegan (No Meat, Fish, Dairy, Eggs, Honey)",
    es: "Vegano (Sin Carne, Pescado, Lácteos, Huevos, Miel)",
    fr: "Végétalien (Sans Viande, Poisson, Produits laitiers, Œufs, Miel)",
    it: "Vegano (No Carne, Pesce, Latticini, Uova, Miele)",
    ur: "ویگن (بغیر گوشت، مچھلی، دودھ، انڈے)",
    ar: "نباتي صارم (بدون لحوم أو أسماك أو ألبان أو بيض)",
  },
  Keto: {
    en: "Keto / Low-Carb (No Added Sugar, Bread, Rice)",
    es: "Ceto / Bajo en Carbohidratos (Sin Azúcar, Pan, Arroz)",
    fr: "Céto / Faible en Glucides (Sans Sucre, Pain, Riz)",
    it: "Cheto / Basso contenuto di Carboidrati (No Zucchero, Pane, Riso)",
    ur: "کیٹو / لو کارب (بغیر چینی، روٹی، چاول)",
    ar: "كيتو / منخفض الكربوهيدرات (بدون سكر أو خبز أو أرز)",
  },
};

const UI_TEXT: Record<
  LanguageCode,
  {
    title: string;
    subtitle: string;
    greeting: string;
    restrictionsHeader: string;
    customNotesHeader: string;
    crossContamTitle: string;
    crossContamBody: string;
    footerNote: string;
    selectPrompt: string;
    noRestrictionsText: string;
  }
> = {
  en: {
    title: "Severe Dietary Allergy Card",
    subtitle: "Show this card to your server or chef before ordering",
    greeting: "Hello, I have severe food allergies / dietary restrictions. Please ensure my food is prepared safely.",
    restrictionsHeader: "My Severe Allergies & Dietary Restrictions:",
    customNotesHeader: "Special Medical & Kitchen Instructions:",
    crossContamTitle: "HIGH CROSS-CONTAMINATION ALERT",
    crossContamBody: "Please use clean gloves, freshly sanitized cookware, and separate preparation surfaces to avoid cross-contamination.",
    footerNote: "Thank you for helping keep me safe!",
    selectPrompt: "Tap restrictions below to update this card live:",
    noRestrictionsText: "No specific restrictions selected yet. Tap above to add.",
  },
  es: {
    title: "Tarjeta de Alergias Alimentarias",
    subtitle: "Muestre esta tarjeta a su camarero o cocinero antes de pedir",
    greeting: "¡Hola! Tengo alergias graves y restricciones alimentarias. Por favor asegúrese de que mi comida se prepare de forma segura.",
    restrictionsHeader: "Mis alergias y restricciones graves:",
    customNotesHeader: "Instrucciones médicas y especiales de cocina:",
    crossContamTitle: "ALERTA DE CONTAMINACIÓN CRUZADA",
    crossContamBody: "Por favor use guantes limpios, utensilios de cocina limpios y superficies de preparación separadas para evitar la contaminación cruzada.",
    footerNote: "¡Muchas gracias por su atención y ayuda!",
    selectPrompt: "Toque las restricciones para actualizar esta tarjeta:",
    noRestrictionsText: "Sin restricciones seleccionadas.",
  },
  fr: {
    title: "Carte d'Allergies Alimentaires",
    subtitle: "Veuillez présenter cette carte au serveur ou au chef cuisinier",
    greeting: "Bonjour, j'ai de graves allergies et restrictions alimentaires. Merci de veiller à la sécurité de mon repas.",
    restrictionsHeader: "Mes allergies et restrictions sévères :",
    customNotesHeader: "Instructions médicales et cuisine particulières :",
    crossContamTitle: "ALERTE DE CONTAMINATION CROISÉE",
    crossContamBody: "Veuillez utiliser des gants propres, des ustensiles nettoyés et des surfaces de préparation séparées.",
    footerNote: "Merci beaucoup de m'aider à manger en toute sécurité !",
    selectPrompt: "Touchez les restrictions pour mettre à jour la carte :",
    noRestrictionsText: "Aucune restriction sélectionnée.",
  },
  it: {
    title: "Carta Allergie Alimentari Severe",
    subtitle: "Si prega di mostrare questa carta al cameriere o allo chef",
    greeting: "Ciao! Ho gravi allergie e restrizioni alimentari. Per favore assicuratevi che il mio cibo sia preparato in modo sicuro.",
    restrictionsHeader: "Le mie allergie e restrizioni severe:",
    customNotesHeader: "Istruzioni mediche e speciali per la cucina:",
    crossContamTitle: "ALLERTA CONTAMINAZIONE CROCIATA",
    crossContamBody: "Si prega di usare guanti puliti, pentole sanificate e superfici di preparazione separate per evitare la contaminazione crociata.",
    footerNote: "Grazie mille per l'attenzione e l'aiuto!",
    selectPrompt: "Tocca le restrizioni per aggiornare la carta:",
    noRestrictionsText: "Nessuna restrizione selezionata.",
  },
  ur: {
    title: "شدید الرجی اور غذائی پابندی کا ڈیجیٹل کارڈ",
    subtitle: "براہ کرم کھانا آرڈر کرنے سے پہلے یہ کارڈ ویٹر یا شیف کو دکھائیں",
    greeting: "سلام! مجھے خوراک کی شدید الرجی اور پابندیاں ہیں۔ براہ کرم یقینی بنائیں کہ میرا کھانا محفوظ طریقے سے تیار کیا گیا ہے۔",
    restrictionsHeader: "میری شدید الرجی اور غذائی پابندیاں:",
    customNotesHeader: "خاص طبی اور باورچی خانے کی ہدایات:",
    crossContamTitle: "کراس کنٹامینیشن (ملاوٹ) سے پرہیز کا الرٹ",
    crossContamBody: "براہ کرم ملاوٹ سے بچنے کے لیے صاف دستانے، دھوئے ہوئے برتن اور الگ تیاری کی سطح استعمال کریں۔",
    footerNote: "مجھے محفوظ رکھنے میں مدد کے لیے آپ کا بہت شکریہ!",
    selectPrompt: "کارڈ کو اپ ڈیٹ کرنے کے لیے نیچے دی گئی پابندیوں پر ٹیپ کریں:",
    noRestrictionsText: "ابھی تک کوئی خاص الرجی منتخب نہیں کی گئی۔",
  },
  ar: {
    title: "بطاقة الحساسية والقيود الغذائية الشديدة",
    subtitle: "يرجى تقديم هذه البطاقة إلى النادل أو الطاهي قبل الطلب",
    greeting: "مرحباً، لدي حساسية وقيود غذائية شديدة. يرجى التأكد من تحضير وجبتي بأمان.",
    restrictionsHeader: "الحساسية والقيود الغذائية الشديدة الخاصة بي:",
    customNotesHeader: "تعليمات خاصة للمطبخ والطاهي:",
    crossContamTitle: "تنبيه التلوث التبادلي الشديد",
    crossContamBody: "يرجى استخدام قفازات نظيفة وأواني طهي منفصلة ونظيفة وأسطح تحضير معزولة لتجنب التلوث التبادلي.",
    footerNote: "شكراً جزيلاً لمساعدتك في الحفاظ على سلامتي!",
    selectPrompt: "اضغط على القيود أدناه لتحديث البطاقة:",
    noRestrictionsText: "لم يتم تحديد قيود خاصة بعد.",
  },
};

const ALL_RESTRICTIONS = [
  "Peanut",
  "Tree Nut",
  "Gluten",
  "Lactose/Dairy",
  "Shellfish",
  "Soy",
  "Egg",
  "Halal",
  "Vegan",
  "Keto",
];

export function DigitalWaiterCardModal({
  isOpen,
  onClose,
  initialRestrictions = [],
  initialCustomNotes = "",
}: DigitalWaiterCardModalProps) {
  const [lang, setLang] = useState<LanguageCode>("en");
  const [selectedRestrictions, setSelectedRestrictions] = useState<string[]>(initialRestrictions ?? []);
  const [notes, setNotes] = useState(initialCustomNotes ?? "");
  const [showCrossContam, setShowCrossContam] = useState(true);
  const [customCardInput, setCustomCardInput] = useState("");

  useEffect(() => {
    if (isOpen) {
      setSelectedRestrictions(initialRestrictions ?? []);
      setNotes(initialCustomNotes ?? "");
    }
  }, [isOpen, initialRestrictions, initialCustomNotes]);

  const toggleRestriction = (name: string) => {
    setSelectedRestrictions((prev) =>
      prev.includes(name) ? prev.filter((r) => r !== name) : [...prev, name]
    );
  };

  const handleAddCustomAllergen = () => {
    const trimmed = customCardInput.trim();
    if (!trimmed) return;
    if (!selectedRestrictions.includes(trimmed)) {
      setSelectedRestrictions((prev) => [...prev, trimmed]);
    }
    setCustomCardInput("");
  };

  const ui = UI_TEXT[lang];
  const isRtl = lang === "ur" || lang === "ar";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl pb-20 sm:p-8 md:pb-8 dark:border-slate-800 dark:bg-slate-900 dark:text-white">
        <DialogHeader className="text-left pr-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Dining Out Mode
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-600 dark:text-slate-400">
                Digital Waiter Allergen Card for Staff & Chefs
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Language Selection Bar */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200/60 bg-slate-100/80 p-1.5 dark:border-slate-700 dark:bg-slate-800/80">
          <Globe className="ml-2 h-4 w-4 text-emerald-600" />
          <span className="mr-2 text-xs font-semibold text-slate-700 dark:text-slate-300">Language:</span>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setLang(l.code)}
              className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                lang === l.code
                  ? "border border-emerald-200 bg-emerald-100 text-emerald-800 shadow-xs dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              <span>{l.flag}</span>
              <span>{l.name}</span>
            </button>
          ))}
        </div>

        {/* CLEAN SMOOTH WHITE DIGITAL WAITER CARD */}
        <div
          dir={isRtl ? "rtl" : "ltr"}
          className="mt-5 rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-950"
        >
          {/* Card Header Badge */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              <span className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-400">
                NutriGuard Allergen Passport
              </span>
            </div>
            <span className="rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              {LANGUAGES.find((l) => l.code === lang)?.name}
            </span>
          </div>

          {/* Main Title & Subtitle */}
          <div className="mt-5 text-center">
            <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              {ui.title}
            </h2>
            <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-400">{ui.subtitle}</p>
          </div>

          {/* Greeting Box */}
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium leading-relaxed text-slate-800 dark:text-slate-200">
              "{ui.greeting}"
            </p>
          </div>

          {/* Severe Restrictions / Danger Zone Section */}
          <div className="mt-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
              {ui.restrictionsHeader}
            </h3>

            {selectedRestrictions.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2.5">
                {selectedRestrictions.map((r) => {
                  const translated = RESTRICTION_TRANSLATIONS[r]?.[lang] ?? r;
                  return (
                    <div
                      key={r}
                      className="flex items-center gap-2 rounded-2xl border border-amber-300 bg-amber-100/90 px-4 py-2.5 text-sm font-bold text-amber-900 shadow-xs dark:border-amber-700 dark:bg-amber-950/80 dark:text-amber-200"
                    >
                      <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                      <span>{translated}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 text-xs italic text-slate-500">{ui.noRestrictionsText}</p>
            )}
          </div>

          {/* Custom Medical / Kitchen Notes */}
          {notes && notes.trim().length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                {ui.customNotesHeader}
              </h3>
              <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium leading-relaxed text-slate-800 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                {notes}
              </div>
            </div>
          )}

          {/* High Cross-Contamination Alert Banner */}
          {showCrossContam && (
            <div className="mt-6 rounded-2xl border border-amber-200/80 bg-amber-50/80 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <h4 className="text-xs font-black uppercase tracking-wider">
                  {ui.crossContamTitle}
                </h4>
              </div>
              <p className="mt-1 text-xs font-medium leading-relaxed text-amber-900/90 dark:text-amber-200">
                {ui.crossContamBody}
              </p>
            </div>
          )}

          {/* Footer Note */}
          <div className="mt-6 border-t border-slate-200 pt-4 text-center dark:border-slate-800">
            <p className="text-xs font-bold text-emerald-600">{ui.footerNote}</p>
          </div>
        </div>

        {/* Interactive Controls & Guest Selector */}
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span>Cross-Contamination Warning Banner</span>
            </div>
            <button
              type="button"
              onClick={() => setShowCrossContam((v) => !v)}
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                showCrossContam ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {showCrossContam ? "ENABLED" : "DISABLED"}
            </button>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-400">{ui.selectPrompt}</p>
            <div className="flex flex-wrap gap-2">
              {ALL_RESTRICTIONS.map((name) => {
                const active = selectedRestrictions.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleRestriction(name)}
                    className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                      active
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {active && <CheckCircle2 className="h-3.5 w-3.5" />}
                    <span>{name}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom Allergen Input */}
            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                value={customCardInput}
                onChange={(e) => setCustomCardInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomAllergen();
                  }
                }}
                placeholder="Add custom allergen on the spot (e.g. Mustard, Sulfites)..."
                className="flex-1 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-1.5 text-xs text-slate-800 outline-none ring-emerald-500 focus:ring-2 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={handleAddCustomAllergen}
                className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
