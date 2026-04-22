import { ArrowLeft, ExternalLink, Trash2, User, Phone, AlertTriangle, Edit2, Mail, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { usePersonalInformationPageModel } from "../wiring/personal-information-page-service";
import { toast } from "sonner";

export function PersonalInformation() {
  const { t } = useTranslation();
  const {
    isDeleting,
    isSavingProfile,
    isAuthenticated,
    userName,
    userPhone,
    userEmail,
    deletionUrl,
    goBack,
    handleDeleteAccount,
    handleUpdateName,
    handleUpdateEmail,
  } = usePersonalInformationPageModel();

  const [showEditNameDialog, setShowEditNameDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [nameError, setNameError] = useState("");

  const [showAddEmailDialog, setShowAddEmailDialog] = useState(false);
  const [showEditEmailDialog, setShowEditEmailDialog] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  const handleOpenEditName = () => {
    setNewName(userName);
    setNameError("");
    setShowEditNameDialog(true);
  };

  const handleSaveName = async () => {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      setNameError(t("Name cannot be empty."));
      return;
    }
    if (trimmedName.length < 2) {
      setNameError(t("Name must be at least 2 characters."));
      return;
    }

    setNameError("");
    const result = await handleUpdateName(trimmedName);
    if (!result.success) {
      setNameError(result.fieldError || "");
      return;
    }

    setShowEditNameDialog(false);
    toast.success("Saved successfully");
  };

  const handleOpenAddEmail = () => {
    setNewEmail("");
    setEmailError("");
    setShowAddEmailDialog(true);
  };

  const handleOpenEditEmail = () => {
    setNewEmail(userEmail);
    setEmailError("");
    setShowEditEmailDialog(true);
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSaveEmail = async (isEdit: boolean) => {
    const trimmedEmail = newEmail.trim();

    if (!trimmedEmail && !isEdit) {
      setEmailError(t("Email cannot be empty."));
      return;
    }

    if (trimmedEmail && !validateEmail(trimmedEmail)) {
      setEmailError(t("Please enter a valid email address."));
      return;
    }

    setEmailError("");
    const result = await handleUpdateEmail(trimmedEmail ? trimmedEmail : null);
    if (!result.success) {
      setEmailError(result.fieldError || "");
      return;
    }

    if (isEdit) {
      setShowEditEmailDialog(false);
    } else {
      setShowAddEmailDialog(false);
    }

    toast.success(result.cleared ? t("Saved successfully") : t("Saved successfully"));
  };

  return (
    <div className="min-h-full bg-gradient-to-b from-gray-50 via-blue-50/30 to-purple-50/30 dark:from-background dark:to-background pb-4">
      <header className="relative bg-gradient-to-br from-[#1967D2] via-[#1557B0] to-[#114A99] px-6 pt-12 pb-6 text-white overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

        <div className="relative z-10">
          <button
            type="button"
            className="mb-3 inline-flex items-center gap-2 text-sm text-white/90 hover:text-white transition-colors bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg backdrop-blur-sm"
            onClick={goBack}
          >
            <ArrowLeft className="h-4 w-4" />
            {t("Back")}
          </button>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl">{t("Personal Information")}</h1>
          </div>
          <p className="text-sm text-white/80">{t("Review your account details and privacy controls")}</p>
        </div>
      </header>

      <section className="px-6 py-4 space-y-4">
        <Card className="divide-y border-0 shadow-lg overflow-hidden bg-white dark:bg-card dark:divide-border">
          <EditableInfoRow
            icon={<User className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
            iconBg="bg-blue-100 dark:bg-blue-900/20"
            label={t("Full Name")}
            value={userName}
            onEdit={handleOpenEditName}
          />
          <InfoRow
            icon={<Phone className="w-5 h-5 text-green-600 dark:text-green-400" />}
            iconBg="bg-green-100 dark:bg-green-900/20"
            label={t("Phone Number")}
            value={userPhone}
          />
          {userEmail ? (
            <EditableInfoRow
              icon={<Mail className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
              iconBg="bg-purple-100 dark:bg-purple-900/20"
              label={t("Email Address")}
              value={userEmail}
              onEdit={handleOpenEditEmail}
            />
          ) : null}
        </Card>

        {isAuthenticated && !userEmail ? (
          <Button
            onClick={handleOpenAddEmail}
            className="w-full h-12 gap-2 bg-gradient-to-r from-primary to-blue-600 hover:from-primary-hover hover:to-blue-700 shadow-md rounded-xl"
          >
            <Plus className="w-4 h-4" />
            {t("Add Email")}
          </Button>
        ) : null}
      </section>

      {isAuthenticated ? (
        <section className="px-6">
          <Card className="p-4 border-0 shadow-lg relative overflow-hidden bg-white dark:bg-card">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl"></div>

            <div className="relative">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/20 dark:to-red-900/40 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-medium mb-1 dark:text-foreground">{t("Delete Account")}</h2>
                  <p className="text-sm text-muted-foreground">
                    {t("This action deactivates your account, marks it as deleted, and signs you out immediately.")}
                  </p>
                </div>
              </div>

              {deletionUrl ? (
                <a
                  href={deletionUrl}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary-hover underline transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t("Open account deletion page")}
                </a>
              ) : null}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="destructive"
                    className="mt-3 w-full gap-2 h-12 shadow-md"
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-4 w-4" />
                    {isDeleting ? t("Deleting...") : t("Delete & Deactivate Account")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("Delete account now?")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("You will be signed out right away, and this account will no longer be able to log in. Existing records remain in backend as deleted status.")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={handleDeleteAccount}
                    >
                      {t("Yes, delete account")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </Card>
        </section>
      ) : null}

      <Dialog open={showEditNameDialog} onOpenChange={setShowEditNameDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("Edit Full Name")}</DialogTitle>
            <DialogDescription>{t("Update your display name")}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                if (nameError) {
                  setNameError("");
                }
              }}
              placeholder={t("Enter your full name")}
              className="h-12 rounded-xl"
              autoFocus
              disabled={isSavingProfile}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void handleSaveName();
                }
              }}
            />
            {nameError ? <p className="mt-2 text-sm text-destructive">{nameError}</p> : null}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowEditNameDialog(false)}
              className="rounded-xl"
              disabled={isSavingProfile}
            >
              {t("Cancel")}
            </Button>
            <Button
              onClick={() => void handleSaveName()}
              className="rounded-xl bg-gradient-to-r from-primary to-blue-600 hover:from-primary-hover hover:to-blue-700"
              disabled={isSavingProfile}
            >
              {isSavingProfile ? t("Saving...") : t("Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddEmailDialog} onOpenChange={setShowAddEmailDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("Add Email")}</DialogTitle>
            <DialogDescription>{t("Add a new email address")}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newEmail}
              onChange={(e) => {
                setNewEmail(e.target.value);
                if (emailError) {
                  setEmailError("");
                }
              }}
              placeholder={t("Enter your email address")}
              className="h-12 rounded-xl"
              autoFocus
              disabled={isSavingProfile}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void handleSaveEmail(false);
                }
              }}
            />
            {emailError ? <p className="mt-2 text-sm text-destructive">{emailError}</p> : null}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAddEmailDialog(false)}
              className="rounded-xl"
              disabled={isSavingProfile}
            >
              {t("Cancel")}
            </Button>
            <Button
              onClick={() => void handleSaveEmail(false)}
              className="rounded-xl bg-gradient-to-r from-primary to-blue-600 hover:from-primary-hover hover:to-blue-700"
              disabled={isSavingProfile}
            >
              {isSavingProfile ? t("Saving...") : t("Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditEmailDialog} onOpenChange={setShowEditEmailDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("Edit Email")}</DialogTitle>
            <DialogDescription>
              {t("Update your email address, or clear it to remove the current email.")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newEmail}
              onChange={(e) => {
                setNewEmail(e.target.value);
                if (emailError) {
                  setEmailError("");
                }
              }}
              placeholder={t("Enter your email address")}
              className="h-12 rounded-xl"
              autoFocus
              disabled={isSavingProfile}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void handleSaveEmail(true);
                }
              }}
            />
            {emailError ? <p className="mt-2 text-sm text-destructive">{emailError}</p> : null}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowEditEmailDialog(false)}
              className="rounded-xl"
              disabled={isSavingProfile}
            >
              {t("Cancel")}
            </Button>
            <Button
              onClick={() => void handleSaveEmail(true)}
              className="rounded-xl bg-gradient-to-r from-primary to-blue-600 hover:from-primary-hover hover:to-blue-700"
              disabled={isSavingProfile}
            >
              {isSavingProfile ? t("Saving...") : t("Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({
  icon,
  iconBg,
  label,
  value,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4 p-4 hover:bg-muted/20 transition-colors">
      <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0 text-start">
        <span className="text-xs text-muted-foreground block mb-0.5">{label}</span>
        <span className="text-sm font-medium truncate block dark:text-foreground">{value}</span>
      </div>
    </div>
  );
}

function EditableInfoRow({
  icon,
  iconBg,
  label,
  value,
  onEdit,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center gap-4 p-4 hover:bg-muted/20 transition-colors">
      <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0 text-start">
        <span className="text-xs text-muted-foreground block mb-0.5">{label}</span>
        <span className="text-sm font-medium truncate block dark:text-foreground">{value}</span>
      </div>
      <button
        onClick={onEdit}
        className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-accent hover:bg-blue-100 dark:hover:bg-accent/80 flex items-center justify-center transition-colors flex-shrink-0"
      >
        <Edit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
      </button>
    </div>
  );
}
