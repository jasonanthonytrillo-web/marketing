import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { submitBetaApplication } from '../services/api';

export default function Marketing() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    businessName: '',
    email: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await submitBetaApplication(formData);
      setIsSubmitted(true);
      setTimeout(() => {
        setIsSubmitted(false);
        setIsModalOpen(false);
        setFormData({ name: '', businessName: '', email: '' });
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-primary-500/30 overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-black/20 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-orange-500 rounded-xl flex items-center justify-center font-black text-xl shadow-lg shadow-primary-500/20">
              E
            </div>
            <span className="font-heading text-2xl font-black tracking-tighter uppercase">Elevate<span className="text-primary-500">POS</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-bold uppercase tracking-widest text-surface-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#workflow" className="hover:text-white transition-colors">Workflow</a>
            <a href="#beta" className="text-primary-400 hover:text-primary-300 transition-colors">Beta Program</a>
          </div>
          <Link to="/login?from=marketing" className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all">
            Staff Login
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-primary-500/10 blur-[120px] rounded-full -z-10" />
        <div className="absolute top-40 right-0 w-[400px] h-[400px] bg-orange-500/10 blur-[100px] rounded-full -z-10" />

        <div className="max-w-7xl mx-auto text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-xs font-black uppercase tracking-widest mb-8"
          >
            🚀 Exclusive Beta Access Now Open
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter leading-[0.9] mb-8"
          >
            THE POS SYSTEM <br />
            <span className="bg-gradient-to-r from-white via-surface-300 to-surface-500 bg-clip-text text-transparent">
              THAT SPEAKS FOR ITSELF.
            </span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-lg md:text-2xl text-surface-400 max-w-3xl mx-auto mb-12 leading-relaxed"
          >
            Elevate your business with a cinematic, real-time management system designed for modern cafes, restaurants, and kiosks. Seamless, stunning, and smarter than ever.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex flex-col md:flex-row items-center justify-center gap-4"
          >
            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-10 py-5 bg-primary-500 rounded-2xl font-black uppercase tracking-widest text-lg shadow-2xl shadow-primary-500/40 hover:scale-105 transition-all"
            >
              Join the Beta Trial
            </button>
            <a href="#features" className="px-10 py-5 bg-white/5 border border-white/10 rounded-2xl font-black uppercase tracking-widest text-lg hover:bg-white/10 transition-all">
              See the Features
            </a>
          </motion.div>
        </div>

        {/* Floating Mockup Preview */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 100 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="mt-20 max-w-6xl mx-auto relative group"
        >
          <div className="absolute inset-0 bg-primary-500/20 blur-[100px] rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <div className="relative rounded-3xl border border-white/10 overflow-hidden shadow-2xl shadow-black">
            <img 
              src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=2000&auto=format&fit=crop" 
              alt="Dashboard Preview" 
              className="w-full h-auto grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
          </div>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase mb-4">Built for <span className="text-primary-500">Efficiency</span></h2>
            <p className="text-surface-400 text-lg max-w-2xl mx-auto">Enterprise-grade tools packaged in a beautiful, user-first interface.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard 
              index={0}
              icon="⚡"
              title="Real-Time Sync"
              description="Orders hit the kitchen the millisecond they are placed. No delays, no missed tickets, zero friction."
            />
            <FeatureCard 
              index={1}
              icon="🎙️"
              title="AI Voice Alerts"
              description="Our system automatically announces ready orders to your customers with professional AI speech synthesis."
            />
            <FeatureCard 
              index={2}
              icon="💎"
              title="Glassmorphism UI"
              description="Cinematic, high-end design that makes your business look premium and state-of-the-art."
            />
            <FeatureCard 
              index={3}
              icon="🏢"
              title="Multi-Tenant"
              description="Secure isolation for your business data. Your menus, customers, and reports are yours alone."
            />
            <FeatureCard 
              index={4}
              icon="🎁"
              title="Loyalty Engine"
              description="Keep customers coming back with a built-in point redemption system that tracks every visit."
            />
            <FeatureCard 
              index={5}
              icon="📊"
              title="Deep Analytics"
              description="Understand your best sellers and peak hours with clean, actionable data visualization."
            />
          </div>
        </div>
      </section>

      {/* Complete Visual Journey Section */}
      <section className="py-32 px-6 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-24"
          >
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase mb-6">The Full <span className="text-primary-500 italic">Journey</span></h2>
            <p className="text-surface-400 text-lg max-w-2xl mx-auto">Experience how ElevatePOS transforms every interaction, from the first click to the final report.</p>
          </motion.div>

          <div className="space-y-40">
            {/* Phase 1: The Customer Experience */}
            <div>
              <div className="flex items-center gap-4 mb-16">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
                <span className="text-[10px] font-black uppercase tracking-[0.5em] text-primary-500">Phase 01: Customer Experience</span>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                <JourneyCard 
                  step="01"
                  title="Cinematic Landing"
                  desc="A high-end entry point that mirrors your brand's premium identity."
                  image="/marketing/step1_landing.png"
                />
                <JourneyCard 
                  step="02"
                  title="Intuitive Menu"
                  desc="Visual-first product selection designed to increase average order value."
                  image="/marketing/step2_menu.png"
                />
                <JourneyCard 
                  step="03"
                  title="Smart Cart"
                  desc="Seamless order management with real-time tax and subtotal calculations."
                  image="/marketing/step3_cart.png"
                />
                <JourneyCard 
                  step="04"
                  title="Secure Checkout"
                  desc="Multiple payment options including GCash, Maya, and Cash for maximum flexibility."
                  image="/marketing/step4_checkout.png"
                />
                <JourneyCard 
                  step="05"
                  title="Instant Receipt"
                  desc="Automated queue numbering and loyalty point integration for every guest."
                  image="/marketing/step5_receipt.png"
                />
              </div>
            </div>

            {/* Phase 2: Operational Hub */}
            <div>
              <div className="flex items-center gap-4 mb-16">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-indigo-500/20" />
                <span className="text-[10px] font-black uppercase tracking-[0.5em] text-indigo-400">Phase 02: Operational Hub</span>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-indigo-500/20" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                <JourneyCard 
                  step="06"
                  title="Cashier Terminal"
                  desc="Lightning-fast payment processing and order confirmation for staff."
                  image="/marketing/step6_cashier.png"
                />
                <JourneyCard 
                  step="07"
                  title="Kitchen Display"
                  desc="Real-time preparation tracking with AI-voice announcement integration."
                  image="/marketing/step7_kitchen.png"
                />
                <JourneyCard 
                  step="08"
                  title="Admin Control Center"
                  desc="Total ecosystem management. Control every tenant, monitor health, and oversee all business operations from a single hub."
                  image="/marketing/step8_admin.png"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section id="workflow" className="py-32 px-6 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="flex flex-col md:flex-row items-end justify-between gap-6 mb-20"
          >
            <div className="max-w-2xl">
              <h2 className="text-4xl md:text-7xl font-black tracking-tighter uppercase mb-6 leading-none">The Perfect <br /><span className="text-primary-500 italic">Workflow</span></h2>
              <p className="text-surface-400 text-lg md:text-xl font-medium">Experience the seamless transition from order to table.</p>
            </div>
            <div className="hidden md:block h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent mx-10 mb-6" />
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 relative">
            <WorkflowStep 
              index={0}
              number="01"
              title="Order"
              desc="Customer selects items via the cinematic Kiosk UI."
            />
            <WorkflowStep 
              index={1}
              number="02"
              title="Sync"
              desc="Real-time Socket.io transmission to Cashier & Kitchen."
            />
            <WorkflowStep 
              index={2}
              number="03"
              title="Prep"
              desc="Kitchen dashboard organizes and tracks preparation time."
            />
            <WorkflowStep 
              index={3}
              number="04"
              title="Ready"
              desc="AI Voice announces the order as it hits the counter."
            />
          </div>
        </div>
      </section>

      {/* Beta CTA Section */}
      <motion.section 
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
        id="beta" 
        className="py-32 px-6 relative"
      >
        <div className="absolute inset-0 bg-primary-600/5 -skew-y-3" />
        <div className="max-w-5xl mx-auto relative z-10 bg-white/5 border border-white/10 rounded-[3rem] p-12 md:p-20 text-center backdrop-blur-xl">
          <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 text-sm font-black uppercase tracking-[0.2em] mb-8">
            ⚠️ Limited Opportunity
          </div>
          <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase mb-6">
            ONLY <span className="text-primary-500 italic underline">2 SLOTS</span> LEFT
          </h2>
          <p className="text-xl md:text-2xl text-surface-300 mb-12 max-w-2xl mx-auto leading-relaxed">
            We are looking for two visionary business owners to pilot ElevatePOS for <span className="text-white font-bold underline decoration-primary-500">2 weeks at zero cost</span>. Run through our features and transform your operations today.
          </p>
          
          <div className="flex flex-col items-center gap-6">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-12 py-6 bg-white text-black rounded-2xl font-black uppercase tracking-[0.2em] text-xl hover:scale-105 transition-all shadow-[0_0_50px_rgba(255,255,255,0.2)]"
            >
              Claim Your Free Trial
            </button>
            <p className="text-surface-500 text-sm font-medium uppercase tracking-widest">
              No credit card required. Pure performance.
            </p>
          </div>
        </div>
      </motion.section>

      {/* Beta Registration Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xl bg-surface-900 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
              <div className="p-10">
                {isSubmitted ? (
                  <div className="py-20 text-center animate-fade-in">
                    <div className="w-20 h-20 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">
                      ✓
                    </div>
                    <h3 className="text-3xl font-black uppercase tracking-tighter mb-2">Request Received!</h3>
                    <p className="text-surface-400">We'll reach out to you within 24 hours.</p>
                  </div>
                ) : (
                  <>
                    <h3 className="text-3xl font-black uppercase tracking-tighter mb-2">Join the <span className="text-primary-500 italic">Beta</span></h3>
                    <p className="text-surface-400 mb-8 font-medium">Transform your business with ElevatePOS.</p>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {error && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">{error}</div>}
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-surface-500 mb-2 ml-2">Your Name</label>
                        <input 
                          required 
                          type="text" 
                          placeholder="John Doe" 
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-primary-500 transition-colors" 
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-surface-500 mb-2 ml-2">Business Name</label>
                        <input 
                          required 
                          type="text" 
                          placeholder="The Coffee House" 
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-primary-500 transition-colors" 
                          value={formData.businessName}
                          onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-surface-500 mb-2 ml-2">Email Address</label>
                        <input 
                          required 
                          type="email" 
                          placeholder="john@example.com" 
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-primary-500 transition-colors" 
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                        />
                      </div>
                      <button 
                        disabled={loading}
                        type="submit" 
                        className="w-full py-5 bg-primary-500 rounded-2xl font-black uppercase tracking-widest text-lg shadow-xl shadow-primary-500/20 hover:scale-[1.02] transition-all mt-6 disabled:opacity-50"
                      >
                        {loading ? 'Submitting...' : 'Submit Application'}
                      </button>
                    </form>
                  </>
                )}
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-6 right-6 w-10 h-10 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-xl transition-colors"
              >
                ×
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="flex items-center gap-3 opacity-50 grayscale">
            <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center font-black">E</div>
            <span className="font-heading text-xl font-black tracking-tighter uppercase">ElevatePOS</span>
          </div>
          <div className="flex gap-10 text-[10px] font-black uppercase tracking-[0.3em] text-surface-500">
            <Link to="/privacy?from=marketing" className="hover:text-white transition-colors">Privacy</Link>
            <Link to="/terms?from=marketing" className="hover:text-white transition-colors">Terms</Link>
            <Link to="/data-deletion?from=marketing" className="hover:text-white transition-colors">Conditions</Link>
          </div>
          <p className="text-surface-600 text-xs font-bold">© 2026 Project Million Ecosystem.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ index, icon, title, description }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="group p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all duration-500"
    >
      <div className="w-16 h-16 rounded-2xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-3xl mb-8 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
        {icon}
      </div>
      <h3 className="text-2xl font-black tracking-tight mb-4 uppercase">{title}</h3>
      <p className="text-surface-400 leading-relaxed font-medium">{description}</p>
    </motion.div>
  );
}

function WorkflowStep({ index, number, title, desc }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="relative group"
    >
      <div className="text-6xl font-black text-white/5 group-hover:text-primary-500/10 transition-colors duration-500 absolute -top-10 -left-4 select-none">
        {number}
      </div>
      <div className="relative z-10">
        <h4 className="text-2xl font-black uppercase mb-4 tracking-tighter">{title}</h4>
        <p className="text-surface-400 font-medium leading-relaxed">{desc}</p>
      </div>
      <div className="mt-8 h-1 w-10 bg-primary-500/20 group-hover:w-full transition-all duration-700" />
    </motion.div>
  );
}

function JourneyCard({ step, title, desc, image }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="group"
    >
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-white/10 aspect-video bg-white/5">
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10" />
        <img 
          src={image} 
          alt={title} 
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=600&auto=format&fit=crop'; }}
        />
        <div className="absolute top-4 left-4 z-20 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-[10px] font-black text-primary-500 uppercase tracking-widest">
          Step {step}
        </div>
      </div>
      <h4 className="text-xl font-black uppercase tracking-tight mb-2 group-hover:text-primary-400 transition-colors">{title}</h4>
      <p className="text-surface-400 text-sm font-medium leading-relaxed">{desc}</p>
    </motion.div>
  );
}
