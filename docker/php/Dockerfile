# --- Stage 1: Build Frontend Assets ---
FROM node:20 AS node-builder
WORKDIR /app

# Copy only dependency files first to leverage Docker caching
COPY package*.json vite.config.js ./
RUN npm install

# Copy the rest of the project and build
COPY . .


# --- Stage 2: Build PHP Dependencies ---
FROM composer:latest AS vendor-builder
WORKDIR /app
COPY composer.* ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist

# --- Stage 3: Final Production Image ---
FROM php:8.3-fpm
WORKDIR /var/www

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libpng-dev libonig-dev libxml2-dev libzip-dev zip unzip \
    && docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd zip

# Copy PHP dependencies from stage 2
COPY --from=vendor-builder /app/vendor ./vendor

# Copy application code
COPY . .

# Copy built frontend assets from stage 1
COPY --from=node-builder /app/public/build ./public/build

# Finalize permissions
RUN chown -R www-data:www-data /var/www/storage /var/www/bootstrap/cache
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer
EXPOSE 9000
CMD ["php-fpm"]
