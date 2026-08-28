<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\CanvasForms;
use App\Models\PurchaseRequest;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class CanvasFromController extends Controller
{
    /**
     * Display purchase requests available for canvassing, along with their
     * most recently generated Canvas form number (if one exists).
     */
    public function index()
    {
        $purchaseRequests = PurchaseRequest::with([
            'items',
            'canvasForms' => fn($query) => $query->latest('id'),
        ])
            ->whereIn('status', [100, 200, 205])
            ->orderByDesc('status')
            ->latest()
            ->paginate(10);

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'viewed_index',
            'auditable_type' => null,
            'auditable_id' => null,
            'description' => 'Navigated to Canvas Module',
            'old_values' => null,
            'new_values' => null,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);

        return Inertia::render('Canvas/Index', compact('purchaseRequests'));
    }

    /**
     * Generate three vendor copies under a new Canvas number. A purchase
     * request may have multiple Canvas numbers, each retained as history.
     */
    public function store(Request $request, PurchaseRequest $purchase_request)
    {
        $validated = $this->validateCanvasDetails($request);

        $documents = DB::transaction(function () use ($validated, $purchase_request) {
            $sharedNumber = $this->nextCanvasNumber();

            return collect(range(1, 3))->map(function () use ($validated, $purchase_request, $sharedNumber) {
                return CanvasForms::create([
                    'CF_Number' => $sharedNumber,
                    'pr_number' => $purchase_request->pr_number,
                    'CF_to_be_Open' => $validated['opened_on'],
                    'CF_delivery_Period' => $validated['delivery_period'] ?? '',
                    'CF_made_by' => Auth::user()?->name ?? 'System',
                    'CF_bac_date' => $validated['bac_date'] ?? '',
                ]);
            });
        });

        $purchase_request->update(['status' => 205, 'mode_of_procurement' => 'SVP']);

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'created',
            'auditable_type' => CanvasForms::class,
            'auditable_id' => $documents->first()->id,
            'description' => "Generated Canvas form {$documents->first()->CF_Number} for {$purchase_request->pr_number}",
            'old_values' => null,
            'new_values' => ['CF_Number' => $documents->first()->CF_Number, 'pr_number' => $purchase_request->pr_number],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return redirect()
            ->route('canvas.index')
            ->with('success', "Canvas form {$documents->first()->CF_Number} generated successfully.");
    }

    /**
     * Update and reprint one existing Canvas number and its three vendor
     * copies, without changing other Canvas forms for the same PR.
     */
    public function recanvas(Request $request, CanvasForms $canva)
    {
        $validated = $this->validateCanvasDetails($request);

        $documents = DB::transaction(function () use ($validated, $canva) {
            $documents = CanvasForms::where('CF_Number', $canva->CF_Number)
                ->orderBy('id')
                ->lockForUpdate()
                ->get();

            abort_if($documents->isEmpty(), 404, "Canvas form {$canva->CF_Number} does not exist.");

            foreach ($documents as $document) {
                $document->update([
                    'CF_to_be_Open' => $validated['opened_on'],
                    'CF_delivery_Period' => $validated['delivery_period'] ?? '',
                    'CF_bac_date' => $validated['bac_date'] ?? '',
                ]);
            }

            return $documents;
        });

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'updated',
            'auditable_type' => CanvasForms::class,
            'auditable_id' => $documents->first()->id,
            'description' => "Updated and reprinted Canvas form {$documents->first()->CF_Number} for {$canva->pr_number}",
            'old_values' => null,
            'new_values' => ['CF_Number' => $documents->first()->CF_Number, 'pr_number' => $canva->pr_number],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return $this->streamCanvasForms($documents->pluck('id')->all(), $canva->pr_number);
    }

    /**
     * Stream an already generated Canvas form and all of its vendor copies.
     */
    public function show(CanvasForms $canva)
    {
        $documentIds = CanvasForms::where('CF_Number', $canva->CF_Number)
            ->orderBy('id')
            ->pluck('id')
            ->all();

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'viewed',
            'auditable_type' => CanvasForms::class,
            'auditable_id' => $canva->id,
            'description' => "Viewed Canvas form {$canva->CF_Number}",
            'old_values' => null,
            'new_values' => null,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);

        return $this->streamCanvasForms($documentIds, $canva->pr_number);
    }

    /**
     * Backwards-compatible endpoint for callers that pass a purchase-request
     * ID instead of an individual Canvas form ID.
     */
    public function viewCanvasForm(PurchaseRequest $purchase_request)
    {
        $canvas = CanvasForms::where('pr_number', $purchase_request->pr_number)
            ->orderByDesc('id')
            ->firstOrFail();

        return $this->show($canvas);
    }

    private function validateCanvasDetails(Request $request): array
    {
        return $request->validate([
            'opened_on' => ['required', 'date'],
            'delivery_period' => ['nullable', 'string', 'max:255'],
            'bac_date' => ['nullable', 'date'],
        ]);
    }

    private function nextCanvasNumber(): string
    {
        $lastNumber = CanvasForms::where('CF_Number', 'like', 'CANVAS-%')
            ->lockForUpdate()
            ->pluck('CF_Number')
            ->map(fn(string $number) => (int)preg_replace('/^CANVAS-/', '', $number))
            ->max();

        return 'CANVAS-' . str_pad(($lastNumber ?? 0) + 1, 6, '0', STR_PAD_LEFT);
    }

    private function streamCanvasForms(array $documentIds, string $prNumber)
    {
        $documents = CanvasForms::with('purchaseRequest.items')
            ->whereIn('id', $documentIds)
            ->orderBy('id')
            ->get();

        abort_if($documents->isEmpty(), 404, 'Canvas form not found.');

        return Pdf::loadView('pdf.canvas-form', compact('documents'))
            ->stream("Canvas-Forms-PR-{$prNumber}.pdf");
    }


    /**
     * Proceed to canvassing.
     */
    public function proceedCanvassing(string $id)
    {
        $pr = PurchaseRequest::findOrFail($id);

        // Capture baseline data before alteration
        $oldValues = ['status' => $pr->status, 'verify_by_emp_id' => $pr->verify_by_emp_id, 'verified_At' => $pr->verified_At];

        $pr->update([
            'status' => 200,
            'mode_of_procurement' => 'SVP',
            'verify_by_emp_id' => auth()->id(),
            'verified_At' => now(),
        ]);


        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'Canvassing',
            'auditable_type' => PurchaseRequest::class,
            'auditable_id' => $pr->pr_number,
            'description' => "Proceed Purchase Request #{$pr->pr_number} to canvassing",
            'old_values' => $oldValues,
            'new_values' => ['status' => 200, 'start_canvas_by' => auth()->id()],
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);


        return redirect()->route('canvas.index')->with('success', 'Purchase Request has been proceed to canvassing.');
    }

}
