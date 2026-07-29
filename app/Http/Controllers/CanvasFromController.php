<?php

namespace App\Http\Controllers;

use App\Models\CanvasForms;
use App\Models\PurchaseRequest;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CanvasFromController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        //
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Generate a PDF file of a Purchase Request.
     * @throws \Throwable
     */
    public function store(Request $request, $purchase_request_id)
    {
        $documents = DB::transaction(function () use ($request, $purchase_request_id) {
            $types = ['Canvas1', 'Canvas2', 'Canvas3'];
            $savedForms = [];

            foreach ($types as $type) {
                $canvasForm = CanvasForms::create([
                    'CF_Number' => 'PENDING',
                    'pr_number' => $purchase_request_id,
                    'CF_to_be_Open' => $request->opened_on,
                    'CF_delivery_Period' => $request->delivery_period,
                    'CF_canvasser' => $request->canvasser,
                    'CF_made_by' => auth()->user()->name ?? 'System',
                    'CF_bac_date' => $request->bac_date,
                ]);

                $canvasForm->update([
                    'CF_Number' => 'CANVAS-' . str_pad($canvasForm->id, 6, '0', STR_PAD_LEFT)
                ]);

                $savedForms[] = $canvasForm;
            }
            return $savedForms;
        });

        // 🎯 FIX: Pluck the explicit 'id' columns from the newly created objects
        $newFormIds = collect($documents)->pluck('id');

        // Load only the specific forms we just generated
        $loadedDocuments = CanvasForms::with(['purchaseRequest.items'])
            ->whereIn('id', $newFormIds)
            ->get();

        // Pass down only the 3 new records
        $pdf = Pdf::loadView('pdf.canvas-form', ['documents' => $loadedDocuments]);

        return $pdf->stream('Canvas-Forms-PR-' . $purchase_request_id . '.pdf');
    }

    /**
     * Display the specified resource.
     */
    public function show(CanvasForms $canvasForms)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(CanvasForms $canvasForms)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, CanvasForms $canvasForms)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(CanvasForms $canvasForms)
    {
        //
    }
}
