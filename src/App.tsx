import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Editor } from "@/pages/Editor";
import { Library } from "@/pages/Library";

function getRouterBasename() {
  const base = import.meta.env.BASE_URL;
  if (base === "/") return undefined;
  return base.replace(/\/$/, "");
}

function App() {
  return (
    <BrowserRouter basename={getRouterBasename()}>
      <Routes>
        <Route path="/" element={<Library />} />
        <Route path="/edit" element={<Editor />} />
        <Route path="/edit/:deckId" element={<Editor />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
