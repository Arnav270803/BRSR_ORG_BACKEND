import type { Request, Response } from "express";

import { listGhgActivitiesQuerySchema } from "./ghgFactors.schemas.js";
import {
  listGhgActivities,
  listGhgActivitiesByCategory,
  listGhgCategories
} from "./ghgFactors.service.js";

export async function listGhgCategoriesController(_req: Request, res: Response) {
  const categories = await listGhgCategories();

  res.status(200).json({
    data: categories
  });
}

export async function listGhgActivitiesController(req: Request, res: Response) {
  const input = listGhgActivitiesQuerySchema.parse(req.query);
  const result = await listGhgActivities(input);

  res.status(200).json(result);
}

export async function listGhgCategoryActivitiesController(
  req: Request<{ categoryId: string }>,
  res: Response
) {
  const input = listGhgActivitiesQuerySchema.parse(req.query);
  const result = await listGhgActivitiesByCategory(req.params.categoryId, input);

  res.status(200).json(result);
}
