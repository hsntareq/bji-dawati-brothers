"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X, MessageSquare, Send, CheckCircle2, AlertCircle, Play, Pause,
  SkipForward, RotateCcw, ExternalLink, Users, Sparkles, Clock, Check,
  ChevronRight, ArrowRight, ShieldCheck, ChevronLeft
} from 'lucide-react';
import { formatStructuredInvitation } from '@/lib/demoEventTemplates';

export interface DispatchAttendee {
  id: string;
  name: string;
  nameBn?: string;
  mobile?: string;
  category?: 'shohojogi' | 'kormi' | string;
  location?: string;
  response?: 'invited' | 'confirmed' | 'attended' | 'declined';
}

export interface WhatsAppDispatcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: {
    id: string;
    name: string;
    date: string;
    time?: string;
    location?: string;
    message?: string;
    guest?: string;
    convener?: string;
  };
  orgTitle: string;
  attendees: DispatchAttendee[];
  language: 'en' | 'bn';
  onMarkInvited?: (attendeeId: string) => void;
}

const toE164Phone = (m?: string | null): string => {
  if (!m) return '';
  const digits = m.replace(/\D/g, '');
  if (digits.startsWith('880')) return digits;
  if (digits.startsWith('0')) return '880' + digits.slice(1);
  if (digits.length >= 10) return '880' + digits;
  return digits;
};

const BN_DIGITS_MAP = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
const toBnNum = (str: string | number): string => {
  return String(str).replace(/\d/g, d => BN_DIGITS_MAP[parseInt(d, 10)] || d);
};

export default function WhatsAppDispatcherModal({
  isOpen,
  onClose,
  event,
  orgTitle,
  attendees,
  language,
  onMarkInvited,
}: WhatsAppDispatcherModalProps) {
  const isBn = language === 'bn';

  // Filter attendees with valid mobile numbers
  const validAttendees = useMemo(() => {
    return attendees.filter(a => {
      const p = toE164Phone(a.mobile);
      return p && p.length >= 10;
    });
  }, [attendees]);

  // States
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'shohojogi' | 'kormi'>('all');
  const [activeStep, setActiveStep] = useState<'setup' | 'running' | 'completed'>('setup');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const [autoAdvance, setAutoAdvance] = useState<boolean>(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize selected IDs with all valid attendees on open
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(validAttendees.map(a => a.id)));
      setActiveStep('setup');
      setCurrentIndex(0);
      setSentIds(new Set());
      setSkippedIds(new Set());
      setCountdown(null);
      setIsPaused(false);
    }
  }, [isOpen, validAttendees]);

  // Clean timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Filtered list based on category for selection
  const filteredForSetup = useMemo(() => {
    if (categoryFilter === 'all') return validAttendees;
    return validAttendees.filter(a => (a.category || 'shohojogi') === categoryFilter);
  }, [validAttendees, categoryFilter]);

  // Active queue of selected attendees
  const queueAttendees = useMemo(() => {
    return validAttendees.filter(a => selectedIds.has(a.id));
  }, [validAttendees, selectedIds]);

  const currentAttendee = queueAttendees[currentIndex] || null;

  // Toggle selection
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredForSetup.map(a => a.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // Start the queue
  const handleStartQueue = () => {
    if (queueAttendees.length === 0) return;
    setCurrentIndex(0);
    setSentIds(new Set());
    setSkippedIds(new Set());
    setActiveStep('running');
    setCountdown(null);
    setIsPaused(false);
  };

  // Advance to next index
  const advanceToNext = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCountdown(null);

    if (currentIndex + 1 < queueAttendees.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setActiveStep('completed');
    }
  };

  // Send WhatsApp to current contact
  const handleSendCurrent = (contactToOpen?: DispatchAttendee) => {
    const target = contactToOpen || currentAttendee;
    if (!target) return;

    const phone = toE164Phone(target.mobile);
    if (!phone) return;

    const invitationText = formatStructuredInvitation(event, orgTitle, language, target);
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(invitationText)}`;

    // Open WhatsApp Web/App in new tab/window
    window.open(waUrl, '_blank', 'noopener,noreferrer');

    // Mark as sent
    setSentIds(prev => new Set(prev).add(target.id));
    onMarkInvited?.(target.id);

    // If auto-advance is on and there are more attendees
    if (autoAdvance && currentIndex + 1 < queueAttendees.length && !isPaused) {
      setCountdown(2);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(timerRef.current!);
            timerRef.current = null;
            advanceToNext();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (currentIndex + 1 >= queueAttendees.length) {
      setActiveStep('completed');
    }
  };

  // Skip current contact
  const handleSkipCurrent = () => {
    if (!currentAttendee) return;
    setSkippedIds(prev => new Set(prev).add(currentAttendee.id));
    advanceToNext();
  };

  // Jump to specific index in queue
  const handleJumpTo = (idx: number) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCountdown(null);
    setCurrentIndex(idx);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-70 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[94vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 bg-slate-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base truncate">
                  {isBn ? 'বাল্ক হোয়াটসঅ্যাপ বার্তা অটোমেশন' : 'Bulk WhatsApp Broadcast Automation'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                  {isBn ? 'স্বয়ংক্রিয় কিউ' : 'Auto Queue'}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                📌 {event.name} • 📅 {event.date} • 🏛️ {orgTitle}
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

        {/* STEP 1: SETUP & SELECTION */}
        {activeStep === 'setup' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Top Toolbar / Filter */}
            <div className="px-5 py-3 bg-slate-950/60 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-semibold border border-blue-500/30 transition-all cursor-pointer"
                >
                  {isBn ? 'সবাইকে নির্বাচন করুন' : 'Select All'}
                </button>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-white/10 transition-all cursor-pointer"
                >
                  {isBn ? 'নির্বাচন বাতিল' : 'Deselect All'}
                </button>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5">
                {[
                  { id: 'all', label: isBn ? 'সকল' : 'All' },
                  { id: 'kormi', label: isBn ? 'কর্মী' : 'Worker' },
                  { id: 'shohojogi', label: isBn ? 'সহযোগী' : 'Associate' },
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryFilter(cat.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      categoryFilter === cat.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Information Banner */}
            <div className="px-5 py-3 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between text-xs text-emerald-300 shrink-0">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  {isBn
                    ? `সঠিক নম্বরযুক্ত ${toBnNum(selectedIds.size)} / ${toBnNum(validAttendees.length)} জন সাথী প্রস্তুত। প্রতিটি বার্তা স্বয়ংক্রিয়ভাবে নামসহ কাস্টমাইজ হবে।`
                    : `${selectedIds.size} of ${validAttendees.length} contacts selected. Each invitation is automatically personalized.`}
                </span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoAdvance}
                  onChange={e => setAutoAdvance(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 bg-slate-800 border-white/20"
                />
                <span className="text-[11px] font-semibold text-slate-300">
                  {isBn ? 'স্বয়ংক্রিয় বিরতি (Auto-advance)' : 'Auto-advance'}
                </span>
              </label>
            </div>

            {/* Attendees Selection List */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-2">
              {filteredForSetup.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  {isBn ? 'কোনো বৈধ ফোন নম্বরযুক্ত সাথী পাওয়া যায়নি।' : 'No contacts with valid phone numbers found.'}
                </div>
              ) : (
                filteredForSetup.map(att => {
                  const isSelected = selectedIds.has(att.id);
                  const phone = toE164Phone(att.mobile);
                  const isKormi = att.category === 'kormi';

                  return (
                    <div
                      key={att.id}
                      onClick={() => toggleSelect(att.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-slate-800/90 border-emerald-500/40 shadow-sm'
                          : 'bg-slate-900/40 border-white/5 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                            isSelected
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : 'bg-slate-800 border-white/20'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-white text-xs sm:text-sm truncate">
                              {att.name || att.nameBn}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                                isKormi
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              }`}
                            >
                              {isKormi ? (isBn ? 'কর্মী' : 'Worker') : (isBn ? 'সহযোগী' : 'Associate')}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                            <span>📞 +{phone}</span>
                            {att.location && (
                              <>
                                <span>•</span>
                                <span className="truncate">{att.location}</span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      {att.response && (
                        <span className="text-[11px] text-slate-400 capitalize shrink-0">
                          {att.response}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Setup Footer */}
            <div className="p-4 bg-slate-950/80 border-t border-white/10 flex items-center justify-between gap-3 shrink-0">
              <span className="text-xs text-slate-400">
                {isBn
                  ? `মোট ${toBnNum(queueAttendees.length)} জন সাথীকে পাঠানো হবে`
                  : `${queueAttendees.length} recipients queued`}
              </span>
              <button
                type="button"
                onClick={handleStartQueue}
                disabled={queueAttendees.length === 0}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95"
              >
                <span>🚀</span>
                <span>{isBn ? 'হোয়াটসঅ্যাপ কিউ শুরু করুন' : 'Start WhatsApp Queue'}</span>
                <ArrowRight className="w-4 h-4 ml-0.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: RUNNING QUEUE (Spotlight Current Recipient) */}
        {activeStep === 'running' && currentAttendee && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Progress Header */}
            <div className="px-5 py-3 bg-slate-950/80 border-b border-white/10 shrink-0">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                  {isBn
                    ? `প্রেরণ চলছে: ${toBnNum(currentIndex + 1)} / ${toBnNum(queueAttendees.length)}`
                    : `Sending: ${currentIndex + 1} of ${queueAttendees.length}`}
                </span>
                <span className="text-slate-400">
                  {Math.round(((currentIndex + 1) / queueAttendees.length) * 100)}%
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / queueAttendees.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Spotlight Card */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
              {/* Recipient Profile Card */}
              <div className="bg-gradient-to-br from-slate-800/90 to-slate-900 border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg border border-emerald-500/30 shrink-0">
                    {(currentAttendee.name || currentAttendee.nameBn || 'B').charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-white text-base sm:text-lg truncate">
                        {currentAttendee.name || currentAttendee.nameBn}
                      </h4>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                          currentAttendee.category === 'kormi'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}
                      >
                        {currentAttendee.category === 'kormi' ? (isBn ? 'কর্মী' : 'Worker') : (isBn ? 'সহযোগী' : 'Associate')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 flex items-center gap-2">
                      <span className="font-mono text-emerald-400 font-semibold">
                        +{toE164Phone(currentAttendee.mobile)}
                      </span>
                      {currentAttendee.location && (
                        <>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-400 truncate">{currentAttendee.location}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Status indicator on current */}
                <div className="flex items-center gap-2 shrink-0">
                  {sentIds.has(currentAttendee.id) ? (
                    <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      {isBn ? 'পাঠানো হয়েছে' : 'Sent'}
                    </span>
                  ) : skippedIds.has(currentAttendee.id) ? (
                    <span className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold">
                      {isBn ? 'বাদ দেওয়া হয়েছে' : 'Skipped'}
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-semibold animate-pulse">
                      {isBn ? 'প্রস্তুত' : 'Ready to Send'}
                    </span>
                  )}
                </div>
              </div>

              {/* Message Preview Box */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>{isBn ? 'ব্যক্তিগতকৃত আমন্ত্রণ বার্তার নমুনা' : 'Personalized Invitation Preview'}</span>
                  <span className="text-[10px] text-emerald-400 font-medium lowercase">
                    {isBn ? 'নাম ও লোগো সংযুক্ত' : 'includes recipient name & logos'}
                  </span>
                </label>
                <div className="bg-slate-950/80 border border-white/10 rounded-xl p-3.5 sm:p-4 text-xs text-slate-200 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto selection:bg-emerald-500/30">
                  {formatStructuredInvitation(event, orgTitle, language, currentAttendee)}
                </div>
              </div>

              {/* Countdown Banner if auto-advancing */}
              {countdown !== null && (
                <div className="p-3 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs flex items-center justify-between animate-pulse">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-400" />
                    <span>
                      {isBn
                        ? `পরবর্তী সাথীর কাছে যাচ্ছে (${toBnNum(countdown)} সেকেন্ড)...`
                        : `Advancing to next recipient in ${countdown}s...`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={advanceToNext}
                    className="font-bold underline hover:text-white cursor-pointer"
                  >
                    {isBn ? 'এখনই যান' : 'Skip Wait'}
                  </button>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="p-4 bg-slate-950/90 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleJumpTo(Math.max(0, currentIndex - 1))}
                  disabled={currentIndex === 0}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>{isBn ? 'পূর্ববর্তী' : 'Prev'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSkipCurrent}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold border border-white/10 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <SkipForward className="w-4 h-4" />
                  <span>{isBn ? 'বাদ দিয়ে পরবর্তী' : 'Skip'}</span>
                </button>
              </div>

              {/* Big Send WhatsApp Button */}
              <button
                type="button"
                onClick={() => handleSendCurrent()}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer active:scale-95"
              >
                <MessageSquare className="w-4 h-4" />
                <span>
                  {isBn
                    ? `📲 ${currentAttendee.name || 'সাথী'}-কে হোয়াটসঅ্যাপে পাঠান`
                    : `📲 Send to ${currentAttendee.name || 'Contact'} on WhatsApp`}
                </span>
                <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-70" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: COMPLETED VIEW */}
        {activeStep === 'completed' && (
          <div className="p-8 text-center flex flex-col items-center justify-center flex-1 space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-2xl shadow-emerald-900/50">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-white">
                {isBn ? 'হোয়াটসঅ্যাপ বার্তা কিউ সম্পন্ন হয়েছে!' : 'WhatsApp Broadcast Completed!'}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                {isBn
                  ? `মোট ${toBnNum(sentIds.size)} জন সাথীকে সফলভাবে আমন্ত্রণ বার্তা প্রেরণ করা হয়েছে। তাদের সম্মতি ও উপস্থিতি তালিকা আপডেট করা হয়েছে।`
                  : `Successfully dispatched personalized invitations to ${sentIds.size} recipients. Attendee statuses have been updated.`}
              </p>
            </div>

            {/* Stats Pills */}
            <div className="flex items-center gap-3 text-xs pt-2">
              <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 font-semibold">
                ✓ {isBn ? `পাঠানো হয়েছে: ${toBnNum(sentIds.size)}` : `Sent: ${sentIds.size}`}
              </span>
              {skippedIds.size > 0 && (
                <span className="px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/25 font-semibold">
                  ⏭️ {isBn ? `বাদ দেওয়া হয়েছে: ${toBnNum(skippedIds.size)}` : `Skipped: ${skippedIds.size}`}
                </span>
              )}
            </div>

            <div className="pt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={handleStartQueue}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-white/10 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isBn ? 'পুনরায় কিউ চালু করুন' : 'Restart Queue'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md"
              >
                {isBn ? 'সম্পন্ন / বন্ধ করুন' : 'Done & Close'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
