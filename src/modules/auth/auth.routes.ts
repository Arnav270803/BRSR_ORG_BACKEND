import { Router } from "express";

import {
  googleLoginController,
  logoutController,
  meController,
  refreshController
} from "./auth.controller.js";

export const authRouter = Router();

authRouter.post("/google", googleLoginController);
authRouter.get("/me", meController);
authRouter.post("/refresh", refreshController);
authRouter.post("/logout", logoutController);
