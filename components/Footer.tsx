import React from 'react';
import Link from 'next/link';
import Logo from './Logo';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-brand-gray-mid/40 bg-brand-gray-light/30 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:gap-12">
          {/* Logo & Slogan Column */}
          <div className="col-span-2 flex flex-col justify-between md:col-span-1">
            <div className="space-y-4">
              <Logo size={32} />
              <p className="text-sm text-brand-black/60 leading-relaxed max-w-xs">
                Start instant, anonymous text and video conversations with strangers around the world. Secure, fast, and completely free.
              </p>
            </div>
            <p className="mt-8 text-xs text-brand-black/40">
              &copy; {currentYear} GhostChat. All rights reserved.
            </p>
          </div>

          {/* Platform Column */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-black">Platform</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/" className="text-brand-black/60 hover:text-brand-black transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-brand-black/60 hover:text-brand-black transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/features" className="text-brand-black/60 hover:text-brand-black transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/transparency" className="text-brand-black/60 hover:text-brand-black transition-colors">
                  Transparency Report
                </Link>
              </li>
            </ul>
          </div>

          {/* Safety & Help Column */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-black">Safety & Help</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/safety" className="text-brand-black/60 hover:text-brand-black transition-colors">
                  Safety Center
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-brand-black/60 hover:text-brand-black transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-brand-black/60 hover:text-brand-black transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/report" className="text-brand-black/60 hover:text-brand-black transition-colors font-medium">
                  Report Abuse
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Column */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-black">Legal</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/privacy" className="text-brand-black/60 hover:text-brand-black transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-brand-black/60 hover:text-brand-black transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/guidelines" className="text-brand-black/60 hover:text-brand-black transition-colors">
                  Community Guidelines
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
