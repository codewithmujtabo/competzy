import { apiRequest } from "./api";

// Merchandise store (EMC Wave 9 backend) — the student-facing storefront +
// order endpoints. All accept the mobile `Authorization: Bearer` JWT.

export interface StoreProduct {
  id: string;
  compId: string;
  code: string;
  name: string;
  slug: string;
  price: number;
  description: string | null;
  image: string | null; // a signed URL, or null
  active: boolean;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  description: string;
  size: string | null;
  quantity: number;
  price: number;
  subtotal: number;
}

// order status: ordered | paid | shipped | delivered | canceled
export interface Order {
  id: string;
  compId: string;
  code: string;
  status: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  trackingNumber: string | null;
  note: string | null;
  itemCount?: number;
  compName?: string;
  orderedAt: string | null;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  canceledAt: string | null;
  createdAt: string;
  items?: OrderItem[];
}

export interface CreateOrderBody {
  compId: string;
  items: { productId: string; quantity: number }[];
  name: string;
  phone: string;
  address: string;
}

export interface PayResponse {
  // a fully-covered (zero-total) order settles server-side
  covered?: boolean;
  status?: string;
  // otherwise a Midtrans Snap transaction
  snapToken?: string;
  redirectUrl?: string;
  paymentId?: string;
  orderId?: string;
}

/** The active products in a competition's store. */
export async function getStorefrontProducts(compId: string): Promise<StoreProduct[]> {
  return apiRequest<StoreProduct[]>(
    `/commerce/storefront/products?compId=${encodeURIComponent(compId)}`
  );
}

/** The signed-in student's orders, across all competitions. */
export async function getMyOrders(): Promise<Order[]> {
  return apiRequest<Order[]>(`/commerce/storefront/orders`);
}

/** One order with its line items (owner-scoped). */
export async function getOrder(id: string): Promise<Order> {
  return apiRequest<Order>(`/commerce/orders/${id}`);
}

/** Place an order — the server prices every line; the client never sends prices. */
export async function createOrder(body: CreateOrderBody): Promise<Order> {
  return apiRequest<Order>(`/commerce/orders`, { method: "POST", body });
}

/** Start payment for an order — a Midtrans Snap transaction, or `covered` if zero-total. */
export async function payOrder(id: string): Promise<PayResponse> {
  return apiRequest<PayResponse>(`/commerce/orders/${id}/pay`, { method: "POST", body: {} });
}

/** Poll Midtrans + sync the order status (the post-checkout verification fallback). */
export async function verifyOrder(id: string): Promise<{ status: string }> {
  return apiRequest<{ status: string }>(`/commerce/orders/${id}/verify`);
}

/** Hermes-safe Rupiah formatting — `toLocaleString` grouping is unreliable on Hermes. */
export function rupiah(n: number): string {
  const s = Math.round(n || 0).toString();
  return "Rp " + s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
