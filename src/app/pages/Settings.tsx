import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import {
  ChevronRight,
  User,
  Bell,
  MessageCircle,
  FileText,
  LogOut,
  LogIn,
  UserPlus,
  Shield,
  Moon,
} from "lucide-react";
import { AuthModal } from "../components/auth/AuthModal";
import { useSettingsPageModel } from "../wiring/settings-page-service";

export function Settings() {
  const {
    notifications,
    dataWarning,
    autoRenew,
    isAuthenticated,
    isAdmin,
    showAuthModal,
    authMode,
    userPhone,
    userName,
    userInitials,
    setNotifications,
    setDataWarning,
    setAutoRenew,
    setShowAuthModal,
    openLogin,
    openSignup,
    openPersonalInformation,
    openOrderHistory,
    openSupportChat,
    logout,
    handleAuthSuccess,
  } = useSettingsPageModel();

  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-full bg-gradient-to-b from-gray-50 to-white dark:from-background dark:to-background pb-6">
      {/* Header - Consistent with brand gradient */}
      <header className="relative bg-gradient-to-br from-[#1967D2] via-[#1557B0] to-[#114A99] text-white px-6 pt-12 pb-8 overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
        
        <div className="relative z-10">
          <h1 className="text-2xl mb-1">Profile</h1>
          <p className="text-sm text-white/90">Manage your account & preferences</p>
        </div>
      </header>

      {/* Profile Card */}
      <section className="px-5 mt-5 mb-5">
        <button
          className="flex w-full items-center gap-4 p-4 rounded-2xl bg-white dark:bg-card shadow-sm border border-gray-100 dark:border-border text-left hover:shadow-md transition-shadow"
          onClick={openPersonalInformation}
        >
          <Avatar className="w-14 h-14 shadow-md">
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-lg font-semibold">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-foreground truncate">{userName}</h3>
            <p className="text-[13px] text-gray-500 dark:text-muted-foreground truncate">{userPhone}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
        </button>
      </section>

      {/* Account */}
      <section className="px-5 mb-5">
        <div className="flex items-center gap-2 mb-2.5 px-1">
          <Shield className="w-3.5 h-3.5 text-gray-400" />
          <h2 className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider">Account</h2>
        </div>
        <div className="rounded-2xl bg-white dark:bg-card shadow-sm border border-gray-100 dark:border-border divide-y divide-gray-100 dark:divide-border overflow-hidden">
          <SettingsItem
            icon={<User className="w-5 h-5 text-blue-600" />}
            label="Personal Information"
            subtitle="View and edit your details"
            onClick={openPersonalInformation}
            iconBg="bg-blue-50"
          />
          <SettingsItem
            icon={<FileText className="w-5 h-5 text-purple-400" />}
            label="Order History"
            subtitle="Coming soon"
            onClick={() => {}}
            iconBg="bg-purple-50"
            disabled
          />
        </div>
      </section>

      {/* Preferences */}
      <section className="px-5 mb-5">
        <div className="flex items-center gap-2 mb-2.5 px-1">
          <Bell className="w-3.5 h-3.5 text-gray-400" />
          <h2 className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider">Preferences</h2>
        </div>
        <div className="rounded-2xl bg-white dark:bg-card shadow-sm border border-gray-100 dark:border-border divide-y divide-gray-100 dark:divide-border overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <Label htmlFor="notifications" className="cursor-pointer font-medium text-gray-900 dark:text-foreground">
                  Push Notifications
                </Label>
                <p className="text-[12px] text-gray-500 dark:text-muted-foreground">Get updates about your eSIMs</p>
              </div>
            </div>
            <Switch
              id="notifications"
              checked={notifications}
              onCheckedChange={setNotifications}
            />
          </div>

          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                <Moon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <Label htmlFor="dark-mode" className="cursor-pointer font-medium text-gray-900 dark:text-foreground">
                  Dark Mode
                </Label>
                <p className="text-[12px] text-gray-500 dark:text-muted-foreground">Adjust the app's appearance</p>
              </div>
            </div>
            <Switch
              id="dark-mode"
              checked={theme === "dark"}
              onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
            />
          </div>
        </div>
      </section>

      {/* Support */}
      <section className="px-5 mb-5">
        <div className="flex items-center gap-2 mb-2.5 px-1">
          <MessageCircle className="w-3.5 h-3.5 text-gray-400" />
          <h2 className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider">Support</h2>
        </div>
        <div className="rounded-2xl bg-white dark:bg-card shadow-sm border border-gray-100 dark:border-border overflow-hidden">
          <SettingsItem
            icon={<MessageCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
            label="Chat with Support"
            subtitle="Get help from our team"
            onClick={openSupportChat}
            iconBg="bg-indigo-50 dark:bg-indigo-900/20"
          />
        </div>
      </section>

      {/* Footer */}
      <section className="px-5 mb-5">
        <p className="text-center text-[12px] text-gray-400 dark:text-muted-foreground/60">Brought to you by Corevia Network</p>
      </section>

      {/* Auth / Logout */}
      <section className="px-5">
        {isAuthenticated ? (
          <button
            className="w-full h-12 rounded-2xl border border-red-200 dark:border-red-900/30 text-red-500 dark:text-red-400 font-medium text-[14px] flex items-center justify-center gap-2 bg-white dark:bg-card shadow-sm hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 transition-colors"
            onClick={logout}
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </button>
        ) : (
          <div className="flex gap-3">
            <Button
              className="flex-1 gap-2 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-md shadow-blue-500/20 text-white"
              onClick={openLogin}
            >
              <LogIn className="w-4 h-4" />
              Log In
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2 h-12 rounded-2xl border-gray-200 dark:border-border text-gray-700 dark:text-foreground hover:bg-gray-50 dark:hover:bg-accent shadow-sm"
              onClick={openSignup}
            >
              <UserPlus className="w-4 h-4" />
              Sign Up
            </Button>
          </div>
        )}
      </section>

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          initialMode={authMode}
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
        />
      )}
    </div>
  );
}

function SettingsItem({
  icon,
  label,
  subtitle,
  onClick,
  iconBg = "bg-gray-100",
  disabled = false,
}: {
  icon: ReactNode;
  label: string;
  subtitle?: string;
  onClick: () => void;
  iconBg?: string;
  disabled?: boolean;
}) {
  return (
    <button
      className={`flex items-center justify-between w-full p-4 transition-colors ${disabled ? "opacity-50 cursor-default" : "hover:bg-gray-50 dark:hover:bg-accent/50"}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
          {icon}
        </div>
        <div className="text-left">
          <div className="font-medium text-gray-900 dark:text-foreground">{label}</div>
          {subtitle && <p className="text-[12px] text-gray-500 dark:text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-400" />
    </button>
  );
}