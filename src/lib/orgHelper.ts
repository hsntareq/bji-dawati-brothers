import { Language } from "@/context/LanguageContext";

// Common bilingual dictionary for administrative, place, and religious terms
const EN_TO_BN_TERMS: [RegExp, string][] = [
  [/\bBhuiyan\s*para\b/gi, 'ভূঁইয়াপাড়া'],
  [/\bNoorani\b|\bNurani\b/gi, 'নূরানী'],
  [/\bMasjid\b/gi, 'মসজিদ'],
  [/\bSangbadik\b/gi, 'সাংবাদিক'],
  [/\bColony\b/gi, 'কলোনি'],
  [/\bJame\b|\bJamea\b/gi, 'জামে'],
  [/\bEidgah\b/gi, 'ঈদগাহ'],
  [/\bMadrasha\b|\bMadrasa\b/gi, 'মাদ্রাসা'],
  [/\bSchool\b/gi, 'স্কুল'],
  [/\bCollege\b/gi, 'কলেজ'],
  [/\bHospital\b/gi, 'হাসপাতাল'],
  [/\bMoholla\b|\bMahalla\b/gi, 'মহল্লা'],
  [/\bBazar\b|\bBazaar\b/gi, 'বাজার'],
  [/\bRoad\b/gi, 'রোড'],
  [/\bLane\b/gi, 'লেন'],
  [/\bSector\b/gi, 'সেক্টর'],
  [/\bBlock\b/gi, 'ব্লক'],
  [/\bNorth\b|\bUttar\b/gi, 'উত্তর'],
  [/\bSouth\b|\bDakshin\b/gi, 'দক্ষিণ'],
  [/\bEast\b|\bPurba\b/gi, 'পূর্ব'],
  [/\bWest\b|\bPaschim\b/gi, 'পশ্চিম'],
  [/\bCentral\b|\bMiddle\b|\bModdho\b/gi, 'মধ্য'],
  [/\bWard\b/gi, 'ওয়ার্ড'],
  [/\bUnit\b/gi, 'ইউনিট'],
  [/\bOrganization\b|\bOrg\b/gi, 'সংগঠন'],
  [/\bPourashava\b|\bMunicipality\b/gi, 'পৌরসভা'],
  [/\bUnion\b/gi, 'ইউনিয়ন'],
  [/\bUpazila\b/gi, 'উপজেলা'],
  [/\bThana\b/gi, 'থানা'],
  [/\bZila\b|\bDistrict\b/gi, 'জেলা'],
  [/\bCity\b/gi, 'সিটি'],
  [/\bVillage\b|\bGram\b/gi, 'গ্রাম'],
  [/\bPara\b/gi, 'পাড়া'],
  [/\bNagar\b/gi, 'নগর'],
  [/\bNo\.\s*/gi, 'নং '],
  [/\bNo\b/gi, 'নং'],
];

const BN_TO_EN_TERMS: [RegExp, string][] = [
  [/ভূঁইয়াপাড়া|ভুঁইয়া\s*পাড়া|ভুঁইয়া\s*পাড়া/g, 'Bhuiyanpara'],
  [/নূরানী|নুরানী/g, 'Noorani'],
  [/মসজিদ/g, 'Masjid'],
  [/সাংবাদিক/g, 'Sangbadik'],
  [/কলোনি/g, 'Colony'],
  [/জামে/g, 'Jame'],
  [/ঈদগাহ/g, 'Eidgah'],
  [/মাদ্রাসা/g, 'Madrasa'],
  [/স্কুল/g, 'School'],
  [/কলেজ/g, 'College'],
  [/হাসপাতাল/g, 'Hospital'],
  [/মহল্লা/g, 'Moholla'],
  [/বাজার/g, 'Bazar'],
  [/রোড/g, 'Road'],
  [/লেন/g, 'Lane'],
  [/সেক্টর/g, 'Sector'],
  [/ব্লক/g, 'Block'],
  [/উত্তর/g, 'North'],
  [/দক্ষিণ/g, 'South'],
  [/পূর্ব/g, 'East'],
  [/পশ্চিম/g, 'West'],
  [/মধ্য/g, 'Central'],
  [/ইউনিট/g, 'Unit'],
  [/ওয়ার্ড|ওয়াড/g, 'Ward'],
  [/সংগঠন/g, 'Organization'],
  [/পৌরসভা/g, 'Pourashava'],
  [/ইউনিয়ন/g, 'Union'],
  [/উপজেলা/g, 'Upazila'],
  [/থানা/g, 'Thana'],
  [/জেলা/g, 'District'],
  [/সিটি/g, 'City'],
  [/গ্রাম/g, 'Gram'],
  [/পাড়া|পাড়া/g, 'Para'],
  [/নগর/g, 'Nagar'],
  [/নং\s*/g, 'No. '],
];

const EN_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

function toBnDigits(str: string): string {
  return str.replace(/\d/g, d => BN_DIGITS[parseInt(d, 10)] || d);
}

function toEnDigits(str: string): string {
  return str.replace(/[০-৯]/g, d => {
    const idx = BN_DIGITS.indexOf(d);
    return idx !== -1 ? String(idx) : d;
  });
}

/**
 * Returns the localized name of an organization or ward based on the active language ('en' | 'bn').
 */
export function getOrgDisplayName(org: any, language: Language = 'en'): string {
  if (!org) return '—';

  const rawName: string = typeof org === 'string' ? org : (org.name || '');
  const nameBn: string = typeof org === 'object' ? (org.nameBn || org.bnName || '') : '';
  const nameEn: string = typeof org === 'object' ? (org.nameEn || org.enName || '') : '';

  const cleanRaw = rawName.trim();
  const cleanBn = nameBn.trim();
  const cleanEn = nameEn.trim();

  const hasBengali = (text: string) => /[\u0980-\u09FF]/.test(text);

  if (language === 'bn') {
    // 1. Explicit Bengali name
    if (cleanBn) return cleanBn;

    // 2. If cleanRaw is already purely Bengali
    if (cleanRaw && hasBengali(cleanRaw) && !/[a-zA-Z]/.test(cleanRaw)) {
      return cleanRaw;
    }

    // 3. Translate English words/suffixes and digits to Bengali
    if (cleanRaw) {
      let result = cleanRaw;
      for (const [pattern, bnText] of EN_TO_BN_TERMS) {
        result = result.replace(pattern, bnText);
      }
      return toBnDigits(result);
    }

    // 4. Fallback
    return cleanEn || '—';
  }

  // language === 'en'
  // 1. Explicit English name
  if (cleanEn) return cleanEn;

  // 2. If cleanRaw is already purely English (no Bengali script)
  if (cleanRaw && !hasBengali(cleanRaw)) {
    return cleanRaw;
  }

  // 3. Translate Bengali words/suffixes and digits to English
  if (cleanRaw && hasBengali(cleanRaw)) {
    let result = cleanRaw;
    for (const [pattern, enText] of BN_TO_EN_TERMS) {
      result = result.replace(pattern, enText);
    }
    result = toEnDigits(result);
    // Clean up any double spaces created by substitutions
    return result.replace(/\s{2,}/g, ' ').trim();
  }

  // 4. Fallback
  return cleanBn || cleanRaw || '—';
}

/**
 * Returns the secondary language name (for tooltips or dual-language subtitles)
 */
export function getOrgSecondaryName(org: any, language: Language = 'en'): string | null {
  if (!org || typeof org !== 'object') return null;
  const targetOtherLang: Language = language === 'bn' ? 'en' : 'bn';
  const primary = getOrgDisplayName(org, language);
  const secondary = getOrgDisplayName(org, targetOtherLang);
  if (secondary && secondary !== primary && secondary !== '—') {
    return secondary;
  }
  return null;
}

