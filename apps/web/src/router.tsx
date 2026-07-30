import { createBrowserRouter } from "react-router";
import { RequireAuth } from "./components/RequireAuth.js";
import { RequireGuest } from "./components/RequireGuest.js";
import { Layout } from "./components/Layout.js";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary.js";
import { LoginPage } from "./routes/LoginPage.js";
import { TimerPage } from "./routes/TimerPage.js";
import { SummaryPage } from "./routes/SummaryPage.js";

export const router = createBrowserRouter([
  {
    element: <RequireGuest />,
    errorElement: <RouteErrorBoundary />,
    children: [{ path: "/login", element: <LoginPage /> }],
  },
  {
    element: <RequireAuth />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: "/", element: <TimerPage /> },
          { path: "/summary", element: <SummaryPage /> },
        ],
      },
    ],
  },
]);
