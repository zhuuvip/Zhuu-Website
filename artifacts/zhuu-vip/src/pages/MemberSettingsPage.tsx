import { UserProfile } from "@clerk/react";

export default function MemberSettingsPage() {
  return (
    <div className="min-h-dvh px-3 sm:px-4 pt-4 pb-10">
      <div className="max-w-5xl mx-auto">
        <div className="mb-5">
          <h1 className="text-2xl sm:text-3xl font-black gradient-text">
            Account Settings
          </h1>
          <p className="text-sm text-zinc-400/40 mt-1">
            Kelola profil, username, email, password, foto profil, dan keamanan akun.
          </p>
        </div>

        <div className="glass-card rounded-3xl overflow-hidden p-2 sm:p-4">
          <UserProfile
            routing="hash"
            appearance={{
              elements: {
                rootBox: "w-full",
                cardBox: "w-full shadow-none bg-transparent",
                navbar: "bg-transparent",
                navbarMobileMenuButton: "text-zinc-200",
                pageScrollBox: "bg-transparent",
                profileSectionPrimaryButton:
                  "bg-white/5 border border-white/10 text-zinc-200 hover:bg-white/10",
                formButtonPrimary:
                  "bg-white text-black hover:bg-zinc-200",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
