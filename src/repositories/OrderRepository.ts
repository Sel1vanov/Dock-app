import { supabase } from '../supabase';
import { OrderDTO } from '../models/Order.js';

export class OrderRepository {
  async getAllOrders(): Promise<OrderDTO[]> {
    
    const { data, error } = await supabase
    .from('orders')
    .select('*, client:users(name, email)')
    .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  }


  async createOrder(orderData: Partial<OrderDTO>): Promise<OrderDTO> {
    const { data, error } = await supabase
      .from('orders')
      .insert([orderData])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
}