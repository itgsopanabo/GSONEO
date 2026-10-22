<?php

// config/permissions.php
//
// The catalogue of permissions and the access each role starts with.
//
// After the first seed, the Roles & permissions screen is the source of truth:
// PermissionSeeder adds new permissions from this file but only gives
// `defaults` to roles that have no permissions yet, so edits made on the
// screen are never overwritten.

return [

    /*
    |---------------------------------------------------------------------------
    | Catalogue
    |---------------------------------------------------------------------------
    | group => [permission name => [label, description]]
    */
    'catalogue' => [
        'Procurement' => [
            'pr.view' => ['View purchase requests', 'Open the Purchase Request Management list and PR PDFs.'],
            'pr.create' => ['Create purchase requests', 'File a new purchase request from the list.'],
            'pr.encode' => ['Encode purchase requests', 'Use Drafts and Encoded to encode and submit requests.'],
            'pr.verify' => ['Verify or decline requests', 'Accept or decline pending purchase requests.'],
            'pr.canvass' => ['Canvassing', 'Open the Canvas Form module, print and recanvass.'],
            'pr.po' => ['Purchase orders', 'Open Purchase Order Management and generate PO numbers.'],
        ],
        'Inventory' => [
            'inventory.incoming' => ['Incoming deliveries', 'Receive delivered purchase orders and send them to IAR.'],
            'inventory.iar' => ['Inspection and Acceptance Report', 'Generate and view IARs.'],
            'inventory.ris' => ['Requisition and Issue Slip', 'Generate RIS numbers.'],
            'inventory.ssmi' => ['SSMI', 'Generate SSMI numbers and documents.'],
            'inventory.outgoing' => ['Outgoing releases', 'Release items and complete orders.'],
        ],
        'Records' => [
            'records.view' => ['Records registry', 'Open and manage the records registry.'],
            'records.view_restricted' => ['Restricted records', 'See records classed as restricted, such as land titles.'],
            'record_classes.manage' => ['Record classes', 'Manage record classes and retention rules.'],
        ],
        'Monitoring and reports' => [
            'monitoring.view' => ['Request monitoring', 'Open request monitoring and timelines.'],
            'reports.custom' => ['Report builder', 'Build and export custom reports.'],
            'reports.sql' => ['SQL console', 'Run read-only SQL queries.'],
            'audit.view' => ['Audit trail', 'View the audit trail.'],
        ],
        'Dashboard' => [
            'dashboard.system' => ['System overview', 'Users, activity and system totals on the dashboard.'],
            'dashboard.procurement' => ['Procurement overview', 'Request pipeline, trends and department charts.'],
            'dashboard.inventory' => ['Inventory overview', 'Purchase order pipeline and inventory totals.'],
            'dashboard.analytics' => ['Analytics dashboard', 'Read the dashboard as analytics, split into Overview, Pipeline and Reports tabs.'],
        ],
        'Administration' => [
            'users.manage' => ['Manage users', 'Add users, change roles, statuses and passwords.'],
            'permissions.manage' => ['Manage roles and permissions', 'Change what each role can access.'],
            'procurement.override' => ['Cancel and change status', 'Cancel a purchase request or its purchase order, and move either to another status, from Request Monitoring.'],
            'items.manage' => ['Items catalogue', 'Add, edit and bulk import items.'],
            'documents.manage' => ['Document branding', 'Set the logos, letterhead, watermark, footer and signatories printed on generated PDFs.'],
            'offices.manage' => ['Requesting offices', 'Add, rename and retire the offices that purchase requests and records are filed under.'],
            'calendar.manage' => ['Calendar events', 'Add, change and remove events on the dashboard calendar, such as holidays, meetings and deadlines.'],
            'tracker_tags.manage' => ['Tracker tags', 'Add, rename, recolour and retire the tags used to mark what an order is missing.'],
            'docs.view' => ['System documentation', 'Read the system documentation and the database ERD.'],
        ],
        'Motor Pool' => [
            'motorpool.view' => ['Motor Pool', 'Access to the Motor Pool module once it is available.'],
        ],
    ],

    /*
    |---------------------------------------------------------------------------
    | Permissions no role may lose from the screen while it is someone's own
    |---------------------------------------------------------------------------
    | Removing these from your own role would lock you out of fixing it.
    */
    'protected_on_own_role' => ['permissions.manage', 'users.manage'],

    /*
    |---------------------------------------------------------------------------
    | Starting access per role
    |---------------------------------------------------------------------------
    | section => role_name => permission names ('*' = every permission).
    */
    'defaults' => [
        'Sys Admin' => [
            'Superadmin' => ['*'],
        ],
        'Administration' => [
            'Department Head' => ['monitoring.view', 'dashboard.procurement', 'dashboard.inventory', 'dashboard.analytics'],
        ],
        'Procurement' => [
            'Section Head' => ['pr.view', 'pr.create', 'pr.verify', 'pr.canvass', 'pr.po', 'monitoring.view', 'dashboard.procurement'],
            'PR Verifier' => ['pr.view', 'pr.create', 'pr.verify'],
            'PO Officer' => ['pr.po'],
            'Canvas Officer' => ['pr.canvass'],
            'PR Encoder' => ['pr.encode'],
        ],
        'Motor Pool' => [
            'Section Head' => ['motorpool.view'],
            'Fleet Manager' => ['motorpool.view'],
            'Dispatcher' => ['motorpool.view'],
        ],
        'Inventory and Sales' => [
            'Section Head' => ['inventory.incoming', 'inventory.iar', 'inventory.ris', 'inventory.ssmi', 'inventory.outgoing', 'dashboard.inventory'],
            'Encoder(RIS)' => ['inventory.ris'],
            'Encoder(SSMI)' => ['inventory.ssmi'],
            'Encoder(IAR)' => ['inventory.iar'],
            'Stock Custodian' => ['inventory.incoming', 'inventory.outgoing'],
        ],
        'Records (Archives)' => [
            'Section Head' => ['records.view'],
            'Verifier' => ['records.view'],
            'Approver' => ['records.view'],
        ],
    ],
];
