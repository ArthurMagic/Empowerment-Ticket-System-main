import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

// Set API base URL - defaults to localhost:8080 if not specified
const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080";
setBaseUrl(apiUrl);

createRoot(document.getElementById("root")!).render(<App />);
