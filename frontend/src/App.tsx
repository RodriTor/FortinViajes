import { Layout } from "./components/Layout";
import { AdminPage } from "./pages/AdminPage";
import { AdminTripPage } from "./pages/AdminTripPage";
import { AuthPage } from "./pages/AuthPage";
import { MyTripsPage } from "./pages/MyTripsPage";
import { TripDetailPage } from "./pages/TripDetailPage";
import { TripsPage } from "./pages/TripsPage";
import { useRoute } from "./router";

export default function App() {
  const route = useRoute();
  let page;
  if (route === "/ingresar") page = <AuthPage />;
  else if (route === "/panel") page = <AdminPage />;
  else if (route.startsWith("/panel/viaje/")) page = <AdminTripPage key={route} id={route.split("/")[3]} />;
  else if (route === "/mis-viajes") page = <MyTripsPage />;
  else if (route.startsWith("/viaje/")) page = <TripDetailPage key={route} id={route.split("/")[2]} />;
  else page = <TripsPage />;
  return <Layout>{page}</Layout>;
}
