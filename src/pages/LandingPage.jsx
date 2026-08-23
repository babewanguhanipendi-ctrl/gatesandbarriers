import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { Shield, Users, MapPin, Clock, Award, ChevronRight, Building2, Briefcase, Phone, Mail, CheckCircle, Star, ArrowRight, Info } from 'lucide-react'
import BrandLogo from '../components/BrandLogo'
import JobApplicationForm from '../components/JobApplicationForm'
import ClientIntakeForm from './ClientIntakeForm'

const LandingPage = () => {
  const [contractorOpen, setContractorOpen] = useState(false)
  const [guardOpen, setGuardOpen] = useState(false)
  const scrollTo = useCallback((sectionId) => {
    const el = document.getElementById(sectionId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  // Expose scrollTo for parent sidebar
  window.__landingScrollTo = scrollTo

  return (
    <div className="min-h-screen bg-sky-100 text-sky-950">
      {/* Hero Section with Icons */}
      <section id="home" className="bg-sky-700 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <BrandLogo className="mx-auto mb-10 h-28 w-40 sm:h-36 sm:w-52" />

          {/* Icons at the top */}
          <div className="flex flex-wrap justify-center gap-8 mb-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-2 border border-white/20">
                <Shield className="w-10 h-10 text-[#fdbb2d]" />
              </div>
              <p className="text-white text-sm font-medium">Protection</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-2 border border-white/20">
                <Users className="w-10 h-10 text-[#fdbb2d]" />
              </div>
              <p className="text-white text-sm font-medium">Team</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-2 border border-white/20">
                <Award className="w-10 h-10 text-[#fdbb2d]" />
              </div>
              <p className="text-white text-sm font-medium">Excellence</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-2 border border-white/20">
                <Clock className="w-10 h-10 text-[#fdbb2d]" />
              </div>
              <p className="text-white text-sm font-medium">24/7 Support</p>
            </div>
          </div>

          {/* Greeting and Motto */}
          <div className="text-center text-white mb-16">
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold leading-tight mb-6">
              Assalamualaikum!
            </h1>
            <p className="text-2xl sm:text-3xl md:text-4xl font-semibold text-[#fdbb2d] mb-4">
              Vigilance Through Integrity
            </p>
            <p className="text-lg sm:text-xl text-gray-200 max-w-3xl mx-auto">
              Your Security Is Our Priority
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            <button
              onClick={() => scrollTo('join-team')}
              className="px-8 py-3 bg-[#fdbb2d] text-[#1a2a6c] font-bold rounded-lg hover:shadow-xl transition-all flex items-center gap-2"
            >
              Join Our Team <ArrowRight size={20} />
            </button>
            <button
              onClick={() => scrollTo('services')}
              className="px-8 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10 transition-all"
            >
              Our Services
            </button>
          </div>
        </div>
      </section>

      {/* Trust Bar - Stats Section */}
      <section className="bg-sky-100 py-12 border-b border-sky-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#1a2a6c]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-[#1a2a6c]" />
              </div>
              <p className="text-3xl font-bold text-[#1a2a6c]">200+</p>
              <p className="text-sm text-gray-600 mt-1">Clients</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-[#fdbb2d]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-[#1a2a6c]" />
              </div>
              <p className="text-3xl font-bold text-[#1a2a6c]">500+</p>
              <p className="text-sm text-gray-600 mt-1">Guards</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-[#1a2a6c]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-[#1a2a6c]" />
              </div>
              <p className="text-3xl font-bold text-[#1a2a6c]">50+</p>
              <p className="text-sm text-gray-600 mt-1">Sites</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-[#fdbb2d]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="w-8 h-8 text-[#1a2a6c]" />
              </div>
              <p className="text-3xl font-bold text-[#1a2a6c]">99%</p>
              <p className="text-sm text-gray-600 mt-1">Retention</p>
            </div>
          </div>
        </div>
      </section>

      {/* Motto Section */}
      <section className="bg-sky-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-2xl md:text-3xl font-bold text-[#1a2a6c]">
            Vigilance Through Integrity
          </p>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 bg-sky-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Our Security Services</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Comprehensive security solutions tailored to your specific needs
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Service 1 */}
            <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow">
              <div className="mb-6 flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#1a2a6c]/10">
                <Building2 className="h-8 w-8 shrink-0 text-[#1a2a6c]" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Corporate Security</h3>
              <p className="text-gray-600 mb-4">
                Professional security personnel for office buildings, banks, and corporate facilities. 
                24/7 monitoring and rapid response.
              </p>
              <ul className="space-y-2 text-sm text-gray-500">
                <li className="flex items-center gap-2"><CheckCircle size={16} className="text-[#fdbb2d]" /> Access Control Systems</li>
                <li className="flex items-center gap-2"><CheckCircle size={16} className="text-[#fdbb2d]" /> CCTV Monitoring</li>
                <li className="flex items-center gap-2"><CheckCircle size={16} className="text-[#fdbb2d]" /> Reception Security</li>
              </ul>
            </div>

            {/* Service 2 */}
            <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow">
              <div className="mb-6 flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#fdbb2d]/20">
                <MapPin className="h-8 w-8 shrink-0 text-[#1a2a6c]" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Estate & Residential</h3>
              <p className="text-gray-600 mb-4">
                Comprehensive security for gated communities, apartment complexes, and residential estates 
                with modern surveillance.
              </p>
              <ul className="space-y-2 text-sm text-gray-500">
                <li className="flex items-center gap-2"><CheckCircle size={16} className="text-[#fdbb2d]" /> Gate Management</li>
                <li className="flex items-center gap-2"><CheckCircle size={16} className="text-[#fdbb2d]" /> Patrol Services</li>
                <li className="flex items-center gap-2"><CheckCircle size={16} className="text-[#fdbb2d]" /> Visitor Management</li>
              </ul>
            </div>

            {/* Service 3 */}
            <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow">
              <div className="mb-6 flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#1a2a6c]/10">
                <Briefcase className="h-8 w-8 shrink-0 text-[#1a2a6c]" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Event Security</h3>
              <p className="text-gray-600 mb-4">
                Specialized security teams for concerts, conferences, sporting events, 
                and private functions of all sizes.
              </p>
              <ul className="space-y-2 text-sm text-gray-500">
                <li className="flex items-center gap-2"><CheckCircle size={16} className="text-[#fdbb2d]" /> Crowd Management</li>
                <li className="flex items-center gap-2"><CheckCircle size={16} className="text-[#fdbb2d]" /> VIP Protection</li>
                <li className="flex items-center gap-2"><CheckCircle size={16} className="text-[#fdbb2d]" /> Emergency Response</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-sky-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="flex w-full items-center justify-center">
              <BrandLogo className="aspect-[4/3] w-full max-w-md" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Who We Are
              </h2>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Gates & Barriers Security Services has been at the forefront of the security industry 
                for over a decade. We pride ourselves on delivering exceptional security solutions 
                that protect what matters most to our clients.
              </p>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Our team of highly trained professionals brings together decades of combined experience 
                in law enforcement, military service, and private security. We invest heavily in training, 
                technology, and equipment to ensure our guards are always prepared.
              </p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-1"><Award size={18} className="text-[#fdbb2d]" /> ISO Certified</div>
                <div className="flex items-center gap-1"><Award size={18} className="text-[#fdbb2d]" /> Licensed & Insured</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Us Section */}
      <section id="why-us" className="py-20 bg-sky-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Why Choose Gates & Barriers?</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              We set the standard for professional security services
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#1a2a6c]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-[#1a2a6c]" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Expert Team</h3>
              <p className="text-sm text-gray-500">Rigorously trained and vetted security professionals</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-[#fdbb2d]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-[#1a2a6c]" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">24/7 Support</h3>
              <p className="text-sm text-gray-500">Round-the-clock monitoring and rapid response teams</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-[#1a2a6c]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-[#1a2a6c]" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Modern Tech</h3>
              <p className="text-sm text-gray-500">Latest surveillance and access control technology</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-[#fdbb2d]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-[#1a2a6c]" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Proven Track Record</h3>
              <p className="text-sm text-gray-500">99% client retention rate with 200+ satisfied clients</p>
            </div>
          </div>
        </div>
      </section>

      {/* Hire / Join Section */}
      <section id="join-team" className="py-20 bg-sky-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Hire Us or Join the Guard Team</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Contractors can pitch security work directly to the director. Guard applicants can apply for the only open role: Security Guard.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 items-start">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setContractorOpen(!contractorOpen)}
                className="w-full p-6 text-left flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Contractors: Pitch a Security Bid</h3>
                  <p className="text-sm text-gray-600 mt-1">Request guards, patrols, event security, or site coverage.</p>
                </div>
                <ChevronRight className={`w-6 h-6 text-[#1a2a6c] transition-transform ${contractorOpen ? 'rotate-90' : ''}`} />
              </button>
              {contractorOpen && (
                <div className="p-6 border-t border-gray-200">
                  <ClientIntakeForm embedded />
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setGuardOpen(!guardOpen)}
                className="w-full p-6 text-left flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Applicants: Apply as a Guard</h3>
                  <p className="text-sm text-gray-600 mt-1">Only Security Guard applications are open right now.</p>
                </div>
                <ChevronRight className={`w-6 h-6 text-[#1a2a6c] transition-transform ${guardOpen ? 'rotate-90' : ''}`} />
              </button>
              {guardOpen && (
                <div className="p-6 border-t border-gray-200">
                  <JobApplicationForm />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-sky-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">What Our Clients Say</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="flex items-center gap-1 text-[#fdbb2d] mb-4">
                {[...Array(5)].map((_, i) => <Star key={i} size={18} fill="currentColor" />)}
              </div>
              <p className="text-gray-600 mb-6">
                "Gates & Barriers has been protecting our office complex for 3 years. 
                Professional, reliable, and always responsive to our needs."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold">EM</div>
                <div>
                  <p className="font-semibold text-gray-900">Emmanuel</p>
                  <p className="text-sm text-gray-500">CEO, TechCorp Ltd</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="flex items-center gap-1 text-[#fdbb2d] mb-4">
                {[...Array(5)].map((_, i) => <Star key={i} size={18} fill="currentColor" />)}
              </div>
              <p className="text-gray-600 mb-6">
                "The estate security has improved dramatically since we contracted Gates & Barriers. 
                Their patrol system and gate management is top-notch."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold">MI</div>
                <div>
                  <p className="font-semibold text-gray-900">Mohammed Ibni</p>
                  <p className="text-sm text-gray-500">Chair, Green Estate</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="flex items-center gap-1 text-[#fdbb2d] mb-4">
                {[...Array(5)].map((_, i) => <Star key={i} size={18} fill="currentColor" />)}
              </div>
              <p className="text-gray-600 mb-6">
                "We hired them for our annual conference and were impressed by their professionalism. 
                Crowd management was seamless."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold">PK</div>
                <div>
                  <p className="font-semibold text-gray-900">Peter Kamau</p>
                  <p className="text-sm text-gray-500">Events Director</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-sky-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Get In Touch</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Ready to discuss your security needs? Contact us today.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center bg-white rounded-xl shadow-lg p-8 border border-gray-200">
              <div className="w-14 h-14 bg-[#1a2a6c]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone className="w-7 h-7 text-[#1a2a6c]" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Phone</h3>
              <p className="text-gray-600">+254 726 830 590</p>
              <p className="text-gray-600">+254 733 521 883</p>
            </div>
            <div className="text-center bg-white rounded-xl shadow-lg p-8 border border-gray-200">
              <div className="w-14 h-14 bg-[#fdbb2d]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-7 h-7 text-[#1a2a6c]" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Email</h3>
              <p className="text-gray-600">info@gatesandbarriers.co.ke</p>
              <p className="text-gray-600">mokua@gatesandbarriers.co.ke</p>
            </div>
            <div className="text-center bg-white rounded-xl shadow-lg p-8 border border-gray-200">
              <div className="w-14 h-14 bg-[#1a2a6c]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-7 h-7 text-[#1a2a6c]" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Location</h3>
              <p className="text-gray-600">Mombasa, Kenya</p>
              <p className="text-gray-600">Mbaraki, opposite Mombasa Sports Club</p>
              <p className="text-gray-500 text-sm mt-1">Near KMA</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1a2a6c] text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <BrandLogo className="h-9 w-14 shrink-0" />
                <span className="text-lg font-bold">Gates & Barriers</span>
              </div>
              <p className="text-sm text-gray-300">
                Professional security services you can trust.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm text-gray-300">
                <li><button onClick={() => scrollTo('home')} className="hover:text-white">Home</button></li>
                <li><button onClick={() => scrollTo('services')} className="hover:text-white">Services</button></li>
                <li><button onClick={() => scrollTo('about')} className="hover:text-white">About</button></li>
                <li><button onClick={() => scrollTo('contact')} className="hover:text-white">Contact</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Services</h4>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>Corporate Security</li>
                <li>Estate Security</li>
                <li>Event Security</li>
                <li>VIP Protection</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Staff Portals</h4>
              <p className="text-sm text-gray-300 mb-4">
                Staff can sign in with their work number to access the correct portal.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#fdbb2d] text-[#1a2a6c] font-semibold rounded-lg text-sm hover:shadow-lg transition-all"
              >
                Sign In <ChevronRight size={16} />
              </Link>
            </div>
          </div>
          <div className="border-t border-white/20 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>&copy; {new Date().getFullYear()} Gates & Barriers Security Services. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage

