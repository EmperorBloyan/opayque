import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: merchant, error } = await supabase
    .from('merchants')
    .select('email, secondary_email, merchant_name')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!merchant) return NextResponse.json({ error: 'Merchant profile not found' }, { status: 404 });

  const recipients = [merchant.email, merchant.secondary_email]
    .filter((value): value is string => Boolean(value))
    .map((email) => email.trim())
    .filter(Boolean);

  const uniqueRecipients = Array.from(new Set(recipients));
  if (uniqueRecipients.length === 0) {
    return NextResponse.json({ error: 'No configured merchant email addresses' }, { status: 400 });
  }

  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  const sendgridFromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!sendgridApiKey || !sendgridFromEmail) {
    return NextResponse.json({ error: 'Email provider not configured' }, { status: 501 });
  }

  const message = `Your developer hub access is protected by the Access Control Center. If the hub is locked, sign in again with your password and registered email to restore access. Keep your primary and secondary email addresses current for the best protection.`;

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sendgridApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: uniqueRecipients.map((email) => ({ email })),
          subject: `Access Gate Notification for ${merchant.merchant_name ?? 'your merchant account'}`,
        },
      ],
      from: { email: sendgridFromEmail },
      content: [
        {
          type: 'text/plain',
          value: message,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json({ error: `Failed to send email: ${errorText}` }, { status: response.status || 500 });
  }

  return NextResponse.json({ success: true, message: 'Access gate notification sent successfully.' });
}
