import { ForbiddenError, NotFoundError, ValidationError } from '../core/errors.js';
import { type User, UserRole, type Vehicle } from '../models/index.js';
import { CargoTypeRepository, VehicleRepository } from '../repositories/index.js';
import type { VehicleCreateInput, VehicleUpdateInput } from '../schemas/vehicles.js';
import type { ServiceContext } from './context.js';
import { toVehicleResponse } from './mappers.js';

/** CRUD транспорта водителя. Чужое ТС нельзя ни посмотреть через этот раздел, ни изменить. */
export class VehicleService {
  private readonly vehicles: VehicleRepository;
  private readonly cargoTypes: CargoTypeRepository;

  constructor(private readonly ctx: ServiceContext) {
    this.vehicles = new VehicleRepository(ctx.em);
    this.cargoTypes = new CargoTypeRepository(ctx.em);
  }

  async listMine(user: User) {
    this.requireDriver(user);
    return (await this.vehicles.listByDriver(user.id)).map(toVehicleResponse);
  }

  async get(user: User, id: string) {
    return toVehicleResponse(await this.getOwned(user, id));
  }

  async create(user: User, input: VehicleCreateInput) {
    this.requireDriver(user);
    const cargoTypes = await this.resolveCargoTypes(input.cargoTypeCodes);
    const vehicle = this.vehicles.create({
      driver: user,
      type: input.type,
      model: input.model ?? null,
      maxWeightKg: input.maxWeightKg,
      lengthM: input.lengthM,
      widthM: input.widthM,
      heightM: input.heightM,
    });
    vehicle.cargoTypes.set(cargoTypes);
    await this.ctx.em.flush(); // INSERT в vehicles и vehicle_cargo_types — одна транзакция
    return toVehicleResponse(vehicle);
  }

  async update(user: User, id: string, input: VehicleUpdateInput) {
    const vehicle = await this.getOwned(user, id);
    const { cargoTypeCodes, ...fields } = input;
    this.ctx.em.assign(vehicle, fields);
    if (cargoTypeCodes) vehicle.cargoTypes.set(await this.resolveCargoTypes(cargoTypeCodes));
    await this.ctx.em.flush();
    return toVehicleResponse(vehicle);
  }

  async remove(user: User, id: string) {
    const vehicle = await this.getOwned(user, id);
    this.vehicles.remove(vehicle);
    await this.ctx.em.flush();
  }

  /** 404 — такого ТС нет; 403 — ТС есть, но принадлежит другому водителю. */
  private async getOwned(user: User, id: string): Promise<Vehicle> {
    this.requireDriver(user);
    const vehicle = await this.vehicles.findById(id);
    if (!vehicle) throw new NotFoundError('Транспорт не найден');
    if (vehicle.driver.id !== user.id) throw new ForbiddenError('Это транспорт другого водителя');
    return vehicle;
  }

  private async resolveCargoTypes(codes: string[]) {
    const found = await this.cargoTypes.findByCodes(codes);
    if (found.length !== codes.length) {
      const known = new Set(found.map((c) => c.code));
      throw new ValidationError('Неизвестный тип груза', [
        { field: 'cargoTypeCodes', message: `Нет такого типа груза: ${codes.filter((c) => !known.has(c)).join(', ')}` },
      ]);
    }
    return found;
  }

  private requireDriver(user: User) {
    if (user.role !== UserRole.Driver) throw new ForbiddenError('Раздел доступен только водителям');
  }
}
