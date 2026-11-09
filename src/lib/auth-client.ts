"use client";
import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({
      user: {
        phone: { type: "string", required: true },
        phoneCountry: { type: "string", required: true },
        username: { type: "string", required: true },
      },
    }),
  ],
});
