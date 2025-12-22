import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  X,
  PanelLeft,
  PanelLeftClose,
  Users,
  BarChart3,
  Plus,
  ChevronRight,
  Trash2,
  Pencil,
  ClipboardList,
  Share2,
  Play,
  FileText,
  RefreshCw,
  Database,
  HardDrive,
  Mail,
  UserPlus,
} from 'lucide-react';
import VividLogo from '../imports/Group70';
import { ToolsDropdown } from './ToolsDropdown';
import { ToolsMenu } from './ToolsMenu';
import { StudentIndividualWork, ClassResultsGrid } from './classroom';
import { 
  getClasses as getSupabaseClasses,
  createClass as createSupabaseClass,
  addStudent as addSupabaseStudent,
  ClassGroup as SupabaseClassGroup,
  setDataSource,
  isUsingSupabase,
} from '../utils/supabase/classes';
import { 
  subscribeToSessions, 
  HistoricalSession, 
  formatSessionDate 
} from '../utils/session-history';

interface MyClassesLayoutProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

interface ClassGroup {
  id: string;
  name: string;
  studentsCount: number;
  createdAt: string;
}

interface TestResult {
  id: string;
  testName: string;
  className: string;
  date: string;
  averageScore: number;
  studentsCount: number;
}

export function MyClassesLayout({ theme, toggleTheme }: MyClassesLayoutProps) {
  const navigate = useNavigate();
  
  // Layout states
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [logoHovered, setLogoHovered] = useState(false);
  
  // Tab state: 'results', 'classes', or 'individual'
  const [activeTab, setActiveTab] = useState<'results' | 'classes' | 'individual'>('results');
  
  // Selected class for detail view
  const [selectedClass, setSelectedClass] = useState<ClassGroup | null>(null);
  
  // Hover states for highlighting
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);
  
  // Data source toggle - sync with localStorage
  const [useSupabaseData, setUseSupabaseData] = useState(() => isUsingSupabase());
  
  // Use new grid component for class detail
  const [useNewGrid, setUseNewGrid] = useState(true);
  
  // New class modal
  const [showNewClassModal, setShowNewClassModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassStudents, setNewClassStudents] = useState<Array<{ name: string; email: string }>>([
    { name: '', email: '' }
  ]);
  const [isCreatingClass, setIsCreatingClass] = useState(false);
  
  // Demo data for classes (only used in demo mode)
  const DEMO_CLASSES: ClassGroup[] = [
    { id: '1', name: '6.A', studentsCount: 28, createdAt: '2024-09-01' },
    { id: '2', name: '6.B', studentsCount: 26, createdAt: '2024-09-01' },
    { id: '3', name: '7.A', studentsCount: 24, createdAt: '2024-09-01' },
    { id: '4', name: '7.B', studentsCount: 25, createdAt: '2024-09-01' },
    { id: '5', name: '8.A', studentsCount: 22, createdAt: '2024-09-01' },
    { id: '6', name: '8.B', studentsCount: 23, createdAt: '2024-09-01' },
    { id: '7', name: '9.A', studentsCount: 21, createdAt: '2024-09-01' },
    { id: '8', name: '9.B', studentsCount: 20, createdAt: '2024-09-01' },
  ];
  
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true); // Start as true
  const [classesLoaded, setClassesLoaded] = useState(false);
  
  // Load classes based on data source - with retry logic
  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    
    const loadClasses = async () => {
      if (!useSupabaseData) {
        // Use demo data immediately
        if (isMounted) {
          setClasses(DEMO_CLASSES);
          setLoadingClasses(false);
          setClassesLoaded(true);
        }
        return;
      }
      
      // Load from Supabase with retry
      if (isMounted) setLoadingClasses(true);
      
      try {
        console.log('[MyClasses] Loading classes from Supabase...');
        const supabaseClasses = await getSupabaseClasses();
        
        if (isMounted) {
          console.log('[MyClasses] Loaded', supabaseClasses.length, 'classes');
          setClasses(supabaseClasses.map(c => ({
            id: c.id,
            name: c.name,
            studentsCount: c.students_count || 0,
            createdAt: c.created_at,
          })));
          setLoadingClasses(false);
          setClassesLoaded(true);
        }
      } catch (error) {
        console.error('[MyClasses] Error loading classes:', error);
        
        // Retry logic
        if (retryCount < maxRetries && isMounted) {
          retryCount++;
          console.log(`[MyClasses] Retrying... (${retryCount}/${maxRetries})`);
          setTimeout(loadClasses, 1000 * retryCount); // Exponential backoff
        } else if (isMounted) {
          setClasses([]);
          setLoadingClasses(false);
          setClassesLoaded(true);
        }
      }
    };
    
    // Load immediately
    loadClasses();
    
    return () => {
      isMounted = false;
    };
  }, [useSupabaseData]);
  
  // Toggle data source
  const handleToggleDataSource = () => {
    const newValue = !useSupabaseData;
    setUseSupabaseData(newValue);
    setDataSource(newValue);
  };
  
  // Add student row
  const addStudentRow = () => {
    setNewClassStudents([...newClassStudents, { name: '', email: '' }]);
  };
  
  // Remove student row
  const removeStudentRow = (index: number) => {
    if (newClassStudents.length > 1) {
      setNewClassStudents(newClassStudents.filter((_, i) => i !== index));
    }
  };
  
  // Update student row
  const updateStudentRow = (index: number, field: 'name' | 'email', value: string) => {
    const updated = [...newClassStudents];
    updated[index][field] = value;
    setNewClassStudents(updated);
  };
  
  // Create new class
  const handleCreateClass = async () => {
    if (!newClassName.trim()) return;
    
    setIsCreatingClass(true);
    
    // Filter out empty students
    const validStudents = newClassStudents.filter(s => s.name.trim());
    
    try {
      if (useSupabaseData) {
        // IMPORTANT: Ensure localStorage is in sync with React state before calling Supabase functions
        setDataSource(true);
        
        // Create in Supabase (teacher will be auto-created if needed)
        const newClass = await createSupabaseClass(newClassName);
        
        if (newClass) {
          // Add students
          for (const student of validStudents) {
            const colors = ['#EC4899', '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];
            const initials = student.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            await addSupabaseStudent({
              name: student.name,
              email: student.email || undefined,
              class_id: newClass.id,
              initials,
              color: colors[Math.floor(Math.random() * colors.length)],
            });
          }
          
          // Reload classes
          const updatedClasses = await getSupabaseClasses();
          setClasses(updatedClasses.map(c => ({
            id: c.id,
            name: c.name,
            studentsCount: c.students_count || 0,
            createdAt: c.created_at,
          })));
        }
      } else {
        // Demo mode - just add locally
        const newClass: ClassGroup = {
          id: `c_${Date.now()}`,
          name: newClassName,
          studentsCount: validStudents.length,
          createdAt: new Date().toISOString().split('T')[0],
        };
        setClasses([...classes, newClass]);
      }
    } catch (error) {
      console.error('Error creating class:', error);
    }
    
    // Reset form
    setNewClassName('');
    setNewClassStudents([{ name: '', email: '' }]);
    setShowNewClassModal(false);
    setIsCreatingClass(false);
  };
  
  // Historical sessions from Firebase
  const [historicalSessions, setHistoricalSessions] = useState<HistoricalSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  
  // Session filters
  const [filterMonth, setFilterMonth] = useState<string>('all'); // 'all' or '2024-12' format
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterClassName, setFilterClassName] = useState<string>('all');
  
  // Load historical sessions
  useEffect(() => {
    setLoadingSessions(true);
    const unsubscribe = subscribeToSessions((sessions) => {
      setHistoricalSessions(sessions);
      setLoadingSessions(false);
    });
    
    return unsubscribe;
  }, []);
  
  // Get unique months, subjects and classes from sessions for filter options
  const filterOptions = React.useMemo(() => {
    const months = new Set<string>();
    const subjects = new Set<string>();
    const classNames = new Set<string>();
    
    historicalSessions.forEach(session => {
      // Extract month from createdAt
      const date = new Date(session.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.add(monthKey);
      
      if (session.subject) subjects.add(session.subject);
      if (session.className) classNames.add(session.className);
    });
    
    return {
      months: Array.from(months).sort().reverse(),
      subjects: Array.from(subjects).sort(),
      classNames: Array.from(classNames).sort(),
    };
  }, [historicalSessions]);
  
  // Filter sessions
  const filteredSessions = React.useMemo(() => {
    return historicalSessions.filter(session => {
      // Filter by student count > 0
      if (session.studentsCount === 0) return false;
      
      // Filter by month
      if (filterMonth !== 'all') {
        const date = new Date(session.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (monthKey !== filterMonth) return false;
      }
      
      // Filter by subject
      if (filterSubject !== 'all' && session.subject !== filterSubject) return false;
      
      // Filter by class
      if (filterClassName !== 'all' && session.className !== filterClassName) return false;
      
      return true;
    });
  }, [historicalSessions, filterMonth, filterSubject, filterClassName]);
  
  // Format month for display
  const formatMonth = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const monthNames = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 
                        'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };
  
  // Legacy mock data for results (fallback)
  const [results, setResults] = useState<TestResult[]>([
    { id: '1', testName: 'Hmota - test', className: '6.A', date: '2024-12-01', averageScore: 78, studentsCount: 24 },
    { id: '2', testName: 'Částice hmoty', className: '6.B', date: '2024-11-28', averageScore: 82, studentsCount: 22 },
    { id: '3', testName: 'Fyzikální veličiny', className: '7.C', date: '2024-11-25', averageScore: 71, studentsCount: 12 },
  ]);

  // Demo data for students with their test results - colors based on score value
  // Score can be: number (0-10), null (not done), '?' (pending)
  const studentsData = [
    { id: '1', name: 'Anna Nováková', initials: 'AN', color: '#EC4899', results: [9, 10, 9, 9], average: 93 },
    { id: '2', name: 'Jakub Svoboda', initials: 'JS', color: '#3B82F6', results: [8, 9, 8, 9], average: 85 },
    { id: '3', name: 'Tereza Dvořáková', initials: 'TD', color: '#8B5CF6', results: [7, 8, 9, 8], average: 80 },
    { id: '4', name: 'Martin Černý', initials: 'MČ', color: '#10B981', results: [9, 8, 7, 8], average: 80 },
    { id: '5', name: 'Karolína Procházková', initials: 'KP', color: '#F59E0B', results: [6, 7, 8, 7], average: 70 },
    { id: '6', name: 'David Kučera', initials: 'DK', color: '#EF4444', results: [5, 6, 7, 6], average: 60 },
    { id: '7', name: 'Eliška Veselá', initials: 'EV', color: '#EC4899', results: [8, 9, 8, '?'], average: 83 },
    { id: '8', name: 'Tomáš Horák', initials: 'TH', color: '#3B82F6', results: [7, 7, 8, 7], average: 73 },
    { id: '9', name: 'Natálie Marková', initials: 'NM', color: '#8B5CF6', results: [9, 9, 10, 9], average: 93 },
    { id: '10', name: 'Filip Poláček', initials: 'FP', color: '#10B981', results: [6, 5, 6, 5], average: 55 },
    { id: '11', name: 'Adéla Králová', initials: 'AK', color: '#F59E0B', results: [8, 8, 9, 8], average: 83 },
    { id: '12', name: 'Ondřej Němec', initials: 'ON', color: '#EF4444', results: [4, 5, 5, 4], average: 45 },
    { id: '13', name: 'Viktorie Růžičková', initials: 'VR', color: '#EC4899', results: [7, 8, 7, 8], average: 75 },
    { id: '14', name: 'Lukáš Fiala', initials: 'LF', color: '#3B82F6', results: [9, 10, 9, 10], average: 95 },
    { id: '15', name: 'Barbora Šimková', initials: 'BŠ', color: '#8B5CF6', results: [6, 7, 6, null], average: 63 },
    { id: '16', name: 'Vojtěch Kolář', initials: 'VK', color: '#10B981', results: [8, 8, 9, 8], average: 83 },
    { id: '17', name: 'Kristýna Benešová', initials: 'KB', color: '#F59E0B', results: [5, 6, 5, 6], average: 55 },
    { id: '18', name: 'Matyáš Holub', initials: 'MH', color: '#EF4444', results: [7, 7, 8, 7], average: 73 },
    { id: '19', name: 'Sofie Urbanová', initials: 'SU', color: '#EC4899', results: [9, 9, 9, '?'], average: 90 },
    { id: '20', name: 'Adam Kopecký', initials: 'AKo', color: '#3B82F6', results: [6, 7, 7, 6], average: 65 },
    { id: '21', name: 'Michaela Vlčková', initials: 'MV', color: '#8B5CF6', results: [8, 9, 8, 9], average: 85 },
    { id: '22', name: 'Štěpán Marek', initials: 'ŠM', color: '#10B981', results: [10, 10, 10, 10], average: 100 },
    { id: '23', name: 'Klára Pavlíková', initials: 'KPa', color: '#F59E0B', results: [7, 8, 7, 8], average: 75 },
    { id: '24', name: 'Dominik Novotný', initials: 'DN', color: '#EF4444', results: [5, 5, 6, 5], average: 53 },
  ];

  // Test columns for the class detail view
  const testColumns = [
    { id: '1', date: '15. 9.', name: 'Hmota a její vlastnosti' },
    { id: '2', date: '2. 10.', name: 'Síla a pohyb' },
    { id: '3', date: '18. 10.', name: 'Newtonovy zákony' },
    { id: '4', date: '5. 11.', name: 'Práce a energie' },
  ];

  // Get score color based on value - gradient from green to red
  const getScoreColor = (score: number | string | null): string => {
    if (score === null || score === '?') return '#EBEBEB';
    const numScore = typeof score === 'number' ? score : 0;
    // Gradient: 10=zelená, 0=červená
    if (numScore >= 9) return '#6DE89B'; // Světle zelená
    if (numScore >= 8) return '#7ECD7E'; // Zelená
    if (numScore >= 7) return '#9FD99F'; // Světlejší zelená
    if (numScore >= 6) return '#C7B08A'; // Okrová/hnědá
    if (numScore >= 5) return '#E8A07A'; // Oranžová
    if (numScore >= 4) return '#E88A7A'; // Světle červená
    if (numScore >= 3) return '#E87A7A'; // Červená
    if (numScore >= 2) return '#E86A6A'; // Tmavší červená
    return '#B84040'; // Tmavě červená
  };

  // Pololetní hodnocení - modrá
  const getAverageColor = () => {
    return 'bg-[#4A90E2] text-white';
  };

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
                    label="Moje třídy"
                    variant="green"
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
                    activeItem="my-classes"
                    onItemClick={() => {
                      setToolsOpen(false);
                      setSidebarOpen(false);
                    }} 
                  />
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  {/* Tab Switcher */}
                  <div className="px-4 pb-4">
                    <div className="flex p-1.5 bg-white/10 rounded-xl">
                      <button
                        onClick={() => setActiveTab('results')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
                          activeTab === 'results' 
                            ? 'bg-white text-green-700 shadow-sm' 
                            : 'text-white/80 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        <BarChart3 className="h-5 w-5" />
                        Výsledky
                      </button>
                      <button
                        onClick={() => setActiveTab('classes')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
                          activeTab === 'classes' 
                            ? 'bg-white text-green-700 shadow-sm' 
                            : 'text-white/80 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        <Users className="h-5 w-5" />
                        Moje třídy
                      </button>
                    </div>
                  </div>

                  {/* Tab Content */}
                  <div className="px-4 pb-20">
                    {activeTab === 'results' && (
                      // Results List - Historical Sessions with Filters
                      <div className="space-y-3">
                        {/* Filters */}
                      <div className="space-y-2">
                          <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider px-1">
                            Filtry
                        </h3>
                          
                          {/* Month Filter */}
                          <select
                            value={filterMonth}
                            onChange={(e) => setFilterMonth(e.target.value)}
                            className="w-full px-3 py-2 bg-white/10 text-white text-sm rounded-lg border border-white/20 focus:border-white/40 focus:outline-none appearance-none cursor-pointer"
                            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                          >
                            <option value="all" className="bg-slate-800">Všechny měsíce</option>
                            {filterOptions.months.map(month => (
                              <option key={month} value={month} className="bg-slate-800">
                                {formatMonth(month)}
                              </option>
                            ))}
                          </select>
                          
                          {/* Subject Filter */}
                          {filterOptions.subjects.length > 0 && (
                            <select
                              value={filterSubject}
                              onChange={(e) => setFilterSubject(e.target.value)}
                              className="w-full px-3 py-2 bg-white/10 text-white text-sm rounded-lg border border-white/20 focus:border-white/40 focus:outline-none appearance-none cursor-pointer"
                              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                            >
                              <option value="all" className="bg-slate-800">Všechny předměty</option>
                              {filterOptions.subjects.map(subject => (
                                <option key={subject} value={subject} className="bg-slate-800">
                                  {subject}
                                </option>
                              ))}
                            </select>
                          )}
                          
                          {/* Class Filter */}
                          {filterOptions.classNames.length > 0 && (
                            <select
                              value={filterClassName}
                              onChange={(e) => setFilterClassName(e.target.value)}
                              className="w-full px-3 py-2 bg-white/10 text-white text-sm rounded-lg border border-white/20 focus:border-white/40 focus:outline-none appearance-none cursor-pointer"
                              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                            >
                              <option value="all" className="bg-slate-800">Všechny třídy</option>
                              {filterOptions.classNames.map(className => (
                                <option key={className} value={className} className="bg-slate-800">
                                  {className}
                                </option>
                              ))}
                            </select>
                          )}
                          
                          {/* Clear filters button */}
                          {(filterMonth !== 'all' || filterSubject !== 'all' || filterClassName !== 'all') && (
                            <button
                              onClick={() => {
                                setFilterMonth('all');
                                setFilterSubject('all');
                                setFilterClassName('all');
                              }}
                              className="w-full px-3 py-1.5 text-xs text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                            >
                              Zrušit filtry
                            </button>
                          )}
                        </div>
                        
                        {/* Info about filter results */}
                        <div className="mt-4 text-center text-sm text-white/60">
                          {loadingSessions ? (
                            <div className="flex justify-center py-2">
                              <RefreshCw className="w-4 h-4 text-white/50 animate-spin" />
                            </div>
                          ) : (
                            <span>{filteredSessions.length} relací</span>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {activeTab === 'classes' && (
                      // Classes List
                      <div className="space-y-2">
                        {/* Data source toggle */}
                        <div className="flex items-center justify-between mb-3 p-2 bg-white/5 rounded-lg">
                          <span className="text-xs text-white/60">Zdroj dat:</span>
                          <button
                            onClick={handleToggleDataSource}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                              useSupabaseData 
                                ? 'bg-emerald-500/20 text-emerald-300' 
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {useSupabaseData ? <Database className="w-3 h-3" /> : <HardDrive className="w-3 h-3" />}
                            {useSupabaseData ? 'Supabase' : 'Demo'}
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider px-1">
                            Moje třídy
                          </h3>
                          <button 
                            onClick={() => setShowNewClassModal(true)}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                          >
                            <Plus className="h-3 w-3" />
                            Nová třída
                          </button>
                        </div>
                        {loadingClasses ? (
                          <div className="flex items-center justify-center py-8">
                            <RefreshCw className="h-5 w-5 text-white/50 animate-spin" />
                          </div>
                        ) : classes.length === 0 ? (
                          <div className="text-center py-8">
                            <p className="text-white/60 text-sm mb-3">Zatím žádné třídy</p>
                            <button
                              onClick={() => setShowNewClassModal(true)}
                              className="text-xs text-white/80 hover:text-white underline"
                            >
                              Vytvořit první třídu
                            </button>
                          </div>
                        ) : (
                          classes.map(cls => (
                            <button
                              key={cls.id}
                              onClick={() => setSelectedClass(cls)}
                              className="w-full flex items-center gap-3 p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-left group"
                            >
                              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                                <Users className="h-5 w-5 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-white">{cls.name}</div>
                                <div className="text-sm text-white/70">{cls.studentsCount} žáků</div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-white/40 group-hover:text-white/70" />
                            </button>
                          ))
                        )}
                      </div>
                    )}
                    
                  </div>
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
                <h1 className="font-bold text-xl text-slate-800">Moje třídy</h1>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="p-6 lg:p-8">
            <div className={selectedClass ? 'max-w-7xl mx-auto' : 'max-w-5xl mx-auto'}>
              {/* Page Header */}
              {!selectedClass && (
                <div className="mb-8">
                  <h1 className="text-3xl font-bold text-slate-800 mb-2" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
                    {activeTab === 'results' ? 'Výsledky testů' : 'Správa tříd'}
                  </h1>
                  <p className="text-slate-600">
                    {activeTab === 'results' 
                      ? 'Přehled výsledků z testů a procvičování vašich žáků'
                      : 'Vytvářejte skupiny žáků a sledujte jejich pokrok'
                    }
                  </p>
                </div>
              )}
              
              {/* Individual Work Tab Content */}
              {activeTab === 'individual' && !selectedClass && (
                <StudentIndividualWork />
              )}

              {selectedClass ? (
                // Class Detail View
                <div className="space-y-4">
                  {/* Header with back button and class name */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setSelectedClass(null)}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                      >
                        <ChevronRight className="h-5 w-5 rotate-180" />
                      </button>
                      <h2 className="text-2xl font-bold text-slate-800">{selectedClass.name}</h2>
                    </div>
                    
                      {/* Subject pills */}
                    <div className="flex items-center gap-2">
                      <button className="flex items-center gap-2 px-3 py-1.5 bg-indigo-100 rounded-full text-sm font-medium text-indigo-700">
                        <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                        Fyzika
                      </button>
                      <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full text-sm font-medium text-slate-500 hover:bg-slate-200">
                        <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                        Informatika
                      </button>
                      <button className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700">
                        + Předmět
                      </button>
                    </div>
                  </div>

                  {/* New Results Grid Component */}
                  <ClassResultsGrid 
                    classId={selectedClass.id} 
                    className={selectedClass.name}
                    onBack={() => setSelectedClass(null)}
                  />
                </div>
              ) : false ? (
                // OLD TABLE REMOVED - hidden block
                <div className="hidden">
                      <table className="w-full border-collapse">
                        <thead>
                          {/* Year + Date headers row */}
                          <tr>
                            {/* Class selector cell */}
                            <th className="text-left px-4 py-3 min-w-[300px] border border-[#E5E5E5] bg-white sticky left-0 z-10" rowSpan={3}>
                              <button 
                                onClick={() => setSelectedClass(null)}
                                className="text-slate-400 hover:text-slate-600 block mb-1"
                              >
                                <span className="text-lg tracking-wider">···</span>
                              </button>
                              <div className="flex items-center justify-between">
                                <span className="text-2xl font-bold text-slate-800">{selectedClass.name}</span>
                                <ChevronRight className="h-5 w-5 text-slate-400 rotate-90" />
                              </div>
                            </th>
                            {/* Year label spans over date columns */}
                            <th colSpan={4} className="text-left px-4 py-2 border border-[#E5E5E5]">
                              <span className="text-lg font-bold text-slate-800">2025</span>
                            </th>
                            <th className="px-3 py-2 border border-[#E5E5E5]"></th>
                            <th className="px-4 py-2 border border-[#E5E5E5]"></th>
                          </tr>
                          {/* Dates row */}
                          <tr>
                            {testColumns.map(col => (
                              <th key={col.id} className="text-left px-3 py-2 border border-[#E5E5E5]" style={{ width: '130px', minWidth: '130px', maxWidth: '130px' }}>
                                <div className="text-base font-bold text-slate-800">{col.date}</div>
                              </th>
                            ))}
                            <th className="text-left px-3 py-2 border border-[#E5E5E5]" style={{ width: '130px', minWidth: '130px', maxWidth: '130px' }}>
                              <div className="text-xs text-[#6A6A6A] font-normal">Pololetní</div>
                              <div className="text-xs text-[#6A6A6A] font-normal">hodnocení</div>
                            </th>
                            <th className="px-4 py-2 border border-[#E5E5E5] min-w-[260px]"></th>
                          </tr>
                          {/* Test names row */}
                          <tr>
                            {testColumns.map((col, colIndex) => (
                              <th 
                                key={col.id} 
                                className="text-left px-3 py-2 border border-[#E5E5E5] cursor-pointer transition-colors"
                                style={{ 
                                  width: '130px', 
                                  minWidth: '130px', 
                                  maxWidth: '130px',
                                  backgroundColor: hoveredColumn === colIndex ? '#EEF2FF' : undefined
                                }}
                                onMouseEnter={() => setHoveredColumn(colIndex)}
                                onMouseLeave={() => setHoveredColumn(null)}
                              >
                                <div className="text-[11px] text-[#6A6A6A] font-normal truncate">{col.name}</div>
                              </th>
                            ))}
                            <th className="border border-[#E5E5E5]"></th>
                            <th className="px-4 py-2 border border-[#E5E5E5]">
                              <div className="flex gap-2 justify-start">
                                <button className="flex items-center gap-1.5 px-4 py-2 bg-[#E3E6EA] hover:bg-[#d5d9de] rounded-lg text-sm font-medium text-slate-700 transition-colors">
                                  <Plus className="h-4 w-4" /> Zadat aktivitu
                                </button>
                                <button className="flex items-center gap-1.5 px-4 py-2 bg-[#59606A] hover:bg-[#4a5058] rounded-lg text-sm font-medium text-white transition-colors">
                                  <Plus className="h-4 w-4" /> Hodnocení
                                </button>
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentsData.map((student) => (
                            <tr key={student.id}>
                              {/* Student cell */}
                              <td 
                                className="px-4 py-2 bg-white sticky left-0 z-10 border border-[#E5E5E5] cursor-pointer transition-colors"
                                style={{ 
                                  minWidth: '300px',
                                  backgroundColor: hoveredRow === student.id ? '#F0F4FF' : 'white'
                                }}
                                onMouseEnter={() => setHoveredRow(student.id)}
                                onMouseLeave={() => setHoveredRow(null)}
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className="w-[18px] h-[18px] rounded border-2 border-slate-300 bg-white flex-shrink-0 cursor-pointer hover:border-slate-400"></div>
                                  <div 
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                                    style={{ backgroundColor: student.color }}
                                  >
                                    {student.initials}
                                  </div>
                                  <span className="font-medium text-slate-800 text-[16px]">{student.name}</span>
                                </div>
                              </td>
                              {/* Score cells */}
                              {student.results.map((score, colIndex) => {
                                const isHighlighted = hoveredRow === student.id || hoveredColumn === colIndex;
                                return (
                                  <td 
                                    key={colIndex} 
                                    className="border border-[#E5E5E5] text-center text-[14px] font-medium cursor-pointer"
                                    style={{ 
                                      width: '130px', 
                                      minWidth: '130px', 
                                      maxWidth: '130px',
                                      backgroundColor: getScoreColor(score),
                                      color: score === null || score === '?' ? '#9CA3AF' : '#FFFFFF',
                                      height: '44px',
                                      outline: isHighlighted ? '2px solid #3B82F6' : 'none',
                                      outlineOffset: '-2px',
                                      position: 'relative',
                                      zIndex: isHighlighted ? 5 : 1
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.outline = '2px solid #3B82F6';
                                      e.currentTarget.style.zIndex = '10';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.outline = isHighlighted ? '2px solid #3B82F6' : 'none';
                                      e.currentTarget.style.zIndex = isHighlighted ? '5' : '1';
                                    }}
                                  >
                                    {score === '?' ? '?' : score !== null ? `${score} / 10` : '-'}
                                  </td>
                                );
                              })}
                              {/* Pololetní hodnocení */}
                              <td 
                                className="border border-[#E5E5E5] text-center text-[14px] font-medium text-white"
                                style={{ 
                                  width: '130px', 
                                  minWidth: '130px', 
                                  maxWidth: '130px',
                                  backgroundColor: '#4A90E2',
                                  height: '44px',
                                  outline: hoveredRow === student.id ? '2px solid #3B82F6' : 'none',
                                  outlineOffset: '-2px'
                                }}
                              >
                                {student.average}%
                              </td>
                              <td className="px-4 py-2 border border-[#E5E5E5]"></td>
                            </tr>
                          ))}
                          {/* Add student row */}
                          <tr className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-2 border-r border-[#E6E6E6] bg-white sticky left-0 z-10">
                              <div className="flex items-center gap-2.5">
                                <div className="w-[18px] h-[18px] flex-shrink-0"></div>
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 cursor-pointer hover:bg-slate-200">
                                  <Plus className="h-3.5 w-3.5 text-slate-400" />
                                </div>
                                <span className="text-[13px] text-slate-400">Přidat studenta</span>
                              </div>
                            </td>
                            <td colSpan={6}></td>
                          </tr>
                        </tbody>
                      </table>
                </div>
              ) : activeTab === 'results' ? (
                // Results Overview - Historical Sessions
                <div className="space-y-6">
                  {loadingSessions ? (
                    <div className="flex items-center justify-center py-12">
                      <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                    </div>
                  ) : filteredSessions.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                      <BarChart3 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-slate-700 mb-2">
                        {historicalSessions.length > 0 ? 'Žádné relace pro vybrané filtry' : 'Zatím žádné relace'}
                      </h3>
                      <p className="text-slate-500 mb-4">
                        {historicalSessions.length > 0 ? 'Zkuste změnit filtry v levém panelu' : 'Zde se zobrazí všechny relace po jejich spuštění'}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Název</th>
                            <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Typ</th>
                            <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Třída</th>
                            <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Datum</th>
                            <th className="text-center px-6 py-4 text-sm font-semibold text-slate-600">Průměr</th>
                            <th className="text-center px-6 py-4 text-sm font-semibold text-slate-600">Žáků</th>
                            <th className="text-center px-6 py-4 text-sm font-semibold text-slate-600">Stav</th>
                            <th className="px-6 py-4"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSessions.map(session => (
                            <tr 
                              key={session.id} 
                              className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                              onClick={() => navigate(`/quiz/results/${session.id}?type=${session.type}`)}
                            >
                              <td className="px-6 py-4">
                                <div className="font-medium text-slate-800">{session.quizTitle}</div>
                                {session.sessionCode && (
                                  <div className="text-xs text-slate-400 font-mono">{session.sessionCode}</div>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                                  session.type === 'live' 
                                    ? 'bg-indigo-100 text-indigo-700' 
                                    : 'bg-emerald-100 text-emerald-700'
                                }`}>
                                  {session.type === 'live' ? (
                                    <><Play className="w-3 h-3" /> Živě</>
                                  ) : (
                                    <><FileText className="w-3 h-3" /> Sdílení</>
                                  )}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-slate-600">
                                {session.className || '-'}
                              </td>
                              <td className="px-6 py-4 text-slate-600">
                                {formatSessionDate(session.createdAt)}
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium ${
                                  session.averageScore >= 80 ? 'bg-green-100 text-green-700' :
                                  session.averageScore >= 60 ? 'bg-yellow-100 text-yellow-700' :
                                  session.averageScore > 0 ? 'bg-red-100 text-red-700' :
                                  'bg-slate-100 text-slate-500'
                                }`}>
                                  {session.averageScore > 0 ? `${session.averageScore}%` : '-'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center text-slate-600">{session.studentsCount}</td>
                              <td className="px-6 py-4 text-center">
                                {session.isActive ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                    Aktivní
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                                    Ukončeno
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <button className="text-slate-400 hover:text-slate-600 transition-colors">
                                  <ChevronRight className="h-5 w-5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                // Classes List
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Add New Class Card */}
                  <button 
                    onClick={() => setShowNewClassModal(true)}
                    className="flex flex-col items-center justify-center p-8 bg-white rounded-2xl border-2 border-dashed border-slate-300 hover:border-green-400 hover:bg-green-50 transition-colors group"
                  >
                    <div className="w-12 h-12 bg-slate-100 group-hover:bg-green-100 rounded-xl flex items-center justify-center mb-3 transition-colors">
                      <Plus className="h-6 w-6 text-slate-400 group-hover:text-green-600" />
                    </div>
                    <span className="font-medium text-slate-600 group-hover:text-green-700">Přidat třídu</span>
                  </button>
                  
                  {/* Loading state */}
                  {loadingClasses && (
                    <div className="flex flex-col items-center justify-center p-8 bg-white rounded-2xl border border-slate-200">
                      <RefreshCw className="h-8 w-8 text-green-500 animate-spin mb-3" />
                      <span className="text-slate-500">Načítám třídy...</span>
                    </div>
                  )}
                  
                  {/* Empty state for Supabase */}
                  {!loadingClasses && classes.length === 0 && useSupabaseData && (
                    <div className="col-span-full flex flex-col items-center justify-center p-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                      <Users className="h-12 w-12 text-slate-300 mb-4" />
                      <h3 className="text-lg font-semibold text-slate-600 mb-2">Zatím nemáte žádné třídy</h3>
                      <p className="text-slate-500 text-center mb-4">
                        Vytvořte svou první třídu a přidejte žáky.
                      </p>
                      <button
                        onClick={() => setShowNewClassModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Vytvořit třídu
                      </button>
                    </div>
                  )}
                  
                  {/* Class Cards */}
                  {!loadingClasses && classes.map(cls => (
                    <div key={cls.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 hover:shadow-lg transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-xl flex items-center justify-center">
                          <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="flex gap-1">
                          <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1">{cls.name}</h3>
                      <p className="text-slate-500 dark:text-slate-400 mb-4">{cls.studentsCount} žáků</p>
                      
                      {/* Action buttons */}
                      <div className="space-y-2">
                        <button 
                          onClick={() => setSelectedClass(cls)}
                          className="w-full py-2.5 text-sm font-medium text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <BarChart3 className="h-4 w-4" />
                          Výsledky třídy
                        </button>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            className="py-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                          >
                            <ClipboardList className="h-3.5 w-3.5" />
                            Zadat úkol
                          </button>
                          <button 
                            className="py-2 text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 bg-violet-50 dark:bg-violet-900/30 hover:bg-violet-100 dark:hover:bg-violet-900/50 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            Nasdílet
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* New Class Modal */}
      {showNewClassModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowNewClassModal(false)}>
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">Nová třída</h2>
                <button 
                  onClick={() => setShowNewClassModal(false)} 
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {/* Class name */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Název třídy
                </label>
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="např. 6.A"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none text-lg font-semibold"
                />
              </div>
              
              {/* Students list */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-slate-700">
                    Žáci ({newClassStudents.filter(s => s.name.trim()).length})
                  </label>
                  <button
                    onClick={addStudentRow}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                  >
                    <UserPlus className="w-3 h-3" />
                    Přidat žáka
                  </button>
                </div>
                
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {newClassStudents.map((student, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={student.name}
                        onChange={(e) => updateStudentRow(index, 'name', e.target.value)}
                        placeholder="Jméno žáka"
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-200 focus:border-green-500 focus:ring-1 focus:ring-green-500/20 outline-none text-sm"
                      />
                      <div className="relative flex-1">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="email"
                          value={student.email}
                          onChange={(e) => updateStudentRow(index, 'email', e.target.value)}
                          placeholder="email@skola.cz"
                          className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 focus:border-green-500 focus:ring-1 focus:ring-green-500/20 outline-none text-sm"
                        />
                      </div>
                      {newClassStudents.length > 1 && (
                        <button
                          onClick={() => removeStudentRow(index)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                
                <p className="text-xs text-slate-500 mt-3">
                  💡 Žáci obdrží pozvánku na zadaný email a budou moci sledovat své výsledky.
                </p>
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-6 border-t border-slate-200 bg-slate-50">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowNewClassModal(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-100 transition-colors"
                >
                  Zrušit
                </button>
                <button
                  onClick={handleCreateClass}
                  disabled={!newClassName.trim() || isCreatingClass}
                  className="flex-1 py-3 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isCreatingClass ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Vytvářím...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Vytvořit třídu
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


