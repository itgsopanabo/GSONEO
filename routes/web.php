<?php

use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\CanvasFromController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\IARController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\PurchaseOrderController;
use App\Http\Controllers\PurchaseRequestController;
use App\Http\Controllers\RISController;
use App\Http\Controllers\SSMIController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', [AuthenticatedSessionController::class, 'create'])
    ->middleware('guest'); // Prevents logged-in users from seeing it


Route::middleware('auth')->group(function () {
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

    Route::post('purchase-requests/{purchase_request}/approve', [PurchaseRequestController::class, 'canvasing'])
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

    Route::resource('purchase-requests', PurchaseRequestController::class)
        ->middleware('section:Procurement');

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

    Route::get('ssmi', [SSMIController::class, 'index'])
        ->name('ssmi.index')
        ->middleware('section:Inventory and Sales');

    Route::get('ssmi/{purchaseOrder}', [SSMIController::class, 'show'])
        ->name('ssmi.show')
        ->middleware('section:Inventory and Sales');


    Route::resource('inventory', InventoryController::class)
        ->middleware('section:Inventory and Sales');

//    ADMIN/SUPERADMIN/IT
    Route::get('/audit-logs', [AuditLogController::class, 'index'])->name('audit-logs.index');
});


require __DIR__ . '/auth.php';
