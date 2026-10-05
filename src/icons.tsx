import type { CSSProperties } from 'react'
const paths = {
  home: <><path d="m3 10 9-7 9 7v10H3z" /><path d="M9 20v-7h6v7" /></>,
  book: <><path d="M12 5c-4-3-8-2-10-1v15c4-2 8-1 10 1 2-2 6-3 10-1V4c-4-2-8-1-10 1z" /><path d="M12 5v15" /></>,
  settings: <><path d="M4 6h16M4 12h16M4 18h16" /><path d="M8 3v6m8 0v6M9 15v6" /></>,
  volume: <><path d="m3 9 5 0 5-5v16l-5-5H3z" /><path d="M17 8a7 7 0 0 1 0 8m3-11a11 11 0 0 1 0 14" /></>,
  mic: <><rect x="9" y="2" width="6" height="13" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" /></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  check: <path d="m4 12 5 5L20 6" />,
  repeat: <><path d="M20 8a8 8 0 0 0-13-4L3 8m0-5v5h5M4 16a8 8 0 0 0 13 4l4-4m0 5v-5h-5" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4" /></>,
} as const
export function Icon({ name, style }: { name: keyof typeof paths; style?: CSSProperties }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>{paths[name]}</svg>
}
