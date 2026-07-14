import { motion } from 'motion/react'

/**
 * A cute inline chibi anime girl for empty/error states. Pure SVG so it always
 * renders (no network, no image asset) and scales crisply. When `crying`, tears
 * animate down her cheeks; otherwise she just looks a little puzzled.
 */
export function CryingGirl({
  crying = true,
  className,
}: {
  crying?: boolean
  className?: string
}) {
  return (
    <motion.svg
      viewBox="0 0 120 120"
      className={className}
      initial={{ scale: 0.7, opacity: 0, rotate: -4 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 240, damping: 15 }}
      role="img"
      aria-label={crying ? 'A crying anime girl' : 'A puzzled anime girl'}
    >
      {/* Back hair */}
      <path
        d="M22 66c0-26 17-44 38-44s38 18 38 44c0 8-3 15-7 19 2-10 1-24-6-31 1 8-1 14-4 17 0-16-9-27-21-27S41 55 41 71c-3-3-5-9-4-17-7 7-8 21-6 31-4-4-9-11-9-19Z"
        fill="#ff4d6d"
      />
      {/* Twin-tails */}
      <ellipse cx="24" cy="72" rx="11" ry="18" fill="#ff4d6d" />
      <ellipse cx="96" cy="72" rx="11" ry="18" fill="#ff4d6d" />
      <circle cx="24" cy="58" r="5" fill="#ff6b85" />
      <circle cx="96" cy="58" r="5" fill="#ff6b85" />

      {/* Face */}
      <ellipse cx="60" cy="62" rx="30" ry="29" fill="#ffe3d3" />

      {/* Fringe */}
      <path
        d="M31 55c2-18 15-30 29-30s27 12 29 30c-6-9-13-11-13-11-1 6-5 9-5 9-2-6-6-9-11-9s-9 3-11 9c0 0-4-3-5-9 0 0-7 2-13 11Z"
        fill="#ff4d6d"
      />

      {/* Blush */}
      <ellipse cx="42" cy="70" rx="6" ry="4" fill="#ffb3c1" opacity="0.85" />
      <ellipse cx="78" cy="70" rx="6" ry="4" fill="#ffb3c1" opacity="0.85" />

      {/* Eyes */}
      <g>
        <ellipse cx="47" cy="62" rx="6.5" ry="8" fill="#3a2b3f" />
        <ellipse cx="73" cy="62" rx="6.5" ry="8" fill="#3a2b3f" />
        <circle cx="49" cy="59" r="2.4" fill="#fff" />
        <circle cx="75" cy="59" r="2.4" fill="#fff" />
        {crying && (
          <>
            {/* watery lower lids */}
            <path d="M40 68c4 3 10 3 14 0" stroke="#7fd4ff" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M66 68c4 3 10 3 14 0" stroke="#7fd4ff" strokeWidth="2" fill="none" strokeLinecap="round" />
          </>
        )}
      </g>

      {/* Mouth */}
      {crying ? (
        <path d="M54 80c3-4 9-4 12 0" stroke="#c14b63" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M55 80h10" stroke="#c14b63" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      )}

      {/* Tears */}
      {crying && (
        <>
          <motion.path
            d="M44 71c-2 4-3 7-3 9a3 3 0 006 0c0-2-1-5-3-9Z"
            fill="#7fd4ff"
            initial={{ y: -4, opacity: 0 }}
            animate={{ y: [0, 14], opacity: [0, 1, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeIn' }}
          />
          <motion.path
            d="M76 71c-2 4-3 7-3 9a3 3 0 006 0c0-2-1-5-3-9Z"
            fill="#7fd4ff"
            initial={{ y: -4, opacity: 0 }}
            animate={{ y: [0, 14], opacity: [0, 1, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeIn', delay: 0.5 }}
          />
        </>
      )}
    </motion.svg>
  )
}
