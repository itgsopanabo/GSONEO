<?php

use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\CalendarEventController;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\RequiredPasswordChangeController;
use App\Http\Controllers\CanvasFromController;
use App\Http\Controllers\CustomReportController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DocsController;
use App\Http\Controllers\DocumentSettingController;
use App\Http\Controllers\EncodingController;
use App\Http\Controllers\IARController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\ItemsController;
use App\Http\Controllers\MissingTrackerController;
use App\Http\Controllers\OfficeController;
use App\Http\Controllers\Others\LeaveController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\PurchaseOrderController;
use App\Http\Controllers\PurchaseRequestController;
use App\Http\Controllers\RecordsClassesController;
use App\Http\Controllers\RecordsController;
use App\Http\Controllers\RequestMonitoringController;
use App\Http\Controllers\RolePermissionController;
use App\Http\Controllers\RISController;
use App\Http\Controllers\SqlConsoleController;
use App\Http\Controllers\SSMIController;
use App\Http\Controllers\TrackerTagController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::get('/', [AuthenticatedSessionController::class, 'create'])
    ->middleware('guest'); // Prevents logged-in users from seeing it


Route::middleware(['auth', 'active', 'password.changed'])->group(function () {
    // Stays reachable while RequirePasswordChange holds everything else back.
    Route::put('/password/first-change', [RequiredPasswordChangeController::class, 'update'])
        ->name('password.first-change');

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::get('/dashboard', [DashboardController::class, 'index'])
        ->name('dashboard');

    // Dashboard calendar: everyone reads it, calendar.manage changes it.
    Route::get('/calendar-events', [CalendarEventController::class, 'index'])->name('calendar-events.index');
    Route::middleware('permission:calendar.manage')->group(function () {
        Route::post('/calendar-events', [CalendarEventController::class, 'store'])->name('calendar-events.store');
        Route::put('/calendar-events/{calendarEvent}', [CalendarEventController::class, 'update'])->name('calendar-events.update');
        Route::delete('/calendar-events/{calendarEvent}', [CalendarEventController::class, 'destroy'])->name('calendar-events.destroy');
    });

    Route::get('/pls', fn() => view('pdf/pls'))->name('pls');
    Route::get('/leave', [LeaveController::class, 'create'])->name('leave');
    Route::get('/leave/print', [LeaveController::class, 'print'])->name('leave.print');

    //    Procurement
    Route::middleware('permission:pr.view')->group(function () {
        Route::resource('purchase-requests', PurchaseRequestController::class)->only(['index', 'show']);
        Route::get('/purchase-requests/{id}/pdf', [PurchaseRequestController::class, 'exportPdf'])
            ->name('purchase-requests.pdf');
    });

    Route::post('purchase-requests', [PurchaseRequestController::class, 'store'])
        ->name('purchase-requests.store')
        ->middleware('permission:pr.create');

    Route::post('purchase-requests/ocr', [PurchaseRequestController::class, 'ocr'])
        ->name('purchase-requests.ocr')
        ->middleware('permission:pr.create,pr.encode');

    Route::middleware('permission:pr.verify')->group(function () {
        Route::post('purchase-requests/{purchase_request}/verify', [PurchaseRequestController::class, 'verify'])
            ->name('purchase-requests.verify');
        Route::post('purchase-requests/{purchase_request}/decline', [PurchaseRequestController::class, 'decline'])
            ->name('purchase-requests.decline');
    });

    Route::middleware('permission:pr.encode')->group(function () {
        Route::post('encode/draft', [EncodingController::class, 'draft'])->name('encode.draft');
        Route::resource('encode', EncodingController::class)->parameters(['encode' => 'purchaseRequest']);
    });

    Route::middleware('permission:pr.canvass')->group(function () {
        Route::resource('canvas', CanvasFromController::class)->only(['index', 'show']);
        Route::post('purchase-requests/{purchase_request}/approve', [CanvasFromController::class, 'proceedCanvassing'])
            ->name('purchase-requests.proceedCanvas');
        Route::post('purchase-requests/{purchase_request}/print', [CanvasFromController::class, 'store'])
            ->name('purchase-requests.printCanvas');
        Route::put('canvas/{canva}/reprint', [CanvasFromController::class, 'recanvas'])
            ->name('canvas.reprint');
        Route::get('purchase-requests/{purchase_request}/canvas', [CanvasFromController::class, 'viewCanvasForm'])
            ->name('purchase-requests.canvas');
    });

    Route::middleware('permission:pr.po')->group(function () {
        Route::resource('purchase-orders', PurchaseOrderController::class)->only(['index', 'show']);
        Route::post('purchase-orders/{purchase_order}/generate', [PurchaseOrderController::class, 'generatePONumber'])
            ->name('purchase-orders.generatePONumber');
        Route::post('purchase-requests/{purchase_request}/verifyPO', [PurchaseRequestController::class, 'verifyPO'])
            ->name('purchase-requests.verifyPO');
        Route::post('purchase-requests/{purchase_request}/generate', [PurchaseRequestController::class, 'generatePONumber'])
            ->name('purchase-requests.generatePONumber');
    });

    //    Inventory
    // Outgoing comes first: registered after the resource, /inventory/outgoings
    // would be caught by inventory/{inventory} and look for a PO called "outgoings".
    Route::middleware('permission:inventory.outgoing')->group(function () {
        Route::get('/inventory/outgoings', [InventoryController::class, 'outgoing'])->name('inventory.outgoings');
        Route::post('/inventory/outgoing', [InventoryController::class, 'toRelease'])->name('inventory.outgoing.release');
    });

    Route::middleware('permission:inventory.incoming')->group(function () {
        Route::post('/inventory/to-iar', [InventoryController::class, 'toIAR'])->name('inventory.toIAR');
        Route::resource('inventory', InventoryController::class)->only(['index', 'show']);
    });

    Route::middleware('permission:inventory.iar')->group(function () {
        Route::get('inspection-acceptance-reports', [IARController::class, 'index'])
            ->name('inspection-acceptance-reports.index');
        Route::post('inspection-acceptance-reports/{purchaseOrder}/generate', [IARController::class, 'generate'])
            ->name('inspection-acceptance-reports.generate');
        Route::get('inspection-acceptance-reports/view/{iar}', [IARController::class, 'view'])
            ->name('inspection-acceptance-reports.view');
        Route::get('inspection-acceptance-reports/{purchase_order}', [IARController::class, 'show'])
            ->name('inspection-acceptance-reports.show');
    });

    Route::middleware('permission:inventory.ris')->group(function () {
        Route::get('ris', [RISController::class, 'index'])->name('ris.index');
        Route::get('ris/{purchaseOrder}', [RISController::class, 'show'])->name('ris.show');
        Route::post('ris/{purchaseOrder}/generate', [RISController::class, 'generateRISNumber'])->name('ris.generateNumber');
    });

    Route::middleware('permission:inventory.ssmi')->group(function () {
        Route::get('ssmi', [SSMIController::class, 'index'])->name('ssmi.index');
        Route::post('ssmi/{purchaseOrder:PO_Number}/generate', [SSMIController::class, 'generateNumber'])
            ->name('ssmi.generateNumber');
        Route::post('ssmi/{purchaseOrder}/outgoing', [SSMIController::class, 'toOutgoing'])->name('ssmi.toOutgoing');
        Route::get('/ssmi/{purchaseOrder}/document', [SSMIController::class, 'document'])->name('ssmi.document');
    });

    // Missing tracker: tag an order with what it is missing, from any inventory stage.
    Route::middleware('permission:'.implode(',', MissingTrackerController::PERMISSIONS))->group(function () {
        Route::get('missing-tracker', [MissingTrackerController::class, 'index'])->name('missing-tracker.index');
        Route::post('missing-tracker/{purchaseOrder}', [MissingTrackerController::class, 'store'])->name('missing-tracker.store');
        Route::patch('missing-tracker/{purchaseOrderTag}/resolve', [MissingTrackerController::class, 'resolve'])
            ->name('missing-tracker.resolve');
    });

    //    Records
    Route::middleware('permission:records.view')->group(function () {
        Route::resource('records', RecordsController::class)->except(['create', 'edit', 'destroy']);
        Route::patch('records/{record}/archive', [RecordsController::class, 'archive'])->name('records.archive');
        Route::patch('records/{record}/unarchive', [RecordsController::class, 'unarchive'])->name('records.unarchive');
    });

    Route::middleware('permission:record_classes.manage')->group(function () {
        Route::resource('record-classes', RecordsClassesController::class)
            ->except(['create', 'edit'])
            ->parameters(['record-classes' => 'recordClass']);
        Route::patch('record-classes/{recordClass}/deactivate', [RecordsClassesController::class, 'deactivate'])
            ->name('record-classes.deactivate');
        Route::patch('record-classes/{recordClass}/reactivate', [RecordsClassesController::class, 'reactivate'])
            ->name('record-classes.reactivate');
    });

    //  Monitoring and reports
    Route::middleware('permission:monitoring.view')->group(function () {
        Route::get('/request-monitoring', [RequestMonitoringController::class, 'index'])->name('request-monitoring.index');
        Route::get('/request-monitoring/{id}', [RequestMonitoringController::class, 'show'])->name('request-monitoring.show');
    });

    Route::get('/custom-reports', [CustomReportController::class, 'index'])
        ->name('custom-reports.index')
        ->middleware('permission:reports.custom');
    Route::middleware('permission:reports.sql')->group(function () {
        Route::get('/sql-console', [SqlConsoleController::class, 'index'])->name('sql-console.index');
        // Queries saved for later; only their owner may change or delete them.
        Route::post('/sql-console/saved', [SqlConsoleController::class, 'storeSaved'])->name('sql-console.saved.store');
        Route::put('/sql-console/saved/{savedQuery}', [SqlConsoleController::class, 'updateSaved'])->name('sql-console.saved.update');
        Route::delete('/sql-console/saved/{savedQuery}', [SqlConsoleController::class, 'destroySaved'])->name('sql-console.saved.destroy');
    });
    Route::get('/audit-logs', [AuditLogController::class, 'index'])
        ->name('audit-logs.index')
        ->middleware('permission:audit.view');

    //  Administration
    Route::middleware('permission:users.manage')->group(function () {
        Route::patch('users/{user}/status', [UserController::class, 'updateStatus'])->name('users.status');
        Route::put('users/{user}/password', [UserController::class, 'updatePassword'])->name('users.password');
        Route::patch('users/{user}/role', [UserController::class, 'updateRole'])->name('users.role');
        // Users are added from a dialog on the list and have no edit page.
        Route::resource('users', UserController::class)->only(['index', 'store', 'show', 'destroy']);
    });

    // Administrative repairs, reached from Request Monitoring: cancelling takes a
    // record out of the pipeline, changing the status puts a misrouted one back.
    Route::middleware('permission:procurement.override')->group(function () {
        Route::post('purchase-requests/{purchase_request}/cancel', [PurchaseRequestController::class, 'cancel'])
            ->name('purchase-requests.cancel');
        Route::post('purchase-orders/{purchase_order}/cancel', [PurchaseOrderController::class, 'cancel'])
            ->name('purchase-orders.cancel');
        Route::post('purchase-requests/{purchase_request}/status', [PurchaseRequestController::class, 'changeStatus'])
            ->name('purchase-requests.status');
        Route::post('purchase-orders/{purchase_order}/status', [PurchaseOrderController::class, 'changeStatus'])
            ->name('purchase-orders.status');
    });

    Route::middleware('permission:permissions.manage')->group(function () {
        Route::get('/roles-permissions', [RolePermissionController::class, 'index'])->name('permissions.index');
        Route::put('/roles-permissions/{role}', [RolePermissionController::class, 'update'])->name('permissions.update');
    });

    Route::middleware('permission:docs.view')->group(function () {
        Route::get('/docs', [DocsController::class, 'index'])->name('docs.index');
        Route::get('/docs/erd', [DocsController::class, 'erd'])->name('docs.erd');
        // Stable address the generated viewer imports; redirects to the built asset.
        Route::get('/docs/erd/mermaid.js', [DocsController::class, 'erdMermaid'])->name('docs.erd.mermaid');
    });

    Route::middleware('permission:documents.manage')->group(function () {
        Route::get('/document-settings', [DocumentSettingController::class, 'index'])->name('document-settings.index');
        // POST, not PUT: the form carries file uploads.
        Route::post('/document-settings', [DocumentSettingController::class, 'update'])->name('document-settings.update');
        Route::get('/document-settings/preview', [DocumentSettingController::class, 'preview'])->name('document-settings.preview');
        Route::get('/document-settings/image/{slot}', [DocumentSettingController::class, 'image'])->name('document-settings.image');
        Route::get('/document-settings/signatories', [DocumentSettingController::class, 'signatories'])->name('document-settings.signatories');
        Route::put('/document-settings/signatories', [DocumentSettingController::class, 'updateSignatories'])->name('document-settings.signatories.update');
    });

    // The requesting offices every form offers.
    Route::middleware('permission:offices.manage')->group(function () {
        Route::get('offices', [OfficeController::class, 'index'])->name('offices.index');
        Route::post('offices', [OfficeController::class, 'store'])->name('offices.store');
        Route::put('offices/{office}', [OfficeController::class, 'update'])->name('offices.update');
        Route::delete('offices/{office}', [OfficeController::class, 'destroy'])->name('offices.destroy');
        Route::patch('offices/{office}/deactivate', [OfficeController::class, 'deactivate'])->name('offices.deactivate');
        Route::patch('offices/{office}/reactivate', [OfficeController::class, 'reactivate'])->name('offices.reactivate');
    });

    // The list of things an order can be missing, for the missing tracker.
    Route::middleware('permission:tracker_tags.manage')->group(function () {
        Route::resource('tracker-tags', TrackerTagController::class)
            ->only(['index', 'store', 'update', 'destroy'])
            ->parameters(['tracker-tags' => 'trackerTag']);
        Route::patch('tracker-tags/{trackerTag}/deactivate', [TrackerTagController::class, 'deactivate'])
            ->name('tracker-tags.deactivate');
        Route::patch('tracker-tags/{trackerTag}/reactivate', [TrackerTagController::class, 'reactivate'])
            ->name('tracker-tags.reactivate');
    });

    Route::middleware('permission:items.manage')->group(function () {
        Route::post('items/bulk', [ItemsController::class, 'bulkStore'])->name('items.bulk');
        Route::resource('/items', ItemsController::class)->except(['create', 'edit', 'show']);
    });

});


require __DIR__ . '/auth.php';
