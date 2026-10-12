import { useId } from 'react'

/** Supplied Zeus artwork; currentColor follows the active theme. */
export default function ZeusMark({ className = '' }: { className?: string }) {
  const maskId = useId()
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <mask id={maskId}>
      <rect width="48" height="48" fill="#fff" />
      <path fill="#000" d="M16.5 15.5 H31.5 L34.2 19.5 V26.4 L24 30.6 L13.8 26.4 V19.5 Z" />
      <g fill="none" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter">
        <path d="M31.44 14.59 L40.18 8.24 M28.88 12.20 L34.60 3.04 M25.60 10.94 L27.47 0.30 M22.40 10.94 L20.53 0.30 M19.12 12.20 L13.40 3.04 M16.56 14.59 L7.82 8.24" />
        <path d="M24 33.6 V47 M19.4 33 V44 M28.6 33 V44 M14.8 31.4 V37.6 M33.2 31.4 V37.6" />
      </g>
    </mask>
    <path mask={`url(#${maskId})`} fill="currentColor" d="M7.5 20 A16.5 16.5 0 0 1 40.5 20 V28.5 L31.5 41 L24 46.5 L16.5 41 L7.5 28.5 Z" />
    <path fill="currentColor" d="M15.4 20.2 L21.8 21.4 V23.2 L15.4 22.2 Z M32.6 20.2 L26.2 21.4 V23.2 L32.6 22.2 Z M23.1 19.4 H24.9 L26.2 27.4 L24 28.6 L21.8 27.4 Z" />
  </svg>
}
