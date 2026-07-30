import { createBrowserRouter } from "react-router";
import { RequireAuth } from "./components/RequireAuth.js";
import { Layout } from "./components/Layout.js";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary.js";
import { LoginPage } from "./routes/LoginPage.js";
import { DashboardPage } from "./routes/DashboardPage.js";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    element: <RequireAuth />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <Layout />,
        children: [{ path: "/", element: <DashboardPage /> }],
      },
    ],
  },
]);
