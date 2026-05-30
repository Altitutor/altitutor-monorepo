import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NativeAction } from '@/components/native-action';
import {
  Card,
  EmptyBlock,
  ErrorBlock,
  formatMoney,
  LoadingBlock,
  SectionTitle,
  StudentScreen,
} from '@/components/student-ui';
import { useBilling, useInvoices, useSubscriptions } from '@/hooks/use-student-data';
import { useTheme } from '@/hooks/use-theme';
import { readPaymentMethod, type StudentInvoiceWithItems } from '@/lib/student-api';

const PAGE_SIZE = 5;
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid']);

function invoiceStatus(invoice: StudentInvoiceWithItems) {
  const today = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Australia/Adelaide',
    year: 'numeric',
  }).format(new Date());
  if (invoice.status === 'open' && !invoice.paid_at && invoice.invoice_date && invoice.invoice_date < today) {
    return 'overdue';
  }
  return invoice.paid_at || invoice.status === 'paid' ? 'paid' : (invoice.status ?? 'open');
}

function billingFrequency(periodStart: string | null, periodEnd: string | null) {
  if (!periodStart || !periodEnd) return 'Recurring';
  const days = (new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 10) return 'Weekly';
  if (days <= 45) return 'Monthly';
  if (days <= 120) return 'Quarterly';
  if (days <= 220) return 'Biannual';
  return 'Yearly';
}

export default function BillingScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [invoiceLimit, setInvoiceLimit] = useState(PAGE_SIZE);
  const billing = useBilling();
  const invoices = useInvoices(invoiceLimit + 1);
  const subscriptions = useSubscriptions();
  const method = readPaymentMethod(billing.data);
  const activeSubscriptions = useMemo(
    () => (subscriptions.data ?? []).filter((subscription) => ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status ?? '')),
    [subscriptions.data],
  );
  const visibleInvoices = invoices.data?.slice(0, invoiceLimit);
  const hasMoreInvoices = (invoices.data?.length ?? 0) > invoiceLimit;

  function openInvoice(url: string | null) {
    if (!url) return;
    router.push({ pathname: '/invoice-viewer', params: { url } });
  }

  return (
    <StudentScreen title="Billing" subtitle="Payment details and recent invoices.">
      <SectionTitle>Payment method</SectionTitle>
      {billing.isPending ? <LoadingBlock /> : null}
      {billing.isError ? <ErrorBlock message={billing.error.message} /> : null}
      {billing.data ? (
        <>
          <View style={[styles.paymentCard, { backgroundColor: '#0A2941', shadowColor: theme.shadow }]}>
            <Text style={styles.paymentLabel}>DEFAULT PAYMENT METHOD</Text>
            <Text style={styles.paymentBrand}>{method ? method.card_brand.toUpperCase() : 'NO CARD ON FILE'}</Text>
            <Text style={styles.paymentNumber}>{method ? `••••  ••••  ••••  ${method.card_last4}` : 'Add a payment method to get started'}</Text>
            {method ? <Text style={styles.paymentExpiry}>Expires {method.card_exp_month}/{method.card_exp_year}</Text> : null}
          </View>
          <NativeAction label="Manage billing" onPress={() => router.push('/billing-management')} />
        </>
      ) : null}
      {subscriptions.isPending ? <LoadingBlock label="Loading subscriptions..." /> : null}
      {subscriptions.isError ? <ErrorBlock message={subscriptions.error.message} /> : null}
      {activeSubscriptions.length ? <SectionTitle>Subscriptions</SectionTitle> : null}
      {activeSubscriptions.map((subscription) => (
        <Card key={subscription.id ?? subscription.stripe_subscription_id ?? subscription.subject_id}>
          <View style={styles.subscriptionRow}>
            <View style={styles.grow}>
              <Text style={[styles.invoiceTitle, { color: theme.text }]} numberOfLines={1}>
                {subscription.subject?.long_name ?? subscription.subject?.short_name ?? subscription.subject?.name ?? 'Subscription'}
              </Text>
              <Text style={[styles.invoiceDate, { color: theme.textSecondary }]}>
                {subscription.current_period_end
                  ? `${billingFrequency(subscription.current_period_start, subscription.current_period_end)} · Next payment ${new Date(subscription.current_period_end).toLocaleDateString('en-AU')}`
                  : 'Recurring subscription'}
              </Text>
            </View>
            <Text style={[styles.activeStatus, { color: subscription.status === 'active' || subscription.status === 'trialing' ? theme.success : theme.warning }]}>
              {(subscription.status ?? 'active').replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </Card>
      ))}
      <SectionTitle>Recent invoices</SectionTitle>
      {invoices.isPending ? <LoadingBlock /> : null}
      {invoices.isError ? <ErrorBlock message={invoices.error.message} /> : null}
      {visibleInvoices?.length === 0 ? <EmptyBlock>No invoices found.</EmptyBlock> : null}
      {visibleInvoices?.map((invoice) => {
        const item = invoice.items.find((entry) => !entry.is_subsidy) ?? invoice.items[0];
        const status = invoiceStatus(invoice);
        const statusColor = status === 'paid' ? theme.success : status === 'overdue' ? theme.danger : theme.warning;
        return (
          <Pressable
            key={invoice.id ?? invoice.stripe_invoice_number ?? invoice.invoice_date}
            disabled={!invoice.hosted_invoice_url}
            onPress={() => openInvoice(invoice.hosted_invoice_url)}>
            <Card>
              <View style={styles.invoiceHeading}>
                <Text style={[styles.invoiceTitle, styles.grow, { color: theme.text }]} numberOfLines={1}>
                  {item?.subject_name ?? item?.description ?? 'Student invoice'}
                </Text>
                <Text style={[styles.invoiceAmount, { color: theme.text }]}>
                  {formatMoney(invoice.amount_due_cents ?? invoice.amount_paid_cents, invoice.currency?.toUpperCase() ?? 'AUD')}
                </Text>
              </View>
              <Text style={[styles.invoiceDate, { color: theme.textSecondary }]}>
                {item?.session_start_at ? `${new Date(item.session_start_at).toLocaleDateString('en-AU')} session` : invoice.invoice_date ?? 'Invoice'}
              </Text>
              <View style={styles.invoiceFooter}>
                <View style={[styles.statusPill, { backgroundColor: `${statusColor}18` }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>{status.toUpperCase()}</Text>
                </View>
                {invoice.hosted_invoice_url ? <Text style={[styles.chevron, { color: theme.textSecondary }]}>›</Text> : null}
              </View>
            </Card>
          </Pressable>
        );
      })}
      {hasMoreInvoices ? (
        <NativeAction label="Show more invoices" onPress={() => setInvoiceLimit((limit) => limit + PAGE_SIZE)} />
      ) : null}
    </StudentScreen>
  );
}

const styles = StyleSheet.create({
  paymentCard: {
    borderRadius: 22,
    minHeight: 190,
    padding: 20,
    justifyContent: 'space-between',
    shadowOpacity: 0.14,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
  },
  paymentLabel: { color: '#92B9C6', fontSize: 11, letterSpacing: 1.1, fontWeight: '700' },
  paymentBrand: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', alignSelf: 'flex-end' },
  paymentNumber: { color: '#FFFFFF', fontSize: 21, fontWeight: '600', letterSpacing: 1.2 },
  paymentExpiry: { color: '#E5ECED', fontSize: 13, fontWeight: '500' },
  grow: { flex: 1 },
  subscriptionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  activeStatus: { fontSize: 11, fontWeight: '700' },
  invoiceHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  invoiceTitle: { fontSize: 16, fontWeight: '600' },
  invoiceAmount: { fontSize: 16, fontWeight: '700' },
  invoiceDate: { fontSize: 13, marginTop: 6 },
  invoiceFooter: { alignItems: 'flex-end', flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 12 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: '700' },
  chevron: { fontSize: 22, lineHeight: 20 },
});
