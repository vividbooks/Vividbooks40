import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  School as SchoolIcon, 
  Mail, 
  BookOpen,
  Users,
  Settings,
  Sparkles,
  Shield,
  CheckCircle2,
  Loader2,
  X,
  PanelLeft,
  PanelLeftClose,
  ChevronRight
} from 'lucide-react';
import VividLogo from '../../imports/Group70';
import { ToolsDropdown } from '../ToolsDropdown';
import { ToolsMenu } from '../ToolsMenu';
import { 
  School, 
  UserProfile, 
  SchoolLicense, 
  SubjectLicense,
  Colleague,
  SubjectMeta,
  SUBJECTS,
  isLicenseActive,
  formatLicenseDate
} from '../../types/profile';
import { supabase } from '../../utils/supabase/client';
import { SchoolPairing } from './SchoolPairing';
import { ColleaguesList } from './ColleaguesList';
import * as storage from '../../utils/profile-storage';

interface ProfilePageProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export function ProfilePage({ theme, toggleTheme }: ProfilePageProps) {
  const navigate = useNavigate();
  
  // Layout states
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [logoHovered, setLogoHovered] = useState(false);

  // Data states
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [license, setLicense] = useState<SchoolLicense | null>(null);
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [showPairing, setShowPairing] = useState(false);
  const [authUser, setAuthUser] = useState<{ id: string; email: string; name: string } | null>(null);

  useEffect(() => {
    // Try to load immediately from localStorage first (fast)
    const localProfile = storage.getCurrentUserProfile();
    if (localProfile) {
      setProfile(localProfile);
      setLoading(false);
    }
    
    loadProfileData();
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        loadProfileData();
      }
    });
    
    return () => subscription.unsubscribe();
  }, []);

  const loadProfileData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Set auth user info
      if (user) {
        setAuthUser({
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.name || user.email || 'Uživatel'
        });
      }

      // Load profile from localStorage (our source of truth)
      const localProfile = storage.getCurrentUserProfile();
      if (localProfile) {
        setProfile(localProfile);
        if (localProfile.schoolId) {
          // Load school and license from Supabase (with localStorage fallback)
          await Promise.all([
            loadSchool(localProfile.schoolId),
            loadLicense(localProfile.schoolId),
          ]);
          
          // Load colleagues from localStorage
          const localColleagues = storage.getColleagues(localProfile.userId, localProfile.schoolId);
          setColleagues(localColleagues);
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSchool = async (schoolId: string, _token?: string) => {
    try {
      // First try Supabase directly
      const { data: supabaseSchool, error } = await supabase
        .from('schools')
        .select('*')
        .eq('id', schoolId)
        .single();
      
      if (supabaseSchool && !error) {
        const school: School = {
          id: supabaseSchool.id,
          code: supabaseSchool.code,
          name: supabaseSchool.name,
          address: supabaseSchool.address || '',
          city: supabaseSchool.city || '',
          createdAt: supabaseSchool.created_at,
        };
        console.log('✅ School loaded from Supabase:', school.name);
        setSchool(school);
        return;
      }
    } catch (error) {
      console.log('Supabase not available for school, trying localStorage');
    }
    // Fallback to localStorage
    const localSchool = storage.getSchoolById(schoolId);
    if (localSchool) setSchool(localSchool);
  };

  const loadLicense = async (schoolId: string, _token?: string) => {
    try {
      // First try Supabase directly
      const { data: supabaseLicense, error } = await supabase
        .from('school_licenses')
        .select('*')
        .eq('school_id', schoolId)
        .single();
      
      if (supabaseLicense && !error) {
        const license: SchoolLicense = {
          id: supabaseLicense.id,
          schoolId: supabaseLicense.school_id,
          subjects: supabaseLicense.subjects || [],
          features: supabaseLicense.features || { vividboardWall: true },
          updatedAt: supabaseLicense.updated_at,
        };
        console.log('✅ License loaded from Supabase for school:', schoolId);
        setLicense(license);
        return;
      }
    } catch (error) {
      console.log('Supabase not available for license, trying localStorage');
    }
    // Fallback to localStorage
    const localLicense = storage.getLicenseBySchoolId(schoolId);
    if (localLicense) setLicense(localLicense);
  };

  const handleSchoolPaired = async (pairedSchool: School) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const teacherId = `teacher-${user?.id || Date.now()}`;
    const teacherName = user?.user_metadata?.name || authUser?.name || 'Uživatel';
    const teacherEmail = user?.email || authUser?.email || '';
    
    // Save profile to localStorage (our source of truth for user profile)
    const newProfile: UserProfile = {
      id: `profile-${Date.now()}`,
      userId: user?.id || 'local-user',
      email: teacherEmail,
      name: teacherName,
      role: 'teacher',
      schoolId: pairedSchool.id,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };
    storage.saveCurrentUserProfile(newProfile);
    setProfile(newProfile);
    setSchool(pairedSchool);
    
    // Create or update teacher record in Supabase for analytics
    try {
      const { error: teacherError } = await supabase
        .from('teachers')
        .upsert({
          id: teacherId,
          school_id: pairedSchool.id,
          user_id: user?.id || null,
          name: teacherName,
          email: teacherEmail,
          activity_level: 'active',
          last_active: new Date().toISOString(),
        }, { onConflict: 'id' });
      
      if (teacherError) {
        console.error('Error creating teacher record:', teacherError);
      } else {
        console.log('✅ Teacher record created/updated in Supabase');
      }
    } catch (error) {
      console.error('Error with teacher record:', error);
    }
    
    // Load license for the school from Supabase first, then localStorage
    try {
      const { data: supabaseLicense, error } = await supabase
        .from('school_licenses')
        .select('*')
        .eq('school_id', pairedSchool.id)
        .single();
      
      if (supabaseLicense && !error) {
        const license: SchoolLicense = {
          id: supabaseLicense.id,
          schoolId: supabaseLicense.school_id,
          subjects: supabaseLicense.subjects || [],
          features: supabaseLicense.features || { vividboardWall: true },
          updatedAt: supabaseLicense.updated_at,
        };
        console.log('✅ License loaded from Supabase after pairing');
        setLicense(license);
      } else {
        // Fallback to localStorage
        const localLicense = storage.getLicenseBySchoolId(pairedSchool.id);
        if (localLicense) setLicense(localLicense);
      }
    } catch (error) {
      console.log('Error loading license, trying localStorage');
      const localLicense = storage.getLicenseBySchoolId(pairedSchool.id);
      if (localLicense) setLicense(localLicense);
    }
    
    setShowPairing(false);
  };

  if (showPairing) {
    return (
      <SchoolPairing 
        onPaired={handleSchoolPaired}
        onClose={() => setShowPairing(false)}
      />
    );
  }

  const displayName = profile?.name || authUser?.name || 'Uživatel';
  const displayEmail = profile?.email || authUser?.email || '';

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        {/* Left Sidebar */}
        <aside 
          className={`
            /* Base layout properties */
            top-0 h-screen shrink-0 flex flex-col 
            transition-all duration-300 ease-in-out
            
            /* Mobile styles (default) */
            fixed left-0 z-30 w-[294px]
            ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
            
            /* Desktop styles (lg breakpoint) */
            lg:sticky lg:translate-x-0 lg:shadow-none
            ${!sidebarVisible 
              ? 'lg:w-0 lg:overflow-hidden lg:border-r-0' 
              : 'lg:w-[312px]'
            }
            print:hidden
          `}
          style={{ backgroundColor: '#084939' }}
        >
          {/* Inner wrapper to maintain width during collapse transition */}
          <div 
            className="w-[294px] lg:w-[312px] h-full flex flex-col min-w-[294px] lg:min-w-[312px]"
            style={{ backgroundColor: '#084939' }}
          >
            {/* Header */}
            <div className="p-4" style={{ backgroundColor: toolsOpen ? '#4E5871' : undefined }}>
              {toolsOpen ? (
                <div className="flex items-center justify-between min-h-[40px] animate-in fade-in duration-200">
                   <span className="text-white/90 font-bold text-[12px] uppercase tracking-wider pl-1">
                     Naše produkty
                   </span>
                   <button
                      onClick={() => setToolsOpen(false)}
                      className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-white/90"
                   >
                      <X className="h-5 w-5" />
                   </button>
                </div>
              ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <div 
                    className="flex items-center justify-center min-h-[40px] w-20"
                    onMouseEnter={() => setLogoHovered(true)}
                    onMouseLeave={() => setLogoHovered(false)}
                  >
                    <Link to="/docs/knihovna-vividbooks/introduction" className="flex items-center">
                      <div className="w-20 h-10 text-white">
                        <VividLogo />
                      </div>
                    </Link>
                  </div>
                  <ToolsDropdown 
                    isOpen={toolsOpen} 
                    onToggle={() => setToolsOpen(!toolsOpen)} 
                    label="Můj účet"
                    variant="default"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="lg:hidden p-1.5 rounded-md transition-colors text-white/70 hover:text-white hover:bg-white/10"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setSidebarVisible(false)}
                    className="hidden lg:block p-1.5 rounded-md transition-colors text-white/70 hover:text-white hover:bg-white/10"
                    title="Skrýt menu"
                  >
                    <PanelLeftClose className="h-[23px] w-[23px]" />
                  </button>
                </div>
              </div>
              )}
            </div>

            {/* Navigation Content */}
            <div className="flex-1 overflow-hidden text-white flex flex-col">
              {toolsOpen ? (
                <div className="h-full" style={{ backgroundColor: '#4E5871' }}>
                  <ToolsMenu 
                    activeItem="profile"
                    onItemClick={() => {
                      setToolsOpen(false);
                      setSidebarOpen(false);
                    }} 
                  />
                </div>
              ) : (
                <div className="h-full" style={{ backgroundColor: '#4E5871' }}>
                  <ToolsMenu 
                    activeItem="profile"
                    onItemClick={() => setSidebarOpen(false)} 
                  />
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {/* Top Header when sidebar is hidden */}
          {!sidebarVisible && (
            <div className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSidebarVisible(true)}
                  className="p-2 rounded-md text-slate-600 hover:bg-slate-100 transition-colors"
                  title="Zobrazit menu"
                >
                  <PanelLeft className="h-5 w-5" />
                </button>
                <h1 className="font-bold text-xl text-slate-800">Můj profil</h1>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-[calc(100vh-60px)]">
              <div className="flex items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                <span className="text-slate-600">Načítám profil...</span>
              </div>
            </div>
          ) : (
            <div className="p-6 lg:p-8">
              <div className="max-w-[800px] mx-auto">
                
                {/* Profile Header Card */}
                <div className="bg-white rounded-3xl shadow-lg overflow-hidden mb-8">
                  <div 
                    className="p-8 text-white relative"
                    style={{ 
                      background: 'linear-gradient(to right, #4f46e5, #7c3aed, #9333ea)',
                      minHeight: '140px'
                    }}
                  >
                    <div className="flex items-center gap-6">
                      <div 
                        className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold shadow-lg"
                        style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                      >
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h1 className="text-3xl font-bold mb-1">{displayName}</h1>
                        <div className="flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.9)' }}>
                          <Mail className="w-4 h-4" />
                          <span className="text-base">{displayEmail}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-8 space-y-8">
                    {/* School Section */}
                    <section>
                      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <SchoolIcon className="w-4 h-4" />
                        Škola
                      </h2>
                      
                      {school ? (
                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-2xl font-bold text-slate-800 mb-1">{school.name}</h3>
                              {school.city && (
                                <p className="text-slate-500 text-lg">{school.address}, {school.city}</p>
                              )}
                            </div>
                            <div className="bg-indigo-50 px-6 py-3 rounded-xl text-center">
                              <div className="text-xs text-indigo-600 font-medium uppercase tracking-wider mb-1">Kód školy</div>
                              <div className="text-2xl font-mono font-bold text-indigo-700">{school.code}</div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-50 rounded-2xl p-8 border-2 border-dashed border-slate-300 text-center">
                          <SchoolIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                          <h3 className="text-xl font-semibold text-slate-700 mb-2">Nejste propojeni se školou</h3>
                          <p className="text-slate-500 mb-6 max-w-md mx-auto">Zadejte kód školy pro přístup k licencím a materiálům. Kód získáte od administrátora školy.</p>
                          <button
                            onClick={() => setShowPairing(true)}
                            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors shadow-lg shadow-indigo-200"
                          >
                            Zadat kód školy
                          </button>
                        </div>
                      )}
                    </section>

                    {/* Subjects Section */}
                    {school && (
                      <section>
                        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                          <BookOpen className="w-4 h-4" />
                          Předměty
                        </h2>

                        {/* 2. stupeň */}
                        <div className="mb-6">
                          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">2. stupeň</h3>
                          <div className="flex gap-2">
                            {SUBJECTS.filter(s => s.grade === 2)
                              .sort((a, b) => {
                                const aLicense = license?.subjects.find(l => l.subject === a.id);
                                const bLicense = license?.subjects.find(l => l.subject === b.id);
                                const aActive = aLicense ? isLicenseActive(aLicense) : false;
                                const bActive = bLicense ? isLicenseActive(bLicense) : false;
                                if (aActive === bActive) return 0;
                                return aActive ? -1 : 1;
                              })
                              .map((subject) => {
                              const subjectLicense = license?.subjects.find(l => l.subject === subject.id);
                              return (
                                <SubjectCard 
                                  key={subject.id} 
                                  subject={subject} 
                                  license={subjectLicense} 
                                />
                              );
                            })}
                          </div>
                        </div>

                        {/* 1. stupeň */}
                        <div className="mb-4">
                          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">1. stupeň</h3>
                          <div className="flex gap-2">
                            {SUBJECTS.filter(s => s.grade === 1)
                              .sort((a, b) => {
                                const aLicense = license?.subjects.find(l => l.subject === a.id);
                                const bLicense = license?.subjects.find(l => l.subject === b.id);
                                const aActive = aLicense ? isLicenseActive(aLicense) : false;
                                const bActive = bLicense ? isLicenseActive(bLicense) : false;
                                if (aActive === bActive) return 0;
                                return aActive ? -1 : 1;
                              })
                              .map((subject) => {
                              const subjectLicense = license?.subjects.find(l => l.subject === subject.id);
                              return (
                                <SubjectCard 
                                  key={subject.id} 
                                  subject={subject} 
                                  license={subjectLicense} 
                                />
                              );
                            })}
                          </div>
                        </div>

                        <button className="w-full mt-4 py-3 border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 rounded-xl text-slate-500 hover:text-indigo-600 text-sm font-medium transition-colors flex items-center justify-center gap-2">
                          <BookOpen className="w-4 h-4" />
                          Zakoupit další předměty
                        </button>
                      </section>
                    )}

                    {/* Special Features */}
                    {school && license && (
                      <section>
                        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                          <Sparkles className="w-4 h-4" />
                          Funkce
                        </h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Ecosystem Vividbooks */}
                          <div className={`rounded-2xl p-5 border ${
                            license.features.ecosystemVividbooks 
                              ? 'bg-violet-50 border-violet-200' 
                              : 'bg-slate-50 border-slate-200'
                          }`}>
                            <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${
                                license.features.ecosystemVividbooks 
                                  ? 'bg-violet-100 text-violet-600' 
                                  : 'bg-slate-200 text-slate-400'
                              }`}>
                                <Sparkles className="w-6 h-6" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-slate-800">Ekosystém Vividbooks</div>
                                <div className="text-sm text-slate-500 mt-0.5">AI, Vividboard, Výsledky</div>
                              </div>
                              {license.features.ecosystemVividbooks ? (
                                <CheckCircle2 className="w-6 h-6 text-violet-500 flex-shrink-0" />
                              ) : (
                                <span className="text-sm text-slate-400 font-medium bg-slate-200 px-3 py-1 rounded-full">Neaktivní</span>
                              )}
                            </div>
                          </div>

                          {/* Vividbooks Wall */}
                          <div className={`rounded-2xl p-5 border ${
                            license.features.vividboardWall 
                              ? 'bg-emerald-50 border-emerald-200' 
                              : 'bg-slate-50 border-slate-200'
                          }`}>
                            <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${
                                license.features.vividboardWall 
                                  ? 'bg-emerald-100 text-emerald-600' 
                                  : 'bg-slate-200 text-slate-400'
                              }`}>
                                <Shield className="w-6 h-6" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-slate-800">Vividbooks Wall</div>
                                <div className="text-sm text-slate-500 mt-0.5">Nekonečná nástěnka</div>
                              </div>
                              {license.features.vividboardWall ? (
                                <span className="text-sm text-emerald-600 font-bold bg-emerald-100 px-3 py-1 rounded-full">Zdarma</span>
                              ) : (
                                <span className="text-sm text-slate-400 font-medium bg-slate-200 px-3 py-1 rounded-full">Neaktivní</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </section>
                    )}

                    {/* Colleagues */}
                    {school && colleagues.length > 0 && (
                      <section>
                        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Kolegové z Vividbooks ({colleagues.length})
                        </h2>
                        <ColleaguesList colleagues={colleagues} />
                      </section>
                    )}

                    {/* Admin Link */}
                    <section className="pt-4 border-t border-slate-100">
                      <button
                        onClick={() => navigate('/admin/licence')}
                        className="w-full flex items-center justify-between px-6 py-4 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-colors group border border-slate-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-white p-2 rounded-lg border border-slate-200 text-slate-500 group-hover:text-slate-700">
                            <Settings className="w-5 h-5" />
                          </div>
                          <span className="font-medium text-slate-700 group-hover:text-slate-900">Správa licencí (Admin)</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600" />
                      </button>
                    </section>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

// Compact Subject Card Component - Square in single row
function SubjectCard({ subject, license }: { subject: SubjectMeta; license?: SubjectLicense }) {
  const isActive = license ? isLicenseActive(license) : false;

  if (!license || !isActive) {
    // Not purchased - show inactive
    return (
      <div className="flex-1 bg-slate-50/50 rounded-xl p-3 border-2 border-slate-200 border-dashed flex flex-col h-24 min-w-0">
        <div className="font-bold text-sm text-slate-400 mb-1 truncate">{subject.label}</div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-500 font-semibold w-fit">
          Neaktivní
        </span>
        <button className="mt-auto w-full py-1 text-[10px] font-medium border border-slate-200 rounded text-slate-400 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 transition-colors">
          Zakoupit
        </button>
      </div>
    );
  }

  // Purchased - show active with tier info
  const tierConfig = getCompactTierConfig(license.tier);
  
  return (
    <div className={`flex-1 rounded-xl p-3 border-2 flex flex-col h-24 min-w-0 ${tierConfig.bgClass} ${tierConfig.borderClass}`}>
      <div className={`font-bold text-sm mb-1 truncate ${tierConfig.titleClass}`}>
        {subject.label}
      </div>
      <span 
        className="text-[10px] px-2 py-0.5 rounded-full font-semibold w-fit text-white mb-1"
        style={{ backgroundColor: tierConfig.badgeColor }}
      >
        Aktivní
      </span>
      <div className={`text-[10px] font-medium leading-tight ${tierConfig.subtitleClass}`}>
        {tierConfig.shortLabel}
      </div>
      <div className="text-[9px] text-slate-400 mt-auto font-medium">
        do {formatLicenseDate(license.validUntil)}
      </div>
    </div>
  );
}

// Helper for tier display in compact cards
function getCompactTierConfig(tier: string): {
  shortLabel: string;
  bgClass: string;
  borderClass: string;
  titleClass: string;
  subtitleClass: string;
  badgeColor: string;
} {
  switch (tier) {
    case 'vividbooks-tridni':
      return {
        shortLabel: 'Třídní',
        bgClass: 'bg-purple-50/50',
        borderClass: 'border-purple-200',
        titleClass: 'text-purple-700',
        subtitleClass: 'text-purple-600',
        badgeColor: '#7c3aed',
      };
    case 'vividbooks-tvurce':
      return {
        shortLabel: 'Tvůrce',
        bgClass: 'bg-indigo-50/50',
        borderClass: 'border-indigo-200',
        titleClass: 'text-indigo-700',
        subtitleClass: 'text-indigo-600',
        badgeColor: '#4f46e5',
      };
    case 'vividbooks-knihovna':
    case 'digital-library':
      return {
        shortLabel: 'Knihovna',
        bgClass: 'bg-blue-50/50',
        borderClass: 'border-blue-200',
        titleClass: 'text-blue-700',
        subtitleClass: 'text-blue-600',
        badgeColor: '#2563eb',
      };
    case 'vividbooks-sesity':
    case 'workbooks':
    default:
      return {
        shortLabel: 'Sešity',
        bgClass: 'bg-green-50/50',
        borderClass: 'border-green-200',
        titleClass: 'text-slate-800',
        subtitleClass: 'text-green-600',
        badgeColor: '#16a34a',
      };
  }
}