"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
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
  MessageSquare,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Zap,
  Clock,
  Send,
  Users,
  Shield,
  FileText,
  Layers,
  ChevronRight,
  X,
  Building2Icon,
  Phone,
  Mail,
  CheckCircle,
} from "lucide-react";

interface IndustryDetail {
  id: string;
  title: string;
  badge: string;
  icon: any;
  heroHeading: string;
  overview: string;
  keyChallenges: string[];
  workflowFeatures: {
    title: string;
    description: string;
  }[];
  templates: string[];
  kpiStats: {
    metric: string;
    label: string;
  }[];
}

const INDUSTRY_DETAILS: IndustryDetail[] = [
  {
    id: "real-estate",
    title: "Real Estate CRM",
    badge: "REAL ESTATE & PROPERTY BROKERAGE",
    icon: Building2,
    heroHeading: "Accelerate Property Site Visits & Close High-Ticket Units",
    overview:
      "TeleCRM for Real Estate enables developers and channel partners to capture leads instantly from 99acres, MagicBricks, and Facebook Ads, auto-assign them to agents in seconds, and share WhatsApp property brochures with zero manual effort.",
    keyChallenges: [
      "Leads going cold due to delayed follow-ups after ad inquiries",
      "Manual copy-pasting of floor plans and pricing PDFs on personal WhatsApp",
      "No visibility into whether telecallers actually conducted site visits",
    ],
    workflowFeatures: [
      {
        title: "MagicBricks & 99acres Direct Webhooks",
        description: "Zero-latency lead sync directly distributes property inquiries to available telecallers with automatic round-robin routing.",
      },
      {
        title: "1-Click WhatsApp Property Brochures",
        description: "Send pre-approved project layout plans, pricing sheets, and Google Maps location pins immediately after every sales call.",
      },
      {
        title: "Site Visit GPS & Reschedule Alerts",
        description: "Track field sales reps conducting client walkthroughs and set automatic reminders for upcoming Sunday site visits.",
      },
    ],
    templates: ["3BHK Luxury Layout Brochure.pdf", "Site Visit Confirmation & Location Pin", "Festive Payment Scheme Quote"],
    kpiStats: [
      { metric: "3.4x", label: "Higher Site Visits" },
      { metric: "0.2s", label: "Lead Ingest Latency" },
      { metric: "42%", label: "Faster Unit Booking" },
    ],
  },
  {
    id: "education",
    title: "CRM for Education & EdTech",
    badge: "EDUCATION & ADMISSIONS MANAGEMENT",
    icon: GraduationCap,
    heroHeading: "Maximize Student Admissions & Counselor Productivity",
    overview:
      "Built for universities, coaching institutes, and EdTech platforms to automate counselor calling queues, send prospectuses on WhatsApp, and track students across the entire counseling journey.",
    keyChallenges: [
      "Counselors missing timely follow-ups during peak admission cycles",
      "Lack of centralized tracking for student application fee submissions",
      "Unmonitored counselor call quality and high student drop-off rates",
    ],
    workflowFeatures: [
      {
        title: "Counselor Auto-Dialer & Queueing",
        description: "Keep counselors focused with automated calling lists segmented by course preferences and admission deadlines.",
      },
      {
        title: "Course Prospectus & Fee Links on WhatsApp",
        description: "Send official syllabus PDFs and secure token fee payment links right inside the student communication thread.",
      },
      {
        title: "Counseling Call Recording & QA",
        description: "Audit admissions conversations automatically to train new counselors and improve conversion pitches.",
      },
    ],
    templates: ["Course Prospectus & Eligibility.pdf", "Scholarship Counseling Slot Confirmation", "Admission Fee Token Link"],
    kpiStats: [
      { metric: "+65%", label: "Student Reach Rate" },
      { metric: "4.8/5", label: "Counseling QA Score" },
      { metric: "2.1x", label: "Fee Collection Speed" },
    ],
  },
  {
    id: "travel",
    title: "Travel & Hospitality CRM",
    badge: "TRAVEL AGENCIES & TOUR OPERATORS",
    icon: Plane,
    heroHeading: "Convert Holiday Inquiries into Confirmed Bookings",
    overview:
      "Empower travel agents to send custom holiday itineraries, share hotel photos via WhatsApp, and manage tour booking deposits with automated payment reminder notifications.",
    keyChallenges: [
      "Custom itineraries taking too long to format and send to prospective travelers",
      "Travelers booking with competitors due to delayed quote dispatch",
      "Disorganized client payment schedules for flight and hotel vouchers",
    ],
    workflowFeatures: [
      {
        title: "Destination-Based Lead Allocation",
        description: "Automatically route European or domestic tour inquiries to destination specialist travel agents.",
      },
      {
        title: "Instant PDF Itinerary & Quotation Sharing",
        description: "Dispatch comprehensive tour day-by-day itineraries with photos directly to traveler WhatsApp in one click.",
      },
      {
        title: "Deposit & Visa Document Tracking",
        description: "Track client passport scans, visa approvals, and send scheduled WhatsApp alerts for remaining tour balances.",
      },
    ],
    templates: ["5N/6D Dubai Holiday Itinerary.pdf", "Flight & Hotel Voucher Confirmation", "Final Payment Schedule Due Alert"],
    kpiStats: [
      { metric: "98.2%", label: "WhatsApp Read Rate" },
      { metric: "35m", label: "Avg Quote Time" },
      { metric: "+40%", label: "Repeat Bookings" },
    ],
  },
  {
    id: "loan-dsa",
    title: "Loan DSA & Financial Lending CRM",
    badge: "LOAN AGENTS & DIRECT SELLING AGENTS",
    icon: Coins,
    heroHeading: "Streamline Loan Inquiries, Document Collection & Disbursals",
    overview:
      "Designed specifically for Loan DSAs and financial distributors to verify applicant eligibility, collect KYC documents over WhatsApp, and track bank commission payouts across multiple lending partners.",
    keyChallenges: [
      "Delays in collecting salary slips, ITR, and bank statements from borrowers",
      "Lack of status tracking across multiple partner banks and NBFCs",
      "Difficulty tracking team payout commissions and field verification logs",
    ],
    workflowFeatures: [
      {
        title: "Automated KYC Document Checklist",
        description: "Send applicants an interactive WhatsApp checklist requesting PAN, Aadhaar, and bank statements in structured formats.",
      },
      {
        title: "Bank Scheme & Eligibility Matcher",
        description: "Categorize borrower leads by CIBIL score and income to match them with the right bank loan schemes.",
      },
      {
        title: "Disbursal & Commission Ledger",
        description: "Log sanction letters, track disbursal dates, and calculate agent commissions automatically.",
      },
    ],
    templates: ["Home Loan KYC Checklist.pdf", "Bank Sanction Letter Notification", "Disbursal Status & Commission Summary"],
    kpiStats: [
      { metric: "50%", label: "Faster Document Ingestion" },
      { metric: "0%", label: "Lead Leakage" },
      { metric: "₹18Cr+", label: "Monthly Disbursal Tracked" },
    ],
  },
  {
    id: "healthcare",
    title: "Healthcare & Clinics CRM",
    badge: "CLINICS, HOSPITALS & WELLNESS CENTERS",
    icon: Stethoscope,
    heroHeading: "Automate Patient Consultations & Care Follow-ups",
    overview:
      "Equip clinics and diagnostic centers with automated appointment booking, patient reminder broadcasts, and post-consultation follow-up queues to reduce patient no-shows.",
    keyChallenges: [
      "High patient no-show rates for scheduled doctor consultations",
      "Patient records and inquiries scattered across personal staff phones",
      "Manual phone calls needed for lab report dispatch and follow-up checkups",
    ],
    workflowFeatures: [
      {
        title: "Automated WhatsApp Appointment Confirmation",
        description: "Send instant doctor consultation booking slots with clinic Google Maps directions and prep instructions.",
      },
      {
        title: "Lab Report Delivery & Prescription Sharing",
        description: "Securely send diagnostic test reports and doctor follow-up advice directly via WhatsApp alerts.",
      },
      {
        title: "Post-Procedure Checkup Reminders",
        description: "Trigger scheduled calls and feedback messages 7 days after medical procedures to ensure patient wellness.",
      },
    ],
    templates: ["Consultation Appointment Slot.pdf", "Diagnostic Lab Report Delivery", "Post-Treatment Care Instructions"],
    kpiStats: [
      { metric: "-72%", label: "No-Show Reduction" },
      { metric: "100%", label: "HIPAA/Data Compliance" },
      { metric: "4.9★", label: "Patient Care Rating" },
    ],
  },
  {
    id: "automobile",
    title: "Automobile Dealership CRM",
    badge: "CAR & BIKE DEALERSHIPS",
    icon: Car,
    heroHeading: "Drive Test-Drive Bookings & Maximize Showroom Walk-ins",
    overview:
      "Transform car and bike dealership sales with instant portal lead capture (CarWale, Gaadi, Facebook Ads), structured test-drive scheduling, and automated vehicle service reminders.",
    keyChallenges: [
      "Test drive inquiries lost when buyers visit competing showrooms",
      "Sales executives forgetting to follow up on financing and exchange quotes",
      "Post-purchase service retention dropping after first year",
    ],
    workflowFeatures: [
      {
        title: "Test-Drive Booking & Calendar Engine",
        description: "Lock test drive appointments with automated SMS/WhatsApp reminders sent to both buyer and showroom executive.",
      },
      {
        title: "Vehicle Comparison & On-Road Price Sheets",
        description: "Instantly share variant feature breakdowns, EMI calculators, and insurance quotes with buyers on WhatsApp.",
      },
      {
        title: "Service Due & Insurance Renewal Engine",
        description: "Automatically alert existing owners 30 days prior to their periodic service or motor insurance expiry.",
      },
    ],
    templates: ["Vehicle On-Road Price Quotation.pdf", "Test Drive Booking Confirmation", "Periodic Service Due Reminder"],
    kpiStats: [
      { metric: "+48%", label: "Test Drive Conversion" },
      { metric: "15m", label: "Avg First Contact Time" },
      { metric: "+33%", label: "Service Retention" },
    ],
  },
  {
    id: "b2b",
    title: "B2B Sales & Corporate CRM",
    badge: "ENTERPRISE & B2B CORPORATE SALES",
    icon: Briefcase,
    heroHeading: "Manage Long Sales Cycles & High-Value B2B Contracts",
    overview:
      "Structured pipeline management for B2B companies dealing with multiple decision makers, enterprise proposals, and quarterly revenue targets.",
    keyChallenges: [
      "Deals stalling without visibility into stakeholder review stages",
      "Sales proposals and NDAs getting lost in scattered email threads",
      "Inaccurate quarterly sales forecasts and lack of rep pipeline visibility",
    ],
    workflowFeatures: [
      {
        title: "Multi-Stage Enterprise Deal Kanban",
        description: "Track corporate accounts from Initial Discovery to Technical Demo, Stakeholder Buy-in, and Procurement Review.",
      },
      {
        title: "Proposal, SOW & Contract Tracking",
        description: "Store signed proposals, quotation revisions, and client meeting notes in a single centralized company timeline.",
      },
      {
        title: "Executive Revenue Forecasting",
        description: "Generate real-time weighted pipeline reports to accurately predict monthly and quarterly closed-won revenue.",
      },
    ],
    templates: ["B2B Enterprise Solution Proposal.pdf", "Executive Demo Slot Invitation", "Commercial Agreement & SOW"],
    kpiStats: [
      { metric: "2.4x", label: "Pipeline Velocity" },
      { metric: "92%", label: "Forecast Accuracy" },
      { metric: "+55%", label: "Deal Closure Rate" },
    ],
  },
  {
    id: "call-center",
    title: "Outbound & Inbound Call Center CRM",
    badge: "BPO & TELECALLING AGENCIES",
    icon: Headphones,
    heroHeading: "Maximize Daily Dialing Output & Supervisor Monitoring",
    overview:
      "The ultimate calling engine for high-volume telecalling teams. Eliminate manual dialing, monitor live agent talk times, and review automated call recordings for quality audits.",
    keyChallenges: [
      "Agents wasting 50% of shift time dialing numbers manually",
      "Supervisors unable to verify actual talk time vs idle time",
      "No automated mechanism to record and archive millions of call minutes",
    ],
    workflowFeatures: [
      {
        title: "Sequential 1-Click Auto-Dialer",
        description: "Launch continuous calling queues where agents make up to 300+ connects daily directly from mobile SIM or cloud telephony.",
      },
      {
        title: "Live Supervisor Leaderboard & Audio Audits",
        description: "Track team talk time, connect ratios, and listen to recordings directly within the browser dashboard.",
      },
      {
        title: "Automated Disposition & Callback Scheduler",
        description: "Record call outcomes with 1-tap buttons and schedule sequential callbacks that pop up automatically.",
      },
    ],
    templates: ["Post-Call Summary & Next Steps.pdf", "Automated Callback Reminder Alert", "Customer Satisfaction Feedback"],
    kpiStats: [
      { metric: "300+", label: "Calls / Agent / Day" },
      { metric: "3h 45m", label: "Avg Daily Talk Time" },
      { metric: "99.9%", label: "Call Recording Capture" },
    ],
  },
  {
    id: "digital-marketing",
    title: "CRM for Digital Marketing Agencies",
    badge: "PERFORMANCE MARKETING & AGENCIES",
    icon: Target,
    heroHeading: "Prove Lead Quality & Turn Ad Spend into Client Revenue",
    overview:
      "Connect client Facebook, Instagram, Google, and LinkedIn ad campaigns directly with telecalling queues to contact leads within 60 seconds of submission.",
    keyChallenges: [
      "Clients complaining about lead quality when response times are delayed",
      "Manual downloading and CSV sharing of Meta Lead Form exports",
      "No transparent way to prove campaign ROI and closed revenue to clients",
    ],
    workflowFeatures: [
      {
        title: "Zero-Latency Meta & Google Ad Webhooks",
        description: "Direct API webhooks push ad leads into the CRM the exact millisecond a user taps Submit on Instagram or Google.",
      },
      {
        title: "Instant Welcome WhatsApp Auto-Triggers",
        description: "Send automated introductory WhatsApp brochures before the prospect even closes their social media app.",
      },
      {
        title: "Client Portal & Lead Attribution Reports",
        description: "Provide clients with dedicated dashboards showing exactly which ad creatives produced closed paying customers.",
      },
    ],
    templates: ["Lead Ad Welcome Package.pdf", "Agency Client Performance Scorecard", "Campaign ROI & Lead Log Export"],
    kpiStats: [
      { metric: "< 45s", label: "Avg Contact Speed" },
      { metric: "+80%", label: "Lead Qualification" },
      { metric: "4.5x", label: "Ad Spend ROI" },
    ],
  },
  {
    id: "recruiting",
    title: "Staffing & Recruiting CRM",
    badge: "HR CONSULTANCIES & HEADHUNTERS",
    icon: UserCheck,
    heroHeading: "Place Candidates Faster & Automate Interview Scheduling",
    overview:
      "Organize candidate resumes, coordinate client interview rounds, and broadcast bulk WhatsApp alerts for open job drives with complete pipeline transparency.",
    keyChallenges: [
      "Candidates missing interview appointments due to poor communication",
      "Recruiters losing candidate resumes in messy email folders",
      "Difficulty broadcasting bulk walk-in drive alerts to candidate pools",
    ],
    workflowFeatures: [
      {
        title: "Candidate Sourcing & Resume Repository",
        description: "Tag candidates by skill stack, experience, and notice period for instant retrieval when new job mandates open.",
      },
      {
        title: "Interview Reminder & Location Automation",
        description: "Dispatch automated interview schedule alerts with Zoom links or company venue maps to candidates.",
      },
      {
        title: "Bulk WhatsApp Walk-in Drive Campaigns",
        description: "Reach thousands of pre-qualified candidates instantly with broadcast templates for mass hiring events.",
      },
    ],
    templates: ["Interview Schedule & Prep Guide.pdf", "Job Offer Letter Confirmation", "Bulk Walk-in Drive Announcement"],
    kpiStats: [
      { metric: "-60%", label: "Interview No-Shows" },
      { metric: "10,000+", label: "Broadcast Reach" },
      { metric: "12 Days", label: "Avg Placement Time" },
    ],
  },
  {
    id: "saas",
    title: "CRM for SaaS & Tech Startups",
    badge: "SOFTWARE & SUBSCRIPTION COMPANIES",
    icon: Cloud,
    heroHeading: "Convert Free Trial Signups into High-LTV Paid Plans",
    overview:
      "Bridge self-serve product trials with high-touch sales outreach. Monitor in-app user milestones, schedule product walkthroughs, and retain annual subscriptions.",
    keyChallenges: [
      "Trial users dropping off without speaking to a sales engineer",
      "Sales reps unaware of user in-app activity and product engagement",
      "High annual subscription churn due to lack of proactive check-ins",
    ],
    workflowFeatures: [
      {
        title: "Trial Signup Webhooks & Score Trigger",
        description: "Ingest in-app signup events and prioritize users who hit key feature engagement thresholds for immediate sales outreach.",
      },
      {
        title: "Product Demo & Calendar Integration",
        description: "Allow prospective enterprise buyers to schedule 1-on-1 technical onboarding calls with automatic CRM sync.",
      },
      {
        title: "MRR Pipeline & Renewal Alert Engine",
        description: "Track monthly recurring revenue pipelines and trigger proactive WhatsApp alerts 60 days before annual renewals.",
      },
    ],
    templates: ["SaaS Product Walkthrough Guide.pdf", "Enterprise Custom Tier Pricing", "Annual Renewal Agreement"],
    kpiStats: [
      { metric: "+44%", label: "Trial-to-Paid Ratio" },
      { metric: "99.9%", label: "Webhook Uptime" },
      { metric: "118%", label: "Net Revenue Retention" },
    ],
  },
  {
    id: "startups",
    title: "CRM for Early-Stage Startups",
    badge: "BOOTSTRAPPED & SEED STAGE FOUNDERS",
    icon: Rocket,
    heroHeading: "Set Up a Scalable Sales Engine in Under 15 Minutes",
    overview:
      "Everything early-stage founders need to prospect, call, and close their first 100 customers with zero complex coding or expensive enterprise setup fees.",
    keyChallenges: [
      "Founders wasting valuable time configuring heavy legacy CRM tools",
      "No budget for expensive per-user enterprise licenses",
      "Messy Excel spreadsheets causing lost customer conversations",
    ],
    workflowFeatures: [
      {
        title: "15-Minute Instant Out-of-the-Box Setup",
        description: "Import existing contact spreadsheets and start making trackable sales calls immediately from mobile phones.",
      },
      {
        title: "Founder-Friendly WhatsApp & Calling Stack",
        description: "Combine phone calls, WhatsApp messages, and deal stages in a clean unified feed that anyone on the team can use.",
      },
      {
        title: "Affordable Growth Tier Plans",
        description: "Scale seamlessly from 2 sales reps to 50+ callers without changing your underlying CRM infrastructure.",
      },
    ],
    templates: ["Startup Pitch Deck & One-Pager.pdf", "Pilot Program Onboarding Sheet", "Founder Direct Connect Note"],
    kpiStats: [
      { metric: "15 mins", label: "Setup & Go-Live" },
      { metric: "0", label: "Coding Required" },
      { metric: "100%", label: "Call History Logged" },
    ],
  },
  {
    id: "financial-services",
    title: "Financial Advisory & Wealth CRM",
    badge: "WEALTH MANAGERS & INVESTMENT FIRMS",
    icon: Landmark,
    heroHeading: "Build Client Trust with Compliance Recordings & SIP Alerts",
    overview:
      "Enable wealth managers and financial advisors to track portfolio reviews, send SIP renewal alerts, and securely store audited call recordings for regulatory compliance.",
    keyChallenges: [
      "Strict regulatory compliance requiring recorded advisory call logs",
      "Manual client tracking for SIP dates, insurance renewals, and tax reviews",
      "Protecting sensitive high-net-worth client financial details",
    ],
    workflowFeatures: [
      {
        title: "Encrypted Call Audio Logs for Compliance",
        description: "Automatically record and store advisory consultations on secure cloud storage with granular role-based access control.",
      },
      {
        title: "Automated SIP & Tax Review Reminders",
        description: "Send personalized WhatsApp alerts for upcoming SIP installments, portfolio rebalancing, and tax-saving deadlines.",
      },
      {
        title: "Role-Based Client Security Controls",
        description: "Ensure junior agents only access assigned accounts with phone number masking to prevent client database leakage.",
      },
    ],
    templates: ["Portfolio Performance Review.pdf", "SIP Installment Due Notification", "Annual Tax Optimization Checklist"],
    kpiStats: [
      { metric: "100%", label: "Audit Compliance" },
      { metric: "₹45Cr+", label: "AUM Monitored" },
      { metric: "96%", label: "SIP Retention Rate" },
    ],
  },
  {
    id: "fintech",
    title: "Fintech & Merchant Acquisition CRM",
    badge: "PAYMENTS, WALLETS & NEOBANKS",
    icon: Wallet,
    heroHeading: "Accelerate Merchant Onboarding & Soundbox Deployments",
    overview:
      "Empower field sales reps and telecalling agents to onboard retail merchants, verify KYC documents, and track QR/POS soundbox installations across cities.",
    keyChallenges: [
      "Field reps struggling to coordinate merchant KYC document verification",
      "Lack of real-time tracking for POS device & QR kit delivery",
      "High drop-off rates during merchant app registration workflows",
    ],
    workflowFeatures: [
      {
        title: "Merchant Field Onboarding & GPS Verification",
        description: "Track sales executives visiting retail stores with GPS location logging and instant shop photo uploads.",
      },
      {
        title: "API-Driven KYC Status WhatsApp Notifications",
        description: "Automatically inform merchants when their bank account, GST, and settlement approvals are live.",
      },
      {
        title: "High-Volume Merchant Lead Distribution",
        description: "Distribute thousands of inbound merchant leads daily across regional language telecallers.",
      },
    ],
    templates: ["Merchant Onboarding Agreement.pdf", "Soundbox Setup & QR Kit Activation", "Daily Settlement Summary Alert"],
    kpiStats: [
      { metric: "3.2x", label: "Merchant Acquisition" },
      { metric: "99.4%", label: "KYC Pass Rate" },
      { metric: "24h", label: "Avg Go-Live Time" },
    ],
  },
  {
    id: "insurance",
    title: "Insurance Agency & Brokerage CRM",
    badge: "GENERAL, HEALTH & LIFE INSURANCE",
    icon: ShieldCheck,
    heroHeading: "Boost Policy Renewal Retention & Accelerate Claims Processing",
    overview:
      "The specialized CRM engine for insurance agencies to automate policy expiry reminders, manage claim status updates, and track multi-line insurance pipelines.",
    keyChallenges: [
      "Policyholders churning because renewal reminders were sent too late",
      "Agents mixing up motor, health, and term life policy pipelines",
      "Clients demanding real-time claim status updates via WhatsApp",
    ],
    workflowFeatures: [
      {
        title: "Automated Policy Expiry & Renewal Alerts",
        description: "Trigger WhatsApp alerts with renewed premium quotes 45, 30, 15, and 3 days before motor or health policy expiration.",
      },
      {
        title: "Multi-Category Insurance Pipelines",
        description: "Dedicated Kanban boards tailored for Motor Insurance, Health Floaters, Term Life, and Commercial Fire coverage.",
      },
      {
        title: "Instant Claim Status Tracker",
        description: "Keep policyholders updated on TPA approval, surveyor visits, and hospital cashless approvals via WhatsApp.",
      },
    ],
    templates: ["Motor Policy Renewal Quotation.pdf", "Health Insurance Premium Receipt", "Claim Cashless Approval Status"],
    kpiStats: [
      { metric: "+52%", label: "Policy Renewal Rate" },
      { metric: "15,000+", label: "Monthly Renewals" },
      { metric: "0", label: "Lapsed Policies" },
    ],
  },
];

const TEAM_SIZES = ["1 - 5 members", "6 - 15 members", "16 - 50 members", "50+ members"];

export default function IndustryDetailsPage() {
  const [activeSectionId, setActiveSectionId] = useState<string>(INDUSTRY_DETAILS[0].id);

  // Demo Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2 | 3>(1);
  const [selectedSector, setSelectedSector] = useState("");

  // Form Data State
  const [teamSize, setTeamSize] = useState("");
  const [formData, setFormData] = useState({
    companyName: "",
    email: "",
    phone: "",
  });

  const openDemoModal = (sectorTitle: string) => {
    setSelectedSector(sectorTitle);
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
    setActiveSectionId(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Listen to URL hash on initial load & hash changes
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash) {
        setActiveSectionId(hash);
        const element = document.getElementById(hash);
        if (element) {
          setTimeout(() => {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 150);
        }
      }
    };

    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF9FF] text-slate-900 font-sans relative">
      <Navbar />

      {/* Hero Header Section */}
      <section className="pt-12 pb-8 px-6 max-w-7xl mx-auto text-center space-y-6">
        <div className="flex items-center justify-center gap-2 text-xs font-black text-[#6C5CE7] bg-indigo-50 border border-indigo-100 py-1.5 px-4 rounded-full w-fit mx-auto uppercase tracking-widest">
          <Sparkles className="w-3.5 h-3.5" /> Comprehensive Industry Guides &amp; Solutions
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight max-w-4xl mx-auto">
          Tailored Telecalling &amp; CRM Workflows for Every Indian Industry
        </h1>
        <p className="text-slate-600 text-sm sm:text-base font-medium max-w-3xl mx-auto leading-relaxed">
          Discover how TeleCRM eliminates lead leakage, accelerates agent call volumes, and automates WhatsApp communications with industry-specific templates and integrations.
        </p>

        <div className="pt-2 flex items-center justify-center gap-3">
          <Link
            href="/industries"
            className="inline-flex items-center gap-2 text-xs font-bold text-[#6C5CE7] bg-white border border-indigo-200 px-4 py-2.5 rounded-xl hover:bg-indigo-50 transition shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Industries Overview
          </Link>
        </div>
      </section>

      {/* Sticky Quick-Jump Filter Bar */}
      <section className="sticky top-20 z-40 bg-white/90 backdrop-blur-md border-y border-slate-200/80 py-3 px-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
          <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider shrink-0 mr-2">
            Jump to Sector:
          </span>
          {INDUSTRY_DETAILS.map((ind) => {
            const isActive = activeSectionId === ind.id;
            return (
              <button
                key={ind.id}
                onClick={() => scrollToIndustry(ind.id)}
                className={`text-xs font-bold py-2 px-3.5 rounded-xl transition shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? "bg-[#6C5CE7] text-white shadow-md shadow-indigo-500/20"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                <ind.icon className="w-3.5 h-3.5" />
                <span>{ind.title}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* All Industry Comprehensive Details List */}
      <main className="max-w-6xl mx-auto px-6 py-12 space-y-20">
        {INDUSTRY_DETAILS.map((industry, index) => {
          const IconComponent = industry.icon;
          return (
            <article
              key={industry.id}
              id={industry.id}
              className="scroll-mt-36 bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-12 shadow-sm hover:shadow-xl transition-all duration-300 space-y-8"
            >
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 pb-8">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-[#6C5CE7] shadow-inner">
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#6C5CE7]">
                        {industry.badge}
                      </span>
                      <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                        {industry.title}
                      </h2>
                    </div>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800 pt-2">
                    {industry.heroHeading}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed max-w-3xl">
                    {industry.overview}
                  </p>
                </div>

                <div className="shrink-0 flex flex-col gap-2.5 sm:w-56">
                  <button
                    onClick={() => openDemoModal(industry.title)}
                    className="w-full bg-[#6C5CE7] hover:bg-[#5A4AD4] text-white font-black py-3.5 px-5 rounded-2xl text-xs shadow-lg shadow-indigo-500/20 transition cursor-pointer active:scale-95 text-center flex items-center justify-center gap-2"
                  >
                    <span>Request Sector Demo</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <span className="text-[10px] text-center text-slate-400 font-medium">
                    ⚡ 15-Min Live Customized Walkthrough
                  </span>
                </div>
              </div>

              {/* KPI Impact Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {industry.kpiStats.map((stat, i) => (
                  <div
                    key={i}
                    className="bg-indigo-50/50 border border-indigo-100/80 rounded-2xl p-4 text-center space-y-0.5"
                  >
                    <span className="text-2xl sm:text-3xl font-black text-[#6C5CE7] font-mono">
                      {stat.metric}
                    </span>
                    <p className="text-xs font-bold text-slate-700">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* 2 Column Layout: Challenges Solved vs Workflows */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-2">
                {/* Left: Key Industry Challenges Solved */}
                <div className="bg-[#FAF9FF] rounded-2xl border border-indigo-100/60 p-6 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-rose-600">
                    <Shield className="w-4 h-4" /> Major Roadblocks Solved
                  </div>
                  <ul className="space-y-3">
                    {industry.keyChallenges.map((challenge, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs text-slate-700 font-semibold leading-relaxed">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{challenge}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Right: Pre-Configured WhatsApp Templates */}
                <div className="bg-emerald-50/40 rounded-2xl border border-emerald-100/80 p-6 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-700">
                    <MessageSquare className="w-4 h-4" /> Pre-Configured WhatsApp Templates
                  </div>
                  <ul className="space-y-2.5">
                    {industry.templates.map((tpl, i) => (
                      <li
                        key={i}
                        className="bg-white p-3 rounded-xl border border-emerald-200/60 text-xs font-bold text-slate-800 flex items-center justify-between shadow-sm"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">{tpl}</span>
                        </div>
                        <span className="text-[9px] bg-emerald-100 text-emerald-700 font-black px-2 py-0.5 rounded-full shrink-0">
                          1-Click
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Workflows & Automations */}
              <div className="space-y-4 pt-2">
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#6C5CE7]" /> Pre-Built Automations &amp; Telephony for {industry.title}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {industry.workflowFeatures.map((wf, i) => (
                    <div
                      key={i}
                      className="bg-slate-50 border border-slate-200/70 p-5 rounded-2xl space-y-2"
                    >
                      <span className="text-[10px] font-mono font-black text-[#6C5CE7] bg-white border border-indigo-100 px-2 py-0.5 rounded-md inline-block">
                        Workflow #{i + 1}
                      </span>
                      <h5 className="text-xs font-black text-slate-900">{wf.title}</h5>
                      <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                        {wf.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </main>

      {/* Bottom CTA Banner */}
      <section className="py-16 px-6 max-w-5xl mx-auto text-center space-y-6">
        <div className="bg-gradient-to-tr from-[#1A0B3E] to-[#2B1055] rounded-3xl p-10 sm:p-14 text-white shadow-2xl space-y-6">
          <span className="text-xs font-black uppercase tracking-widest text-indigo-300">
            EXPERIENCE TELECRM FOR YOUR INDUSTRY
          </span>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight max-w-2xl mx-auto">
            Ready to scale your sales team with industry-proven workflows?
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed">
            Schedule a 15-minute live consultation. Our sales engineers will set up your lead integrations, calling queues, and WhatsApp templates for free.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => openDemoModal("General Industry Consultation")}
              className="bg-[#6C5CE7] hover:bg-[#5A4AD4] text-white font-extrabold py-4 px-8 rounded-2xl text-sm shadow-xl shadow-indigo-500/20 transition cursor-pointer active:scale-95"
            >
              Book 15-Min Live Demo
            </button>
            <Link
              href="/industries"
              className="bg-white/10 hover:bg-white/20 text-white font-bold py-4 px-6 rounded-2xl text-sm border border-white/15 transition flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> View Sector Overview
            </Link>
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
                    Step 1 of 2 • {selectedSector}
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
                    Our sales engineer will schedule a demo tailored for {selectedSector}.
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
                      placeholder="e.g. Acme Realty Solutions"
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
                      Phone / WhatsApp Number
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
                      className="w-1/3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="w-2/3 bg-[#6C5CE7] hover:bg-[#5A4AD4] text-white font-bold py-2.5 rounded-xl text-xs transition shadow-md cursor-pointer active:scale-95"
                    >
                      Confirm Booking
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* STEP 3: Success Confirmation */}
            {modalStep === 3 && (
              <div className="space-y-5 text-center py-4 animate-in zoom-in-95 duration-300">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-slate-900">
                    Demo Scheduled!
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
                    Thank you! Our {selectedSector} specialist will connect with{" "}
                    <span className="font-bold text-slate-800">{formData.companyName}</span> at{" "}
                    <span className="font-bold text-slate-800">{formData.phone}</span> shortly.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={closeModal}
                    className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl text-xs hover:bg-slate-800 transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
