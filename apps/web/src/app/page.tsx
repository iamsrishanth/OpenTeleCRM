"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  PhoneCall,
  MessageSquare,
  BarChart3,
  Users,
  Zap,
  CheckCircle2,
  ChevronDown,
  Star,
  Quote,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  X,
  Building2Icon,
  Mail,
  Phone,
  CheckCircle,
} from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    question: "What is TeleCRM and who is it for?",
    answer:
      "TeleCRM is an all-in-one telecalling CRM built specifically for sales teams. It combines a 1-click mobile auto-dialer, automatic call recording, lead management, and WhatsApp automation.",
  },
  {
    question: "How does the 1-Click Dialer work?",
    answer:
      "Your agents simply tap a single button on their smartphone to call the next lead in queue. Call logs, durations, and audio recordings are automatically synced back to the CRM.",
  },
  {
    question: "Can I connect TeleCRM with Meta Ads and Google Forms?",
    answer:
      "Yes! TeleCRM offers instant, zero-latency integrations with Facebook Lead Ads, Google Forms, Housing.com, 99acres, and custom webhooks.",
  },
  {
    question: "Is there any hardware or setup required?",
    answer:
      "No extra hardware required! Your sales agents can use their existing Android phones to make calls while managers track everything from the web dashboard.",
  },
  {
    question: "Does TeleCRM support WhatsApp automation?",
    answer:
      "Yes, TeleCRM integrates with WhatsApp Cloud API to let you send 1-click messages, automated follow-up sequences, and bulk broadcast campaigns.",
  },
];

const FEATURES = [
  {
    icon: PhoneCall,
    title: "1-Click Auto Dialer",
    description:
      "Eliminate manual dialing. Your team can call up to 300+ leads daily directly from their smartphones with automated queueing.",
  },
  {
    icon: MessageSquare,
    title: "WhatsApp Automation",
    description:
      "Send instant welcome messages, property brochures, or quotes on WhatsApp immediately after every call with custom templates.",
  },
  {
    icon: BarChart3,
    title: "Live Reports & Leaderboards",
    description:
      "Track total calls, talk time, lead conversion ratios, and daily team performance with real-time visual dashboards.",
  },
  {
    icon: Users,
    title: "Lead Management",
    description:
      "Organize, filter, and track leads effortlessly from capturing to closing across all pipeline stages.",
  },
  {
    icon: CheckCircle2,
    title: "Automatic Call Recording",
    description:
      "Record all incoming and outgoing sales calls automatically and store them securely on the cloud for training and QA.",
  },
  {
    icon: Zap,
    title: "Automatic Lead Routing",
    description:
      "Distribute incoming leads evenly among your telecalling agents or route them based on location, budget, or custom criteria.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "TeleCRM increased our calling volume by 2.5x within the first week. Our admissions counselors love how simple the 1-click dialer is.",
    name: "Rajesh Sharma",
    role: "Head of Admissions",
    company: "EduTech Global",
    avatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150",
    rating: 5,
  },
  {
    quote:
      "Integrating our Meta lead ads directly with WhatsApp automation saved us hours every day. Instant follow-ups doubled our conversion rate.",
    name: "Priya Nair",
    role: "Sales Director",
    company: "Apex Real Estate",
    avatar:
      "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=150",
    rating: 5,
  },
  {
    quote:
      "The live supervisor dashboard gives complete visibility into agent talk times and recordings. It transformed our telecalling operations.",
    name: "Ankit Verma",
    role: "Operations Lead",
    company: "FastLoan DSA",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150",
    rating: 5,
  },
];

const TEAM_SIZES = ["1 - 5 members", "6 - 15 members", "16 - 50 members", "50+ members"];

export default function Home() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Demo Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2 | 3>(1);
  const [selectedDemoContext, setSelectedDemoContext] = useState("");

  // Form Data State
  const [teamSize, setTeamSize] = useState("");
  const [formData, setFormData] = useState({
    companyName: "",
    email: "",
    phone: "",
  });

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const openDemoModal = (contextTitle: string = "General Sales Demo") => {
    setSelectedDemoContext(contextTitle);
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
    <div className="min-h-screen bg-[#FAF9FF] text-slate-900 font-sans relative">
      <Navbar />

      {/* Hero Section */}
      <section className="pt-16 pb-20 px-6 max-w-7xl mx-auto text-center space-y-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight leading-tight">
            Build efficient sales system for your team
          </h1>
          <p className="text-slate-600 text-lg sm:text-xl font-medium max-w-3xl mx-auto leading-relaxed">
            With lead management, phone calls, meetings, and WhatsApp communication managed on a single platform.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <button
              onClick={() => openDemoModal("Hero - Book Demo Call")}
              className="bg-[#6C5CE7] hover:bg-[#5A4AD4] text-white font-extrabold py-4 px-8 rounded-2xl text-sm shadow-xl shadow-indigo-500/20 transition cursor-pointer"
            >
              Book Demo call
            </button>
          </div>
        </div>
      </section>

      {/* Trusted Companies Section */}
      <section className="py-12 bg-white border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-6">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">
            Trusted by Indian sales teams who sell to Indian customers
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-16 opacity-70 grayscale hover:grayscale-0 transition-all duration-300">
            <span className="text-xl font-black text-slate-800">Domino's</span>
            <span className="text-xl font-black text-slate-800">BYJU'S</span>
            <span className="text-xl font-black text-slate-800">Mercedes-Benz</span>
            <span className="text-xl font-black text-slate-800">CELLBELL</span>
            <span className="text-xl font-black text-slate-800">Shiprocket</span>
            <span className="text-xl font-black text-slate-800">COX & KINGS</span>
          </div>
        </div>
      </section>

      {/* Key Features Grid Section */}
      <section className="py-24 px-6 max-w-7xl mx-auto space-y-16">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="text-xs font-black uppercase tracking-widest text-[#6C5CE7] bg-indigo-50 border border-indigo-100 px-4 py-1.5 rounded-full inline-block">
            POWERFUL CAPABILITIES
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Everything you need to run a high-converting sales engine
          </h2>
          <p className="text-slate-500 text-sm sm:text-base font-medium">
            Designed from the ground up for Indian telecalling environments and sales teams.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {FEATURES.map((feat, idx) => (
            <div
              key={idx}
              className="bg-white rounded-3xl border border-slate-200/80 p-8 space-y-4 shadow-sm hover:shadow-xl transition hover:-translate-y-1 duration-200"
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-[#6C5CE7] flex items-center justify-center font-bold">
                <feat.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900">{feat.title}</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                {feat.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-white border-t border-b border-slate-200/80 px-6">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-black uppercase tracking-widest text-[#6C5CE7]">
              CUSTOMER SUCCESS STORIES
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Loved by 1,000+ sales teams across India
            </h2>
            <p className="text-slate-500 text-sm font-medium">
              Here is how businesses scale their sales operations with TeleCRM.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((t, idx) => (
              <div
                key={idx}
                className="bg-[#FAF9FF] rounded-3xl border border-slate-200/80 p-8 flex flex-col justify-between space-y-6 shadow-sm relative"
              >
                <Quote className="w-8 h-8 text-indigo-200 absolute top-6 right-6" />

                <div className="space-y-4">
                  <div className="flex gap-1 text-amber-400">
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed italic">
                    "{t.quote}"
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-slate-200/60">
                  <img
                    src={t.avatar}
                    alt={t.name}
                    className="w-10 h-10 rounded-full object-cover border border-slate-300"
                  />
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900">{t.name}</h4>
                    <p className="text-[11px] font-bold text-slate-400">
                      {t.role}, <span className="text-[#6C5CE7]">{t.company}</span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 px-6 max-w-4xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-[#6C5CE7] font-bold text-xs uppercase tracking-wider">
            <HelpCircle className="w-4 h-4" /> Got Questions?
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm">
            Everything you need to know about setting up TeleCRM for your sales team.
          </p>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <div
                key={index}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden transition shadow-sm"
              >
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full text-left p-6 flex justify-between items-center gap-4 font-extrabold text-slate-800 text-sm sm:text-base cursor-pointer hover:text-[#6C5CE7] transition"
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 transition-transform ${
                      isOpen ? "rotate-180 text-[#6C5CE7]" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-6 text-xs sm:text-sm text-slate-600 font-medium leading-relaxed border-t border-slate-100 pt-4">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Request a Demo CTA Section */}
      <section className="pb-24 px-6 max-w-5xl mx-auto">
        <div className="bg-gradient-to-r from-[#180B38] via-[#2A185C] to-[#180B38] rounded-3xl p-8 sm:p-14 text-white text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              Ready to double your sales team's productivity?
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm font-medium">
              Get a personalized demo setup configured specifically for your industry within 15 minutes.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button
              onClick={() => openDemoModal("Landing Page Bottom CTA")}
              className="bg-[#6C5CE7] hover:bg-[#5A4AD4] text-white font-extrabold py-4 px-8 rounded-2xl text-sm shadow-xl transition cursor-pointer flex items-center gap-2"
            >
              <span>Request a Live Demo</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="pt-6 flex flex-wrap justify-center gap-6 text-[11px] font-bold text-slate-400 border-t border-white/10 max-w-xl mx-auto">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> No credit card required
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> Instant account setup
            </span>
            <span className="flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-indigo-400" /> Free onboarding support
            </span>
          </div>
        </div>
      </section>

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
                    Step 1 of 2 
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
                    Thank you, <span className="font-extrabold text-slate-900">{formData.companyName}</span>! Our specialist will reach out shortly at{" "}
                    <span className="font-extrabold text-slate-900">{formData.email}</span> /{" "}
                    <span className="font-extrabold text-slate-900">{formData.phone}</span> to schedule your demo.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-left text-[11px] space-y-1 text-slate-600">
                  <div>
                    <span className="font-bold text-slate-800">Context: Demo Request</span>
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