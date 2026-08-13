import { captureApiError } from '@/lib/sentry/capture-api-error';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import Stripe from 'stripe';
import { getErrorMessage } from '@/shared/utils';
import { sendEmail } from '@/shared/lib/email';
import { buildInvoiceNotificationEmail } from '@altitutor/email';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const invoiceId = params.id;

    // Verify user is authenticated and has admin role
    const supabase = createClient();
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin staff
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('role, status')
      .eq('user_id', session.user.id)
      .single<{ role: string; status: string }>();

    if (staffError || !staffData || staffData.role !== 'ADMINSTAFF' || staffData.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get invoice from database with student_id
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('stripe_invoice_id, collection_method, student_id')
      .eq('id', invoiceId)
      .is('deleted_at', null)
      .single<{ stripe_invoice_id: string | null; collection_method: string | null; student_id: string }>();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.collection_method !== 'send_invoice') {
      return NextResponse.json(
        { error: 'Invoice is not a send_invoice type. Use charge card instead.' },
        { status: 400 }
      );
    }

    if (!invoice.stripe_invoice_id) {
      return NextResponse.json({ error: 'Invoice has no Stripe invoice ID' }, { status: 400 });
    }

    // Get Stripe secret key
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: 'Stripe not configured' },
        { status: 500 }
      );
    }

    // Check Resend API key
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      );
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-12-15.clover' });

    // Fetch invoice details from Stripe
    const stripeInvoice = await stripe.invoices.retrieve(invoice.stripe_invoice_id);

    // Get billing preferences
    const { data: billingPrefs } = await supabase
      .from('students_billing')
      .select('invoice_email_to_student, invoice_email_to_parents')
      .eq('student_id', invoice.student_id)
      .maybeSingle<{ invoice_email_to_student: boolean | null; invoice_email_to_parents: boolean | null }>();

    const invoiceEmailToStudent = billingPrefs?.invoice_email_to_student ?? true;
    const invoiceEmailToParents = billingPrefs?.invoice_email_to_parents ?? true;

    // Get student email
    const { data: student } = await supabase
      .from('students')
      .select('email')
      .eq('id', invoice.student_id)
      .single<{ email: string | null }>();

    const studentEmail = student?.email || undefined;

    // Get parent emails
    const { data: parentsData } = await supabase
      .from('parents_students')
      .select('student_id, parent:parents(id, email)')
      .eq('student_id', invoice.student_id)
      .returns<Array<{ student_id: string; parent: { id: string; email: string } | null }>>();

    const parentEmails: string[] = [];
    if (parentsData) {
      for (const row of parentsData) {
        const parent = row.parent;
        const email = parent?.email;
        if (email && typeof email === 'string' && !parentEmails.includes(email)) {
          parentEmails.push(email);
        }
      }
    }

    // Build recipient list based on preferences
    const recipients: string[] = [];
    
    if (invoiceEmailToStudent && studentEmail) {
      recipients.push(studentEmail);
    }
    
    if (invoiceEmailToParents && parentEmails.length > 0) {
      for (const email of parentEmails) {
        if (email && !recipients.includes(email)) {
          recipients.push(email);
        }
      }
    }

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: 'No email recipients configured. Please check billing preferences.' },
        { status: 400 }
      );
    }

    // Format invoice details
    const amount = stripeInvoice.total ? (stripeInvoice.total / 100).toFixed(2) : '0.00';
    const currency = stripeInvoice.currency?.toUpperCase() || 'AUD';
    const invoiceNumber = stripeInvoice.number || invoiceId.slice(0, 8);
    const invoiceDate = stripeInvoice.created ? new Date(stripeInvoice.created * 1000).toLocaleDateString() : 'N/A';
    const dueDate = stripeInvoice.due_date ? new Date(stripeInvoice.due_date * 1000).toLocaleDateString() : 'N/A';
    const hostedInvoiceUrl = stripeInvoice.hosted_invoice_url || '';
    const invoicePdfUrl = stripeInvoice.invoice_pdf || '';
    const paid = stripeInvoice.status === 'paid';

    let lineItems: Array<{ description: string; amount: string }> = [];
    try {
      const lines = await stripe.invoices.listLineItems(invoice.stripe_invoice_id, {
        limit: 100,
      });
      lineItems = lines.data.map((line) => ({
        description: line.description || 'Invoice item',
        amount: `${currency} $${(line.amount / 100).toFixed(2)}`,
      }));
    } catch (err) {
      console.warn(
        `[api/invoices/send-invoice] Failed to list line items for ${invoice.stripe_invoice_id}:`,
        err
      );
    }

    const email = buildInvoiceNotificationEmail({
      invoiceNumber,
      invoiceDate,
      dueDate,
      amount: `${currency} $${amount}`,
      paid,
      lineItems,
      hostedInvoiceUrl: hostedInvoiceUrl || undefined,
      invoicePdfUrl: invoicePdfUrl || undefined,
    });

    // Send emails to all recipients
    const sent: string[] = [];
    const failed: string[] = [];

    for (const recipient of recipients) {
      try {
        await sendEmail({
          to: recipient,
          email,
        });
        sent.push(recipient);
      } catch (err) {
        console.error(`[api/invoices/send-invoice] Failed to send to ${recipient}:`, err);
        failed.push(recipient);
      }
    }

    if (failed.length > 0 && sent.length === 0) {
      return NextResponse.json(
        { error: `Failed to send invoice email to all recipients: ${failed.join(', ')}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sent,
      failed: failed.length > 0 ? failed : undefined,
      message: `Invoice email sent to ${sent.length} recipient(s)${failed.length > 0 ? `, failed for ${failed.length} recipient(s)` : ''}`,
    });
  } catch (error) {
    captureApiError(error, "/api/invoices/[id]/send-invoice");
    console.error('[api/invoices/send-invoice] Error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
