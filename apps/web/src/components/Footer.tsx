"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Mail,
  Phone,
  MessageCircle,
  X,
  Building2Icon,
  CheckCircle,
  Users,
  Sparkles,
} from "lucide-react";

const TEAM_SIZES = ["1 - 5 members", "6 - 15 members", "16 - 50 members", "50+ members"];

export default function Footer() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2 | 3>(1);
  const [teamSize, setTeamSize] = useState("");
  const [formData, setFormData] = useState({
    companyName: "",
    email: "",
    phone: "",
  });

  const openDemoModal = () => {
    setTeamSize("");
    setFormData({ companyName: "", email: "", phone: "" });
    setModalStep(1);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleTeamSizeSelect = (size: string) => {
    setTeamSize(size);
    setModalStep(2);
  };

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.companyName && formData.email && formData.phone) {
      setModalStep(3);
    }
  };

  return (
    <>
      <footer className="relative bg-[#1A0B3E] text-white pt-16 pb-12 border-t border-indigo-900/40 mt-16">
        {/* 15 Days Refund Policy Header */}
        <div className="text-center mb-12 px-4">
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-wide">
            15 Days Refund Policy
          </h3>
          <p className="text-xs text-slate-300 mt-1 max-w-md mx-auto">
            100% risk-free trial with guaranteed money back if you aren&apos;t completely satisfied.
          </p>
        </div>

        {/* Main Footer 4-Column Grid */}
        <div className="max-w-7xl mx-auto px-6 sm:px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 sm:gap-12 pb-16 border-b border-white/10">
          
          {/* Column 1: CONTACT INFO */}
          <div className="space-y-4">
            <h4 className="text-sm font-black text-white uppercase tracking-wider">
              CONTACT INFO
            </h4>
            <ul className="space-y-3 text-xs text-slate-300 font-medium">
              <li>
                <a
                  href="mailto:hello@telecrm.in"
                  className="flex items-center gap-2.5 hover:text-white transition group"
                >
                  <Mail className="w-4 h-4 text-slate-400 group-hover:text-white transition" />
                  hello@telecrm.in
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/917417232654"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 hover:text-white transition group"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-400" />
                  +91-7417232654
                </a>
              </li>
              <li>
                <a
                  href="tel:+917417232654"
                  className="flex items-center gap-2.5 hover:text-white transition group"
                >
                  <Phone className="w-4 h-4 text-slate-400 group-hover:text-white transition" />
                  +91-7417232654
                </a>
              </li>
            </ul>

            {/* App Store Download Badges */}
            <div className="pt-3 space-y-2.5">
              {/* Google Play */}
              <a
                href="https://play.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-black/70 hover:bg-black text-white px-4 py-2 rounded-xl border border-white/15 transition w-44 group shadow-md"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M3.609 1.814L13.792 12 3.61 22.186a1.99 1.99 0 0 1-.22-.916V2.73c0-.33.08-.64.22-.916zM15.207 13.414l2.42 2.42-12.016 6.866 9.596-9.286zm0-2.828L5.611 1.3l12.016 6.866-2.42 2.42zm1.414 1.414l3.535 2.02c.86.49.86 1.29 0 1.78l-3.535 2.02-2.12-2.12 2.12-3.7z" />
                </svg>
                <div className="text-left">
                  <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold leading-none">
                    GET IT ON
                  </div>
                  <div className="text-xs font-bold leading-tight">Google Play</div>
                </div>
              </a>

              {/* App Store */}
              <a
                href="https://apple.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-black/70 hover:bg-black text-white px-4 py-2 rounded-xl border border-white/15 transition w-44 group shadow-md"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-2 .6-2.65 1.35-.58.66-1.08 1.73-.95 2.76 1.01.08 2.05-.51 2.68-1.26z" />
                </svg>
                <div className="text-left">
                  <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold leading-none">
                    Download on the
                  </div>
                  <div className="text-xs font-bold leading-tight">App Store</div>
                </div>
              </a>
            </div>
          </div>

          {/* Column 2: FEATURES */}
          <div className="space-y-4">
            <h4 className="text-sm font-black text-white uppercase tracking-wider">
              FEATURES
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-300 font-medium">
              <li>
                <Link href="/features#1-click-dialer" className="hover:text-white transition">
                  CRM with Dialer
                </Link>
              </li>
              <li>
                <Link href="/features#1-click-dialer" className="hover:text-white transition">
                  Mobile CRM
                </Link>
              </li>
              <li>
                <Link href="/features#whatsapp-broadcast-marketing" className="hover:text-white transition">
                  WhatsApp CRM
                </Link>
              </li>
              <li>
                <Link href="/features#fb-lead-capture" className="hover:text-white transition">
                  Facebook CRM
                </Link>
              </li>
              <li>
                <Link href="/features#call-reminders" className="hover:text-white transition">
                  Call Management Software
                </Link>
              </li>
              <li>
                <Link href="/features#lead-routing" className="hover:text-white transition">
                  Lead Management System
                </Link>
              </li>
              <li>
                <Link href="/features#automatic-call-recording" className="hover:text-white transition">
                  Call Tracking &amp; Recording CRM
                </Link>
              </li>
              <li>
                <Link href="/features#leaderboard-report" className="hover:text-white transition">
                  Sales Management &amp; Leaderboards
                </Link>
              </li>
              <li>
                <Link href="/features#custom-api-integration" className="hover:text-white transition">
                  Enterprise CRM &amp; API
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: INDUSTRIES */}
          <div className="space-y-4">
            <h4 className="text-sm font-black text-white uppercase tracking-wider">
              INDUSTRIES
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-300 font-medium">
              <li>
                <Link href="/industries#real-estate" className="hover:text-white transition">
                  Real Estate CRM Software
                </Link>
              </li>
              <li>
                <Link href="/industries#education" className="hover:text-white transition">
                  CRM For Education
                </Link>
              </li>
              <li>
                <Link href="/industries#loan-dsa" className="hover:text-white transition">
                  Loan DSA CRM Software
                </Link>
              </li>
              <li>
                <Link href="/industries#travel" className="hover:text-white transition">
                  Travel CRM Software
                </Link>
              </li>
              <li>
                <Link href="/industries#healthcare" className="hover:text-white transition">
                  Healthcare CRM Software
                </Link>
              </li>
              <li>
                <Link href="/industries#startups" className="hover:text-white transition">
                  CRM for Startups
                </Link>
              </li>
              <li>
                <Link href="/industries#call-center" className="hover:text-white transition">
                  Call Center CRM
                </Link>
              </li>
              <li>
                <Link href="/industries#debt-collection" className="hover:text-white transition">
                  Debt Collection Software
                </Link>
              </li>
              <li>
                <Link href="/industries#manufacturing" className="hover:text-white transition">
                  Manufacturing CRM
                </Link>
              </li>
              <li>
                <Link href="/industries#retail" className="hover:text-white transition">
                  Retail CRM
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: RESOURCES & CTA */}
          <div className="space-y-4 flex flex-col justify-between">
            <div>
              <h4 className="text-sm font-black text-white uppercase tracking-wider mb-4">
                RESOURCES
              </h4>
              <ul className="space-y-2.5 text-xs text-slate-300 font-medium">
                <li>
                  <Link href="/pricing" className="hover:text-white transition">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/#testimonials" className="hover:text-white transition">
                    Case studies
                  </Link>
                </li>
                <li>
                  <Link href="/#reviews" className="hover:text-white transition">
                    Reviews
                  </Link>
                </li>
                <li>
                  <Link href="/features#integrations" className="hover:text-white transition">
                    Integrations
                  </Link>
                </li>
                <li>
                  <Link href="/#about" className="hover:text-white transition">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link href="/#blogs" className="hover:text-white transition">
                    Blogs
                  </Link>
                </li>
                <li>
                  <Link href="/#refund" className="hover:text-white transition">
                    Refund Policy
                  </Link>
                </li>
                <li>
                  <Link href="/#affiliate" className="hover:text-white transition">
                    Affiliate Program
                  </Link>
                </li>
                <li>
                  <Link href="/#contact" className="hover:text-white transition">
                    Contact Us
                  </Link>
                </li>
              </ul>
            </div>

            <div className="pt-4">
              <button
                onClick={openDemoModal}
                className="w-full bg-[#6C5CE7] hover:bg-[#5A4AD4] text-white font-extrabold py-3 px-6 rounded-xl shadow-lg shadow-indigo-900/50 transition cursor-pointer text-xs"
              >
                Request a demo
              </button>
            </div>
          </div>

        </div>

        {/* Social Icons Row */}
        <div className="max-w-7xl mx-auto px-6 pt-8 pb-6 flex items-center justify-center gap-6">
          {/* Facebook */}
          <a
            href="https://facebook.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition hover:scale-110"
            aria-label="Facebook"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </a>

          {/* LinkedIn */}
          <a
            href="https://linkedin.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition hover:scale-110"
            aria-label="LinkedIn"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
            </svg>
          </a>

          {/* Instagram */}
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition hover:scale-110"
            aria-label="Instagram"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
          </a>

          {/* YouTube */}
          <a
            href="https://youtube.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition hover:scale-110"
            aria-label="YouTube"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
          </a>
        </div>

        {/* Copyright & Legal */}
        <div className="text-center px-4 text-[11px] text-slate-400 font-medium">
          © Copyright 2026 telecrm.in (Flamon Cloudtech Pvt Ltd) - All Rights Reserved • Privacy Policy • T&C
        </div>

        {/* Floating WhatsApp Quick Action Button (Bottom Left) */}
        <a
          href="https://wa.me/917417232654"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white flex items-center justify-center shadow-2xl shadow-emerald-950/40 hover:scale-110 transition-all duration-300 cursor-pointer group"
          aria-label="Chat on WhatsApp"
        >
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-white"></span>
          </span>
          <svg className="w-7 h-7 fill-current" viewBox="0 0 24 24">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
          </svg>
        </a>
      </footer>

      {/* DEMO REQUEST POPUP MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md p-6 sm:p-8 relative overflow-hidden transition-all text-slate-900">
            {/* Close Button */}
            <button
              onClick={closeModal}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 transition cursor-pointer p-1 rounded-full hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            {/* STEP 1: Team Size Selection */}
            {modalStep === 1 && (
              <div className="space-y-6 text-center animate-in slide-in-from-bottom-2 duration-300">
                <div className="space-y-2">
                  <span className="text-[10px] font-extrabold tracking-widest text-[#6C5CE7] uppercase">
                    Step 1 of 2 • Footer Request
                  </span>
                  <h3 className="text-xl font-black text-slate-900">
                    How many members are in your team?
                  </h3>
                  <p className="text-xs text-slate-500">
                    We’ll customize your live demo according to your team scale.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2.5 pt-2">
                  {TEAM_SIZES.map((size) => (
                    <button
                      key={size}
                      onClick={() => handleTeamSizeSelect(size)}
                      className="w-full py-3 px-4 rounded-xl border border-slate-200 text-slate-800 text-xs font-bold hover:border-[#6C5CE7] hover:bg-indigo-50/50 hover:text-[#6C5CE7] transition cursor-pointer text-left flex justify-between items-center group"
                    >
                      <span>{size}</span>
                      <Users className="w-4 h-4 text-slate-400 group-hover:text-[#6C5CE7] transition" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 2: Organization & Contact Info */}
            {modalStep === 2 && (
              <div className="space-y-5 animate-in slide-in-from-right duration-300">
                <div className="text-center space-y-1">
                  <span className="text-[10px] font-extrabold tracking-widest text-[#6C5CE7] uppercase">
                    Step 2 of 2 • Team: {teamSize}
                  </span>
                  <h3 className="text-xl font-black text-slate-900">
                    Tell us about your organization
                  </h3>
                  <p className="text-xs text-slate-500">
                    Our sales engineer will schedule a demo tailored for your company.
                  </p>
                </div>

                <form onSubmit={handleDetailsSubmit} className="space-y-3.5 pt-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                      <Building2Icon className="w-3.5 h-3.5 text-[#6C5CE7]" />
                      Organization / Company Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Acme Realty Pvt Ltd"
                      value={formData.companyName}
                      onChange={(e) =>
                        setFormData({ ...formData, companyName: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#6C5CE7] focus:ring-1 focus:ring-[#6C5CE7]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-[#6C5CE7]" />
                      Work Email Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. sales@company.com"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#6C5CE7] focus:ring-1 focus:ring-[#6C5CE7]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[#6C5CE7]" />
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. +91 98765 43210"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#6C5CE7] focus:ring-1 focus:ring-[#6C5CE7]"
                    />
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setModalStep(1)}
                      className="w-1/3 py-3 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="w-2/3 bg-[#6C5CE7] hover:bg-[#5A4AD4] text-white font-extrabold py-3 rounded-xl text-xs transition shadow-md cursor-pointer"
                    >
                      Submit Request
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* STEP 3: Confirmation Screen */}
            {modalStep === 3 && (
              <div className="text-center space-y-4 py-4 animate-in zoom-in-95 duration-300">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                  <CheckCircle className="w-10 h-10" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-xl font-black text-slate-900">Demo Scheduled!</h3>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed px-2">
                    Thank you, <span className="font-extrabold text-slate-900">{formData.companyName}</span>! Our specialist will reach out shortly at{" "}
                    <span className="font-extrabold text-slate-900">{formData.email}</span> /{" "}
                    <span className="font-extrabold text-slate-900">{formData.phone}</span>.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-left text-[11px] space-y-1 text-slate-600">
                  <div>
                    <span className="font-bold text-slate-800">Team Scale:</span> {teamSize}
                  </div>
                  <div>
                    <span className="font-bold text-slate-800">Work Email:</span> {formData.email}
                  </div>
                </div>

                <button
                  onClick={closeModal}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-3 rounded-xl text-xs transition cursor-pointer"
                >
                  Close Window
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
