import { Layout } from "./components/Layout";
import { AuthPage } from "./pages/AuthPage";
import { MyTripsPage } from "./pages/MyTripsPage";
import { TripDetailPage } from "./pages/TripDetailPage";
import { TripsPage } from "./pages/TripsPage";
import { useRoute } from "./router";

export default function App() {
  const route = useRoute();
  let page;
  if (route === "/ingresar") page = <AuthPage />;
  else if (route === "/mis-viajes") page = <MyTripsPage />;
  else if (route.startsWith("/viaje/")) page = <TripDetailPage key={route} id={route.split("/")[2]} />;
  else page = <TripsPage />;
  return <Layout>{page}</Layout>;
}
