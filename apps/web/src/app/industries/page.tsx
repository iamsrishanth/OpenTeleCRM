"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  LucideIcon,
  ArrowRight,
  Building2,
  GraduationCap,
  Plane,
  Coins,
  Stethoscope,
  Car,
  Briefcase,
  Headphones,
  Target,
  UserCheck,
  Cloud,
  Rocket,
  Landmark,
  Wallet,
  ShieldCheck,
  PhoneCall,
  Mic,
  Magnet,
  MapPin,
  Bell,
  Users,
  BarChart3,
  PlayCircle,
  MessageSquare,
  FileSpreadsheet,
  CalendarCheck,
  BadgeCheck,
  Award,
  Globe,
  Compass,
  CreditCard,
  Building,
  Activity,
  Calendar,
  KeyRound,
  FileText,
  Clock,
  Send,
  Kanban,
  CheckSquare,
  Workflow,
  Sparkles,
  PieChart,
  UserPlus,
  Filter,
  Sliders,
  DollarSign,
  TrendingUp,
  FileCheck,
  Lock,
  X,
  CheckCircle,
  Building2Icon,
  Phone,
  Mail,
} from "lucide-react";

interface Feature {
  icon: LucideIcon;
  label: string;
}

interface Industry {
  id: string;
  title: string;
  heading: string;
  subheading: string;
  icon: LucideIcon;
  features: Feature[];
}

const ALL_INDUSTRIES: Industry[] = [
  {
    id: "real-estate",
    title: "Real Estate CRM",
    heading: "India's Simplest Real Estate CRM Software",
    subheading:
      "Track your agents, boost calling efficiency, automate repetitive tasks, and take your business to the next level with India's No. 1 Real Estate CRM.",
    icon: Building2,
    features: [
      { icon: PhoneCall, label: "1-click dialer" },
      { icon: Mic, label: "Call Recording and Tracking" },
      { icon: Magnet, label: "MagicBricks & 99acres Sync" },
      { icon: MapPin, label: "Field Executive Tracking" },
      { icon: CalendarCheck, label: "Site Visit Scheduling" },
      { icon: MessageSquare, label: "WhatsApp Brochures" },
      { icon: BarChart3, label: "Real-time Insights" },
    ],
  },
  {
    id: "education",
    title: "CRM for Education",
    heading: "India's Simplest Education CRM Software",
    subheading:
      "Boost student admissions with automated call queues, instant counselor assignment, and direct WhatsApp counseling triggers.",
    icon: GraduationCap,
    features: [
      { icon: Magnet, label: "FB & Web Lead Capture" },
      { icon: Users, label: "Counselor Lead Allocation" },
      { icon: MessageSquare, label: "Prospectus via WhatsApp" },
      { icon: CalendarCheck, label: "Counseling Session Reminders" },
      { icon: BadgeCheck, label: "Application Tracking" },
      { icon: Mic, label: "Call Quality Audits" },
      { icon: Award, label: "Admission Reports" },
    ],
  },
  {
    id: "travel",
    title: "Travel CRM",
    heading: "India's Simplest Travel CRM Software",
    subheading:
      "Send instant WhatsApp trip itineraries, share custom holiday package quotes, and manage travel booking pipelines seamlessly.",
    icon: Plane,
    features: [
      { icon: FileSpreadsheet, label: "PDF Itinerary Sharing" },
      { icon: Globe, label: "Destination Lead Routing" },
      { icon: MessageSquare, label: "WhatsApp Quote Alerts" },
      { icon: Clock, label: "Payment Due Reminders" },
      { icon: Compass, label: "Package Customizer" },
      { icon: PhoneCall, label: "Click-to-Call Travelers" },
      { icon: BarChart3, label: "Booking Conversion Rate" },
    ],
  },
  {
    id: "loan-dsa",
    title: "Loan DSA CRM",
    heading: "India's Simplest Loan DSA CRM Software",
    subheading:
      "Streamline loan application tracking, automate client document management, and send instant WhatsApp loan status alerts.",
    icon: Coins,
    features: [
      { icon: FileText, label: "Document Checklist Tracker" },
      { icon: MessageSquare, label: "WhatsApp Approval Status" },
      { icon: CreditCard, label: "Payout & Commission Logs" },
      { icon: Bell, label: "Follow-up Reminders" },
      { icon: Building, label: "Bank Scheme Matching" },
      { icon: Mic, label: "Verification Call Logs" },
      { icon: BarChart3, label: "Disbursement Analytics" },
    ],
  },
  {
    id: "healthcare",
    title: "Healthcare CRM",
    heading: "India's Simplest Healthcare CRM Software",
    subheading:
      "Automate patient appointments, send consultation reminders via WhatsApp, and manage patient inquiries in a single platform.",
    icon: Stethoscope,
    features: [
      { icon: Calendar, label: "Appointment Booking" },
      { icon: MessageSquare, label: "WhatsApp Reminders" },
      { icon: Activity, label: "Patient Care Timeline" },
      { icon: PhoneCall, label: "Patient Helpline Dialer" },
      { icon: Mic, label: "Consultation Call Records" },
      { icon: Bell, label: "Post-care Follow-ups" },
      { icon: BarChart3, label: "Footfall & Revenue Stats" },
    ],
  },
  {
    id: "automobile",
    title: "Automobile CRM",
    heading: "India's Simplest Automobile CRM Software",
    subheading:
      "Convert test drives into vehicle sales with automated call routines, test-drive scheduling, and service due reminders.",
    icon: Car,
    features: [
      { icon: KeyRound, label: "Test Drive Scheduler" },
      { icon: Magnet, label: "Portal & Walk-in Capture" },
      { icon: MessageSquare, label: "Automated Service Alerts" },
      { icon: MapPin, label: "Field Rep Location Tracking" },
      { icon: PhoneCall, label: "1-Click Buyer Follow-up" },
      { icon: Mic, label: "Call Recording Audit" },
      { icon: BarChart3, label: "Model-wise Sales Trends" },
    ],
  },
  {
    id: "b2b",
    title: "B2B CRM Software",
    heading: "India's Simplest B2B CRM Software",
    subheading:
      "Manage complex deal stages, meetings, and corporate proposals with structured sales pipelines built for high conversion.",
    icon: Briefcase,
    features: [
      { icon: Kanban, label: "Multi-stage Deal Pipeline" },
      { icon: FileText, label: "Proposal & Contract Tracker" },
      { icon: CalendarCheck, label: "Meeting & Demo Logs" },
      { icon: PhoneCall, label: "Corporate Call Logs" },
      { icon: Send, label: "Bulk Email & WhatsApp" },
      { icon: Users, label: "Stakeholder Mapping" },
      { icon: BarChart3, label: "Revenue Forecasting" },
    ],
  },
  {
    id: "call-center",
    title: "Call Center CRM",
    heading: "India's Simplest Call Center CRM Software",
    subheading:
      "Maximize agent call volumes with 1-click cloud dialing, live supervisor tracking, and automatic call recordings.",
    icon: Headphones,
    features: [
      { icon: PhoneCall, label: "1-Click Cloud Dialer" },
      { icon: Mic, label: "Auto Audio Recording" },
      { icon: Users, label: "Live Supervisor View" },
      { icon: Clock, label: "Talk Time Tracking" },
      { icon: Bell, label: "Call Reschedule Triggers" },
      { icon: FileSpreadsheet, label: "Excel Contacts Upload" },
      { icon: BarChart3, label: "Agent Leaderboards" },
    ],
  },
  {
    id: "digital-marketing",
    title: "CRM for Digital Marketing",
    heading: "India's Simplest Digital Marketing CRM",
    subheading:
      "Instantly capture and nurture leads from Meta, Google, & LinkedIn Ads with zero-latency integration and automatic WhatsApp triggers.",
    icon: Target,
    features: [
      { icon: Magnet, label: "Meta & Google Lead Sync" },
      { icon: MessageSquare, label: "Instant Welcome WhatsApp" },
      { icon: Sparkles, label: "Zero-latency Lead Routing" },
      { icon: PhoneCall, label: "Immediate Agent Call" },
      { icon: PieChart, label: "Ad Channel ROI Tracking" },
      { icon: CheckSquare, label: "Campaign Lead Quality" },
      { icon: BarChart3, label: "Cost-Per-Lead Reports" },
    ],
  },
  {
    id: "recruiting",
    title: "CRM for Recruiting",
    heading: "India's Simplest Recruiting CRM Software",
    subheading:
      "Streamline candidate sourcing, candidate screening, interview schedules, and client placements efficiently.",
    icon: UserCheck,
    features: [
      { icon: UserPlus, label: "Candidate Sourcing Logs" },
      { icon: Kanban, label: "Interview Stage Pipeline" },
      { icon: MessageSquare, label: "WhatsApp Drive Alerts" },
      { icon: CalendarCheck, label: "Interview Reminders" },
      { icon: FileText, label: "Resume & Document Logs" },
      { icon: PhoneCall, label: "1-Click Candidate Calls" },
      { icon: BarChart3, label: "Placement Reports" },
    ],
  },
  {
    id: "saas",
    title: "CRM for SaaS Companies",
    heading: "India's Simplest SaaS CRM Software",
    subheading:
      "Convert free trial signups into paid subscribers with smart automated onboarding sequences and demo tracking.",
    icon: Cloud,
    features: [
      { icon: Sparkles, label: "Trial Signup Webhooks" },
      { icon: MessageSquare, label: "Automated Onboarding" },
      { icon: CalendarCheck, label: "Demo Call Scheduler" },
      { icon: Sliders, label: "Usage Stage Segmentation" },
      { icon: PhoneCall, label: "1-Click Sales Calling" },
      { icon: TrendingUp, label: "MRR Pipeline Tracking" },
      { icon: BarChart3, label: "Trial-to-Paid Conversion" },
    ],
  },
  {
    id: "startups",
    title: "CRM for Startups",
    heading: "India's Simplest Startup CRM Software",
    subheading:
      "A simple, high-impact CRM setup to build early revenue pipelines fast with zero technical overhead.",
    icon: Rocket,
    features: [
      { icon: PhoneCall, label: "1-Click Quick Dialer" },
      { icon: MessageSquare, label: "WhatsApp Outreach" },
      { icon: Magnet, label: "Fast Lead Capture" },
      { icon: Workflow, label: "Simple Sales Workflows" },
      { icon: Bell, label: "Smart Task Reminders" },
      { icon: Clock, label: "5-Minute Easy Setup" },
      { icon: BarChart3, label: "Daily Conversion Metrics" },
    ],
  },
  {
    id: "financial-services",
    title: "Financial Services CRM",
    heading: "India's Simplest Financial Services CRM",
    subheading:
      "Manage client portfolios, advisory call logs, policy renewals, and compliance recordings with total transparency.",
    icon: Landmark,
    features: [
      { icon: Mic, label: "Encrypted Call Audio Logs" },
      { icon: MessageSquare, label: "SIP & Renewal Alerts" },
      { icon: Filter, label: "Portfolio Segmentation" },
      { icon: Clock, label: "Investment Review Reminders" },
      { icon: FileCheck, label: "Audit & Compliance Trail" },
      { icon: PhoneCall, label: "1-Click Client Connect" },
      { icon: BarChart3, label: "AUM & Renewal Reports" },
    ],
  },
  {
    id: "fintech",
    title: "Fintech CRM",
    heading: "India's Simplest Fintech CRM Software",
    subheading:
      "Accelerate user KYC verification, merchant onboarding, and outreach with high-throughput automated lead distribution.",
    icon: Wallet,
    features: [
      { icon: BadgeCheck, label: "API KYC Status Verification" },
      { icon: MessageSquare, label: "WhatsApp Status Alerts" },
      { icon: Workflow, label: "Merchant Lead Distribution" },
      { icon: PhoneCall, label: "Onboarding Call Dialer" },
      { icon: Lock, label: "Role-Based Security" },
      { icon: Clock, label: "Verification SLA Logs" },
      { icon: BarChart3, label: "Merchant Acquisition Stats" },
    ],
  },
  {
    id: "insurance",
    title: "Insurance CRM",
    heading: "India's Simplest Insurance CRM Software",
    subheading:
      "Boost policy renewals and streamline claims status communication with automated WhatsApp & SMS renewal alerts.",
    icon: ShieldCheck,
    features: [
      { icon: Bell, label: "Auto Policy Expiry Alerts" },
      { icon: MessageSquare, label: "WhatsApp Renewal Quotes" },
      { icon: Kanban, label: "Motor, Health & Life Pipelines" },
      { icon: Mic, label: "Policy Call Recordings" },
      { icon: FileText, label: "Claim Request Tracker" },
      { icon: PhoneCall, label: "1-Click Policy Follow-up" },
      { icon: DollarSign, label: "Premium Renewal Analytics" },
    ],
  },
];

const TEAM_SIZES = ["1 - 5 members", "6 - 15 members", "16 - 50 members", "50+ members"];

export default function IndustriesPage() {
  const [activeTabId, setActiveTabId] = useState<string>(ALL_INDUSTRIES[0].id);
  const isClickScrolling = useRef<boolean>(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalStep, setModalStep] = useState<1 | 2 | 3>(1);
  const [selectedIndustry, setSelectedIndustry] = useState<string>("");

  // Form State
  const [teamSize, setTeamSize] = useState<string>("");
  const [formData, setFormData] = useState({
    companyName: "",
    email: "",
    phone: "",
  });

  const openDemoModal = (industryTitle: string) => {
    setSelectedIndustry(industryTitle);
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

  const scrollToIndustry = (id: string) => {
    isClickScrolling.current = true;
    setActiveTabId(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setTimeout(() => {
      isClickScrolling.current = false;
    }, 800);
  };

  // IntersectionObserver to auto-highlight sidebar button when scrolling past cards
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (isClickScrolling.current) return;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveTabId(entry.target.id);
          }
        });
      },
      {
        root: null,
        rootMargin: "-20% 0px -40% 0px",
        threshold: 0.2,
      }
    );

    ALL_INDUSTRIES.forEach((ind) => {
      const el = document.getElementById(ind.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleHashScroll = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash) {
        scrollToIndustry(hash);
      }
    };

    handleHashScroll();
    window.addEventListener("hashchange", handleHashScroll);
    return () => window.removeEventListener("hashchange", handleHashScroll);
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans relative">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Sticky Left Sidebar Menu */}
          <aside className="w-full lg:w-64 lg:sticky lg:top-24 z-40 bg-white/80 backdrop-blur-md p-3 rounded-2xl border border-slate-200/80 shadow-sm shrink-0">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider px-3 pb-2 hidden lg:block">
              Industries
            </h3>
            <div className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-y-auto max-h-[calc(100vh-140px)] scrollbar-none">
              {ALL_INDUSTRIES.map((ind) => {
                const IconComponent = ind.icon;
                const isActive = activeTabId === ind.id;
                return (
                  <button
                    key={ind.id}
                    onClick={() => scrollToIndustry(ind.id)}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 lg:shrink text-left border lg:border-none ${
                      isActive
                        ? "bg-[#6C5CE7] text-white shadow-sm"
                        : "bg-slate-50 lg:bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900 border-slate-200"
                    }`}
                  >
                    <IconComponent
                      className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : "text-[#6C5CE7]"}`}
                    />
                    <span className="truncate">{ind.title}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Industry Cards Container */}
          <div className="flex-1 w-full space-y-12">
            {ALL_INDUSTRIES.map((industry) => (
              <div key={industry.id} id={industry.id} className="scroll-mt-28">
                {/* TeleCRM Banner Container */}
                <div className="bg-white/70 backdrop-blur-md border border-white/60 rounded-3xl p-8 sm:p-12 shadow-xl hover:shadow-2xl transition text-center max-w-4xl mx-auto space-y-8">
                  {/* Heading & Subheading */}
                  <div className="space-y-3 max-w-2xl mx-auto">
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                      {industry.heading}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                      {industry.subheading}
                    </p>
                  </div>

                  {/* 7 Unique Industry Feature Icons Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4 pt-2 pb-4 items-baseline justify-center">
                    {industry.features.map((feat, idx) => {
                      const FeatIcon = feat.icon;
                      return (
                        <div key={idx} className="flex flex-col items-center gap-2">
                          <div className="w-12 h-12 rounded-full bg-slate-200/60 flex items-center justify-center text-slate-800 shadow-inner">
                            <FeatIcon className="w-5 h-5 text-slate-800" />
                          </div>
                          <span className="text-[11px] font-semibold text-slate-700 leading-snug">
                            {feat.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col items-center gap-3 pt-2">
                    <Link
                      href={`/industries/details#${industry.id}`}
                      className="bg-[#6C5CE7] hover:bg-[#5A4AD4] text-white font-extrabold py-3.5 px-8 rounded-xl text-sm shadow-md transition cursor-pointer active:scale-95 inline-flex items-center gap-2 group"
                    >
                      <span>See more</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                    <button className="flex items-center gap-1.5 text-slate-700 hover:text-[#6C5CE7] text-xs font-bold transition cursor-pointer">
                      <PlayCircle className="w-4 h-4 text-[#6C5CE7]" />
                      <span className="underline">Watch video</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <Footer />

      {/* POP-UP DEMO MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
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
                    Step 1 of 2 • {selectedIndustry}
                  </span>
                  <h3 className="text-xl font-black text-slate-900">
                    How many members are in your team?
                  </h3>
                  <p className="text-xs text-slate-500">
                    We’ll customize your demo according to your sales team’s scale.
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

            {/* STEP 3: Response Received Confirmation */}
            {modalStep === 3 && (
              <div className="text-center space-y-4 py-4 animate-in zoom-in-95 duration-300">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                  <CheckCircle className="w-10 h-10" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-xl font-black text-slate-900">Response Received!</h3>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed px-2">
                    Thank you, <span className="font-extrabold text-slate-900">{formData.companyName}</span>! Our domain specialist will contact you shortly at{" "}
                    <span className="font-extrabold text-slate-900">{formData.email}</span> /{" "}
                    <span className="font-extrabold text-slate-900">{formData.phone}</span> to schedule your product demo.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-left text-[11px] space-y-1 text-slate-600">
                  <div>
                    <span className="font-bold text-slate-800">Industry:</span> {selectedIndustry}
                  </div>
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
    </div>
  );
}