import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Supabase Edge Function pro denní agregaci statistik
 * 
 * Tato funkce by měla být volána jednou denně (např. pomocí cron jobu)
 * nebo manuálně přes HTTP POST request.
 * 
 * Provádí:
 * 1. Agregaci user_stats z user_events
 * 2. Výpočet activity_score a percentile_rank
 * 3. Agregaci school_stats
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('Starting daily stats aggregation...')

    // Call the aggregate_daily_stats function defined in SQL
    const { error: aggregateError } = await supabase.rpc('aggregate_daily_stats')

    if (aggregateError) {
      console.error('Error calling aggregate_daily_stats:', aggregateError)
      throw aggregateError
    }

    console.log('Stats aggregation completed successfully')

    // Get summary stats for response
    const { count: userCount } = await supabase
      .from('user_stats')
      .select('*', { count: 'exact', head: true })

    const { count: schoolCount } = await supabase
      .from('school_stats')
      .select('*', { count: 'exact', head: true })

    const { count: eventCount } = await supabase
      .from('user_events')
      .select('*', { count: 'exact', head: true })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Daily stats aggregation completed',
        summary: {
          users_updated: userCount || 0,
          schools_updated: schoolCount || 0,
          total_events_processed: eventCount || 0,
          timestamp: new Date().toISOString()
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Aggregation error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error during aggregation'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})


