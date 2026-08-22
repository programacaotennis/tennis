import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authorization = request.headers.get('Authorization') || '';
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const { booking_id: bookingId } = await request.json();
    if (!bookingId) return Response.json({ error: 'booking_id is required' }, { status: 400, headers: corsHeaders });

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: booking, error: bookingError } = await admin.from('bookings')
      .select('id, user_id, booking_date, start_time, end_time, status, courts(name)')
      .eq('id', bookingId).single();
    if (bookingError || !booking || booking.user_id !== user.id || booking.status !== 'cancelled') {
      return Response.json({ error: 'Booking not found' }, { status: 404, headers: corsHeaders });
    }

    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const subject = Deno.env.get('VAPID_SUBJECT') || 'mailto:contato@programacaotennis.com';
    if (!publicKey || !privateKey) return Response.json({ error: 'VAPID keys are not configured' }, { status: 503, headers: corsHeaders });
    webpush.setVapidDetails(subject, publicKey, privateKey);

    const { data: subscriptions, error: subscriptionsError } = await admin.from('push_subscriptions')
      .select('id, endpoint, p256dh, auth').neq('user_id', user.id);
    if (subscriptionsError) return Response.json({ error: subscriptionsError.message }, { status: 500, headers: corsHeaders });

    const court = (booking.courts as { name?: string } | null)?.name || 'uma quadra';
    const time = `${booking.start_time.slice(0, 5)}–${booking.end_time.slice(0, 5)}`;
    const payload = JSON.stringify({ title: 'Horário liberado', body: `${court}: ${booking.booking_date} às ${time}. Toque para reservar.`, url: '/' });
    await Promise.all((subscriptions || []).map(async (subscription) => {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload);
      } catch (error) {
        if ((error as { statusCode?: number }).statusCode === 404 || (error as { statusCode?: number }).statusCode === 410) await admin.from('push_subscriptions').delete().eq('id', subscription.id);
      }
    }));
    return Response.json({ delivered: subscriptions?.length || 0 }, { headers: corsHeaders });
  },
};
