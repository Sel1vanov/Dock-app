import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { services } from '../dependencies.js';
import { errorResponses } from '../schemas/common.js';
import { CargoTypeResponse } from '../schemas/vehicles.js';

export const catalogRouter: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/cargo-types',
    {
      schema: {
        tags: ['catalog'],
        summary: 'Справочник типов груза',
        response: { 200: z.array(CargoTypeResponse), ...errorResponses(401) },
      },
    },
    async (request) => services(request).catalog.listCargoTypes(),
  );
};
