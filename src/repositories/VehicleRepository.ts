import { supabase } from '../supabase';

export class VehicleRepository {
  async getAllVehicles() {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*');

    if (error) throw new Error(error.message);
    return data || [];
  }
}