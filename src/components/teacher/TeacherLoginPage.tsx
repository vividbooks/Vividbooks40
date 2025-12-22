import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Eye, EyeOff, Loader2, LogOut } from 'lucide-react';
import { supabase } from '../../utils/supabase/client';
import { useViewMode } from '../../contexts/ViewModeContext';
import VividLogo from '../../imports/Group70';
import * as storage from '../../utils/profile-storage';

const SAVED_SCHOOL_KEY = 'vivid-teacher-school';
const SAVED_TEACHERS_KEY = 'vivid-teacher-school-teachers';

interface Teacher {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

interface School {
  id: string;
  name: string;
  code: string;
}

type Step = 'school-code' | 'select-teacher' | 'enter-password' | 'create-profile';

export function TeacherLoginPage() {
  const navigate = useNavigate();
  const { setViewMode } = useViewMode();
  
  // State
  const [step, setStep] = useState<Step>('school-code');
  const [schoolCode, setSchoolCode] = useState('');
  const [school, setSchool] = useState<School | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  
  // New profile state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Load saved school on mount
  useEffect(() => {
    const loadSavedSchool = async () => {
      try {
        const savedSchoolStr = localStorage.getItem(SAVED_SCHOOL_KEY);
        const savedTeachersStr = localStorage.getItem(SAVED_TEACHERS_KEY);
        
        if (savedSchoolStr) {
          const savedSchool = JSON.parse(savedSchoolStr);
          setSchool(savedSchool);
          setSchoolCode(savedSchool.code);
          
          // Load teachers - either from cache or fresh
          if (savedTeachersStr) {
            setTeachers(JSON.parse(savedTeachersStr));
          }
          
          // Always refresh teachers list in background
          const { data: teachersData } = await supabase
            .from('teachers')
            .select('*')
            .eq('school_id', savedSchool.id)
            .order('name');
          
          if (teachersData) {
            setTeachers(teachersData);
            localStorage.setItem(SAVED_TEACHERS_KEY, JSON.stringify(teachersData));
          }
          
          setStep('select-teacher');
        }
      } catch (err) {
        console.error('Error loading saved school:', err);
      } finally {
        setInitialLoading(false);
      }
    };
    
    loadSavedSchool();
  }, []);

  // Save school to localStorage after successful selection
  const saveSchoolToStorage = (schoolData: School, teachersData: Teacher[]) => {
    localStorage.setItem(SAVED_SCHOOL_KEY, JSON.stringify(schoolData));
    localStorage.setItem(SAVED_TEACHERS_KEY, JSON.stringify(teachersData));
  };

  // Clear saved school (change school)
  const handleChangeSchool = () => {
    localStorage.removeItem(SAVED_SCHOOL_KEY);
    localStorage.removeItem(SAVED_TEACHERS_KEY);
    setSchool(null);
    setTeachers([]);
    setSchoolCode('');
    setStep('school-code');
  };

  // Handle school code submission
  const handleSchoolCodeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!schoolCode.trim()) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      // Look up school by code
      const { data: schoolData, error: schoolError } = await supabase
        .from('schools')
        .select('*')
        .eq('code', schoolCode.toUpperCase())
        .single();
      
      if (schoolError || !schoolData) {
        setError('Škola s tímto kódem nebyla nalezena');
        setIsLoading(false);
        return;
      }
      
      setSchool(schoolData);
      
      // Load teachers from this school
      const { data: teachersData, error: teachersError } = await supabase
        .from('teachers')
        .select('*')
        .eq('school_id', schoolData.id)
        .order('name');
      
      if (teachersError) {
        console.error('Error loading teachers:', teachersError);
        setError('Nepodařilo se načíst učitele');
        setIsLoading(false);
        return;
      }
      
      const teachersList = teachersData || [];
      setTeachers(teachersList);
      
      // Save school to localStorage for next time
      saveSchoolToStorage(schoolData, teachersList);
      
      setStep('select-teacher');
    } catch (err) {
      console.error('Error:', err);
      setError('Nastala chyba při načítání');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle teacher selection
  const handleSelectTeacher = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setPassword('');
    setError('');
    setStep('enter-password');
  };

  // Handle password submission
  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTeacher || !password) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      // Try to sign in with email and password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: selectedTeacher.email,
        password: password,
      });
      
      if (signInError) {
        setError('Nesprávné heslo');
        setIsLoading(false);
        return;
      }
      
      // Save user profile to localStorage for ProfilePageLayout
      if (school) {
        const userProfile = {
          id: selectedTeacher.id,
          userId: selectedTeacher.id,
          email: selectedTeacher.email,
          name: selectedTeacher.name,
          role: 'teacher' as const,
          schoolId: school.id,
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
        };
        storage.saveCurrentUserProfile(userProfile);
        
        // Update teacher's last_active in Supabase for analytics
        await supabase
          .from('teachers')
          .update({ 
            last_active: new Date().toISOString(),
            activity_level: 'active'
          })
          .eq('id', selectedTeacher.id);
      }
      
      // Success - set teacher view mode and redirect to library
      setViewMode('teacher');
      navigate('/library/my-content');
    } catch (err) {
      console.error('Login error:', err);
      setError('Nastala chyba při přihlašování');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle new profile creation
  const handleCreateProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail || !newPassword || !school) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newEmail,
        password: newPassword,
      });
      
      if (authError) {
        setError(authError.message);
        setIsLoading(false);
        return;
      }
      
      // Create teacher profile
      const { error: profileError } = await supabase
        .from('teachers')
        .insert({
          id: authData.user?.id,
          school_id: school.id,
          name: newName,
          email: newEmail,
          last_active: new Date().toISOString(),
          activity_level: 'active',
        });
      
      if (profileError) {
        console.error('Profile creation error:', profileError);
        setError('Nepodařilo se vytvořit profil');
        setIsLoading(false);
        return;
      }
      
      // Save user profile to localStorage for ProfilePageLayout
      if (school && authData.user) {
        const userProfile = {
          id: authData.user.id,
          userId: authData.user.id,
          email: newEmail,
          name: newName,
          role: 'teacher' as const,
          schoolId: school.id,
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
        };
        storage.saveCurrentUserProfile(userProfile);
      }
      
      // Success - set teacher view mode and redirect to library
      setViewMode('teacher');
      navigate('/library/my-content');
    } catch (err) {
      console.error('Registration error:', err);
      setError('Nastala chyba při registraci');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate avatar with initials
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Generate random pastel color based on name (hex values for inline styles)
  const getAvatarColor = (name: string): string => {
    const colors = [
      '#FACC15', // yellow
      '#60A5FA', // blue
      '#FB923C', // orange
      '#4ADE80', // green
      '#F472B6', // pink
      '#A78BFA', // purple
      '#F87171', // red
      '#2DD4BF', // teal
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Login form */}
      <div 
        className="flex-1 flex flex-col items-center justify-center p-8"
        style={{ background: 'linear-gradient(180deg, #e8eef5 0%, #d9e2ec 100%)' }}
      >
        {/* Back button - only show when navigating away from main step */}
        {(step === 'enter-password' || step === 'create-profile') && (
          <button
            onClick={() => {
              setStep('select-teacher');
              setError('');
            }}
            className="absolute top-6 left-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Zpět
          </button>
        )}

        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="w-40 h-20" style={{ color: '#4E5871' }}>
              <VividLogo />
            </div>
          </div>

          {/* Initial Loading */}
          {initialLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400 mb-4" />
              <p className="text-gray-500">Načítání...</p>
            </div>
          )}

          {/* Step: School Code */}
          {!initialLoading && step === 'school-code' && (
            <div className="text-center">
              <p className="text-gray-600 mb-8">
                Aplikace ve které najdete naše online předměty a pracovní sešity.
              </p>
              
              <form onSubmit={handleSchoolCodeSubmit}>
                <p className="text-sm text-gray-500 mb-3">Přihlašte se:</p>
                
                <input
                  type="text"
                  value={schoolCode}
                  onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                  placeholder="Zadejte KÓD ŠKOLY"
                  className="w-full px-6 py-4 border border-gray-300 text-center text-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{ borderRadius: '6px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}
                />
                
                {error && (
                  <p className="mt-3 text-red-500 text-sm">{error}</p>
                )}
                
                <button
                  type="submit"
                  disabled={isLoading || !schoolCode.trim()}
                  className="w-full mt-6 py-4 text-white font-medium transition-all disabled:opacity-50"
                  style={{ 
                    borderRadius: '6px',
                    background: '#4a5568',
                    boxShadow: '0 4px 15px rgba(74, 85, 104, 0.3)',
                  }}
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    'Pokračovat'
                  )}
                </button>
              </form>
              
              <div className="mt-8">
                <p className="text-sm text-gray-500 mb-3">Nemáte Vividbooks účet?</p>
                <button 
                  className="px-6 py-3 text-white font-medium"
                  style={{ borderRadius: '6px', background: '#f6ad55' }}
                  onClick={() => window.open('https://vividbooks.com/trial', '_blank')}
                >
                  Zaregistrujte si přístup na 14 dní zdarma
                </button>
              </div>
            </div>
          )}

          {/* Step: Select Teacher */}
          {!initialLoading && step === 'select-teacher' && (
            <div className="text-center">
              <h2 className="text-2xl font-medium text-gray-800 mb-2">
                Kdo dnes učí?
              </h2>
              <div className="flex items-center justify-center gap-2 mb-8">
                <p className="text-gray-500">
                  {school?.name}
                </p>
                <button
                  onClick={handleChangeSchool}
                  className="p-1.5 rounded-full hover:bg-gray-200 transition-colors"
                  title="Změnit školu"
                >
                  <LogOut className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              
              <div className="grid grid-cols-3 gap-6 mb-8">
                {teachers.map((teacher) => (
                  <button
                    key={teacher.id}
                    onClick={() => handleSelectTeacher(teacher)}
                    className="flex flex-col items-center group"
                  >
                    <div 
                      className="w-20 h-20 rounded-full flex items-center justify-center text-white text-xl font-bold mb-2 transition-transform group-hover:scale-110"
                      style={{ backgroundColor: getAvatarColor(teacher.name), boxShadow: '0 4px 15px rgba(0,0,0,0.15)' }}
                    >
                      {teacher.avatar_url ? (
                        <img 
                          src={teacher.avatar_url} 
                          alt={teacher.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        getInitials(teacher.name)
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-800">{teacher.name}</p>
                  </button>
                ))}
                
                {/* Add new teacher button */}
                <button
                  onClick={() => {
                    setStep('create-profile');
                    setError('');
                  }}
                  className="flex flex-col items-center group"
                >
                  <div 
                    className="w-20 h-20 rounded-full flex items-center justify-center border-2 border-dashed border-gray-400 text-gray-400 mb-2 transition-all group-hover:border-blue-500 group-hover:text-blue-500 group-hover:scale-110"
                  >
                    <Plus className="w-8 h-8" />
                  </div>
                  <p className="text-sm font-medium text-gray-600">Nový profil</p>
                </button>
              </div>
              
              {teachers.length === 0 && (
                <p className="text-gray-500 mb-4">
                  V této škole zatím nejsou žádní učitelé.
                </p>
              )}
            </div>
          )}

          {/* Step: Enter Password */}
          {!initialLoading && step === 'enter-password' && selectedTeacher && (
            <div className="text-center">
              {/* Circle avatar with initials */}
              <div 
                className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4"
                style={{ backgroundColor: getAvatarColor(selectedTeacher.name), boxShadow: '0 4px 15px rgba(0,0,0,0.15)' }}
              >
                {selectedTeacher.avatar_url ? (
                  <img 
                    src={selectedTeacher.avatar_url} 
                    alt={selectedTeacher.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  getInitials(selectedTeacher.name)
                )}
              </div>
              
              <h2 className="text-xl font-medium text-gray-800 mb-1">
                {selectedTeacher.name}
              </h2>
              <p className="text-gray-500 mb-6">{school?.name}</p>
              
              <form onSubmit={handlePasswordSubmit}>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Zadejte heslo"
                    className="w-full px-6 py-4 pr-12 border border-gray-300 text-center text-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    style={{ borderRadius: '6px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                
                {error && (
                  <p className="mt-3 text-red-500 text-sm">{error}</p>
                )}
                
                <button
                  type="submit"
                  disabled={isLoading || !password}
                  className="w-full mt-6 py-4 text-white font-medium transition-all disabled:opacity-50"
                  style={{ 
                    borderRadius: '6px',
                    background: '#4a5568',
                    boxShadow: '0 4px 15px rgba(74, 85, 104, 0.3)',
                  }}
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    'Přihlásit se'
                  )}
                </button>
              </form>
              
              <button
                className="mt-4 text-sm text-gray-500 hover:text-gray-700"
                onClick={() => alert('Funkce resetování hesla bude brzy k dispozici.')}
              >
                Zapomněli jste heslo?
              </button>
            </div>
          )}

          {/* Step: Create Profile */}
          {!initialLoading && step === 'create-profile' && (
            <div>
              <h2 className="text-2xl font-medium text-gray-800 mb-2 text-center">
                Nový profil učitele
              </h2>
              <p className="text-gray-500 mb-6 text-center">{school?.name}</p>
              
              <form onSubmit={handleCreateProfile} className="space-y-4">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Jméno a příjmení"
                  className="w-full px-6 py-4 border border-gray-300 text-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{ borderRadius: '6px' }}
                  required
                />
                
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="E-mail"
                  className="w-full px-6 py-4 border border-gray-300 text-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{ borderRadius: '6px' }}
                  required
                />
                
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Heslo"
                  className="w-full px-6 py-4 border border-gray-300 text-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{ borderRadius: '6px' }}
                  required
                />
                
                {error && (
                  <p className="text-red-500 text-sm text-center">{error}</p>
                )}
                
                <button
                  type="submit"
                  disabled={isLoading || !newName || !newEmail || !newPassword}
                  className="w-full py-4 text-white font-medium transition-all disabled:opacity-50"
                  style={{ 
                    borderRadius: '6px',
                    background: '#4a5568',
                    boxShadow: '0 4px 15px rgba(74, 85, 104, 0.3)',
                  }}
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    'Vytvořit profil a přihlásit se'
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Right side - Testimonial */}
      <div 
        className="hidden lg:flex flex-1 flex-col items-center justify-center p-12"
        style={{ background: '#fafafa' }}
      >
        <div className="max-w-md">
          <h3 className="text-xl font-medium text-gray-700 mb-6">Vaše reakce:</h3>
          <blockquote 
            className="text-2xl leading-relaxed"
            style={{ color: '#9ca3af' }}
          >
            Dobrý den, chtěl bych Vám oznámit svůj názor na vividbooks. Je mi 12 let a během prvních deseti minut jsem pochopil vztlakovou a gravitační sílu. Proto si myslím, že vividbooks je skvělý výukový nástroj a proto mu dávám 15 z 10.
          </blockquote>
        </div>
      </div>
    </div>
  );
}

