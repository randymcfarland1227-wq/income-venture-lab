import React from "react";
import ReactDOM from "react-dom/client";
import { IncomeLab } from "@/components/lab/app";
import { ThemeProvider } from "@/components/theme-provider";
import "@/app/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <IncomeLab />
    </ThemeProvider>
  </React.StrictMode>,
);
