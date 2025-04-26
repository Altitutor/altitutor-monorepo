// Supabase Edge Function to set a user's role
// This function can only be called by ADMINSTAFF users 
// Usage: POST /functions/v1/set-user-role
// Body: { "user_id": "uuid", "role": "ADMINSTAFF" | "TUTOR" | "STUDENT" }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface RequestBody {
  user_id: string;
  role: "ADMINSTAFF" | "TUTOR" | "STUDENT";
}

serve(async (req) => {
  // Get the authorization header from the request
  const authorization = req.headers.get("Authorization");
  if (!authorization) {
    return new Response(
      JSON.stringify({ error: "Not authorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Extract the JWT token from the Authorization header
  const token = authorization.replace("Bearer ", "");

  // Create a Supabase client with the admin key
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Verify that the requesting user has ADMINSTAFF role
    const {
      data: { user },
    } = await supabase.auth.getUser(token);

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if the requesting user has the ADMINSTAFF role
    if (user.user_metadata?.user_role !== "ADMINSTAFF") {
      return new Response(
        JSON.stringify({ error: "Only ADMINSTAFF users can set roles" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { user_id, role } = await req.json() as RequestBody;

    if (!user_id || !role) {
      return new Response(
        JSON.stringify({ error: "Missing user_id or role" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate role
    if (!["ADMINSTAFF", "TUTOR", "STUDENT"].includes(role)) {
      return new Response(
        JSON.stringify({ error: "Invalid role. Must be ADMINSTAFF, TUTOR or STUDENT" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Update the user's role
    const { error } = await supabase.auth.admin.updateUserById(
      user_id,
      { user_metadata: { user_role: role } }
    );

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Return success response
    return new Response(
      JSON.stringify({ message: `Role successfully updated to ${role}` }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}); 