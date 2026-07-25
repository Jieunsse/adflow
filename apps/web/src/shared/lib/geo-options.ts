export const COUNTRIES = [
  { code: 'KR', label: '대한민국' },
  { code: 'US', label: '미국' },
  { code: 'JP', label: '일본' },
  { code: 'CN', label: '중국' },
  { code: 'TW', label: '대만' },
  { code: 'HK', label: '홍콩' },
  { code: 'SG', label: '싱가포르' },
  { code: 'VN', label: '베트남' },
  { code: 'TH', label: '태국' },
  { code: 'ID', label: '인도네시아' },
  { code: 'GB', label: '영국' },
  { code: 'CA', label: '캐나다' },
  { code: 'AU', label: '호주' },
] as const

export type CountryCode = (typeof COUNTRIES)[number]['code']

export const COUNTRY_CODES: Set<string> = new Set(COUNTRIES.map((c) => c.code))

export const COUNTRY_LABEL: Record<string, string> = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, c.label]),
)

export const DEFAULT_COUNTRIES: string[] = ['KR']
