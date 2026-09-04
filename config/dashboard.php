<?php

// config/DashboardConfig.php
//
// The one place that answers "what does this role see?".
// Adding a role means editing this file, not shipping a new React page.
//
// Roles are keyed by SECTION first, then role_name — "Section Head" exists in
// four different sections and they are not the same job.

return [

    /*
    |---------------------------------------------------------------------------
    | Widgets
    |---------------------------------------------------------------------------
    | Widget key => permission needed to see it. null = everyone.
    | Order here is the order they render on the page.
    | Keys must match WIDGET_REGISTRY in resources/js/Dashboard/registry.jsx.
    */
    'widgets' => [
        'welcome'      => null,
        'clock'        => null,
        'stats'        => null,
        'deptPie'      => 'pr.view_all',
        'canvassQueue' => 'pr.canvass',
        'recentPrs'    => 'pr.view_all',
        'verifiedByMe' => 'pr.verify',

        // Not built yet — uncomment as the widget components land.
        // 'poQueue'      => 'pr.po',
        // 'myRequests'   => 'pr.encode',      // needs requester_emp_id column first
        // 'dispatchToday'=> 'motorpool.dispatch',
        // 'risQueue'     => 'inventory.ris',
        // 'recordsQueue' => 'records.verify',
    ],

    /*
    |---------------------------------------------------------------------------
    | Widgets to drop when they come back empty
    |---------------------------------------------------------------------------
    | An empty PR table is meaningful ("nothing to canvass today"). An empty
    | stats row is just a gap in the grid, so it gets removed instead.
    */
    'hide_when_empty' => ['stats', 'deptPie'],

    /*
    |---------------------------------------------------------------------------
    | Permissions
    |---------------------------------------------------------------------------
    | section => role_name => permissions.
    |
    | '*' means every permission — Superadmin only.
    |
    | Permissions rather than role names as the unit of access, so a new role is
    | a config line instead of an `if ($role === 'X')` scattered through
    | controllers. When this needs to be admin-editable, move it to a
    | permissions table; the widget map above doesn't change when you do.
    |
    | Motor Pool, Inventory and Records permissions are declared but have no
    | widgets yet, so those roles currently land on welcome + clock only. That's
    | a real gap, not a bug — see the note in the chat.
    */
    'permissions' => [

        'Administration' => [
            'Superadmin'      => ['*'],
            // Approves their own department's requests, sees only that department.
            'Department Head' => ['pr.approve', 'pr.view_dept'],
        ],

        'Procurement' => [
            'Section Head'   => ['pr.view_all', 'pr.approve', 'pr.verify'],
            'PR Verifier'    => ['pr.view_all', 'pr.verify'],
            'PO Officer'     => ['pr.view_all', 'pr.po'],
            'Canvas Officer' => ['pr.view_all', 'pr.canvass'],
            'PR Encoder'     => ['pr.view_all', 'pr.encode'],
        ],

        'Motor Pool' => [
            'Section Head'  => ['motorpool.manage', 'motorpool.dispatch'],
            'Fleet Manager' => ['motorpool.manage'],
            'Dispatcher'    => ['motorpool.dispatch'],
        ],

        'Inventory and Sales' => [
            'Section Head'     => ['inventory.ris', 'inventory.iar', 'inventory.ssmi', 'inventory.stock'],
            'Encoder(RIS)'     => ['inventory.ris'],
            'Encoder(SSMI)'    => ['inventory.ssmi'],
            'Encoder(IAR)'     => ['inventory.iar'],
            'Stock Custodian'  => ['inventory.stock'],
        ],

        'Records (Archives)' => [
            'Section Head' => ['records.verify', 'records.approve'],
            'Verifier'     => ['records.verify'],
            'Approver'     => ['records.approve'],
        ],
    ],
];
