import React from 'react';
import { useApp } from '../../context/AppContext';
import { MapPin, Phone, Clock } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

export const Footer: React.FC = () => {
  const { setActiveView, setMemberTab, goToSection, config, serverTime } = useApp();

  const linkClass = 'text-left hover:text-white transition-colors';
  const openMember = (tab: string) => {
    setActiveView('member');
    setMemberTab(tab);
  };

  return (
    <footer className="border-t border-line bg-ink text-zinc-400 pt-14 pb-28 md:pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
        <div>
          <BrandLogo variant="horizontal" size="sm" subtitleText="JAKARTA BARAT" />
          <p className="mt-5 text-xs leading-relaxed text-zinc-400 max-w-xs">
            Pusat kebugaran dan performa premium di Jakarta Barat. Barbell standar kompetisi, mesin biomekanik, dan
            pembinaan berbasis sports science.
          </p>
        </div>

        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-[0.18em] text-white mb-4">Program & Fasilitas</h4>
          <ul className="space-y-2.5 text-xs">
            <li><button onClick={() => goToSection('paket')} className={linkClass}>Paket Membership</button></li>
            <li><button onClick={() => goToSection('coaches')} className={linkClass}>Personal Training 1-on-1</button></li>
            <li><button onClick={() => goToSection('fasilitas')} className={linkClass}>Barbell & Free Weights</button></li>
            <li><button onClick={() => goToSection('fasilitas')} className={linkClass}>Sauna & Cold Recovery</button></li>
            <li><button onClick={() => goToSection('jadwal')} className={linkClass}>Jadwal Kelas Fungsional</button></li>
          </ul>
        </div>

        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-[0.18em] text-white mb-4">Portal Member</h4>
          <ul className="space-y-2.5 text-xs">
            <li><button onClick={() => openMember('qr')} className={linkClass}>QR Masuk Gym Mandiri</button></li>
            <li><button onClick={() => openMember('workout-log')} className={linkClass}>Workout Tracker & PR</button></li>
            <li><button onClick={() => openMember('program')} className={linkClass}>Rencana Makan & Nutrisi</button></li>
            <li><button onClick={() => openMember('satisfaction')} className={linkClass}>Survei Kepuasan & Keluhan</button></li>
          </ul>
        </div>

        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-[0.18em] text-white mb-4">Lokasi & Operasional</h4>
          <ul className="space-y-3 text-xs">
            <li className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
              <span>Jl. Puri Indah Raya Blok A3 No. 12, Kembangan, Jakarta Barat 11610</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Phone className="w-4 h-4 text-zinc-500 shrink-0" />
              <a href="https://wa.me/6281288009911" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                WhatsApp +62 812-8800-9911
              </a>
            </li>
            <li className="flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
              <span>Sen–Jum 06:00–22:00 WIB<br />Sab–Min 07:00–21:00 WIB</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12"><div className="pt-6 border-t border-line text-[11px] text-zinc-500 flex flex-col sm:flex-row justify-between gap-2">
        <span>© {serverTime.slice(0, 4)} APEX Gym. Hak cipta dilindungi.</span>
        {config.paymentProvider === 'simulator' && <span>Mode development: pembayaran disimulasikan, tidak ada uang sungguhan yang diproses.</span>}
      </div></div>
    </footer>
  );
};
