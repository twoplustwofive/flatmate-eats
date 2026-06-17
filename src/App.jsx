import { useState, useEffect, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import { toJpeg } from 'html-to-image';
import { RefreshCw, ChevronDown, ChevronUp, Download, Share2 } from 'lucide-react';

/* ── fallback data ────────────────────────────────────────────── */
const FALLBACK_BREAKFASTS = [
  'Oatmeal with Berries',
  'Scrambled Eggs & Toast',
  'Banana Pancakes',
  'Avocado Toast',
  'Greek Yogurt Parfait',
  'Smoothie Bowl',
  'French Toast',
  'Masala Dosa',
];

const FALLBACK_MAINS = [
  'Chicken Curry',
  'Grilled Salmon',
  'Pasta Bolognese',
  'Vegetable Stir-Fry',
  'Beef Tacos',
  'Mushroom Risotto',
  'Paneer Tikka Masala',
  'Lentil Soup',
  'Sushi Bowls',
  'Falafel Wraps',
  'Thai Green Curry',
  'Stuffed Bell Peppers',
];

const SHEET_URL =
  'https://docs.google.com/spreadsheets/d/17XgBDHrLQVbAAvqVCLTFzZSrZ_WNRypatkeZuEPcxco/export?format=csv&gid=0';

const SHEET_EDIT_URL =
  'https://docs.google.com/spreadsheets/d/17XgBDHrLQVbAAvqVCLTFzZSrZ_WNRypatkeZuEPcxco/edit';

/* ── helpers ──────────────────────────────────────────────────── */
function createDeck(items) {
  let deck = [];
  return function draw(count) {
    const drawn = [];
    for (let i = 0; i < count; i++) {
      if (deck.length === 0) {
        // Reshuffle when empty
        deck = [...items].sort(() => Math.random() - 0.5);
      }
      drawn.push(deck.pop());
    }
    return drawn;
  };
}

// Better generation that guarantees lunch ≠ dinner per day, and minimizes repeats across days
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function generatePlanSafe(breakfasts, mains) {
  const drawBreakfast = createDeck(breakfasts);
  const drawMain = createDeck(mains);

  return Array.from({ length: 6 }, (_, i) => {
    const [bf] = drawBreakfast(1);
    
    let [lunch, dinner] = drawMain(Math.min(2, mains.length));
    
    // Fallback if there's only 1 main in the whole sheet
    if (!dinner) dinner = lunch;

    // Edge case: if we drew the last item of a deck, and then the first item of a reshuffled deck,
    // they could theoretically be the same item. If so, swap dinner with the next draw.
    if (lunch === dinner && mains.length > 1) {
       const [replacement] = drawMain(1);
       dinner = replacement;
    }

    return {
      day: DAYS[i],
      breakfast: bf,
      lunch,
      dinner,
    };
  });
}

/* ── meal row config ──────────────────────────────────────────── */
const MEAL_CONFIG = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🍳', tagColor: '#A3B18A' },
  { key: 'lunch', label: 'Lunch', emoji: '🍲', tagColor: '#D4A373' },
  { key: 'dinner', label: 'Dinner', emoji: '🥗', tagColor: '#606C38' },
];

/* ── components ───────────────────────────────────────────────── */
function MealRow({ emoji, label, dish, tagColor }) {
  return (
    <div className="bg-[#F9F7F2] rounded-3xl p-4 sm:p-5 flex items-center gap-4 transition-all duration-300 hover:shadow-md hover:translate-y-[-1px]">
      {/* emoji badge */}
      <div className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white flex items-center justify-center text-2xl sm:text-3xl shadow-sm border border-[#E5E1D8]">
        {emoji}
      </div>

      {/* text */}
      <div className="min-w-0">
        <span
          className="inline-block text-[10px] sm:text-xs font-bold uppercase tracking-[0.15em] mb-1 px-2 py-0.5 rounded-full"
          style={{ color: tagColor, backgroundColor: tagColor + '1A' }}
        >
          {label}
        </span>
        <p className="text-[#3D3A35] text-base sm:text-lg font-semibold leading-snug" style={{ fontFamily: "'Inter', sans-serif" }}>
          {dish}
        </p>
      </div>
    </div>
  );
}

function DayCard({ dayNum, meals, isOpen, onToggle }) {
  const padded = typeof dayNum === 'string' ? dayNum.substring(0, 3).toUpperCase() : String(dayNum).padStart(2, '0');

  return (
    <div
      className="bg-white rounded-3xl border border-[#E5E1D8] overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
      style={{ boxShadow: isOpen ? '0 8px 30px rgba(61,58,53,0.06)' : '0 2px 8px rgba(61,58,53,0.03)' }}
    >
      {/* card header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5 cursor-pointer group"
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#A3B18A] flex items-center justify-center text-white font-bold text-xs sm:text-sm tracking-wider shadow-sm transition-transform duration-300 group-hover:scale-105">
            {padded}
          </div>
          <span
            className="text-[#3D3A35] text-lg sm:text-xl font-semibold"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            {dayNum}
          </span>
        </div>

        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#F2EEE5] flex items-center justify-center transition-all duration-300 group-hover:bg-[#E5E1D8]">
          {isOpen ? (
            <ChevronUp size={18} className="text-[#3D3A35]" />
          ) : (
            <ChevronDown size={18} className="text-[#3D3A35]" />
          )}
        </div>
      </button>

      {/* collapsible body */}
      <div
        className="transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] overflow-hidden"
        style={{
          maxHeight: isOpen ? '500px' : '0px',
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div className="px-5 sm:px-6 pb-5 sm:pb-6 flex flex-col gap-3">
          {MEAL_CONFIG.map((mc) => (
            <MealRow
              key={mc.key}
              emoji={mc.emoji}
              label={mc.label}
              dish={meals[mc.key]}
              tagColor={mc.tagColor}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── share preview (rendered off-screen for capture) ──────────── */
function SharePreview({ plan }) {
  return (
    <div
      style={{
        width: '880px',
        padding: '0',
        background: 'radial-gradient(circle at top right, #FDFBF7 0%, #F2EEE5 100%)',
        fontFamily: "'Inter', sans-serif",
        color: '#3D3A35',
      }}
    >
      {/* header */}
      <div
        style={{
          background: '#A3B18A',
          padding: '56px 48px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-80px',
            left: '-80px',
            width: '240px',
            height: '240px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-40px',
            right: '-40px',
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
          }}
        />
        <h2
          style={{
            color: 'white',
            fontSize: '56px',
            fontWeight: 700,
            fontFamily: "'Playfair Display', serif",
            margin: 0,
            position: 'relative',
            zIndex: 1,
          }}
        >
          Flatmate Eats
        </h2>
        <p
          style={{
            color: 'rgba(255,255,255,0.9)',
            fontSize: '24px',
            letterSpacing: '0.1em',
            marginTop: '12px',
            fontWeight: 500,
            position: 'relative',
            zIndex: 1,
          }}
        >
          3061 · Sobha Classic
        </p>
        <p
          style={{
            color: 'rgba(255,255,255,0.55)',
            fontSize: '18px',
            textTransform: 'uppercase',
            letterSpacing: '0.3em',
            marginTop: '6px',
            fontWeight: 500,
            position: 'relative',
            zIndex: 1,
          }}
        >
          Weekly Meal Planner
        </p>
      </div>

      {/* all days expanded */}
      <div style={{ padding: '32px 32px 40px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {plan.map((dayPlan) => {
            const padded = typeof dayPlan.day === 'string' ? dayPlan.day.substring(0, 3).toUpperCase() : String(dayPlan.day).padStart(2, '0');
            return (
              <div
                key={dayPlan.day}
                style={{
                  background: 'white',
                  borderRadius: '48px',
                  border: '2px solid #E5E1D8',
                  overflow: 'hidden',
                  boxShadow: '0 8px 32px rgba(61,58,53,0.04)',
                }}
              >
                {/* day header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '24px',
                    padding: '28px 36px',
                  }}
                >
                  <div
                    style={{
                      width: '72px',
                      height: '72px',
                      borderRadius: '50%',
                      background: '#A3B18A',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '26px',
                    }}
                  >
                    {padded}
                  </div>
                  <span style={{ fontSize: '32px', fontWeight: 600 }}>
                    {dayPlan.day}
                  </span>
                </div>

                {/* meals */}
                <div style={{ padding: '0 36px 32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {MEAL_CONFIG.map((mc) => (
                    <div
                      key={mc.key}
                      style={{
                        background: '#F9F7F2',
                        borderRadius: '40px',
                        padding: '24px 28px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '24px',
                      }}
                    >
                      <div
                        style={{
                          width: '76px',
                          height: '76px',
                          borderRadius: '50%',
                          background: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '40px',
                          border: '2px solid #E5E1D8',
                          flexShrink: 0,
                        }}
                      >
                        {mc.emoji}
                      </div>
                      <div>
                        <span
                          style={{
                            display: 'inline-block',
                            fontSize: '18px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.15em',
                            color: mc.tagColor,
                            background: mc.tagColor + '1A',
                            padding: '4px 16px',
                            borderRadius: '999px',
                            marginBottom: '4px',
                          }}
                        >
                          {mc.label}
                        </span>
                        <p
                          style={{
                            margin: 0,
                            fontSize: '28px',
                            fontWeight: 600,
                            color: '#3D3A35',
                            lineHeight: '1.3',
                          }}
                        >
                          {dayPlan[mc.key]}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* watermark */}
        <p
          style={{
            textAlign: 'center',
            fontSize: '20px',
            color: 'rgba(61,58,53,0.35)',
            marginTop: '28px',
            fontWeight: 500,
          }}
        >
          3061, Sobha Classic · Flatmate Eats 🍽️
        </p>
      </div>
    </div>
  );
}

/* ── main app ─────────────────────────────────────────────────── */
export default function App() {
  const [plan, setPlan] = useState([]);
  const [openDay, setOpenDay] = useState(1);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [sharing, setSharing] = useState(false);
  const shareRef = useRef(null);

  const fetchAndGenerate = useCallback(async () => {
    setLoading(true);
    setSpinning(true);
    let breakfasts = [...FALLBACK_BREAKFASTS];
    let mains = [...FALLBACK_MAINS];

    try {
      const url = `${SHEET_URL}&_t=${Date.now()}`;
      const response = await fetch(url);
      const csvText = await response.text();

      const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
      });

      if (parsed.data && parsed.data.length > 0) {
        const sheetBreakfasts = [];
        const sheetMains = [];

        parsed.data.forEach((row) => {
          const type = (row.Type || '').trim();
          const dish = (row.Dish || '').trim();
          if (!dish) return;

          if (/breakfast/i.test(type)) {
            sheetBreakfasts.push(dish);
          } else if (/main/i.test(type)) {
            sheetMains.push(dish);
          }
        });

        if (sheetBreakfasts.length > 0) breakfasts = sheetBreakfasts;
        if (sheetMains.length > 0) mains = sheetMains;
      }
    } catch (err) {
      console.warn('Failed to fetch sheet, using fallback meals:', err);
    }

    const newPlan = generatePlanSafe(breakfasts, mains);
    setPlan(newPlan);
    setOpenDay('Monday');
    setLoading(false);
    // keep spinning a tiny bit longer for the animation feel
    setTimeout(() => setSpinning(false), 600);
  }, []);

  const shareAsImage = useCallback(async () => {
    if (!shareRef.current || plan.length === 0) return;
    setSharing(true);

    try {
      // Small delay to let the share preview render fully
      await new Promise((r) => setTimeout(r, 100));

      const dataUrl = await toJpeg(shareRef.current, {
        cacheBust: true,
        pixelRatio: 1.5, // Reduced from 3 to 1.5 to prevent crashes (base layout is already huge 880px)
        quality: 0.9, // 90% JPEG compression is fast and retains text crispness
        backgroundColor: '#F2EEE5',
      });

      // Try Web Share API first (mobile-friendly)
      if (navigator.share && navigator.canShare) {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], 'flatmate-eats-meal-plan.jpg', {
          type: 'image/jpeg',
        });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'Flatmate Eats — 3061, Sobha Classic',
            text: 'Check out our meal plan for 3061, Sobha Classic!',
            files: [file],
          });
          setSharing(false);
          return;
        }
      }

      // Fallback: download the image if sharing API isn't available
      const link = document.createElement('a');
      link.download = 'flatmate-eats-meal-plan.jpg';
      link.href = dataUrl;
      link.click();
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Share failed:', err);
      }
    } finally {
      setSharing(false);
    }
  }, [plan]);

  useEffect(() => {
    fetchAndGenerate();
  }, [fetchAndGenerate]);

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'radial-gradient(circle at top right, #FDFBF7 0%, #F2EEE5 100%)',
        fontFamily: "'Inter', sans-serif",
        color: '#3D3A35',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="bg-[#A3B18A] px-6 py-8 sm:py-10 text-center relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-[-40px] left-[-40px] w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute bottom-[-20px] right-[-20px] w-24 h-24 rounded-full bg-white/10" />

        <h1
          className="text-white text-3xl sm:text-4xl md:text-5xl font-bold relative z-10"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Flatmate Eats
        </h1>
        <p className="text-white/90 text-sm sm:text-base mt-2 relative z-10 font-medium tracking-wide">
          3061 · Sobha Classic
        </p>
        <p className="text-white/60 text-[10px] sm:text-xs uppercase tracking-[0.3em] mt-1 relative z-10 font-medium">
          Weekly Meal Planner
        </p>
      </header>

      {/* ── Main Content ───────────────────────────────────────── */}
      <main className="max-w-xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Day cards */}
        <div className="flex flex-col gap-3 sm:gap-4">
          {loading
            ? /* skeleton placeholders */
              Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-3xl border border-[#E5E1D8] px-6 py-5 animate-pulse"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#E5E1D8]" />
                    <div className="h-5 w-20 bg-[#E5E1D8] rounded-full" />
                  </div>
                </div>
              ))
            : plan.map((dayPlan) => (
                <DayCard
                  key={dayPlan.day}
                  dayNum={dayPlan.day}
                  meals={dayPlan}
                  isOpen={openDay === dayPlan.day}
                  onToggle={() =>
                    setOpenDay((prev) => (prev === dayPlan.day ? null : dayPlan.day))
                  }
                />
              ))}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3">
          {/* Generate Button */}
          <button
            onClick={fetchAndGenerate}
            disabled={loading}
            className="flex-1 bg-[#3D3A35] hover:bg-[#2C2A26] text-white font-bold text-sm uppercase tracking-[0.2em] py-4 sm:py-5 rounded-[24px] flex items-center justify-center gap-3 transition-all duration-300 hover:shadow-lg hover:shadow-[#3D3A35]/20 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw
              size={18}
              className={`transition-transform duration-600 ${spinning ? 'animate-spin' : ''}`}
            />
            Generate New Plan
          </button>

          {/* Share Button */}
          <button
            onClick={shareAsImage}
            disabled={loading || sharing || plan.length === 0}
            className="sm:w-auto bg-[#A3B18A] hover:bg-[#8A9D71] text-white font-bold text-sm uppercase tracking-[0.2em] py-4 sm:py-5 px-6 sm:px-8 rounded-[24px] flex items-center justify-center gap-3 transition-all duration-300 hover:shadow-lg hover:shadow-[#A3B18A]/20 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
          >
            {sharing ? (
              <>
                <Download size={18} className="animate-bounce" />
                Sharing…
              </>
            ) : (
              <>
                <Share2 size={18} />
                Share
              </>
            )}
          </button>
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="max-w-xl mx-auto px-6 pb-8 pt-2">
        <p className="text-center text-xs text-[#3D3A35]/50 leading-relaxed mb-3">
          This app is connected to your Google Sheet. Ensure your sheet has
          these exact column headers: <strong className="text-[#3D3A35]/70">Type</strong> (e.g. Breakfast
          or Main) and <strong className="text-[#3D3A35]/70">Dish</strong>.
          If empty, default meals are shown.{' '}
          <a
            href={SHEET_EDIT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-[#A3B18A] hover:text-[#8A9D71] transition-colors"
          >
            Edit your Google Sheet →
          </a>
        </p>
        <p className="text-center text-xs text-[#3D3A35]/50 font-medium">
          Made by <a href="https://www.linkedin.com/in/vijay-rathod/" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#3D3A35] transition-colors">Vijay</a>
        </p>
      </footer>

      {/* ── Hidden share preview (off-screen for image capture) ── */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          zIndex: -1,
          pointerEvents: 'none',
        }}
      >
        <div ref={shareRef}>
          <SharePreview plan={plan} />
        </div>
      </div>
    </div>
  );
}
