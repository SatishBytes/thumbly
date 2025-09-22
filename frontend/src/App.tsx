import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";
import ThumbnailUploader from "./components/ThumbnailUploader";
import About from "./pages/about"; // 👈 Your About page

function App() {
  return (
    <main
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        backgroundColor: "#f5f7fa",
        minHeight: "100vh",
        margin: 0,
        padding: 0,
      }}
    >
      <BrowserRouter>
        <SignedIn>
          <Routes>
            <Route path="/" element={<ThumbnailUploader />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </SignedIn>
        <SignedOut>
          <RedirectToSignIn />
        </SignedOut>
      </BrowserRouter>
    </main>
  );
}

export default App;
