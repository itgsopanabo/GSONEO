import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
        './resources/js/**/*.jsx',
    ],

    theme: {
        extend: {
            fontFamily: {
                sans: ['Figtree', ...defaultTheme.fontFamily.sans],
            },

            keyframes: {
                'slide-down': {
                    '0%': {transform: 'translate(-50%, -20px)', opacity: '0'},
                    '100%': {transform: 'translate(-50%, 0)', opacity: '1'},
                }
            },
            animation: {
                'slide-down': 'slide-down 0.2s ease-out forwards',
            }
        },
    },

    plugins: [forms],
};
