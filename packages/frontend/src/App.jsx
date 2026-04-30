import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { wagmiConfig } from "@/lib/wagmi";
import { Layout } from "@/components/layout/Layout";
import { Dashboard } from "@/pages/Dashboard";
import { Payroll } from "@/pages/Payroll";
import { Vault } from "@/pages/Vault";
import { Audit } from "@/pages/Audit";
import { Employee } from "@/pages/Employee";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/payroll" element={<Payroll />} />
              <Route path="/vault" element={<Vault />} />
              <Route path="/audit" element={<Audit />} />
              <Route path="/employee" element={<Employee />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
