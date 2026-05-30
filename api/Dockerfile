# ===========================================
# Imagen de la API Laravel — PRODUCCIÓN (Render / Railway / etc.)
# Para desarrollo local con docker-compose se usa Dockerfile.dev
# ===========================================
FROM php:8.3-cli

# Dependencias del sistema para las extensiones de PHP
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    unzip \
    ca-certificates \
    libzip-dev \
    libpng-dev \
    libjpeg62-turbo-dev \
    libfreetype6-dev \
    libonig-dev \
    libicu-dev \
    libpq-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
        pdo_mysql \
        pdo_pgsql \
        mbstring \
        bcmath \
        gd \
        zip \
        exif \
        intl \
        opcache \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /app

# 1) Dependencias (capa cacheable) — solo las de producción
COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader --no-interaction --no-scripts --prefer-dist

# 2) Código de la aplicación
COPY . .
RUN composer dump-autoload --optimize --no-dev \
    && php artisan package:discover --ansi \
    && chmod -R 775 storage bootstrap/cache

# Arranque: aplica migraciones, siembra datos solo si la BD está vacía
# (primer despliegue) y sirve en el puerto que asigne el host.
# $PORT lo inyecta Render/Railway; en local cae a 8000.
# Se usa `php -S` con un router propio (server-router.php) en vez de
# `php artisan serve` para poder añadir cabeceras CORS a /uploads (las
# imágenes que el personalizador procesa en <canvas>/máscaras desde el front).
CMD php artisan migrate --force \
    && php artisan app:seed-if-empty \
    && php -S 0.0.0.0:${PORT:-8000} -t public server-router.php
