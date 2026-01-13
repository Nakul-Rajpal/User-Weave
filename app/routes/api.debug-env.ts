/**
 * DEBUG ENDPOINT: Check Environment Variable Accessibility
 * GET /api/debug-env
 *
 * Tests whether environment variables are accessible at runtime in Vercel
 * IMPORTANT: Remove this file after debugging is complete!
 */

import { json } from '@remix-run/node';
import { getServerEnv } from '~/lib/.server/env.server';

export async function loader() {
  console.log('='.repeat(80));
  console.log('🔍 [DEBUG-ENV] Environment Variable Accessibility Check');
  console.log('='.repeat(80));

  const timestamp = new Date().toISOString();

  // Test 1: Direct process.env access
  console.log(`\n[${timestamp}] Test 1: Direct process.env access`);
  const directAccess = {
    VITE_SUPABASE_URL: typeof process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: typeof process.env.VITE_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: typeof process.env.SUPABASE_SERVICE_ROLE_KEY,
    canAccessUrl: process.env.VITE_SUPABASE_URL !== undefined,
    canAccessAnonKey: process.env.VITE_SUPABASE_ANON_KEY !== undefined,
    canAccessServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY !== undefined,
  };
  console.log('Direct access results:', JSON.stringify(directAccess, null, 2));

  // Test 2: getServerEnv() utility function
  console.log(`\n[${timestamp}] Test 2: getServerEnv() utility function`);
  const env = getServerEnv();
  const utilityAccess = {
    urlType: typeof env.SUPABASE_URL,
    anonKeyType: typeof env.SUPABASE_ANON_KEY,
    serviceKeyType: typeof env.SUPABASE_SERVICE_ROLE_KEY,
    urlAccessible: env.SUPABASE_URL !== undefined && env.SUPABASE_URL !== '',
    anonKeyAccessible: env.SUPABASE_ANON_KEY !== undefined && env.SUPABASE_ANON_KEY !== '',
    serviceKeyAccessible: env.SUPABASE_SERVICE_ROLE_KEY !== undefined && env.SUPABASE_SERVICE_ROLE_KEY !== '',
  };
  console.log('Utility function results:', JSON.stringify(utilityAccess, null, 2));

  // Test 3: Check raw process.env object
  const rawEnv = {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  // Test 4: Runtime accessibility check
  console.log(`\n[${timestamp}] Test 3: Runtime accessibility tests`);
  const runtimeTests = {
    canReadProcessEnv: typeof process.env === 'object',
    processEnvKeys: Object.keys(process.env).length,
    hasAnyViteVars: Object.keys(process.env).some(k => k.startsWith('VITE_')),
    hasAnySupabaseVars: Object.keys(process.env).some(k => k.startsWith('SUPABASE_')),
  };
  console.log('Runtime tests:', JSON.stringify(runtimeTests, null, 2));

  // Test 5: Simulate what the API does
  console.log(`\n[${timestamp}] Test 4: Simulating API behavior`);
  const apiSimulation = {
    step1_callGetServerEnv: 'calling getServerEnv()...',
    step2_extractServiceKey: env.SUPABASE_SERVICE_ROLE_KEY || 'FALLBACK_TO_ANON',
    step3_checkLength: env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
    step4_willUseServiceRole: !!(env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_SERVICE_ROLE_KEY.length > 100),
    step5_willFallbackToAnon: !(env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_SERVICE_ROLE_KEY.length > 100),
  };
  console.log('API simulation:', JSON.stringify(apiSimulation, null, 2));

  // Final summary
  const debugInfo = {
    timestamp,
    runtime: {
      nodeEnv: process.env.NODE_ENV,
      platform: process.platform,
      nodeVersion: process.version,
    },

    accessibilityTests: {
      directAccess,
      utilityAccess,
      runtimeTests,
      apiSimulation,
    },

    // Detailed info with safe previews
    variableDetails: {
      VITE_SUPABASE_URL: {
        accessible: directAccess.canAccessUrl,
        type: typeof rawEnv.VITE_SUPABASE_URL,
        isEmpty: rawEnv.VITE_SUPABASE_URL === '' || rawEnv.VITE_SUPABASE_URL === undefined,
        length: rawEnv.VITE_SUPABASE_URL?.length || 0,
        preview: rawEnv.VITE_SUPABASE_URL ? rawEnv.VITE_SUPABASE_URL.substring(0, 35) + '...' : 'NOT_ACCESSIBLE',
      },
      VITE_SUPABASE_ANON_KEY: {
        accessible: directAccess.canAccessAnonKey,
        type: typeof rawEnv.VITE_SUPABASE_ANON_KEY,
        isEmpty: rawEnv.VITE_SUPABASE_ANON_KEY === '' || rawEnv.VITE_SUPABASE_ANON_KEY === undefined,
        length: rawEnv.VITE_SUPABASE_ANON_KEY?.length || 0,
        preview: rawEnv.VITE_SUPABASE_ANON_KEY ? rawEnv.VITE_SUPABASE_ANON_KEY.substring(0, 30) + '...' : 'NOT_ACCESSIBLE',
      },
      SUPABASE_SERVICE_ROLE_KEY: {
        accessible: directAccess.canAccessServiceKey,
        type: typeof rawEnv.SUPABASE_SERVICE_ROLE_KEY,
        isEmpty: rawEnv.SUPABASE_SERVICE_ROLE_KEY === '' || rawEnv.SUPABASE_SERVICE_ROLE_KEY === undefined,
        length: rawEnv.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
        preview: rawEnv.SUPABASE_SERVICE_ROLE_KEY ? rawEnv.SUPABASE_SERVICE_ROLE_KEY.substring(0, 30) + '...' : 'NOT_ACCESSIBLE',
        startsWithEyJ: rawEnv.SUPABASE_SERVICE_ROLE_KEY?.startsWith('eyJ') || false,
      },
    },

    // All env vars starting with VITE_ or SUPABASE_
    allRelevantVars: Object.keys(process.env)
      .filter(key => key.startsWith('VITE_') || key.startsWith('SUPABASE_'))
      .map(key => key), // Just the names, not values

    // Diagnostic summary
    diagnosis: {
      serviceKeyAccessible: directAccess.canAccessServiceKey,
      serviceKeyValid: !!(rawEnv.SUPABASE_SERVICE_ROLE_KEY && rawEnv.SUPABASE_SERVICE_ROLE_KEY.length > 100),
      willBypassRLS: !!(rawEnv.SUPABASE_SERVICE_ROLE_KEY && rawEnv.SUPABASE_SERVICE_ROLE_KEY.length > 100),
      problem: !directAccess.canAccessServiceKey
        ? 'SERVICE_KEY_NOT_ACCESSIBLE'
        : rawEnv.SUPABASE_SERVICE_ROLE_KEY && rawEnv.SUPABASE_SERVICE_ROLE_KEY.length < 100
        ? 'SERVICE_KEY_TOO_SHORT'
        : 'NO_PROBLEM_DETECTED',
    },

    recommendations: [],
  };

  // Generate recommendations
  if (!directAccess.canAccessServiceKey) {
    debugInfo.recommendations.push('❌ CRITICAL: SUPABASE_SERVICE_ROLE_KEY is NOT accessible in process.env');
    debugInfo.recommendations.push('→ Check Vercel Dashboard → Settings → Environment Variables');
    debugInfo.recommendations.push('→ Ensure variable is added for Production environment');
    debugInfo.recommendations.push('→ After adding, redeploy your application');
  } else if (!rawEnv.SUPABASE_SERVICE_ROLE_KEY || rawEnv.SUPABASE_SERVICE_ROLE_KEY.length < 100) {
    debugInfo.recommendations.push('⚠️ WARNING: SUPABASE_SERVICE_ROLE_KEY is accessible but appears invalid');
    debugInfo.recommendations.push('→ Expected length: 200+ characters (JWT format)');
    debugInfo.recommendations.push(`→ Actual length: ${rawEnv.SUPABASE_SERVICE_ROLE_KEY?.length || 0} characters`);
    debugInfo.recommendations.push('→ Verify you copied the service_role key (not anon key) from Supabase');
  } else {
    debugInfo.recommendations.push('✅ SUCCESS: SUPABASE_SERVICE_ROLE_KEY is accessible and appears valid');
    debugInfo.recommendations.push('→ API should be able to bypass RLS policies');
    debugInfo.recommendations.push('→ If issues persist, check RLS policies in Supabase');
  }

  if (!directAccess.canAccessUrl) {
    debugInfo.recommendations.push('❌ VITE_SUPABASE_URL is NOT accessible');
  } else {
    debugInfo.recommendations.push('✅ VITE_SUPABASE_URL is accessible');
  }

  if (!directAccess.canAccessAnonKey) {
    debugInfo.recommendations.push('❌ VITE_SUPABASE_ANON_KEY is NOT accessible');
  } else {
    debugInfo.recommendations.push('✅ VITE_SUPABASE_ANON_KEY is accessible');
  }

  // Log to server console (Vercel logs)
  console.log('\n📊 [DEBUG-ENV] Final Results:');
  console.log(JSON.stringify(debugInfo, null, 2));
  console.log('='.repeat(80));

  return json(debugInfo, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    }
  });
}
