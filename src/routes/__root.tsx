import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { ChatWidget } from "@/components/ChatWidget";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 font-display text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-lg gradient-primary px-5 text-sm font-medium text-primary-foreground shadow-glow"
        >
          Go home
        </a>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Quizify — Turn any exam PDF into an interactive quiz" },
      { name: "description", content: "AI-powered quiz generator. Upload a PDF and get instant interactive multiple choice questions with explanations." },
      { property: "og:title", content: "Quizify — Turn any exam PDF into an interactive quiz" },
      { property: "og:description", content: "AI-powered quiz generator. Upload a PDF and get instant interactive multiple choice questions with explanations." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Quizify — Turn any exam PDF into an interactive quiz" },
      { name: "twitter:description", content: "AI-powered quiz generator. Upload a PDF and get instant interactive multiple choice questions with explanations." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c23a07d6-fb7c-4876-8345-bd8311bc2db1/id-preview-8a05b706--dd5ce511-5bb9-47b9-b1bf-d49501efc866.lovable.app-1777024743608.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c23a07d6-fb7c-4876-8345-bd8311bc2db1/id-preview-8a05b706--dd5ce511-5bb9-47b9-b1bf-d49501efc866.lovable.app-1777024743608.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: () => (
    <>
      <Outlet />
      <ChatWidget />
    </>
  ),
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground antialiased">
        {children}
        <Toaster />
        <Scripts />
      </body>
    </html>
  );
}
