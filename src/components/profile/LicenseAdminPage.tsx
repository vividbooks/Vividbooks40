import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  School as SchoolIcon,
  BookOpen,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Database,
  Sparkles,
  FileText,
  Shield
} from 'lucide-react';
import { 
  School, 
  SchoolLicense, 
  SubjectLicense,
  Subject,
  FeatureTier,
  FeatureLicense,
  SUBJECTS,
  FEATURE_TIERS,
  getSubjectMeta,
} from '../../types/profile';
import { supabase } from '../../utils/supabase/client';
import { projectId } from '../../utils/supabase/info.tsx';
import * as storage from '../../utils/profile-storage';

export function LicenseAdminPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schools, setSchools] = useState<School[]>([]);
  const [licenses, setLicenses] = useState<SchoolLicense[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [editingLicense, setEditingLicense] = useState<SchoolLicense | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [usingLocalStorage, setUsingLocalStorage] = useState(false);
  
  // New school form
  const [showNewSchool, setShowNewSchool] = useState(false);
  const [newSchool, setNewSchool] = useState({ code: '', name: '', city: '', address: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Try to load from Supabase directly
      const { data: schoolsData, error: schoolsError } = await supabase
        .from('schools')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (schoolsError) {
        console.log('Supabase schools table not available, using localStorage:', schoolsError.message);
        setUsingLocalStorage(true);
        setSchools(storage.getSchools());
        setLicenses(storage.getLicenses());
        return;
      }
      
      const { data: licensesData, error: licensesError } = await supabase
        .from('school_licenses')
        .select('*');
      
      if (licensesError) {
        console.log('Supabase licenses table not available:', licensesError.message);
      }
      
      // Transform Supabase data to match our types
      const transformedSchools: School[] = (schoolsData || []).map((s: any) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        address: s.address || '',
        city: s.city || '',
        createdAt: s.created_at,
      }));
      
      const transformedLicenses: SchoolLicense[] = (licensesData || []).map((l: any) => ({
        id: l.id,
        schoolId: l.school_id,
        subjects: l.subjects || [],
        features: l.features || { vividboardWall: true, ecosystemVividbooks: false, vividboard: false },
        updatedAt: l.updated_at,
      }));
      
      setSchools(transformedSchools);
      setLicenses(transformedLicenses);
      setUsingLocalStorage(false);
      console.log(`✅ Loaded ${transformedSchools.length} schools from Supabase`);
      
    } catch (error) {
      console.error('Error loading data:', error);
      setUsingLocalStorage(true);
      setSchools(storage.getSchools());
      setLicenses(storage.getLicenses());
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSchool = async () => {
    if (!newSchool.code || !newSchool.name) {
      setMessage({ type: 'error', text: 'Vyplňte kód a název školy' });
      return;
    }

    setSaving(true);
    try {
      const schoolId = `school-${Date.now()}`;
      const licenseId = `license-${Date.now()}`;
      
      if (!usingLocalStorage) {
        // Save to Supabase
        const { data: createdSchool, error: schoolError } = await supabase
          .from('schools')
          .insert({
            id: schoolId,
            code: newSchool.code.toUpperCase(),
            name: newSchool.name,
            city: newSchool.city,
            address: newSchool.address,
          })
          .select()
          .single();
        
        if (schoolError) {
          console.error('Error creating school in Supabase:', schoolError);
          throw new Error(schoolError.message);
        }
        
        // Create default license in Supabase
        const { error: licenseError } = await supabase
          .from('school_licenses')
          .insert({
            id: licenseId,
            school_id: schoolId,
            subjects: [],
            features: { 
              vividboardWall: true,
              ecosystemVividbooks: false,
              vividboard: false
            },
          });
        
        if (licenseError) {
          console.error('Error creating license in Supabase:', licenseError);
        }
        
        const transformedSchool: School = {
          id: createdSchool.id,
          code: createdSchool.code,
          name: createdSchool.name,
          address: createdSchool.address || '',
          city: createdSchool.city || '',
          createdAt: createdSchool.created_at,
        };
        
        setSchools([...schools, transformedSchool]);
        
        const defaultLicense: SchoolLicense = {
          id: licenseId,
          schoolId: schoolId,
          subjects: [],
          features: { vividboardWall: true, ecosystemVividbooks: false, vividboard: false },
          updatedAt: new Date().toISOString()
        };
        setLicenses([...licenses, defaultLicense]);
        
      } else {
        // Fallback to localStorage
        const created = storage.createSchool(newSchool);
        setSchools([...schools, created]);
        
        const defaultLicense: SchoolLicense = {
          id: licenseId,
          schoolId: created.id,
          subjects: [],
          features: { vividboardWall: true, ecosystemVividbooks: false, vividboard: false },
          updatedAt: new Date().toISOString()
        };
        storage.saveLicense(defaultLicense);
        setLicenses([...licenses, defaultLicense]);
      }
      
      setNewSchool({ code: '', name: '', city: '', address: '' });
      setShowNewSchool(false);
      setMessage({ type: 'success', text: 'Škola vytvořena' });
      
    } catch (error: any) {
      console.error('Error creating school:', error);
      setMessage({ type: 'error', text: error.message || 'Nepodařilo se vytvořit školu' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSchool = async (schoolId: string) => {
    if (!confirm('Opravdu chcete smazat tuto školu a její licence?')) return;
    
    setSaving(true);
    try {
      if (!usingLocalStorage) {
        // Delete from Supabase (license will be cascade deleted)
        const { error } = await supabase
          .from('schools')
          .delete()
          .eq('id', schoolId);
        
        if (error) {
          console.error('Error deleting school from Supabase:', error);
          throw new Error(error.message);
        }
      } else {
        storage.deleteSchool(schoolId);
        storage.deleteLicense(schoolId);
      }
      
      setSchools(schools.filter(s => s.id !== schoolId));
      setLicenses(licenses.filter(l => l.schoolId !== schoolId));
      if (selectedSchoolId === schoolId) {
        setSelectedSchoolId(null);
        setEditingLicense(null);
      }
      setMessage({ type: 'success', text: 'Škola smazána' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Nepodařilo se smazat školu' });
    } finally {
      setSaving(false);
    }
  };

  const handleSelectSchool = (schoolId: string) => {
    setSelectedSchoolId(schoolId);
    const license = licenses.find(l => l.schoolId === schoolId);
    if (license) {
      // Migrate old boolean format to new FeatureLicense format
      const migratedFeatures = {
        vividboardWall: license.features.vividboardWall ?? true,
        ecosystemVividbooks: typeof license.features.ecosystemVividbooks === 'boolean'
          ? { active: license.features.ecosystemVividbooks, validFrom: '', validUntil: '' }
          : (license.features.ecosystemVividbooks || { active: false }),
        vividboard: license.features.vividboard || { active: false }
      };
      setEditingLicense({ ...license, features: migratedFeatures });
    } else {
      // Create new license for this school
      const newLicense: SchoolLicense = {
        id: `license-${Date.now()}`,
        schoolId,
        subjects: [],
        features: { 
          vividboardWall: true,
          ecosystemVividbooks: { active: false },
          vividboard: { active: false }
        },
        updatedAt: new Date().toISOString()
      };
      setEditingLicense(newLicense);
    }
  };

  const handleSaveLicense = async () => {
    if (!editingLicense) return;
    
    setSaving(true);
    try {
      let saved: SchoolLicense;
      
      if (!usingLocalStorage) {
        // Save to Supabase
        const { data, error } = await supabase
          .from('school_licenses')
          .upsert({
            id: editingLicense.id,
            school_id: editingLicense.schoolId,
            subjects: editingLicense.subjects,
            features: editingLicense.features,
          }, { onConflict: 'school_id' })
          .select()
          .single();
        
        if (error) {
          console.error('Error saving license to Supabase:', error);
          throw new Error(error.message);
        }
        
        saved = {
          id: data.id,
          schoolId: data.school_id,
          subjects: data.subjects || [],
          features: data.features || {},
          updatedAt: data.updated_at,
        };
      } else {
        saved = storage.saveLicense(editingLicense);
      }
      
      setLicenses(prev => {
        const existing = prev.findIndex(l => l.schoolId === editingLicense.schoolId);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = saved;
          return updated;
        }
        return [...prev, saved];
      });
      setMessage({ type: 'success', text: 'Licence uložena' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Nepodařilo se uložit licenci' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddSubjectLicense = () => {
    if (!editingLicense) return;
    
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    
    const newSubjectLicense: SubjectLicense = {
      id: `sublic-${Date.now()}`,
      subject: 'fyzika',
      tier: 'workbooks',
      validFrom: new Date().toISOString().split('T')[0],
      validUntil: nextYear.toISOString().split('T')[0],
    };
    
    setEditingLicense({
      ...editingLicense,
      subjects: [...editingLicense.subjects, newSubjectLicense]
    });
  };

  const handleUpdateSubjectLicense = (index: number, updates: Partial<SubjectLicense>) => {
    if (!editingLicense) return;
    
    const newSubjects = [...editingLicense.subjects];
    newSubjects[index] = { ...newSubjects[index], ...updates };
    setEditingLicense({ ...editingLicense, subjects: newSubjects });
  };

  const handleRemoveSubjectLicense = (index: number) => {
    if (!editingLicense) return;
    
    setEditingLicense({
      ...editingLicense,
      subjects: editingLicense.subjects.filter((_, i) => i !== index)
    });
  };

  const handleUpdateFeature = (featureName: 'ecosystemVividbooks' | 'vividboard', updates: Partial<FeatureLicense>) => {
    if (!editingLicense) return;
    
    const currentFeature = editingLicense.features[featureName] || { active: false };
    const updatedFeature = typeof currentFeature === 'boolean' 
      ? { active: currentFeature, ...updates }
      : { ...currentFeature, ...updates };
    
    setEditingLicense({
      ...editingLicense,
      features: {
        ...editingLicense.features,
        [featureName]: updatedFeature
      }
    });
  };

  const selectedSchool = schools.find(s => s.id === selectedSchoolId);

  // Auto-hide messages
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span className="text-slate-600">Načítám data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Správa licencí</h1>
              <p className="text-sm text-slate-500">Nastavení licencí pro školy</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {usingLocalStorage && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-sm">
                <Database className="w-4 h-4" />
                Lokální režim
              </div>
            )}
            
            {editingLicense && (
              <button
                onClick={handleSaveLicense}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Uložit změny
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Message toast */}
      {message && (
        <div className={`fixed top-20 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${
          message.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-6">
          {/* Schools sidebar */}
          <div className="w-80 flex-shrink-0">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="font-semibold text-slate-800">Školy</h2>
                <button
                  onClick={() => setShowNewSchool(!showNewSchool)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {/* New school form */}
              {showNewSchool && (
                <div className="p-4 border-b border-slate-200 bg-slate-50">
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Kód školy (6 znaků)"
                      value={newSchool.code}
                      onChange={(e) => setNewSchool({ ...newSchool, code: e.target.value.toUpperCase().slice(0, 6) })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="Název školy"
                      value={newSchool.name}
                      onChange={(e) => setNewSchool({ ...newSchool, name: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="Město"
                      value={newSchool.city}
                      onChange={(e) => setNewSchool({ ...newSchool, city: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                    <button
                      onClick={handleCreateSchool}
                      disabled={saving}
                      className="w-full py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      Vytvořit školu
                    </button>
                  </div>
                </div>
              )}

              {/* School list */}
              <div className="divide-y divide-slate-100">
                {schools.map(school => {
                  const hasLicense = licenses.some(l => l.schoolId === school.id);
                  return (
                    <div
                      key={school.id}
                      onClick={() => handleSelectSchool(school.id)}
                      className={`p-4 cursor-pointer transition-colors ${
                        selectedSchoolId === school.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium text-slate-800">{school.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-mono rounded">
                              {school.code}
                            </span>
                            <span className="text-xs text-slate-500">{school.city}</span>
                          </div>
                          {hasLicense && (
                            <div className="flex items-center gap-1 mt-1.5 text-xs text-emerald-600">
                              <CheckCircle2 className="w-3 h-3" />
                              Má licenci
                            </div>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSchool(school.id);
                          }}
                          className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* License editor */}
          <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden">
            {editingLicense && selectedSchool ? (
              <div className="h-full">
                {/* License header */}
                <div className="p-6 border-b border-slate-200">
                  <h2 className="text-lg font-bold text-slate-800">
                    Licence pro {selectedSchool.name}
                  </h2>
                  <p className="text-sm text-slate-500">Kód: {selectedSchool.code}</p>
                </div>

                <div className="p-6 space-y-8">
                  {/* Subject licenses */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-indigo-500" />
                        Předměty
                      </h3>
                      <button
                        onClick={handleAddSubjectLicense}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Přidat předmět
                      </button>
                    </div>

                    {editingLicense.subjects.length === 0 ? (
                      <div className="text-center py-8 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                        <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="text-slate-500 text-sm">Žádné licence předmětů</p>
                        <button
                          onClick={handleAddSubjectLicense}
                          className="mt-2 text-sm text-indigo-600 hover:underline"
                        >
                          + Přidat první předmět
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {editingLicense.subjects.map((subLic, index) => (
                          <SubjectLicenseEditor
                            key={subLic.id}
                            license={subLic}
                            onChange={(updates) => handleUpdateSubjectLicense(index, updates)}
                            onRemove={() => handleRemoveSubjectLicense(index)}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Special features */}
                  <div>
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
                      <Sparkles className="w-5 h-5 text-violet-500" />
                      Speciální nástroje
                    </h3>

                    <div className="space-y-4">
                      {/* Ekosystém Vividbooks */}
                      <FeatureLicenseEditor
                        name="Ekosystém Vividbooks"
                        description="AI asistent, Nauč mě, systém tříd a výsledků"
                        icon={<Sparkles className="w-6 h-6" />}
                        color="violet"
                        feature={editingLicense.features.ecosystemVividbooks as FeatureLicense | undefined}
                        onChange={(updates) => handleUpdateFeature('ecosystemVividbooks', updates)}
                      />

                      {/* Vividboard */}
                      <FeatureLicenseEditor
                        name="Vividboard"
                        description="Tvorba vlastních materiálů a výsledky žáků"
                        icon={<FileText className="w-6 h-6" />}
                        color="blue"
                        feature={editingLicense.features.vividboard as FeatureLicense | undefined}
                        onChange={(updates) => handleUpdateFeature('vividboard', updates)}
                      />

                      {/* Vividbooks Wall - always free */}
                      <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            <Shield className="w-6 h-6" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-800">Vividbooks Nástěnka</span>
                              <span className="px-2 py-0.5 bg-emerald-200 text-emerald-700 text-xs font-bold rounded-full">
                                Zdarma
                              </span>
                            </div>
                            <p className="text-sm text-slate-500">Interaktivní nástěnka - vždy aktivní</p>
                          </div>
                          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-96 flex items-center justify-center text-center p-6">
                <div>
                  <SchoolIcon className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-600 mb-2">Vyberte školu</h3>
                  <p className="text-slate-400">Pro úpravu licencí vyberte školu ze seznamu vlevo</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Subject License Editor Component
function SubjectLicenseEditor({ 
  license, 
  onChange, 
  onRemove 
}: { 
  license: SubjectLicense; 
  onChange: (updates: Partial<SubjectLicense>) => void;
  onRemove: () => void;
}) {
  const subject = getSubjectMeta(license.subject);

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xl">
          {subject?.icon || '📚'}
        </div>

        <div className="flex-1 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Předmět</label>
            <select
              value={license.subject}
              onChange={(e) => onChange({ subject: e.target.value as Subject })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
            >
              <optgroup label="1. stupeň">
                {SUBJECTS.filter(s => s.grade === 1).map(s => (
                  <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
                ))}
              </optgroup>
              <optgroup label="2. stupeň">
                {SUBJECTS.filter(s => s.grade === 2).map(s => (
                  <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
                ))}
              </optgroup>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Úroveň</label>
            <select
              value={license.tier}
              onChange={(e) => onChange({ tier: e.target.value as FeatureTier })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
            >
              {FEATURE_TIERS.map(tier => (
                <option key={tier.id} value={tier.id}>{tier.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Platná od</label>
            <input
              type="date"
              value={license.validFrom?.split('T')[0] || ''}
              onChange={(e) => onChange({ validFrom: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Platná do</label>
            <input
              type="date"
              value={license.validUntil?.split('T')[0] || ''}
              onChange={(e) => onChange({ validUntil: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
            />
          </div>
        </div>

        <button
          onClick={onRemove}
          className="p-2 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {license.tier === 'workbooks' && (
        <label className="flex items-center gap-2 mt-3 ml-14 cursor-pointer">
          <input
            type="checkbox"
            checked={license.isFree || false}
            onChange={(e) => onChange({ isFree: e.target.checked })}
            className="w-4 h-4 rounded border-slate-300 text-emerald-600"
          />
          <span className="text-sm text-slate-600">Zdarma licence (od 15ks pracovních sešitů)</span>
        </label>
      )}
    </div>
  );
}

// Feature License Editor Component
function FeatureLicenseEditor({
  name,
  description,
  icon,
  color,
  feature,
  onChange
}: {
  name: string;
  description: string;
  icon: React.ReactNode;
  color: 'violet' | 'blue';
  feature?: FeatureLicense;
  onChange: (updates: Partial<FeatureLicense>) => void;
}) {
  const isActive = feature?.active || false;
  const colorClasses = {
    violet: {
      bg: isActive ? 'bg-violet-50' : 'bg-slate-50',
      border: isActive ? 'border-violet-200' : 'border-slate-200',
      iconBg: isActive ? 'bg-violet-100 text-violet-600' : 'bg-slate-100 text-slate-400',
      checkbox: 'text-violet-600 focus:ring-violet-500'
    },
    blue: {
      bg: isActive ? 'bg-blue-50' : 'bg-slate-50',
      border: isActive ? 'border-blue-200' : 'border-slate-200',
      iconBg: isActive ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400',
      checkbox: 'text-blue-600 focus:ring-blue-500'
    }
  };
  
  const colors = colorClasses[color];

  return (
    <div className={`rounded-xl p-4 border ${colors.bg} ${colors.border} transition-colors`}>
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${colors.iconBg}`}>
          {icon}
        </div>
        
        <div className="flex-1">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => onChange({ active: e.target.checked })}
              className={`w-5 h-5 rounded border-slate-300 ${colors.checkbox}`}
            />
            <div>
              <span className="font-semibold text-slate-800">{name}</span>
              <p className="text-sm text-slate-500">{description}</p>
            </div>
          </label>

          {isActive && (
            <div className="mt-4 ml-8 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Platná od</label>
                <input
                  type="date"
                  value={feature?.validFrom?.split('T')[0] || ''}
                  onChange={(e) => onChange({ validFrom: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Platná do</label>
                <input
                  type="date"
                  value={feature?.validUntil?.split('T')[0] || ''}
                  onChange={(e) => onChange({ validUntil: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}













