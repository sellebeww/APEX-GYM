import { IMAGES } from '../../assets/images';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';

export interface FacilitySlide {
  id: string;
  category: string;
  tabLabel: string;
  title: string;
  description: string;
  imageUrl: string;
  badge: string;
  highlightStat: string;
}

export const FACILITY_SLIDES: FacilitySlide[] = [
  {
    id: 'barbell',
    category: 'AREA UTAMA',
    tabLabel: 'Olympic Barbell',
    title: 'Olympic Lifting & Barbell Zone',
    description: 'Lantai peredam getaran 30mm dengan bumper plate kalibrasi presisi. Bebas melakukan deadlift berat, clean, dan squat dengan keamanan maksimal.',
    imageUrl: IMAGES.facilityWeights,
    badge: 'Eleiko Competition Spec',
    highlightStat: '6 Olympic Platforms',
  },
  {
    id: 'turf',
    category: 'AREA ATHLETIC CONDITIONING',
    tabLabel: 'Functional Turf',
    title: 'Functional Turf & High-Speed Sprint Track',
    description: 'Jalur sprint turf sintetis berdensitas tinggi untuk power sled push/pull, battle ropes, plyometrics, dan agility drills intensitas tinggi.',
    imageUrl: IMAGES.facilityTurf,
    badge: 'Rogue Heavy Rig & Turf',
    highlightStat: '25m Sprint Lane',
  },
  {
    id: 'machines',
    category: 'AREA HIPERTROFI OTOT',
    tabLabel: 'Hammer Strength',
    title: 'Hammer Strength Biomechanics Jungle',
    description: 'Rangkaian lengkap mesin isolateral pelat beban murni dengan kurva resistensi biomekanik optimal untuk stimulasi hipertrofi otot murni tanpa cedera sendi.',
    imageUrl: IMAGES.facilityMachines,
    badge: 'Official Hammer Strength Center',
    highlightStat: '40+ Plate-Loaded Units',
  },
  {
    id: 'recovery',
    category: 'AREA PEMULIHAN & SPA',
    tabLabel: 'Sauna & Cold Plunge',
    title: 'Nordic Sauna & Chilled Cold Plunge Suite',
    description: 'Kombinasi sauna cedarwood bersuhu 80°C dan kolam rendam dingin 4°C untuk meredakan DOMS, memicu sirkulasi vaskular, dan mempercepat regenerasi atletik.',
    imageUrl: IMAGES.facilitySauna,
    badge: 'Sub-Zero Hydrotherapy & Sauna',
    highlightStat: 'Kontras 80°C / 4°C',
  },
  {
    id: 'arena',
    category: 'MAIN GYM ARENA',
    tabLabel: 'Open Arena Floor',
    title: 'APEX Central Open Floor & Power Racks',
    description: 'Area lantai terbuka 1.200 m² berpendingin udara sirkulasi filtrasi HEPA industrial, pencahayaan anti-silau, dan atmosfer latihan berenergi tinggi.',
    imageUrl: IMAGES.hero,
    badge: 'Industrial HEPA Airflow',
    highlightStat: '1.200 m² Total Area',
  },
];

export const FacilityShowcaseCarousel: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const durationMs = 5000;

  // Auto-play interval
  useEffect(() => {
    if (!isPlaying || isHovered) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % FACILITY_SLIDES.length);
    }, durationMs);

    return () => clearInterval(timer);
  }, [isPlaying, isHovered, currentIndex]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % FACILITY_SLIDES.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + FACILITY_SLIDES.length) % FACILITY_SLIDES.length);
  };

  const handleSelect = (index: number) => {
    setCurrentIndex(index);
  };

  const currentSlide = FACILITY_SLIDES[currentIndex];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.6 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="md:col-span-2 relative rounded-2xl overflow-hidden border border-line group bg-surface min-h-[440px] sm:min-h-[480px] shadow-2xl transition-all hover:border-line-strong flex flex-col justify-between"
    >
      {/* 1. Background Image Transition with Ken Burns Slow Zoom */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-black">
        <AnimatePresence mode="wait">
          <motion.img
            key={currentSlide.id}
            src={currentSlide.imageUrl}
            alt={currentSlide.title}
            referrerPolicy="no-referrer"
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
            className="w-full h-full object-cover object-center filter brightness-[0.88] contrast-105"
          />
        </AnimatePresence>

        {/* Multi-tier Gradient Vignette Overlays for Maximum Legibility */}
        <div className="absolute inset-0 bg-linear-to-t from-black/95 via-black/45 to-black/30 pointer-events-none" />
        <div className="absolute inset-0 bg-linear-to-r from-black/85 via-black/30 to-transparent pointer-events-none" />
      </div>

      {/* 2. Top Header Toolbar: Category Tabs & Control Buttons */}
      <div className="relative z-20 p-4 sm:p-6 flex flex-wrap items-center justify-between gap-3">
        {/* Quick Category Jump Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar p-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 max-w-full">
          {FACILITY_SLIDES.map((slide, idx) => {
            const isActive = idx === currentIndex;
            return (
              <button
                key={slide.id}
                onClick={() => handleSelect(idx)}
                className={`relative px-3 py-1 text-xs font-semibold rounded-full whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'text-black font-bold shadow-md'
                    : 'text-zinc-300 hover:text-white hover:bg-white/10'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="facilityTabActive"
                    className="absolute inset-0 rounded-full bg-brand"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10">{slide.tabLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Right Corner Controls: Play/Pause & Counter */}
        <div className="flex items-center gap-2">
          {/* Slide Index Counter */}
          <div className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-mono text-zinc-300 font-bold">
            <span className="text-brand">{currentIndex + 1}</span> / {FACILITY_SLIDES.length}
          </div>

          {/* Play/Pause Button */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? 'Jeda pergantian otomatis' : 'Mulai pergantian otomatis'}
            className="p-1.5 rounded-full bg-black/60 hover:bg-black/90 text-zinc-300 hover:text-brand border border-white/10 backdrop-blur-md transition-colors cursor-pointer"
          >
            {isPlaying && !isHovered ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 3. Left / Right Floating Navigation Chevrons */}
      <div className="relative z-20 px-4 sm:px-6 flex items-center justify-between pointer-events-none -my-6">
        <button
          onClick={handlePrev}
          aria-label="Foto Fasilitas Sebelumnya"
          className="pointer-events-auto p-2.5 rounded-full bg-black/60 hover:bg-brand text-white hover:text-black border border-white/10 hover:border-brand backdrop-blur-md transition-all shadow-lg hover:scale-110 active:scale-95 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={handleNext}
          aria-label="Foto Fasilitas Selanjutnya"
          className="pointer-events-auto p-2.5 rounded-full bg-black/60 hover:bg-brand text-white hover:text-black border border-white/10 hover:border-brand backdrop-blur-md transition-all shadow-lg hover:scale-110 active:scale-95 cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 4. Bottom Information Panel & Interactive Indicators */}
      <div className="relative z-20 p-6 sm:p-8 flex flex-col justify-end">
        {/* Animated Slide Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="space-y-2 max-w-2xl"
          >
            {/* Area Category & Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono font-bold text-brand uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-brand/15 border border-brand/30">
                {currentSlide.category}
              </span>
              <span className="text-[10px] font-mono text-zinc-300 px-2 py-0.5 rounded-full bg-black/60 border border-white/10 backdrop-blur-sm">
                ★ {currentSlide.badge}
              </span>
              <span className="text-[10px] font-mono text-zinc-300 px-2 py-0.5 rounded-full bg-black/60 border border-white/10 backdrop-blur-sm">
                {currentSlide.highlightStat}
              </span>
            </div>

            {/* Title */}
            <h3 className="text-2xl sm:text-3xl font-extrabold font-display text-white tracking-tight leading-tight">
              {currentSlide.title}
            </h3>

            {/* Description */}
            <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed max-w-xl text-balance">
              {currentSlide.description}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* 5. Bottom Navigation Dots & Auto-play Animated Progress Bar */}
        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between gap-4">
          {/* Progress Indicators */}
          <div className="flex items-center gap-2">
            {FACILITY_SLIDES.map((slide, idx) => {
              const isActive = idx === currentIndex;
              return (
                <button
                  key={slide.id}
                  onClick={() => handleSelect(idx)}
                  className={`relative h-2 rounded-full transition-all cursor-pointer ${
                    isActive ? 'w-10 bg-brand' : 'w-2 bg-white/30 hover:bg-white/60'
                  }`}
                  aria-label={`Pilih fasilitas ${slide.tabLabel}`}
                >
                  {/* Subtle timer shimmer fill when active and playing */}
                  {isActive && isPlaying && !isHovered && (
                    <motion.div
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: durationMs / 1000, ease: 'linear' }}
                      key={currentSlide.id}
                      className="absolute inset-0 bg-white/40 rounded-full"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Interactive Hint */}
          <div className="text-[11px] font-mono text-zinc-400 hidden sm:flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
            <span>Klik tab atau panah untuk jelajahi 5 zona fasilitas</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
