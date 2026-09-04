<?php

use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\CanvasFromController;
use App\Http\Controllers\CustomReportController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\EncodingController;
use App\Http\Controllers\IARController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\ItemsController;
use App\Http\Controllers\Others\LeaveController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\PurchaseOrderController;
use App\Http\Controllers\PurchaseRequestController;
use App\Http\Controllers\RecordsClassesController;
use App\Http\Controllers\RecordsController;
use App\Http\Controllers\RequestMonitoringController;
use App\Http\Controllers\RISController;
use App\Http\Controllers\SqlConsoleController;
use App\Http\Controllers\SSMIController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::get('/', [AuthenticatedSessionController::class, 'create'])
    ->middleware('guest'); // Prevents logged-in users from seeing it

Route::get('/pls', fn() => view('pdf/pls'))->name('pls');


Route::middleware(['auth', 'active'])->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::get('/dashboard', [DashboardController::class, 'index'])
        ->middleware(['auth', 'verified'])
        ->name('dashboard');

//    Procurement
    Route::get('/purchase-requests/{id}/pdf', [PurchaseRequestController::class, 'exportPdf'])
        ->name('purchase-requests.pdf');

    Route::post('purchase-requests/{purchase_request}/verify', [PurchaseRequestController::class, 'verify'])
        ->name('purchase-requests.verify');

    Route::post('purchase-requests/{purchase_request}/decline', [PurchaseRequestController::class, 'decline'])
        ->name('purchase-requests.decline')
        ->middleware('can:verify-pr');

    Route::post('purchase-requests  /{purchase_request}/approve', [CanvasFromController::class, 'proceedCanvassing'])
        ->name('purchase-requests.proceedCanvas')
        ->middleware('can:canvass');

    Route::post('purchase-requests/{purchase_request}/verifyPO', [PurchaseRequestController::class, 'verifyPO'])
        ->name('purchase-requests.verifyPO')
        ->middleware('can:proceedPO');

    Route::post('purchase-requests/{purchase_request}/generate', [PurchaseRequestController::class, 'generatePONumber'])
        ->name('purchase-requests.generatePONumber')
        ->middleware('can:proceedPO');

    Route::post('purchase-requests/{purchase_request}/print', [CanvasFromController::class, 'store'])
        ->name('purchase-requests.printCanvas')
        ->middleware('can:canvass');

    Route::put('canvas/{canva}/reprint', [CanvasFromController::class, 'recanvas'])
        ->name('canvas.reprint')
        ->middleware('can:canvass');

    Route::get('purchase-requests/{purchase_request}/canvas', [CanvasFromController::class, 'viewCanvasForm'])
        ->name('purchase-requests.canvas')
        ->middleware('can:canvass');

    Route::resource('canvas', CanvasFromController::class)
        ->only(['index', 'show'])
        ->middleware('section:Procurement');

    Route::post('purchase-requests/ocr', [PurchaseRequestController::class, 'ocr'])
        ->name('purchase-requests.ocr');


    Route::resource('purchase-requests', PurchaseRequestController::class)
        ->middleware('section:Procurement');

    Route::post('encode/draft', [EncodingController::class, 'draft'])
        ->name('encode.draft')
        ->middleware('section:Procurement');

    Route::resource('encode', EncodingController::class)
        ->middleware('section:Procurement')
        ->parameters(['encode' => 'purchaseRequest']);

    //    Purchase Order

    Route::resource('purchase-orders', PurchaseOrderController::class)
        ->only(['index', 'show']);

    Route::post('purchase-orders/{purchase_order}/generate', [PurchaseOrderController::class, 'generatePONumber'])
        ->name('purchase-orders.generatePONumber')
        ->middleware('can:proceedPO');


//    Inventory
    Route::get('inspection-acceptance-reports', [IARController::class, 'index'])
        ->name('inspection-acceptance-reports.index')
        ->middleware('section:Inventory and Sales');


    Route::get('inspection-acceptance-reports/{purchase_order}', [IARController::class, 'show'])
        ->name('inspection-acceptance-reports.show')
        ->middleware('section:Inventory and Sales');

    Route::get('/inspection-acceptance-reports/{purchaseOrder}/pdf', [IARController::class, 'generatePdf'])
        ->name('inspection-acceptance-reports.pdf');

    Route::post('/inventory/outgoing', [InventoryController::class, 'toRelease'])
        ->name('inventory.outgoing.release')
        ->middleware('section:Inventory and Sales');

    Route::get('/inventory/outgoings', [InventoryController::class, 'outgoing'])
        ->name('inventory.outgoings')
        ->middleware('section:Inventory and Sales');

    Route::post('/inventory/to-iar', [InventoryController::class, 'toIAR'])->name('inventory.toIAR');

    Route::get('ris', [RISController::class, 'index'])
        ->name('ris.index')
        ->middleware('section:Inventory and Sales');

    Route::get('ris/{purchaseOrder}', [RISController::class, 'show'])
        ->name('ris.show')
        ->middleware('section:Inventory and Sales');

    Route::post('ris/{purchaseOrder}/generate', [RISController::class, 'generateRISNumber'])
        ->name('ris.generateNumber')
        ->middleware('section:Inventory and Sales');

    Route::post('ssmi/{purchaseOrder:PO_Number}/generate', [SSMIController::class, 'generateNumber'])
        ->name('ssmi.generateNumber');

    Route::post('ssmi/{purchaseOrder}/outgoing', [SSMIController::class, 'toOutgoing'])
        ->name('ssmi.toOutgoing')
        ->middleware('section:Inventory and Sales');


    Route::get('ssmi', [SSMIController::class, 'index'])
        ->name('ssmi.index')
        ->middleware('section:Inventory and Sales');


    Route::resource('inventory', InventoryController::class)
        ->middleware('section:Inventory and Sales');


    //    ADMIN/SUPERADMIN/IT
    Route::get('/request-monitoring', [RequestMonitoringController::class, 'index'])
        ->name('request-monitoring.index');
    Route::get('/request-monitoring/{id}', [RequestMonitoringController::class, 'show'])
        ->name('request-monitoring.show');


    Route::middleware('can:records.view')->group(function () {
        Route::resource('records', RecordsController::class)->except(['create', 'edit', 'destroy']);
        Route::patch('records/{record}/archive', [RecordsController::class, 'archive'])->name('records.archive');
        Route::patch('records/{record}/unarchive', [RecordsController::class, 'unarchive'])->name('records.unarchive');
    });

    Route::middleware(['can:record_classes.manage'])->group(function () {
        Route::resource('record-classes', RecordsClassesController::class)
            ->except(['create', 'edit'])
            ->parameters(['record-classes' => 'recordClass']);

        Route::patch('record-classes/{recordClass}/deactivate', [RecordsClassesController::class, 'deactivate'])
            ->name('record-classes.deactivate');
        Route::patch('record-classes/{recordClass}/reactivate', [RecordsClassesController::class, 'reactivate'])
            ->name('record-classes.reactivate');
    });

    Route::get('/custom-reports', [CustomReportController::class, 'index'])
        ->name('custom-reports.index');

    Route::get('/sql-console', [SqlConsoleController::class, 'index'])
        ->middleware('auth')
        ->name('sql-console.index');


    Route::middleware('can:users.manage')->group(function () {
        Route::patch('users/{user}/status', [UserController::class, 'updateStatus'])
            ->name('users.status');

        Route::resource('users', UserController::class);
    });

    Route::get('/audit-logs', [AuditLogController::class, 'index'])->name('audit-logs.index');

    Route::post('items/bulk', [ItemsController::class, 'bulkStore'])->name('items.bulk');
    Route::resource('/items', ItemsController::class)->except(['create', 'edit', 'show']);

    Route::get('/leave', [LeaveController::class, 'create'])->name('leave');
    Route::get('/leave/print', [LeaveController::class, 'print'])->name('leave.print');
});


require __DIR__ . '/auth.php';
