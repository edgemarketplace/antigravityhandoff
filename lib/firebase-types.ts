export type AdminRole = "owner" | "admin" | "staff";

export type TenantContext = {
  id: string;
  slug: string;
  name: string;
  custom_domain: string | null;
  primary_color: string | null;
  logo_url: string | null;
  plan: "growth";
  theme_name: string;
  payment_mode: "edge" | "external";
  shipping_mode: "edge" | "external";
  payment_fee_percent: number;
  shipping_markup_percent: number;
  onboarding_status: "not_started" | "in_progress" | "ready_to_launch" | "live" | "failed";
  onboarding_progress: Record<string, boolean>;
  onboarding_completed_at: string | null;
  current_plan: "free" | "growth";
  monthly_order_count: number;
  monthly_gmv_cents: number;
  monthly_fee_cents: number;
  last_billing_reset: string | null;
};

export type MembershipRow = {
  tenant_id: string;
  user_id: string;
  role: AdminRole;
};

export type ProductRow = {
  tenant_id: string;
  printify_id: string;
  title: string;
  description: string | null;
  price: number;
  image_url: string | null;
  image_urls?: string[] | null;
  variants: unknown[];
  created_at: string;
  updated_at: string;
};

export type OrderRow = {
  id: string;
  tenant_id: string;
  stripe_session_id: string | null;
  customer_email: string | null;
  status: string;
  currency: string;
  amount_total: number | null;
  subtotal: number | null;
  stripe_fee: number | null;
  edge_payment_fee: number | null;
  shipping_base_cost: number | null;
  shipping_markup: number | null;
  total_paid: number | null;
  printify_order_id: string | null;
  fulfillment_attempts: number;
  fulfillment_error: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
};

export type PaymentAccountRow = {
  tenant_id: string;
  provider: string;
  account_ref: string;
  status: string;
  created_at: string;
};
