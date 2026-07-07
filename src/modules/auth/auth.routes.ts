import { Router } from "express";

import {
  googleLoginController,
  linkedInCallbackController,
  linkedInStartController,
  logoutController,
  meController,
  refreshController
} from "./auth.controller.js";

export const authRouter = Router();

authRouter.post("/google", googleLoginController);
authRouter.get("/linkedin/start", linkedInStartController);
authRouter.get("/linkedin/callback", linkedInCallbackController);
authRouter.get("/me", meController);
authRouter.post("/refresh", refreshController);
authRouter.post("/logout", logoutController);
