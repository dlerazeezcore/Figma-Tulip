import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Translations
const resources = {
  en: {
    translation: {
      "Profile": "Profile",
      "Manage your account & preferences": "Manage your account & preferences",
      "Account": "Account",
      "Personal Information": "Personal Information",
      "View and edit your details": "View and edit your details",
      "Order History": "Order History",
      "Coming soon": "Coming soon",
      "Preferences": "Preferences",
      "Push Notifications": "Push Notifications",
      "Get updates about your eSIMs": "Get updates about your eSIMs",
      "Dark Mode": "Dark Mode",
      "Adjust the app's appearance": "Adjust the app's appearance",
      "Language": "Language",
      "Currency": "Currency",
      "Support": "Support",
      "Chat with Support": "Chat with Support",
      "Get help from our team": "Get help from our team",
      "Log Out": "Log Out",
      "Log In": "Log In",
      "Sign Up": "Sign Up",
      "Flight Search": "Flight Search",
      "Hotel Search": "Hotel Search",
      "Bookings": "Bookings",
      "price_format": "{{currency}} {{price}}",
      "Checkout": "Checkout",
      "Brought to you by Corevia Network": "Brought to you by Corevia Network"
    }
  },
  es: {
    translation: {
      "Profile": "Perfil",
      "Manage your account & preferences": "Administra tu cuenta y preferencias",
      "Account": "Cuenta",
      "Personal Information": "Información Personal",
      "View and edit your details": "Ver y editar tus detalles",
      "Order History": "Historial de Pedidos",
      "Coming soon": "Próximamente",
      "Preferences": "Preferencias",
      "Push Notifications": "Notificaciones Push",
      "Get updates about your eSIMs": "Recibe actualizaciones sobre tus eSIMs",
      "Dark Mode": "Modo Oscuro",
      "Adjust the app's appearance": "Ajusta la apariencia de la app",
      "Language": "Idioma",
      "Currency": "Moneda",
      "Support": "Soporte",
      "Chat with Support": "Chatear con Soporte",
      "Get help from our team": "Obtén ayuda de nuestro equipo",
      "Log Out": "Cerrar Sesión",
      "Log In": "Iniciar Sesión",
      "Sign Up": "Registrarse",
      "Flight Search": "Buscar Vuelos",
      "Hotel Search": "Buscar Hoteles",
      "Bookings": "Reservas",
      "price_format": "{{price}} {{currency}}",
      "Checkout": "Pago",
      "Brought to you by Corevia Network": "Traído a usted por Corevia Network"
    }
  },
  fr: {
    translation: {
      "Profile": "Profil",
      "Manage your account & preferences": "Gérez votre compte et vos préférences",
      "Account": "Compte",
      "Personal Information": "Informations Personnelles",
      "View and edit your details": "Voir et modifier vos détails",
      "Order History": "Historique des Commandes",
      "Coming soon": "À venir",
      "Preferences": "Préférences",
      "Push Notifications": "Notifications Push",
      "Get updates about your eSIMs": "Obtenez des mises à jour sur vos eSIMs",
      "Dark Mode": "Mode Sombre",
      "Adjust the app's appearance": "Ajuster l'apparence de l'application",
      "Language": "Langue",
      "Currency": "Devise",
      "Support": "Support",
      "Chat with Support": "Discuter avec le Support",
      "Get help from our team": "Obtenez de l'aide de notre équipe",
      "Log Out": "Se Déconnecter",
      "Log In": "Se Connecter",
      "Sign Up": "S'inscrire",
      "Flight Search": "Recherche de Vols",
      "Hotel Search": "Recherche d'Hôtels",
      "Bookings": "Réservations",
      "price_format": "{{price}} {{currency}}",
      "Checkout": "Paiement",
      "Brought to you by Corevia Network": "Vous est présenté par Corevia Network"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "en", // default language
    fallbackLng: "en",
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
