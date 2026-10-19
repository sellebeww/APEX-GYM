import React, { useState } from 'react';
import { StrengthStandardsCalculator } from '../tools/StrengthStandardsCalculator';
import { MacroCalculator } from '../tools/MacroCalculator';
import { Trophy, Apple } from 'lucide-react';

export const MemberCalculators: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'1RM' | 'MACRO'>('1RM');

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex items-center gap-2 p-1.5 bg-surface border border-line rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('1RM')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === '1RM'
              ? 'bg-brand text-black shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Kalkulator 1RM & Kekuatan</span>
        </button>

        <button
          onClick={() => setActiveTab('MACRO')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'MACRO'
              ? 'bg-brand text-black shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Apple className="w-4 h-4" />
          <span>Kalkulator Kalori & Makro (TDEE)</span>
        </button>
      </div>

      {activeTab === '1RM' ? <StrengthStandardsCalculator /> : <MacroCalculator />}
    </div>
  );
};
