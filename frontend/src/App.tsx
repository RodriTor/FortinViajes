import { Layout } from "./components/Layout";
import { AuthPage } from "./pages/AuthPage";
import { useRoute } from "./router";

export default function App() {
  const route = useRoute();
  let page;
  if (route === "/ingresar") page = <AuthPage />;
  else page = <p>Próximamente.</p>;
  return <Layout>{page}</Layout>;
}
