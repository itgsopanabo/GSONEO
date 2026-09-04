<p align="center">
  <img src="public/logowithword.png" width="400" alt="GSO Information System Logo">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Laravel-FF2D20?style=flat&logo=laravel&logoColor=white" alt="Laravel">
  <img src="https://img.shields.io/badge/MySQL-4479A1?style=flat&logo=mysql&logoColor=white" alt="MySQL">
  <img src="https://img.shields.io/badge/status-active-brightgreen" alt="Status">
  <img src="https://img.shields.io/badge/license-private-lightgrey" alt="License">
</p>

<p align="center">
  <a href="#about">About</a> ·
  <a href="#features">Features</a> ·
  <a href="#tech-stack">Tech Stack</a> ·
  <a href="#installation">Installation</a> ·
  <a href="#usage">Usage</a> ·
  <a href="#modules">Modules</a> ·
  <a href="#contributing">Contributing</a> ·
  <a href="#support">Support</a>
</p>

---

## About

The **GSO Information System** is an internal web application built for the General Services Office (GSO) to streamline day-to-day operations. It centralizes and digitizes core GSO functions — **Procurement**, **Inventory**, and **Records Management** — replacing manual, paper-based tracking with a single, reliable system that improves accuracy, speeds up processing, and gives staff real-time visibility into office operations.

## Features

| | |
|---|---|
| 📝 | Digital procurement requests with approval workflows |
| 📦 | Real-time inventory tracking and stock level alerts |
| 🗂️ | Centralized records management with searchable archives |
| 👥 | Role-based access control for staff, approvers, and admins |
| 📊 | Dashboards and reports for procurement and stock activity |
| 🔔 | Notifications for pending approvals and low-stock items |
| 🕘 | Audit trail / activity logs for accountability |

## Tech Stack

- **Framework:** [Laravel](https://laravel.com) (PHP)
- **Database:** MySQL
- **Frontend:** React (via [Inertia.js](https://inertiajs.com))
- **Authentication:** [Laravel Breeze](https://laravel.com/docs/starter-kits#breeze-and-inertia) (React edition)
- **Containerization:** Docker & Docker Compose

## Installation

**Prerequisites:** Docker and Docker Compose installed on your machine.

```bash
# Clone the repository
git clone <repository-url>
cd gso-information-system

# Copy environment file and configure database credentials
cp .env.example .env

# Build and start the containers
docker compose up -d --build

# Install PHP dependencies (inside the app container)
docker compose exec app composer install

# Generate application key
docker compose exec app php artisan key:generate

# Run migrations and seed initial data
docker compose exec app php artisan migrate --seed

# Install and build frontend assets
docker compose exec app npm install
docker compose exec app npm run build
```

For local development with hot-reloading, run instead of `npm run build`:

```bash
docker compose exec app npm run dev
```

The application should now be running at `http://localhost` (or the port configured in your `docker-compose.yml`).

**Common Docker commands:**

```bash
# Stop the containers
docker compose down

# View logs
docker compose logs -f

# Access the app container shell
docker compose exec app bash

# Run artisan commands
docker compose exec app php artisan <command>
```

## Usage

1. Register or log in via the Breeze authentication pages (login, register, password reset all included out of the box).
2. Depending on your role, access the **Procurement**, **Inventory**, or **Records** module from the dashboard.
3. Submit, review, or approve requests as needed — all actions are logged for auditing purposes.

## Modules

### 📝 Procurement
Handles purchase requests, supplier records, approval routing, and purchase order generation — giving staff a clear view of request status from submission to fulfillment.

### 📦 Inventory
Tracks stock levels across supplies and equipment, records stock in/out movements, and flags items that need reordering.

### 🗂️ Records
Maintains a centralized, searchable archive of GSO documents and transaction history for easy retrieval and reporting.

## Contributing

This is an internal system. For bug reports, feature requests, or contribution guidelines, please coordinate with the development team lead before submitting changes.

## Support

For issues or questions regarding this system, please contact the IT/Development team handling the GSO Information System.

## License

This project is proprietary and intended for internal use by the General Services Office. Unauthorized distribution is not permitted.
