"use client";
import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields, usernameClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    usernameClient(),
    inferAdditionalFields({
      user: {
        phone: { type: "string", required: true },
        phoneCountry: { type: "string", required: true },
      },
    }),
  ],
});
