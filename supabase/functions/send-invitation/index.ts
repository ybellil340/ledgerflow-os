import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify the calling user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: { user }, error: authError } = await createClient(supabaseUrl, Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    }).auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { email, role, org_id } = await req.json();

    if (!email || !org_id) {
      return new Response(JSON.stringify({ error: 'Email and org_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verify user is admin of this org
    const { data: isAdmin } = await supabase.rpc('has_org_role', { _user_id: user.id, _org_id: org_id, _role: 'company_admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Only admins can invite members' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get org name
    const { data: org } = await supabase.from('organizations').select('name').eq('id', org_id).single();

    // Check if already a member
    const { data: existingMember } = await supabase
      .from('org_members')
      .select('id')
      .eq('org_id', org_id)
      .eq('user_id', (await supabase.auth.admin.listUsers()).data.users.find(u => u.email === email)?.id || '00000000-0000-0000-0000-000000000000')
      .maybeSingle();

    if (existingMember) {
      return new Response(JSON.stringify({ error: 'User is already a member' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check for existing pending invitation
    const { data: existingInvite } = await supabase
      .from('invitations')
      .select('id')
      .eq('org_id', org_id)
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingInvite) {
      return new Response(JSON.stringify({ error: 'Invitation already pending for this email' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Create invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('invitations')
      .insert({
        org_id,
        email,
        role: role || 'employee',
        invited_by: user.id,
      })
      .select()
      .single();

    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Try to send invite via Supabase Auth (generates magic link)
    // This will create the user if they don't exist and send an email
    const siteUrl = req.headers.get('origin') || supabaseUrl;
    const { error: inviteAuthError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/dashboard`,
      data: {
        org_id,
        role: role || 'employee',
        invitation_id: invitation.id,
      },
    });

    // If auth invite fails (user may already exist), that's OK - invitation record is still created
    const emailSent = !inviteAuthError;

    return new Response(
      JSON.stringify({
        success: true,
        invitation_id: invitation.id,
        email_sent: emailSent,
        message: emailSent
          ? `Invitation sent to ${email}`
          : `Invitation created for ${email}. They can join when they sign up.`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
