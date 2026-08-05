import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AdminExports } from "@/pages/AdminExports";
import { Editor } from "@/pages/Editor";

function getRouterBasename() {
  const base = import.meta.env.BASE_URL;
  if (base === "/") return undefined;
  return base.replace(/\/$/, "");
}

function App() {
  return (
    <div className="ambient-bg flex h-full min-h-0 flex-col overflow-hidden">
      <BrowserRouter basename={getRouterBasename()}>
        <Routes>
          <Route path="/" element={<Editor />} />
          <Route path="/edit" element={<Navigate to="/" replace />} />
          <Route path="/edit/:deckId" element={<Editor />} />
          <Route path="/admin/exports" element={<AdminExports />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
