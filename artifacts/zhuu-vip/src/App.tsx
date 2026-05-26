import { useEffect, useRef } from "react";
import { ClerkProvider, useClerk, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";

import OceanCanvas from "@/components/OceanCanvas";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import MusicPlayer from "@/components/MusicPlayer";

import HomePage from "@/pages/HomePage";
import AIPage from "@/pages/AIPage";
import LinktreePage from "@/pages/LinktreePage";
import AdminPage from "@/pages/AdminPage";
import SignInPage from "@/pages/SignInPage";
import SignUpPage from "@/pages/SignUpPage";
import NotFoundPage from "@/pages/NotFoundPage";
import PortfolioPage from "@/pages/PortfolioPage";
import SpeedTestPage from "@/pages/SpeedTestPage";
import CommunityPage from "@/pages/CommunityPage";
import FeedbackPage from "@/pages/FeedbackPage";
import ResourceLinksPage from "@/pages/ResourceLinksPage";
import DevToolsPage from "@/pages/DevToolsPage";

const apiUrl = import.meta.env.VITE_API_URL;
if (apiUrl) {
  setBaseUrl(apiUrl);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

export const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "blockButton" as const,
  },
  variables: {
    colorPrimary: "#00d4ff",
    colorForeground: "#d0eef8",
    colorMutedForeground: "#6ba3be",
    colorDanger: "#f87171",
    colorBackground: "#070e1c",
    colorInput: "#0d1a2e",
    colorInputForeground: "#d0eef8",
    colorNeutral: "#1e3a50",
    fontFamily: "'Inter', sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "!bg-[#070e1c] border border-cyan-400/20 rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl shadow-cyan-400/10",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-blue-100 font-bold",
    headerSubtitle: "text-blue-300/60",
    socialButtonsBlockButtonText: "text-blue-200 font-medium",
    formFieldLabel: "text-blue-300/70 text-sm",
    footerActionLink: "text-cyan-400 hover:text-cyan-300 font-medium",
    footerActionText: "text-blue-300/50",
    dividerText: "text-blue-300/40",
    identityPreviewEditButton: "text-cyan-400",
    formFieldSuccessText: "text-green-400",
    alertText: "text-red-300",
    logoBox: "flex justify-center",
    logoImage: "h-12 w-12 rounded-full object-cover",
    socialButtonsBlockButton: "border border-cyan-400/20 bg-white/5 hover:bg-cyan-400/10 transition-all rounded-xl",
    formButtonPrimary: "bg-gradient-to-r from-cyan-400 to-purple-500 hover:opacity-90 transition-all text-white font-semibold shadow-lg shadow-cyan-400/20 rounded-xl",
    formFieldInput: "bg-[#0d1a2e] border border-cyan-400/25 text-blue-100 rounded-xl focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/30",
    footerAction: "border-t border-cyan-400/10 bg-transparent",
    dividerLine: "bg-cyan-400/10",
    alert: "bg-red-500/10 border border-red-500/20 rounded-xl",
    otpCodeFieldInput: "bg-[#0d1a2e] border border-cyan-400/25 text-blue-100 rounded-xl",
    formFieldRow: "gap-2",
    main: "gap-4",
    formField__phoneNumber: "!hidden",
    phoneCodeField: "!hidden",
    phoneCodeFieldInput: "!hidden",
  },
};

function ClerkAuthSetup() {
  const { getToken } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);
  return null;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsub = addListener(({ user }) => {
      const uid = user?.id ?? null;
      if (prevRef.current !== undefined && prevRef.current !== uid) {
        qc.clear();
      }
      prevRef.current = uid;
    });
    return unsub;
  }, [addListener, qc]);

  return null;
}

function AppRouter() {
  const [location] = useLocation();
  const isFullScreenPage = location.startsWith("/ai");

  return (
    <div className="min-h-screen relative">
      <OceanCanvas />
      <Navigation />
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/ai" component={AIPage} />
        <Route path="/linktree" component={LinktreePage} />
        <Route path="/portfolio" component={PortfolioPage} />
        <Route path="/speedtest" component={SpeedTestPage} />
        <Route path="/community" component={CommunityPage} />
        <Route path="/feedback" component={FeedbackPage} />
        <Route path="/resources" component={ResourceLinksPage} />
        <Route path="/tools" component={DevToolsPage} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route component={NotFoundPage} />
      </Switch>
      {!isFullScreenPage && <Footer />}
      <MusicPlayer />
      <Toaster />
    </div>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      afterSignOutUrl={`${basePath}/`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back to ZhuuVIP",
            subtitle: "Sign in with Google or your email",
          },
        },
        signUp: {
          start: {
            title: "Join ZhuuVIP",
            subtitle: "Create your account to get started",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkAuthSetup />
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <AppRouter />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
