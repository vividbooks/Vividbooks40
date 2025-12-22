import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  School as SchoolIcon, 
  Mail, 
  ChevronRight,
  ChevronDown,
  Shield,
  Sparkles,
  BookOpen,
  Users,
  Settings,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Menu,
  X,
  FileText,
  Wrench,
  GraduationCap,
  Headphones,
  UserPlus,
  Clock,
  Activity,
  LogOut,
  User,
  Building2,
  Printer,
  ShoppingCart,
  Home,
  Copy,
  BarChart3
} from 'lucide-react';
import { 
  School, 
  UserProfile, 
  SchoolLicense, 
  SubjectLicense,
  Colleague,
  SubjectMeta,
  SUBJECTS,
  isLicenseActive,
  isFeatureLicenseActive,
  formatLicenseDate,
  FeatureLicense,
} from '../../types/profile';
import { supabase } from '../../utils/supabase/client';
import { SchoolPairing } from './SchoolPairing';
import { ColleaguesList } from './ColleaguesList';
import * as storage from '../../utils/profile-storage';
import VividLogo from '../../imports/Group70';
import { ToolsMenu } from '../ToolsMenu';
import { ToolsDropdown } from '../ToolsDropdown';
import { useViewMode } from '../../contexts/ViewModeContext';
import { useStudentAuth } from '../../contexts/StudentAuthContext';

interface ProfilePageLayoutProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

type ProfileSection = 'ucet' | 'licence' | 'nastroje' | 'kolegove' | 'svp' | 'podpora';

export function ProfilePageLayout({ theme, toggleTheme }: ProfilePageLayoutProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [license, setLicense] = useState<SchoolLicense | null>(null);
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [showPairing, setShowPairing] = useState(false);
  const [authUser, setAuthUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState<{ type: 'teacher' | 'student'; code: string } | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<1 | 2>(2);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(['Fyzika', 'Matematika-2']);
  
  // Get current view mode (teacher or student)
  const { isStudent: viewModeIsStudent, currentStudent } = useViewMode();
  const { student: authStudent } = useStudentAuth();
  
  // User is student if either viewMode says so OR if there's an authenticated student
  const isStudent = viewModeIsStudent || !!authStudent;
  
  // Active section from URL or default to 'ucet'
  const activeSection = (searchParams.get('section') as ProfileSection) || 'ucet';
  const setActiveSection = (section: ProfileSection) => {
    setSearchParams({ section });
  };

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
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

  const loadSchool = async (schoolId: string) => {
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

  const loadLicense = async (schoolId: string) => {
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
        // Also save to localStorage so useEcosystemAccess hook can access it
        storage.saveLicense(license);
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

  const handleLogout = async () => {
    try {
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      // Clear localStorage
      localStorage.removeItem('vivid-teacher-school');
      localStorage.removeItem('vivid-teacher-school-teachers');
      localStorage.removeItem('viewMode');
      localStorage.removeItem('vividbooks_current_user_profile');
      
      // Redirect to login page
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
      // Still redirect even if error
      navigate('/');
    }
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
        // Also save to localStorage so useEcosystemAccess hook can access it
        storage.saveLicense(license);
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
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="flex">
        {/* Left Sidebar */}
        <aside 
          className={`
            top-0 h-screen shrink-0 flex flex-col 
            transition-all duration-300 ease-in-out
            fixed left-0 z-30 w-[294px]
            ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
            lg:sticky lg:translate-x-0 lg:shadow-none lg:w-[312px]
            ${toolsOpen ? 'bg-[#4E5871]' : 'bg-white border-r border-slate-200'}
          `}
        >
          <div className={`w-[294px] lg:w-[312px] h-full flex flex-col min-w-[294px] lg:min-w-[312px] ${toolsOpen ? 'bg-[#4E5871]' : 'bg-white'}`}>
            {/* Header */}
            <div className={`p-4 ${toolsOpen ? '' : 'border-b border-slate-200'}`}>
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
                  <div className="flex items-center justify-center min-h-[40px] w-20">
                    <div className="w-20 h-10 text-[#4E5871]">
                      <VividLogo />
                    </div>
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
                    className="lg:hidden p-1.5 rounded-md transition-colors text-slate-600 hover:bg-slate-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              )}
            </div>

            {/* Navigation Menu */}
            <div className={`flex-1 overflow-y-auto ${toolsOpen ? 'text-white bg-[#4E5871]' : 'text-slate-700'}`}>
              {toolsOpen ? (
                <ToolsMenu 
                  activeItem="profile"
                  onItemClick={() => {
                    setToolsOpen(false);
                    setSidebarOpen(false);
                  }}
                  isStudentMode={isStudent}
                />
              ) : (
                /* Profile Menu - White background */
                <div className="p-4 space-y-1 h-full flex flex-col">
                  {/* Profile Menu Items */}
                  <button
                    onClick={() => setActiveSection('ucet')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                      activeSection === 'ucet' 
                        ? 'bg-indigo-50 text-indigo-700 font-medium' 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    <User className="w-5 h-5" />
                    <span>Účet a škola</span>
                  </button>

                  {/* Teacher-only menu items */}
                  {!isStudent && (
                    <>
                      <button
                        onClick={() => setActiveSection('licence')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                          activeSection === 'licence' 
                            ? 'bg-indigo-50 text-indigo-700 font-medium' 
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                        }`}
                      >
                        <FileText className="w-5 h-5" />
                        <span>Licence předmětů</span>
                      </button>
                      
                      <button
                        onClick={() => setActiveSection('nastroje')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                          activeSection === 'nastroje' 
                            ? 'bg-indigo-50 text-indigo-700 font-medium' 
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                        }`}
                      >
                        <Wrench className="w-5 h-5" />
                        <span>Zakoupené nástroje</span>
                      </button>
                      
                      <button
                        onClick={() => setActiveSection('kolegove')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                          activeSection === 'kolegove' 
                            ? 'bg-indigo-50 text-indigo-700 font-medium' 
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                        }`}
                      >
                        <Users className="w-5 h-5" />
                        <span>Moji kolegové</span>
                      </button>
                      
                      <button
                        onClick={() => setActiveSection('svp')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                          activeSection === 'svp' 
                            ? 'bg-indigo-50 text-indigo-700 font-medium' 
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                        }`}
                      >
                        <GraduationCap className="w-5 h-5" />
                        <span>Moje ŠVP</span>
                      </button>
                      
                      <button
                        onClick={() => navigate('/library/profile/statistics')}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                      >
                        <BarChart3 className="w-5 h-5" />
                        <span>Moje statistiky</span>
                      </button>
                    </>
                  )}
                  
                  <button
                    onClick={() => setActiveSection('podpora')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                      activeSection === 'podpora' 
                        ? 'bg-indigo-50 text-indigo-700 font-medium' 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    <Headphones className="w-5 h-5" />
                    <span>Online podpora</span>
                  </button>

                  {/* Další služby - Teacher only */}
                  {!isStudent && (
                    <div className="mt-6 pt-4 border-t border-slate-200">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-4">
                        Další služby
                      </h3>
                      <button
                        onClick={() => window.open('https://vividbooks.cz/nakoupit', '_blank')}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                      >
                        <ShoppingCart className="w-5 h-5" />
                        <span>Nakoupit pracovní sešity a učebnice</span>
                      </button>
                      <button
                        onClick={() => window.open('https://vividbooks.cz/tisknout', '_blank')}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                      >
                        <Printer className="w-5 h-5" />
                        <span>Tisknout vlastní pracovní sešit</span>
                      </button>
                    </div>
                  )}

                  {/* Logout button */}
                  <div className="mt-6 pt-4 border-t border-slate-200">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="w-5 h-5" />
                      <span>Odhlásit se</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 z-20 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">
            {/* Mobile header */}
            <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-md hover:bg-slate-100 text-slate-600"
              >
                <Menu className="h-5 w-5" />
              </button>
              <span className="font-semibold text-slate-800">Můj účet</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-[calc(100vh-60px)]">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                  <span className="text-slate-600">Načítám profil...</span>
                </div>
              </div>
            ) : (
              <div className="p-6 lg:p-8">
                {/* Section: Účet a škola */}
                {activeSection === 'ucet' && (
                  <div className="max-w-4xl">
                    <h1 className="text-2xl font-bold text-slate-800 mb-6">Účet a škola</h1>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Profile Card - Light Blue */}
                      <div className="rounded-2xl shadow-sm border border-blue-100 p-6" style={{ backgroundColor: '#f0f7ff' }}>
                        <div className="flex items-center gap-4 mb-6">
                          {isStudent ? (
                            <GraduationCap className="w-10 h-10 text-emerald-600" />
                          ) : (
                            <User className="w-10 h-10 text-slate-700" />
                          )}
                          <div>
                            <h2 className="text-lg font-bold text-slate-800">Můj profil</h2>
                            <p className="text-sm text-slate-500">Informace o {isStudent ? 'tvém' : 'vašem'} účtu</p>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 p-3 bg-white/80 rounded-xl">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-slate-400 font-medium">Jméno</div>
                              <div className="text-sm font-semibold text-slate-800 truncate">
                                {isStudent && currentStudent ? currentStudent.name : displayName}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3 p-3 bg-white/80 rounded-xl">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-slate-400 font-medium">E-mail</div>
                              <div className="text-sm font-semibold text-slate-800 truncate">
                                {isStudent && currentStudent ? currentStudent.email : displayEmail}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3 p-3 bg-white/80 rounded-xl">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-slate-400 font-medium">Role</div>
                              <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                {isStudent ? (
                                  <>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                      Žák
                                    </span>
                                  </>
                                ) : (
                                  'Učitel'
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Student-specific: Show student code */}
                          {isStudent && currentStudent && (
                            <div className="flex items-center gap-3 p-3 bg-white/80 rounded-xl">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-slate-400 font-medium">Žákovský kód</div>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="text-lg font-mono font-bold text-emerald-700">ZSDU2024S</div>
                                  <button 
                                    onClick={() => {
                                      navigator.clipboard.writeText('ZSDU2024S');
                                    }}
                                    className="p-1.5 rounded-lg hover:bg-emerald-100 text-emerald-600 transition-colors"
                                    title="Kopírovat kód"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Teacher-specific: Grade and subjects */}
                          {!isStudent && (
                            <>
                              <div className="flex items-center gap-3 p-3 bg-white/80 rounded-xl">
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs text-slate-400 font-medium">Stupeň</div>
                                  <div className="flex gap-2 mt-1">
                                    <button 
                                      onClick={() => setSelectedGrade(1)}
                                      className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                                        selectedGrade === 1 
                                          ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                                          : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'
                                      }`}
                                    >
                                      1. stupeň
                                    </button>
                                    <button 
                                      onClick={() => setSelectedGrade(2)}
                                      className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                                        selectedGrade === 2 
                                          ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                                          : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'
                                      }`}
                                    >
                                      2. stupeň
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <div className="p-3 bg-white/80 rounded-xl">
                                <div className="text-xs text-slate-400 font-medium mb-3">Předměty které učím</div>
                                <div className="grid grid-cols-2 gap-3">
                                  {selectedGrade === 2 ? (
                                    <>
                                      {[
                                        { id: 'Fyzika', label: 'Fyzika' },
                                        { id: 'Chemie', label: 'Chemie' },
                                        { id: 'Přírodopis', label: 'Přírodopis' },
                                        { id: 'Matematika-2', label: 'Matematika' }
                                      ].map((subject) => (
                                        <label key={subject.id} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-slate-50 transition-colors">
                                          <input 
                                            type="checkbox" 
                                            checked={selectedSubjects.includes(subject.id)}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setSelectedSubjects([...selectedSubjects, subject.id]);
                                              } else {
                                                setSelectedSubjects(selectedSubjects.filter(s => s !== subject.id));
                                              }
                                            }}
                                            className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                          />
                                          <span className="text-sm text-slate-700">{subject.label}</span>
                                        </label>
                                      ))}
                                    </>
                                  ) : (
                                    <>
                                      {[
                                        { id: 'Matematika-1', label: 'Matematika' },
                                        { id: 'Prvouka', label: 'Prvouka' }
                                      ].map((subject) => (
                                        <label key={subject.id} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-slate-50 transition-colors">
                                          <input 
                                            type="checkbox" 
                                            checked={selectedSubjects.includes(subject.id)}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setSelectedSubjects([...selectedSubjects, subject.id]);
                                              } else {
                                                setSelectedSubjects(selectedSubjects.filter(s => s !== subject.id));
                                              }
                                            }}
                                            className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                          />
                                          <span className="text-sm text-slate-700">{subject.label}</span>
                                        </label>
                                      ))}
                                    </>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                        
                        <button
                          onClick={async () => {
                            await supabase.auth.signOut();
                            navigate('/');
                          }}
                          className="w-full mt-6 flex items-center justify-center gap-2 py-3 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Odhlásit se</span>
                        </button>
                      </div>

                      {/* School Card - Light Orange */}
                      <div className="rounded-2xl shadow-sm border border-orange-100 p-6" style={{ backgroundColor: '#fff7ed' }}>
                        {school || (isStudent && currentStudent) ? (
                          <>
                            <div className="flex items-center gap-4 mb-6">
                              <SchoolIcon className="w-10 h-10 text-slate-700" />
                              <div>
                                <h2 className="text-lg font-bold text-slate-800">Moje škola</h2>
                                <p className="text-sm text-slate-500">Propojeno se školou</p>
                              </div>
                            </div>
                            
                            <div className="space-y-4">
                              <div className="p-4 bg-white/80 rounded-xl border border-orange-100">
                                <div className="text-xs text-orange-600 font-medium mb-1">Název školy</div>
                                <div className="text-base font-bold text-slate-800">
                                  {school?.name || 'ZŠ Dukelská, Strakonice'}
                                </div>
                                <div className="text-sm text-slate-500 mt-1">
                                  {school?.address ? `${school.address}, ${school.city}` : 'Dukelská 42, Strakonice'}
                                </div>
                              </div>
                              
                              {/* Student-specific: Class info and teacher */}
                              {isStudent && currentStudent && (
                                <>
                                  <div className="p-4 bg-white/80 rounded-xl border border-emerald-100">
                                    <div className="text-xs text-emerald-600 font-medium mb-1">Moje třída</div>
                                    <div className="text-2xl font-bold text-emerald-700">{currentStudent.className}</div>
                                    <div className="text-sm text-slate-500 mt-1">{currentStudent.grade}. ročník</div>
                                  </div>
                                  
                                  <div className="p-4 bg-white/80 rounded-xl border border-indigo-100">
                                    <div className="text-xs text-indigo-600 font-medium mb-1">Přidán učitelem</div>
                                    <div className="flex items-center gap-3 mt-2">
                                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                                        <User className="w-5 h-5 text-indigo-600" />
                                      </div>
                                      <div>
                                        <div className="text-sm font-semibold text-slate-800">Mgr. Petra Svobodová</div>
                                        <div className="text-xs text-slate-500">Třídní učitel</div>
                                      </div>
                                    </div>
                                  </div>
                                </>
                              )}

                              {/* Teacher-specific: Codes */}
                              {!isStudent && school && (
                                <div className="grid grid-cols-2 gap-3">
                                  <button
                                    onClick={() => setShowCodeModal({ type: 'teacher', code: school.code })}
                                    className="p-4 bg-white/80 rounded-xl border border-indigo-100 text-center hover:bg-indigo-50 hover:border-indigo-200 transition-colors cursor-pointer"
                                  >
                                    <div className="text-xs text-indigo-600 font-medium mb-1">Kód učitelský</div>
                                    <div className="text-xl font-mono font-bold text-indigo-700">{school.code}</div>
                                  </button>
                                  <button
                                    onClick={() => setShowCodeModal({ type: 'student', code: school.code + 'S' })}
                                    className="p-4 bg-white/80 rounded-xl border border-emerald-100 text-center hover:bg-emerald-50 hover:border-emerald-200 transition-colors cursor-pointer"
                                  >
                                    <div className="text-xs text-emerald-600 font-medium mb-1">Kód žákovský</div>
                                    <div className="text-xl font-mono font-bold text-emerald-700">{school.code}S</div>
                                  </button>
                                </div>
                              )}
                            </div>
                            
                            <button
                              onClick={() => {
                                setSchool(null);
                                setLicense(null);
                                if (profile) {
                                  storage.saveCurrentUserProfile({ ...profile, schoolId: undefined });
                                }
                              }}
                              className="w-full mt-6 flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl transition-colors font-medium"
                            >
                              <X className="w-4 h-4" />
                              <span>Odpojit se ze školy</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-4 mb-6">
                              <SchoolIcon className="w-10 h-10 text-slate-400" />
                              <div>
                                <h2 className="text-lg font-bold text-slate-800">Moje škola</h2>
                                <p className="text-sm text-slate-500">Nepropojeno</p>
                              </div>
                            </div>
                            
                            <div className="p-6 bg-white/80 rounded-xl border-2 border-dashed border-orange-200 text-center">
                              <p className="text-slate-500 text-sm mb-4">
                                {isStudent 
                                  ? 'Zadej kód třídy od svého učitele'
                                  : 'Zadejte kód školy pro přístup k licencím a materiálům'
                                }
                              </p>
                              <button
                                onClick={() => setShowPairing(true)}
                                className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl transition-colors"
                              >
                                Propojit se školou
                              </button>
                            </div>
                            
                            {!isStudent && (
                              <button
                                onClick={() => {
                                  // Set as homeschooler - create a special "homeschool" license
                                  const homeschoolId = 'homeschool-' + Date.now();
                                  if (profile) {
                                    storage.saveCurrentUserProfile({ ...profile, schoolId: homeschoolId, isHomeschooler: true });
                                  }
                                  setSchool({ id: homeschoolId, name: 'Domácí vzdělávání', teacherCode: '', studentCode: '' });
                                }}
                                className="w-full mt-4 flex items-center justify-center gap-2 py-3 text-slate-500 hover:text-slate-700 transition-colors font-medium text-sm"
                              >
                                <Home className="w-4 h-4" />
                                <span>Přihlásit jako domškolák</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Code Modal */}
                    {showCodeModal && (
                      <div 
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                        onClick={() => setShowCodeModal(null)}
                      >
                        <div 
                          className="relative bg-white rounded-3xl p-8 md:p-16 shadow-2xl max-w-4xl w-full mx-4 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => setShowCodeModal(null)}
                            className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            <X className="w-6 h-6" />
                          </button>
                          
                          <div className={`w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center ${
                            showCodeModal.type === 'teacher' 
                              ? 'bg-indigo-100' 
                              : 'bg-emerald-100'
                          }`}>
                            {showCodeModal.type === 'teacher' ? (
                              <User className="w-10 h-10 text-indigo-600" />
                            ) : (
                              <Users className="w-10 h-10 text-emerald-600" />
                            )}
                          </div>
                          
                          <h3 className={`text-lg font-semibold mb-2 ${
                            showCodeModal.type === 'teacher' ? 'text-indigo-600' : 'text-emerald-600'
                          }`}>
                            {showCodeModal.type === 'teacher' ? 'Kód pro učitele' : 'Kód pro žáky'}
                          </h3>
                          
                          <p className="text-slate-500 text-sm mb-6">
                            {showCodeModal.type === 'teacher' 
                              ? 'Sdílejte tento kód s kolegy učiteli'
                              : 'Sdílejte tento kód se svými žáky'
                            }
                          </p>
                          
                          <div className={`text-7xl sm:text-8xl md:text-9xl font-mono font-bold tracking-widest py-8 px-10 rounded-3xl ${
                            showCodeModal.type === 'teacher' 
                              ? 'bg-indigo-50 text-indigo-700 border-2 border-indigo-200' 
                              : 'bg-emerald-50 text-emerald-700 border-2 border-emerald-200'
                          }`} style={{ fontSize: 'clamp(3rem, 15vw, 10rem)' }}>
                            {showCodeModal.code}
                          </div>
                          
                          <p className="text-slate-400 text-xs mt-6">
                            Klikněte kamkoliv mimo pro zavření
                          </p>
                        </div>
                      </div>
                    )}

                  </div>
                )}

                {/* Section: Licence předmětů */}
                {activeSection === 'licence' && (
                  <div className="max-w-4xl">
                    <h1 className="text-2xl font-bold text-slate-800 mb-6">Licence předmětů</h1>
                    
                    {/* Subjects Section */}
                    {school ? (
                      <section>
                        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                          <BookOpen className="w-4 h-4" />
                          Předměty
                        </h2>

                        <div className="space-y-3">
                          {/* 2. stupeň */}
                          <div>
                            <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">2. stupeň</h3>
                            <div className="space-y-2">
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
                                  <SubjectTile 
                                    key={subject.id} 
                                    subject={subject} 
                                    license={subjectLicense} 
                                  />
                                );
                              })}
                            </div>
                          </div>

                          {/* 1. stupeň */}
                          <div>
                            <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">1. stupeň</h3>
                            <div className="space-y-2">
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
                                  <SubjectTile 
                                    key={subject.id} 
                                    subject={subject} 
                                    license={subjectLicense} 
                                  />
                                );
                              })}
                            </div>
                          </div>
                        </div>

                      </section>
                    ) : (
                      <div className="bg-white rounded-2xl p-8 shadow-sm border border-dashed border-slate-300 text-center">
                        <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">Nejste propojeni se školou</h3>
                        <p className="text-slate-500 mb-4">Pro zobrazení licencí předmětů se nejprve propojte se školou v sekci "Účet a škola"</p>
                        <button
                          onClick={() => setActiveSection('ucet')}
                          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors"
                        >
                          Přejít na Účet a škola
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Section: Zakoupené nástroje */}
                {activeSection === 'nastroje' && (
                  <div className="max-w-4xl">
                    <h1 className="text-2xl font-bold text-slate-800 mb-6">Nástroje</h1>
                    
                    <div className="space-y-6">
                      {/* Ekosystém Vividbooks */}
                      {(() => {
                        const ecosystemFeature = license?.features.ecosystemVividbooks as FeatureLicense | undefined;
                        const isEcosystemActive = isFeatureLicenseActive(ecosystemFeature);
                        return (
                          <div className={`rounded-2xl border-2 overflow-hidden ${
                            isEcosystemActive
                              ? 'bg-gradient-to-br from-violet-50 to-purple-50 border-violet-200' 
                              : 'bg-white border-slate-200'
                          }`}>
                            <div className="p-6">
                              <div className="flex items-start gap-4 mb-4">
                                <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                  isEcosystemActive
                                    ? 'bg-violet-100 text-violet-600' 
                                    : 'bg-slate-100 text-slate-400'
                                }`}>
                                  <Sparkles className="w-7 h-7" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-1">
                                    <h3 className="font-bold text-xl text-slate-800">Ekosystém Vividbooks</h3>
                                    {isEcosystemActive && (
                                      <span className="px-3 py-1 text-white text-xs font-bold rounded-full" style={{ backgroundColor: '#7c3aed' }}>Aktivní</span>
                                    )}
                                  </div>
                                  <p className="text-slate-500 text-sm">Kompletní sada nástrojů pro moderní výuku</p>
                                  {isEcosystemActive && ecosystemFeature?.validUntil && (
                                    <p className="text-xs text-violet-600 mt-1">Platná do {formatLicenseDate(ecosystemFeature.validUntil)}</p>
                                  )}
                                </div>
                              </div>
                              
                              <div className="space-y-2.5 mb-6 pl-1">
                                <div className="flex items-center gap-3 text-sm">
                                  <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${isEcosystemActive ? 'text-violet-500' : 'text-slate-300'}`} />
                                  <span className="text-slate-700">Systém a archivace mých tříd, výsledků a hodnocení</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                  <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${isEcosystemActive ? 'text-violet-500' : 'text-slate-300'}`} />
                                  <span className="text-slate-700">AI asistent a Nauč mě</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                  <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${isEcosystemActive ? 'text-violet-500' : 'text-slate-300'}`} />
                                  <span className="text-slate-700">Vividboard a neomezené úložiště</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                  <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${isEcosystemActive ? 'text-violet-500' : 'text-slate-300'}`} />
                                  <span className="text-slate-700">Tvorba a úprava Vividbooks lekcí a pracovních listů</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                  <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${isEcosystemActive ? 'text-violet-500' : 'text-slate-300'}`} />
                                  <span className="text-slate-700">Žákovské individuální prostory a profily</span>
                                </div>
                              </div>

                              {!isEcosystemActive && (
                                <div className="pt-3">
                                  <div className="text-xs text-slate-400 mb-2">Lze dokoupit pouze k Rozšířenému digitálnímu přístupu</div>
                                  <div className="flex items-center gap-4">
                                    <button className="text-sm text-violet-600 hover:text-violet-800 hover:underline transition-colors">
                                      Koupit pro školu · 19 900 Kč/rok →
                                    </button>
                                    <span className="text-slate-300">|</span>
                                    <button className="text-sm text-slate-500 hover:text-slate-700 hover:underline transition-colors">
                                      Koupit pro jednotlivce · 259 Kč/měsíc →
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Vividboard */}
                      {(() => {
                        const vividboardFeature = license?.features.vividboard as FeatureLicense | undefined;
                        const isVividboardActive = isFeatureLicenseActive(vividboardFeature);
                        return (
                          <div className={`rounded-2xl border-2 overflow-hidden ${
                            isVividboardActive
                              ? 'bg-gradient-to-br from-blue-50 to-sky-50 border-blue-200' 
                              : 'bg-white border-slate-200'
                          }`}>
                            <div className="p-6">
                              <div className="flex items-start gap-4 mb-4">
                                <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                  isVividboardActive ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
                                }`}>
                                  <FileText className="w-7 h-7" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-1">
                                    <h3 className="font-bold text-xl text-slate-800">Vividboard</h3>
                                    {isVividboardActive && (
                                      <span className="px-3 py-1 text-white text-xs font-bold rounded-full" style={{ backgroundColor: '#2563eb' }}>Aktivní</span>
                                    )}
                                  </div>
                                  <p className="text-slate-500 text-sm">Tvorba interaktivních materiálů a sledování výsledků</p>
                                  {isVividboardActive && vividboardFeature?.validUntil && (
                                    <p className="text-xs text-blue-600 mt-1">Platná do {formatLicenseDate(vividboardFeature.validUntil)}</p>
                                  )}
                                </div>
                              </div>
                              
                              <div className="space-y-2.5 mb-6 pl-1">
                                <div className="flex items-center gap-3 text-sm">
                                  <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${isVividboardActive ? 'text-blue-500' : 'text-slate-300'}`} />
                                  <span className="text-slate-700">Tvorba vlastních materiálů</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                  <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${isVividboardActive ? 'text-blue-500' : 'text-slate-300'}`} />
                                  <span className="text-slate-700">Výsledky a hodnocení žáků</span>
                                </div>
                              </div>

                              {!isVividboardActive && (
                                <div className="flex items-center gap-4 pt-2">
                                  <button className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors">
                                    Koupit pro školu · 9 900 Kč/rok →
                                  </button>
                                  <span className="text-slate-300">|</span>
                                  <button className="text-sm text-slate-500 hover:text-slate-700 hover:underline transition-colors">
                                    Koupit pro jednotlivce · 149 Kč/měsíc →
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Vividbooks Nástěnka */}
                      <div className="rounded-2xl border-2 bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200 overflow-hidden">
                        <div className="p-6">
                          <div className="flex items-start gap-4 mb-4">
                            <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-100 text-emerald-600">
                              <Shield className="w-7 h-7" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <h3 className="font-bold text-xl text-slate-800">Vividbooks Nástěnka</h3>
                                <span className="px-3 py-1 text-white text-xs font-bold rounded-full" style={{ backgroundColor: '#16a34a' }}>Zdarma</span>
                              </div>
                              <p className="text-slate-500 text-sm">Interaktivní nástěnka pro vaši třídu</p>
                            </div>
                          </div>
                          
                          <div className="space-y-2.5 pl-1">
                            <div className="flex items-center gap-3 text-sm">
                              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-500" />
                              <span className="text-slate-700">Interaktivní nástěnka zdarma</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section: Moji kolegové */}
                {activeSection === 'kolegove' && (
                  <div className="max-w-4xl">
                    <div className="flex items-center justify-between mb-6">
                      <h1 className="text-2xl font-bold text-slate-800">Moji kolegové</h1>
                      <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors">
                        <UserPlus className="w-4 h-4" />
                        Pozvat kolegu
                      </button>
                    </div>
                    
                    {colleagues.length > 0 ? (
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Jméno</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Aktivita</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Poslední přihlášení</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Stav</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {colleagues.map((colleague) => (
                              <tr key={colleague.userId} className="hover:bg-slate-50">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold">
                                      {colleague.name.charAt(0)}
                                    </div>
                                    <div>
                                      <div className="font-medium text-slate-800">{colleague.name}</div>
                                      <div className="text-xs text-slate-400">{colleague.email}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-slate-400" />
                                    <span className="text-sm text-slate-600">Aktivní</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-slate-400" />
                                    <span className="text-sm text-slate-600">
                                      {new Date(colleague.lastActiveAt).toLocaleDateString('cs-CZ')}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  {colleague.isOnline ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                      Online
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-500 text-xs font-medium rounded-full">
                                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span>
                                      Offline
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="bg-slate-50 rounded-xl p-8 text-center border border-dashed border-slate-300">
                        <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-slate-700 mb-2">Zatím žádní kolegové</h3>
                        <p className="text-slate-500 mb-4">Pozvěte své kolegy do Vividbooks</p>
                        <button className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors">
                          <UserPlus className="w-4 h-4" />
                          Pozvat kolegu
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Section: Moje ŠVP */}
                {activeSection === 'svp' && (
                  <div className="max-w-4xl">
                    <h1 className="text-2xl font-bold text-slate-800 mb-6">Moje ŠVP</h1>
                    
                    <div className="bg-slate-50 rounded-xl p-8 text-center border border-dashed border-slate-300">
                      <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <h3 className="text-lg font-medium text-slate-700 mb-2">Školní vzdělávací program</h3>
                      <p className="text-slate-500 mb-4">Tato funkce bude brzy k dispozici</p>
                    </div>
                  </div>
                )}

                {/* Section: Online podpora */}
                {activeSection === 'podpora' && (
                  <div className="max-w-4xl">
                    <h1 className="text-2xl font-bold text-slate-800 mb-6">Online podpora</h1>
                    
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                      <div className="flex items-start gap-4 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                          <Headphones className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-slate-800 mb-1">Potřebujete pomoc?</h3>
                          <p className="text-slate-500">Náš tým podpory je tu pro vás. Odpovíme vám co nejdříve.</p>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Předmět</label>
                          <input 
                            type="text" 
                            placeholder="Zadejte předmět zprávy"
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Zpráva</label>
                          <textarea 
                            rows={5}
                            placeholder="Popište váš problém nebo dotaz..."
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                          />
                        </div>
                        <button className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors">
                          Odeslat zprávu
                        </button>
                      </div>
                      
                      <div className="mt-8 pt-6 border-t border-slate-200">
                        <h4 className="font-medium text-slate-700 mb-3">Další možnosti kontaktu</h4>
                        <div className="flex gap-4">
                          <div className="flex items-center gap-2 text-slate-600">
                            <Mail className="w-4 h-4" />
                            <span className="text-sm">podpora@vividbooks.cz</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>
      </div>
    </div>
  );
}

// Subject Tile Component - Horizontal tile like tools
function SubjectTile({ subject, license }: { subject: SubjectMeta; license?: SubjectLicense }) {
  const isActive = license ? isLicenseActive(license) : false;

  if (!license || !isActive) {
    return (
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 border-dashed">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-slate-200 text-slate-400 flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-slate-400">{subject.label}</div>
            <div className="text-xs text-slate-400">Neaktivní</div>
          </div>
          <button className="px-4 py-2 border border-slate-300 text-slate-500 text-sm font-medium rounded-lg hover:bg-slate-100 transition-colors">
            Zakoupit
          </button>
        </div>
      </div>
    );
  }

  const isExtended = license.tier === 'digital-library';
  
  return (
    <div className={`rounded-xl p-4 border ${
      isExtended 
        ? 'bg-indigo-50 border-indigo-200' 
        : 'bg-green-50 border-green-200'
    }`}>
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          isExtended ? 'bg-indigo-100 text-indigo-600' : 'bg-green-100 text-green-600'
        }`}>
          <BookOpen className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className={`font-bold ${isExtended ? 'text-indigo-700' : 'text-slate-800'}`}>
            {subject.label}
          </div>
          <div className={`text-sm ${isExtended ? 'text-indigo-600' : 'text-green-600'}`}>
            {isExtended ? 'Rozšířený digitální přístup' : 'Základní digitální přístup'}
          </div>
          {!isExtended && (
            <div className="text-xs text-slate-500">(zdarma od 15 ks pracovních sešitů)</div>
          )}
        </div>
        <div className="text-right">
          <span 
            className="text-xs px-3 py-1 rounded-full font-bold text-white"
            style={{ backgroundColor: isExtended ? '#4f46e5' : '#16a34a' }}
          >
            Aktivní
          </span>
          <div className="text-xs text-slate-400 mt-1">
            do {formatLicenseDate(license.validUntil)}
          </div>
        </div>
      </div>
    </div>
  );
}

