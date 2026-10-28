import { z } from 'zod';

import { VehicleType } from '../models/enums.js';
import { positive } from './common.js';

export const CargoTypeResponse = z.object({ code: z.string(), name: z.string() }).meta({ id: 'CargoTypeResponse' });

const CargoTypeCodes = z
  .array(z.string().trim().min(1).max(32))
  .min(1, 'Выберите хотя бы один тип груза')
  .max(20)
  .refine((codes) => new Set(codes).size === codes.length, 'Типы груза не должны повторяться');

const vehicleFields = {
  type: z.enum(VehicleType, { error: 'Тип ТС: Trawl, Manipulator, TowTruck, Flatbed или Other' }),
  model: z.string().trim().max(80, 'Не больше 80 символов').nullable().optional(),
  maxWeightKg: positive(200_000, 'Грузоподъёмность'),
  lengthM: positive(40, 'Длина'),
  widthM: positive(6, 'Ширина'),
  heightM: positive(8, 'Высота'),
  cargoTypeCodes: CargoTypeCodes,
};

export const VehicleCreateRequest = z.object(vehicleFields).strict().meta({ id: 'VehicleCreateRequest' });

export const VehicleUpdateRequest = z
  .object(vehicleFields)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Передайте хотя бы одно поле')
  .meta({ id: 'VehicleUpdateRequest' });

export const VehicleResponse = z
  .object({
    id: z.uuid(),
    type: z.enum(VehicleType),
    model: z.string().nullable(),
    maxWeightKg: z.number(),
    lengthM: z.number(),
    widthM: z.number(),
    heightM: z.number(),
    cargoTypes: z.array(CargoTypeResponse),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .meta({ id: 'VehicleResponse' });

export type VehicleCreateInput = z.output<typeof VehicleCreateRequest>;
export type VehicleUpdateInput = z.output<typeof VehicleUpdateRequest>;
export type VehicleResponseT = z.output<typeof VehicleResponse>;
