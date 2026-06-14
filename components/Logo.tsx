import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export default function Logo({ className = '', size = 32, showText = true }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Modern Minimalist Ghost SVG */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-brand-black transition-transform hover:scale-105"
      >
        {/* Outer Rounded Shield / Frame (Continuous Rounded Path) */}
        <rect
          x="4"
          y="4"
          width="92"
          height="92"
          rx="26"
          stroke="currentColor"
          strokeWidth="6"
          fill="none"
        />
        
        {/* Ghost Icon Shape */}
        <path
          d="M30 46 C30 33.5 39 30 50 30 C61 30 70 33.5 70 46 V66 C70 69.5 67 70 65 68 C63 66 61 65 59 67 C57 69 55 70 53 68 C51 66 49 66 47 68 C45 70 43 69 41 67 C39 65 37 66 35 68 C33 70 30 69.5 30 66 V46 Z"
          fill="currentColor"
        />
        
        {/* Ghost Eyes (Contrasting White Circles) */}
        <circle cx="43" cy="46" r="4.5" fill="white" />
        <circle cx="57" cy="46" r="4.5" fill="white" />
        
        {/* Ghost Mouth (Tiny rounded arc) */}
        <path
          d="M48 53 C48 54.5 49 55 50 55 C51 55 52 54.5 52 53"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>

      {showText && (
        <span className="font-sans font-bold text-xl tracking-tight text-brand-black">
          Ghost<span className="font-light">Chat</span>
        </span>
      )}
    </div>
  );
}
