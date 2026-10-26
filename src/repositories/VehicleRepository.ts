import { toAppError } from '../core/errors';
import { supabase } from '../core/supabase';
import type { Tables, TablesInsert } from '../models/database.types';

export type VehicleRow = Tables<'vehicles'>;

/** Транспорт водителя (таблица public.vehicles). */
export const VehicleRepository = {
  async addVehicle(vehicle: TablesInsert<'vehicles'>): Promise<VehicleRow> {
    const { data, error } = await supabase.from('vehicles').insert(vehicle).select('*').single();
    if (error) throw toAppError(error, 'Не удалось добавить ТС');
    return data;
  },

  async getDriverVehicles(driverId: string): Promise<VehicleRow[]> {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: true });
    if (error) throw toAppError(error, 'Не удалось загрузить транспорт');
    return data;
  },

  async deleteVehicle(vehicleId: string): Promise<void> {
    const { error } = await supabase.from('vehicles').delete().eq('id', vehicleId);
    if (error) throw toAppError(error, 'Не удалось удалить ТС');
  },
};
