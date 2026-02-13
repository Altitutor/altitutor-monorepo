// Re-export from shared - billing feature uses shared payment-methods API
export {
  paymentMethodsApi,
  type PaymentMethodData,
  type BillingData
} from '@/shared/api/payment-methods';
