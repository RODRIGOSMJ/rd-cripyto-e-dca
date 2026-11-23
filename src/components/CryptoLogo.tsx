import React from 'react';

interface CryptoLogoProps {
  symbol: string;
  color?: string;
  size?: number;
  className?: string;
}

const BRAND_COLORS: Record<string, string> = {
  BTC: '#F7931A',
  ETH: '#627EEA',
  POL: '#8247E5',
  MATIC: '#8247E5',
  BNB: '#F3BA2F',
  SOL: '#141923',
  XRP: '#1E252B',
  DOGE: '#C2A633',
  ALGO: '#111827',
  USDT: '#26A17B',
  USDC: '#2775CA',
  ADA: '#0033AD',
  AVAX: '#E84142',
  LINK: '#2A5ADA',
  LTC: '#345D9D',
  DOT: '#E6007A',
  TRX: '#EF0027',
  SUI: '#4DA2FF',
  XLM: '#0F172A',
  HBAR: '#111827',
  TON: '#0098EA',
  SHIB: '#D9381E',
  UNI: '#FF007A',
  AAVE: '#B6509E',
  ARB: '#28A0F0',
  OP: '#FF0420',
  NEAR: '#111827',
  ATOM: '#2E3148',
  BCH: '#0AC18E',
  ETC: '#328332',
  PEPE: '#3D9940'
};

export const CryptoLogo: React.FC<CryptoLogoProps> = ({
  symbol,
  color,
  size = 20,
  className = ''
}) => {
  const sym = String(symbol || '').toUpperCase().trim();
  const bg = BRAND_COLORS[sym] || color || '#D91E2A';

  const renderGlyph = () => {
    switch (sym) {
      case 'BTC':
        return (
          <>
            <circle cx="16" cy="16" r="16" fill="#F7931A" />
            <path
              d="M22.1 13.8c.3-2-1.2-3.1-3.3-3.8l.7-2.7-1.6-.4-.7 2.6c-.4-.1-.9-.2-1.3-.3l.7-2.6-1.6-.4-.7 2.7c-.4-.1-.7-.2-1-.2l-2.3-.6-.4 1.7s1.2.3 1.2.3c.7.2.8.6.8 1l-.8 3.1c.1 0 .1 0 .2.1h-.2l-1.1 4.4c-.1.2-.3.5-.8.4 0 0-1.2-.3-1.2-.3l-.8 1.9 2.2.5c.4.1.8.2 1.2.3l-.7 2.7 1.6.4.7-2.7c.4.1.9.2 1.3.3l-.7 2.7 1.6.4.7-2.7c2.8.5 4.9.3 5.8-2.2.7-2 0-3.2-1.5-4 1.1-.3 1.9-1 2.1-2.4zm-3.8 5.3c-.5 2-3.9.9-5 .7l.9-3.6c1.1.3 4.6.8 4.1 2.9zm.5-5.3c-.5 1.8-3.3.9-4.2.7l.8-3.2c.9.2 3.9.7 3.4 2.5z"
              fill="#FFFFFF"
            />
          </>
        );

      case 'ETH':
        return (
          <>
            <circle cx="16" cy="16" r="16" fill="#627EEA" />
            <path d="M16 5.5v7.8l6.6 2.95L16 5.5z" fill="#FFFFFF" fillOpacity="0.65" />
            <path d="M16 5.5L9.4 16.25 16 13.3V5.5z" fill="#FFFFFF" />
            <path d="M16 21.1v5.4l6.6-9.15L16 21.1z" fill="#FFFFFF" fillOpacity="0.65" />
            <path d="M16 26.5v-5.4l-6.6-3.75L16 26.5z" fill="#FFFFFF" />
            <path d="M16 19.85l6.6-3.6L16 13.3v6.55z" fill="#FFFFFF" fillOpacity="0.3" />
            <path d="M9.4 16.25l6.6 3.6V13.3l-6.6 2.95z" fill="#FFFFFF" fillOpacity="0.7" />
          </>
        );

      case 'POL':
      case 'MATIC':
        return (
          <>
            <circle cx="16" cy="16" r="16" fill="#8247E5" />
            <path
              d="M21.4 12.6c-.4-.2-.9-.2-1.3 0l-3 1.8-2 1.2-3 1.7c-.4.2-.9.2-1.3 0l-2.3-1.4c-.4-.2-.7-.7-.7-1.1v-2.7c0-.5.3-.9.7-1.1l2.3-1.3c.4-.2.9-.2 1.3 0l2.3 1.3c.4.2.7.7.7 1.1v1.8l2-1.2v-1.8c0-.5-.3-.9-.7-1.1l-4.2-2.5c-.4-.2-.9-.2-1.3 0L6.6 8.8c-.4.2-.6.7-.6 1.1v5c0 .5.2.9.6 1.1l4.3 2.5c.4.2.9.2 1.3 0l3-1.7 2-1.2 3-1.7c.4-.2.9-.2 1.3 0l2.3 1.3c.4.2.7.7.7 1.1v2.7c0 .5-.3.9-.7 1.1l-2.3 1.4c-.4.2-.9.2-1.3 0l-2.3-1.3c-.4-.2-.7-.7-.7-1.1v-1.8l-2 1.2v1.8c0 .5.3.9.7 1.1l4.3 2.5c.4.2.9.2 1.3 0l4.3-2.5c.4-.2.6-.7.6-1.1v-5c0-.5-.2-.9-.6-1.1l-4.3-2.5z"
              fill="#FFFFFF"
            />
          </>
        );

      case 'BNB':
        return (
          <>
            <circle cx="16" cy="16" r="16" fill="#F3BA2F" />
            <path
              d="M12.1 14.3L16 10.4l3.9 3.9 2.3-2.3L16 5.8 9.8 12l2.3 2.3zm-6.3 1.7l2.3-2.3 2.3 2.3-2.3 2.3-2.3-2.3zm6.3 1.7L16 21.6l3.9-3.9 2.3 2.3-6.2 6.2-6.2-6.2 2.3-2.3zm9.5-1.7l2.3-2.3 2.3 2.3-2.3 2.3-2.3-2.3zm-3.3 0L16 13.7 13.7 16l2.3 2.3 2.3-2.3z"
              fill="#FFFFFF"
            />
          </>
        );

      case 'SOL':
        return (
          <>
            <defs>
              <linearGradient id="sol-grad-rg" x1="6" y1="24" x2="26" y2="8" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#00FFA3" />
                <stop offset="50%" stopColor="#03E1FF" />
                <stop offset="100%" stopColor="#DC1FFF" />
              </linearGradient>
            </defs>
            <circle cx="16" cy="16" r="16" fill="#111622" />
            <path
              d="M9.7 20.1c.2-.2.4-.3.7-.3h13.5c.4 0 .6.5.3.8l-2.3 2.3c-.2.2-.4.3-.7.3H7.7c-.4 0-.6-.5-.3-.8l2.3-2.3z"
              fill="url(#sol-grad-rg)"
            />
            <path
              d="M9.7 8.9c.2-.2.4-.3.7-.3h13.5c.4 0 .6.5.3.8l-2.3 2.3c-.2.2-.4.3-.7.3H7.7c-.4 0-.6-.5-.3-.8l2.3-2.3z"
              fill="url(#sol-grad-rg)"
            />
            <path
              d="M21.9 14.5c-.2-.2-.4-.3-.7-.3H7.7c-.4 0-.6.5-.3.8l2.3 2.3c.2.2.4.3.7.3h13.5c.4 0 .6-.5.3-.8l-2.3-2.3z"
              fill="url(#sol-grad-rg)"
            />
          </>
        );

      case 'XRP':
        return (
          <>
            <circle cx="16" cy="16" r="16" fill="#1B2229" />
            <path
              d="M22.8 8.5h2.4l-5.7 5.6c-1.9 1.9-5.1 1.9-7 0L6.8 8.5h2.4l4.5 4.4c1.3 1.2 3.3 1.2 4.6 0l4.5-4.4zM9.2 23.5H6.8l5.7-5.6c1.9-1.9 5.1-1.9 7 0l5.7 5.6h-2.4l-4.5-4.4c-1.3-1.2-3.3-1.2-4.6 0l-4.5 4.4z"
              fill="#FFFFFF"
            />
          </>
        );

      case 'DOGE':
        return (
          <>
            <circle cx="16" cy="16" r="16" fill="#C2A633" />
            <path
              d="M12.2 9.2h4.2c4.4 0 7.2 2.6 7.2 6.8s-2.8 6.8-7.2 6.8h-4.2V9.2zm2.9 2.4v8.8h1.3c2.8 0 4.3-1.6 4.3-4.4s-1.5-4.4-4.3-4.4h-1.3z"
              fill="#FFFFFF"
            />
            <rect x="9.5" y="14.9" width="8.2" height="2.2" rx="0.8" fill="#FFFFFF" />
          </>
        );

      case 'ALGO':
        return (
          <>
            <circle cx="16" cy="16" r="16" fill="#111827" />
            <path
              d="M23.6 23.2h-2.7l-1.8-6.4-3.7 6.4h-3l5.7-9.8-.9-3.2-7.5 13H6.8L16 7.5h2.6l1.2 4.4h2.5l-1.7 2.9 3 8.4z"
              fill="#FFFFFF"
            />
          </>
        );

      case 'USDT':
        return (
          <>
            <circle cx="16" cy="16" r="16" fill="#26A17B" />
            <path
              d="M17.8 17.2v0c-.1 0-.7.1-1.8.1-1 0-1.6 0-1.9-.1v0c-3.7-.2-6.4-.8-6.4-1.6 0-.8 2.7-1.4 6.4-1.6v2.5c.3 0 1 .1 1.9.1 1.1 0 1.6-.1 1.8-.1V14c3.7.2 6.4.8 6.4 1.6 0 .8-2.7 1.4-6.4 1.6zm0-3.4v-2.2h5.1V8.4H9.1v3.2h5.1v2.2c-4.2.2-7.3 1-7.3 2 0 1 3.1 1.8 7.3 2v6.1h3.6v-6.1c4.2-.2 7.3-1 7.3-2 0-1-3.1-1.8-7.3-2z"
              fill="#FFFFFF"
            />
          </>
        );

      case 'ADA':
        return (
          <>
            <circle cx="16" cy="16" r="16" fill="#0033AD" />
            <circle cx="16" cy="16" r="2.2" fill="#FFFFFF" />
            <circle cx="16" cy="10.2" r="1.4" fill="#FFFFFF" />
            <circle cx="16" cy="21.8" r="1.4" fill="#FFFFFF" />
            <circle cx="11" cy="13.1" r="1.4" fill="#FFFFFF" />
            <circle cx="21" cy="13.1" r="1.4" fill="#FFFFFF" />
            <circle cx="11" cy="18.9" r="1.4" fill="#FFFFFF" />
            <circle cx="21" cy="18.9" r="1.4" fill="#FFFFFF" />
            <circle cx="16" cy="6.6" r="0.9" fill="#FFFFFF" fillOpacity="0.8" />
            <circle cx="16" cy="25.4" r="0.9" fill="#FFFFFF" fillOpacity="0.8" />
            <circle cx="7.9" cy="11.3" r="0.9" fill="#FFFFFF" fillOpacity="0.8" />
            <circle cx="24.1" cy="11.3" r="0.9" fill="#FFFFFF" fillOpacity="0.8" />
            <circle cx="7.9" cy="20.7" r="0.9" fill="#FFFFFF" fillOpacity="0.8" />
            <circle cx="24.1" cy="20.7" r="0.9" fill="#FFFFFF" fillOpacity="0.8" />
          </>
        );

      case 'AVAX':
        return (
          <>
            <circle cx="16" cy="16" r="16" fill="#E84142" />
            <path
              d="M11.6 22.2H8.4c-.6 0-.9-.6-.6-1.1l7.6-13.2c.3-.5 1-.5 1.3 0l2.1 3.7c.2.4.2.8 0 1.2l-5.7 8.9c-.3.3-.8.5-1.5.5zm7.9 0h3.9c.6 0 .9-.6.6-1.1l-2-3.4c-.3-.5-1-.5-1.3 0l-1.9 3.4c-.3.5.1 1.1.7 1.1z"
              fill="#FFFFFF"
            />
          </>
        );

      case 'LINK':
        return (
          <>
            <circle cx="16" cy="16" r="16" fill="#2A5ADA" />
            <path
              d="M16 6.8l-7.8 4.5v9.4L16 25.2l7.8-4.5v-9.4L16 6.8zm4.8 12.1L16 21.7l-4.8-2.8v-5.8L16 10.3l4.8 2.8v5.8z"
              fill="#FFFFFF"
            />
          </>
        );

      case 'LTC':
        return (
          <>
            <circle cx="16" cy="16" r="16" fill="#345D9D" />
            <path
              d="M15.4 20.4l1.2-4.6 2.8-1 .7-2.4-2.8 1 1.4-5.2h-3.8l-1.8 6.8-2.2.8-.7 2.4 2.2-.8-1.5 5.8h10.8l.9-2.8h-7.2z"
              fill="#FFFFFF"
            />
          </>
        );

      case 'DOT':
        return (
          <>
            <circle cx="16" cy="16" r="16" fill="#E6007A" />
            <ellipse cx="16" cy="8.2" rx="3" ry="1.9" fill="#FFFFFF" />
            <ellipse cx="16" cy="23.8" rx="3" ry="1.9" fill="#FFFFFF" />
            <ellipse cx="9.2" cy="12.1" rx="3" ry="1.9" transform="rotate(-60 9.2 12.1)" fill="#FFFFFF" />
            <ellipse cx="22.8" cy="19.9" rx="3" ry="1.9" transform="rotate(-60 22.8 19.9)" fill="#FFFFFF" />
            <ellipse cx="9.2" cy="19.9" rx="3" ry="1.9" transform="rotate(60 9.2 19.9)" fill="#FFFFFF" />
            <ellipse cx="22.8" cy="12.1" rx="3" ry="1.9" transform="rotate(60 22.8 12.1)" fill="#FFFFFF" />
          </>
        );

      case 'TRX':
        return (
          <>
            <circle cx="16" cy="16" r="16" fill="#EF0027" />
            <path
              d="M8.5 8.8l15.4 2.8-8.2 12.2-7.2-15zm2.4 2.1l4.8 9.9 5.5-8.1-10.3-1.8z"
              fill="#FFFFFF"
            />
          </>
        );

      case 'SUI':
        return (
          <>
            <circle cx="16" cy="16" r="16" fill="#4DA2FF" />
            <path
              d="M16 6.8c-3.4 4.2-6.2 7.5-6.2 11.1a6.2 6.2 0 1012.4 0c0-3.6-2.8-6.9-6.2-11.1zm0 15.1a4 4 0 01-4-4c0-1.6.9-3.4 2.3-5.4.8 1.5 2.4 2.1 3.7 3 1.1.8 2 1.6 2 2.4a4 4 0 01-4 4z"
              fill="#FFFFFF"
            />
          </>
        );

      case 'TON':
        return (
          <>
            <circle cx="16" cy="16" r="16" fill="#0098EA" />
            <path
              d="M10.4 10h11.2c1.2 0 1.9 1.3 1.3 2.3l-5.6 10.2c-.6 1-2 1-2.6 0L9.1 12.3c-.6-1 .1-2.3 1.3-2.3zm4.8 2.2h-3.6l3.6 6.6v-6.6zm1.6 0v6.6l3.6-6.6h-3.6z"
              fill="#FFFFFF"
            />
          </>
        );

      case 'HBAR':
        return (
          <>
            <circle cx="16" cy="16" r="16" fill="#111827" />
            <path
              d="M10.5 8.5h2.4v4.7h6.2V8.5h2.4v15h-2.4v-4.7h-6.2v4.7h-2.4v-15zm2.4 6.5v2h6.2v-2h-6.2z"
              fill="#FFFFFF"
            />
          </>
        );

      case 'XLM':
        return (
          <>
            <circle cx="16" cy="16" r="16" fill="#0F172A" />
            <circle cx="16" cy="16" r="6.5" stroke="#FFFFFF" strokeWidth="2" fill="none" />
            <path d="M7.5 18.8l16.5-8.4M8 21.6l16.5-8.4" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
          </>
        );

      default:
        return (
          <>
            <circle cx="16" cy="16" r="16" fill={bg} />
            <circle cx="16" cy="16" r="14.5" stroke="#FFFFFF" strokeOpacity="0.22" strokeWidth="1" fill="none" />
            <text
              x="16"
              y="16.5"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#FFFFFF"
              fontSize={sym.length > 4 ? '7.5' : sym.length > 3 ? '9' : '10.5'}
              fontWeight="800"
              fontFamily="'JetBrains Mono', monospace"
            >
              {sym.slice(0, 4)}
            </text>
          </>
        );
    }
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 inline-block select-none ${className}`}
      aria-hidden="true"
    >
      {renderGlyph()}
    </svg>
  );
};
