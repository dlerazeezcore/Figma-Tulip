import fs from 'fs';

let content = fs.readFileSync('src/app/components/auth/AuthModal.tsx', 'utf8');

const replacements = [
  ['toast.error("Please enter your phone number");', 'toast.error(t("Please enter your phone number"));'],
  ['toast.error(`Please enter the ${OTP_CODE_LENGTH}-digit code`);', 'toast.error(t("Please enter the {{- length}}-digit code", { length: OTP_CODE_LENGTH }));'],
  ['toast.success("OTP sent via ${label} to ${response.data?.to || fullPhoneNumber}");', 'toast.success(t("OTP sent via {{- label}} to {{- phone}}", { label, phone: response.data?.to || fullPhoneNumber }));'],
  ['toast.error("Unable to send verification code right now.");', 'toast.error(t("Unable to send verification code right now."));'],
  ['toast.success("Code received. Continue with your profile details.");', 'toast.success(t("Code received. Continue with your profile details."));'],
  ['toast.success("Code received. Set your new password.");', 'toast.success(t("Code received. Set your new password."));'],
  ['toast.success("Logged in successfully");', 'toast.success(t("Logged in successfully"));'],
  ['toast.error("Unable to log in right now.");', 'toast.error(t("Unable to log in right now."));'],
  ['toast.error("Please enter your full name");', 'toast.error(t("Please enter your full name"));'],
  ['toast.error("Please enter your password");', 'toast.error(t("Please enter your password"));'],
  ['toast.error("Password must be at least 6 characters");', 'toast.error(t("Password must be at least 6 characters"));'],
  ['toast.error("Passwords do not match");', 'toast.error(t("Passwords do not match"));'],
  ['toast.success("Account created successfully");', 'toast.success(t("Account created successfully"));'],
  ['toast.error("Unable to create account right now.");', 'toast.error(t("Unable to create account right now."));'],
  ['toast.error("Please enter your new password");', 'toast.error(t("Please enter your new password"));'],
  ['toast.success("Password reset successfully");', 'toast.success(t("Password reset successfully"));'],
  ['toast.error("Unable to reset password right now.");', 'toast.error(t("Unable to reset password right now."));'],
  ['if (authMode === "forgot") return "Reset Password";', 'if (authMode === "forgot") return t("Reset Password");'],
  ['if (authMode === "signup") return "Create Account";', 'if (authMode === "signup") return t("Create Account");'],
  ['return "Welcome Back";', 'return t("Welcome Back");'],
  ['if (authMode === "forgot") return "Recover your account access";', 'if (authMode === "forgot") return t("Recover your account access");'],
  ['if (authMode === "signup") return "Sign up to manage your eSIMs";', 'if (authMode === "signup") return t("Sign up to manage your eSIMs");'],
  ['return "Log in to access your account";', 'return t("Log in to access your account");'],
  ['authMode === "signup" ? "sign up" : authMode === "forgot" ? "verification" : "login"', 'authMode === "signup" ? t("sign up") : authMode === "forgot" ? t("verification") : t("login")'],
  ['Choose your preferred {', 't("Choose your preferred") + " {"'],
  ['} method', '} + " " + t("method")'],
  ['title="Password"', 'title={t("Password")}'],
  ['description="Use your password to log in"', 'description={t("Use your password to log in")}'],
  ['description="Create account with password"', 'description={t("Create account with password")}'],
  ['title="SMS OTP"', 'title={t("SMS OTP")}'],
  ['description="Receive verification code via SMS"', 'description={t("Receive verification code via SMS")}'],
  ['title="WhatsApp OTP"', 'title={t("WhatsApp OTP")}'],
  ['description="Receive verification code via WhatsApp"', 'description={t("Receive verification code via WhatsApp")}'],
  ['Forgot your password?', '{t("Forgot your password?")}'],
  ['authMode === "signup" ? "Already have an account? " : "Don\\'t have an account? "', 'authMode === "signup" ? t("Already have an account? ") : t("Don\\'t have an account? ")'],
  ['authMode === "signup" ? "Log In" : "Sign Up"', 'authMode === "signup" ? t("Log In") : t("Sign Up")'],
  ['authMethod === "sms" && `We\\'ll send a ${OTP_CODE_LENGTH}-digit code via SMS`', 'authMethod === "sms" && t("We\\'ll send a {{- length}}-digit code via SMS", { length: OTP_CODE_LENGTH })'],
  ['authMethod === "whatsapp" && `We\\'ll send a ${OTP_CODE_LENGTH}-digit code via WhatsApp`', 'authMethod === "whatsapp" && t("We\\'ll send a {{- length}}-digit code via WhatsApp", { length: OTP_CODE_LENGTH })'],
  ['authMethod === "password" && "Enter your phone number to continue"', 'authMethod === "password" && t("Enter your phone number to continue")'],
  ['<label className="block text-sm font-medium mb-2 text-gray-700">Phone Number</label>', '<label className="block text-sm font-medium mb-2 text-gray-700">{t("Phone Number")}</label>'],
  ['isSubmitting\\n                  ? authMethod === "password"\\n                    ? "Continuing..."\\n                    : "Sending..."\\n                  : authMethod === "password"\\n                  ? "Continue"\\n                  : "Send OTP"', 'isSubmitting ? (authMethod === "password" ? t("Continuing...") : t("Sending...")) : (authMethod === "password" ? t("Continue") : t("Send OTP"))'],
  ['Code sent to {buildFullPhoneNumber()} via {authMethod === "sms" ? "SMS" : "WhatsApp"}', '{t("Code sent to {{- phone}} via {{- method}}", { phone: buildFullPhoneNumber(), method: authMethod === "sms" ? "SMS" : "WhatsApp" })}'],
  ['Enter {OTP_CODE_LENGTH}-Digit Code', '{t("Enter {{- length}}-Digit Code", { length: OTP_CODE_LENGTH })}'],
  ['isSubmitting ? "Verifying..." : "Verify Code"', 'isSubmitting ? t("Verifying...") : t("Verify Code")'],
  ['otpCooldownSeconds > 0\\n                    ? `Resend code in ${otpCooldownSeconds}s`\\n                    : "Didn\'t receive the code? Resend"', 'otpCooldownSeconds > 0 ? t("Resend code in {{- seconds}}s", { seconds: otpCooldownSeconds }) : t("Didn\'t receive the code? Resend")'],
  ['<label className="block text-sm font-medium mb-2 text-gray-700">Full Name</label>', '<label className="block text-sm font-medium mb-2 text-gray-700">{t("Full Name")}</label>'],
  ['authMethod === "password" ? "Continue" : "Complete Sign Up"', 'authMethod === "password" ? t("Continue") : t("Complete Sign Up")'],
  ['Next: Enter phone number and create password', '{t("Next: Enter phone number and create password")}'],
  ['<label className="block text-sm font-medium mb-2 text-gray-700">Password</label>', '<label className="block text-sm font-medium mb-2 text-gray-700">{t("Password")}</label>'],
  ['isSubmitting ? "Logging in..." : "Log In"', 'isSubmitting ? t("Logging in...") : t("Log In")'],
  ['authMode === "forgot" ? "New Password" : "Create Password"', 'authMode === "forgot" ? t("New Password") : t("Create Password")'],
  ['Minimum 6 characters', '{t("Minimum 6 characters")}'],
  ['<label className="block text-sm font-medium mb-2 text-gray-700">Confirm Password</label>', '<label className="block text-sm font-medium mb-2 text-gray-700">{t("Confirm Password")}</label>'],
  ['isSubmitting\\n                      ? authMode === "forgot"\\n                        ? "Resetting..."\\n                        : "Creating..."\\n                      : authMode === "forgot"\\n                        ? "Reset Password"\\n                        : "Create Account"', 'isSubmitting ? (authMode === "forgot" ? t("Resetting...") : t("Creating...")) : (authMode === "forgot" ? t("Reset Password") : t("Create Account"))'],
  ['By signing up, you agree to our{" "}', '{t("By signing up, you agree to our")} '],
  ['Terms of Service', '{t("Terms of Service")}'],
  ['{" "}and{" "}', ' {t("and")} '],
  ['Privacy Policy', '{t("Privacy Policy")}']
];

for (const [search, replace] of replacements) {
    if (content.includes(search)) {
        content = content.split(search).join(replace);
    } else {
        console.log("NOT FOUND:", search);
    }
}

// Special cases that need regex
content = content.replace(/toast\.success\(\`OTP sent via \$\{label\} to \$\{response\.data\?\.to \|\| fullPhoneNumber\}\`\);/, 
  'toast.success(t("OTP sent via {{- label}} to {{- phone}}", { label, phone: response.data?.to || fullPhoneNumber }));');

content = content.replace(/<p className="text-sm text-gray-600 mb-6">\s*Choose your preferred \{authMode === "signup" \? "sign up" \: authMode === "forgot" \? "verification" : "login"\} method\s*<\/p>/g,
  '<p className="text-sm text-gray-600 mb-6">{t("Choose your preferred")} {authMode === "signup" ? t("sign up") : authMode === "forgot" ? t("verification") : t("login")} {t("method")}</p>');

fs.writeFileSync('src/app/components/auth/AuthModal.tsx', content);
