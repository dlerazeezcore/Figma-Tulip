import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { formatShortDate } from "../utils/view-formatters";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Settings2,
  Trash2,
  Plus,
  BellRing,
  Globe,
  DollarSign,
  Filter,
  Shield,
  PlayCircle,
  Send,
  UserPlus,
  Users,
  MoreVertical,
  Ban,
  Gift,
  Pencil,
  Menu,
  X,
  CheckCircle2,
  Loader2,
  Search,
  UserCheck,
  Home,
  ChevronLeft,
  LayoutDashboard
} from "lucide-react";
import {
  useAdminPageModel,
} from "../wiring/admin-page-service";
import type { SignedUser } from "../wiring/admin-page-service";

const SUPPORTS_BLOCK_USER_ACTION = true;
const SUPPORTS_EDIT_USER_ACTION = false;
const UNSUPPORTED_USER_ACTION_MESSAGE = "This action is not available yet.";

type Section = "destinations" | "currency" | "tutorial" | "push" | "whitelist" | "admins" | "users" | "reference";

export function AdminWeb() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const {
    countryCodes,
    currentDestinations,
    loading,
    loadingCurrent,
    enableIQD,
    exchangeRate,
    markupPercent,
    currencyLoading,
    whitelistEnabled,
    whitelistCodes,
    currentWhitelist,
    whitelistLoading,
    newAdminPhone,
    currentAdmins,
    adminLoading,
    tutorialEnabled,
    tutorialCardTitle,
    tutorialCardSubtitle,
    tutorialModalTitle,
    tutorialIphoneVideoUrl,
    tutorialIphoneThumbnailUrl,
    tutorialIphoneDescription,
    tutorialIphoneDurationLabel,
    tutorialAndroidVideoUrl,
    tutorialAndroidThumbnailUrl,
    tutorialAndroidDescription,
    tutorialAndroidDurationLabel,
    tutorialLoading,
    tutorialUploadLoadingPlatform,
    pushSummary,
    pushSummaryLoading,
    pushSending,
    pushTitle,
    pushBody,
    pushRoute,
    pushAudience,
    pushKind,
    pushTargetMode,
    pushTargetUserSearch,
    pushTargetUserIds,
    pushTargetUserOptions,
    appUpdateSending,
    appUpdateTitle,
    appUpdateBody,
    appUpdateAppStoreUrl,
    appUpdatePlayStoreUrl,
    appUpdateLastResult,
    usersLoading,
    userActionLoadingId,
    signedUsers,
    showSignedUsers,
    openActionMenuUserId,
    deleteDialogOpen,
    deleteTargetUser,
    editDialogOpen,
    editUserId,
    editUserName,
    editUserPhone,
    setCountryCodes,
    setEnableIQD,
    setExchangeRate,
    setMarkupPercent,
    setWhitelistEnabled,
    setWhitelistCodes,
    setNewAdminPhone,
    setTutorialEnabled,
    setTutorialCardTitle,
    setTutorialCardSubtitle,
    setTutorialModalTitle,
    setTutorialIphoneVideoUrl,
    setTutorialIphoneThumbnailUrl,
    setTutorialIphoneDescription,
    setTutorialIphoneDurationLabel,
    setTutorialAndroidVideoUrl,
    setTutorialAndroidThumbnailUrl,
    setTutorialAndroidDescription,
    setTutorialAndroidDurationLabel,
    setPushTitle,
    setPushBody,
    setPushRoute,
    setPushAudience,
    setPushKind,
    setPushTargetMode,
    setPushTargetUserSearch,
    togglePushTargetUser,
    setAppUpdateTitle,
    setAppUpdateBody,
    setAppUpdateAppStoreUrl,
    setAppUpdatePlayStoreUrl,
    setOpenActionMenuUserId,
    setDeleteDialogOpen,
    setDeleteTargetUser,
    setEditDialogOpen,
    setEditUserName,
    setEditUserPhone,
    handleSave,
    handleClear,
    handleSaveCurrencySettings,
    handleSaveWhitelistSettings,
    handleClearWhitelistSettings,
    handleAddSuperAdmin,
    handleRemoveSuperAdmin,
    handleSaveTutorialSettings,
    handleUploadTutorialVideo,
    handleUploadTutorialThumbnail,
    handleSendPushNotification,
    handleSendAppUpdatePushNotification,
    handleToggleSignedUsers,
    handleDeleteSignedUser,
    handleConfirmDeleteSignedUser,
    handleBlockSignedUser,
    handleGrantLoyalty,
    handleOpenEditUser,
    handleSaveEditedUser,
    notifyUnsupportedUserAction,
  } = useAdminPageModel();

  const sections = [
    { id: "destinations" as Section, icon: Globe, label: "Popular Destinations", description: "Manage countries on landing", color: "text-blue-600", bg: "bg-blue-50" },
    { id: "currency" as Section, icon: DollarSign, label: "Currency Settings", description: "Exchange rates & markups", color: "text-green-600", bg: "bg-green-50" },
    { id: "tutorial" as Section, icon: PlayCircle, label: "Home Tutorial Video", description: "Configure home video player", color: "text-purple-600", bg: "bg-purple-50" },
    { id: "push" as Section, icon: BellRing, label: "Push Notifications", description: "Broadcast alerts to users", color: "text-orange-600", bg: "bg-orange-50" },
    { id: "whitelist" as Section, icon: Filter, label: "Whitelist Settings", description: "Control access by code", color: "text-indigo-600", bg: "bg-indigo-50" },
    { id: "admins" as Section, icon: Shield, label: "Super Admin Settings", description: "Manage admin permissions", color: "text-red-600", bg: "bg-red-50" },
    { id: "users" as Section, icon: Users, label: "Signed Users", description: "User accounts & loyalty", color: "text-teal-600", bg: "bg-teal-50" },
    { id: "reference" as Section, icon: Globe, label: "Country Codes Reference", description: "ISO code list", color: "text-gray-600", bg: "bg-gray-50" },
  ];

  if (isMobile && !activeSection) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-background pb-12">
        <header className="bg-white dark:bg-card border-b border-gray-200 dark:border-border px-6 py-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1967D2] to-[#114A99] flex items-center justify-center">
                <Settings2 className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold dark:text-foreground">Admin Panel</h1>
            </div>
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <Home className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-sm text-gray-500 dark:text-muted-foreground font-medium">Manage Tulip App infrastructure</p>
        </header>

        <main className="px-6 py-8">
          <div className="grid grid-cols-1 gap-4">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className="flex items-center gap-4 p-5 bg-white dark:bg-card rounded-2xl border border-gray-100 dark:border-border shadow-sm hover:shadow-md transition-all active:scale-[0.98] text-left"
                >
                  <div className={`w-12 h-12 rounded-xl ${section.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-6 h-6 ${section.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-foreground">{section.label}</h3>
                    <p className="text-xs text-gray-500 dark:text-muted-foreground">{section.description}</p>
                  </div>
                  <ChevronLeft className="w-5 h-5 text-gray-300 rotate-180" />
                </button>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-background">
      {/* Sidebar - only show on desktop or if forced */}
      {!isMobile && (
        <aside
          className={`${
            sidebarOpen ? "w-64" : "w-0"
          } transition-all duration-300 bg-white dark:bg-card border-r border-gray-200 dark:border-border flex flex-col overflow-hidden`}
        >
          <div className="p-6 border-b border-gray-200 dark:border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1967D2] to-[#114A99] flex items-center justify-center">
                <Settings2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-gray-900 dark:text-foreground">Admin Panel</h1>
                <p className="text-xs text-gray-500 dark:text-muted-foreground">Tulip Management</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-3">
            <button
              onClick={() => setActiveSection(null)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors mb-1 ${
                activeSection === null
                  ? "bg-blue-50 dark:bg-muted text-primary dark:text-blue-400"
                  : "text-gray-700 dark:text-muted-foreground hover:bg-gray-100 dark:hover:bg-accent"
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="text-sm font-medium">Dashboard Overview</span>
            </button>

            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors mb-1 ${
                    activeSection === section.id
                      ? "bg-blue-50 dark:bg-muted text-primary dark:text-blue-400"
                      : "text-gray-700 dark:text-muted-foreground hover:bg-gray-100 dark:hover:bg-accent"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{section.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-200 dark:border-border">
            <p className="text-xs text-gray-500 dark:text-muted-foreground text-center">Tulip eSIM v1.0</p>
            <p className="text-xs text-gray-400 dark:text-muted-foreground/60 text-center mt-1">Corevia Network</p>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white dark:bg-card border-b border-gray-200 dark:border-border px-6 lg:px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {isMobile ? (
              <button
                onClick={() => setActiveSection(null)}
                className="p-2.5 rounded-lg bg-gray-50 dark:bg-muted hover:bg-gray-100 dark:hover:bg-accent transition-colors"
              >
                <ChevronLeft className="w-6 h-6 dark:text-foreground" />
              </button>
            ) : (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-accent rounded-lg transition-colors"
              >
                {sidebarOpen ? <X className="w-5 h-5 dark:text-foreground" /> : <Menu className="w-5 h-5 dark:text-foreground" />}
              </button>
            )}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground">
                {sections.find((s) => s.id === activeSection)?.label || "Select Section"}
              </h2>
              <p className="text-sm text-gray-500 dark:text-muted-foreground hidden sm:block">Manage app configuration and settings</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!isMobile && (
              <>
                <Button
                  onClick={() => navigate("/")}
                  className="gap-2 bg-gradient-to-r from-primary to-blue-600 dark:from-blue-600 dark:to-primary hover:from-primary-hover hover:to-blue-700 shadow-md"
                >
                  <Home className="w-4 h-4" />
                  Go to App Home
                </Button>
                <Badge variant="secondary" className="gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Connected
                </Badge>
              </>
            )}
          </div>
        </header>

        {/* Content Area */}
        <main className={`flex-1 overflow-y-auto ${isMobile ? "p-5" : "p-8"}`}>
          <div className="max-w-6xl mx-auto">
            {activeSection === null && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-2xl font-bold dark:text-white mb-2">Welcome back, Admin</h3>
                  <p className="text-gray-500 dark:text-gray-400">Select a management module to begin</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sections.map((section) => {
                    const Icon = section.icon;
                    return (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className="flex flex-col items-start p-6 bg-white dark:bg-card rounded-2xl border border-gray-100 dark:border-border shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900 transition-all text-left"
                      >
                        <div className={`w-12 h-12 rounded-xl ${section.bg} flex items-center justify-center mb-4`}>
                          <Icon className={`w-6 h-6 ${section.color}`} />
                        </div>
                        <h3 className="font-semibold text-gray-900 dark:text-foreground text-lg mb-1">{section.label}</h3>
                        <p className="text-sm text-gray-500 dark:text-muted-foreground">{section.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeSection === "destinations" && (
              <PopularDestinationsSection
                countryCodes={countryCodes}
                currentDestinations={currentDestinations}
                loading={loading}
                loadingCurrent={loadingCurrent}
                setCountryCodes={setCountryCodes}
                handleSave={handleSave}
                handleClear={handleClear}
              />
            )}

            {activeSection === "currency" && (
              <CurrencySettingsSection
                enableIQD={enableIQD}
                exchangeRate={exchangeRate}
                markupPercent={markupPercent}
                currencyLoading={currencyLoading}
                setEnableIQD={setEnableIQD}
                setExchangeRate={setExchangeRate}
                setMarkupPercent={setMarkupPercent}
                handleSaveCurrencySettings={handleSaveCurrencySettings}
              />
            )}

            {activeSection === "tutorial" && (
              <HomeTutorialSection
                tutorialEnabled={tutorialEnabled}
                tutorialCardTitle={tutorialCardTitle}
                tutorialCardSubtitle={tutorialCardSubtitle}
                tutorialModalTitle={tutorialModalTitle}
                tutorialIphoneVideoUrl={tutorialIphoneVideoUrl}
                tutorialIphoneThumbnailUrl={tutorialIphoneThumbnailUrl}
                tutorialIphoneDescription={tutorialIphoneDescription}
                tutorialIphoneDurationLabel={tutorialIphoneDurationLabel}
                tutorialAndroidVideoUrl={tutorialAndroidVideoUrl}
                tutorialAndroidThumbnailUrl={tutorialAndroidThumbnailUrl}
                tutorialAndroidDescription={tutorialAndroidDescription}
                tutorialAndroidDurationLabel={tutorialAndroidDurationLabel}
                tutorialLoading={tutorialLoading}
                tutorialUploadLoadingPlatform={tutorialUploadLoadingPlatform}
                setTutorialEnabled={setTutorialEnabled}
                setTutorialCardTitle={setTutorialCardTitle}
                setTutorialCardSubtitle={setTutorialCardSubtitle}
                setTutorialModalTitle={setTutorialModalTitle}
                setTutorialIphoneVideoUrl={setTutorialIphoneVideoUrl}
                setTutorialIphoneThumbnailUrl={setTutorialIphoneThumbnailUrl}
                setTutorialIphoneDescription={setTutorialIphoneDescription}
                setTutorialIphoneDurationLabel={setTutorialIphoneDurationLabel}
                setTutorialAndroidVideoUrl={setTutorialAndroidVideoUrl}
                setTutorialAndroidThumbnailUrl={setTutorialAndroidThumbnailUrl}
                setTutorialAndroidDescription={setTutorialAndroidDescription}
                setTutorialAndroidDurationLabel={setTutorialAndroidDurationLabel}
                handleSaveTutorialSettings={handleSaveTutorialSettings}
                handleUploadTutorialVideo={handleUploadTutorialVideo}
                handleUploadTutorialThumbnail={handleUploadTutorialThumbnail}
              />
            )}

            {activeSection === "push" && (
              <PushNotificationsSection
                pushSummary={pushSummary}
                pushSummaryLoading={pushSummaryLoading}
                pushSending={pushSending}
                pushTitle={pushTitle}
                pushBody={pushBody}
                pushRoute={pushRoute}
                pushAudience={pushAudience}
                pushKind={pushKind}
                pushTargetMode={pushTargetMode}
                pushTargetUserSearch={pushTargetUserSearch}
                pushTargetUserIds={pushTargetUserIds}
                pushTargetUserOptions={pushTargetUserOptions}
                appUpdateSending={appUpdateSending}
                appUpdateTitle={appUpdateTitle}
                appUpdateBody={appUpdateBody}
                appUpdateAppStoreUrl={appUpdateAppStoreUrl}
                appUpdatePlayStoreUrl={appUpdatePlayStoreUrl}
                appUpdateLastResult={appUpdateLastResult}
                setPushTitle={setPushTitle}
                setPushBody={setPushBody}
                setPushRoute={setPushRoute}
                setPushAudience={setPushAudience}
                setPushKind={setPushKind}
                setPushTargetMode={setPushTargetMode}
                setPushTargetUserSearch={setPushTargetUserSearch}
                togglePushTargetUser={togglePushTargetUser}
                setAppUpdateTitle={setAppUpdateTitle}
                setAppUpdateBody={setAppUpdateBody}
                setAppUpdateAppStoreUrl={setAppUpdateAppStoreUrl}
                setAppUpdatePlayStoreUrl={setAppUpdatePlayStoreUrl}
                handleSendPushNotification={handleSendPushNotification}
                handleSendAppUpdatePushNotification={handleSendAppUpdatePushNotification}
              />
            )}

            {activeSection === "whitelist" && (
              <WhitelistSettingsSection
                whitelistEnabled={whitelistEnabled}
                whitelistCodes={whitelistCodes}
                currentWhitelist={currentWhitelist}
                whitelistLoading={whitelistLoading}
                setWhitelistEnabled={setWhitelistEnabled}
                setWhitelistCodes={setWhitelistCodes}
                handleSaveWhitelistSettings={handleSaveWhitelistSettings}
                handleClearWhitelistSettings={handleClearWhitelistSettings}
              />
            )}

            {activeSection === "admins" && (
              <SuperAdminSettingsSection
                newAdminPhone={newAdminPhone}
                currentAdmins={currentAdmins}
                adminLoading={adminLoading}
                setNewAdminPhone={setNewAdminPhone}
                handleAddSuperAdmin={handleAddSuperAdmin}
                handleRemoveSuperAdmin={handleRemoveSuperAdmin}
              />
            )}

            {activeSection === "users" && (
              <SignedUsersSection
                usersLoading={usersLoading}
                userActionLoadingId={userActionLoadingId}
                signedUsers={signedUsers}
                showSignedUsers={showSignedUsers}
                openActionMenuUserId={openActionMenuUserId}
                setOpenActionMenuUserId={setOpenActionMenuUserId}
                handleToggleSignedUsers={handleToggleSignedUsers}
                handleDeleteSignedUser={handleDeleteSignedUser}
                handleBlockSignedUser={handleBlockSignedUser}
                handleGrantLoyalty={handleGrantLoyalty}
                handleOpenEditUser={handleOpenEditUser}
                notifyUnsupportedUserAction={notifyUnsupportedUserAction}
              />
            )}

            {activeSection === "reference" && <CountryCodesReferenceSection />}
          </div>
        </main>
      </div>

      {/* Dialogs */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="dark:bg-card dark:border-border">
          <DialogHeader>
            <DialogTitle className="dark:text-foreground">Edit user</DialogTitle>
            <DialogDescription className="dark:text-muted-foreground">
              Update user name and phone number.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label htmlFor="edit-user-name" className="dark:text-foreground">Name</Label>
              <Input
                id="edit-user-name"
                value={editUserName}
                onChange={(e) => setEditUserName(e.target.value)}
                placeholder="User name"
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="edit-user-phone" className="dark:text-foreground">Phone number</Label>
              <Input
                id="edit-user-phone"
                value={editUserPhone}
                onChange={(e) => setEditUserPhone(e.target.value)}
                placeholder="+9647..."
                className="mt-2"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="dark:border-border">
              Cancel
            </Button>
            <Button onClick={handleSaveEditedUser} disabled={userActionLoadingId === editUserId}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setDeleteTargetUser(null);
          }
        }}
      >
        <AlertDialogContent className="dark:bg-card dark:border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-foreground">Soft-delete user account?</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-muted-foreground">
              {`This will deactivate ${deleteTargetUser?.name || deleteTargetUser?.phone || "this user"} and mark the account as deleted. The user will immediately lose access and be hidden from the default users list.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-muted dark:text-foreground dark:border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90 dark:bg-red-600 dark:hover:bg-red-700"
              onClick={handleConfirmDeleteSignedUser}
            >
              Delete user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Section Components
function PopularDestinationsSection({
  countryCodes,
  currentDestinations,
  loading,
  loadingCurrent,
  setCountryCodes,
  handleSave,
  handleClear,
}: any) {
  return (
    <Card className="p-8 shadow-sm border-gray-200 dark:border-border dark:bg-card">
      {/* Current Configuration */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-foreground mb-4">Current Configuration</h3>
        {loadingCurrent ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        ) : currentDestinations.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {currentDestinations.map((code: string) => (
              <Badge
                key={code}
                variant="secondary"
                className="px-3 py-1.5 bg-blue-50 dark:bg-muted text-primary dark:text-blue-400 border-0 font-medium"
              >
                {code}
              </Badge>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-600 dark:text-muted-foreground bg-gray-50 dark:bg-muted/30 p-4 rounded-lg border border-gray-200 dark:border-border">
            No popular destinations configured. Popular destinations section will be hidden on the Home page.
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-border pt-8 space-y-6">
        <div>
          <Label htmlFor="country-codes" className="text-sm font-medium text-gray-900 dark:text-foreground">
            Country Codes (comma-separated)
          </Label>
          <Input
            id="country-codes"
            placeholder="US, GB, DE, FR, IT, ES, IQ..."
            value={countryCodes}
            onChange={(e) => setCountryCodes(e.target.value)}
            className="mt-2"
          />
          <p className="text-xs text-gray-500 dark:text-muted-foreground mt-2">
            Enter 2-letter ISO country codes separated by commas (e.g., US, GB, IQ, DE, FR)
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            disabled={loading || !countryCodes.trim()}
            className="gap-2 bg-gradient-to-r from-primary to-blue-600 dark:from-blue-600 dark:to-primary hover:from-primary-hover hover:to-blue-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Set Destinations
              </>
            )}
          </Button>
          <Button
            onClick={handleClear}
            disabled={loading || currentDestinations.length === 0}
            variant="outline"
            className="gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </Button>
        </div>

        <div className="pt-6 border-t border-gray-200 dark:border-border">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-foreground mb-3">How it works:</h4>
          <ul className="text-sm text-gray-600 dark:text-muted-foreground space-y-2">
            <li className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Popular destinations will ONLY appear on Home page when you set them here</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>If cleared, the popular destinations section will be completely hidden</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Changes take effect immediately across the app</span>
            </li>
          </ul>
        </div>
      </div>
    </Card>
  );
}

function CurrencySettingsSection({
  enableIQD,
  exchangeRate,
  markupPercent,
  currencyLoading,
  setEnableIQD,
  setExchangeRate,
  setMarkupPercent,
  handleSaveCurrencySettings,
}: any) {
  return (
    <Card className="p-8 shadow-sm border-gray-200 dark:border-border dark:bg-card">
      {/* Current Configuration */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-foreground mb-4">Current Configuration</h3>
        {currencyLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="px-3 py-1.5 bg-blue-50 dark:bg-muted text-primary dark:text-blue-400 border-0">
              IQD Enabled: {enableIQD ? "Yes" : "No"}
            </Badge>
            <Badge variant="secondary" className="px-3 py-1.5 bg-blue-50 dark:bg-muted text-primary dark:text-blue-400 border-0">
              Exchange Rate: {exchangeRate}
            </Badge>
            <Badge variant="secondary" className="px-3 py-1.5 bg-blue-50 dark:bg-muted text-primary dark:text-blue-400 border-0">
              Markup Percent: {markupPercent}%
            </Badge>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-border pt-8 space-y-6">
        <div className="flex items-center gap-3">
          <Checkbox
            id="enable-iqd"
            checked={enableIQD}
            onCheckedChange={(checked) => setEnableIQD(Boolean(checked))}
          />
          <Label htmlFor="enable-iqd" className="text-sm font-medium text-gray-900 dark:text-foreground cursor-pointer">
            Enable IQD Currency
          </Label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="exchange-rate" className="text-sm font-medium text-gray-900 dark:text-foreground">
              Exchange Rate (USD to IQD)
            </Label>
            <Input
              id="exchange-rate"
              placeholder="1320"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              className="mt-2"
            />
            <p className="text-xs text-gray-500 dark:text-muted-foreground mt-2">
              Enter the exchange rate from USD to IQD (e.g., 1320 means $1 = 1320 IQD)
            </p>
          </div>

          <div>
            <Label htmlFor="markup-percent" className="text-sm font-medium text-gray-900 dark:text-foreground">
              Markup Percent
            </Label>
            <Input
              id="markup-percent"
              placeholder="0"
              value={markupPercent}
              onChange={(e) => setMarkupPercent(e.target.value)}
              className="mt-2"
            />
            <p className="text-xs text-gray-500 dark:text-muted-foreground mt-2">
              Enter the markup percentage (e.g., 10 for 10% markup on all prices)
            </p>
          </div>
        </div>

        <div>
          <Button
            onClick={handleSaveCurrencySettings}
            disabled={currencyLoading}
            className="gap-2 bg-gradient-to-r from-primary to-blue-600 dark:from-blue-600 dark:to-primary hover:from-primary-hover hover:to-blue-700"
          >
            {currencyLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Save Currency Settings
              </>
            )}
          </Button>
        </div>

        <div className="pt-6 border-t border-gray-200 dark:border-border">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-foreground mb-3">How it works:</h4>
          <ul className="text-sm text-gray-600 dark:text-muted-foreground space-y-2">
            <li className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Enable IQD to show prices in IQD on the Home page</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Set the exchange rate from USD to IQD</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Set the markup percent for IQD prices</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Changes take effect immediately across the app</span>
            </li>
          </ul>
        </div>
      </div>
    </Card>
  );
}

function HomeTutorialSection(props: any) {
  const {
    tutorialEnabled,
    tutorialCardTitle,
    tutorialCardSubtitle,
    tutorialModalTitle,
    tutorialIphoneVideoUrl,
    tutorialIphoneThumbnailUrl,
    tutorialIphoneDescription,
    tutorialIphoneDurationLabel,
    tutorialAndroidVideoUrl,
    tutorialAndroidThumbnailUrl,
    tutorialAndroidDescription,
    tutorialAndroidDurationLabel,
    tutorialLoading,
    tutorialUploadLoadingPlatform,
    setTutorialEnabled,
    setTutorialCardTitle,
    setTutorialCardSubtitle,
    setTutorialModalTitle,
    setTutorialIphoneVideoUrl,
    setTutorialIphoneThumbnailUrl,
    setTutorialIphoneDescription,
    setTutorialIphoneDurationLabel,
    setTutorialAndroidVideoUrl,
    setTutorialAndroidThumbnailUrl,
    setTutorialAndroidDescription,
    setTutorialAndroidDurationLabel,
    handleSaveTutorialSettings,
    handleUploadTutorialVideo,
    handleUploadTutorialThumbnail,
  } = props;

  return (
    <Card className="p-8 shadow-sm border-gray-200 dark:border-border dark:bg-card">
      {/* Current Configuration */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-foreground mb-4">Current Configuration</h3>
        {tutorialLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="px-3 py-1.5 bg-blue-50 dark:bg-muted text-primary dark:text-blue-400 border-0">
              Visible on Home: {tutorialEnabled ? "Yes" : "No"}
            </Badge>
            <Badge variant="secondary" className="px-3 py-1.5 bg-blue-50 dark:bg-muted text-primary dark:text-blue-400 border-0">
              iPhone Video: {tutorialIphoneVideoUrl ? "Configured" : "Missing"}
            </Badge>
            <Badge variant="secondary" className="px-3 py-1.5 bg-blue-50 dark:bg-muted text-primary dark:text-blue-400 border-0">
              Android Video: {tutorialAndroidVideoUrl ? "Configured" : "Missing"}
            </Badge>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-border pt-8 space-y-6">
        <div className="flex items-center gap-3">
          <Checkbox
            id="home-tutorial-enabled"
            checked={tutorialEnabled}
            onCheckedChange={(checked) => setTutorialEnabled(Boolean(checked))}
          />
          <Label htmlFor="home-tutorial-enabled" className="text-sm font-medium text-gray-900 dark:text-foreground cursor-pointer">
            Show tutorial section on Home page
          </Label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="tutorial-card-title" className="text-sm font-medium text-gray-900 dark:text-foreground">
              Card Title
            </Label>
            <Input
              id="tutorial-card-title"
              value={tutorialCardTitle}
              onChange={(e) => setTutorialCardTitle(e.target.value)}
              className="mt-2"
              placeholder="How to activate and use your eSIM"
            />
          </div>
          <div>
            <Label htmlFor="tutorial-modal-title" className="text-sm font-medium text-gray-900 dark:text-foreground">
              Modal Title
            </Label>
            <Input
              id="tutorial-modal-title"
              value={tutorialModalTitle}
              onChange={(e) => setTutorialModalTitle(e.target.value)}
              className="mt-2"
              placeholder="eSIM Activation Tutorial"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="tutorial-card-subtitle" className="text-sm font-medium text-gray-900 dark:text-foreground">
            Card Subtitle
          </Label>
          <Input
            id="tutorial-card-subtitle"
            value={tutorialCardSubtitle}
            onChange={(e) => setTutorialCardSubtitle(e.target.value)}
            className="mt-2"
            placeholder="Separate tutorials for iPhone and Android"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          {/* iPhone Tutorial */}
          <div className="space-y-4 rounded-xl border border-gray-200 dark:border-border p-6 bg-gray-50/50 dark:bg-muted/30">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-foreground flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/40 dark:to-blue-800/20 flex items-center justify-center">
                <PlayCircle className="w-4 h-4 text-primary" />
              </div>
              iPhone Tutorial
            </h4>
            <div>
              <Label htmlFor="tutorial-iphone-video-url" className="text-sm font-medium text-gray-900 dark:text-foreground">
                Video URL
              </Label>
              <Input
                id="tutorial-iphone-video-url"
                type="url"
                value={tutorialIphoneVideoUrl}
                onChange={(e) => setTutorialIphoneVideoUrl(e.target.value)}
                className="mt-2"
                placeholder="https://.../iphone-tutorial.mp4"
              />
              <div className="mt-3">
                <Input
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    void handleUploadTutorialVideo("iphone", file);
                    e.currentTarget.value = "";
                  }}
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-muted-foreground">
                  {tutorialUploadLoadingPlatform === "iphone-video"
                    ? "Uploading iPhone video..."
                    : "Upload a video file here and the admin backend will store it automatically"}
                </p>
              </div>
            </div>
            <div>
              <Label htmlFor="tutorial-iphone-thumbnail-url" className="text-sm font-medium text-gray-900 dark:text-foreground">
                Thumbnail URL
              </Label>
              <Input
                id="tutorial-iphone-thumbnail-url"
                type="url"
                value={tutorialIphoneThumbnailUrl}
                onChange={(e) => setTutorialIphoneThumbnailUrl(e.target.value)}
                className="mt-2"
                placeholder="https://.../iphone-thumbnail.jpg"
              />
              <div className="mt-3">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    void handleUploadTutorialThumbnail("iphone", file);
                    e.currentTarget.value = "";
                  }}
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-muted-foreground">
                  {tutorialUploadLoadingPlatform === "iphone-thumbnail"
                    ? "Uploading iPhone thumbnail..."
                    : "Optional image upload for the tutorial cover"}
                </p>
              </div>
            </div>
            <div>
              <Label htmlFor="tutorial-iphone-duration" className="text-sm font-medium text-gray-900 dark:text-foreground">
                Duration Label
              </Label>
              <Input
                id="tutorial-iphone-duration"
                value={tutorialIphoneDurationLabel}
                onChange={(e) => setTutorialIphoneDurationLabel(e.target.value)}
                className="mt-2"
                placeholder="3:42"
              />
            </div>
            <div>
              <Label htmlFor="tutorial-iphone-description" className="text-sm font-medium text-gray-900 dark:text-foreground">
                Description
              </Label>
              <Textarea
                id="tutorial-iphone-description"
                value={tutorialIphoneDescription}
                onChange={(e) => setTutorialIphoneDescription(e.target.value)}
                className="mt-2 min-h-24"
                placeholder="Step-by-step guide for iPhone users"
              />
            </div>
          </div>

          {/* Android Tutorial */}
          <div className="space-y-4 rounded-xl border border-gray-200 dark:border-border p-6 bg-gray-50/50 dark:bg-muted/30">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-foreground flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/40 dark:to-green-800/20 flex items-center justify-center">
                <PlayCircle className="w-4 h-4 text-green-600" />
              </div>
              Android Tutorial
            </h4>
            <div>
              <Label htmlFor="tutorial-android-video-url" className="text-sm font-medium text-gray-900 dark:text-foreground">
                Video URL
              </Label>
              <Input
                id="tutorial-android-video-url"
                type="url"
                value={tutorialAndroidVideoUrl}
                onChange={(e) => setTutorialAndroidVideoUrl(e.target.value)}
                className="mt-2"
                placeholder="https://.../android-tutorial.mp4"
              />
              <div className="mt-3">
                <Input
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    void handleUploadTutorialVideo("android", file);
                    e.currentTarget.value = "";
                  }}
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-muted-foreground">
                  {tutorialUploadLoadingPlatform === "android-video"
                    ? "Uploading Android video..."
                    : "Upload a video file here and the admin backend will store it automatically"}
                </p>
              </div>
            </div>
            <div>
              <Label htmlFor="tutorial-android-thumbnail-url" className="text-sm font-medium text-gray-900 dark:text-foreground">
                Thumbnail URL
              </Label>
              <Input
                id="tutorial-android-thumbnail-url"
                type="url"
                value={tutorialAndroidThumbnailUrl}
                onChange={(e) => setTutorialAndroidThumbnailUrl(e.target.value)}
                className="mt-2"
                placeholder="https://.../android-thumbnail.jpg"
              />
              <div className="mt-3">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    void handleUploadTutorialThumbnail("android", file);
                    e.currentTarget.value = "";
                  }}
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-muted-foreground">
                  {tutorialUploadLoadingPlatform === "android-thumbnail"
                    ? "Uploading Android thumbnail..."
                    : "Optional image upload for the tutorial cover"}
                </p>
              </div>
            </div>
            <div>
              <Label htmlFor="tutorial-android-duration" className="text-sm font-medium text-gray-900 dark:text-foreground">
                Duration Label
              </Label>
              <Input
                id="tutorial-android-duration"
                value={tutorialAndroidDurationLabel}
                onChange={(e) => setTutorialAndroidDurationLabel(e.target.value)}
                className="mt-2"
                placeholder="3:42"
              />
            </div>
            <div>
              <Label htmlFor="tutorial-android-description" className="text-sm font-medium text-gray-900 dark:text-foreground">
                Description
              </Label>
              <Textarea
                id="tutorial-android-description"
                value={tutorialAndroidDescription}
                onChange={(e) => setTutorialAndroidDescription(e.target.value)}
                className="mt-2 min-h-24"
                placeholder="Step-by-step guide for Android users"
              />
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-gray-200 dark:border-border">
          <Button
            onClick={handleSaveTutorialSettings}
            disabled={tutorialLoading}
            className="gap-2 bg-gradient-to-r from-primary to-blue-600 dark:from-blue-600 dark:to-primary hover:from-primary-hover hover:to-blue-700"
          >
            {tutorialLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Save Tutorial Settings
              </>
            )}
          </Button>
        </div>

        <div className="pt-6 border-t border-gray-200 dark:border-border">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-foreground mb-3">How it works:</h4>
          <ul className="text-sm text-gray-600 dark:text-muted-foreground space-y-2">
            <li className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Upload tutorial files directly from this Admin panel</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Add separate video URLs for iPhone and Android tutorials</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Uploading a file here automatically fills the matching URL field</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>The backend stores the file and returns the final URL automatically</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Thumbnail URLs are used on the Home card and inside the player poster</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>If the section is disabled or no video is configured, it stays hidden on Home</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Direct `.mp4` links work best for in-app playback</span>
            </li>
          </ul>
        </div>
      </div>
    </Card>
  );
}

function PushNotificationsSection(props: any) {
  const {
    pushSummary,
    pushSummaryLoading,
    pushSending,
    pushTitle,
    pushBody,
    pushRoute,
    pushAudience,
    pushKind,
    pushTargetMode,
    pushTargetUserSearch,
    pushTargetUserIds,
    pushTargetUserOptions,
    appUpdateSending,
    appUpdateTitle,
    appUpdateBody,
    appUpdateAppStoreUrl,
    appUpdatePlayStoreUrl,
    appUpdateLastResult,
    setPushTitle,
    setPushBody,
    setPushRoute,
    setPushAudience,
    setPushKind,
    setPushTargetMode,
    setTutorialEnabled,
    setPushTargetUserSearch,
    togglePushTargetUser,
    setAppUpdateTitle,
    setAppUpdateBody,
    setAppUpdateAppStoreUrl,
    setAppUpdatePlayStoreUrl,
    handleSendPushNotification,
    handleSendAppUpdatePushNotification,
  } = props;

  return (
    <Card className="p-8 shadow-sm border-gray-200 dark:border-border dark:bg-card">
      {/* Current Reach */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-foreground mb-4">Current Reach</h3>
        {pushSummaryLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <div className="space-y-4">
            {!pushSummary.available ? (
              <div className="rounded-lg border border-amber-300 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-400">
                Push admin summary is unavailable right now.
                {pushSummary.error ? ` ${pushSummary.error}` : ""}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="px-3 py-1.5 dark:bg-muted dark:text-muted-foreground">
                Backend: {pushSummary.available ? "Available" : "Unavailable"}
              </Badge>
              <Badge variant="secondary" className="px-3 py-1.5 dark:bg-muted dark:text-muted-foreground">
                Provider: {pushSummary.providerConfigured ? "Ready" : "Missing FCM config"}
              </Badge>
              <Badge variant="secondary" className="px-3 py-1.5 dark:bg-muted dark:text-muted-foreground">
                Devices: {pushSummary.totalDevices}
              </Badge>
              <Badge variant="secondary" className="px-3 py-1.5 dark:bg-muted dark:text-muted-foreground">
                Enabled: {pushSummary.enabledDevices}
              </Badge>
              <Badge variant="secondary" className="px-3 py-1.5 dark:bg-muted dark:text-muted-foreground">
                Signed In: {pushSummary.authenticatedDevices}
              </Badge>
              <Badge variant="secondary" className="px-3 py-1.5 dark:bg-muted dark:text-muted-foreground">
                Loyalty: {pushSummary.loyaltyDevices}
              </Badge>
              <Badge variant="secondary" className="px-3 py-1.5 dark:bg-muted dark:text-muted-foreground">
                Active eSIM: {pushSummary.activeEsimDevices}
              </Badge>
              <Badge variant="secondary" className="px-3 py-1.5 dark:bg-muted dark:text-muted-foreground">
                iOS: {pushSummary.iosDevices}
              </Badge>
              <Badge variant="secondary" className="px-3 py-1.5 dark:bg-muted dark:text-muted-foreground">
                Android: {pushSummary.androidDevices}
              </Badge>
            </div>
            {pushSummary.lastTitle ? (
              <p className="text-xs text-gray-500 dark:text-muted-foreground">
                Last send: {pushSummary.lastTitle}
                {pushSummary.lastSentAt ? ` on ${formatShortDate(pushSummary.lastSentAt)}` : ""}
              </p>
            ) : null}
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-border pt-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="push-kind" className="text-sm font-medium text-gray-900 dark:text-foreground">
              Notification Type
            </Label>
            <Select value={pushKind} onValueChange={(value) => setPushKind(value as typeof pushKind)}>
              <SelectTrigger id="push-kind" className="mt-2">
                <SelectValue placeholder="Choose a type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="offers">Offers</SelectItem>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="orders">Orders</SelectItem>
                <SelectItem value="support">Support</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium text-gray-900 dark:text-foreground">Target Mode</Label>
            <div className="flex bg-muted dark:bg-muted/50 rounded-lg p-1 mt-2">
              <button
                type="button"
                onClick={() => setPushTargetMode("audience")}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                  pushTargetMode === "audience"
                    ? "bg-background dark:bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Audience
              </button>
              <button
                type="button"
                onClick={() => setPushTargetMode("users")}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                  pushTargetMode === "users"
                    ? "bg-background dark:bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Specific Users
              </button>
            </div>
          </div>
        </div>

        {pushTargetMode === "audience" ? (
          <div>
            <Label htmlFor="push-audience" className="text-sm font-medium text-gray-900 dark:text-foreground">
              Audience
            </Label>
            <Select value={pushAudience} onValueChange={(value) => setPushAudience(value as typeof pushAudience)}>
              <SelectTrigger id="push-audience" className="mt-2">
                <SelectValue placeholder="Choose an audience" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Enabled Devices</SelectItem>
                <SelectItem value="authenticated">Signed In Users</SelectItem>
                <SelectItem value="loyalty">Loyalty Users</SelectItem>
                <SelectItem value="active_esim">Users With Active eSIMs</SelectItem>
                <SelectItem value="admins">Admin Devices</SelectItem>
                <SelectItem value="all_devices">All Devices (Users + Admins)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-gray-900 dark:text-foreground">
                Select Users
                {pushTargetUserIds.length > 0 && (
                  <Badge variant="secondary" className="ml-2 bg-blue-50 dark:bg-muted text-primary dark:text-blue-400 border-0">
                    {pushTargetUserIds.length} selected
                  </Badge>
                )}
              </Label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={pushTargetUserSearch}
                  onChange={(e) => setPushTargetUserSearch(e.target.value)}
                  placeholder="Search by name or phone..."
                  className="pl-9"
                />
              </div>
            </div>

            {pushTargetUserIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {pushTargetUserIds.map((uid) => {
                  const user = pushTargetUserOptions.find((u) => u.id === uid);
                  return (
                    <span
                      key={uid}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary dark:bg-primary/20 dark:text-blue-400"
                    >
                      <UserCheck className="w-3 h-3" />
                      {user?.name || user?.phone || uid}
                      <button
                        type="button"
                        onClick={() => togglePushTargetUser(uid)}
                        className="ml-0.5 hover:text-destructive transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            <div className="rounded-lg border border-gray-200 dark:border-border max-h-64 overflow-y-auto bg-white dark:bg-card">
              {pushTargetUserOptions.length === 0 ? (
                <div className="p-4 text-sm text-gray-500 dark:text-muted-foreground text-center">
                  Loading users...
                </div>
              ) : (
                pushTargetUserOptions
                  .filter((u) => {
                    const q = pushTargetUserSearch.toLowerCase().trim();
                    if (!q) return true;
                    return (
                      (u.name || "").toLowerCase().includes(q) ||
                      (u.phone || "").toLowerCase().includes(q)
                    );
                  })
                  .map((user) => {
                    const isSelected = pushTargetUserIds.includes(user.id);
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => togglePushTargetUser(user.id)}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm border-b last:border-b-0 border-gray-100 dark:border-border transition-colors ${
                          isSelected ? "bg-blue-50/50 dark:bg-muted/30" : "hover:bg-gray-50 dark:hover:bg-muted/20"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected ? "bg-primary border-primary" : "border-gray-300 dark:border-muted"
                        }`}>
                          {isSelected && (
                            <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white fill-current">
                              <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate text-gray-900 dark:text-foreground">{user.name || "User"}</div>
                          <div className="text-xs text-gray-500 dark:text-muted-foreground truncate">{user.phone || "-"}</div>
                        </div>
                      </button>
                    );
                  })
              )}
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="push-title" className="text-sm font-medium text-gray-900 dark:text-foreground">
            Title
          </Label>
          <Input
            id="push-title"
            value={pushTitle}
            onChange={(e) => setPushTitle(e.target.value)}
            className="mt-2"
            placeholder="Weekend deal on Europe plans"
          />
        </div>

        <div>
          <Label htmlFor="push-body" className="text-sm font-medium text-gray-900 dark:text-foreground">
            Message
          </Label>
          <Textarea
            id="push-body"
            value={pushBody}
            onChange={(e) => setPushBody(e.target.value)}
            className="mt-2 min-h-24"
            placeholder="Open the app to see the latest discounted plans."
          />
        </div>

        <div>
          <Label htmlFor="push-route" className="text-sm font-medium text-gray-900 dark:text-foreground">
            Open Route
          </Label>
          <Input
            id="push-route"
            value={pushRoute}
            onChange={(e) => setPushRoute(e.target.value)}
            className="mt-2"
            placeholder="/plans?tab=regional"
          />
          <p className="text-xs text-gray-500 dark:text-muted-foreground mt-2">
            When the user taps the notification, the app will open this route.
          </p>
        </div>

        <div>
          <Button
            onClick={handleSendPushNotification}
            disabled={pushSending || !pushTitle.trim() || !pushBody.trim()}
            className="gap-2 bg-gradient-to-r from-primary to-blue-600 dark:from-blue-600 dark:to-primary hover:from-primary-hover hover:to-blue-700 shadow-md"
          >
            {pushSending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send Push Notification
              </>
            )}
          </Button>
        </div>

        <div className="pt-6 border-t border-gray-200 dark:border-border space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-100 dark:border-blue-900/30">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1967D2] to-[#114A99] flex items-center justify-center flex-shrink-0 shadow-sm">
              <Send className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-foreground">One-Click App Update Push</h4>
              <p className="text-xs text-gray-600 dark:text-muted-foreground mt-0.5 leading-relaxed">
                Sends update notification to all eligible devices. iOS opens App Store, Android opens Play Store.
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="app-update-title" className="text-sm font-medium text-gray-900 dark:text-foreground">
                  Update Title
                </Label>
                <Input
                  id="app-update-title"
                  value={appUpdateTitle}
                  onChange={(e) => setAppUpdateTitle(e.target.value)}
                  className="mt-1.5"
                  placeholder="Update Available"
                />
              </div>

              <div>
                <Label htmlFor="app-update-body" className="text-sm font-medium text-gray-900 dark:text-foreground">
                  Update Message
                </Label>
                <Input
                  id="app-update-body"
                  value={appUpdateBody}
                  onChange={(e) => setAppUpdateBody(e.target.value)}
                  className="mt-1.5"
                  placeholder="A new version is available. Please update now."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="app-update-ios" className="text-sm font-medium text-gray-900 dark:text-foreground">
                  App Store URL
                </Label>
                <Input
                  id="app-update-ios"
                  value={appUpdateAppStoreUrl}
                  onChange={(e) => setAppUpdateAppStoreUrl(e.target.value)}
                  className="mt-1.5"
                  placeholder="https://apps.apple.com/app/..."
                />
              </div>
              <div>
                <Label htmlFor="app-update-android" className="text-sm font-medium text-gray-900 dark:text-foreground">
                  Play Store URL
                </Label>
                <Input
                  id="app-update-android"
                  value={appUpdatePlayStoreUrl}
                  onChange={(e) => setAppUpdatePlayStoreUrl(e.target.value)}
                  className="mt-1.5"
                  placeholder="https://play.google.com/store/apps/details?id=..."
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={handleSendAppUpdatePushNotification}
                disabled={
                  appUpdateSending ||
                  !appUpdateTitle.trim() ||
                  !appUpdateBody.trim() ||
                  !appUpdateAppStoreUrl.trim() ||
                  !appUpdatePlayStoreUrl.trim()
                }
                className="gap-2 bg-gradient-to-r from-[#1967D2] to-[#114A99] hover:from-[#114A99] hover:to-[#0D3A7A] shadow-md"
              >
                {appUpdateSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending Update Push...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send App Update Push
                  </>
                )}
              </Button>
            </div>

            {appUpdateLastResult ? (
              <div className="rounded-lg border p-4 space-y-2.5" style={{
                borderColor: appUpdateLastResult.failureCount > 0 ? '#FEE2E2' : '#D1FAE5',
                backgroundColor: appUpdateLastResult.failureCount > 0 ? '#FEF2F2' : '#F0FDF4'
              }}>
                <div className="flex items-center gap-2">
                  {appUpdateLastResult.failureCount > 0 ? (
                    <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <div className="text-sm font-semibold" style={{
                    color: appUpdateLastResult.failureCount > 0 ? '#991B1B' : '#047857'
                  }}>
                    Delivery Summary
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" style={{
                  color: appUpdateLastResult.failureCount > 0 ? '#7C2D12' : '#065F46'
                }}>
                  <span className="font-medium">Requested: {appUpdateLastResult.requestedTokens}</span>
                  <span className="text-gray-400">•</span>
                  <span className="font-medium text-emerald-700 font-bold">Success: {appUpdateLastResult.successCount}</span>
                  <span className="text-gray-400">•</span>
                  <span className="font-medium text-red-700 font-bold">Failure: {appUpdateLastResult.failureCount}</span>
                </div>
                <div className="text-xs" style={{
                  color: appUpdateLastResult.failureCount > 0 ? '#78716C' : '#6B7280'
                }}>
                  Sent at: {formatShortDate(appUpdateLastResult.sentAt)}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="pt-6 border-t border-gray-200 dark:border-border">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-foreground mb-3">How it works:</h4>
          <ul className="text-sm text-gray-600 dark:text-muted-foreground space-y-2">
            <li className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Devices appear here after a user opens the native app and enables notifications</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Offers, orders, support, and general sends all use the same mobile push pipeline</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Audience filters use signed-in user, loyalty, and active eSIM data from the backend</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Tap behavior is controlled by the route you send with the notification</span>
            </li>
          </ul>
        </div>
      </div>
    </Card>
  );
}

function WhitelistSettingsSection(props: any) {
  const {
    whitelistEnabled,
    whitelistCodes,
    currentWhitelist,
    whitelistLoading,
    setWhitelistEnabled,
    setWhitelistCodes,
    handleSaveWhitelistSettings,
    handleClearWhitelistSettings,
  } = props;

  return (
    <Card className="p-8 shadow-sm border-gray-200 dark:border-border dark:bg-card">
      {/* Current Configuration */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-foreground mb-4">Current Configuration</h3>
        {whitelistLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="px-3 py-1.5 bg-blue-50 dark:bg-muted text-primary dark:text-blue-400 border-0">
              Whitelist Enabled: {whitelistEnabled ? "Yes" : "No"}
            </Badge>
            {currentWhitelist.length > 0 ? (
              currentWhitelist.map((code: string) => (
                <Badge
                  key={code}
                  variant="secondary"
                  className="px-3 py-1.5 bg-blue-50 dark:bg-muted text-primary dark:text-blue-400 border-0"
                >
                  {code}
                </Badge>
              ))
            ) : (
              <Badge variant="secondary" className="px-3 py-1.5 bg-gray-100 dark:bg-muted text-gray-600 dark:text-muted-foreground border-0">
                No codes in whitelist
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-border pt-8 space-y-6">
        <div className="flex items-center gap-3">
          <Checkbox
            id="enable-whitelist"
            checked={whitelistEnabled}
            onCheckedChange={(checked) => setWhitelistEnabled(Boolean(checked))}
          />
          <Label htmlFor="enable-whitelist" className="text-sm font-medium text-gray-900 dark:text-foreground cursor-pointer">
            Enable Country Whitelist
          </Label>
        </div>

        <div>
          <Label htmlFor="whitelist-codes" className="text-sm font-medium text-gray-900 dark:text-foreground">
            Country Codes (comma-separated)
          </Label>
          <Input
            id="whitelist-codes"
            placeholder="US, GB, DE, FR, IT, ES, IQ..."
            value={whitelistCodes}
            onChange={(e) => setWhitelistCodes(e.target.value)}
            className="mt-2"
          />
          <p className="text-xs text-gray-500 dark:text-muted-foreground mt-2">
            Enter 2-letter ISO country codes separated by commas (e.g., US, GB, IQ, DE, FR)
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleSaveWhitelistSettings}
            disabled={whitelistLoading || !whitelistCodes.trim()}
            className="gap-2 bg-gradient-to-r from-primary to-blue-600 dark:from-blue-600 dark:to-primary hover:from-primary-hover hover:to-blue-700 shadow-md"
          >
            {whitelistLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Save Whitelist Settings
              </>
            )}
          </Button>
          <Button
            onClick={handleClearWhitelistSettings}
            disabled={whitelistLoading || currentWhitelist.length === 0}
            variant="outline"
            className="gap-2 shadow-sm"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </Button>
        </div>

        <div className="pt-6 border-t border-gray-200 dark:border-border">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-foreground mb-3">How it works:</h4>
          <ul className="text-sm text-gray-600 dark:text-muted-foreground space-y-2">
            <li className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Enable whitelist to show ONLY the selected countries in Plans page</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>When disabled, all countries from the API will be shown</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Whitelist applies to both Country and Regional tabs</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Changes take effect immediately across the app</span>
            </li>
          </ul>
        </div>
      </div>
    </Card>
  );
}

function SuperAdminSettingsSection(props: any) {
  const {
    newAdminPhone,
    currentAdmins,
    adminLoading,
    setNewAdminPhone,
    handleAddSuperAdmin,
    handleRemoveSuperAdmin,
  } = props;

  return (
    <Card className="p-8 shadow-sm border-gray-200 dark:border-border dark:bg-card">
      {/* Current Configuration */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-foreground mb-4">Current Configuration</h3>
        {adminLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {currentAdmins.length > 0 ? (
              currentAdmins.map((phone: string) => (
                <div
                  key={phone}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-muted text-primary dark:text-blue-400 rounded-full font-medium"
                >
                  {phone}
                  <button
                    onClick={() => handleRemoveSuperAdmin(phone)}
                    disabled={adminLoading}
                    className="ml-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full p-1 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                  </button>
                </div>
              ))
            ) : (
              <Badge variant="secondary" className="px-3 py-1.5 bg-gray-100 dark:bg-muted text-gray-600 dark:text-muted-foreground border-0">
                No super admins configured
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-border pt-8 space-y-6">
        <div>
          <Label htmlFor="new-admin-phone" className="text-sm font-medium text-gray-900 dark:text-foreground">
            New Super Admin Phone Number
          </Label>
          <Input
            id="new-admin-phone"
            placeholder="+1234567890"
            value={newAdminPhone}
            onChange={(e) => setNewAdminPhone(e.target.value)}
            className="mt-2"
          />
          <p className="text-xs text-gray-500 dark:text-muted-foreground mt-2">
            Enter the phone number of the new super admin (e.g., +1234567890)
          </p>
        </div>

        <div>
          <Button
            onClick={handleAddSuperAdmin}
            disabled={adminLoading || !newAdminPhone.trim()}
            className="gap-2 bg-gradient-to-r from-primary to-blue-600 dark:from-blue-600 dark:to-primary hover:from-primary-hover hover:to-blue-700 shadow-md"
          >
            {adminLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Add Super Admin
              </>
            )}
          </Button>
        </div>

        <div className="pt-6 border-t border-gray-200 dark:border-border">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-foreground mb-3">How it works:</h4>
          <ul className="text-sm text-gray-600 dark:text-muted-foreground space-y-2">
            <li className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Add super admins to manage the app settings</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Super admins have full access to the Admin Panel</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Changes take effect immediately across the app</span>
            </li>
          </ul>
        </div>
      </div>
    </Card>
  );
}

function SignedUsersSection(props: any) {
  const {
    usersLoading,
    userActionLoadingId,
    signedUsers,
    showSignedUsers,
    openActionMenuUserId,
    setOpenActionMenuUserId,
    handleToggleSignedUsers,
    handleDeleteSignedUser,
    handleBlockSignedUser,
    handleGrantLoyalty,
    handleOpenEditUser,
    notifyUnsupportedUserAction,
  } = props;

  return (
    <Card className="p-8 shadow-sm border-gray-200 dark:border-border dark:bg-card">
      <div className="space-y-6">
        <Button
          onClick={handleToggleSignedUsers}
          disabled={usersLoading}
          variant="outline"
          className="w-full gap-2 h-11 shadow-sm"
        >
          {usersLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              Loading users...
            </>
          ) : (
            <>
              <Users className="w-4 h-4" />
              {showSignedUsers ? "Hide Signed Users" : "Show Signed Users"}
            </>
          )}
        </Button>

        {showSignedUsers && (
          <div className="border-t border-gray-200 dark:border-border pt-6">
            {signedUsers.length === 0 ? (
              <div className="text-sm text-gray-600 dark:text-muted-foreground bg-gray-50 dark:bg-muted/30 p-4 rounded-lg text-center">
                No signed users found.
              </div>
            ) : (
              <>
                <div className="md:hidden space-y-3">
                  {signedUsers.map((user: SignedUser) => (
                    <div key={user.id} className="rounded-xl border border-gray-200 dark:border-border bg-white dark:bg-card p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-foreground">{user.name || "User"}</span>
                            {user.isBlocked ? (
                              <Badge variant="destructive" className="text-xs">Blocked</Badge>
                            ) : null}
                            {user.hasLoyalty ? (
                              <Badge variant="default" className="text-xs bg-primary dark:bg-blue-600">Loyalty</Badge>
                            ) : null}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-muted-foreground mt-1">{user.phone || "-"}</p>
                          <p className="text-xs text-gray-500 dark:text-muted-foreground/60 mt-1">
                            Registered: {formatShortDate(user.createdAt)}
                          </p>
                        </div>
                        {userActionLoadingId === user.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        ) : null}
                      </div>

                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="justify-start gap-2 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-900/20"
                          disabled={userActionLoadingId === user.id}
                          onClick={() => handleDeleteSignedUser(user)}
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="justify-start gap-2"
                          disabled={userActionLoadingId === user.id}
                          onClick={() => {
                            if (!SUPPORTS_BLOCK_USER_ACTION) {
                              notifyUnsupportedUserAction(UNSUPPORTED_USER_ACTION_MESSAGE);
                              return;
                            }
                            void handleBlockSignedUser(user);
                          }}
                        >
                          <Ban className="w-4 h-4" />
                          {user.isBlocked ? "Unblock" : "Block"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="justify-start gap-2"
                          disabled={userActionLoadingId === user.id}
                          onClick={() => {
                            void handleGrantLoyalty(user);
                          }}
                        >
                          <Gift className="w-4 h-4" />
                          {user.hasLoyalty ? "Disable loyalty" : "Grant loyalty"}
                        </Button>
                        {SUPPORTS_EDIT_USER_ACTION ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="justify-start gap-2"
                            disabled={userActionLoadingId === user.id}
                            onClick={() => handleOpenEditUser(user)}
                          >
                            <Pencil className="w-4 h-4" />
                            Edit
                          </Button>
                        ) : (
                          <Button type="button" variant="outline" disabled className="justify-start gap-2 opacity-60">
                            <Pencil className="w-4 h-4" />
                            Edit unavailable
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden md:block border border-gray-200 dark:border-border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 dark:bg-muted/50 border-gray-200 dark:border-border">
                        <TableHead className="font-semibold text-gray-900 dark:text-foreground">Name</TableHead>
                        <TableHead className="font-semibold text-gray-900 dark:text-foreground">Phone Number</TableHead>
                        <TableHead className="font-semibold text-gray-900 dark:text-foreground">Date Registered</TableHead>
                        <TableHead className="text-right font-semibold text-gray-900 dark:text-foreground">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {signedUsers.map((user: SignedUser) => (
                        <TableRow key={user.id} className="hover:bg-gray-50 dark:hover:bg-muted/30 border-gray-100 dark:border-border transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 dark:text-foreground">{user.name || "User"}</span>
                              {user.isBlocked && (
                                <Badge variant="destructive" className="text-xs">
                                  Blocked
                                </Badge>
                              )}
                              {user.hasLoyalty && (
                                <Badge variant="default" className="text-xs bg-primary dark:bg-blue-600">
                                  Loyalty
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-gray-600 dark:text-muted-foreground">{user.phone || "-"}</TableCell>
                          <TableCell className="text-gray-600 dark:text-muted-foreground">{formatShortDate(user.createdAt)}</TableCell>
                          <TableCell className="text-right">
                            <div className="relative inline-block text-left">
                              <button
                                type="button"
                                disabled={userActionLoadingId === user.id}
                                onClick={() =>
                                  setOpenActionMenuUserId((current: string) =>
                                    current === user.id ? "" : user.id,
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded-md border border-gray-200 dark:border-border px-3 py-1.5 text-sm text-gray-700 dark:text-foreground hover:bg-gray-50 dark:hover:bg-muted/50 transition-colors disabled:opacity-50"
                              >
                                <MoreVertical className="w-4 h-4" />
                                Actions
                              </button>

                              {openActionMenuUserId === user.id && (
                                <div className="absolute right-0 z-20 mt-2 min-w-[12rem] rounded-md border border-gray-200 dark:border-border bg-white dark:bg-card p-1 shadow-lg dark:shadow-none">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuUserId("");
                                      handleDeleteSignedUser(user);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete user
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!SUPPORTS_BLOCK_USER_ACTION) {
                                        notifyUnsupportedUserAction(UNSUPPORTED_USER_ACTION_MESSAGE);
                                        setOpenActionMenuUserId("");
                                        return;
                                      }
                                      setOpenActionMenuUserId("");
                                      void handleBlockSignedUser(user);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-gray-700 dark:text-foreground hover:bg-gray-100 dark:hover:bg-muted transition-colors"
                                  >
                                    <Ban className="w-4 h-4" />
                                    {user.isBlocked ? "Unblock user" : "Block user"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuUserId("");
                                      void handleGrantLoyalty(user);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-gray-700 dark:text-foreground hover:bg-gray-100 dark:hover:bg-muted transition-colors"
                                  >
                                    <Gift className="w-4 h-4" />
                                    {user.hasLoyalty ? "Disable loyalty" : "Grant loyalty"}
                                  </button>

                                  {SUPPORTS_EDIT_USER_ACTION ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuUserId("");
                                        handleOpenEditUser(user);
                                      }}
                                      className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-gray-700 dark:text-foreground hover:bg-gray-100 dark:hover:bg-muted transition-colors"
                                    >
                                      <Pencil className="w-4 h-4" />
                                      Edit user
                                    </button>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function CountryCodesReferenceSection() {
  return (
    <Card className="p-8 shadow-sm border-gray-200 dark:border-border dark:bg-card">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-foreground mb-6">Common Country Codes Reference</h3>
      <div className="grid grid-cols-3 gap-x-8 gap-y-3 text-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-primary dark:text-blue-400">IQ</span>
            <span className="text-gray-600 dark:text-muted-foreground">Iraq</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-primary dark:text-blue-400">US</span>
            <span className="text-gray-600 dark:text-muted-foreground">United States</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-primary dark:text-blue-400">GB</span>
            <span className="text-gray-600 dark:text-muted-foreground">United Kingdom</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-primary dark:text-blue-400">DE</span>
            <span className="text-gray-600 dark:text-muted-foreground">Germany</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-primary dark:text-blue-400">FR</span>
            <span className="text-gray-600 dark:text-muted-foreground">France</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-primary dark:text-blue-400">IT</span>
            <span className="text-gray-600 dark:text-muted-foreground">Italy</span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-primary dark:text-blue-400">ES</span>
            <span className="text-gray-600 dark:text-muted-foreground">Spain</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-primary dark:text-blue-400">NL</span>
            <span className="text-gray-600 dark:text-muted-foreground">Netherlands</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-primary dark:text-blue-400">SA</span>
            <span className="text-gray-600 dark:text-muted-foreground">Saudi Arabia</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-primary dark:text-blue-400">AE</span>
            <span className="text-gray-600 dark:text-muted-foreground">UAE</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-primary dark:text-blue-400">QA</span>
            <span className="text-gray-600 dark:text-muted-foreground">Qatar</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-primary dark:text-blue-400">KW</span>
            <span className="text-gray-600 dark:text-muted-foreground">Kuwait</span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-primary dark:text-blue-400">BH</span>
            <span className="text-gray-600 dark:text-muted-foreground">Bahrain</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-primary dark:text-blue-400">OM</span>
            <span className="text-gray-600 dark:text-muted-foreground">Oman</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-primary dark:text-blue-400">JO</span>
            <span className="text-gray-600 dark:text-muted-foreground">Jordan</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-primary dark:text-blue-400">TR</span>
            <span className="text-gray-600 dark:text-muted-foreground">Turkey</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-primary dark:text-blue-400">EG</span>
            <span className="text-gray-600 dark:text-muted-foreground">Egypt</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-primary dark:text-blue-400">JP</span>
            <span className="text-gray-600 dark:text-muted-foreground">Japan</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
