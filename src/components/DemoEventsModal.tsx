"use client";

import React, { useState } from 'react';
import { Sparkles, X, Check, Loader2, Calendar, Clock, MapPin, Users, CheckSquare, Square } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { DEMO_EVENT_TEMPLATES, DemoEventTemplate } from '@/lib/demoEventTemplates';

interface DemoEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMonth: string; // YYYY-MM
  orgTitle: string;
  isGenerating: boolean;
  onGenerate: (selectedKeys: string[]) => Promise<void>;
}

export default function DemoEventsModal({
  isOpen,
  onClose,
  selectedMonth,
  orgTitle,
  isGenerating,
  onGenerate,
}: DemoEventsModalProps) {
  const { language } = useLanguage();
  const [selectedKeys, setSelectedKeys] = useState<string[]>(() =>
    DEMO_EVENT_TEMPLATES.map(t => t.key)
  );

  if (!isOpen) return null;

  const toggleKey = (key: string) => {
    setSelectedKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSelectAll = () => {
    setSelectedKeys(DEMO_EVENT_TEMPLATES.map(t => t.key));
  };

  const handleDeselectAll = () => {
    setSelectedKeys([]);
  };

  const handleConfirm = async () => {
    if (selectedKeys.length === 0) return;
    await onGenerate(selectedKeys);
    onClose();
  };

  const handleGenerateAll = async () => {
    const allKeys = DEMO_EVENT_TEMPLATES.map(t => t.key);
    await onGenerate(allKeys);
    onClose();
  };

  // Month label format
  const [yearStr, monthStr] = selectedMonth.split('-');
  const monthDate = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1);
  const monthLabel = monthDate.toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div
      className="fixed inset-0 z-60 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/20 shrink-0">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base sm:text-lg flex items-center gap-2">
                <span>{language === 'bn' ? 'ডেমো কর্মসূচি নির্বাচন' : 'Choose Demo Events'}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                  {selectedKeys.length}/{DEMO_EVENT_TEMPLATES.length}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {orgTitle} • <span className="text-indigo-300 font-medium">{monthLabel}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selection Bar */}
        <div className="px-5 sm:px-6 py-2.5 bg-slate-950/60 border-b border-white/5 flex items-center justify-between gap-3 text-xs">
          <p className="text-slate-400">
            {language === 'bn'
              ? 'মাসের ক্যালেন্ডারে যোগ করার জন্য কর্মসূচিগুলো নির্বাচন করুন:'
              : 'Select which events to schedule in this month:'}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors cursor-pointer"
            >
              {language === 'bn' ? 'সবগুলো বাছুন' : 'Select All'}
            </button>
            <span className="text-slate-600">•</span>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="text-slate-400 hover:text-slate-300 font-medium transition-colors cursor-pointer"
            >
              {language === 'bn' ? 'মুছে দিন' : 'Clear'}
            </button>
          </div>
        </div>

        {/* Events List */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-2.5 flex-1 max-h-[58vh]">
          {DEMO_EVENT_TEMPLATES.map((tmpl, idx) => {
            const isChecked = selectedKeys.includes(tmpl.key);
            const dayStr = String(tmpl.dayOffset).padStart(2, '0');
            const dateStr = `${selectedMonth}-${dayStr}`;

            const categoryLabel =
              tmpl.category === 'kormi'
                ? (language === 'bn' ? 'কর্মী' : 'Workers')
                : tmpl.category === 'shohojogi'
                ? (language === 'bn' ? 'সহযোগী' : 'Associates')
                : (language === 'bn' ? 'সকলের জন্য' : 'All Members');

            const categoryBadgeColor =
              tmpl.category === 'kormi'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                : tmpl.category === 'shohojogi'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : 'bg-blue-500/20 text-blue-300 border-blue-500/30';

            return (
              <div
                key={tmpl.key}
                onClick={() => toggleKey(tmpl.key)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                  isChecked
                    ? 'bg-gradient-to-r from-purple-900/20 to-indigo-900/20 border-purple-500/40 shadow-sm shadow-purple-500/10'
                    : 'bg-slate-800/40 border-white/5 opacity-60 hover:opacity-100 hover:bg-slate-800/70'
                }`}
              >
                {/* Checkbox */}
                <div className="pt-0.5 shrink-0">
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors border ${
                      isChecked
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'border-slate-600 bg-slate-900/80 text-transparent'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-bold text-white text-sm">
                      {language === 'bn' ? tmpl.nameBn : tmpl.nameEn}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${categoryBadgeColor}`}>
                      {categoryLabel}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-1 mb-2">
                    {language === 'bn' ? tmpl.nameEn : tmpl.nameBn}
                  </p>

                  <div className="flex items-center gap-3 flex-wrap text-[11px] text-slate-300">
                    <div className="flex items-center gap-1 text-indigo-300">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>{dateStr}</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{language === 'bn' ? tmpl.timeBn : tmpl.timeEn}</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-400 truncate max-w-[200px]">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{language === 'bn' ? tmpl.locationBn : tmpl.locationEn}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-white/10 bg-slate-950/80 flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
          >
            {language === 'bn' ? 'বাতিল' : 'Cancel'}
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleGenerateAll}
              disabled={isGenerating}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {language === 'bn' ? 'সবগুলো (১০টি) তৈরি করুন' : 'Generate All 10'}
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={isGenerating || selectedKeys.length === 0}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 transition-all shadow-md shadow-purple-600/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{language === 'bn' ? 'যোগ করা হচ্ছে...' : 'Generating...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>
                    {language === 'bn'
                      ? `${selectedKeys.length}টি কর্মসূচি যোগ করুন`
                      : `Add ${selectedKeys.length} Events`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
