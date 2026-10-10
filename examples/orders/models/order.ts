import type { Address, Person } from '@integration-testing/examples-people';
import type { OrderLine } from './order-line.js';

export interface Order {
  id: string;
  customer: Person;
  lines: OrderLine[];
  billingAddress: Address;
  shippingAddress: Address;
  status: 'pending' | 'shipped' | 'cancelled';
  subtotal: number;
  discountRate: number;
  discountTotal: number;
  total: number;
}
