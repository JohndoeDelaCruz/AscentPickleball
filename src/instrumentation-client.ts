import { config } from "zod";

// Zod can validate without probing whether the browser allows dynamic code.
config({ jitless: true });
