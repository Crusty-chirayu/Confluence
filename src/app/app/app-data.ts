"use client";

import * as React from "react";

/**
 * Shared app-shell context. Lives in its own module so client components
 * (e.g. the sidebar) can consume it without importing the layout — which
 * would create a layout <-> sidebar import cycle.
 */
export const AppDataContext = React.createContext<{ refreshConversations: () => void }>({
  refreshConversations: () => {},
});
