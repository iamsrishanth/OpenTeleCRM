"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  CheckCircle2,
  ChevronDown,
  Play,
  HelpCircle,
  ShieldCheck,
  Zap,
  UserCheck,
  ArrowRight,
  PlusCircle,
  X,
  Users,
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
    question: "Can I try TeleCRM before purchasing?",
    answer: "Yes! You can schedule a live demo with our team, and we will set up a free trial tailored to your sales process and requirements.",
  },
  {
    question: "How long does the onboarding process take?",
    answer: "Most sales teams get fully onboarded within 15 to 30 minutes. Our team helps you import contacts, integrate Facebook/WhatsApp, and train your agents.",
  },
  {
    question: "Are there any hidden setup or integration fees?",
    answer: "No, all plans come with transparent pricing. Core features, app access, and standard integrations are included without surprise costs.",
  },
  {
    question: "Can I change or upgrade my plan later?",
    answer: "Absolutely! You can add more agent seats or switch between Quarterly and Annual billing cycles at any time from your account settings.",
  },
  {
    question: "Does TeleCRM support WhatsApp API integration?",
    answer: "Yes, TeleCRM seamlessly connects with WhatsApp Cloud API to automate messages, send broadcast campaigns, and log incoming leads automatically.",
  },
];

const ADD_ONS = [
  { name: "Official WhatsApp Cloud API" },
  { name: "Extra Lead Source Integrations" },
  { name: "Dedicated Onboarding Specialist" },
];

const TEAM_SIZES = ["1 - 5 members", "6 - 15 members", "16 - 50 members", "50+ members"];

export default function PricingPage() {
  const [isAddonsOpen, setIsAddonsOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Demo Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2 | 3>(1);
  const [selectedPlanContext, setSelectedPlanContext] = useState("");

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

  const openDemoModal = (planContext: string = "Standard Plan") => {
    setSelectedPlanContext(planContext);
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

      {/* Main Pricing Section */}
      <section className="py-16 px-6 max-w-5xl mx-auto space-y-12">
        {/* Title Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
            Pricing
          </h1>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
            Sales CRM Pricing
          </p>
        </div>

        {/* Pricing Card Table */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-8 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Left Features Column */}
            <div className="lg:col-span-7 space-y-6">
              <h3 className="text-2xl font-black text-slate-900">Core CRM</h3>
              
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>Excel upload</span>
                </li>
                <li className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>1-click dialer, Call recording</span>
                </li>
                <li className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>Follow-ups</span>
                </li>
                <li className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>Reports & Leaderboard</span>
                </li>
                <li className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span className="flex items-center gap-1">
                    Automations <ChevronDown className="w-4 h-4 text-slate-400" />
                  </span>
                </li>
              </ul>
            </div>

            {/* Right Pricing Columns (Quarterly & Annual) */}
            <div className="lg:col-span-5 grid grid-cols-2 gap-4 border-t lg:border-t-0 lg:border-l border-slate-100 pt-8 lg:pt-0 lg:pl-8 text-center items-center">
              
              {/* Quarterly Option */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-indigo-600">Quarterly</span>
                <div>
                  <span className="text-3xl font-black text-slate-900">₹1099</span>
                  <p className="text-[11px] font-bold text-slate-400 mt-0.5">/user/mo</p>
                  <p className="text-[10px] text-slate-400 font-medium">(billed quarterly)</p>
                </div>
                <button
                  onClick={() => openDemoModal("Quarterly Plan (₹1099/user/mo)")}
                  className="w-full bg-white hover:bg-slate-50 text-[#6C5CE7] border-2 border-[#6C5CE7] font-extrabold py-2.5 rounded-xl text-xs transition cursor-pointer"
                >
                  Buy Now
                </button>
              </div>

              {/* Annual Option (Highlighted with Badge) */}
              <div className="space-y-3 relative">
                <div className="absolute -top-7 left-1/2 transform -translate-x-1/2 bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-0.5 rounded-full whitespace-nowrap">
                  Save 27%
                </div>

                <span className="text-xs font-bold text-slate-700">Annual</span>
                <div>
                  <span className="text-3xl font-black text-slate-900">₹799</span>
                  <p className="text-[11px] font-bold text-slate-400 mt-0.5">/user/mo</p>
                  <p className="text-[10px] text-slate-400 font-medium">(billed annually)</p>
                </div>
                <button
                  onClick={() => openDemoModal("Annual Plan (₹799/user/mo)")}
                  className="w-full bg-[#6C5CE7] hover:bg-[#5A4AD4] text-white font-extrabold py-2.5 rounded-xl text-xs transition shadow-md cursor-pointer"
                >
                  Buy Now
                </button>
              </div>

            </div>
          </div>

          {/* Add-ons Accordion Bar */}
          <div className="border-t border-slate-100 bg-slate-50/50">
            <button
              onClick={() => setIsAddonsOpen(!isAddonsOpen)}
              className="w-full p-6 flex justify-between items-center text-left font-extrabold text-sm text-slate-800 hover:text-[#6C5CE7] transition cursor-pointer"
            >
              <span>Add-ons</span>
              <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isAddonsOpen ? "rotate-180 text-[#6C5CE7]" : ""}`} />
            </button>

            {isAddonsOpen && (
              <div className="px-6 pb-6 space-y-3 border-t border-slate-100 pt-4 bg-white">
                {ADD_ONS.map((addon, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs font-semibold p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="flex items-center gap-2 text-slate-700">
                      <PlusCircle className="w-4 h-4 text-[#6C5CE7]" />
                      {addon.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Onboarding Process Video Section */}
      <section className="bg-white py-20 px-6 border-t border-b border-slate-200/80">
        <div className="max-w-5xl mx-auto space-y-12 text-center">
          <div className="space-y-3">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Customer Onboarding Process
            </h2>
            <p className="text-slate-500 text-sm max-w-xl mx-auto">
              Watch step-by-step how easy it is to import leads, configure agent workflows, and start calling.
            </p>
          </div>

          {/* Video Placeholder Container */}
          <div className="max-w-3xl mx-auto relative rounded-3xl overflow-hidden shadow-2xl bg-slate-900 border-4 border-slate-800 group">
            <div className="aspect-video flex flex-col justify-center items-center relative p-8 text-center space-y-4 bg-gradient-to-tr from-[#180B38] via-slate-900 to-[#2A185C]">
              <button className="w-20 h-20 rounded-full bg-[#6C5CE7] text-white flex items-center justify-center shadow-2xl transition-transform duration-300 transform group-hover:scale-110 cursor-pointer">
                <Play className="w-8 h-8 fill-white ml-1" />
              </button>
              <h4 className="text-xl font-extrabold text-white tracking-tight">
                Watch TeleCRM Setup Walkthrough
              </h4>
            </div>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions (FAQ) Section */}
      <section className="py-20 px-6 max-w-4xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-[#6C5CE7] font-bold text-xs uppercase tracking-wider">
            <HelpCircle className="w-4 h-4" /> Got Questions?
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            Frequently Asked Questions
          </h2>
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

      {/* Request a Demo CTA Box Section */}
      <section className="pb-20 px-6 max-w-5xl mx-auto">
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
              onClick={() => openDemoModal("Live Demo CTA")}
              className="bg-[#6C5CE7] hover:bg-[#5A4AD4] text-white font-extrabold py-4 px-8 rounded-2xl text-sm shadow-xl transition cursor-pointer flex items-center gap-2"
            >
              <span>Request a Live Demo</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="pt-6 flex flex-wrap justify-center gap-6 text-[11px] font-bold text-slate-400 border-t border-white/10 max-w-xl mx-auto">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> No credit card required</span>
            <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-amber-400" /> Instant account setup</span>
            <span className="flex items-center gap-1.5"><UserCheck className="w-3.5 h-3.5 text-indigo-400" /> Free onboarding support</span>
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
                    We’ll customize your demo and pricing breakdown for your team.
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
                    Thank you, <span className="font-extrabold text-slate-900">{formData.companyName}</span>! Our pricing specialist will reach out shortly at{" "}
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