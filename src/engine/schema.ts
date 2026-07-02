import { z } from 'zod';

const rangeSchema = z
  .object({ min: z.number().int().min(0).max(9999), max: z.number().int().min(0).max(9999) })
  .refine((r) => r.min <= r.max, { message: 'min must be ≤ max' });

const opConfigSchema = z.object({
  enabled: z.boolean(),
  a: rangeSchema,
  b: rangeSchema,
});

export const gameConfigSchema = z
  .object({
    durationSec: z.number().int().min(15).max(600),
    seed: z.number().int().optional(),
    ops: z.object({
      add: opConfigSchema,
      sub: opConfigSchema,
      mul: opConfigSchema,
      div: opConfigSchema,
    }),
  })
  .refine((c) => Object.values(c.ops).some((o) => o.enabled), {
    message: 'Enable at least one operation',
  });

export type ValidatedConfig = z.infer<typeof gameConfigSchema>;
