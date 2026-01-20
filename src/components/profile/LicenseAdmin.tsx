import { useState, useEffect } from 'react';
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
  ChevronDown,
  Calendar,
  Edit2,
  Database
} from 'lucide-react';
import { 
  School, 
  SchoolLicense, 
  SubjectLicense,
  Subject,
  FeatureTier,
  SUBJECTS,
  FEATURE_TIERS,
  getSubjectMeta,
  getTierMeta
} from '../../types/profile';
import { supabase } from '../../utils/supabase/client';
import { projectId } from '../../utils/supabase/info.tsx';
import * as storage from '../../utils/profile-storage';

interface LicenseAdminProps {
  onClose: () => void;
}

export function LicenseAdmin({ onClose }: LicenseAdminProps) {
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
      const { data: { session } } = await supabase.auth.getSession();
      
      // Try API first
      if (session?.access_token) {
        try {
          const [schoolsRes, licensesRes] = await Promise.all([
            fetch(`https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/schools`, {
              headers: { 'Authorization': `Bearer ${session.access_token}` }
            }),
            fetch(`https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/licenses`, {
              headers: { 'Authorization': `Bearer ${session.access_token}` }
            })
          ]);

          if (schoolsRes.ok && licensesRes.ok) {
            const schoolsData = await schoolsRes.json();
            const licensesData = await licensesRes.json();
            setSchools(schoolsData.schools || []);
            setLicenses(licensesData.licenses || []);
            setUsingLocalStorage(false);
            return;
          }
        } catch (apiError) {
          console.log('API not available, using localStorage');
        }
      }

      // Fallback to localStorage
      setUsingLocalStorage(true);
      setSchools(storage.getSchools());
      setLicenses(storage.getLicenses());
    } catch (error) {
      console.error('Error loading data:', error);
      // Final fallback to localStorage
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
      let createdSchool: School;

      if (!usingLocalStorage) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          try {
            const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/schools`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(newSchool)
            });

            if (res.ok) {
              const data = await res.json();
              createdSchool = data.school;
            } else {
              throw new Error('API failed');
            }
          } catch {
            // Fallback to localStorage
            setUsingLocalStorage(true);
            createdSchool = storage.createSchool(newSchool);
          }
        } else {
          createdSchool = storage.createSchool(newSchool);
        }
      } else {
        createdSchool = storage.createSchool(newSchool);
      }

      setSchools([...schools, createdSchool]);
      setNewSchool({ code: '', name: '', city: '', address: '' });
      setShowNewSchool(false);
      setMessage({ type: 'success', text: 'Škola vytvořena' });
    } catch (error) {
      console.error('Error creating school:', error);
      setMessage({ type: 'error', text: 'Nepodařilo se vytvořit školu' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSchool = async (schoolId: string) => {
    if (!confirm('Opravdu chcete smazat tuto školu?')) return;

    try {
      if (!usingLocalStorage) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          try {
            await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/schools/${schoolId}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
          } catch {
            storage.deleteSchool(schoolId);
          }
        } else {
          storage.deleteSchool(schoolId);
        }
      } else {
        storage.deleteSchool(schoolId);
      }

      setSchools(schools.filter(s => s.id !== schoolId));
      if (selectedSchoolId === schoolId) {
        setSelectedSchoolId(null);
        setEditingLicense(null);
      }
      setMessage({ type: 'success', text: 'Škola smazána' });
    } catch (error) {
      console.error('Error deleting school:', error);
      setMessage({ type: 'error', text: 'Nepodařilo se smazat školu' });
    }
  };

  const handleSelectSchool = (schoolId: string) => {
    setSelectedSchoolId(schoolId);
    const existingLicense = licenses.find(l => l.schoolId === schoolId);
    setEditingLicense(existingLicense || {
      id: crypto.randomUUID(),
      schoolId,
      subjects: [],
      features: { vividboardWall: true, ecosystemVividbooks: false },
      updatedAt: new Date().toISOString()
    });
  };

  const handleAddSubjectLicense = () => {
    if (!editingLicense) return;
    
    const newSubjectLicense: SubjectLicense = {
      id: crypto.randomUUID(),
      subject: 'fyzika',
      tier: 'workbooks',
      validFrom: new Date().toISOString().split('T')[0],
      validUntil: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
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
    
    setEditingLicense({
      ...editingLicense,
      subjects: newSubjects
    });
  };

  const handleRemoveSubjectLicense = (index: number) => {
    if (!editingLicense) return;
    
    setEditingLicense({
      ...editingLicense,
      subjects: editingLicense.subjects.filter((_, i) => i !== index)
    });
  };

  const handleSaveLicense = async () => {
    if (!editingLicense) return;

    setSaving(true);
    try {
      let savedLicense: SchoolLicense;

      if (!usingLocalStorage) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          try {
            const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-46c8107b/licenses`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(editingLicense)
            });

            if (res.ok) {
              const data = await res.json();
              savedLicense = data.license;
            } else {
              throw new Error('API failed');
            }
          } catch {
            setUsingLocalStorage(true);
            savedLicense = storage.saveLicense(editingLicense);
          }
        } else {
          savedLicense = storage.saveLicense(editingLicense);
        }
      } else {
        savedLicense = storage.saveLicense(editingLicense);
      }
      
      // Update local state
      const existingIndex = licenses.findIndex(l => l.schoolId === editingLicense.schoolId);
      if (existingIndex >= 0) {
        const newLicenses = [...licenses];
        newLicenses[existingIndex] = savedLicense;
        setLicenses(newLicenses);
      } else {
        setLicenses([...licenses, savedLicense]);
      }

      setEditingLicense(savedLicense);
      setMessage({ type: 'success', text: 'Licence uložena' });
    } catch (error) {
      console.error('Error saving license:', error);
      setMessage({ type: 'error', text: 'Nepodařilo se uložit licenci' });
    } finally {
      setSaving(false);
    }
  };

  const selectedSchool = schools.find(s => s.id === selectedSchoolId);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span className="text-slate-600">Načítám data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-6 text-white">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-white/80 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Zpět na profil</span>
          </button>
          <h1 className="text-2xl font-bold">Správa licencí</h1>
          <p className="text-white/70 mt-1">Mini admin pro testování licenčního systému</p>
          {usingLocalStorage && (
            <div className="flex items-center gap-2 mt-2 px-3 py-1.5 bg-amber-500/20 rounded-lg w-fit">
              <Database className="w-4 h-4 text-amber-300" />
              <span className="text-sm text-amber-200">Lokální režim (localStorage)</span>
            </div>
          )}
        </div>

        {/* Message */}
        {message && (
          <div className={`mx-6 mt-4 p-3 rounded-xl flex items-center gap-2 ${
            message.type === 'success' 
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' 
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span>{message.text}</span>
            <button 
              onClick={() => setMessage(null)}
              className="ml-auto p-1 hover:bg-black/10 rounded"
            >
              ×
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Schools sidebar */}
          <div className="w-80 border-r border-slate-200 flex flex-col">
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-slate-800">Školy</h2>
                <button
                  onClick={() => setShowNewSchool(true)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5 text-slate-600" />
                </button>
              </div>

              {/* New school form */}
              {showNewSchool && (
                <div className="bg-slate-50 rounded-xl p-3 mb-3 space-y-2">
                  <input
                    type="text"
                    placeholder="Kód (6 znaků)"
                    value={newSchool.code}
                    onChange={(e) => setNewSchool({ ...newSchool, code: e.target.value.toUpperCase().slice(0, 6) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none font-mono"
                    maxLength={6}
                  />
                  <input
                    type="text"
                    placeholder="Název školy"
                    value={newSchool.name}
                    onChange={(e) => setNewSchool({ ...newSchool, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Město"
                    value={newSchool.city}
                    onChange={(e) => setNewSchool({ ...newSchool, city: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowNewSchool(false)}
                      className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-100"
                    >
                      Zrušit
                    </button>
                    <button
                      onClick={handleCreateSchool}
                      disabled={saving}
                      className="flex-1 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {saving ? 'Ukládám...' : 'Vytvořit'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* School list */}
            <div className="flex-1 overflow-y-auto">
              {schools.length === 0 ? (
                <div className="p-6 text-center text-slate-500">
                  <SchoolIcon className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>Zatím žádné školy</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {schools.map((school) => {
                    const hasLicense = licenses.some(l => l.schoolId === school.id);
                    return (
                      <div
                        key={school.id}
                        onClick={() => handleSelectSchool(school.id)}
                        className={`p-4 cursor-pointer transition-colors ${
                          selectedSchoolId === school.id 
                            ? 'bg-indigo-50 border-l-4 border-indigo-500' 
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-slate-800 truncate">{school.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <code className="text-xs bg-slate-100 px-2 py-0.5 rounded font-mono">
                                {school.code}
                              </code>
                              {school.city && (
                                <span className="text-xs text-slate-500">{school.city}</span>
                              )}
                            </div>
                            {hasLicense && (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 mt-2">
                                <CheckCircle2 className="w-3 h-3" />
                                Má licenci
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSchool(school.id);
                            }}
                            className="p-1.5 hover:bg-red-100 rounded text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* License editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedSchool && editingLicense ? (
              <>
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-slate-800">Licence pro {selectedSchool.name}</h2>
                    <p className="text-sm text-slate-500">Kód: {selectedSchool.code}</p>
                  </div>
                  <button
                    onClick={handleSaveLicense}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>Uložit licenci</span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Subject licenses */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-slate-700">Předměty</h3>
                      <button
                        onClick={handleAddSubjectLicense}
                        className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                      >
                        <Plus className="w-4 h-4" />
                        Přidat předmět
                      </button>
                    </div>

                    {editingLicense.subjects.length === 0 ? (
                      <div className="bg-slate-50 rounded-xl p-6 text-center">
                        <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="text-slate-500">Žádné licence na předměty</p>
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
                    <h3 className="font-medium text-slate-700 mb-3">Speciální funkce</h3>
                    <div className="bg-slate-50 rounded-xl p-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingLicense.features.ecosystemVividbooks || false}
                          onChange={(e) => setEditingLicense({
                            ...editingLicense,
                            features: { ...editingLicense.features, ecosystemVividbooks: e.target.checked }
                          })}
                          className="w-5 h-5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                        />
                        <div>
                          <div className="font-medium text-slate-800">Ekosystém Vividbooks</div>
                          <div className="text-sm text-slate-500">AI funkce, Vividboard, Výsledky žáků</div>
                        </div>
                      </label>
                      
                      <label className="flex items-center gap-3 cursor-pointer mt-3">
                        <input
                          type="checkbox"
                          checked={editingLicense.features.vividboardWall}
                          onChange={(e) => setEditingLicense({
                            ...editingLicense,
                            features: { ...editingLicense.features, vividboardWall: e.target.checked }
                          })}
                          className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <div className="font-medium text-slate-800">Vividbooks Wall</div>
                          <div className="text-sm text-slate-500">Nekonečná nástěnka (vždy zdarma)</div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center p-6">
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
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-start gap-4">
        {/* Subject icon */}
        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xl">
          {subject?.icon || '📚'}
        </div>

        {/* Fields */}
        <div className="flex-1 grid grid-cols-2 gap-3">
          {/* Subject select */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Předmět</label>
            <select
              value={license.subject}
              onChange={(e) => onChange({ subject: e.target.value as Subject })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
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

          {/* Tier select */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Úroveň</label>
            <select
              value={license.tier}
              onChange={(e) => onChange({ tier: e.target.value as FeatureTier })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            >
              {FEATURE_TIERS.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Valid from */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Platná od</label>
            <input
              type="date"
              value={license.validFrom.split('T')[0]}
              onChange={(e) => onChange({ validFrom: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            />
          </div>

          {/* Valid until */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Platná do</label>
            <input
              type="date"
              value={license.validUntil.split('T')[0]}
              onChange={(e) => onChange({ validUntil: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            />
          </div>

          {/* Free license checkbox */}
          <div className="col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={license.isFree || false}
                onChange={(e) => onChange({ isFree: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-600">Zdarma licence (od 15ks pracovních sešitů)</span>
            </label>
            {license.isFree && (
              <input
                type="number"
                placeholder="Počet sešitů"
                value={license.workbookCount || ''}
                onChange={(e) => onChange({ workbookCount: parseInt(e.target.value) || 0 })}
                className="mt-2 w-32 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
              />
            )}
          </div>
        </div>

        {/* Remove button */}
        <button
          onClick={onRemove}
          className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

