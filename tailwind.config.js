/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./views/**/*.ejs",
    "./node_modules/tw-elements/js/**/*.js",
    "./views/**/*.css",
  ],
  theme: {
    extend: {},
    container: {
      center: true,
      padding: '10rem',
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
