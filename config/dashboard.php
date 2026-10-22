<?php

// config/dashboard.php
//
// The one place that answers "what does this role see on the dashboard?".
// Who holds each permission is set per role on the Roles & permissions screen.

return [

    /*
    |---------------------------------------------------------------------------
    | Widgets
    |---------------------------------------------------------------------------
    | Widget key => permission needed to see it: null = everyone, a list = any
    | one of them, ['permission' => ..., 'unless' => ...] = hide from holders of
    | 'unless'. Order here is the order they render on the page.
    | Keys must match WIDGET_REGISTRY in
    | resources/js/Components/DasboardComponents/Registry.jsx.
    */
    'widgets' => [
        // The greeting carries the date and time, so there is no separate clock.
        'welcome' => null,
        'stats' => null,
        // Holidays, meetings, deadlines: everyone sees it; calendar.manage edits it.
        'calendar' => null,

        // Overviews
        'monthlyTrend' => ['dashboard.procurement', 'dashboard.inventory'],
        'prPipeline' => 'dashboard.procurement',
        'poPipeline' => 'dashboard.inventory',
        'deptChart' => 'dashboard.procurement',
        'recentActivity' => 'dashboard.system',

        // Work queues — what is waiting on this person right now. Hidden from
        // anyone who holds the matching overview, so heads get charts instead.
        'draftQueue' => ['permission' => 'pr.encode', 'unless' => 'dashboard.procurement'],
        'verifyQueue' => ['permission' => 'pr.verify', 'unless' => 'dashboard.procurement'],
        'canvassQueue' => ['permission' => 'pr.canvass', 'unless' => 'dashboard.procurement'],
        'poQueue' => ['permission' => 'pr.po', 'unless' => 'dashboard.procurement'],
        'incomingQueue' => ['permission' => 'inventory.incoming', 'unless' => 'dashboard.inventory'],
        'outgoingQueue' => ['permission' => 'inventory.outgoing', 'unless' => 'dashboard.inventory'],
        'iarQueue' => ['permission' => 'inventory.iar', 'unless' => 'dashboard.inventory'],
        'risQueue' => ['permission' => 'inventory.ris', 'unless' => 'dashboard.inventory'],
        'ssmiQueue' => ['permission' => 'inventory.ssmi', 'unless' => 'dashboard.inventory'],
        'disposalQueue' => ['permission' => 'records.view', 'unless' => 'dashboard.system'],

        'recentPrs' => 'dashboard.procurement',

        // What orders are missing: anyone who works an inventory stage.
        'missingTracker' => ['inventory.incoming', 'inventory.iar', 'inventory.ris', 'inventory.ssmi', 'inventory.outgoing'],

        // Sections whose module isn't built yet
        'comingSoon' => ['permission' => 'motorpool.view', 'unless' => 'dashboard.system'],
    ],

    /*
    |---------------------------------------------------------------------------
    | Tabs
    |---------------------------------------------------------------------------
    | Shown only to holders of 'dashboard.analytics'; everyone else gets the one
    | page they have now, which is the right shape for a screen that is mostly
    | "what is waiting on me today".
    |
    | Order here is the order of the tab strip. A tab with no visible widgets is
    | dropped, so nobody lands on an empty one.
    */
    'tabs' => [
        'overview' => 'Overview',
        'pipeline' => 'Pipeline',
        'reports' => 'Reports',
    ],

    /*
    | Widget key => tab. Anything not listed falls back to the first tab.
    */
    'widget_tabs' => [
        // Overview — the headline numbers.
        'welcome' => 'overview',
        'calendar' => 'overview',
        'stats' => 'overview',
        'comingSoon' => 'overview',

        // Pipeline — where work is sitting right now.
        'prPipeline' => 'pipeline',
        'poPipeline' => 'pipeline',
        'draftQueue' => 'pipeline',
        'verifyQueue' => 'pipeline',
        'canvassQueue' => 'pipeline',
        'poQueue' => 'pipeline',
        'incomingQueue' => 'pipeline',
        'outgoingQueue' => 'pipeline',
        'iarQueue' => 'pipeline',
        'risQueue' => 'pipeline',
        'ssmiQueue' => 'pipeline',
        'disposalQueue' => 'pipeline',
        'missingTracker' => 'pipeline',

        // Reports — breakdowns and trends.
        'monthlyTrend' => 'reports',
        'deptChart' => 'reports',
        'recentPrs' => 'reports',
        'recentActivity' => 'reports',
    ],

    /*
    |---------------------------------------------------------------------------
    | Widgets to drop when they come back empty
    |---------------------------------------------------------------------------
    | An empty work queue is meaningful ("nothing to verify today"). An empty
    | stats row or chart is just a gap in the grid, so it gets removed instead.
    */
    'hide_when_empty' => ['stats', 'deptChart'],
];
