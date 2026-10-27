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

The **GSO Information System** is an internal web application built for the General Services Office (GSO) to streamline day-to-day operations. It centralizes core GSO functions — **Procurement**, **Inventory**, and **Records Management** — taking a hybrid approach that pairs digital tracking with existing paper-based processes, improving accuracy, speeding up processing, and giving staff real-time visibility into office operations.

## Features

| | |
|---|---|
| 📝 | Item encoding with OCR-assisted scanning, Purchase Request receiving, and Purchase Order numbering |
| 📦 | Purchase Order receiving (incoming/outgoing) with RIS, SSMI, and IAR issuance |
| 🗂️ | Storage tracking for physical documents submitted for archiving |
| 👥 | Role-based access control for staff, approvers, and admins |
| 🛠️ | System administration module for user, role, and system-wide moderation |
| 🖨️ | Configurable PDF letterhead — logos, header, footer, and watermark set once by an admin for every generated document |
| ⏱️ | Admin dashboard with request timeline tracking (received in Inventory → released) |
| 📊 | Dashboards and reports for procurement and stock activity |
| 🔔 | Notifications for pending approvals and low-stock items |
| 🕘 | Audit trail / activity logs for accountability |

## Tech Stack

- **Framework:** [Laravel](https://laravel.com) (PHP)
- **Database:** MySQL
- **Frontend:** React (via [Inertia.js](https://inertiajs.com))
- **Authentication:** [Laravel Breeze](https://laravel.com/docs/starter-kits#breeze-and-inertia) (React edition)
- **OCR:** [OCR.Space API](https://ocr.space)
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

1. Sign in with your employee ID. Accounts are created by an administrator from the User List; there is no self-registration. New accounts get a one-time password from the administrator and must set their own at first sign-in.
2. The sidebar and dashboard show the modules your role's permissions allow — **Procurement**, **Inventory**, **Records**, and more.
3. Submit, review, or approve requests as needed — all actions are logged for auditing purposes.

For architecture, the workflow statuses, roles and permissions, the dashboard, and how-to guides, see the **[system documentation](docs/DOCUMENTATION.md)**. For production setup — one Windows server with staff connecting over a VPN — see the **[deployment guide](docs/DEPLOYMENT.md)**.

## Modules

### 📝 Procurement
Handles the encoding of items — with OCR-assisted scanning to auto-extract item details from physical documents — receiving and processing of Purchase Requests (PRs), and the numbering and generation of Purchase Orders (POs).

### 📦 Inventory
Manages the receiving of Purchase Orders for incoming and outgoing stock, and the issuance of RIS (Requisition and Issue Slip) validation, SSMI, and IAR (Inspection and Acceptance Report).

### 🗂️ Records
Manages the storage tracking of physical document copies, designed specifically for documents that have been submitted for archiving.

### 🛠️ System Admin
Provides moderation and oversight of the entire system — managing user accounts and roles, configuring permissions, monitoring activity/audit logs, and maintaining overall system settings and data integrity across the Procurement, Inventory, and Records modules. Includes a dashboard with a request timeline view, tracking each request from the moment it's received in Inventory through to its release.

**Document Branding** lets an admin change the letterhead printed on every generated PDF (Purchase Request, Canvass Form, IAR, and SSMI) without touching code: the left and right logos, header lines, office name and motto, a footer with the office address and page numbers, an accent colour, and an optional image or text watermark. **PDF Signatories** sets the name and position in each signature block — the Budget Officer, approving officials, supply officers — so a change of personnel is one edit, not a code change.

## Contributing

This is an internal system. For bug reports, feature requests, or contribution guidelines, please coordinate with the development team lead before submitting changes.

## Support

For issues or questions regarding this system, please contact the IT/Development team handling the GSO Information System.

## License

This project is proprietary and intended for internal use by the General Services Office. Unauthorized distribution is not permitted.
