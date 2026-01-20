import { useState, useCallback } from 'react';
import { supabase } from '../utils/supabase/client';

// Generate UUID using native crypto API
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Types
export interface School {
  id: string;
  name: string;
  totalTeachers: number;
  activeTeachers: number;
  totalStudents: number;
  activeStudents: number;
  licenseExpiry: string;
  monthlyAICost: number;
  monthlyAccess: number;
  lastActivity: string;
  trend: 'up' | 'down' | 'stable';
  healthScore: number;
  activityLevel: 'very_active' | 'active' | 'inactive';
  contact: {
    name: string;
    email: string;
    phone: string;
  };
  subjectLicenses?: Array<{
    subject: string;
    tier: string;
    validUntil?: string;
    isFree?: boolean;
  }>;
  hasEcosystemVividbooks?: boolean;
  hasVividboard?: boolean;
  hasVividboardWall?: boolean;
  teachers?: Array<{
    id: string;
    name: string;
    email: string;
    subject: string;
    monthlyAccess: number;
    lastActive: string;
    activityLevel: string;
  }>;
}

export interface Alert {
  id: string;
  type: 'churn_risk' | 'upsell' | 'renewal' | 'engagement' | 'onboarding' | 'support';
  severity: 'critical' | 'high' | 'medium' | 'low';
  schoolId: string;
  schoolName: string;
  teacherId?: string;
  teacherName?: string;
  title: string;
  description: string;
  recommendation: string;
  aiReasoning?: string;
  metricsSnapshot?: Record<string, unknown>;
  status: 'new' | 'acknowledged' | 'in_progress' | 'resolved' | 'dismissed' | 'false_positive';
  createdAt: string;
  fingerprint?: string;
}

export interface AlertGenerationResult {
  alerts: Alert[];
  schoolsAnalyzed: number;
  alertsGenerated: number;
  alertsSkipped: number;
  tokensUsed?: number;
  error?: string;
}

// Gemini API configuration
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyDcPJrEcxThsVskj2LvYf6VB3mGTM45Ih0';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Helper to calculate days until expiry
const daysUntilExpiry = (expiryDate: string): number => {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diff = expiry.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// Helper to calculate days since last activity
const daysSinceActivity = (lastActivity: string): number => {
  const now = new Date();
  const activity = new Date(lastActivity);
  const diff = now.getTime() - activity.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// Generate fingerprint for deduplication
const generateFingerprint = (alert: Partial<Alert>): string => {
  const key = `${alert.type}-${alert.schoolId}-${alert.title}`.toLowerCase().replace(/\s+/g, '-');
  return key;
};

export function useAlertAgent() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, status: '' });
  const [lastGeneration, setLastGeneration] = useState<AlertGenerationResult | null>(null);

  // Fetch existing alerts from Supabase
  const fetchExistingAlerts = useCallback(async (): Promise<Alert[]> => {
    try {
      const { data, error } = await supabase
        .from('cs_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.warn('Could not fetch existing alerts from Supabase:', error);
        return [];
      }

      return (data || []).map(row => ({
        id: row.id,
        type: row.type,
        severity: row.severity,
        schoolId: row.school_id,
        schoolName: row.school_name,
        teacherId: row.teacher_id,
        teacherName: row.teacher_name,
        title: row.title,
        description: row.description,
        recommendation: row.recommendation,
        aiReasoning: row.ai_reasoning,
        metricsSnapshot: row.metrics_snapshot,
        status: row.status,
        createdAt: row.created_at,
        fingerprint: row.fingerprint,
      }));
    } catch (err) {
      console.warn('Error fetching alerts:', err);
      return [];
    }
  }, []);

  // Save alerts to Supabase
  const saveAlerts = useCallback(async (alerts: Alert[], batchId: string): Promise<number> => {
    try {
      const rows = alerts.map(alert => ({
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        school_id: alert.schoolId,
        school_name: alert.schoolName,
        teacher_id: alert.teacherId,
        teacher_name: alert.teacherName,
        title: alert.title,
        description: alert.description,
        recommendation: alert.recommendation,
        ai_reasoning: alert.aiReasoning,
        metrics_snapshot: alert.metricsSnapshot,
        status: alert.status,
        created_at: alert.createdAt,
        fingerprint: alert.fingerprint,
        generation_batch_id: batchId,
      }));

      const { data, error } = await supabase
        .from('cs_alerts')
        .upsert(rows, { onConflict: 'fingerprint', ignoreDuplicates: true })
        .select();

      if (error) {
        console.warn('Could not save alerts to Supabase:', error);
        return 0;
      }

      return data?.length || 0;
    } catch (err) {
      console.warn('Error saving alerts:', err);
      return 0;
    }
  }, []);

  // Call Gemini AI to analyze schools and generate alerts
  const callGeminiForAlerts = useCallback(async (
    schools: School[],
    existingAlerts: Alert[],
    maxAlerts: number = 10
  ): Promise<{ alerts: Alert[]; tokensUsed: number }> => {
    
    // Prepare school data summary
    const schoolsSummary = schools.map(school => ({
      id: school.id,
      name: school.name,
      healthScore: school.healthScore,
      activityLevel: school.activityLevel,
      trend: school.trend,
      teacherRatio: `${school.activeTeachers}/${school.totalTeachers}`,
      studentRatio: `${school.activeStudents}/${school.totalStudents}`,
      daysUntilLicenseExpiry: daysUntilExpiry(school.licenseExpiry),
      daysSinceLastActivity: daysSinceActivity(school.lastActivity),
      monthlyAICost: school.monthlyAICost,
      monthlyAccess: school.monthlyAccess,
      hasEcosystem: school.hasEcosystemVividbooks,
      hasVividboard: school.hasVividboard,
      paidSubjects: school.subjectLicenses?.filter(s => s.tier !== 'none' && !s.isFree).length || 0,
      freeSubjects: school.subjectLicenses?.filter(s => s.isFree).length || 0,
      inactiveTeachers: school.teachers?.filter(t => t.activityLevel === 'inactive').length || 0,
      contactName: school.contact.name,
    }));

    // Summarize existing alerts to avoid duplicates
    const recentAlertsSummary = existingAlerts
      .filter(a => a.status !== 'resolved' && a.status !== 'dismissed')
      .slice(0, 20)
      .map(a => ({
        type: a.type,
        schoolId: a.schoolId,
        title: a.title,
        status: a.status,
        createdAt: a.createdAt,
      }));

    const prompt = `Jsi Customer Success AI agent pro Vividbooks (vzdělávací platforma pro školy).

TVŮJ ÚKOL:
Analyzuj data škol a vygeneruj max ${maxAlerts} nejdůležitějších upozornění pro CS tým.

AKTUÁLNÍ DATA ŠKOL:
${JSON.stringify(schoolsSummary, null, 2)}

EXISTUJÍCÍ AKTIVNÍ UPOZORNĚNÍ (nevytvářej duplicity):
${JSON.stringify(recentAlertsSummary, null, 2)}

PRAVIDLA PRO GENEROVÁNÍ UPOZORNĚNÍ:

1. TYPY UPOZORNĚNÍ:
   - churn_risk: Riziko odchodu (nízká aktivita, blížící se expirace, klesající trend)
   - upsell: Příležitost pro prodej (vysoká aktivita, spokojení uživatelé, nevyužité produkty)
   - renewal: Blížící se obnovení licence (30-180 dní do expirace)
   - engagement: Nízký engagement (málo aktivních učitelů/studentů)
   - onboarding: Problémy s onboardingem nových škol
   - support: Potřeba podpory

2. SEVERITY:
   - critical: Okamžitá akce nutná (expirace do 30 dní + klesající aktivita)
   - high: Urgentní (expirace do 60 dní NEBO health score < 40)
   - medium: Důležité (expirace do 120 dní NEBO health score < 60)
   - low: Informativní

3. PRIORITY ANALÝZY:
   - Školy s klesajícím trendem (trend: "down")
   - Nízký health score (< 50)
   - Blížící se expirace licence
   - Vysoký poměr neaktivních učitelů
   - Příležitosti u velmi aktivních škol

4. NEVYTVÁŘEJ:
   - Duplicitní upozornění pro stejnou školu a typ
   - Upozornění pro školy s health score > 85 (pokud to není upsell příležitost)
   - Obecná/vágní upozornění bez konkrétních dat

FORMÁT ODPOVĚDI (POUZE JSON):
{
  "alerts": [
    {
      "type": "churn_risk",
      "severity": "high",
      "schoolId": "3",
      "schoolName": "ZŠ a MŠ Ostrava-Poruba",
      "title": "Kritický pokles aktivity - nutná okamžitá akce",
      "description": "Health score 35/100. Pouze 8 z 22 učitelů aktivních. Aktivita klesla o 68%. Licence vyprší za 75 dní.",
      "recommendation": "1. Urgentní telefonát s kontaktem (Ing. Petr Horák). 2. Nabídnout bezplatné školení. 3. Zjistit důvody poklesu.",
      "aiReasoning": "Kombinace nízkého health score, klesajícího trendu a blížící se expirace vytváří kritické riziko churnu."
    }
  ],
  "analysis": "Krátké shrnutí celkového stavu portfolia škol."
}

Odpověz POUZE validním JSON objektem bez dalšího textu.`;

    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3, // Lower for more consistent/deterministic output
            maxOutputTokens: 4096,
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const tokensUsed = data.usageMetadata?.totalTokenCount || 0;

      console.log('🤖 AI Response:', text.substring(0, 500));

      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('❌ No JSON found in AI response');
        throw new Error('Invalid response format - no JSON found');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      console.log('📋 Parsed alerts count:', parsed.alerts?.length || 0);
      
      const now = new Date().toISOString();
      
      const alerts: Alert[] = (parsed.alerts || []).map((a: Partial<Alert>) => ({
        id: generateUUID(),
        type: a.type || 'engagement',
        severity: a.severity || 'medium',
        schoolId: a.schoolId || '',
        schoolName: a.schoolName || '',
        teacherId: a.teacherId,
        teacherName: a.teacherName,
        title: a.title || 'Upozornění',
        description: a.description || '',
        recommendation: a.recommendation || '',
        aiReasoning: a.aiReasoning,
        metricsSnapshot: {
          generatedAt: now,
          schoolsAnalyzed: schools.length,
        },
        status: 'new' as const,
        createdAt: now,
        fingerprint: generateFingerprint(a),
      }));

      return { alerts, tokensUsed };
    } catch (error) {
      console.error('Error calling Gemini:', error);
      throw error;
    }
  }, []);

  // Local storage for alerts when Supabase is not available
  const [localAlerts, setLocalAlerts] = useState<Alert[]>([]);

  // Main function to generate alerts
  const generateAlerts = useCallback(async (
    schools: School[],
    options: {
      maxAlerts?: number;
      saveToSupabase?: boolean;
    } = {}
  ): Promise<AlertGenerationResult> => {
    const { maxAlerts = 10, saveToSupabase = true } = options;
    const batchId = generateUUID();
    
    setIsGenerating(true);
    setProgress({ current: 0, total: 3, status: 'Načítám existující upozornění...' });

    try {
      // Step 1: Fetch existing alerts
      const existingAlerts = await fetchExistingAlerts();
      setProgress({ current: 1, total: 3, status: 'Analyzuji data škol pomocí AI...' });

      // Step 2: Call Gemini
      const { alerts: newAlerts, tokensUsed } = await callGeminiForAlerts(
        schools,
        existingAlerts,
        maxAlerts
      );
      setProgress({ current: 2, total: 3, status: 'Ukládám upozornění...' });

      // Step 3: Filter out duplicates by fingerprint
      const existingFingerprints = new Set(existingAlerts.map(a => a.fingerprint));
      console.log('🔍 Existing fingerprints:', existingFingerprints.size);
      console.log('🆕 New alerts from AI:', newAlerts.length);
      newAlerts.forEach(a => console.log('  -', a.fingerprint, a.title));
      
      const uniqueAlerts = newAlerts.filter(a => !existingFingerprints.has(a.fingerprint));
      const skippedCount = newAlerts.length - uniqueAlerts.length;
      console.log('✅ Unique alerts to save:', uniqueAlerts.length, '| Skipped:', skippedCount);

      // Step 4: Save to Supabase if enabled, fallback to local storage
      let savedCount = uniqueAlerts.length;
      if (saveToSupabase && uniqueAlerts.length > 0) {
        const supabaseSavedCount = await saveAlerts(uniqueAlerts, batchId);
        console.log('💾 Saved to Supabase:', supabaseSavedCount);
        
        // If Supabase failed, save to local state
        if (supabaseSavedCount === 0) {
          console.log('📦 Supabase unavailable, using local storage');
          setLocalAlerts(prev => [...uniqueAlerts, ...prev]);
          savedCount = uniqueAlerts.length;
        } else {
          savedCount = supabaseSavedCount;
        }
      } else if (uniqueAlerts.length > 0) {
        // No Supabase, use local storage
        setLocalAlerts(prev => [...uniqueAlerts, ...prev]);
      }

      // Log generation (ignore errors)
      if (saveToSupabase) {
        supabase.from('cs_alert_generation_logs').insert({
          batch_id: batchId,
          completed_at: new Date().toISOString(),
          schools_analyzed: schools.length,
          alerts_generated: savedCount,
          alerts_skipped: skippedCount,
          model_used: 'gemini-2.0-flash',
          tokens_used: tokensUsed,
        }).then(() => {}).catch(() => {});
      }

      setProgress({ current: 3, total: 3, status: 'Hotovo!' });

      const result: AlertGenerationResult = {
        alerts: uniqueAlerts,
        schoolsAnalyzed: schools.length,
        alertsGenerated: uniqueAlerts.length, // Use actual count
        alertsSkipped: skippedCount,
        tokensUsed,
      };

      setLastGeneration(result);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Alert generation failed:', error);
      
      const result: AlertGenerationResult = {
        alerts: [],
        schoolsAnalyzed: schools.length,
        alertsGenerated: 0,
        alertsSkipped: 0,
        error: errorMessage,
      };
      
      setLastGeneration(result);
      return result;

    } finally {
      setIsGenerating(false);
    }
  }, [fetchExistingAlerts, callGeminiForAlerts, saveAlerts]);

  // Update alert status
  const updateAlertStatus = useCallback(async (
    alertId: string,
    newStatus: Alert['status'],
    notes?: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase.rpc('update_alert_status', {
        p_alert_id: alertId,
        p_new_status: newStatus,
        p_notes: notes,
      });

      if (error) {
        // Fallback to direct update
        const { error: updateError } = await supabase
          .from('cs_alerts')
          .update({ 
            status: newStatus,
            resolution_notes: notes,
            ...(newStatus === 'acknowledged' ? { acknowledged_at: new Date().toISOString() } : {}),
            ...(['resolved', 'dismissed', 'false_positive'].includes(newStatus) 
              ? { resolved_at: new Date().toISOString() } : {}),
          })
          .eq('id', alertId);
        
        if (updateError) throw updateError;
      }

      return true;
    } catch (err) {
      console.error('Error updating alert status:', err);
      return false;
    }
  }, []);

  // Fetch all alerts (for display) - returns local alerts if Supabase unavailable
  const fetchAlerts = useCallback(async (options: {
    status?: Alert['status'][];
    type?: Alert['type'][];
    severity?: Alert['severity'][];
    limit?: number;
  } = {}): Promise<Alert[]> => {
    try {
      let query = supabase
        .from('cs_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(options.limit || 50);

      if (options.status?.length) {
        query = query.in('status', options.status);
      }
      if (options.type?.length) {
        query = query.in('type', options.type);
      }
      if (options.severity?.length) {
        query = query.in('severity', options.severity);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('Supabase unavailable, returning local alerts');
        return localAlerts;
      }

      return (data || []).map(row => ({
        id: row.id,
        type: row.type,
        severity: row.severity,
        schoolId: row.school_id,
        schoolName: row.school_name,
        teacherId: row.teacher_id,
        teacherName: row.teacher_name,
        title: row.title,
        description: row.description,
        recommendation: row.recommendation,
        aiReasoning: row.ai_reasoning,
        metricsSnapshot: row.metrics_snapshot,
        status: row.status,
        createdAt: row.created_at,
        fingerprint: row.fingerprint,
      }));
    } catch (err) {
      console.error('Error fetching alerts:', err);
      return localAlerts;
    }
  }, [localAlerts]);

  // Get local alerts directly
  const getLocalAlerts = useCallback(() => localAlerts, [localAlerts]);

  return {
    generateAlerts,
    fetchAlerts,
    getLocalAlerts,
    updateAlertStatus,
    isGenerating,
    progress,
    localAlerts,
    lastGeneration,
  };
}

export default useAlertAgent;

