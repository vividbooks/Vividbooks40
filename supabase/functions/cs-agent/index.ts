import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'https://esm.sh/openai@4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // 1. Fetch stats
    const { data: schoolStats, error: schoolError } = await supabase
      .from('school_stats')
      .select('*')
      .neq('activity_level', 'very_active'); // Focus on problematic schools

    if (schoolError) throw schoolError;

    const { data: onboardingStats, error: onboardingError } = await supabase
      .from('user_onboarding')
      .select('*')
      .is('completed_at', null)
      .lt('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()); // Stalled for 7 days

    if (onboardingError) throw onboardingError;

    const tasks = [];

    // 2. Analyze Schools
    for (const school of schoolStats || []) {
      if (school.total_teachers > 0 && school.active_teachers_30d === 0) {
        // Inactive school
        const prompt = `Škola ${school.school_id} má ${school.total_teachers} učitelů, ale 0 aktivních za posledních 30 dní. Navrhni CS úkol pro reaktivaci.`;
        
        const completion = await openai.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "gpt-4o-mini",
        });

        const reasoning = completion.choices[0].message.content;

        tasks.push({
          school_id: school.school_id,
          task_type: 'reactivation',
          priority: 5,
          title: 'Kriticky neaktivní škola',
          description: `Škola má ${school.total_teachers} učitelů bez aktivity.`,
          ai_reasoning: reasoning,
          status: 'pending'
        });
      }
    }

    // 3. Analyze Onboarding
    for (const ob of onboardingStats || []) {
      // Fetch user profile to get school_id (if available)
      // Assuming we have a way to get school_id from user_id or it's in onboarding (it's not, check user_stats)
      const { data: userStat } = await supabase.from('user_stats').select('school_id').eq('user_id', ob.user_id).single();
      
      if (userStat?.school_id) {
        const prompt = `Učitel ${ob.user_id} začal onboarding před týdnem ale nedokončil ho. Zasekl se. Navrhni pomoc.`;
        
        const completion = await openai.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "gpt-4o-mini",
        });

        tasks.push({
          school_id: userStat.school_id,
          user_id: ob.user_id,
          task_type: 'onboarding_help',
          priority: 3,
          title: 'Nedokončený onboarding',
          description: 'Učitel nedokončil onboarding do týdne.',
          ai_reasoning: completion.choices[0].message.content,
          status: 'pending'
        });
      }
    }

    // 4. Save Tasks
    if (tasks.length > 0) {
      const { error: insertError } = await supabase.from('cs_tasks').insert(tasks);
      if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({ success: true, tasks_created: tasks.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})


