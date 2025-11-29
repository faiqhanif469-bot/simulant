"use client";
import { useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useAuth, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

const PERSONAS = [
  { 
    id: "jake", 
    name: "Speed Tester", 
    role: "Performance Analysis",
    desc: "Measures load times, identifies bottlenecks, tests under slow network conditions",
    metrics: ["Time to Interactive", "First Contentful Paint", "Core Web Vitals"]
  },
  { 
    id: "grandma", 
    name: "Accessibility Auditor", 
    role: "UX & Accessibility",
    desc: "Tests for WCAG compliance, screen reader compatibility, cognitive load issues",
    metrics: ["ARIA Labels", "Color Contrast", "Keyboard Navigation"]
  },
  { 
    id: "alex", 
    name: "Security Scanner", 
    role: "Vulnerability Detection",
    desc: "Probes for XSS, CSRF, injection attacks, authentication bypasses",
    metrics: ["Input Validation", "Auth Flows", "Data Exposure"]
  },
  { 
    id: "priya", 
    name: "Functional Tester", 
    role: "Quality Assurance",
    desc: "Validates user flows, form submissions, edge cases, error handling",
    metrics: ["User Journeys", "Form Validation", "Error States"]
  },
  { 
    id: "marcus", 
    name: "Mobile Tester", 
    role: "Responsive Testing",
    desc: "Tests touch interactions, viewport scaling, mobile-specific behaviors",
    metrics: ["Touch Targets", "Viewport Meta", "Responsive Layout"]
  },
];

const FEATURES = [
  {
    title: "Parallel Execution",
    desc: "All AI agents run simultaneously, reducing test time by 5x compared to sequential testing.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    )
  },
  {
    title: "Real Browser Testing",
    desc: "Tests run in actual Chromium browsers with full JavaScript execution and network simulation.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    )
  },
  {
    title: "Vision AI Analysis",
    desc: "Screenshots analyzed by GPT-4 Vision to detect visual bugs humans would notice.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  },
  {
    title: "Live WebSocket Updates",
    desc: "Watch tests execute in real-time with streaming updates as bugs are discovered.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    )
  },
  {
    title: "Detailed Reports",
    desc: "Export comprehensive bug reports with screenshots, severity ratings, and reproduction steps.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    )
  },
  {
    title: "CI/CD Integration",
    desc: "Integrate with your deployment pipeline via REST API. Block deploys on critical bugs.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077l1.41-.513m14.095-5.13l1.41-.513M5.106 17.785l1.15-.964m11.49-9.642l1.149-.964M7.501 19.795l.75-1.3m7.5-12.99l.75-1.3m-6.063 16.658l.26-1.477m2.605-14.772l.26-1.477m0 17.726l-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.794l-.75-1.299M7.5 4.205L12 12m6.894 5.785l-1.149-.964M6.256 7.178l-1.15-.964m15.352 8.864l-1.41-.513M4.954 9.435l-1.41-.514M12.002 12l-3.75 6.495" />
      </svg>
    )
  },
];

const STATS = [
  { value: "5", label: "AI Agents" },
  { value: "<2min", label: "Avg Test Time" },
  { value: "50+", label: "Bug Categories" },
  { value: "99.9%", label: "Uptime" },
];

export default function LandingPage() {
  useEffect(() => {
    const theme = localStorage.getItem('theme') || 'dark';
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, []);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b backdrop-blur-md" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
              <span className="font-semibold text-lg">Simulant</span>
            </Link>
            <div className="hidden md:flex items-center gap-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Link href="#agents" className="hover:opacity-80 transition">Agents</Link>
              <Link href="#features" className="hover:opacity-80 transition">Features</Link>
              <Link href="#pricing" className="hover:opacity-80 transition">Pricing</Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <SignedOut>
              <Link href="/login" className="text-sm hover:opacity-80 transition" style={{ color: 'var(--text-secondary)' }}>Log in</Link>
              <Link href="/signup" className="btn-primary px-4 py-2 rounded-lg text-sm">Get Started</Link>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard" className="btn-primary px-4 py-2 rounded-lg text-sm">Dashboard</Link>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute inset-0 bg-gradient-subtle" />
        
        <div className="max-w-6xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#1a1a1a] bg-[#0a0a0a] text-sm text-[#888] mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 pulse-dot" />
              Now in public beta
            </div>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight mb-6 leading-[1.1]">
              Automated QA testing<br />
              <span className="text-[#888]">powered by AI agents</span>
            </h1>
            
            <p className="text-lg md:text-xl text-[#888] mb-10 max-w-2xl leading-relaxed">
              Five specialized AI agents test your website simultaneously. 
              Find performance issues, accessibility problems, security vulnerabilities, 
              and UX bugs before your users do.
            </p>
            
            <div className="flex flex-wrap gap-4 mb-16">
              <Link href="/signup" className="btn-primary px-6 py-3 rounded-lg font-medium flex items-center gap-2">
                Start testing free
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link href="#demo" className="btn-secondary px-6 py-3 rounded-lg font-medium flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Watch demo
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-8 pt-8 border-t border-[#1a1a1a]">
              {STATS.map((stat, i) => (
                <div key={i}>
                  <div className="text-2xl md:text-3xl font-semibold mb-1">{stat.value}</div>
                  <div className="text-sm text-[#555]">{stat.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Agents Section */}
      <section id="agents" className="py-24 px-6 border-t border-[#1a1a1a]">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <p className="text-sm text-[#555] uppercase tracking-wider mb-3">AI Agents</p>
            <h2 className="text-3xl md:text-4xl font-semibold mb-4">Five specialized testing agents</h2>
            <p className="text-[#888] text-lg max-w-2xl">
              Each agent focuses on a specific testing domain, using different strategies and heuristics to find bugs.
            </p>
          </div>

          <div className="space-y-4">
            {PERSONAS.map((persona, i) => (
              <motion.div
                key={persona.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="card p-6 group"
              >
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                  <div className="flex items-center gap-4 md:w-64">
                    <div className="w-10 h-10 rounded-lg bg-[#111] border border-[#1a1a1a] flex items-center justify-center">
                      <svg className="w-5 h-5 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium">{persona.name}</h3>
                      <p className="text-sm text-[#555]">{persona.role}</p>
                    </div>
                  </div>
                  <p className="text-[#888] text-sm flex-1">{persona.desc}</p>
                  <div className="flex flex-wrap gap-2">
                    {persona.metrics.map((metric) => (
                      <span key={metric} className="badge px-2.5 py-1 rounded-md">{metric}</span>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-6 border-t border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <p className="text-sm text-[#555] uppercase tracking-wider mb-3">Features</p>
            <h2 className="text-3xl md:text-4xl font-semibold mb-4">Built for modern development</h2>
            <p className="text-[#888] text-lg max-w-2xl">
              Everything you need to automate your QA process and ship with confidence.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="card p-6"
              >
                <div className="w-10 h-10 rounded-lg bg-[#111] border border-[#1a1a1a] flex items-center justify-center mb-4 text-[#888]">
                  {feature.icon}
                </div>
                <h3 className="font-medium mb-2">{feature.title}</h3>
                <p className="text-sm text-[#888] leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6 border-t border-[#1a1a1a]">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <p className="text-sm text-[#555] uppercase tracking-wider mb-3">How it works</p>
            <h2 className="text-3xl md:text-4xl font-semibold">Three steps to automated QA</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Enter your URL", desc: "Paste any URL — production, staging, or localhost via tunnel. We handle authentication flows too." },
              { step: "02", title: "Select agents", desc: "Choose which AI agents to run based on your testing priorities. Run all five for comprehensive coverage." },
              { step: "03", title: "Review results", desc: "Get a detailed report with bugs categorized by severity, screenshots, and reproduction steps." },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="text-5xl font-semibold text-[#1a1a1a] mb-4">{item.step}</div>
                <h3 className="text-xl font-medium mb-2">{item.title}</h3>
                <p className="text-[#888] leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6 border-t border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm text-[#555] uppercase tracking-wider mb-3">Pricing</p>
            <h2 className="text-3xl md:text-4xl font-semibold mb-4">Simple, transparent pricing</h2>
            <p className="text-[#888] text-lg">Free during beta. No credit card required.</p>
          </div>

          <div className="max-w-md mx-auto">
            <div className="card p-8 text-center">
              <div className="badge badge-success px-3 py-1 rounded-full inline-flex mb-6">Beta Access</div>
              <div className="text-5xl font-semibold mb-2">$0</div>
              <p className="text-[#888] mb-8">Free while in beta</p>
              
              <ul className="space-y-4 text-left mb-8">
                {[
                  "All 5 AI testing agents",
                  "Unlimited test runs",
                  "Real-time WebSocket updates",
                  "Detailed bug reports",
                  "Screenshot capture",
                  "API access",
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm">
                    <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-[#888]">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link href="/signup" className="btn-primary w-full py-3 rounded-lg font-medium block">
                Get started free
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-[#1a1a1a]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">Ready to automate your QA?</h2>
          <p className="text-[#888] text-lg mb-8">
            Join developers who are shipping faster with AI-powered testing.
          </p>
          <Link href="/signup" className="btn-primary px-8 py-3 rounded-lg font-medium inline-flex items-center gap-2">
            Start testing free
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-[#1a1a1a]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
              <span className="font-medium">Simulant</span>
            </div>
            <div className="flex gap-8 text-sm text-[#555]">
              <Link href="#" className="hover:text-white transition">Documentation</Link>
              <Link href="#" className="hover:text-white transition">Privacy</Link>
              <Link href="#" className="hover:text-white transition">Terms</Link>
              <Link href="#" className="hover:text-white transition">Contact</Link>
            </div>
            <p className="text-sm text-[#555]">© 2024 Simulant</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
