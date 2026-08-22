"use client";

import { useState, useEffect, useRef } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  PhoneCall,
  Trophy,
  Megaphone,
  Bell,
  BarChart3,
  Zap,
  Mic,
  Users,
  Edit3,
  FileSpreadsheet,
  Share2,
  Webhook,
  GitFork,
  MessageSquare,
  Smartphone,
  Mail,
  BellRing,
  CreditCard,
  Clock,
  CheckCircle2,
  Check,
  Trash2,
  X,
  CheckCircle,
  Building2Icon,
  Phone,
  FileText,
} from "lucide-react";

interface Feature {
  id: string;
  title: string;
  category: string;
  badge: string;
  heading: string;
  subheading: string;
  points: string[];
  icon: any;
  mockup: {
    callerName: string;
    phone: string;
    status: string;
  };
}

const ALL_FEATURES: Feature[] = [
  {
    id: "1-click-dialer",
    title: "1-Click Dialer",
    category: "CALLING",
    badge: "CALLING: ACCELERATE SALES CALLS",
    heading: "1-Click Dialer",
    subheading: "Dial prospects instantly from web or mobile with zero delay",
    points: [
      "Initiate calls directly from desktop CRM interface",
      "Auto-dial lead queues seamlessly without manual entry",
      "Seamless phone bridging for high outbound call volume",
    ],
    icon: PhoneCall,
    mockup: { callerName: "Md Minhaj", phone: "7******254", status: "Ready to Call" },
  },
  {
    id: "leaderboard-report",
    title: "Leaderboard Report",
    category: "ANALYTICS",
    badge: "ANALYTICS: GAMIFY TEAM PERFORMANCE",
    heading: "Leaderboard Report",
    subheading: "Real-time visibility into sales reps' performance metrics",
    points: [
      "Track top performing agents by calls and deals closed",
      "Live rankings updated automatically across teams",
      "Boost motivation with dynamic goal visualizers",
    ],
    icon: Trophy,
    mockup: { callerName: "Sales Team", phone: "Rank #1: Alex", status: "142 Calls Today" },
  },
  {
    id: "whatsapp-broadcast-marketing",
    title: "WhatsApp Broadcast Marketing",
    category: "MARKETING",
    badge: "MARKETING: MASS ENGAGEMENT ON WHATSAPP",
    heading: "WhatsApp Broadcast Marketing",
    subheading: "Send official targeted WhatsApp campaigns at scale",
    points: [
      "Reach thousands of leads with personalized templates",
      "Track message read rates and responses instantly",
      "Automate follow-up sequences for broadcast replies",
    ],
    icon: Megaphone,
    mockup: { callerName: "Promo Campaign", phone: "500 Recipients", status: "Broadcast Sent" },
  },
  {
    id: "call-reminders",
    title: "Call Reminders",
    category: "PRODUCTIVITY",
    badge: "PRODUCTIVITY: NEVER MISS A FOLLOW-UP",
    heading: "Call Reminders",
    subheading: "Automated alert system for timely lead follow-ups",
    points: [
      "Set schedule reminders right from lead interaction cards",
      "Receive pop-up and push notifications before call time",
      "Auto-reschedule missed follow-ups with one tap",
    ],
    icon: Bell,
    mockup: { callerName: "Priya Sharma", phone: "Reminder 2:30 PM", status: "Pending Call" },
  },
  {
    id: "sales-report",
    title: "Sales Report",
    category: "ANALYTICS",
    badge: "ANALYTICS: DEEP PIPELINE INSIGHTS",
    heading: "Sales Report",
    subheading: "Comprehensive reporting on conversion rates & revenue",
    points: [
      "Analyze full sales funnel stage transitions",
      "Export revenue forecasts and custom date-range reports",
      "Filter performance by campaign, source, or agent",
    ],
    icon: BarChart3,
    mockup: { callerName: "Monthly Q3", phone: "$48,500 Revenue", status: "Report Generated" },
  },
  {
    id: "smart-workflows",
    title: "Smart Workflows",
    category: "AUTOMATION",
    badge: "AUTOMATION: AUTOPILOT SALES PROCESSES",
    heading: "Smart Workflows",
    subheading: "Automate repetitive lead assignments and trigger actions",
    points: [
      "Auto-assign inbound leads based on rules or round-robin",
      "Trigger instant automated SMS/WhatsApp upon lead signup",
      "Escalate stagnant leads automatically to senior managers",
    ],
    icon: Zap,
    mockup: { callerName: "Workflow #04", phone: "Auto-Assignment", status: "Active Trigger" },
  },
  {
    id: "automatic-call-recording",
    title: "Automatic Call Recording",
    category: "CALLING",
    badge: "CALLING: AUDIT & TRAIN SALES TEAMS",
    heading: "Automatic Call Recording",
    subheading: "Record and store calls in cloud lead timelines automatically",
    points: [
      "Cloud recording for incoming and outgoing sales calls",
      "Listen to audio logs directly within the CRM timeline",
      "Quality assurance for team training and compliance",
    ],
    icon: Mic,
    mockup: { callerName: "Ananya Patel", phone: "03:45 Duration", status: "Audio Saved" },
  },
  {
    id: "agents-report",
    title: "Agents Report",
    category: "ANALYTICS",
    badge: "ANALYTICS: INDIVIDUAL AGENT METRICS",
    heading: "Agents Report",
    subheading: "Granular breakdown of call duration, count, and idle time",
    points: [
      "Track individual talk time, total calls, and response speed",
      "Identify high performers and agents needing assistance",
      "Daily and weekly automated summary scorecards",
    ],
    icon: Users,
    mockup: { callerName: "Agent Roster", phone: "8 Active Agents", status: "Metrics Synced" },
  },
  {
    id: "bulk-edit",
    title: "Bulk Edit",
    category: "MANAGEMENT",
    badge: "MANAGEMENT: EFFORTLESS LEAD UPDATES",
    heading: "Bulk Edit",
    subheading: "Update status, tags, and assignments for multiple leads at once",
    points: [
      "Batch update hundreds of leads in seconds",
      "Re-assign lead lists across sales reps with 1 click",
      "Apply custom tags and campaign labels in bulk",
    ],
    icon: Edit3,
    mockup: { callerName: "Batch #102", phone: "250 Leads", status: "Updated Status" },
  },
  {
    id: "excel-import",
    title: "Excel Import",
    category: "INTEGRATION",
    badge: "INTEGRATION: FAST DATA MIGRATION",
    heading: "Excel Import",
    subheading: "Import CSV and Excel spreadsheets into your CRM seamlessly",
    points: [
      "Map custom columns dynamically to CRM fields",
      "Automatic duplicate detection during import",
      "Import thousands of lead records in seconds",
    ],
    icon: FileSpreadsheet,
    mockup: { callerName: "Leads_Q3.xlsx", phone: "1,200 Rows", status: "Import Done" },
  },
  {
    id: "fb-lead-capture",
    title: "FB Lead Capture",
    category: "INTEGRATION",
    badge: "INTEGRATION: INSTANT SOCIAL SYNC",
    heading: "FB Lead Capture",
    subheading: "Sync Facebook Lead Ads instantly into CRM without delays",
    points: [
      "Real-time webhook sync from Meta Lead Forms",
      "Immediate auto-assignment to sales agents",
      "Trigger instant welcome messages to new ad leads",
    ],
    icon: Share2,
    mockup: { callerName: "FB Campaign Ad", phone: "Meta Lead Gen", status: "Synced Instant" },
  },
  {
    id: "custom-api-integration",
    title: "Custom API Integration",
    category: "DEVELOPER",
    badge: "DEVELOPER: CONNECT ANY SOFTWARE",
    heading: "Custom API Integration",
    subheading: "REST API endpoints to connect custom platforms & databases",
    points: [
      "Secure webhooks and RESTful API access",
      "Sync customer data with ERPs and custom backends",
      "Flexible payload handling for custom events",
    ],
    icon: Webhook,
    mockup: { callerName: "API Key #1", phone: "Endpoint /v1/leads", status: "200 OK" },
  },
  {
    id: "lead-routing",
    title: "Lead Routing",
    category: "AUTOMATION",
    badge: "AUTOMATION: SMART LEAD DISTRIBUTION",
    heading: "Lead Routing",
    subheading: "Route leads dynamically based on location, language, or logic",
    points: [
      "Round-robin, territory-based, or skill-based routing",
      "Ensure fast response time by assigning online reps",
      "Fallback logic for unassigned leads",
    ],
    icon: GitFork,
    mockup: { callerName: "Routing Engine", phone: "Rule: Hyd Tech", status: "Assigned Rep A" },
  },
  {
    id: "whatsapp-alerts",
    title: "WhatsApp Alerts",
    category: "COMMUNICATION",
    badge: "COMMUNICATION: REAL-TIME MESSAGING",
    heading: "WhatsApp Alerts",
    subheading: "Send automated status updates & notifications to clients",
    points: [
      "Send order confirmations and deal status alerts",
      "Instant WhatsApp notifications for assigned tasks",
      "Higher open rates compared to email alerts",
    ],
    icon: MessageSquare,
    mockup: { callerName: "Alert System", phone: "Template #12", status: "Delivered" },
  },
  {
    id: "1-click-whatsapp",
    title: "1-Click WhatsApp",
    category: "COMMUNICATION",
    badge: "COMMUNICATION: INSTANT CHAT",
    heading: "1-Click WhatsApp",
    subheading: "Start WhatsApp conversations without saving phone contacts",
    points: [
      "Direct open in WhatsApp Web or app",
      "Pre-filled chat templates for speedy messaging",
      "Log WhatsApp conversations on lead timeline",
    ],
    icon: Smartphone,
    mockup: { callerName: "Vikas Verma", phone: "6******443", status: "WhatsApp Opened" },
  },
  {
    id: "1-click-sms-email",
    title: "1-Click SMS/Email",
    category: "COMMUNICATION",
    badge: "COMMUNICATION: OMNICHANNEL MESSAGING",
    heading: "1-Click SMS/Email",
    subheading: "Send templated emails or SMS messages instantly from CRM",
    points: [
      "Pre-approved SMS templates & email blueprints",
      "Track message delivery status inside lead profile",
      "Omnichannel reach for leads not active on WhatsApp",
    ],
    icon: Mail,
    mockup: { callerName: "Client Update", phone: "SMS & Email", status: "Sent Dual" },
  },
  {
    id: "push-notification",
    title: "Push Notification",
    category: "PRODUCTIVITY",
    badge: "PRODUCTIVITY: MOBILE ALERTS",
    heading: "Push Notification",
    subheading: "Instant mobile push alerts for incoming leads & reminders",
    points: [
      "Real-time mobile alerts when new leads are assigned",
      "Never miss follow-up calls while on the go",
      "Customizable notification preferences per agent",
    ],
    icon: BellRing,
    mockup: { callerName: "System Alert", phone: "New Lead Assigned", status: "Notified Mobile" },
  },
  {
    id: "payment-creation",
    title: "Payment Creation",
    category: "SALES",
    badge: "SALES: CLOSE DEALS FASTER",
    heading: "Payment Creation",
    subheading: "Generate payment links directly inside the chat/lead card",
    points: [
      "Create UPI / payment links in 1 click",
      "Share payment links via WhatsApp or SMS",
      "Auto-update lead status to Closed Won upon payment receipt",
    ],
    icon: CreditCard,
    mockup: { callerName: "Invoice #901", phone: "₹12,499 Total", status: "Link Generated" },
  },
  {
    id: "hour-by-hour-report",
    title: "Hour-by-hour Report",
    category: "ANALYTICS",
    badge: "ANALYTICS: HOURLY ACTIVITY METRICS",
    heading: "Hour-by-hour Report",
    subheading: "Track peak call hours and team output by the hour",
    points: [
      "Hourly breakdown of total calls, connect rate, and output",
      "Identify peak productivity hours during the workday",
      "Optimize agent shifts based on lead activity trends",
    ],
    icon: Clock,
    mockup: { callerName: "Hourly Log", phone: "Peak: 2 PM - 3 PM", status: "Chart Updated" },
  },
];

function FeatureVisualMockup({ feature }: { feature: Feature }) {
  const isCalling =
    feature.category === "CALLING" ||
    feature.id.includes("dialer") ||
    feature.id.includes("recording") ||
    feature.id.includes("reminders");
  const isWhatsApp =
    feature.category === "MARKETING" ||
    feature.id.includes("whatsapp") ||
    feature.id.includes("sms") ||
    feature.id.includes("notification");
  const isAnalytics =
    feature.category === "ANALYTICS" ||
    feature.id.includes("report") ||
    feature.id.includes("leaderboard") ||
    feature.id.includes("payment");
  const isAutomation =
    feature.category === "AUTOMATION" ||
    feature.id.includes("workflow") ||
    feature.id.includes("lead") ||
    feature.id.includes("api") ||
    feature.id.includes("excel") ||
    feature.id.includes("fb");

  const backdropGradient = isWhatsApp
    ? "from-emerald-200/50 via-teal-100/40 to-green-200/40"
    : isAnalytics
    ? "from-amber-200/50 via-orange-100/40 to-yellow-200/40"
    : isAutomation
    ? "from-cyan-200/50 via-sky-100/40 to-blue-200/40"
    : "from-purple-200/50 via-indigo-100/40 to-pink-200/40";

  return (
    <div className="relative flex items-center justify-center p-2 sm:p-4">
      {/* 1. Ambient Backdrop Blob */}
      <div
        className={`absolute -inset-4 bg-gradient-to-tr ${backdropGradient} rounded-full blur-2xl -z-10 pointer-events-none transform -rotate-6`}
      />

      {/* 4A. Floating Popover Badge - Top Right */}
      <div className="absolute -top-2 -right-2 sm:-right-4 bg-white/95 backdrop-blur-md shadow-xl border border-slate-100/90 rounded-2xl p-2 sm:p-2.5 text-[10px] font-extrabold text-slate-800 flex items-center gap-1.5 z-20 shadow-indigo-950/10 animate-in fade-in">
        {isWhatsApp ? (
          <>
            <span className="flex size-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-emerald-600 font-black">Official Cloud API</span>
          </>
        ) : isAnalytics ? (
          <>
            <span className="text-amber-500 font-black">🏆 Rank #1</span>
            <span className="text-slate-600 font-mono">142 Calls</span>
          </>
        ) : isAutomation ? (
          <>
            <span className="text-[#6C5CE7] font-black">⚡ Instant Sync</span>
            <span className="text-slate-600 font-mono">0.2s</span>
          </>
        ) : (
          <>
            <span className="flex size-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-emerald-600 font-black">Live Dialing</span>
          </>
        )}
      </div>

      {/* 2. Device Bezel (Phone Frame) */}
      <div className="relative w-60 sm:w-68 rounded-[2.75rem] border-[6px] border-slate-900 bg-slate-950 shadow-2xl p-3.5 space-y-2.5 z-10 overflow-hidden text-white">
        {/* Inner Camera Pill / Speaker Notch */}
        <div className="w-20 h-3.5 bg-slate-900 rounded-b-xl mx-auto -mt-3.5 mb-2 flex items-center justify-center">
          <div className="size-1.5 rounded-full bg-slate-800" />
        </div>

        {/* 3. Micro-UI Screen Content */}
        {isWhatsApp ? (
          /* WhatsApp Micro-UI Screen */
          <div className="space-y-2.5 pt-1">
            {/* Header */}
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <div className="size-7 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px] font-black">
                W
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold truncate text-white">WhatsApp Broadcast</p>
                <p className="text-[9px] text-emerald-400 font-medium font-mono">500 Leads • 98.4% Delivered</p>
              </div>
            </div>

            {/* Chat Bubble with Brochure */}
            <div className="bg-emerald-950/60 border border-emerald-500/20 rounded-2xl rounded-tl-none p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-300 font-semibold">
                <FileText className="size-3 text-emerald-400" />
                <span className="truncate">Bandra_3BHK_Brochure.pdf</span>
              </div>
              <p className="text-[10px] text-slate-200 leading-snug">
                Hi {feature.mockup.callerName || "there"}! Here is your requested price list.
              </p>
              <div className="flex items-center justify-end gap-1 text-[8px] text-emerald-400 font-mono">
                <span>12:45 PM</span>
                <span>✓✓</span>
              </div>
            </div>

            {/* Reply pill */}
            <div className="bg-slate-900 rounded-xl p-2 text-[9px] text-slate-300 flex items-center justify-between border border-slate-800 font-medium">
              <span className="truncate">&quot;Interested! Call me at 4 PM&quot;</span>
              <span className="size-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
            </div>
          </div>
        ) : isAnalytics ? (
          /* Leaderboard & Reports Micro-UI Screen */
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-[10px]">
              <span className="font-extrabold text-amber-400 flex items-center gap-1">
                <Trophy className="size-3 text-amber-400" /> {feature.heading}
              </span>
              <span className="text-[9px] text-slate-400 font-mono">Today</span>
            </div>

            {/* Top 3 Caller Cards */}
            <div className="space-y-1">
              {[
                { rank: "🥇", name: "Aarav Sharma", score: "142 Calls", rev: "₹1.35L" },
                { rank: "🥈", name: "Priya Patel", score: "128 Calls", rev: "₹98K" },
                { rank: "🥉", name: "Rohan Verma", score: "94 Calls", rev: "₹84K" },
              ].map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[10px]"
                >
                  <span className="font-bold flex items-center gap-1 text-[10px]">
                    <span>{r.rank}</span>
                    <span className="text-white truncate max-w-[90px]">{r.name}</span>
                  </span>
                  <span className="text-emerald-400 font-mono font-bold text-[9px]">{r.score}</span>
                </div>
              ))}
            </div>

            {/* Shift Target Bar */}
            <div className="pt-1">
              <div className="flex justify-between text-[9px] text-slate-400 mb-1 font-medium">
                <span>Daily Quota (500 Calls)</span>
                <span className="text-emerald-400 font-bold font-mono">89%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#6C5CE7] to-emerald-400 rounded-full w-[89%]" />
              </div>
            </div>
          </div>
        ) : isAutomation ? (
          /* Smart Workflows & Lead Routing Micro-UI Screen */
          <div className="space-y-2 pt-1">
            <div className="text-[10px] font-bold text-[#6C5CE7] flex items-center gap-1 pb-1 border-b border-slate-800">
              <Zap className="size-3 text-[#6C5CE7]" /> {feature.heading}
            </div>

            {/* Node 1: Trigger */}
            <div className="bg-slate-900 p-2 rounded-xl border border-slate-800 text-[10px] space-y-0.5">
              <div className="text-slate-400 text-[8px] uppercase font-bold">1. Ingest Trigger</div>
              <p className="text-white font-semibold truncate">Meta Lead Ad Form Ingest</p>
            </div>

            {/* Connector */}
            <div className="text-center text-[#6C5CE7] text-[9px] font-bold font-mono">↓ 0.2s sync</div>

            {/* Node 2: Action */}
            <div className="bg-indigo-950/60 p-2 rounded-xl border border-indigo-500/30 text-[10px] space-y-0.5">
              <div className="text-indigo-400 text-[8px] uppercase font-bold">2. Auto Allocation</div>
              <p className="text-indigo-200 font-semibold truncate">Round-Robin ➔ Agent Desk</p>
            </div>
          </div>
        ) : (
          /* 1-Click Dialer & Live Calling Micro-UI Screen */
          <div className="space-y-2.5 pt-1 text-center">
            <div className="space-y-0.5">
              <div className="size-10 rounded-full bg-gradient-to-tr from-[#6C5CE7] to-indigo-400 flex items-center justify-center text-white text-xs font-black mx-auto shadow-md">
                AS
              </div>
              <h5 className="text-xs font-black text-white truncate">{feature.mockup.callerName}</h5>
              <p className="text-[10px] font-mono text-slate-400">{feature.mockup.phone}</p>
            </div>

            {/* Audio Waveform Simulator */}
            <div className="flex items-center justify-center gap-1 h-5">
              {[4, 8, 14, 18, 10, 16, 20, 12, 6, 14, 8].map((h, i) => (
                <span
                  key={i}
                  className="w-1 bg-emerald-400 rounded-full animate-pulse"
                  style={{ height: `${h}px`, animationDelay: `${i * 100}ms` }}
                />
              ))}
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[9px] font-mono text-emerald-400 bg-emerald-950/40 py-0.5 px-2.5 rounded-full border border-emerald-500/20 w-fit mx-auto">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>02:45 In Call</span>
            </div>

            {/* 1-Tap Outcome Buttons */}
            <div className="grid grid-cols-3 gap-1 pt-1">
              <div className="bg-emerald-600/30 border border-emerald-500/30 p-1.5 rounded-lg text-emerald-300 text-[8px] font-bold text-center">
                Connected
              </div>
              <div className="bg-amber-600/30 border border-amber-500/30 p-1.5 rounded-lg text-amber-300 text-[8px] font-bold text-center">
                Busy
              </div>
              <div className="bg-[#6C5CE7]/30 border border-indigo-500/30 p-1.5 rounded-lg text-indigo-300 text-[8px] font-bold text-center">
                WhatsApp
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4B. Floating Popover Badge - Bottom Left */}
      <div className="absolute -bottom-2 -left-2 sm:-left-4 bg-white/95 backdrop-blur-md shadow-xl border border-slate-100/90 rounded-2xl p-2 sm:p-2.5 text-[10px] font-extrabold text-slate-800 flex items-center gap-1.5 z-20 shadow-indigo-950/10 animate-in fade-in">
        {isWhatsApp ? (
          <>
            <span className="text-emerald-600 font-black">💬 WhatsApp</span>
            <span className="text-slate-600">Brochure Sent</span>
          </>
        ) : isAnalytics ? (
          <>
            <span className="text-emerald-600 font-black">📈 ₹4.85L</span>
            <span className="text-slate-600">Closed</span>
          </>
        ) : isAutomation ? (
          <>
            <span className="text-cyan-600 font-black">🎯 Round-Robin</span>
            <span className="text-slate-600">Assigned</span>
          </>
        ) : (
          <>
            <span className="text-[#6C5CE7] font-black">🎙️ HD Cloud</span>
            <span className="text-slate-600">Audio Synced</span>
          </>
        )}
      </div>
    </div>
  );
}

const TEAM_SIZES = ["1 - 5 members", "6 - 15 members", "16 - 50 members", "50+ members"];

export default function FeaturesPage() {
  const [selectedRequirements, setSelectedRequirements] = useState<string[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>(ALL_FEATURES[0].id);
  const isClickScrolling = useRef<boolean>(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalStep, setModalStep] = useState<1 | 2 | 3>(1);
  const [selectedFeature, setSelectedFeature] = useState<string>("");

  // Form State
  const [teamSize, setTeamSize] = useState<string>("");
  const [formData, setFormData] = useState({
    companyName: "",
    email: "",
    phone: "",
  });

  const openDemoModal = (featureTitle: string) => {
    setSelectedFeature(featureTitle);
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

  const scrollToFeature = (id: string) => {
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

  // IntersectionObserver to auto-highlight sidebar button on scroll
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

    ALL_FEATURES.forEach((f) => {
      const el = document.getElementById(f.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleHashScroll = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash) {
        scrollToFeature(hash);
      }
    };

    handleHashScroll();
    window.addEventListener("hashchange", handleHashScroll);
    return () => window.removeEventListener("hashchange", handleHashScroll);
  }, []);

  const toggleRequirement = (id: string) => {
    setSelectedRequirements((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const removeRequirement = (id: string) => {
    setSelectedRequirements((prev) => prev.filter((item) => item !== id));
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans relative">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            TeleCRM Features.
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm">
            Select features to build your requirement checklist or preview features.
          </p>
        </div>

        {/* Main 3-Column / Grid Layout */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left Sticky Features Navigation Sidebar */}
          <aside className="w-full lg:w-64 lg:sticky lg:top-24 z-40 bg-white/80 backdrop-blur-md p-3 rounded-2xl border border-slate-200/80 shadow-sm shrink-0">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider px-3 pb-2 hidden lg:block">
              Features
            </h3>
            <div className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-y-auto max-h-[calc(100vh-140px)] scrollbar-none">
              {ALL_FEATURES.map((f) => {
                const IconComponent = f.icon;
                const isActive = activeTabId === f.id;
                const isChecked = selectedRequirements.includes(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() => scrollToFeature(f.id)}
                    className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 lg:shrink text-left border lg:border-none ${
                      isActive
                        ? "bg-[#6C5CE7] text-white shadow-sm"
                        : "bg-slate-50 lg:bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <IconComponent
                        className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : "text-[#6C5CE7]"}`}
                      />
                      <span className="truncate">{f.title}</span>
                    </div>

                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRequirement(f.id);
                      }}
                      className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition cursor-pointer ${
                        isChecked
                          ? isActive
                            ? "bg-white text-[#6C5CE7]"
                            : "bg-[#6C5CE7] text-white"
                          : isActive
                          ? "bg-indigo-500 text-white"
                          : "bg-slate-200 text-slate-600 hover:bg-[#6C5CE7] hover:text-white"
                      }`}
                    >
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Center Features Content List */}
          <div className="flex-1 w-full space-y-10 min-w-0">
            {ALL_FEATURES.map((feature) => {
              const isChecked = selectedRequirements.includes(feature.id);
              return (
                <div
                  key={feature.id}
                  id={feature.id}
                  className="scroll-mt-28 space-y-2"
                >
                  <span className="text-[11px] font-black tracking-widest text-slate-400 uppercase">
                    {feature.badge}
                  </span>

                  <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xl relative overflow-hidden min-h-[380px] flex flex-col justify-between transition hover:shadow-2xl">
                    <button
                      onClick={() => toggleRequirement(feature.id)}
                      title="Add to requirements"
                      className={`absolute top-6 right-6 w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer shadow-sm ${
                        isChecked
                          ? "bg-[#6C5CE7] text-white"
                          : "bg-indigo-50 text-indigo-400 border border-indigo-200 hover:bg-indigo-100"
                      }`}
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                    </button>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                      <div className="space-y-5">
                        <div className="space-y-1.5">
                          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                            {feature.heading}
                          </h2>
                          <p className="text-sm font-bold text-[#6C5CE7]">
                            {feature.subheading}
                          </p>
                        </div>

                        <ul className="space-y-2.5">
                          {feature.points.map((pt, idx) => (
                            <li
                              key={idx}
                              className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-600 font-medium leading-relaxed"
                            >
                              <CheckCircle2 className="w-4 h-4 text-[#6C5CE7] mt-0.5 shrink-0" />
                              <span>{pt}</span>
                            </li>
                          ))}
                        </ul>

                        <button
                          onClick={() => openDemoModal(feature.title)}
                          className="bg-[#6C5CE7] hover:bg-[#5A4AD4] text-white font-bold py-3 px-6 rounded-xl text-xs transition shadow-lg shadow-indigo-500/20 cursor-pointer active:scale-95"
                        >
                          Request a demo
                        </button>
                      </div>

                      <div className="flex justify-center items-center">
                        <FeatureVisualMockup feature={feature} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Sticky Requirements Panel */}
          <div className="w-full lg:w-72 bg-white rounded-3xl border border-slate-200/90 p-5 shadow-sm space-y-4 lg:sticky lg:top-24 shrink-0">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-xs sm:text-sm text-slate-900">
                My Requirements ({selectedRequirements.length})
              </h3>
              {selectedRequirements.length > 0 && (
                <button
                  onClick={() => setSelectedRequirements([])}
                  className="text-[10px] font-bold text-red-500 hover:underline cursor-pointer"
                >
                  Clear all
                </button>
              )}
            </div>

            {selectedRequirements.length === 0 ? (
              <div className="text-center py-8 space-y-1">
                <p className="text-xs text-slate-400 font-medium leading-relaxed px-2">
                  No Requirements present, try to Checkmark a feature
                </p>
              </div>
            ) : (
              <ul className="space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-none">
                {selectedRequirements.map((reqId) => {
                  const item = ALL_FEATURES.find((f) => f.id === reqId);
                  return (
                    <li
                      key={reqId}
                      className="flex justify-between items-center p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-800 animate-in fade-in"
                    >
                      <div className="flex items-center gap-2 truncate pr-1">
                        <Check className="w-3.5 h-3.5 text-[#6C5CE7] stroke-[3] shrink-0" />
                        <span className="truncate">{item?.title}</span>
                      </div>
                      <button
                        onClick={() => removeRequirement(reqId)}
                        className="text-slate-400 hover:text-red-500 transition cursor-pointer shrink-0 p-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {selectedRequirements.length > 0 && (
              <button
                onClick={() => openDemoModal("Selected Custom Requirements")}
                className="w-full bg-[#6C5CE7] hover:bg-[#5A4AD4] text-white font-bold py-3 rounded-xl text-xs transition shadow-md cursor-pointer mt-2"
              >
                Submit Requirements ({selectedRequirements.length})
              </button>
            )}
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
                    Step 1 of 2 • {selectedFeature}
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
                    Thank you, <span className="font-extrabold text-slate-900">{formData.companyName}</span>! Our feature specialist will contact you shortly at{" "}
                    <span className="font-extrabold text-slate-900">{formData.email}</span> /{" "}
                    <span className="font-extrabold text-slate-900">{formData.phone}</span> to schedule your demo.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-left text-[11px] space-y-1 text-slate-600">
                  <div>
                    <span className="font-bold text-slate-800">Feature:</span> {selectedFeature}
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
