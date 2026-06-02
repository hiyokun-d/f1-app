import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";

const Home = lazy(() => import("./pages/Home"));
const Race = lazy(() => import("./pages/Race"));

const LoadingScreen = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-[#06070a]">
    <div className="w-8 h-8 border-2 border-[#e8002d] border-t-transparent rounded-full animate-spin" />
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/race/:sessionKey" element={<Race />} />
        </Routes>
      </Suspense>

      <Analytics />
    </BrowserRouter>
  );
}
