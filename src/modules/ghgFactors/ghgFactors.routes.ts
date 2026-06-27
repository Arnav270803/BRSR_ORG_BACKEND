import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import {
  listGhgActivitiesController,
  listGhgCategoriesController,
  listGhgCategoryActivitiesController
} from "./ghgFactors.controller.js";

export const ghgFactorsRouter = Router();

ghgFactorsRouter.use(authenticate);

ghgFactorsRouter.get("/categories", listGhgCategoriesController);
ghgFactorsRouter.get("/activities", listGhgActivitiesController);
ghgFactorsRouter.get("/categories/:categoryId/activities", listGhgCategoryActivitiesController);
