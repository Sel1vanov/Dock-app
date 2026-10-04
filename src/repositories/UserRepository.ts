import { supabase } from '../supabase';

export class UserRepository {
  async getAllUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('*');

    if (error) throw new Error(error.message);
    return data || [];
  }
}