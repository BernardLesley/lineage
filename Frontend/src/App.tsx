import { BrowserRouter, Routes, Route } from "react-router-dom";

import { LineageProvider } from "./context/LineageContext";
import { ThresholdProvider } from "./context/ThresholdContext";
import { MetadataProvider } from "./context/MetadataContext";

import Home from "./pages/Home";
import Settings from "./pages/Settings";

function App() {
  return (
    <BrowserRouter>
      <LineageProvider>
        <ThresholdProvider>
          <MetadataProvider>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </MetadataProvider>
        </ThresholdProvider>
      </LineageProvider>
    </BrowserRouter>
  );
}

export default App;
