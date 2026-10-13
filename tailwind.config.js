/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Roboto", "sans-serif"],
      },
      colors: {
        emerald: {
          50: "#eefcf6",
          100: "#d5f7ea",
          200: "#aeefd5",
          300: "#7be4bb",
          400: "#58D7A8", // color del usuario
          500: "#58D7A8", // color del usuario
          600: "#3ebd8f", // un poco mas oscuro para headers
          700: "#22906b",
          800: "#1d7357",
          900: "#1a5f49",
        }
      }
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        light: {
          primary: "#20315f",
          secondary: "#2c363b",
          info: "#2196F3",
          success: "#58D7A8", // color del usuario
          warning: "#FFC107",
          error: "#DC3545",
          "base-100": "#ffffff",
          "base-200": "#f8f9fa", // Gris muy claro y limpio
          "base-300": "#f1f3f5", // Gris suave para bordes/separadores
          "base-content": "#1f2937",
        },
      },
      {
        dark: {
          primary: "#222831",
          secondary: "#f2f4f5",
          info: "#2196F3",
          success: "#58D7A8", // color del usuario
          warning: "#FFC107",
          error: "#DC3545",
          "base-100": "#393E46",
          "base-200": "#2f343b",
          "base-300": "#252930",
          "base-content": "#e5e7eb",
        },
      },
    ],
  },
};
