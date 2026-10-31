import { Dashboard } from "./Dashboard";
import { HostedDashboard } from "./HostedDashboard";

export function App() {
  const local = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  return local ? <Dashboard /> : <HostedDashboard />;
}
