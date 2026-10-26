"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/lib/firebase';
import { ref, update } from 'firebase/database';
import { putInStore, enqueueSync, generateOfflineId } from '@/lib/offlineSync';
import {
  FileSpreadsheet,
  UploadCloud,
  X,
  CheckCircle2,
  AlertTriangle,
  Download,
  Building2,
  Lock,
  Loader2,
  ArrowRight,
  Info,
  Check,
  ChevronDown,
  User,
  Phone,
} from 'lucide-react';
import Link from 'next/link';
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss';

interface ParsedContactRow {
  rowNum: number;
  name: string;
  nameBn?: string;
  mobile: string;
  secondaryMobile?: string;
  whatsappNumber?: string;
  numberType: 'both' | 'phone' | 'whatsapp';
  category: 'shohojogi' | 'kormi';
  status: string;
  location?: string;
  address?: string;
  email?: string;
  note?: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  isPlaceholderPhone?: boolean;
  isShortPhone?: boolean;
}

const DEFAULT_MISSING_PHONE = '01111111111';

export interface ImportContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedUnitId?: string | null;
  organizations: any[];
  onSuccess?: (newContacts: any[], unitId: string) => void;
}

const cleanBDPhone = (raw: string): string => {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('8801') && digits.length === 13) {
    digits = digits.slice(2);
  } else if (digits.startsWith('1') && digits.length === 10) {
    digits = '0' + digits;
  }
  return digits;
};

const isValidBDPhone = (cleaned: string): boolean => {
  return /^01[3-9]\d{8}$/.test(cleaned);
};

const normalizeCategory = (raw?: string): 'shohojogi' | 'kormi' => {
  if (!raw) return 'shohojogi';
  const lower = raw.trim().toLowerCase();
  if (
    lower.includes('kormi') ||
    lower.includes('কর্মী') ||
    lower.includes('rokon') ||
    lower.includes('রুকন') ||
    lower.includes('রোকন')
  ) {
    return 'kormi';
  }
  return 'shohojogi';
};

function parseCSV(text: string): string[][] {
  const cleanText = text.replace(/^\uFEFF/, '').trim();
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n in CRLF
      }
      currentRow.push(currentField.trim());
      if (currentRow.some(col => col.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(col => col.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export default function ImportContactsModal({
  isOpen,
  onClose,
  preselectedUnitId,
  organizations,
  onSuccess,
}: ImportContactsModalProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalSwipeRef = useSwipeToDismiss({ onClose });

  // Available units ONLY (contacts belong to units, never wards)
  const availableUnits = useMemo(() => {
    return organizations.filter(o => o.type === 'unit');
  }, [organizations]);

  // Selected Target Unit
  const [targetUnitId, setTargetUnitId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedContactRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showErrorsDrawer, setShowErrorsDrawer] = useState(false);
  const [showNoticesDrawer, setShowNoticesDrawer] = useState(false);
  const [successResult, setSuccessResult] = useState<{ count: number; unitName: string } | null>(null);

  // Parent ward map for unit descriptions
  const orgMap = useMemo(() => {
    const map = new Map<string, any>();
    organizations.forEach(o => map.set(o.id, o));
    return map;
  }, [organizations]);

  // Group available units by parent ward
  const { wardUnitGroups, standaloneImportUnits } = useMemo(() => {
    const parentMap = new Map<string, { ward: any; units: any[] }>();
    const standalone: any[] = [];

    availableUnits.forEach(u => {
      const parentWard = u.parentOrgId ? orgMap.get(u.parentOrgId) : null;
      if (parentWard) {
        if (!parentMap.has(parentWard.id)) {
          parentMap.set(parentWard.id, { ward: parentWard, units: [] });
        }
        parentMap.get(parentWard.id)!.units.push(u);
      } else {
        standalone.push(u);
      }
    });

    return {
      wardUnitGroups: Array.from(parentMap.values()),
      standaloneImportUnits: standalone,
    };
  }, [availableUnits, orgMap]);

  // Initialize or update target unit when modal opens or preselectedUnitId changes
  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setParsedRows([]);
      setParseError(null);
      setSuccessResult(null);
      setShowErrorsDrawer(false);
      setShowNoticesDrawer(false);

      if (preselectedUnitId && availableUnits.some(u => u.id === preselectedUnitId)) {
        setTargetUnitId(preselectedUnitId);
      } else if (availableUnits.length > 0) {
        setTargetUnitId(availableUnits[0].id);
      } else {
        setTargetUnitId('');
      }
    }
  }, [isOpen, preselectedUnitId, availableUnits]);

  if (!isOpen) return null;

  const selectedUnit = availableUnits.find(u => u.id === targetUnitId);
  const isUnitLocked = Boolean(preselectedUnitId && preselectedUnitId === targetUnitId);

  // Download Sample CSV Template
  const handleDownloadTemplate = () => {
    const headers = [
      'Name',
      'Bangla Name',
      'Mobile',
      'Secondary Phone',
      'WhatsApp Number',
      'Category',
      'Status',
      'Location',
      'Address',
      'Email',
      'Note',
    ];
    const sampleRows = [
      [
        '"Mohammad Abdullah"',
        '"মোহাম্মদ আব্দুল্লাহ"',
        '"01712345678"',
        '""',
        '"01712345678"',
        '"shohojogi"',
        '"New"',
        '"Bhuiyanpara"',
        '"House 12, Road 4"',
        '"abdullah@example.com"',
        '"Morning dawati contact"',
      ],
      [
        '"Kawsar Ahmed"',
        '"কাউসার আহমেদ"',
        '"01819876543"',
        '"01911223344"',
        '""',
        '"kormi"',
        '"Active Worker"',
        '"South Para"',
        '"Ward 5"',
        '""',
        '"Active participant in weekly halqa"',
      ],
      [
        '"Rafiqul Islam"',
        '"রফিকুল ইসলাম"',
        '"01923456789"',
        '""',
        '""',
        '"shohojogi"',
        '"Will Join ✓"',
        '"Main Road"',
        '"Block C"',
        '""',
        '"Regular visitor"',
      ],
    ];

    const csvContent =
      '\uFEFF' + [headers.join(','), ...sampleRows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bji_unit_contacts_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Process File
  const handleFileProcess = (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setParseError('Please upload a valid .csv file.');
      return;
    }

    setFile(selectedFile);
    setParseError(null);
    setParsedRows([]);

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const text = e.target?.result as string;
        if (!text || !text.trim()) {
          setParseError('The uploaded CSV file is empty.');
          return;
        }

        const rawRows = parseCSV(text);
        if (rawRows.length < 2) {
          setParseError('The CSV file must have at least one header row and one data row.');
          return;
        }

        const headers = rawRows[0].map(h => h.trim().toLowerCase());

        // Dynamic Header Matching
        const findColIdx = (keywords: string[]): number => {
          return headers.findIndex(h => keywords.some(k => h.includes(k)));
        };

        const colIdxName = findColIdx(['name', 'নাম', 'brother', 'person', 'contact']);
        const colIdxNameBn = findColIdx(['bangla', 'bn', 'বাংলা']);
        const colIdxMobile = findColIdx(['mobile', 'phone', 'primary', 'মোবাইল', 'ফোন', 'cell']);
        const colIdxSecPhone = findColIdx(['secondary', 'phone 2', 'phone2', 'দ্বিতীয়', 'দ্বিতীয়']);
        const colIdxWA = findColIdx(['whatsapp', 'wa', 'হোয়াটসঅ্যাপ']);
        const colIdxCategory = findColIdx(['category', 'ক্যাটাগরি', 'rank', 'type']);
        const colIdxStatus = findColIdx(['status', 'স্ট্যাটাস']);
        const colIdxLocation = findColIdx(['location', 'area', 'লোকেশন', 'এলাকা']);
        const colIdxAddress = findColIdx(['address', 'ঠিকানা']);
        const colIdxEmail = findColIdx(['email', 'mail', 'ইমেইল']);
        const colIdxNote = findColIdx(['note', 'comment', 'মন্তব্য', 'নোট']);

        if (colIdxName === -1 && colIdxMobile === -1) {
          setParseError('Could not identify "Name" or "Mobile" columns. Please use the template format.');
          return;
        }

        const parsed: ParsedContactRow[] = [];

        for (let i = 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || row.every(val => !val.trim())) continue; // Skip blank rows

          const errors: string[] = [];
          const warnings: string[] = [];
          let isPlaceholderPhone = false;
          let isShortPhone = false;

          const name = (colIdxName !== -1 ? row[colIdxName] : '')?.trim() || '';
          const nameBn = (colIdxNameBn !== -1 ? row[colIdxNameBn] : '')?.trim() || '';
          const rawMobile = (colIdxMobile !== -1 ? row[colIdxMobile] : '')?.trim() || '';
          let cleanedMobile = cleanBDPhone(rawMobile);

          // Name check: only missing name is a blocking error
          if (!name) {
            errors.push('Name is required');
          }

          // Phone handling:
          if (!cleanedMobile || cleanedMobile.length <= 2) {
            // Missing number: assign default placeholder 01111111111
            cleanedMobile = DEFAULT_MISSING_PHONE;
            isPlaceholderPhone = true;
            warnings.push('Mobile number missing → assigned default 01111111111');
          } else if (cleanedMobile.length < 11) {
            // Less than 11 digits: keep as is, do not reject!
            isShortPhone = true;
            warnings.push(`Short number "${rawMobile}" (${cleanedMobile.length} digits) - kept as is`);
          }

          const rawSecPhone = colIdxSecPhone !== -1 ? row[colIdxSecPhone]?.trim() : '';
          const cleanedSecPhone = cleanBDPhone(rawSecPhone);
          if (rawSecPhone && cleanedSecPhone.length < 11) {
            warnings.push(`Secondary phone "${rawSecPhone}" has ${cleanedSecPhone.length} digits`);
          }

          const rawWA = colIdxWA !== -1 ? row[colIdxWA]?.trim() : '';
          const cleanedWA = cleanBDPhone(rawWA);
          if (rawWA && cleanedWA.length < 11) {
            warnings.push(`WhatsApp "${rawWA}" has ${cleanedWA.length} digits`);
          }

          const category = normalizeCategory(colIdxCategory !== -1 ? row[colIdxCategory] : undefined);
          const rawStatus = (colIdxStatus !== -1 ? row[colIdxStatus] : '')?.trim();
          const status = (rawStatus && rawStatus.toLowerCase() !== 'new') ? rawStatus.toLowerCase().replace(/\s+/g, '_') : '';

          const location = (colIdxLocation !== -1 ? row[colIdxLocation] : '')?.trim();
          const address = (colIdxAddress !== -1 ? row[colIdxAddress] : '')?.trim();
          const email = (colIdxEmail !== -1 ? row[colIdxEmail] : '')?.trim();
          const note = (colIdxNote !== -1 ? row[colIdxNote] : '')?.trim();

          parsed.push({
            rowNum: i + 1,
            name,
            nameBn: nameBn || undefined,
            mobile: cleanedMobile,
            secondaryMobile: cleanedSecPhone || undefined,
            whatsappNumber: cleanedWA || undefined,
            numberType: 'both',
            category,
            status,
            location: location || undefined,
            address: address || undefined,
            email: email || undefined,
            note: note || undefined,
            isValid: errors.length === 0,
            errors,
            warnings,
            isPlaceholderPhone,
            isShortPhone,
          });
        }

        if (parsed.length === 0) {
          setParseError('No contact data rows found in the CSV.');
          return;
        }

        setParsedRows(parsed);
      } catch (err: any) {
        console.error('Failed to parse CSV:', err);
        setParseError('Failed to parse CSV file. Ensure it is formatted properly.');
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  // Perform Import
  const handleImport = async () => {
    if (!user || !targetUnitId || parsedRows.length === 0 || isSubmitting) return;

    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      alert('There are no valid contacts to import.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newContacts: any[] = [];
      const timestamp = new Date().toISOString();

      validRows.forEach(row => {
        const contactId = generateOfflineId('contact');
        const contactData = {
          id: contactId,
          name: row.name,
          nameBn: row.nameBn || null,
          mobile: row.mobile,
          secondaryMobile: row.secondaryMobile || null,
          whatsappNumber: row.whatsappNumber || null,
          numberType: row.numberType || 'both',
          category: row.category,
          status: (row.status && row.status !== 'new') ? row.status : '',
          location: row.location || null,
          address: row.address || null,
          email: row.email || null,
          note: row.note || null,
          // CRITICAL: Strictly assigned to the chosen Unit!
          organizationId: targetUnitId,
          createdBy: user.uid,
          createdAt: timestamp,
        };
        newContacts.push(contactData);
      });

      // 1. Save all to IndexedDB locally for instant availability
      for (const contact of newContacts) {
        await putInStore('contacts', contact);
      }

      // 2. Sync to Firebase Realtime Database
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const updates: Record<string, any> = {};
        newContacts.forEach(c => {
          updates[`contacts/${c.id}`] = c;
        });
        await update(ref(database), updates);
      } else {
        // Enqueue offline sync
        for (const c of newContacts) {
          await enqueueSync({
            collection: 'contacts',
            action: 'set',
            path: `contacts/${c.id}`,
            data: c,
          });
        }
      }

      // 3. Dispatch global custom event for other open pages & dashboards
      window.dispatchEvent(
        new CustomEvent('bji_offline_synced', {
          detail: { imported: true, count: newContacts.length, unitId: targetUnitId },
        })
      );

      // 4. Callback
      if (onSuccess) {
        onSuccess(newContacts, targetUnitId);
      }

      const unitName = selectedUnit?.name || 'Selected Unit';
      setSuccessResult({
        count: newContacts.length,
        unitName,
      });
    } catch (err) {
      console.error('Error during CSV import:', err);
      alert('An error occurred during import. Please check console.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const validCount = parsedRows.filter(r => r.isValid).length;
  const noticeCount = parsedRows.filter(r => r.isValid && (r.isPlaceholderPhone || r.isShortPhone)).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
      <div
        ref={modalSwipeRef}
        className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] relative"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 hover:bg-white/40 rounded-full mx-auto mt-2 -mb-2 sm:hidden transition-colors cursor-grab" />
        {/* Glow accent */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-slate-950/40 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-inner">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">Import Contacts to Unit</h3>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[10px] font-semibold">
                  Unit Scoped
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Bulk upload individuals directly into a grassroots unit via CSV file
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success Screen */}
        {successResult ? (
          <div className="p-8 space-y-6 text-center my-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-2">
              <h4 className="text-xl font-bold text-white">Import Successful!</h4>
              <p className="text-sm text-slate-300 max-w-md mx-auto">
                <span className="font-semibold text-emerald-400">{successResult.count} contacts</span> have
                been imported and linked strictly to unit{' '}
                <span className="font-semibold text-white">“{successResult.unitName}”</span>.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <Link
                href={`/dashboard/contacts?orgId=${targetUnitId}`}
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-2"
              >
                <span>View Unit Contacts</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-white/10 transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-5 overflow-y-auto flex-1">
            {/* Scoping Explanation Alert */}
            <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-start gap-3">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-200/90 leading-relaxed">
                <strong className="text-blue-100 font-semibold">Unit Scoping Rule:</strong> Individual contacts
                belong strictly to a <strong>Unit</strong>. Wards oversee units, so contacts are never assigned
                directly to a ward.
              </p>
            </div>

            {/* Target Unit Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Destination Grassroots Unit</span>
                {isUnitLocked && (
                  <span className="text-[11px] text-blue-400 flex items-center gap-1 font-medium">
                    <Lock className="w-3 h-3" /> Locked to this Unit
                  </span>
                )}
              </label>

              {availableUnits.length === 0 ? (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
                  No units found in your accessible organizations. Please create a <strong>Unit</strong> under an
                  organization before importing contacts.
                </div>
              ) : isUnitLocked ? (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-800/80 border border-blue-500/30 text-white text-sm font-semibold">
                  <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="truncate">{selectedUnit?.name}</span>
                  {selectedUnit?.parentOrgId && (
                    <span className="text-xs font-normal text-purple-300 ml-auto">
                      Ward: {orgMap.get(selectedUnit.parentOrgId)?.name || 'Parent Ward'}
                    </span>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={targetUnitId}
                    onChange={e => setTargetUnitId(e.target.value)}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer pr-10"
                  >
                    {wardUnitGroups.map(({ ward, units }) => (
                      <optgroup key={ward.id} label={`👑 ${ward.name} (Parent Ward)`} className="bg-slate-900 text-purple-300 font-semibold">
                        {units.map(unit => (
                          <option key={unit.id} value={unit.id} className="bg-slate-900 text-white font-normal">
                            ↳ {unit.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                    {standaloneImportUnits.length > 0 && (
                      <optgroup label="Standalone Units" className="bg-slate-900 text-slate-400">
                        {standaloneImportUnits.map(unit => (
                          <option key={unit.id} value={unit.id} className="bg-slate-900 text-white">
                            🏢 {unit.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              )}
            </div>

            {/* CSV Template Download Action */}
            <div className="flex items-center justify-between p-3.5 bg-slate-800/50 rounded-2xl border border-white/5">
              <div>
                <p className="text-xs font-semibold text-white">Need the correct column structure?</p>
                <p className="text-[11px] text-slate-400">Download the formatted CSV sample with example rows</p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Download Template</span>
              </button>
            </div>

            {/* Drag & Drop Upload Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-500/10 scale-[1.01]'
                  : file
                  ? 'border-emerald-500/40 bg-emerald-500/5'
                  : 'border-white/15 hover:border-white/30 bg-slate-800/30 hover:bg-slate-800/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileProcess(e.target.files[0]);
                  }
                }}
              />

              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <UploadCloud className="w-6 h-6" />
                </div>

                {file ? (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white flex items-center justify-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      {file.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {(file.size / 1024).toFixed(1)} KB · Click or drag to replace file
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-white">
                      Click to browse or drag and drop your CSV file here
                    </p>
                    <p className="text-xs text-slate-500">Supports comma-separated values (.csv)</p>
                  </div>
                )}
              </div>
            </div>

            {/* Error Message */}
            {parseError && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-xs flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{parseError}</span>
              </div>
            )}

            {/* Parsing Stats & Preview */}
            {parsedRows.length > 0 && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      {validCount} Ready to Import
                    </span>

                    {noticeCount > 0 && (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5" />
                        {noticeCount} with Phone Notices
                      </span>
                    )}

                    {invalidCount > 0 && (
                      <span className="px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {invalidCount} Skipped (No Name)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {noticeCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowNoticesDrawer(!showNoticesDrawer)}
                        className="text-xs text-amber-400 hover:text-amber-300 font-medium underline underline-offset-2 cursor-pointer"
                      >
                        {showNoticesDrawer ? 'Hide notices' : `View ${noticeCount} notices`}
                      </button>
                    )}

                    {invalidCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowErrorsDrawer(!showErrorsDrawer)}
                        className="text-xs text-red-400 hover:text-red-300 font-medium underline underline-offset-2 cursor-pointer"
                      >
                        {showErrorsDrawer ? 'Hide skipped' : `View ${invalidCount} skipped`}
                      </button>
                    )}
                  </div>
                </div>

                {/* Notices Drawer */}
                {showNoticesDrawer && noticeCount > 0 && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/30 space-y-2 max-h-36 overflow-y-auto text-xs">
                    <p className="font-semibold text-amber-300 text-[11px] uppercase tracking-wider flex items-center gap-1">
                      <Info className="w-3.5 h-3.5" />
                      Phone Notice Summary (Will Still Import Successfully):
                    </p>
                    {parsedRows
                      .filter(r => r.isValid && (r.isPlaceholderPhone || r.isShortPhone))
                      .map(r => (
                        <div key={r.rowNum} className="flex items-start justify-between gap-2 text-slate-300 border-b border-white/5 pb-1">
                          <span className="text-slate-400 font-mono shrink-0">Row {r.rowNum}:</span>
                          <span className="text-white font-medium truncate">{r.name}</span>
                          <span className="text-amber-400 text-[11px] text-right">{r.warnings.join(', ')}</span>
                        </div>
                      ))}
                  </div>
                )}

                {/* Invalid Rows Drawer */}
                {showErrorsDrawer && invalidCount > 0 && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-red-500/30 space-y-2 max-h-36 overflow-y-auto text-xs">
                    <p className="font-semibold text-red-300 text-[11px] uppercase tracking-wider">
                      Skipped Rows (Missing Name):
                    </p>
                    {parsedRows
                      .filter(r => !r.isValid)
                      .map(r => (
                        <div key={r.rowNum} className="flex items-start justify-between gap-2 text-slate-300 border-b border-white/5 pb-1">
                          <span className="text-slate-400 font-mono shrink-0">Row {r.rowNum}:</span>
                          <span className="text-white font-medium truncate">{r.name || '(No Name)'}</span>
                          <span className="text-red-400 text-[11px] text-right">{r.errors.join(', ')}</span>
                        </div>
                      ))}
                  </div>
                )}

                {/* Contact Preview Table (First 5 valid) */}
                <div className="border border-white/10 rounded-2xl overflow-hidden bg-slate-950/40">
                  <div className="p-3 bg-slate-800/40 border-b border-white/10 flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold text-slate-300">Preview (Sample Contacts)</span>
                    <span>Showing first {Math.min(5, validCount)} of {validCount}</span>
                  </div>

                  <div className="divide-y divide-white/5 max-h-48 overflow-y-auto">
                    {parsedRows
                      .filter(r => r.isValid)
                      .slice(0, 5)
                      .map((contact, idx) => (
                        <div key={idx} className="p-3 flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0 flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                              <User className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-white truncate">
                                {contact.name}
                                {contact.nameBn && (
                                  <span className="text-slate-400 font-normal ml-1.5">({contact.nameBn})</span>
                                )}
                              </p>
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center flex-wrap gap-1.5">
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-emerald-400" />
                                  {contact.mobile}
                                </span>
                                {contact.isPlaceholderPhone && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-sans">
                                    Default (Missing in CSV)
                                  </span>
                                )}
                                {contact.isShortPhone && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-sans">
                                    {contact.mobile.length} digits
                                  </span>
                                )}
                                {contact.location && (
                                  <span className="text-slate-500 font-sans">· {contact.location}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                contact.category === 'kormi'
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                              }`}
                            >
                              {contact.category === 'kormi' ? 'কর্মী' : 'সহযোগী'}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal Footer */}
        {!successResult && (
          <div className="p-4 sm:p-5 border-t border-white/10 bg-slate-950/60 flex items-center justify-between gap-3 relative z-10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleImport}
              disabled={validCount === 0 || !targetUnitId || isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Importing Contacts...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>
                    Import {validCount > 0 ? `${validCount} Contacts` : 'Contacts'} to{' '}
                    {selectedUnit?.name || 'Unit'}
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
