import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';

export async function POST(request: Request) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:6',message:'API route entry',data:{hasBody:!!request.body},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  try {
    const body = await request.json();
    const { operations, staffId } = body;

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:9',message:'Request body parsed',data:{hasOperations:!!operations,operationsIsArray:Array.isArray(operations),operationsCount:Array.isArray(operations)?operations.length:0,hasStaffId:!!staffId,staffId,operations:operations||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,D'})}).catch(()=>{});
    // #endregion

    // Validate required fields
    if (!operations || !Array.isArray(operations)) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:12',message:'Validation failed: operations',data:{operations,operationsType:typeof operations},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return NextResponse.json(
        { error: 'operations array is required' },
        { status: 400 }
      );
    }

    if (!staffId) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:19',message:'Validation failed: staffId',data:{staffId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return NextResponse.json(
        { error: 'staffId is required' },
        { status: 400 }
      );
    }

    // Get Supabase client with service role key for RPC call
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // #region agent log
    // Query staff record to verify role and status before RPC call
    const { data: staffRecord, error: staffQueryError } = await supabase
      .from('staff')
      .select('id, role, status')
      .eq('id', staffId)
      .single();
    
    fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:37',message:'Staff record query before RPC',data:{staffId,staffRecord,staffQueryError:staffQueryError?{message:staffQueryError.message,code:staffQueryError.code}:null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    // Clean up operations - remove replacement_staff_id for 'log' actions
    const cleanedOperations = operations.map((op: any) => {
      if (op.action === 'log') {
        const { replacement_staff_id, ...rest } = op;
        return rest;
      }
      return op;
    });

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:45',message:'Operations cleaned before RPC call',data:{originalCount:operations.length,cleanedCount:cleanedOperations.length,cleanedOperations,staffId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,E'})}).catch(()=>{});
    // #endregion

    console.log('Calling log_staff_absences RPC with:', {
      operationsCount: cleanedOperations.length,
      loggedByStaffId: staffId,
      operations: cleanedOperations,
    });

    // Call the RPC function
    const { data, error } = await supabase.rpc('log_staff_absences' as any, {
      operations: cleanedOperations as any,
      logged_by_staff_id: staffId,
    });

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:63',message:'RPC call completed',data:{hasError:!!error,hasData:!!data,error:error?{message:error.message,code:error.code,details:error.details}:null,data},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    if (error) {
      console.error('Error calling log_staff_absences RPC:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to log staff absences' },
        { status: 500 }
      );
    }

    console.log('RPC response:', data);

    // Check if the RPC function returned an error in the result
    if (data && typeof data === 'object' && 'success' in data && !data.success) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:77',message:'RPC function returned error in response',data:{rpcResponse:data,errorMessage:(data as any).error},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      console.error('RPC function returned error:', data);
      return NextResponse.json(
        { error: (data as any).error || 'Failed to log staff absences' },
        { status: 400 }
      );
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:84',message:'API route success',data:{success:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return NextResponse.json({ success: true, data });
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:87',message:'Unexpected error caught',data:{error:error instanceof Error?{message:error.message,stack:error.stack}:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    console.error('Unexpected error in log staff absences API route:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

