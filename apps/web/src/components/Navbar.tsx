"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  ChevronDown,
  Building2,
  GraduationCap,
  Plane,
  Landmark,
  HeartPulse,
  Car,
  Briefcase,
  Headphones,
  Target,
  UserCheck,
  Cloud,
  Rocket,
  Building,
  CreditCard,
  Shield,
  Bot,
  Phone,
  BarChart,
  Layers,
  PhoneCall,
  MessageSquare,
  Zap,
  CheckCircle2,
  Users,
  Settings,
  Share2,
  Database,
  FileSpreadsheet,
  Clock,
  Send,
  PieChart,
  Lock,
  Workflow,
  Radio,
  X,
  Building2Icon,
  Mail,
  CheckCircle,
  Menu,
  Sparkles,
  LogIn,
  KeyRound,
  HeadphonesIcon,
  LayoutDashboard,
} from "lucide-react";

const TEAM_SIZES = ["1 - 5 members", "6 - 15 members", "16 - 50 members", "50+ members"];

export default function Navbar() {
  const { isReady, token, userRole } = useAuth();
  const [showFeatures, setShowFeatures] = useState(false);
  const [showMoreFeatures, setShowMoreFeatures] = useState(false);

  const [showIndustries, setShowIndustries] = useState(false);
  const [showMoreIndustries, setShowMoreIndustries] = useState(false);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Demo Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2 | 3>(1);

  // Login Modal State
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [loginView, setLoginView] = useState<"form" | "support">("form");
  const [loginData, setLoginData] = useState({ email: "", password: "" });

  // Form Data State
  const [teamSize, setTeamSize] = useState("");
  const [formData, setFormData] = useState({
    companyName: "",
    email: "",
    phone: "",
  });

  // Close menus when any link is clicked
  const closeAllMenus = () => {
    setShowFeatures(false);
    setShowMoreFeatures(false);
    setShowIndustries(false);
    setShowMoreIndustries(false);
    setMobileMenuOpen(false);
  };

  const openDemoModal = () => {
    closeAllMenus();
    setIsLoginOpen(false);
    setTeamSize("");
    setFormData({ companyName: "", email: "", phone: "" });
    setModalStep(1);
    setIsModalOpen(true);
  };

  const openLoginModal = () => {
    closeAllMenus();
    setIsModalOpen(false);
    setLoginData({ email: "", password: "" });
    setLoginView("form");
    setIsLoginOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsLoginOpen(false);
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

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginData.email && loginData.password) {
      alert(`Logging in as ${loginData.email}...`);
      closeModal();
    }
  };

  return (
    <>
      {/* Floating Glassmorphism Header */}
      <header className="sticky top-0 z-50 transition-all duration-300 px-4 sm:px-8 pt-3">
        <div className="max-w-7xl mx-auto bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-lg shadow-indigo-950/5 rounded-2xl px-6 h-16 sm:h-20 flex items-center justify-between">
          
          {/* Brand Logo */}
          <Link 
            href="/" 
            onClick={closeAllMenus} 
            className="flex items-center gap-2.5 group transition-transform active:scale-95"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#5A4AD4] to-[#6C5CE7] flex items-center justify-center text-white font-black text-xl shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              ť
            </div>
            <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 group-hover:text-[#6C5CE7] transition-colors">
              TeleCRM
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-extrabold text-slate-700">
            
            {/* Features Dropdown */}
            <div
              className="relative py-6"
              onMouseEnter={() => setShowFeatures(true)}
              onMouseLeave={() => {
                setShowFeatures(false);
                setShowMoreFeatures(false);
              }}
            >
              <button className="flex items-center gap-1.5 hover:text-[#6C5CE7] transition cursor-pointer py-1 group">
                <span>Features</span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 group-hover:text-[#6C5CE7] transition-transform duration-200 ${
                    showFeatures ? "rotate-180 text-[#6C5CE7]" : ""
                  }`}
                />
              </button>

              {showFeatures && (
                <div className="absolute top-[85%] left-0 pt-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="bg-white rounded-3xl shadow-xl shadow-indigo-950/10 border border-slate-100 p-6 min-w-[260px] relative">
                    
                    {/* Primary 5 Features */}
                    <div className="flex flex-col gap-2">
                      <Link 
                        href="/features#1-click-dialer" 
                        onClick={closeAllMenus} 
                        className="flex items-center gap-3 text-xs font-bold text-slate-800 hover:text-[#6C5CE7] hover:bg-indigo-50/60 p-2 rounded-xl transition"
                      >
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-[#6C5CE7]">
                          <PhoneCall className="w-4 h-4" />
                        </div>
                        <span>1-Click Auto Dialer</span>
                      </Link>
                      
                      <Link 
                        href="/features#whatsapp-broadcast-marketing" 
                        onClick={closeAllMenus} 
                        className="flex items-center gap-3 text-xs font-bold text-slate-800 hover:text-[#6C5CE7] hover:bg-indigo-50/60 p-2 rounded-xl transition"
                      >
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-[#6C5CE7]">
                          <Bot className="w-4 h-4" />
                        </div>
                        <span className="flex items-center justify-between w-full">
                          WhatsApp Broadcast
                          <span className="bg-emerald-100 text-emerald-700 text-[9px] px-1.5 py-0.5 rounded-md font-extrabold">NEW</span>
                        </span>
                      </Link>

                      <Link 
                        href="/features#leaderboard-report" 
                        onClick={closeAllMenus} 
                        className="flex items-center gap-3 text-xs font-bold text-slate-800 hover:text-[#6C5CE7] hover:bg-indigo-50/60 p-2 rounded-xl transition"
                      >
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-[#6C5CE7]">
                          <BarChart className="w-4 h-4" />
                        </div>
                        <span>Leaderboard & Reports</span>
                      </Link>

                      <Link 
                        href="/features#lead-routing" 
                        onClick={closeAllMenus} 
                        className="flex items-center gap-3 text-xs font-bold text-slate-800 hover:text-[#6C5CE7] hover:bg-indigo-50/60 p-2 rounded-xl transition"
                      >
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-[#6C5CE7]">
                          <Layers className="w-4 h-4" />
                        </div>
                        <span>Lead Routing & Tracking</span>
                      </Link>

                      <Link 
                        href="/features#automatic-call-recording" 
                        onClick={closeAllMenus} 
                        className="flex items-center gap-3 text-xs font-bold text-slate-800 hover:text-[#6C5CE7] hover:bg-indigo-50/60 p-2 rounded-xl transition"
                      >
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-[#6C5CE7]">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <span>Automatic Call Recording</span>
                      </Link>

                      <div className="border-t border-slate-100 pt-3 mt-1 px-2">
                        <Link
                          href="/features"
                          onClick={closeAllMenus}
                          className="text-xs font-extrabold text-[#6C5CE7] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          See all 20+ features →
                        </Link>
                      </div>
                    </div>

                    {/* Popout MORE Features Panel */}
                    {showMoreFeatures && (
                      <div className="absolute top-0 left-[calc(100%-1px)] bg-white rounded-r-3xl shadow-xl shadow-indigo-950/10 border border-l-slate-100 border-slate-100 p-6 flex flex-col gap-2.5 min-w-[250px] z-50 animate-in fade-in slide-in-from-left-2 duration-150">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 pb-1">
                          MORE FEATURES
                        </span>
                        <Link href="/features#smart-workflows" onClick={closeAllMenus} className="flex items-center gap-2.5 text-xs font-bold text-slate-700 hover:text-[#6C5CE7] transition">
                          <Workflow className="w-3.5 h-3.5 text-[#6C5CE7]" /> Smart Workflows
                        </Link>
                        <Link href="/features#call-reminders" onClick={closeAllMenus} className="flex items-center gap-2.5 text-xs font-bold text-slate-700 hover:text-[#6C5CE7] transition">
                          <Zap className="w-3.5 h-3.5 text-[#6C5CE7]" /> Call Reminders
                        </Link>
                        <Link href="/features#excel-import" onClick={closeAllMenus} className="flex items-center gap-2.5 text-xs font-bold text-slate-700 hover:text-[#6C5CE7] transition">
                          <FileSpreadsheet className="w-3.5 h-3.5 text-[#6C5CE7]" /> Excel & CSV Import
                        </Link>
                        <Link href="/features#fb-lead-capture" onClick={closeAllMenus} className="flex items-center gap-2.5 text-xs font-bold text-slate-700 hover:text-[#6C5CE7] transition">
                          <Share2 className="w-3.5 h-3.5 text-[#6C5CE7]" /> Facebook & Meta Lead Capture
                        </Link>
                        <Link href="/features#custom-api-integration" onClick={closeAllMenus} className="flex items-center gap-2.5 text-xs font-bold text-slate-700 hover:text-[#6C5CE7] transition">
                          <Database className="w-3.5 h-3.5 text-[#6C5CE7]" /> Custom API Integration
                        </Link>
                        <Link href="/features#whatsapp-alerts" onClick={closeAllMenus} className="flex items-center gap-2.5 text-xs font-bold text-slate-700 hover:text-[#6C5CE7] transition">
                          <MessageSquare className="w-3.5 h-3.5 text-[#6C5CE7]" /> WhatsApp Alerts
                        </Link>
                        <Link href="/features#1-click-whatsapp" onClick={closeAllMenus} className="flex items-center gap-2.5 text-xs font-bold text-slate-700 hover:text-[#6C5CE7] transition">
                          <Send className="w-3.5 h-3.5 text-[#6C5CE7]" /> 1-Click WhatsApp
                        </Link>
                        <Link href="/features#1-click-sms-email" onClick={closeAllMenus} className="flex items-center gap-2.5 text-xs font-bold text-slate-700 hover:text-[#6C5CE7] transition">
                          <Mail className="w-3.5 h-3.5 text-[#6C5CE7]" /> 1-Click SMS & Email
                        </Link>
                        <Link href="/features#push-notification" onClick={closeAllMenus} className="flex items-center gap-2.5 text-xs font-bold text-slate-700 hover:text-[#6C5CE7] transition">
                          <Clock className="w-3.5 h-3.5 text-[#6C5CE7]" /> Push Notifications
                        </Link>
                        <Link href="/features#payment-creation" onClick={closeAllMenus} className="flex items-center gap-2.5 text-xs font-bold text-slate-700 hover:text-[#6C5CE7] transition">
                          <CreditCard className="w-3.5 h-3.5 text-[#6C5CE7]" /> Payment Link Creation
                        </Link>
                        <Link href="/features#hour-by-hour-report" onClick={closeAllMenus} className="flex items-center gap-2.5 text-xs font-bold text-slate-700 hover:text-[#6C5CE7] transition">
                          <PieChart className="w-3.5 h-3.5 text-[#6C5CE7]" /> Hour-by-Hour Report
                        </Link>
                      </div>
                    )}

                  </div>
                </div>
              )}
            </div>

            {/* Pricing Link */}
            <Link href="/pricing?src=hp_topBar" className="hover:text-[#6C5CE7] transition py-1">
              Pricing
            </Link>

            {/* Industries Dropdown */}
            <div
              className="relative py-6"
              onMouseEnter={() => setShowIndustries(true)}
              onMouseLeave={() => {
                setShowIndustries(false);
                setShowMoreIndustries(false);
              }}
            >
              <button className="flex items-center gap-1.5 hover:text-[#6C5CE7] transition cursor-pointer py-1 group">
                <span>Industries</span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 group-hover:text-[#6C5CE7] transition-transform duration-200 ${
                    showIndustries ? "rotate-180 text-[#6C5CE7]" : ""
                  }`}
                />
              </button>

              {showIndustries && (
                <div className="absolute top-[85%] left-0 pt-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="bg-white rounded-3xl shadow-xl shadow-indigo-950/10 border border-slate-100 p-6 min-w-[260px] relative">
                    
                    {/* Primary 5 Industries */}
                    <div className="flex flex-col gap-2">
                      <Link href="/industries#real-estate" onClick={closeAllMenus} className="flex items-center gap-3 text-xs font-bold text-slate-800 hover:text-[#6C5CE7] hover:bg-indigo-50/60 p-2 rounded-xl transition">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                          <Building2 className="w-4 h-4" />
                        </div>
                        Real Estate CRM
                      </Link>
                      <Link href="/industries#education" onClick={closeAllMenus} className="flex items-center gap-3 text-xs font-bold text-slate-800 hover:text-[#6C5CE7] hover:bg-indigo-50/60 p-2 rounded-xl transition">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                          <GraduationCap className="w-4 h-4" />
                        </div>
                        Education Sales
                      </Link>
                      <Link href="/industries#travel" onClick={closeAllMenus} className="flex items-center gap-3 text-xs font-bold text-slate-800 hover:text-[#6C5CE7] hover:bg-indigo-50/60 p-2 rounded-xl transition">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                          <Plane className="w-4 h-4" />
                        </div>
                        Travel CRM
                      </Link>
                      <Link href="/industries#loan-dsa" onClick={closeAllMenus} className="flex items-center gap-3 text-xs font-bold text-slate-800 hover:text-[#6C5CE7] hover:bg-indigo-50/60 p-2 rounded-xl transition">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                          <Landmark className="w-4 h-4" />
                        </div>
                        Loan DSA CRM
                      </Link>
                      <Link href="/industries#healthcare" onClick={closeAllMenus} className="flex items-center gap-3 text-xs font-bold text-slate-800 hover:text-[#6C5CE7] hover:bg-indigo-50/60 p-2 rounded-xl transition">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                          <HeartPulse className="w-4 h-4" />
                        </div>
                        Healthcare CRM
                      </Link>

                      <div className="border-t border-slate-100 pt-3 mt-1 px-2">
                        <Link
                          href="/industries"
                          onClick={closeAllMenus}
                          className="text-xs font-extrabold text-[#6C5CE7] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          See all industries →
                        </Link>
                      </div>
                    </div>

                    {/* Popout MORE Industries Panel */}
                    {showMoreIndustries && (
                      <div className="absolute top-0 left-[calc(100%-1px)] bg-white rounded-r-3xl shadow-xl shadow-indigo-950/10 border border-l-slate-100 border-slate-100 p-6 flex flex-col gap-2.5 min-w-[240px] z-50 animate-in fade-in slide-in-from-left-2 duration-150">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 pb-1">
                          MORE
                        </span>
                        <Link href="/industries#automobile" onClick={closeAllMenus} className="flex items-center gap-2.5 text-xs font-bold text-slate-700 hover:text-[#6C5CE7] transition">
                          <Car className="w-3.5 h-3.5 text-indigo-500" /> Automobile CRM
                        </Link>
                        <Link href="/industries#b2b" onClick={closeAllMenus} className="flex items-center gap-2.5 text-xs font-bold text-slate-700 hover:text-[#6C5CE7] transition">
                          <Briefcase className="w-3.5 h-3.5 text-indigo-500" /> B2B CRM Software
                        </Link>
                        <Link href="/industries#call-center" onClick={closeAllMenus} className="flex items-center gap-2.5 text-xs font-bold text-slate-700 hover:text-[#6C5CE7] transition">
                          <Headphones className="w-3.5 h-3.5 text-indigo-500" /> Call Center CRM
                        </Link>
                        <Link href="/industries#digital-marketing" onClick={closeAllMenus} className="flex items-center gap-2.5 text-xs font-bold text-slate-700 hover:text-[#6C5CE7] transition">
                          <Target className="w-3.5 h-3.5 text-indigo-500" /> Digital Marketing
                        </Link>
                        <Link href="/industries#recruiting" onClick={closeAllMenus} className="flex items-center gap-2.5 text-xs font-bold text-slate-700 hover:text-[#6C5CE7] transition">
                          <UserCheck className="w-3.5 h-3.5 text-indigo-500" /> Recruiting CRM
                        </Link>
                        <Link href="/industries#saas" onClick={closeAllMenus} className="flex items-center gap-2.5 text-xs font-bold text-slate-700 hover:text-[#6C5CE7] transition">
                          <Cloud className="w-3.5 h-3.5 text-indigo-500" /> SaaS Companies
                        </Link>
                        <Link href="/industries#startups" onClick={closeAllMenus} className="flex items-center gap-2.5 text-xs font-bold text-slate-700 hover:text-[#6C5CE7] transition">
                          <Rocket className="w-3.5 h-3.5 text-indigo-500" /> Startups CRM
                        </Link>
                        <Link href="/industries#financial-services" onClick={closeAllMenus} className="flex items-center gap-2.5 text-xs font-bold text-slate-700 hover:text-[#6C5CE7] transition">
                          <Building className="w-3.5 h-3.5 text-indigo-500" /> Financial Services
                        </Link>
                        <Link href="/industries#fintech" onClick={closeAllMenus} className="flex items-center gap-2.5 text-xs font-bold text-slate-700 hover:text-[#6C5CE7] transition">
                          <CreditCard className="w-3.5 h-3.5 text-indigo-500" /> Fintech CRM
                        </Link>
                        <Link href="/industries#insurance" onClick={closeAllMenus} className="flex items-center gap-2.5 text-xs font-bold text-slate-700 hover:text-[#6C5CE7] transition">
                          <Shield className="w-3.5 h-3.5 text-indigo-500" /> Insurance CRM
                        </Link>
                      </div>
                    )}

                  </div>
                </div>
              )}
            </div>
          </nav>

          {/* Action Call To Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="text-slate-700 hover:text-[#6C5CE7] font-extrabold py-2.5 px-4 text-sm transition cursor-pointer flex items-center gap-1.5 rounded-xl hover:bg-slate-50 border border-slate-200/60"
            >
              <LogIn className="w-4 h-4 text-slate-500" />
              Login
            </Link>
            <button
              onClick={openDemoModal}
              className="bg-[#6C5CE7] hover:bg-[#5A4AD4] text-white font-extrabold py-2.5 px-5 text-sm transition shadow-md shadow-indigo-500/25 cursor-pointer flex items-center gap-1.5 rounded-xl active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              Request a demo
            </button>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white/95 backdrop-blur-xl border border-slate-200 mt-2 rounded-2xl p-6 shadow-xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col gap-3 font-extrabold text-slate-800 text-sm">
              <Link href="/features" onClick={closeAllMenus} className="py-2 hover:text-[#6C5CE7]">
                Features
              </Link>
              <Link href="/pricing?src=hp_topBar" onClick={closeAllMenus} className="py-2 hover:text-[#6C5CE7]">
                Pricing
              </Link>
              <Link href="/industries" onClick={closeAllMenus} className="py-2 hover:text-[#6C5CE7]">
                Industries
              </Link>
            </div>
            
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
              <Link
                href="/login"
                onClick={closeAllMenus}
                className="w-full bg-slate-100 text-slate-800 font-extrabold py-3 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2 border border-slate-200"
              >
                <LogIn className="w-4 h-4" /> Login
              </Link>
              <button
                onClick={openDemoModal}
                className="w-full bg-[#6C5CE7] text-white font-extrabold py-3 rounded-xl text-xs transition shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> Request a demo
              </button>
            </div>
          </div>
        )}
      </header>

      {/* LOGIN POPUP MODAL */}
      {isLoginOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md p-6 sm:p-8 relative overflow-hidden transition-all">
            {/* Close Button */}
            <button
              onClick={closeModal}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 transition cursor-pointer p-1 rounded-full hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            {loginView === "form" ? (
              <div className="space-y-5 animate-in slide-in-from-bottom-2 duration-300">
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto text-[#6C5CE7] mb-2">
                    <LogIn className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900">
                    Welcome Back
                  </h3>
                  <p className="text-xs text-slate-500">
                    Log in to access your TeleCRM workspace dashboard
                  </p>
                </div>

                <form onSubmit={handleLoginSubmit} className="space-y-3.5 pt-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-[#6C5CE7]" />
                      Work Email
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. name@company.com"
                      value={loginData.email}
                      onChange={(e) =>
                        setLoginData({ ...loginData, email: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#6C5CE7] focus:ring-1 focus:ring-[#6C5CE7]"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-[#6C5CE7]" />
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setLoginView("support")}
                        className="text-[11px] font-extrabold text-[#6C5CE7] hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={loginData.password}
                      onChange={(e) =>
                        setLoginData({ ...loginData, password: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#6C5CE7] focus:ring-1 focus:ring-[#6C5CE7]"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full bg-[#6C5CE7] hover:bg-[#5A4AD4] text-white font-extrabold py-3 rounded-xl text-xs transition shadow-md cursor-pointer"
                    >
                      Log In
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* Support Callout View */
              <div className="text-center space-y-5 py-2 animate-in zoom-in-95 duration-200">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto text-[#6C5CE7]">
                  <HeadphonesIcon className="w-7 h-7" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-xl font-black text-slate-900">Need Password Assistance?</h3>
                  <p className="text-xs text-slate-500 leading-relaxed px-2">
                    For enterprise security, password resets are handled directly by our support team. Please call or email us to get account access restored.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left space-y-3">
                  <a
                    href="tel:+919876543210"
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-slate-200/80 text-slate-800 hover:border-[#6C5CE7] hover:text-[#6C5CE7] transition text-xs font-bold group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-[#6C5CE7]">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-medium">Direct Support Call</div>
                      +91 98765 43210
                    </div>
                  </a>

                  <a
                    href="mailto:support@telecrm.in"
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-slate-200/80 text-slate-800 hover:border-[#6C5CE7] hover:text-[#6C5CE7] transition text-xs font-bold group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-[#6C5CE7]">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-medium">Support Email</div>
                      support@telecrm.in
                    </div>
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => setLoginView("form")}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold py-3 rounded-xl text-xs transition cursor-pointer"
                >
                  Back to Login
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DEMO REQUEST POPUP MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md p-6 sm:p-8 relative overflow-hidden transition-all">
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
                    Step 1 of 2 • Navigation Request
                  </span>
                  <h3 className="text-xl font-black text-slate-900">
                    How many members are in your team?
                  </h3>
                  <p className="text-xs text-slate-500">
                    We’ll customize your live demo according to your team size.
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
                      placeholder="e.g. Acme Properties Pvt Ltd"
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
                      placeholder="e.g. name@company.com"
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
                      Submit Demo Request
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
                  <h3 className="text-xl font-black text-slate-900">Response Received!</h3>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed px-2">
                    Thank you, <span className="font-extrabold text-slate-900">{formData.companyName}</span>! Our product specialist will reach out shortly at{" "}
                    <span className="font-extrabold text-slate-900">{formData.email}</span> /{" "}
                    <span className="font-extrabold text-slate-900">{formData.phone}</span> to schedule your demo.
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