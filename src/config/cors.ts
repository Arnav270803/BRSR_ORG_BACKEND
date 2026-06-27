import type { CorsOptions } from "cors";

import { env } from "./env.js";

export const corsOptions: CorsOptions = {
  origin: env.CLIENT_URL,
  credentials: true
};
